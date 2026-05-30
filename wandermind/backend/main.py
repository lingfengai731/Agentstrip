import base64
import hashlib
import hmac
import json
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

load_dotenv(Path(__file__).parent.parent / ".env")

app = FastAPI(title="WanderMind API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Database ────────────────────────────────────────────────
DB_PATH = Path(os.getenv("DB_PATH", str(Path(__file__).parent / "wandermind.db")))


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            email       TEXT UNIQUE NOT NULL,
            name        TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            lang        TEXT DEFAULT 'zh',
            created_at  INTEGER NOT NULL
        )
    """)
    conn.commit()
    conn.close()


init_db()

# ─── JWT (no external deps) ──────────────────────────────────
_SECRET = os.getenv("SECRET_KEY", "wandermind-dev-secret-please-change")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _sign(header_b64: str, payload_b64: str) -> str:
    msg = f"{header_b64}.{payload_b64}".encode()
    sig = hmac.new(_SECRET.encode(), msg, hashlib.sha256).digest()
    return _b64(sig)


def make_token(user_id: str, email: str) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(
        json.dumps({
            "sub": user_id,
            "email": email,
            "exp": int(time.time()) + 7 * 86400,
            "iat": int(time.time()),
        }).encode()
    )
    return f"{header}.{payload}.{_sign(header, payload)}"


def verify_token(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("bad token")
    h, p, s = parts
    if not hmac.compare_digest(s, _sign(h, p)):
        raise ValueError("bad signature")
    # pad back for decoding
    payload = json.loads(base64.urlsafe_b64decode(p + "=="))
    if payload.get("exp", 0) < time.time():
        raise ValueError("token expired")
    return payload


# ─── Password ────────────────────────────────────────────────
def hash_pw(pw: str) -> str:
    salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000)
    return f"{salt}:{dk.hex()}"


def verify_pw(pw: str, stored: str) -> bool:
    try:
        salt, dk = stored.split(":")
        expected = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000)
        return hmac.compare_digest(expected.hex(), dk)
    except Exception:
        return False


# ─── Auth dependency ─────────────────────────────────────────
async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        return verify_token(authorization.split(" ", 1)[1])
    except ValueError as e:
        raise HTTPException(401, str(e))


# ─── Request models ──────────────────────────────────────────
class RegisterReq(BaseModel):
    email: str
    password: str
    name: str


class LoginReq(BaseModel):
    email: str
    password: str


class Message(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    messages: List[Message]
    system: str
    agent: str = "planner"
    destination: str = "bali"


class GenerateReq(BaseModel):
    prompt: str
    max_tokens: int = 1000


# ─── Auth routes ─────────────────────────────────────────────
@app.post("/api/auth/register")
async def register(data: RegisterReq):
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if "@" not in data.email:
        raise HTTPException(400, "Invalid email address")
    conn = get_db()
    try:
        uid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)",
            (uid, data.email.lower().strip(), data.name.strip(), hash_pw(data.password), int(time.time())),
        )
        conn.commit()
        return {"token": make_token(uid, data.email), "user": {"id": uid, "email": data.email, "name": data.name}}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Email already registered")
    finally:
        conn.close()


@app.post("/api/auth/login")
async def login(data: LoginReq):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE email=?", (data.email.lower().strip(),)).fetchone()
        if not row or not verify_pw(data.password, row["password_hash"]):
            raise HTTPException(401, "Invalid email or password")
        return {"token": make_token(row["id"], row["email"]), "user": {"id": row["id"], "email": row["email"], "name": row["name"]}}
    finally:
        conn.close()


@app.get("/api/auth/me")
async def me(user=Depends(current_user)):
    conn = get_db()
    try:
        row = conn.execute("SELECT id,email,name,lang FROM users WHERE id=?", (user["sub"],)).fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        return dict(row)
    finally:
        conn.close()


# ─── AI config (OpenAI-compatible — MiMo / any proxy) ────────
_API_KEY   = os.getenv("API_KEY", "")
_MODEL     = os.getenv("MODEL", "mimo-v2.5-pro")
_CHAT_URL  = os.getenv("CHAT_URL", "https://api.xiaomimimo.com/v1/chat/completions")


def _ai_headers() -> dict:
    return {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
    }


# ─── Chat (SSE streaming, OpenAI format) ─────────────────────
@app.post("/api/chat")
async def chat(req: ChatReq, user=Depends(current_user)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set in .env")

    # Prepend system prompt as a system message (OpenAI style)
    messages = [{"role": "system", "content": req.system}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    async def stream():
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    _CHAT_URL,
                    headers=_ai_headers(),
                    json={
                        "model": _MODEL,
                        "max_tokens": 2000,
                        "stream": True,
                        "messages": messages,
                    },
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        try:
                            err = json.loads(body).get("error", {}).get("message", "API error")
                        except Exception:
                            err = body.decode(errors="replace")[:200]
                        yield f"data: {json.dumps({'type':'error','message':err})}\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            yield f"data: {json.dumps({'type':'done','searched':False})}\n\n"
                            return
                        try:
                            ev = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        # OpenAI streaming: choices[0].delta.content
                        choices = ev.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {})
                        text = delta.get("content", "")
                        if text:
                            yield f"data: {json.dumps({'type':'text','text':text})}\n\n"

        except httpx.TimeoutException:
            yield f"data: {json.dumps({'type':'error','message':'Request timed out (>2min)'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','message':str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── One-shot generate (multiverse / budget AI) ──────────────
@app.post("/api/generate")
async def generate(req: GenerateReq, user=Depends(current_user)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set in .env")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            _CHAT_URL,
            headers=_ai_headers(),
            json={
                "model": _MODEL,
                "max_tokens": req.max_tokens,
                "messages": [{"role": "user", "content": req.prompt}],
            },
        )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    data = resp.json()
    choices = data.get("choices") or []
    text = choices[0].get("message", {}).get("content", "") if choices else ""
    return {"content": text}


# ─── Serve frontend ──────────────────────────────────────────
_FRONTEND = Path(__file__).parent.parent / "frontend" / "index.html"


@app.get("/")
async def frontend():
    if not _FRONTEND.exists():
        return HTMLResponse("<h1>frontend/index.html not found</h1>", status_code=404)
    return HTMLResponse(_FRONTEND.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

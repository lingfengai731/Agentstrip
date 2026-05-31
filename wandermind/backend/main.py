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
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, StreamingResponse
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            dest        TEXT DEFAULT 'bali',
            title       TEXT,
            messages    TEXT DEFAULT '[]',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
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
    search: bool = True        # allow frontend to opt-out


class GenerateReq(BaseModel):
    prompt: str
    max_tokens: int = 1000


class SaveConvReq(BaseModel):
    conv_id: Optional[str] = None
    dest: str = "bali"
    title: str = "新行程"
    messages: list = []


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


# ─── Conversation history ─────────────────────────────────────
@app.get("/api/conversations")
async def list_convs(user=Depends(current_user)):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id,dest,title,created_at,updated_at FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 20",
            (user["sub"],)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.post("/api/conversations")
async def save_conv(data: SaveConvReq, user=Depends(current_user)):
    conn = get_db()
    try:
        now = int(time.time())
        if data.conv_id:
            conn.execute(
                "UPDATE conversations SET title=?,messages=?,dest=?,updated_at=? WHERE id=? AND user_id=?",
                (data.title, json.dumps(data.messages, ensure_ascii=False), data.dest, now, data.conv_id, user["sub"])
            )
            conv_id = data.conv_id
        else:
            conv_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO conversations (id,user_id,dest,title,messages,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                (conv_id, user["sub"], data.dest, data.title, json.dumps(data.messages, ensure_ascii=False), now, now)
            )
        conn.commit()
        return {"id": conv_id}
    finally:
        conn.close()


@app.get("/api/conversations/{conv_id}")
async def get_conv(conv_id: str, user=Depends(current_user)):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM conversations WHERE id=? AND user_id=?", (conv_id, user["sub"])
        ).fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        d = dict(row)
        d["messages"] = json.loads(d["messages"])
        return d
    finally:
        conn.close()


@app.delete("/api/conversations/{conv_id}")
async def delete_conv(conv_id: str, user=Depends(current_user)):
    conn = get_db()
    try:
        conn.execute("DELETE FROM conversations WHERE id=? AND user_id=?", (conv_id, user["sub"]))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ─── AI config (OpenAI-compatible — MiMo / any proxy) ────────
_API_KEY  = os.getenv("API_KEY", "")
_MODEL    = os.getenv("MODEL", "mimo-v2.5-pro")
_CHAT_URL = os.getenv("CHAT_URL", "https://api.xiaomimimo.com/v1/chat/completions")


def _ai_headers() -> dict:
    return {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
    }


# ─── Tavily Web Search ────────────────────────────────────────
_TAVILY_KEY = os.getenv("TAVILY_API_KEY", "")
_TAVILY_URL = "https://api.tavily.com/search"

# Keywords that trigger real-time search
_SEARCH_TRIGGERS = [
    "最新", "最近", "现在", "今天", "今年", "2025", "2026",
    "签证", "visa", "入境", "政策", "要求", "手续",
    "天气", "气候", "温度",
    "价格", "价钱", "多少钱", "收费", "门票",
    "航班", "机票", "flight",
    "酒店", "民宿", "住宿", "hotel",
    "开放", "关闭", "营业", "休息",
    "节日", "活动", "演出", "festival",
    "搜索", "查一下", "查询", "查找",
    "安全", "注意", "警告", "提醒",
]


def _should_search(messages: list, force: bool = False) -> bool:
    """Return True if the last user message should trigger web search."""
    if not _TAVILY_KEY:
        return False
    if force:
        return True
    for msg in reversed(messages):
        if msg.get("role") == "user":
            text = msg.get("content", "").lower()
            return any(kw in text for kw in _SEARCH_TRIGGERS)
    return False


async def tavily_search(query: str, destination: str = "") -> tuple[str, list]:
    """
    Call Tavily and return (formatted_context, raw_results).
    Returns ("", []) on failure.
    """
    search_q = f"{destination} {query}".strip() if destination else query
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                _TAVILY_URL,
                json={
                    "api_key": _TAVILY_KEY,
                    "query": search_q,
                    "search_depth": "basic",
                    "max_results": 5,
                    "include_answer": True,
                    "include_raw_content": False,
                },
            )
        if resp.status_code != 200:
            return "", []
        data = resp.json()

        parts = []
        if data.get("answer"):
            parts.append(f"快速答案: {data['answer']}")

        results = []
        for r in data.get("results", [])[:4]:
            title   = r.get("title", "")
            content = r.get("content", "")[:400]
            url     = r.get("url", "")
            parts.append(f"【{title}】\n{content}\n来源: {url}")
            results.append({"title": title, "url": url, "snippet": content[:100]})

        return "\n\n".join(parts), results
    except Exception:
        return "", []


# ─── Chat (SSE streaming, OpenAI format) ─────────────────────
@app.post("/api/chat")
async def chat(req: ChatReq, user=Depends(current_user)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")

    raw_messages = [{"role": m.role, "content": m.content} for m in req.messages]

    async def stream():
        search_context = ""
        search_results: list = []
        searched = False

        # ── Step 1: web search if triggered ──────────────────
        if req.search and _should_search(raw_messages):
            yield f"data: {json.dumps({'type':'search_start'})}\n\n"
            last_q = next(
                (m["content"] for m in reversed(raw_messages) if m["role"] == "user"),
                req.destination,
            )
            search_context, search_results = await tavily_search(last_q, req.destination)
            if search_context:
                searched = True
                yield f"data: {json.dumps({'type':'search_done','count':len(search_results),'results':search_results})}\n\n"

        # ── Step 2: build messages ────────────────────────────
        system = req.system
        if search_context:
            today = time.strftime("%Y-%m-%d")
            system += (
                f"\n\n【🌐 实时联网搜索结果 · {today}】\n"
                f"{search_context}\n\n"
                "请在回答中整合以上最新搜索信息，适当标注来源，让用户感受到信息的时效性。"
            )

        messages = [{"role": "system", "content": system}]
        messages += raw_messages

        # ── Step 3: stream AI response ────────────────────────
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
                            yield f"data: {json.dumps({'type':'done','searched':searched})}\n\n"
                            return
                        try:
                            ev = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
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
        raise HTTPException(500, "API_KEY not set")
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


# ─── PWA: manifest + service worker ──────────────────────────
@app.get("/manifest.json")
async def manifest():
    return JSONResponse({
        "name": "WanderMind · 游心",
        "short_name": "WanderMind",
        "description": "AI 多智能体旅行规划平台",
        "start_url": "/",
        "display": "standalone",
        "orientation": "portrait-primary",
        "background_color": "#0F0D0A",
        "theme_color": "#0E7C6B",
        "lang": "zh-CN",
        "icons": [
            {
                "src": "/icon.svg",
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any maskable",
            }
        ],
        "categories": ["travel", "productivity"],
        "screenshots": [],
    })


@app.get("/icon.svg")
async def icon():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="40" fill="#0E7C6B"/>
  <text x="96" y="130" text-anchor="middle" font-size="100" font-family="serif">游</text>
</svg>"""
    return PlainTextResponse(svg, media_type="image/svg+xml")


@app.get("/sw.js")
async def service_worker():
    sw = """
const CACHE = 'wandermind-v2';
const SHELL = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Never cache API or SSE calls
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
"""
    return PlainTextResponse(sw, media_type="application/javascript")


# ─── Serve frontend ──────────────────────────────────────────
_FRONTEND = Path(__file__).parent.parent / "frontend" / "index.html"


@app.get("/")
async def frontend():
    if not _FRONTEND.exists():
        return HTMLResponse("<h1>frontend/index.html not found</h1>", status_code=404)
    return HTMLResponse(
        _FRONTEND.read_text(encoding="utf-8"),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

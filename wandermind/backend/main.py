import asyncio
import base64
import hashlib
import re
import hmac
import json
import os
import time
import uuid
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import get_db, init_db, IntegrityError, backend_name
from email_service import send_welcome, send_password_reset, send_driver_request

load_dotenv(Path(__file__).parent.parent / ".env")

app = FastAPI(title="WanderMind API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Database init (SQLite local / PostgreSQL prod via DATABASE_URL) ─
init_db()
print(f"[wandermind] DB backend: {backend_name()}")

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


def make_reset_token(user_id: str, email: str, ttl_seconds: int = 3600) -> str:
    """Single-purpose JWT for password reset. Defaults to 1h validity."""
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(
        json.dumps({
            "sub": user_id,
            "email": email,
            "purpose": "pwreset",
            "exp": int(time.time()) + ttl_seconds,
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


# Soft auth: returns the user dict if a valid token is present, else None.
# Used by public AI endpoints (chat / search / generate) so anonymous
# WanderMind Studio visitors can use the tool without signing in.
async def optional_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return verify_token(authorization.split(" ", 1)[1])
    except Exception:
        return None


# ─── AI usage quota (5 free Q&A, then beans) ─────────────────
FREE_USE_LIMIT = int(os.getenv("FREE_USE_LIMIT", "5"))


async def anon_id_header(x_anon_id: Optional[str] = Header(None, alias="X-Anon-Id")):
    """Client-generated stable id for metering not-logged-in visitors."""
    if x_anon_id and re.fullmatch(r"[A-Za-z0-9_-]{8,64}", x_anon_id):
        return x_anon_id
    return None


def _quota_snapshot(conn, user, anon_id) -> dict:
    """Read current quota without consuming. Never raises."""
    fu = b = 0
    tracked = True
    if user:
        row = conn.execute("SELECT free_uses, beans FROM users WHERE id=?", (user["sub"],)).fetchone()
        if row:
            d = dict(row); fu = d.get("free_uses") or 0; b = d.get("beans") or 0
    elif anon_id:
        row = conn.execute("SELECT free_uses, beans FROM guest_usage WHERE anon_id=?", (anon_id,)).fetchone()
        if row:
            d = dict(row); fu = d.get("free_uses") or 0; b = d.get("beans") or 0
    else:
        tracked = False  # no id to meter against
    free_left = max(0, FREE_USE_LIMIT - fu)
    return {
        "free_used": fu, "free_limit": FREE_USE_LIMIT, "free_left": free_left,
        "beans": b, "can_use": (not tracked) or free_left > 0 or b > 0,
        "logged_in": bool(user), "tracked": tracked,
    }


def quota_status(user, anon_id) -> dict:
    conn = get_db()
    try:
        return _quota_snapshot(conn, user, anon_id)
    finally:
        conn.close()


def consume_quota(user, anon_id):
    """Consume one AI use. Raises HTTPException(402) when exhausted.
    Returns the post-consume snapshot."""
    conn = get_db()
    try:
        if user:
            row = conn.execute("SELECT free_uses, beans FROM users WHERE id=?", (user["sub"],)).fetchone()
            fu = (dict(row).get("free_uses") or 0) if row else 0
            b = (dict(row).get("beans") or 0) if row else 0
            if fu < FREE_USE_LIMIT:
                conn.execute("UPDATE users SET free_uses=free_uses+1 WHERE id=?", (user["sub"],))
            elif b > 0:
                conn.execute("UPDATE users SET beans=beans-1 WHERE id=?", (user["sub"],))
            else:
                raise HTTPException(402, detail={"error": "quota_exhausted", "free_limit": FREE_USE_LIMIT, "beans": 0})
            conn.commit()
        elif anon_id:
            now = int(time.time())
            row = conn.execute("SELECT free_uses, beans FROM guest_usage WHERE anon_id=?", (anon_id,)).fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO guest_usage (anon_id, free_uses, beans, created_at, updated_at) VALUES (?,?,?,?,?)",
                    (anon_id, 1, 0, now, now),
                )
            else:
                d = dict(row); fu = d.get("free_uses") or 0; b = d.get("beans") or 0
                if fu < FREE_USE_LIMIT:
                    conn.execute("UPDATE guest_usage SET free_uses=free_uses+1, updated_at=? WHERE anon_id=?", (now, anon_id))
                elif b > 0:
                    conn.execute("UPDATE guest_usage SET beans=beans-1, updated_at=? WHERE anon_id=?", (now, anon_id))
                else:
                    raise HTTPException(402, detail={"error": "quota_exhausted", "free_limit": FREE_USE_LIMIT, "beans": 0})
            conn.commit()
        # else: no id → cannot meter, allow through (frontend always sends one)
        return _quota_snapshot(conn, user, anon_id)
    finally:
        conn.close()


# ─── Request models ──────────────────────────────────────────
class RegisterReq(BaseModel):
    email: str
    password: str
    name: str


class LoginReq(BaseModel):
    email: str
    password: str


class ForgotPwReq(BaseModel):
    email: str


class ResetPwReq(BaseModel):
    token: str
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
    mode: str = "pro"          # "fast" (SiliconFlow Qwen2.5-7B) | "pro" (MiMo)


class GenerateReq(BaseModel):
    prompt: str
    max_tokens: int = 1000


class SaveConvReq(BaseModel):
    conv_id: Optional[str] = None
    dest: str = "bali"
    title: str = "新行程"
    messages: list = []


class PrefsReq(BaseModel):
    preferences: dict = {}


class DestInfoReq(BaseModel):
    destination: str
    lang: str = "zh"


class HotelSearchReq(BaseModel):
    destination: str
    check_in: str   # YYYY-MM-DD
    check_out: str  # YYYY-MM-DD
    adults: int = 2
    lang: str = "zh"


class FlightSearchReq(BaseModel):
    origin: str          # City name or IATA code (e.g. "上海", "PVG", "New York")
    destination: str     # City name or IATA code
    depart_date: str     # YYYY-MM-DD
    return_date: str = ""  # empty → one-way
    adults: int = 1
    lang: str = "zh"


class ShareCreateReq(BaseModel):
    conv_id: Optional[str] = None       # if user already saved this trip
    title: Optional[str] = ""
    dest: Optional[str] = "bali"
    messages: Optional[List[dict]] = None
    trip_meta: Optional[dict] = None    # {start, end, days, people, budget, style}


class FuseReq(BaseModel):
    guest_name: str = ""
    # Free-form structured prefs from the form. We accept anything and
    # serialize as JSON — the AI prompt builder will format whatever's here.
    guest_prefs: dict
    lang: str = "zh"


class DriverReq(BaseModel):
    first_name: str = ""
    last_name: str = ""
    intro: str = ""
    contact_whatsapp: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    num_people: Optional[int] = None
    num_days: Optional[int] = None
    attractions: str = ""


# ─── Auth routes ─────────────────────────────────────────────
def _public_base_url(request: Request) -> str:
    """Pick the externally-visible base URL for email links.
    PUBLIC_URL env wins → otherwise auto-detect from request headers."""
    env_url = os.getenv("PUBLIC_URL", "").strip().rstrip("/")
    if env_url:
        return env_url
    # FastAPI's Request.base_url honours X-Forwarded-Proto/Host so works
    # behind Render's TLS terminator.
    return str(request.base_url).rstrip("/")


@app.post("/api/auth/register")
async def register(data: RegisterReq, request: Request):
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if "@" not in data.email:
        raise HTTPException(400, "Invalid email address")
    conn = get_db()
    try:
        uid = str(uuid.uuid4())
        email = data.email.lower().strip()
        name = data.name.strip()
        conn.execute(
            "INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)",
            (uid, email, name, hash_pw(data.password), int(time.time())),
        )
        conn.commit()
        # Fire welcome email in background — never block registration on it
        asyncio.create_task(send_welcome(email, name, _public_base_url(request)))
        return {"token": make_token(uid, data.email), "user": {"id": uid, "email": data.email, "name": data.name}}
    except IntegrityError:
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


@app.post("/api/auth/forgot-password")
async def forgot_password(data: ForgotPwReq, request: Request):
    """Send a password-reset email. Returns the same response regardless of
    whether the email exists (no account-enumeration leak)."""
    email = (data.email or "").lower().strip()
    if "@" not in email:
        raise HTTPException(400, "Invalid email address")
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id,email,name FROM users WHERE email=?", (email,)
        ).fetchone()
        if row:
            r = dict(row)
            token = make_reset_token(r["id"], r["email"])
            link = f"{_public_base_url(request)}/reset-password?token={token}"
            # Background send; we don't expose success/failure to caller
            asyncio.create_task(send_password_reset(r["email"], r["name"] or r["email"], link))
        # Always return the same message
        return {"ok": True, "message": "If that email is registered, a reset link has been sent."}
    finally:
        conn.close()


@app.post("/api/auth/reset-password")
async def reset_password(data: ResetPwReq):
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    try:
        payload = verify_token(data.token)
    except ValueError as e:
        raise HTTPException(400, f"Invalid or expired reset link ({e})")
    if payload.get("purpose") != "pwreset":
        raise HTTPException(400, "Wrong token type")
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(400, "Bad token payload")
    conn = get_db()
    try:
        # Confirm the user still exists
        row = conn.execute("SELECT id,email,name FROM users WHERE id=?", (uid,)).fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        r = dict(row)
        conn.execute(
            "UPDATE users SET password_hash=? WHERE id=?",
            (hash_pw(data.password), uid),
        )
        conn.commit()
        # Issue a fresh auth token so the user is signed in right after reset
        return {
            "ok": True,
            "token": make_token(uid, r["email"]),
            "user": {"id": uid, "email": r["email"], "name": r["name"]},
        }
    finally:
        conn.close()


# ─── Quota / beans endpoints ─────────────────────────────────
class RedeemReq(BaseModel):
    code: str


def _redeem_codes() -> dict:
    """Parse REDEEM_CODES env: 'CODE1:100,CODE2:50' → {CODE1:100, ...}.
    Lets the owner hand out bean top-ups before a real payment flow exists."""
    raw = os.getenv("REDEEM_CODES", "").strip()
    out = {}
    for part in raw.split(","):
        part = part.strip()
        if ":" in part:
            code, _, amt = part.partition(":")
            code = code.strip()
            try:
                out[code] = int(amt.strip())
            except ValueError:
                pass
    return out


@app.get("/api/quota")
async def get_quota(user=Depends(optional_user), anon_id=Depends(anon_id_header)):
    """Current free-use / beans status for the caller."""
    return quota_status(user, anon_id)


@app.post("/api/quota/redeem")
async def redeem_code(data: RedeemReq, user=Depends(optional_user), anon_id=Depends(anon_id_header)):
    """Redeem a top-up code for beans. Owner-issued codes via REDEEM_CODES env."""
    codes = _redeem_codes()
    amount = codes.get((data.code or "").strip())
    if not amount:
        raise HTTPException(400, "Invalid or expired code")
    conn = get_db()
    try:
        if user:
            conn.execute("UPDATE users SET beans = COALESCE(beans,0) + ? WHERE id=?", (amount, user["sub"]))
            conn.commit()
        elif anon_id:
            now = int(time.time())
            row = conn.execute("SELECT anon_id FROM guest_usage WHERE anon_id=?", (anon_id,)).fetchone()
            if row:
                conn.execute("UPDATE guest_usage SET beans = COALESCE(beans,0) + ?, updated_at=? WHERE anon_id=?", (amount, now, anon_id))
            else:
                conn.execute("INSERT INTO guest_usage (anon_id, free_uses, beans, created_at, updated_at) VALUES (?,?,?,?,?)", (anon_id, 0, amount, now, now))
            conn.commit()
        else:
            raise HTTPException(400, "No session to credit — please reload")
        snap = _quota_snapshot(conn, user, anon_id)
        return {"ok": True, "granted": amount, **snap}
    finally:
        conn.close()


class GrantReq(BaseModel):
    token: str
    email: str
    beans: int


@app.post("/api/admin/grant-beans")
async def admin_grant_beans(data: GrantReq):
    """Owner-only: credit beans to a registered user by email after confirming
    an offline payment (WeChat / Alipay QR). The buyer pays the QR amount, notes
    their account email, and the owner runs this once payment lands. Protected by
    the ADMIN_TOKEN env var — keep that secret, set it only in the host env."""
    admin_token = os.getenv("ADMIN_TOKEN", "").strip()
    if not admin_token:
        raise HTTPException(503, "Admin grants disabled — set ADMIN_TOKEN")
    if (data.token or "").strip() != admin_token:
        raise HTTPException(403, "Bad admin token")
    amount = int(data.beans or 0)
    if amount <= 0:
        raise HTTPException(400, "beans must be a positive integer")
    email = (data.email or "").lower().strip()
    conn = get_db()
    try:
        row = conn.execute("SELECT id, beans FROM users WHERE email=?", (email,)).fetchone()
        if not row:
            raise HTTPException(404, f"No registered user with email {email}")
        d = dict(row)
        conn.execute("UPDATE users SET beans = COALESCE(beans,0) + ? WHERE id=?", (amount, d["id"]))
        conn.commit()
        return {"ok": True, "email": email, "granted": amount, "beans": (d.get("beans") or 0) + amount}
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


# ─── User Preferences ────────────────────────────────────────
@app.get("/api/user/preferences")
async def get_preferences(user=Depends(current_user)):
    conn = get_db()
    try:
        row = conn.execute("SELECT preferences FROM users WHERE id=?", (user["sub"],)).fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        return json.loads(row["preferences"] or "{}")
    finally:
        conn.close()


@app.post("/api/user/preferences")
async def save_preferences(data: PrefsReq, user=Depends(current_user)):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET preferences=? WHERE id=?",
            (json.dumps(data.preferences, ensure_ascii=False), user["sub"])
        )
        conn.commit()
        return {"ok": True}
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


# ─── Trip sharing ──────────────────────────────────────────────
# Short URL-friendly token: 10 chars from base62 → ~8.4×10^17 combinations.
_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"  # no 0/O/1/I/l


def _gen_share_token() -> str:
    import secrets
    return "".join(secrets.choice(_TOKEN_ALPHABET) for _ in range(10))


@app.post("/api/share/create")
async def share_create(data: ShareCreateReq, user=Depends(current_user)):
    """Create a public read-only snapshot of a trip and return its share token.

    Two modes:
      • conv_id provided  → load the saved conversation from DB
      • messages provided → use the inline snapshot (for unsaved trips)
    """
    conn = get_db()
    try:
        title = (data.title or "").strip()
        dest = data.dest or "bali"
        messages = data.messages or []
        trip_meta = data.trip_meta or {}
        owner_name = ""

        # Pull owner name for display on the shared page
        u_row = conn.execute(
            "SELECT name FROM users WHERE id=?", (user["sub"],)
        ).fetchone()
        if u_row:
            owner_name = dict(u_row).get("name", "") or ""

        # If conv_id given, use the latest saved version as the source of truth
        if data.conv_id:
            row = conn.execute(
                "SELECT title, dest, messages FROM conversations WHERE id=? AND user_id=?",
                (data.conv_id, user["sub"]),
            ).fetchone()
            if not row:
                raise HTTPException(404, "Conversation not found")
            r = dict(row)
            title = title or (r.get("title") or "")
            dest = r.get("dest") or dest
            messages = json.loads(r.get("messages") or "[]")

        if not messages:
            raise HTTPException(400, "Nothing to share — start a conversation first")

        # Generate a fresh, collision-resistant token
        token = _gen_share_token()
        for _ in range(3):
            exists = conn.execute(
                "SELECT token FROM shared_trips WHERE token=?", (token,)
            ).fetchone()
            if not exists:
                break
            token = _gen_share_token()

        snapshot = json.dumps({
            "messages": messages,
            "trip_meta": trip_meta,
            "owner_name": owner_name,
        }, ensure_ascii=False)

        conn.execute(
            "INSERT INTO shared_trips (token,user_id,conv_id,dest,title,snapshot,created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (token, user["sub"], data.conv_id, dest, title, snapshot, int(time.time())),
        )
        conn.commit()
        return {"token": token, "url": f"/shared?t={token}"}
    finally:
        conn.close()


@app.get("/api/share/{token}")
async def share_get(token: str):
    """Public read-only fetch of a shared trip. No auth required."""
    if not re.fullmatch(r"[A-Za-z0-9]{6,16}", token):
        raise HTTPException(400, "Invalid token")
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT token,dest,title,snapshot,views,created_at FROM shared_trips WHERE token=?",
            (token,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Shared trip not found or has been removed")
        d = dict(row)
        snap = json.loads(d["snapshot"] or "{}")
        # Increment view counter (fire-and-forget; ignore concurrent races)
        try:
            conn.execute(
                "UPDATE shared_trips SET views = COALESCE(views,0) + 1 WHERE token=?",
                (token,),
            )
            conn.commit()
        except Exception:
            pass
        return {
            "token": d["token"],
            "dest": d["dest"],
            "title": d["title"],
            "messages": snap.get("messages", []),
            "trip_meta": snap.get("trip_meta", {}),
            "owner_name": snap.get("owner_name", ""),
            "views": (d["views"] or 0) + 1,
            "created_at": d["created_at"],
        }
    finally:
        conn.close()


@app.delete("/api/share/{token}")
async def share_delete(token: str, user=Depends(current_user)):
    """Revoke a share link. Owner only."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT user_id FROM shared_trips WHERE token=?", (token,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        if dict(row)["user_id"] != user["sub"]:
            raise HTTPException(403, "Not the owner")
        conn.execute("DELETE FROM shared_trips WHERE token=?", (token,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ─── Trip fusion (D — dual-user preference merge) ─────────────
# Guest of a shared trip adds their own prefs → AI re-plans for both.
# No auth required: it's a public "join the planning" feature.

_FUSION_PROMPT_TPL = {
    "zh": (
        "你是 WanderMind 的资深旅程规划师。下面是「{owner}」的完整旅行规划对话。"
        "现在朋友「{guest}」加入了，提供了自己的偏好。"
        "请基于两人**共同**的需求，输出一份**融合方案**。\n\n"
        "格式严格如下（必须用 Markdown）：\n"
        "**🤝 双人偏好融合**\n"
        "- 简短一句话总结你的判断\n\n"
        "**✅ 保留的部分**\n"
        "- 列 2–4 条原方案中两人都会喜欢的安排\n\n"
        "**🔄 需要调整的部分**\n"
        "- 列 3–6 条具体调整建议（写明改了什么 + 为什么）\n\n"
        "**✨ 新增建议**\n"
        "- 2–3 条专门照顾「{guest}」偏好的新点子\n\n"
        "**💬 给两位的话**\n"
        "- 1–2 句温暖、人性化的总结\n\n"
        "「{guest}」的偏好如下：\n{prefs}\n\n"
        "请直接输出 Markdown，不要任何额外解释。"
    ),
    "en": (
        "You are WanderMind's senior travel planner. Below is the full planning conversation by '{owner}'. "
        "Now their travel companion '{guest}' has joined with their own preferences. "
        "Output a **fusion plan** based on both parties' needs.\n\n"
        "Format strictly as Markdown:\n"
        "**🤝 Two-person preference fusion**\n"
        "- One-sentence judgement\n\n"
        "**✅ What to keep**\n"
        "- 2–4 things from the original plan both will love\n\n"
        "**🔄 What to adjust**\n"
        "- 3–6 specific changes (what + why)\n\n"
        "**✨ New ideas**\n"
        "- 2–3 fresh ideas tailored to '{guest}'\n\n"
        "**💬 A note for both**\n"
        "- 1–2 warm closing sentences\n\n"
        "'{guest}' preferences:\n{prefs}\n\n"
        "Output Markdown only."
    ),
}


def _format_prefs(prefs: dict, lang: str) -> str:
    """Render the guest_prefs dict as human-readable bullets."""
    label_map_zh = {
        "budget": "预算偏好", "pace": "节奏", "style": "风格", "food": "饮食",
        "activities": "活动偏好", "must_have": "必须包含", "avoid": "想避免的",
        "special_needs": "特殊需求", "free_text": "自由备注",
    }
    label_map_en = {
        "budget": "Budget", "pace": "Pace", "style": "Style", "food": "Food",
        "activities": "Activities", "must_have": "Must have", "avoid": "Avoid",
        "special_needs": "Special needs", "free_text": "Free notes",
    }
    labels = label_map_zh if lang.startswith("zh") else label_map_en
    lines = []
    for k, v in prefs.items():
        if not v:
            continue
        if isinstance(v, list):
            v = ", ".join(str(x) for x in v)
        lines.append(f"- {labels.get(k, k)}: {v}")
    return "\n".join(lines) if lines else "(none)"


@app.post("/api/share/{token}/fuse")
async def share_fuse(token: str, data: FuseReq):
    """Guest of a shared trip submits their preferences; AI returns a
    merged plan that respects both parties. Public — no auth required."""
    if not re.fullmatch(r"[A-Za-z0-9]{6,16}", token):
        raise HTTPException(400, "Invalid token")
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT snapshot, title, dest FROM shared_trips WHERE token=?", (token,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Shared trip not found")
        r = dict(row)
        snap = json.loads(r.get("snapshot") or "{}")
        owner_name = snap.get("owner_name", "") or "the planner"
        guest_name = (data.guest_name or "").strip() or "Friend"

        # Build the prompt
        lang = (data.lang or "zh").lower()
        prompt_tpl = _FUSION_PROMPT_TPL.get("zh" if lang.startswith("zh") else "en")
        prefs_text = _format_prefs(data.guest_prefs or {}, lang)

        # Compose: original conversation + fusion instruction
        msgs = snap.get("messages") or []
        # Trim history to keep prompt sane — last 30 messages is plenty
        msgs = msgs[-30:]

        ai_messages = [{"role": "system", "content": "You are WanderMind, a multi-agent travel planner."}]
        for m in msgs:
            role = "assistant" if m.get("role") == "assistant" else "user"
            content = (m.get("content") or m.get("text") or "").strip()
            if content:
                ai_messages.append({"role": role, "content": content})
        ai_messages.append({
            "role": "user",
            "content": prompt_tpl.format(owner=owner_name, guest=guest_name, prefs=prefs_text),
        })

        if not _API_KEY:
            raise HTTPException(500, "AI API_KEY not configured on the server")

        # Call MiMo (pro mode — fusion needs deeper reasoning)
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    _CHAT_URL,
                    headers=_ai_headers(),
                    json={
                        "model": _MODEL,
                        "max_tokens": 1500,
                        "temperature": 0.75,
                        "messages": ai_messages,
                    },
                )
            if resp.status_code != 200:
                raise HTTPException(502, f"Upstream AI error: HTTP {resp.status_code}")
            ai_text = (
                resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"AI call failed: {type(e).__name__}: {e}")

        if not ai_text:
            raise HTTPException(502, "AI returned empty response")

        # Persist the fusion record
        fusion_token = _gen_share_token()
        for _ in range(3):
            exists = conn.execute(
                "SELECT token FROM trip_fusions WHERE token=?", (fusion_token,)
            ).fetchone()
            if not exists:
                break
            fusion_token = _gen_share_token()

        conn.execute(
            "INSERT INTO trip_fusions (token,source_token,guest_name,guest_prefs,ai_response,created_at) "
            "VALUES (?,?,?,?,?,?)",
            (fusion_token, token, guest_name,
             json.dumps(data.guest_prefs or {}, ensure_ascii=False),
             ai_text, int(time.time())),
        )
        conn.commit()
        return {
            "token": fusion_token,
            "url": f"/fusion?t={fusion_token}",
            "ai_response": ai_text,
            "source_title": r.get("title", ""),
            "owner_name": owner_name,
            "guest_name": guest_name,
        }
    finally:
        conn.close()


@app.get("/api/fusion/{token}")
async def fusion_get(token: str):
    """Public read of a fusion result. Returns guest info, AI response,
    and the source trip's title/owner so the page can render context."""
    if not re.fullmatch(r"[A-Za-z0-9]{6,16}", token):
        raise HTTPException(400, "Invalid token")
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT token,source_token,guest_name,guest_prefs,ai_response,views,created_at "
            "FROM trip_fusions WHERE token=?", (token,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Fusion not found")
        f = dict(row)

        # Fetch source trip metadata for display
        src = conn.execute(
            "SELECT title,dest,snapshot FROM shared_trips WHERE token=?", (f["source_token"],)
        ).fetchone()
        src_data = {}
        if src:
            s = dict(src)
            snap = json.loads(s.get("snapshot") or "{}")
            src_data = {
                "title": s.get("title"),
                "dest": s.get("dest"),
                "owner_name": snap.get("owner_name", ""),
                "trip_meta": snap.get("trip_meta", {}),
            }

        # Bump view counter
        try:
            conn.execute(
                "UPDATE trip_fusions SET views = COALESCE(views,0) + 1 WHERE token=?",
                (token,),
            )
            conn.commit()
        except Exception:
            pass

        return {
            "token": f["token"],
            "guest_name": f["guest_name"],
            "guest_prefs": json.loads(f.get("guest_prefs") or "{}"),
            "ai_response": f["ai_response"],
            "views": (f["views"] or 0) + 1,
            "created_at": f["created_at"],
            "source": src_data,
            "source_token": f["source_token"],
        }
    finally:
        conn.close()


# ─── Find a Driver → email the request to the driver ──────────
# Privacy by design: we do NOT persist any of the traveller's contact
# details. The request is relayed once by email and never stored in the DB.
@app.post("/api/driver-request")
async def driver_request(data: DriverReq):
    # Require at least one contact method so the driver can respond
    if not (data.contact_whatsapp.strip() or data.contact_email.strip() or data.contact_phone.strip()):
        raise HTTPException(400, "Please provide at least one contact method")
    if not (data.first_name.strip() or data.last_name.strip()):
        raise HTTPException(400, "Please provide your name")
    payload = {
        "first_name": data.first_name.strip(),
        "last_name": data.last_name.strip(),
        "intro": data.intro.strip(),
        "contact_whatsapp": data.contact_whatsapp.strip(),
        "contact_email": data.contact_email.strip(),
        "contact_phone": data.contact_phone.strip(),
        "num_people": data.num_people,
        "num_days": data.num_days,
        "attractions": data.attractions.strip(),
    }
    result = await send_driver_request(payload)
    # In dev mode (no RESEND_API_KEY) result.ok is False but we still return
    # success so the UX flow is testable; the request was logged to stdout.
    return {
        "ok": True,
        "delivered": bool(result.get("ok")),
        "note": None if result.get("ok") else "Email service in dev mode — request logged but not delivered.",
    }


# ─── Dynamic destination info (AI-generated panel data) ──────
_DEST_INFO_CACHE: dict = {}          # (dest_lower, lang) -> (ts, data)
_DEST_INFO_TTL = 24 * 3600           # regions/tips/season barely change day-to-day


def _extract_json(text: str):
    """Pull a JSON object out of an LLM reply that may be fenced, wrapped in
    prose, or TRUNCATED (the slow model often hits max_tokens mid-object).
    Returns the parsed dict, or None if nothing salvageable is found."""
    if not text:
        return None
    t = text.strip()
    if t.startswith("```"):                       # strip ```json … ``` fences
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```\s*$", "", t).strip()
    start = t.find("{")
    if start == -1:
        return None
    t = t[start:]
    # Fast path: already valid
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    # Walk once: track nesting/string state, and remember where the outermost
    # object last closed cleanly (so trailing prose after valid JSON is trimmed).
    depth_stack = []
    in_str = False
    esc = False
    last_complete = None
    for i, ch in enumerate(t):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            depth_stack.append(ch)
        elif ch in "}]":
            if depth_stack:
                depth_stack.pop()
                if not depth_stack:
                    last_complete = i + 1
    # Clean object found (with junk after it) — trim and parse
    if last_complete:
        try:
            return json.loads(t[:last_complete])
        except json.JSONDecodeError:
            pass
    # Truncated: close the open string (if any) and the unbalanced brackets.
    frag = t
    if in_str:
        frag += '"'                       # close a value cut off mid-string
    frag = frag.rstrip().rstrip(",")
    # Drop a dangling key with no value (e.g. …,"regions":  or …,"name")
    frag = re.sub(r',\s*"[^"]*"\s*:?\s*$', '', frag).rstrip().rstrip(",")
    for opener in reversed(depth_stack):
        frag += "}" if opener == "{" else "]"
    try:
        return json.loads(frag)
    except json.JSONDecodeError:
        return None


@app.post("/api/dest_info")
async def get_dest_info(req: DestInfoReq, user=Depends(optional_user)):
    """AI生成任意目的地的面板数据：天气/区域/贴士。快模型 + 24h 缓存。"""
    if not _API_KEY and not _FAST_KEY:
        raise HTTPException(500, "API_KEY not set")

    # Serve from cache when fresh — makes repeat/preset destinations instant
    dest_key = (req.destination or "").strip().lower()
    cache_key = (dest_key, req.lang or "zh")
    now = time.time()
    cached = _DEST_INFO_CACHE.get(cache_key)
    if cached and now - cached[0] < _DEST_INFO_TTL:
        return cached[1]

    lang_map = {"zh": "中文", "en": "English", "ja": "日本語", "ko": "한국어", "id": "Bahasa Indonesia"}
    lang_name = lang_map.get(req.lang, "中文")

    prompt = f"""为目的地「{req.destination}」生成旅行面板数据，所有文字用{lang_name}。
只输出一个JSON对象，不要解释、不要markdown。结构：
{{
  "timezone": "IANA时区，如 Asia/Tashkent",
  "weather": {{"temp": "如 22-30°C", "cond": "天气(8字内)", "details": "气候提示(15字内)"}},
  "rate": "汇率，如 1 CNY ≈ 105 UZS",
  "season": "最佳月份，如 4-6月",
  "seasonDesc": "季节说明(12字内)",
  "regions": [
    {{"name": "知名景区名", "tag": "特色(4字)", "desc": "简介(25字内)"}},
    {{"name": "景区2", "tag": "特色", "desc": "简介"}},
    {{"name": "景区3", "tag": "特色", "desc": "简介"}}
  ],
  "tips": [
    {{"title": "标题(6字内)", "tag": "签证", "desc": "建议(25字内)"}},
    {{"title": "标题", "tag": "货币", "desc": "建议"}}
  ],
  "hotelAreas": [
    {{"name": "住宿区中文名", "q": "对应英文名(酒店搜索用)"}},
    {{"name": "住宿区2", "q": "英文名"}},
    {{"name": "住宿区3", "q": "英文名"}}
  ]
}}
要求：regions恰好3条、tips恰好2条、hotelAreas恰好3条真实街区。字段名严格一致，值简短，不重复用字。"""

    # Fast lane (SiliconFlow Qwen2.5-7B). IMPORTANT: SiliconFlow's free tier hangs
    # on NON-streaming completions (40s+ → timeout), but streams fine — so we stream
    # the reply and reassemble it server-side. Falls back to pro if no fast key.
    url, headers, model, _label = _route("fast")
    try:
        parts: list[str] = []
        async with httpx.AsyncClient(timeout=90.0) as client:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json={
                    "model": model,
                    "max_tokens": 1100,
                    "temperature": 0.3,
                    "frequency_penalty": 0.6,   # stop the 7B model degenerating into "和和和和"
                    "response_format": {"type": "json_object"},
                    "stream": True,
                    "messages": [
                        {"role": "system", "content": "你只输出严格合法的JSON对象，字段名与要求完全一致。"},
                        {"role": "user", "content": prompt},
                    ],
                },
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise HTTPException(resp.status_code, body.decode(errors="replace")[:200])
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        ev = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    choices = ev.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {}) or {}
                    piece = delta.get("content") or delta.get("reasoning_content") or ""
                    if piece:
                        parts.append(piece)
        joined = "".join(parts)
        data = _extract_json(joined)
        if data is None:
            snippet = (joined[:300] if joined else "<empty>")
            raise HTTPException(500, f"AI did not return valid JSON | chars={len(joined)} | head={snippet!r}")
        # Assign card colours server-side (we dropped cls from the prompt to lighten
        # the small model's load) so regions/tips render with varied tags.
        _cls_cycle = ["tag-blue", "tag-amber", "tag-green", "tag-red"]
        for i, r in enumerate(data.get("regions") or []):
            if isinstance(r, dict):
                r.setdefault("cls", _cls_cycle[i % len(_cls_cycle)])
        for i, tp in enumerate(data.get("tips") or []):
            if isinstance(tp, dict):
                tp.setdefault("cls", _cls_cycle[i % len(_cls_cycle)])
        _DEST_INFO_CACHE[cache_key] = (now, data)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── SerpAPI ─────────────────────────────────────────────────
_SERPAPI_KEY         = os.getenv("SERPAPI_KEY", "")
_SERPAPI_FLIGHTS_KEY = os.getenv("SERPAPI_FLIGHTS_KEY", "") or _SERPAPI_KEY
_SERPAPI_URL         = "https://serpapi.com/search.json"

# IATA cache so we don't re-call MiMo for the same city
_IATA_CACHE: dict = {
    # Preset Chinese departure cities
    "上海": "PVG", "北京": "PEK", "广州": "CAN", "深圳": "SZX",
    "成都": "CTU", "香港": "HKG", "杭州": "HGH", "重庆": "CKG",
    "西安": "XIY", "昆明": "KMG", "厦门": "XMN", "南京": "NKG",
    # Common destinations
    "巴厘岛": "DPS", "Bali": "DPS",
    "京都": "KIX", "Kyoto": "KIX",
    "巴黎": "CDG", "Paris": "CDG",
    "圣托里尼": "JTR", "Santorini": "JTR",
    "东京": "HND", "Tokyo": "HND",
    "首尔": "ICN", "Seoul": "ICN",
    "曼谷": "BKK", "Bangkok": "BKK",
    "纽约": "JFK", "New York": "JFK",
    "伦敦": "LHR", "London": "LHR",
    "新加坡": "SIN", "Singapore": "SIN",
}


async def resolve_iata(text: str) -> str:
    """Convert any city name or airport code to a 3-letter IATA code."""
    if not text:
        return ""
    t = text.strip()
    # Already a 3-letter IATA code?
    if re.fullmatch(r"[A-Za-z]{3}", t):
        return t.upper()
    # Cache hit
    if t in _IATA_CACHE:
        return _IATA_CACHE[t]
    # Ask MiMo to convert
    if not _API_KEY:
        return ""
    prompt = (
        f"Convert the city or airport name '{t}' to its main IATA airport code. "
        "Reply with ONLY the 3-letter IATA code in uppercase, nothing else. "
        "No explanation, no punctuation. If you are not sure, return UNK."
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                _CHAT_URL,
                headers=_ai_headers(),
                json={
                    "model": _MODEL,
                    "max_tokens": 12,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        if resp.status_code != 200:
            return ""
        out = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip().upper()
        match = re.search(r"[A-Z]{3}", out)
        if match:
            code = match.group()
            if code != "UNK":
                _IATA_CACHE[t] = code
                return code
    except Exception:
        pass
    return ""


@app.post("/api/search/flights")
async def search_flights(req: FlightSearchReq, user=Depends(optional_user)):
    """SerpAPI Google Flights 实时航班价格搜索。"""
    if not _SERPAPI_FLIGHTS_KEY:
        raise HTTPException(500, "SERPAPI_FLIGHTS_KEY not configured")

    origin_iata = await resolve_iata(req.origin)
    dest_iata   = await resolve_iata(req.destination)
    if not origin_iata:
        raise HTTPException(400, f"无法识别出发城市 '{req.origin}'，请用 IATA 代码（如 PVG）")
    if not dest_iata:
        raise HTTPException(400, f"无法识别目的地 '{req.destination}'，请用 IATA 代码（如 DPS）")

    hl_map = {"zh": "zh-CN", "en": "en", "ja": "ja", "ko": "ko", "id": "id"}
    gl_map = {"zh": "cn",    "en": "us", "ja": "jp", "ko": "kr", "id": "id"}

    params = {
        "engine":         "google_flights",
        "departure_id":   origin_iata,
        "arrival_id":     dest_iata,
        "outbound_date":  req.depart_date,
        "type":           "1" if req.return_date else "2",   # 1=round, 2=one-way
        "adults":         str(max(1, min(req.adults, 8))),
        "api_key":        _SERPAPI_FLIGHTS_KEY,
        "hl":             hl_map.get(req.lang, "zh-CN"),
        "gl":             gl_map.get(req.lang, "cn"),
        "currency":       "CNY",
    }
    if req.return_date:
        params["return_date"] = req.return_date

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.get(_SERPAPI_URL, params=params)
        if resp.status_code == 401:
            raise HTTPException(401, "Invalid SERPAPI_FLIGHTS_KEY")
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"SerpAPI error: {resp.text[:200]}")

        data = resp.json()
        if "error" in data:
            raise HTTPException(400, data["error"])

        # Combine best + other, take top 8
        raw = (data.get("best_flights") or []) + (data.get("other_flights") or [])
        flights = []
        for item in raw[:8]:
            legs = item.get("flights") or []
            if not legs:
                continue
            first  = legs[0]
            last   = legs[-1]
            layovers = item.get("layovers") or []
            stops_count = len(layovers)
            total_min = item.get("total_duration") or sum(l.get("duration", 0) for l in legs)
            flights.append({
                "price":       item.get("price", ""),
                "airline":     first.get("airline", ""),
                "airline_logo": first.get("airline_logo", "") or item.get("airline_logo", ""),
                "flight_no":   first.get("flight_number", ""),
                "depart_time": (first.get("departure_airport") or {}).get("time", ""),
                "depart_id":   (first.get("departure_airport") or {}).get("id", ""),
                "arrive_time": (last.get("arrival_airport") or {}).get("time", ""),
                "arrive_id":   (last.get("arrival_airport") or {}).get("id", ""),
                "duration_min": total_min,
                "stops":        stops_count,
                "layover_codes": [(l.get("id") or "") for l in layovers if l.get("id")],
                "travel_class": first.get("travel_class", ""),
            })

        # Build Google Flights link for booking
        booking_url = (
            f"https://www.google.com/travel/flights?hl={hl_map.get(req.lang,'zh-CN')}"
            f"&q=Flights+from+{origin_iata}+to+{dest_iata}+on+{req.depart_date}"
            + (f"+returning+{req.return_date}" if req.return_date else "")
        )

        return {
            "flights":     flights,
            "origin":      origin_iata,
            "destination": dest_iata,
            "booking_url": booking_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/search/hotels")
async def search_hotels(req: HotelSearchReq, user=Depends(optional_user)):
    """SerpAPI Google Hotels 实时价格搜索。"""
    if not _SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not configured")

    hl_map = {"zh": "zh-CN", "en": "en", "ja": "ja", "ko": "ko", "id": "id"}
    gl_map = {"zh": "cn",    "en": "us", "ja": "jp", "ko": "kr", "id": "id"}

    params = {
        "engine":         "google_hotels",
        "q":              f"hotels in {req.destination}",
        "check_in_date":  req.check_in,
        "check_out_date": req.check_out,
        "adults":         str(max(1, min(req.adults, 8))),
        "api_key":        _SERPAPI_KEY,
        "hl":             hl_map.get(req.lang, "zh-CN"),
        "gl":             gl_map.get(req.lang, "cn"),
        "currency":       "CNY",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(_SERPAPI_URL, params=params)
        if resp.status_code == 401:
            raise HTTPException(401, "Invalid SERPAPI_KEY")
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"SerpAPI error: {resp.text[:200]}")

        data = resp.json()
        # SerpAPI may return an error field even on 200
        if "error" in data:
            raise HTTPException(400, data["error"])

        properties = data.get("properties", [])[:6]   # top 6
        hotels = []
        for p in properties:
            rate = p.get("rate_per_night") or {}
            hotels.append({
                "name":        p.get("name", ""),
                "price":       rate.get("lowest", ""),
                "rating":      p.get("overall_rating", 0),
                "reviews":     p.get("reviews", 0),
                "link":        p.get("link", ""),
                "thumbnail":   p.get("thumbnail", ""),
                "description": (p.get("description") or "")[:80],
                "amenities":   (p.get("amenities") or [])[:4],
            })
        return {"hotels": hotels, "destination": req.destination}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── AI config (OpenAI-compatible — MiMo / any proxy) ────────
_API_KEY  = os.getenv("API_KEY", "")
_MODEL    = os.getenv("MODEL", "mimo-v2.5-pro")
_CHAT_URL = os.getenv("CHAT_URL", "https://api.xiaomimimo.com/v1/chat/completions")

# ⚡ Fast lane: SiliconFlow free-tier (Qwen2.5-7B-Instruct by default)
_FAST_KEY   = os.getenv("SILICONFLOW_KEY", "")
_FAST_MODEL = os.getenv("SILICONFLOW_MODEL", "Qwen/Qwen2.5-7B-Instruct")
_FAST_URL   = os.getenv("SILICONFLOW_URL", "https://api.siliconflow.cn/v1/chat/completions")


def _ai_headers() -> dict:
    return {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
    }


def _fast_headers() -> dict:
    return {
        "Authorization": f"Bearer {_FAST_KEY}",
        "Content-Type": "application/json",
    }


def _route(mode: str) -> tuple:
    """Return (url, headers, model, label) for the requested mode.
    Falls back to MiMo if mode=fast but SiliconFlow key is missing."""
    if mode == "fast" and _FAST_KEY:
        return _FAST_URL, _fast_headers(), _FAST_MODEL, "fast"
    return _CHAT_URL, _ai_headers(), _MODEL, "pro"


# ─── Real-time weather (OpenWeatherMap) ───────────────────────
# To activate live weather, set OPENWEATHER_API_KEY in Render env vars.
# Get a free key (1000 calls/day) at https://openweathermap.org/api
_OPENWEATHER_KEY = os.getenv("OPENWEATHER_API_KEY", "")
_OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

# Hand-curated city -> canonical name for OpenWeather lookups
_WEATHER_CITY_ALIAS = {
    "bali":       "Denpasar,ID",
    "kyoto":      "Kyoto,JP",
    "paris":      "Paris,FR",
    "santorini":  "Thira,GR",
    "巴厘岛":     "Denpasar,ID",
    "京都":       "Kyoto,JP",
    "巴黎":       "Paris,FR",
    "圣托里尼":   "Thira,GR",
}


@app.get("/api/weather")
async def get_weather(city: str, lang: str = "en"):
    """Live weather for a destination. Gracefully returns 503 with hint
    if OPENWEATHER_API_KEY is not configured, so the frontend can fall
    back to the AI-generated dest_info data."""
    if not _OPENWEATHER_KEY:
        raise HTTPException(503, "OPENWEATHER_API_KEY not set — set it in Render env to enable live weather")

    # Resolve to a canonical name OpenWeather understands
    key = city.strip().lower()
    q = _WEATHER_CITY_ALIAS.get(key) or _WEATHER_CITY_ALIAS.get(city.strip()) or city.strip()

    # OpenWeather lang code mapping
    ow_lang = {"zh": "zh_cn", "en": "en", "ja": "ja", "ko": "kr", "id": "id"}.get(lang, "en")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                _OPENWEATHER_URL,
                params={
                    "q": q,
                    "appid": _OPENWEATHER_KEY,
                    "units": "metric",
                    "lang": ow_lang,
                },
            )
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"OpenWeather error: {resp.text[:200]}")
        d = resp.json()

        # Map OpenWeather icon code to a Font Awesome 4.7 icon class
        icon_code = (d.get("weather") or [{}])[0].get("icon", "01d")
        fa_icon = {
            "01d": "fa-sun-o",   "01n": "fa-moon-o",
            "02d": "fa-cloud",   "02n": "fa-cloud",
            "03d": "fa-cloud",   "03n": "fa-cloud",
            "04d": "fa-cloud",   "04n": "fa-cloud",
            "09d": "fa-tint",    "09n": "fa-tint",
            "10d": "fa-umbrella","10n": "fa-umbrella",
            "11d": "fa-bolt",    "11n": "fa-bolt",
            "13d": "fa-snowflake-o", "13n": "fa-snowflake-o",
            "50d": "fa-align-justify","50n": "fa-align-justify",
        }.get(icon_code, "fa-sun-o")

        main = d.get("main", {})
        wind = d.get("wind", {})
        sys  = d.get("sys", {})
        weather_desc = (d.get("weather") or [{}])[0].get("description", "")

        # Format sunrise time in city's local timezone
        tz_offset = d.get("timezone", 0)  # seconds offset from UTC
        sunrise_ts = sys.get("sunrise", 0)
        sunset_ts  = sys.get("sunset", 0)
        def _fmt_hm(ts):
            if not ts: return ""
            local = ts + tz_offset
            h = (local // 3600) % 24
            m = (local % 3600) // 60
            return f"{h:02d}:{m:02d}"
        sunrise = _fmt_hm(sunrise_ts)
        sunset  = _fmt_hm(sunset_ts)

        # Localised "feels like" + details label
        details_tpl = {
            "zh": f"湿度 {main.get('humidity', '?')}% · 风速 {wind.get('speed', '?')}m/s · 日出 {sunrise}",
            "en": f"Humidity {main.get('humidity', '?')}% · Wind {wind.get('speed', '?')}m/s · Sunrise {sunrise}",
            "ja": f"湿度 {main.get('humidity', '?')}% · 風速 {wind.get('speed', '?')}m/s · 日の出 {sunrise}",
            "ko": f"습도 {main.get('humidity', '?')}% · 풍속 {wind.get('speed', '?')}m/s · 일출 {sunrise}",
            "id": f"Kelembaban {main.get('humidity', '?')}% · Angin {wind.get('speed', '?')}m/s · Matahari terbit {sunrise}",
        }
        details = details_tpl.get(lang, details_tpl["en"])

        return {
            "temp":     f"{round(main.get('temp', 0))}°C",
            "feels":    f"{round(main.get('feels_like', 0))}°C",
            "cond":     weather_desc.capitalize() if weather_desc else "",
            "icon":     fa_icon,
            "icon_code": icon_code,
            "details":  details,
            "humidity": main.get("humidity"),
            "wind":     wind.get("speed"),
            "sunrise":  sunrise,
            "sunset":   sunset,
            "city":     d.get("name", ""),
            "country":  sys.get("country", ""),
            "updated_at": int(time.time()),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Weather fetch failed: {e}")


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
async def chat(req: ChatReq, user=Depends(optional_user), anon_id=Depends(anon_id_header)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")
    consume_quota(user, anon_id)  # raises 402 when free uses + beans exhausted

    raw_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    chat_url, chat_headers, chat_model, mode_label = _route(req.mode)

    async def stream():
        search_context = ""
        search_results: list = []
        searched = False

        # ── Announce which model lane we're using ─────────────
        yield f"data: {json.dumps({'type':'mode','mode':mode_label,'model':chat_model})}\n\n"

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
        # Fast lane uses fewer tokens for snappier output
        max_tok = 1200 if mode_label == "fast" else 2000
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    chat_url,
                    headers=chat_headers,
                    json={
                        "model": chat_model,
                        "max_tokens": max_tok,
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


# ─── Non-streaming chat (for WeChat Mini Program) ────────────
# Mini Program's wx.request does NOT support SSE streaming. This endpoint
# returns the full reply as a single JSON object so the mini program can
# render it after the await.
@app.post("/api/chat/once")
async def chat_once(req: ChatReq, user=Depends(optional_user), anon_id=Depends(anon_id_header)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")
    consume_quota(user, anon_id)

    raw_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    chat_url, chat_headers, chat_model, mode_label = _route(req.mode)

    # ── Optional web search ──
    search_context = ""
    search_results: list = []
    searched = False
    if req.search and _should_search(raw_messages):
        last_q = next((m["content"] for m in reversed(raw_messages) if m["role"] == "user"), req.destination)
        search_context, search_results = await tavily_search(last_q, req.destination)
        if search_context:
            searched = True

    system = req.system
    if search_context:
        today = time.strftime("%Y-%m-%d")
        system += (
            f"\n\n【🌐 实时联网搜索结果 · {today}】\n"
            f"{search_context}\n\n"
            "请在回答中整合以上最新搜索信息，让用户感受到信息的时效性。"
        )

    messages = [{"role": "system", "content": system}] + raw_messages
    max_tok = 1200 if mode_label == "fast" else 2000

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                chat_url,
                headers=chat_headers,
                json={"model": chat_model, "max_tokens": max_tok, "messages": messages},
            )
        if resp.status_code != 200:
            body = resp.text[:300]
            raise HTTPException(resp.status_code, body)
        data = resp.json()
        text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
        return {
            "text":          text,
            "mode":          mode_label,
            "model":         chat_model,
            "searched":      searched,
            "search_count":  len(search_results),
            "search_results": search_results,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── Team mode: 3 agents in parallel, merged output ──────────
@app.post("/api/chat/team")
async def chat_team(req: ChatReq, user=Depends(optional_user), anon_id=Depends(anon_id_header)):
    """真并行多 Agent：规划师 + 活动策划师 + 预算管家同时回答，合并输出。"""
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")
    consume_quota(user, anon_id)

    TEAM_ROLES = [
        {
            "id": "planner",
            "icon": "🗺️",
            "name": "旅程规划师",
            "suffix": "\n\n【你的角色】旅程规划师：专注整体行程安排、路线优化和时间节奏。给出具体实用的行程建议，简洁有力，控制在300字内。",
        },
        {
            "id": "activity",
            "icon": "🏄",
            "name": "活动策划师",
            "suffix": "\n\n【你的角色】活动策划师：专注独特体验、本地文化和隐藏亮点，推荐普通游客不一定知道的精彩活动。简洁有力，控制在300字内。",
        },
        {
            "id": "budget",
            "icon": "💰",
            "name": "预算管家",
            "suffix": "\n\n【你的角色】预算管家：专注费用估算、省钱技巧和性价比建议，给出具体价格区间和预算分配。简洁有力，控制在300字内。",
        },
    ]

    raw_messages = [{"role": m.role, "content": m.content} for m in req.messages]

    async def call_agent(role: dict) -> tuple:
        system = req.system + role["suffix"]
        messages = [{"role": "system", "content": system}] + raw_messages
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    _CHAT_URL,
                    headers=_ai_headers(),
                    json={
                        "model": _MODEL,
                        "max_tokens": 800,
                        "stream": False,
                        "messages": messages,
                    },
                )
            if resp.status_code != 200:
                return role, ""
            data = resp.json()
            choices = data.get("choices") or []
            text = choices[0].get("message", {}).get("content", "") if choices else ""
            return role, text.strip()
        except Exception:
            return role, ""

    async def stream():
        yield f"data: {json.dumps({'type': 'team_start', 'agents': [r['id'] for r in TEAM_ROLES]})}\n\n"

        # ── Parallel execution ────────────────────────────────
        results = await asyncio.gather(*[call_agent(r) for r in TEAM_ROLES])

        # ── Build merged markdown ─────────────────────────────
        parts = []
        for role, text in results:
            if text:
                parts.append(f"**{role['icon']} {role['name']}**\n\n{text}")

        merged = "\n\n---\n\n".join(parts) if parts else "抱歉，专家团队暂时无法回应，请稍后再试。"

        yield f"data: {json.dumps({'type': 'team_result', 'text': merged})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'searched': False})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── One-shot generate (multiverse / budget AI) ──────────────
@app.post("/api/generate")
async def generate(req: GenerateReq, user=Depends(optional_user), anon_id=Depends(anon_id_header)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")
    consume_quota(user, anon_id)
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
// v3 — network-first for HTML to fix Safari stuck-on-old-version bug.
const CACHE = 'wandermind-v3';
// Don't pre-cache '/' — we want fresh HTML on every load.
const SHELL = ['/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  // Allow page to ask SW to skipWaiting immediately
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isHTMLRequest(req) {
  if (req.mode === 'navigate') return true;
  if (req.destination === 'document') return true;
  const url = new URL(req.url);
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return true;
  return false;
}

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Never touch API or SSE
  if (url.includes('/api/')) return;
  // sw.js itself — always fetch fresh
  if (url.endsWith('/sw.js')) return;

  if (isHTMLRequest(e.request)) {
    // ── Network-first for HTML (so users always see latest version) ──
    e.respondWith(
      fetch(e.request).then(res => {
        // Cache a fallback copy for offline use
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached => cached || caches.match('/'))
      )
    );
  } else {
    // ── Cache-first for static assets (manifest, icons, etc.) ──
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }))
    );
  }
});
"""
    return PlainTextResponse(
        sw,
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


# ─── Serve frontends ─────────────────────────────────────────
# H5 (existing single-file frontend) is served at /
_FRONTEND = Path(__file__).parent.parent / "frontend" / "index.html"


# ─── Health check (keep-alive ping target) ───────────────────────────────
# Lightweight — no DB, no AI. Hit this every few minutes from an uptime
# monitor (UptimeRobot etc.) to keep the free-tier instance from sleeping.
@app.api_route("/healthz", methods=["GET", "HEAD"])
async def healthz():
    return PlainTextResponse("ok")


@app.get("/api/_diag")
async def _diag():
    """Non-sensitive config check — booleans only, never the secret values.
    Lets us confirm which env vars actually loaded without exposing them."""
    return {
        "api_key_set": bool(_API_KEY),
        "fast_key_set": bool(_FAST_KEY),
        "fast_model": _FAST_MODEL,
        "fast_lane_active": bool(_FAST_KEY),   # dest_info/fast-chat use Qwen when true
        "openweather_set": bool(os.getenv("OPENWEATHER_API_KEY", "")),
        "resend_set": bool(os.getenv("RESEND_API_KEY", "")),
        "tavily_set": bool(_TAVILY_KEY),
    }


# ─── SEO: robots.txt + sitemap.xml ───────────────────────────────────────
_SITE_URL = os.getenv("PUBLIC_URL", "https://wandermind.cc").strip().rstrip("/")
_SITEMAP_PATHS = ["/", "/about", "/services", "/bali", "/ai-tool", "/find-driver", "/contact"]


@app.api_route("/robots.txt", methods=["GET", "HEAD"])
async def robots_txt():
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /app\n"
        f"Sitemap: {_SITE_URL}/sitemap.xml\n"
    )
    return PlainTextResponse(body)


@app.api_route("/sitemap.xml", methods=["GET", "HEAD"])
async def sitemap_xml():
    today = time.strftime("%Y-%m-%d")
    urls = "".join(
        f"<url><loc>{_SITE_URL}{p}</loc><lastmod>{today}</lastmod>"
        f"<changefreq>weekly</changefreq><priority>{'1.0' if p == '/' else '0.8'}</priority></url>"
        for p in _SITEMAP_PATHS
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{urls}</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


# ─── Legacy single-page AI app at /app (preserves old bookmarks) ──────────
@app.get("/app")
async def legacy_app():
    """Original WanderMind single-page AI app. Kept for backward-compat
    with users who bookmarked the root URL before Studio became the home."""
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


# ─── Clean URL middleware ─────────────────────────────────────────────────
# Lets visitors use /about, /ai-tool, /shared instead of forcing .html suffix.
# Internally rewrites the path so the StaticFiles handler still finds the file.
_STUDIO_DIR = Path(__file__).parent.parent.parent / "wandermind-studio" / "frontend"

_RESERVED_ROOTS = ("/api/", "/app", "/healthz", "/sitemap.xml", "/robots.txt",
                   "/manifest.json", "/icon.svg", "/sw.js",
                   "/docs", "/openapi.json", "/redoc", "/favicon.ico")


@app.middleware("http")
async def clean_html_urls(request: Request, call_next):
    path = request.url.path
    # Skip API / known one-shot routes / paths that already have an extension
    if any(path.startswith(p) for p in _RESERVED_ROOTS):
        return await call_next(request)
    last = path.rsplit("/", 1)[-1]
    if not last or "." in last:
        return await call_next(request)
    # Alias /fusion → /shared.html (same SPA file routes both views by JS)
    if path == "/fusion":
        request.scope["path"] = "/shared.html"
        request.scope["raw_path"] = b"/shared.html"
        return await call_next(request)
    # Try {path}.html relative to Studio root
    candidate = _STUDIO_DIR / (path.lstrip("/") + ".html")
    if candidate.is_file():
        # Rewrite scope so the downstream StaticFiles mount serves the .html file
        request.scope["path"] = path + ".html"
        request.scope["raw_path"] = (path + ".html").encode("utf-8")
    return await call_next(request)


# ─── Studio is now mounted at ROOT — the primary brand site ───────────────
# / → /index.html, /about.html, /ai-tool.html, /shared.html?t=... all served
# from wandermind-studio/frontend/. Clean URLs (/about, /ai-tool) handled by
# the middleware above. Old /api/* and /app keep working (registered earlier).
if _STUDIO_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(_STUDIO_DIR), html=True),
        name="studio",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

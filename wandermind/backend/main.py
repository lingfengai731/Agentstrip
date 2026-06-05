import asyncio
import base64
import hashlib
import re
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
from fastapi.staticfiles import StaticFiles
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
    # Migration: add preferences column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'")
        conn.commit()
    except Exception:
        pass  # column already exists
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


# ─── Dynamic destination info (AI-generated panel data) ──────
@app.post("/api/dest_info")
async def get_dest_info(req: DestInfoReq, user=Depends(optional_user)):
    """AI生成任意目的地的面板数据：天气/区域/贴士。"""
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")

    lang_map = {"zh": "中文", "en": "English", "ja": "日本語", "ko": "한국어", "id": "Bahasa Indonesia"}
    lang_name = lang_map.get(req.lang, "中文")

    # Optional: use Tavily for real-time weather context
    weather_ctx = ""
    if _TAVILY_KEY:
        w_ctx, _ = await tavily_search(f"{req.destination} current weather temperature today", req.destination)
        if w_ctx:
            weather_ctx = f"\n\n【实时天气参考数据】\n{w_ctx[:500]}"

    prompt = f"""你是旅行数据生成系统。请为目的地「{req.destination}」生成旅行面板数据。{weather_ctx}

严格按以下JSON格式返回，所有文字使用{lang_name}：
{{
  "timezone": "IANA时区字符串（如：Asia/Tokyo、Europe/Paris、America/New_York）",
  "weather": {{
    "temp": "当前典型气温（如：25-32°C）",
    "cond": "天气状况（10字内）",
    "icon": "最贴切的天气emoji（单个）",
    "details": "简短气候提示（20字内）"
  }},
  "rate": "汇率参考（如：1 CNY ≈ 2,200 IDR；若为人民币城市写"本地货币：人民币"）",
  "season": "最佳旅行月份（如：10-4月）",
  "seasonDesc": "最佳季节说明（15字内）",
  "regions": [
    {{"name": "知名区域或景区名", "cls": "tag-blue", "tag": "核心特色（4字）", "desc": "区域特色介绍（40字）", "q": "游客常问该区域的完整问句"}},
    {{"name": "...", "cls": "tag-amber", "tag": "...", "desc": "...", "q": "..."}},
    {{"name": "...", "cls": "tag-green",  "tag": "...", "desc": "...", "q": "..."}},
    {{"name": "...", "cls": "tag-red",   "tag": "...", "desc": "...", "q": "..."}}
  ],
  "tips": [
    {{"title": "贴士标题（6字内）", "cls": "tag-blue",  "tag": "类型（4字）", "desc": "具体实用建议（30字）"}},
    {{"title": "...",               "cls": "tag-amber", "tag": "...",         "desc": "..."}},
    {{"title": "...",               "cls": "tag-green", "tag": "...",         "desc": "..."}}
  ],
  "hotelAreas": [
    {{"name": "知名住宿区域中文名（如：水明漾、祇园、玛黑区）", "q": "对应英文/拉丁化名（如：Seminyak、Gion、Le Marais），用于酒店搜索关键词", "tag": "区域定位（4字内）"}},
    {{"name": "...", "q": "...", "tag": "..."}}
  ]
}}
要求：
- regions 固定4条，cls 依次从 tag-blue/tag-amber/tag-green/tag-red 中取
- tips 固定3条，覆盖 签证入境、货币消费、文化礼仪 等实用主题
- hotelAreas 固定6条，必须是该城市真实存在的知名住宿区域/街区（例如纽约的曼哈顿/布鲁克林、伦敦的Soho/Westminster），按热门度排列
- 仅返回纯JSON，不要 markdown 代码块，不要任何其他文字"""

    try:
        async with httpx.AsyncClient(timeout=40.0) as client:
            resp = await client.post(
                _CHAT_URL,
                headers=_ai_headers(),
                json={
                    "model": _MODEL,
                    "max_tokens": 1400,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        if resp.status_code != 200:
            body = await resp.aread()
            raise HTTPException(resp.status_code, body.decode(errors="replace")[:200])
        text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        # Robustly extract the first {...} JSON block
        match = re.search(r'\{[\s\S]*\}', text)
        if not match:
            raise HTTPException(500, "AI did not return valid JSON")
        return json.loads(match.group())
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"JSON parse error: {e}")
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
async def chat(req: ChatReq, user=Depends(optional_user)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")

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
async def chat_once(req: ChatReq, user=Depends(optional_user)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")

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
async def chat_team(req: ChatReq, user=Depends(optional_user)):
    """真并行多 Agent：规划师 + 活动策划师 + 预算管家同时回答，合并输出。"""
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")

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
async def generate(req: GenerateReq, user=Depends(optional_user)):
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


# WanderMind Studio (multi-file template-styled brand site) is mounted at /studio
# Visit https://<host>/studio/ for the home page, /studio/ai-tool.html for the tool, etc.
# Same backend, so all relative /api/* calls from Studio work out of the box.
_STUDIO_DIR = Path(__file__).parent.parent.parent / "wandermind-studio" / "frontend"
if _STUDIO_DIR.exists():
    app.mount(
        "/studio",
        StaticFiles(directory=str(_STUDIO_DIR), html=True),
        name="studio",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

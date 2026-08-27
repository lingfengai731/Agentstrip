import asyncio
import base64
import hashlib
import math
import re
import hmac
import json
import os
import secrets
import time
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from db import get_db, init_db, IntegrityError, backend_name
import paypal_service
from email_service import (
    send_driver_request,
    send_password_reset,
    send_verification_code,
    send_welcome,
)

try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token
except ImportError:  # dependency is installed from requirements in production
    google_requests = None
    google_id_token = None

load_dotenv(Path(__file__).parent.parent / ".env")


def _cors_allowed_origins() -> list[str]:
    defaults = ["https://wandermind.cc", "https://www.wandermind.cc"]
    configured = [
        value.strip().rstrip("/")
        for value in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if value.strip()
    ]
    valid = [
        origin for origin in defaults + configured
        if re.fullmatch(r"https?://[^/\s]+", origin) and origin != "*"
    ]
    return list(dict.fromkeys(valid))


app = FastAPI(title="WanderMind API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allowed_origins(),
    allow_origin_regex=r"^http://(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Anon-Id"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

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


def _is_production() -> bool:
    environment = os.getenv("ENVIRONMENT", "").strip().lower()
    return environment in {"production", "prod"} or bool(os.getenv("RENDER", "").strip())


def _new_referral_code() -> str:
    return secrets.token_urlsafe(7).replace("-", "").replace("_", "")[:10].upper()


def _request_origin_host(request: Request) -> str:
    """Return the public client address forwarded by Render, with a direct fallback."""
    forwarded = ""
    if os.getenv("RENDER", "").strip():
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "")


def _request_ip_hash(request: Request) -> str:
    host = _request_origin_host(request)
    if not host:
        return ""
    return hmac.new(_SECRET.encode(), f"signup-ip:{host}".encode(), hashlib.sha256).hexdigest()


def _ensure_referral_code(conn, user_id: str) -> str:
    row = conn.execute(
        "SELECT referral_code FROM users WHERE id=?", (user_id,)
    ).fetchone()
    if row and dict(row).get("referral_code"):
        return str(dict(row)["referral_code"])
    for _ in range(8):
        code = _new_referral_code()
        if not conn.execute(
            "SELECT 1 FROM users WHERE referral_code=?", (code,)
        ).fetchone():
            conn.execute(
                "UPDATE users SET referral_code=? WHERE id=?", (code, user_id)
            )
            conn.commit()
            return code
    raise HTTPException(503, "Could not allocate referral code")


def _month_start_utc(now: int) -> int:
    current = datetime.fromtimestamp(now, tz=timezone.utc)
    return int(datetime(current.year, current.month, 1, tzinfo=timezone.utc).timestamp())


def _apply_referral(
    conn,
    *,
    referral_code: str,
    invitee_user_id: str,
    invitee_ip_hash: str,
    now: int,
) -> bool:
    code = (referral_code or "").strip().upper()
    if not code:
        return False
    inviter_row = conn.execute(
        "SELECT id,signup_ip_hash FROM users WHERE referral_code=?", (code,)
    ).fetchone()
    if not inviter_row:
        return False
    inviter = dict(inviter_row)
    if inviter["id"] == invitee_user_id:
        return False
    if invitee_ip_hash and inviter.get("signup_ip_hash") == invitee_ip_hash:
        return False
    count_row = conn.execute(
        """SELECT COUNT(*) AS n FROM referrals
           WHERE inviter_user_id=? AND created_at>=?""",
        (inviter["id"], _month_start_utc(now)),
    ).fetchone()
    if count_row and int(dict(count_row).get("n") or 0) >= 5:
        return False
    try:
        conn.execute(
            """INSERT INTO referrals
               (id,inviter_user_id,invitee_user_id,status,available_at,created_at)
               VALUES (?,?,?,?,?,?)""",
            (
                str(uuid.uuid4()), inviter["id"], invitee_user_id, "pending",
                now + 86400, now,
            ),
        )
        return True
    except IntegrityError:
        conn.rollback()
        return False


def _mature_referrals(conn, user_id: str, now: int) -> None:
    rows = conn.execute(
        """SELECT id,inviter_user_id,invitee_user_id FROM referrals
           WHERE status='pending' AND available_at<=?
             AND (inviter_user_id=? OR invitee_user_id=?)""",
        (now, user_id, user_id),
    ).fetchall()
    for row in rows:
        ref = dict(row)
        for beneficiary, delta, reason in (
            (ref["inviter_user_id"], 10, "referral_inviter"),
            (ref["invitee_user_id"], 5, "referral_invitee"),
        ):
            conn.execute(
                """INSERT INTO route_points_ledger
                   (id,user_id,delta,reason,ref_id,created_at)
                   VALUES (?,?,?,?,?,?)
                   ON CONFLICT(user_id,reason,ref_id) DO NOTHING""",
                (str(uuid.uuid4()), beneficiary, delta, reason, ref["id"], now),
            )
        conn.execute(
            "UPDATE referrals SET status='available' WHERE id=? AND status='pending'",
            (ref["id"],),
        )
        conn.commit()


def _points_balance(conn, user_id: str) -> int:
    row = conn.execute(
        "SELECT COALESCE(SUM(delta),0) AS balance FROM route_points_ledger WHERE user_id=?",
        (user_id,),
    ).fetchone()
    return int(dict(row).get("balance") or 0) if row else 0


def _bootstrap_admin() -> None:
    """Create the independent admin account without shipping a weak production
    credential. Local development defaults to admin/123456 by explicit product
    decision; production requires a strong ADMIN_BOOTSTRAP_PASSWORD env value."""
    username = os.getenv("ADMIN_USERNAME", "admin").strip().lower() or "admin"
    email = os.getenv("ADMIN_EMAIL", "admin@localhost").strip().lower() or "admin@localhost"
    password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "").strip()

    if not password and not _is_production():
        password = "123456"
    if not password:
        print("[wandermind] Admin bootstrap skipped: set ADMIN_BOOTSTRAP_PASSWORD")
        return
    if _is_production() and (len(password) < 12 or password == "123456"):
        print("[wandermind] Admin bootstrap skipped: production password must be at least 12 characters")
        return

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id,role FROM users WHERE username=?", (username,)
        ).fetchone()
        if existing:
            if dict(existing).get("role") != "admin":
                print("[wandermind] Admin bootstrap skipped: username is already occupied")
            return

        referral_code = _new_referral_code()
        while conn.execute(
            "SELECT 1 FROM users WHERE referral_code=?", (referral_code,)
        ).fetchone():
            referral_code = _new_referral_code()

        uid = str(uuid.uuid4())
        try:
            conn.execute(
                """INSERT INTO users
                   (id,email,name,password_hash,lang,email_verified,auth_provider,
                    username,role,referral_code,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    uid, email, "admin", hash_pw(password), "zh", 1, "password",
                    username, "admin", referral_code, int(time.time()),
                ),
            )
            conn.commit()
            print(f"[wandermind] Admin account created for username '{username}'")
        except IntegrityError:
            conn.rollback()
            print("[wandermind] Admin bootstrap skipped: configured email or username is already in use")
    finally:
        conn.close()


_bootstrap_admin()


# ─── Auth dependency ─────────────────────────────────────────
async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        return verify_token(authorization.split(" ", 1)[1])
    except ValueError as e:
        raise HTTPException(401, str(e))


# Soft auth: returns the user dict if a valid token is present, else None.
# Used by public read/product endpoints that may optionally claim account data.
async def optional_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return verify_token(authorization.split(" ", 1)[1])
    except Exception:
        return None


def _db_user(conn, token_user: dict) -> dict:
    row = conn.execute(
        "SELECT id,email,name,username,role,referral_code FROM users WHERE id=?",
        (token_user["sub"],),
    ).fetchone()
    if not row:
        raise HTTPException(401, "User account no longer exists")
    return dict(row)


async def current_admin(user=Depends(current_user)) -> dict:
    conn = get_db()
    try:
        db_user = _db_user(conn, user)
        if db_user.get("role") != "admin":
            raise HTTPException(403, "Admin access required")
        return db_user
    finally:
        conn.close()


# ─── AI usage quota (5 free Q&A, then beans) ─────────────────
FREE_USE_LIMIT = int(os.getenv("FREE_USE_LIMIT", "5"))


async def anon_id_header(x_anon_id: Optional[str] = Header(None, alias="X-Anon-Id")):
    """Client-generated stable id for metering not-logged-in visitors."""
    if x_anon_id and re.fullmatch(r"[A-Za-z0-9_-]{8,64}", x_anon_id):
        return x_anon_id
    return None


def _quota_snapshot(conn, user, anon_id) -> dict:
    """Read current quota without consuming. Never raises."""
    if not user:
        return {
            "free_used": 0,
            "free_limit": FREE_USE_LIMIT,
            "free_left": 0,
            "beans": 0,
            "can_use": False,
            "logged_in": False,
            "tracked": False,
            "login_required": True,
        }
    fu = b = 0
    tracked = True
    if user:
        row = conn.execute("SELECT free_uses, beans, role FROM users WHERE id=?", (user["sub"],)).fetchone()
        if row:
            d = dict(row)
            if d.get("role") == "admin":
                return {
                    "free_used": 0, "free_limit": FREE_USE_LIMIT, "free_left": FREE_USE_LIMIT,
                    "beans": d.get("beans") or 0, "can_use": True,
                    "logged_in": True, "tracked": True, "admin_unlimited": True,
                }
            fu = d.get("free_uses") or 0; b = d.get("beans") or 0
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
    if not user:
        raise HTTPException(401, "Sign in is required for AI use")
    conn = get_db()
    try:
        if user:
            row = conn.execute("SELECT free_uses, beans, role FROM users WHERE id=?", (user["sub"],)).fetchone()
            fu = (dict(row).get("free_uses") or 0) if row else 0
            b = (dict(row).get("beans") or 0) if row else 0
            if row and dict(row).get("role") == "admin":
                return _quota_snapshot(conn, user, anon_id)
            if fu < FREE_USE_LIMIT:
                conn.execute("UPDATE users SET free_uses=free_uses+1 WHERE id=?", (user["sub"],))
            elif b > 0:
                conn.execute("UPDATE users SET beans=beans-1 WHERE id=?", (user["sub"],))
            else:
                raise HTTPException(402, detail={"error": "quota_exhausted", "free_limit": FREE_USE_LIMIT, "beans": 0})
            conn.commit()
        return _quota_snapshot(conn, user, anon_id)
    finally:
        conn.close()


# ─── Request models ──────────────────────────────────────────
class SendVerificationReq(BaseModel):
    email: str
    lang: str = "en"


class RegisterReq(BaseModel):
    email: str
    password: str
    name: str
    code: str
    lang: str = "en"
    referral_code: str = ""


class LoginReq(BaseModel):
    email: str
    password: str


class ForgotPwReq(BaseModel):
    email: str
    lang: str = "en"


class GoogleLoginReq(BaseModel):
    credential: str
    lang: str = "en"
    referral_code: str = ""


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
    product_trip_id: str = ""
    trip_action: str = ""


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
    enhance: bool = False


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
    request_id: str = Field(default="", max_length=64)
    driver_id: str = "dicky"
    route_id: str = ""
    package_id: str = Field(default="", max_length=80)
    first_name: str = ""
    last_name: str = ""
    intro: str = ""
    contact_email: str = ""
    num_people: Optional[int] = None
    num_days: Optional[int] = None
    attractions: str = ""
    start_date: str = ""
    end_date: str = ""
    preferred_time: str = ""
    pickup_location: str = ""
    budget_range: str = ""
    requested_services: List[str] = []
    arrival_details: str = ""
    lang: str = "en"
    privacy_consent: bool = False
    website: str = ""


class MarketingEventReq(BaseModel):
    event_name: str = Field(max_length=64)
    page_path: str = Field(default="/", max_length=256)
    source: str = Field(default="", max_length=256)
    medium: str = Field(default="", max_length=256)
    campaign: str = Field(default="", max_length=256)
    content: str = Field(default="", max_length=256)
    lang: str = Field(default="en", max_length=16)
    device_class: str = Field(default="", max_length=16)


class ProductTripCreateReq(BaseModel):
    destination: str = "bali"
    brief: dict = {}


class ProductTripUseReq(BaseModel):
    action: str


class ProRouteOrderReq(BaseModel):
    trip_id: str


class ProRouteConfirmReq(BaseModel):
    payment_reference: str = ""


class PayPalOrderReq(BaseModel):
    trip_id: str


class ReferralRedeemReq(BaseModel):
    trip_id: str


class ProfessionalRouteReq(BaseModel):
    trip_id: str = ""
    trip_profile: dict = {}
    route_id: str = ""
    lang: str = "en"


class ProfessionalRouteAdjustReq(BaseModel):
    trip_profile: dict = {}
    route_id: str = ""
    lang: str = "en"


class PortfolioUploadSignatureReq(BaseModel):
    destination: str = "bali"
    filename: str = ""
    replacement_asset_id: str = ""


class PortfolioUploadCleanupReq(BaseModel):
    destination: str = "bali"
    cloudinary_public_id: str
    cloudinary_version: int
    response_signature: str
    cleanup_timestamp: int
    cleanup_token: str


class PortfolioAssetReq(BaseModel):
    destination: str = "bali"
    primary_theme: str
    sub_category: str = ""
    region: str = ""
    area: str = ""
    place_name: str = ""
    place_type: str = ""
    prominence: str = "supporting"
    route_ids: List[str] = []
    extension_ids: List[str] = []
    tags: List[str] = []
    mood: str = ""
    photography_style: str = ""
    title: dict = {}
    description: dict = {}
    alt_text: dict = {}
    verification_status: str = "caption-only"
    original_filename: str = ""
    sha256: str
    file_bytes: int
    width: int
    height: int
    format: str
    image_metadata: dict = {}
    cloudinary_asset_id: str
    cloudinary_public_id: str
    cloudinary_version: int
    secure_url: str
    response_signature: str
    status: str = "draft"


class PortfolioAssetUpdateReq(BaseModel):
    primary_theme: Optional[str] = None
    sub_category: Optional[str] = None
    region: Optional[str] = None
    area: Optional[str] = None
    place_name: Optional[str] = None
    place_type: Optional[str] = None
    prominence: Optional[str] = None
    route_ids: Optional[List[str]] = None
    extension_ids: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    mood: Optional[str] = None
    photography_style: Optional[str] = None
    title: Optional[dict] = None
    description: Optional[dict] = None
    alt_text: Optional[dict] = None
    verification_status: Optional[str] = None
    status: Optional[str] = None


class PortfolioAssetReplaceReq(BaseModel):
    original_filename: str = ""
    sha256: str
    file_bytes: int
    width: int
    height: int
    format: str
    image_metadata: dict = {}
    cloudinary_asset_id: str
    cloudinary_public_id: str
    cloudinary_version: int
    secure_url: str
    response_signature: str


class PortfolioReorderReq(BaseModel):
    asset_ids: List[str]


_PORTFOLIO_LANGS = ("zh", "en", "ja", "ko", "id")
_PORTFOLIO_THEMES = {"landscapes", "culture", "experiences"}
_PORTFOLIO_STATUSES = {"draft", "published", "hidden", "archived"}
_PORTFOLIO_PROMINENCE = {"signature", "iconic", "supporting"}
_PORTFOLIO_VERIFICATION = {
    "pending-review", "caption-only", "bali-named", "route-linked"
}
_PORTFOLIO_IMAGE_FORMATS = {"jpg", "jpeg", "png", "webp", "avif", "heic"}
_PORTFOLIO_MAX_BYTES = 25 * 1024 * 1024
_PORTFOLIO_CLEANUP_TTL_SECONDS = 60 * 60
_PORTFOLIO_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "wandermind-studio" / "frontend" / "assets" / "data" / "image-publish-manifest.json"


def _portfolio_destination(value: str) -> str:
    destination = (value or "bali").strip().lower()
    if not re.fullmatch(r"[a-z0-9-]{2,40}", destination):
        raise HTTPException(400, "Invalid portfolio destination")
    return destination


def _portfolio_text(value, field: str, limit: int = 240) -> str:
    text_value = str(value or "").strip()
    if len(text_value) > limit:
        raise HTTPException(400, f"{field} is too long")
    return text_value


def _portfolio_localized(value, field: str, limit: int) -> dict:
    if not isinstance(value, dict):
        raise HTTPException(400, f"{field} must be a language map")
    cleaned = {}
    for lang in _PORTFOLIO_LANGS:
        text_value = _portfolio_text(value.get(lang, ""), f"{field}.{lang}", limit)
        if text_value:
            cleaned[lang] = text_value
    return cleaned


def _portfolio_slug_list(value, field: str, *, routes: bool = False) -> list:
    if not isinstance(value, list) or len(value) > 24:
        raise HTTPException(400, f"{field} must be a short list")
    result = []
    for item in value:
        normalized = str(item or "").strip()
        valid = re.fullmatch(r"R[1-6]", normalized) if routes else re.fullmatch(
            r"[A-Za-z0-9][A-Za-z0-9_-]{0,47}", normalized
        )
        if not valid:
            raise HTTPException(400, f"Invalid value in {field}")
        if normalized not in result:
            result.append(normalized)
    return result


def _validate_portfolio_metadata(payload: dict) -> dict:
    theme = str(payload.get("primary_theme") or "").strip().lower()
    if theme not in _PORTFOLIO_THEMES:
        raise HTTPException(400, "primary_theme must be landscapes, culture, or experiences")
    prominence = str(payload.get("prominence") or "supporting").strip().lower()
    if prominence not in _PORTFOLIO_PROMINENCE:
        raise HTTPException(400, "Invalid prominence")
    verification = str(payload.get("verification_status") or "caption-only").strip().lower()
    if verification not in _PORTFOLIO_VERIFICATION:
        raise HTTPException(400, "Invalid verification_status")
    status = str(payload.get("status") or "draft").strip().lower()
    if status not in _PORTFOLIO_STATUSES:
        raise HTTPException(400, "Invalid portfolio status")
    cleaned = {
        "primary_theme": theme,
        "sub_category": _portfolio_text(payload.get("sub_category"), "sub_category", 80),
        "region": _portfolio_text(payload.get("region"), "region", 80),
        "area": _portfolio_text(payload.get("area"), "area", 120),
        "place_name": _portfolio_text(payload.get("place_name"), "place_name", 180),
        "place_type": _portfolio_text(payload.get("place_type"), "place_type", 120),
        "prominence": prominence,
        "route_ids": _portfolio_slug_list(payload.get("route_ids") or [], "route_ids", routes=True),
        "extension_ids": _portfolio_slug_list(payload.get("extension_ids") or [], "extension_ids"),
        "tags": _portfolio_slug_list(payload.get("tags") or [], "tags"),
        "mood": _portfolio_text(payload.get("mood"), "mood", 80),
        "photography_style": _portfolio_text(payload.get("photography_style"), "photography_style", 120),
        "title": _portfolio_localized(payload.get("title") or {}, "title", 180),
        "description": _portfolio_localized(payload.get("description") or {}, "description", 1200),
        "alt_text": _portfolio_localized(payload.get("alt_text") or {}, "alt_text", 240),
        "verification_status": verification,
        "status": status,
    }
    if status == "published":
        if not cleaned["place_name"]:
            raise HTTPException(400, "Published assets require place_name")
        missing_locales = [
            f"{field}.{lang}"
            for field in ("title", "description", "alt_text")
            for lang in _PORTFOLIO_LANGS
            if not cleaned[field].get(lang)
        ]
        if missing_locales:
            raise HTTPException(
                400,
                "Published assets require title, description, and alt_text in zh, en, ja, ko, and id; missing: "
                + ", ".join(missing_locales),
            )
    return cleaned


def _cloudinary_config() -> tuple:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not cloud_name or not api_key or not api_secret:
        raise HTTPException(503, "Portfolio object storage is not configured")
    if not re.fullmatch(r"[A-Za-z0-9_-]{2,80}", cloud_name):
        raise HTTPException(503, "Portfolio object storage configuration is invalid")
    return cloud_name, api_key, api_secret


def _portfolio_approved_hashes() -> set[str]:
    try:
        manifest = json.loads(_PORTFOLIO_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(503, "Approved image manifest is unavailable")
    if not isinstance(manifest, dict):
        raise HTTPException(503, "Approved image manifest has an invalid structure")
    images = manifest.get("images")
    if not isinstance(images, list):
        raise HTTPException(503, "Approved image manifest has an invalid images list")
    hashes = {
        str(item.get("sha256") or "").strip().lower()
        for item in images
        if isinstance(item, dict)
    }
    hashes.discard("")
    if not hashes:
        raise HTTPException(503, "Approved image manifest is empty")
    return hashes


def _require_portfolio_publish_approval(sha256: str, status: str) -> None:
    if status == "published" and str(sha256 or "").strip().lower() not in _portfolio_approved_hashes():
        raise HTTPException(400, "Image must be added to the approved manifest before publishing")


def _cloudinary_sign(params: dict, api_secret: str) -> str:
    serialized = "&".join(
        f"{key}={params[key]}" for key in sorted(params) if params[key] not in (None, "")
    )
    return hashlib.sha1(f"{serialized}{api_secret}".encode()).hexdigest()


def _portfolio_cleanup_token(
    destination: str, public_id: str, timestamp: int, api_secret: str
) -> str:
    message = f"{destination}\n{public_id}\n{timestamp}".encode()
    return hmac.new(api_secret.encode(), message, hashlib.sha256).hexdigest()


def _validate_portfolio_cleanup_claim(data: PortfolioUploadCleanupReq) -> str:
    _, _, api_secret = _cloudinary_config()
    destination = _portfolio_destination(data.destination)
    public_id = _portfolio_text(
        data.cloudinary_public_id, "cloudinary_public_id", 260
    )
    if not public_id.startswith(f"wandermind/portfolio/{destination}/"):
        raise HTTPException(400, "Cloudinary public_id is outside the portfolio folder")
    timestamp = int(data.cleanup_timestamp or 0)
    now = int(time.time())
    if timestamp < 1 or timestamp > now + 60 or now - timestamp > _PORTFOLIO_CLEANUP_TTL_SECONDS:
        raise HTTPException(400, "Portfolio cleanup authorization has expired")
    expected_token = _portfolio_cleanup_token(
        destination, public_id, timestamp, api_secret
    )
    if not hmac.compare_digest(
        str(data.cleanup_token or "").strip().lower(), expected_token
    ):
        raise HTTPException(400, "Invalid portfolio cleanup authorization")
    version = int(data.cloudinary_version or 0)
    if version < 1:
        raise HTTPException(400, "Invalid Cloudinary asset version")
    expected_response_signature = hashlib.sha1(
        f"public_id={public_id}&version={version}{api_secret}".encode()
    ).hexdigest()
    if not hmac.compare_digest(
        str(data.response_signature or "").strip().lower(),
        expected_response_signature,
    ):
        raise HTTPException(400, "Cloudinary upload response signature is invalid")
    return public_id


async def _cloudinary_destroy_image(public_id: str) -> str:
    cloud_name, api_key, api_secret = _cloudinary_config()
    params = {
        "invalidate": "true",
        "public_id": public_id,
        "timestamp": int(time.time()),
    }
    payload = {
        **params,
        "api_key": api_key,
        "signature": _cloudinary_sign(params, api_secret),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"https://api.cloudinary.com/v1_1/{cloud_name}/image/destroy",
                data=payload,
            )
        response.raise_for_status()
        response_payload = response.json()
        if not isinstance(response_payload, dict):
            raise ValueError("Unexpected Cloudinary cleanup response")
        result = str(response_payload.get("result") or "").strip().lower()
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        raise HTTPException(502, "Cloudinary cleanup could not be confirmed")
    if result not in {"ok", "not found"}:
        raise HTTPException(502, "Cloudinary cleanup could not be confirmed")
    return result


def _portfolio_storage_payload(data, destination: str) -> dict:
    cloud_name, _, api_secret = _cloudinary_config()
    public_id = _portfolio_text(data.cloudinary_public_id, "cloudinary_public_id", 260)
    version = int(data.cloudinary_version or 0)
    if version < 1:
        raise HTTPException(400, "Invalid Cloudinary asset version")
    response_signature = str(data.response_signature or "").strip().lower()
    expected_signature = hashlib.sha1(
        f"public_id={public_id}&version={version}{api_secret}".encode()
    ).hexdigest()
    if not hmac.compare_digest(response_signature, expected_signature):
        raise HTTPException(400, "Cloudinary upload response signature is invalid")
    expected_prefix = f"wandermind/portfolio/{destination}/"
    if not public_id.startswith(expected_prefix):
        raise HTTPException(400, "Cloudinary public_id is outside the portfolio folder")
    secure_url = _portfolio_text(data.secure_url, "secure_url", 1000)
    delivery_prefix = f"https://res.cloudinary.com/{cloud_name}/image/upload/"
    if not secure_url.startswith(delivery_prefix):
        raise HTTPException(400, "Cloudinary secure_url does not match the configured account")
    file_format = str(data.format or "").strip().lower()
    if file_format not in _PORTFOLIO_IMAGE_FORMATS:
        raise HTTPException(400, "Unsupported portfolio image format")
    file_bytes = int(data.file_bytes or 0)
    width = int(data.width or 0)
    height = int(data.height or 0)
    if file_bytes < 1 or file_bytes > _PORTFOLIO_MAX_BYTES:
        raise HTTPException(400, "Portfolio image must be 25 MB or smaller")
    if width < 1 or height < 1 or width > 30000 or height > 30000:
        raise HTTPException(400, "Invalid portfolio image dimensions")
    sha256 = str(data.sha256 or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        raise HTTPException(400, "Invalid SHA-256 digest")
    versioned_id = quote(public_id, safe="/")
    version_path = f"v{version}/{versioned_id}"
    base = f"https://res.cloudinary.com/{cloud_name}/image/upload"
    cloudinary_asset_id = _portfolio_text(data.cloudinary_asset_id, "cloudinary_asset_id", 160)
    if not cloudinary_asset_id:
        raise HTTPException(400, "Cloudinary asset_id is required")
    return {
        "original_filename": _portfolio_text(data.original_filename, "original_filename", 240),
        "sha256": sha256,
        "file_bytes": file_bytes,
        "width": width,
        "height": height,
        "format": file_format,
        "exif": dict(data.image_metadata or {}),
        "cloudinary_asset_id": cloudinary_asset_id,
        "cloudinary_public_id": public_id,
        "cloudinary_version": version,
        "secure_url": secure_url,
        "web_url": f"{base}/f_webp,q_auto,w_1600,c_limit/{version_path}",
        "thumbnail_url": f"{base}/f_webp,q_auto,w_480,h_320,c_fill,g_auto/{version_path}",
    }


def _portfolio_json(value, fallback):
    try:
        parsed = json.loads(value or "")
        return parsed if isinstance(parsed, type(fallback)) else fallback
    except Exception:
        return fallback


def _portfolio_asset_dict(row, *, public: bool = False) -> dict:
    item = dict(row)
    for field in ("route_ids", "extension_ids", "tags"):
        item[field] = _portfolio_json(item.get(field), [])
    for field in ("title", "description", "alt_text", "exif"):
        item[field] = _portfolio_json(item.get(field), {})
    if public:
        allowed = {
            "id", "destination", "primary_theme", "sub_category", "region", "area",
            "place_name", "place_type", "prominence", "route_ids", "extension_ids",
            "tags", "mood", "photography_style", "title", "description", "alt_text",
            "verification_status", "width", "height", "web_url", "thumbnail_url",
            "sort_order", "published_at",
        }
        item = {key: value for key, value in item.items() if key in allowed}
    return item


@app.get("/api/portfolio")
async def list_public_portfolio(destination: str = "bali"):
    normalized_destination = _portfolio_destination(destination)
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT * FROM portfolio_assets
               WHERE destination=? AND status='published'
               ORDER BY sort_order ASC, published_at DESC, created_at DESC
               LIMIT 300""",
            (normalized_destination,),
        ).fetchall()
        return JSONResponse(
            {"assets": [_portfolio_asset_dict(row, public=True) for row in rows]},
            headers={"Cache-Control": "no-store"},
        )
    finally:
        conn.close()


@app.get("/api/admin/portfolio")
async def list_admin_portfolio(
    destination: str = "bali",
    admin=Depends(current_admin),
):
    normalized_destination = _portfolio_destination(destination)
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT * FROM portfolio_assets
               WHERE destination=?
               ORDER BY sort_order ASC, created_at DESC
               LIMIT 500""",
            (normalized_destination,),
        ).fetchall()
        storage_ready = all(os.getenv(key, "").strip() for key in (
            "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"
        ))
        return {
            "assets": [_portfolio_asset_dict(row) for row in rows],
            "storage_ready": storage_ready,
            "max_upload_bytes": _PORTFOLIO_MAX_BYTES,
        }
    finally:
        conn.close()


@app.post("/api/admin/portfolio/upload-signature")
async def portfolio_upload_signature(
    data: PortfolioUploadSignatureReq,
    admin=Depends(current_admin),
):
    destination = _portfolio_destination(data.destination)
    cloud_name, api_key, api_secret = _cloudinary_config()
    timestamp = int(time.time())
    eager = "f_webp,q_auto,w_1600,c_limit|f_webp,q_auto,w_480,h_320,c_fill,g_auto"
    params = {
        "allowed_formats": "jpg,jpeg,png,webp,avif,heic",
        "eager": eager,
        "image_metadata": "true",
        "tags": f"wandermind,portfolio,{destination}",
        "timestamp": timestamp,
    }
    replacement_id = (data.replacement_asset_id or "").strip()
    cleanup = None
    if replacement_id:
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT cloudinary_public_id,destination FROM portfolio_assets WHERE id=?",
                (replacement_id,),
            ).fetchone()
        finally:
            conn.close()
        if not row or dict(row).get("destination") != destination:
            raise HTTPException(404, "Portfolio asset not found")
        params.update({
            "invalidate": "true",
            "overwrite": "true",
            "public_id": dict(row)["cloudinary_public_id"],
        })
    else:
        stem = re.sub(r"[^a-z0-9]+", "-", Path(data.filename or "image").stem.lower()).strip("-")
        stem = (stem or "image")[:48]
        params.update({
            "folder": f"wandermind/portfolio/{destination}",
            "overwrite": "false",
            "public_id": f"{stem}-{uuid.uuid4().hex[:12]}",
        })
        cleanup_public_id = f"{params['folder']}/{params['public_id']}"
        cleanup = {
            "public_id": cleanup_public_id,
            "timestamp": timestamp,
            "token": _portfolio_cleanup_token(
                destination, cleanup_public_id, timestamp, api_secret
            ),
        }
    return {
        "upload_url": f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload",
        "cloud_name": cloud_name,
        "api_key": api_key,
        "signature": _cloudinary_sign(params, api_secret),
        "signed_fields": params,
        "cleanup": cleanup,
        "max_upload_bytes": _PORTFOLIO_MAX_BYTES,
    }


@app.post("/api/admin/portfolio/upload-cleanup")
async def cleanup_portfolio_upload(
    data: PortfolioUploadCleanupReq,
    admin=Depends(current_admin),
):
    destination = _portfolio_destination(data.destination)
    public_id = _validate_portfolio_cleanup_claim(data)
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id FROM portfolio_assets WHERE destination=? AND cloudinary_public_id=?",
            (destination, public_id),
        ).fetchone()
    finally:
        conn.close()
    if row:
        return {"ok": True, "result": "registered"}
    result = await _cloudinary_destroy_image(public_id)
    return {
        "ok": True,
        "result": "deleted" if result == "ok" else "not_found",
    }


@app.post("/api/admin/portfolio/assets")
async def create_portfolio_asset(
    data: PortfolioAssetReq,
    admin=Depends(current_admin),
):
    destination = _portfolio_destination(data.destination)
    metadata = _validate_portfolio_metadata(data.model_dump())
    storage = _portfolio_storage_payload(data, destination)
    _require_portfolio_publish_approval(storage["sha256"], metadata["status"])
    now = int(time.time())
    conn = get_db()
    try:
        max_row = conn.execute(
            "SELECT COALESCE(MAX(sort_order),-10) AS n FROM portfolio_assets WHERE destination=?",
            (destination,),
        ).fetchone()
        sort_order = int(dict(max_row).get("n") or -10) + 10
        asset_id = str(uuid.uuid4())
        published_at = now if metadata["status"] == "published" else None
        archived_at = now if metadata["status"] == "archived" else None
        try:
            conn.execute(
                """INSERT INTO portfolio_assets
                   (id,destination,primary_theme,sub_category,region,area,place_name,
                    place_type,prominence,route_ids,extension_ids,tags,mood,
                    photography_style,title,description,alt_text,verification_status,
                    original_filename,sha256,file_bytes,width,height,format,exif,
                    cloudinary_asset_id,cloudinary_public_id,cloudinary_version,
                    secure_url,web_url,thumbnail_url,status,sort_order,created_by,
                    created_at,updated_at,published_at,archived_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    asset_id, destination, metadata["primary_theme"], metadata["sub_category"],
                    metadata["region"], metadata["area"], metadata["place_name"],
                    metadata["place_type"], metadata["prominence"],
                    json.dumps(metadata["route_ids"], ensure_ascii=False),
                    json.dumps(metadata["extension_ids"], ensure_ascii=False),
                    json.dumps(metadata["tags"], ensure_ascii=False), metadata["mood"],
                    metadata["photography_style"],
                    json.dumps(metadata["title"], ensure_ascii=False),
                    json.dumps(metadata["description"], ensure_ascii=False),
                    json.dumps(metadata["alt_text"], ensure_ascii=False),
                    metadata["verification_status"], storage["original_filename"],
                    storage["sha256"], storage["file_bytes"], storage["width"],
                    storage["height"], storage["format"],
                    json.dumps(storage["exif"], ensure_ascii=False),
                    storage["cloudinary_asset_id"], storage["cloudinary_public_id"],
                    storage["cloudinary_version"], storage["secure_url"],
                    storage["web_url"], storage["thumbnail_url"], metadata["status"],
                    sort_order, admin["id"], now, now, published_at, archived_at,
                ),
            )
            conn.commit()
        except IntegrityError:
            conn.rollback()
            existing_row = conn.execute(
                """SELECT * FROM portfolio_assets
                   WHERE destination=? AND
                   (sha256=? OR cloudinary_asset_id=? OR cloudinary_public_id=?)
                   LIMIT 1""",
                (
                    destination,
                    storage["sha256"],
                    storage["cloudinary_asset_id"],
                    storage["cloudinary_public_id"],
                ),
            ).fetchone()
            if existing_row:
                existing = _portfolio_asset_dict(existing_row)
                if (
                    existing["sha256"] == storage["sha256"]
                    and existing["cloudinary_asset_id"] == storage["cloudinary_asset_id"]
                    and existing["cloudinary_public_id"] == storage["cloudinary_public_id"]
                ):
                    return {"ok": True, "asset": existing, "idempotent": True}
            raise HTTPException(409, "This portfolio image or Cloudinary asset already exists")
        row = conn.execute("SELECT * FROM portfolio_assets WHERE id=?", (asset_id,)).fetchone()
        return {"ok": True, "asset": _portfolio_asset_dict(row)}
    finally:
        conn.close()


@app.patch("/api/admin/portfolio/assets/{asset_id}")
async def update_portfolio_asset(
    asset_id: str,
    data: PortfolioAssetUpdateReq,
    admin=Depends(current_admin),
):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM portfolio_assets WHERE id=?", (asset_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Portfolio asset not found")
        existing = _portfolio_asset_dict(row)
        merged = {
            key: existing[key] for key in (
                "primary_theme", "sub_category", "region", "area", "place_name",
                "place_type", "prominence", "route_ids", "extension_ids", "tags",
                "mood", "photography_style", "title", "description", "alt_text",
                "verification_status", "status",
            )
        }
        merged.update(data.model_dump(exclude_none=True))
        metadata = _validate_portfolio_metadata(merged)
        _require_portfolio_publish_approval(existing["sha256"], metadata["status"])
        now = int(time.time())
        published_at = existing.get("published_at")
        archived_at = existing.get("archived_at")
        if metadata["status"] == "published" and not published_at:
            published_at = now
        if metadata["status"] == "archived" and not archived_at:
            archived_at = now
        conn.execute(
            """UPDATE portfolio_assets SET
               primary_theme=?,sub_category=?,region=?,area=?,place_name=?,place_type=?,
               prominence=?,route_ids=?,extension_ids=?,tags=?,mood=?,photography_style=?,
               title=?,description=?,alt_text=?,verification_status=?,status=?,updated_at=?,
               published_at=?,archived_at=? WHERE id=?""",
            (
                metadata["primary_theme"], metadata["sub_category"], metadata["region"],
                metadata["area"], metadata["place_name"], metadata["place_type"],
                metadata["prominence"], json.dumps(metadata["route_ids"], ensure_ascii=False),
                json.dumps(metadata["extension_ids"], ensure_ascii=False),
                json.dumps(metadata["tags"], ensure_ascii=False), metadata["mood"],
                metadata["photography_style"], json.dumps(metadata["title"], ensure_ascii=False),
                json.dumps(metadata["description"], ensure_ascii=False),
                json.dumps(metadata["alt_text"], ensure_ascii=False),
                metadata["verification_status"], metadata["status"], now,
                published_at, archived_at, asset_id,
            ),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM portfolio_assets WHERE id=?", (asset_id,)).fetchone()
        return {"ok": True, "asset": _portfolio_asset_dict(updated)}
    finally:
        conn.close()


@app.post("/api/admin/portfolio/assets/{asset_id}/replace")
async def replace_portfolio_asset(
    asset_id: str,
    data: PortfolioAssetReplaceReq,
    admin=Depends(current_admin),
):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM portfolio_assets WHERE id=?", (asset_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Portfolio asset not found")
        existing = dict(row)
        storage = _portfolio_storage_payload(data, existing["destination"])
        _require_portfolio_publish_approval(storage["sha256"], existing["status"])
        if storage["cloudinary_public_id"] != existing["cloudinary_public_id"]:
            raise HTTPException(400, "Replacement must preserve the Cloudinary public_id")
        now = int(time.time())
        try:
            conn.execute(
                """UPDATE portfolio_assets SET
                   original_filename=?,sha256=?,file_bytes=?,width=?,height=?,format=?,exif=?,
                   cloudinary_asset_id=?,cloudinary_version=?,secure_url=?,web_url=?,thumbnail_url=?,
                   updated_at=? WHERE id=?""",
                (
                    storage["original_filename"], storage["sha256"], storage["file_bytes"],
                    storage["width"], storage["height"], storage["format"],
                    json.dumps(storage["exif"], ensure_ascii=False),
                    storage["cloudinary_asset_id"], storage["cloudinary_version"],
                    storage["secure_url"], storage["web_url"], storage["thumbnail_url"],
                    now, asset_id,
                ),
            )
            conn.commit()
        except IntegrityError:
            conn.rollback()
            raise HTTPException(409, "This replacement duplicates another portfolio image")
        updated = conn.execute("SELECT * FROM portfolio_assets WHERE id=?", (asset_id,)).fetchone()
        return {"ok": True, "asset": _portfolio_asset_dict(updated)}
    finally:
        conn.close()


@app.post("/api/admin/portfolio/reorder")
async def reorder_portfolio_assets(
    data: PortfolioReorderReq,
    destination: str = "bali",
    admin=Depends(current_admin),
):
    normalized_destination = _portfolio_destination(destination)
    asset_ids = [str(asset_id).strip() for asset_id in data.asset_ids]
    if not asset_ids or len(asset_ids) != len(set(asset_ids)) or len(asset_ids) > 500:
        raise HTTPException(400, "asset_ids must be a unique non-empty list")
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id FROM portfolio_assets WHERE destination=?",
            (normalized_destination,),
        ).fetchall()
        existing_ids = {dict(row)["id"] for row in rows}
        if set(asset_ids) != existing_ids:
            raise HTTPException(409, "Reorder list must contain every asset for this destination")
        now = int(time.time())
        for index, asset_id in enumerate(asset_ids):
            conn.execute(
                "UPDATE portfolio_assets SET sort_order=?,updated_at=? WHERE id=?",
                (index * 10, now, asset_id),
            )
        conn.commit()
        return {"ok": True, "asset_ids": asset_ids}
    finally:
        conn.close()


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


_SUPPORTED_LANGS = {"zh", "en", "ja", "ko", "id"}


def _clean_email(value: str) -> str:
    email = (value or "").lower().strip()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(400, "Invalid email address")
    return email


def _clean_lang(value: str) -> str:
    return value if value in _SUPPORTED_LANGS else "en"


def _verification_hash(email: str, code: str) -> str:
    return hmac.new(_SECRET.encode(), f"verify:{email}:{code}".encode(), hashlib.sha256).hexdigest()


@app.get("/api/auth/config")
async def auth_config():
    """Return public auth configuration. Secrets are never exposed."""
    return {"google_client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip()}


@app.post("/api/auth/send-verification-code")
async def send_registration_code(data: SendVerificationReq):
    email = _clean_email(data.email)
    lang = _clean_lang(data.lang)
    now = int(time.time())
    conn = get_db()
    try:
        if conn.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(400, "Email already registered")
        current = conn.execute(
            "SELECT resend_after FROM email_verification_codes WHERE email=?", (email,)
        ).fetchone()
        if current and int(current["resend_after"] or 0) > now:
            raise HTTPException(429, detail={"error": "wait_before_resend", "retry_after": int(current["resend_after"]) - now})

        code = f"{secrets.randbelow(1_000_000):06d}"
        result = await send_verification_code(email, code, lang)
        if not result.get("ok"):
            if os.getenv("ALLOW_DEV_VERIFICATION_CODE", "").strip() == "1":
                dev_code = code
            else:
                raise HTTPException(503, "Verification email could not be sent")
        else:
            dev_code = None

        conn.execute(
            """INSERT INTO email_verification_codes
               (email,code_hash,expires_at,resend_after,attempts,lang,created_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(email) DO UPDATE SET
                 code_hash=excluded.code_hash, expires_at=excluded.expires_at,
                 resend_after=excluded.resend_after, attempts=0, lang=excluded.lang,
                 created_at=excluded.created_at""",
            (email, _verification_hash(email, code), now + 600, now + 60, 0, lang, now),
        )
        conn.commit()
        response = {"ok": True, "expires_in": 600, "resend_in": 60}
        if dev_code:
            response["dev_code"] = dev_code
        return response
    finally:
        conn.close()


@app.post("/api/auth/register")
async def register(data: RegisterReq, request: Request):
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    email = _clean_email(data.email)
    name = data.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    code = (data.code or "").strip()
    if not re.fullmatch(r"\d{6}", code):
        raise HTTPException(400, "Invalid verification code")
    lang = _clean_lang(data.lang)
    conn = get_db()
    try:
        verification = conn.execute(
            "SELECT * FROM email_verification_codes WHERE email=?", (email,)
        ).fetchone()
        now = int(time.time())
        if not verification or int(verification["expires_at"]) < now:
            raise HTTPException(400, "Verification code expired")
        if int(verification["attempts"] or 0) >= 5:
            raise HTTPException(429, "Too many verification attempts")
        if not hmac.compare_digest(verification["code_hash"], _verification_hash(email, code)):
            conn.execute(
                "UPDATE email_verification_codes SET attempts=attempts+1 WHERE email=?", (email,)
            )
            conn.commit()
            raise HTTPException(400, "Invalid verification code")
        uid = str(uuid.uuid4())
        referral_code = _new_referral_code()
        while conn.execute(
            "SELECT 1 FROM users WHERE referral_code=?", (referral_code,)
        ).fetchone():
            referral_code = _new_referral_code()
        signup_ip_hash = _request_ip_hash(request)
        conn.execute(
            """INSERT INTO users
               (id,email,name,password_hash,lang,email_verified,auth_provider,
                referral_code,signup_ip_hash,created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                uid, email, name, hash_pw(data.password), lang, 1, "password",
                referral_code, signup_ip_hash, now,
            ),
        )
        referral_applied = _apply_referral(
            conn,
            referral_code=data.referral_code,
            invitee_user_id=uid,
            invitee_ip_hash=signup_ip_hash,
            now=now,
        )
        conn.execute("DELETE FROM email_verification_codes WHERE email=?", (email,))
        conn.commit()
        # Fire welcome email in background — never block registration on it
        asyncio.create_task(send_welcome(email, name, _public_base_url(request), lang))
        return {
            "token": make_token(uid, email),
            "user": {"id": uid, "email": email, "name": name, "role": "user"},
            "referral_applied": referral_applied,
        }
    except IntegrityError:
        raise HTTPException(400, "Email already registered")
    finally:
        conn.close()


@app.post("/api/auth/google")
async def google_login(data: GoogleLoginReq, request: Request):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(503, "Google sign-in is not configured")
    if not google_id_token or not google_requests:
        raise HTTPException(503, "Google sign-in dependency is unavailable")
    try:
        info = google_id_token.verify_oauth2_token(
            data.credential, google_requests.Request(), client_id
        )
    except Exception:
        raise HTTPException(401, "Invalid Google credential")
    if not info.get("email_verified"):
        raise HTTPException(401, "Google email is not verified")
    email = _clean_email(info.get("email", ""))
    google_sub = str(info.get("sub", "")).strip()
    if not google_sub:
        raise HTTPException(401, "Invalid Google account")
    name = (info.get("name") or email.split("@", 1)[0]).strip()
    lang = _clean_lang(data.lang)
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE google_sub=?", (google_sub,)).fetchone()
        if not row:
            existing = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            if existing:
                raise HTTPException(409, "This email already uses password sign-in")
            uid = str(uuid.uuid4())
            referral_code = _new_referral_code()
            while conn.execute(
                "SELECT 1 FROM users WHERE referral_code=?", (referral_code,)
            ).fetchone():
                referral_code = _new_referral_code()
            now = int(time.time())
            signup_ip_hash = _request_ip_hash(request)
            conn.execute(
                """INSERT INTO users
                   (id,email,name,password_hash,lang,email_verified,auth_provider,google_sub,
                    referral_code,signup_ip_hash,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    uid, email, name, "!google", lang, 1, "google", google_sub,
                    referral_code, signup_ip_hash, now,
                ),
            )
            _apply_referral(
                conn,
                referral_code=data.referral_code,
                invitee_user_id=uid,
                invitee_ip_hash=signup_ip_hash,
                now=now,
            )
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        return {
            "token": make_token(row["id"], row["email"]),
            "user": {
                "id": row["id"], "email": row["email"], "name": row["name"],
                "role": dict(row).get("role") or "user",
            },
        }
    finally:
        conn.close()


@app.post("/api/auth/login")
async def login(data: LoginReq):
    identifier = (data.email or "").lower().strip()
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE email=? OR username=?",
            (identifier, identifier),
        ).fetchone()
        if not row or not verify_pw(data.password, row["password_hash"]):
            raise HTTPException(401, "Invalid email or password")
        return {
            "token": make_token(row["id"], row["email"]),
            "user": {
                "id": row["id"], "email": row["email"], "name": row["name"],
                "username": dict(row).get("username"),
                "role": dict(row).get("role") or "user",
            },
        }
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
            asyncio.create_task(send_password_reset(
                r["email"], r["name"] or r["email"], link, _clean_lang(data.lang)
            ))
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
async def redeem_code(data: RedeemReq, user=Depends(current_user), anon_id=Depends(anon_id_header)):
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
        row = conn.execute(
            "SELECT id,email,name,lang,username,role,referral_code FROM users WHERE id=?",
            (user["sub"],),
        ).fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        result = dict(row)
        result["route_points"] = _points_balance(conn, user["sub"])
        return result
    finally:
        conn.close()


# ─── Product trips / professional-route access ──────────────
def _trip_owner(conn, trip_id: str, user, anon_id) -> dict:
    row = conn.execute(
        "SELECT * FROM product_trips WHERE id=?", (trip_id,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Trip not found")
    trip = dict(row)
    if user and trip.get("user_id") == user["sub"]:
        return trip
    if anon_id and trip.get("anon_id") == anon_id and not trip.get("user_id"):
        if user:
            conn.execute(
                "UPDATE product_trips SET user_id=?,anon_id=NULL,updated_at=? WHERE id=? AND user_id IS NULL",
                (user["sub"], int(time.time()), trip_id),
            )
            conn.commit()
            trip["user_id"] = user["sub"]
            trip["anon_id"] = None
        return trip
    if user:
        db_user = _db_user(conn, user)
        if db_user.get("role") == "admin":
            return trip
    raise HTTPException(403, "This trip belongs to another account")


def _lock_professional_route_transaction(conn, trip_id: str, user_id: str = "") -> None:
    """Serialize entitlement writes without changing or exposing user data."""
    is_postgres = backend_name() == "postgres"
    if not is_postgres:
        conn.execute("BEGIN IMMEDIATE")
    lock_suffix = " FOR UPDATE" if is_postgres else ""
    if user_id:
        user_row = conn.execute(
            f"SELECT id FROM users WHERE id=?{lock_suffix}", (user_id,)
        ).fetchone()
        if not user_row:
            raise HTTPException(404, "User not found")
    conn.execute(
        f"SELECT id FROM product_trips WHERE id=?{lock_suffix}", (trip_id,)
    ).fetchone()


_BALI_DATA_PATH = Path(__file__).resolve().parents[2] / "wandermind-studio" / "frontend" / "assets" / "data" / "bali-travel-data.json"
_BALI_DATA_CACHE = None
PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT = int(os.getenv("PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT", "3"))


def _bali_data() -> dict:
    global _BALI_DATA_CACHE
    if _BALI_DATA_CACHE is None:
        try:
            _BALI_DATA_CACHE = json.loads(_BALI_DATA_PATH.read_text(encoding="utf-8"))
        except Exception:
            _BALI_DATA_CACHE = {"regions": [], "routes": [], "pois": []}
    return _BALI_DATA_CACHE


def _normalise_trip_profile(profile: dict) -> dict:
    source = profile if isinstance(profile, dict) else {}
    goals = source.get("goals") or source.get("goal") or []
    if isinstance(goals, str):
        goals = [goals]
    try:
        days = int(source.get("days") or 0)
    except (TypeError, ValueError):
        days = 0
    if days <= 0:
        start = source.get("departure_date") or source.get("start")
        end = source.get("return_date") or source.get("end")
        try:
            days = max(1, (datetime.fromisoformat(end) - datetime.fromisoformat(start)).days)
        except (TypeError, ValueError):
            days = 5
    return {
        "audience": str(source.get("audience") or "first"),
        "goals": [str(goal) for goal in goals if str(goal).strip()],
        "travel_style": str(source.get("travel_style") or source.get("style") or "comfort"),
        "travellers": int(source.get("travellers") or source.get("people") or 2),
        "departure_date": str(source.get("departure_date") or source.get("start") or ""),
        "return_date": str(source.get("return_date") or source.get("end") or ""),
        "days": min(21, max(1, days)),
        "currency": str(source.get("currency") or "CNY"),
        "budget_range": source.get("budget_range") if source.get("budget_range") is not None else source.get("budget", ""),
        "pace": str(source.get("pace") or "balanced"),
        "origin_region": str(source.get("origin_region") or ""),
    }


def _route_score(route: dict, profile: dict) -> int:
    goals = set(profile.get("goals") or [])
    score = 0
    intent_map = {
        "first": "first_visit",
        "returning": "deep_experience",
        "easy": "slow_wellness",
        "local": "local_culture",
        "photo": "photography",
        "value": "budget_control",
    }
    if route.get("primary_intent") == intent_map.get(profile.get("audience")):
        score += 5
    route_tags = set(route.get("secondary_tags") or [])
    goal_tags = {
        "local": {"culture", "local", "village"},
        "photo": {"scenery", "nature", "coast", "sunset"},
        "easy": {"quiet", "wellness", "balanced"},
        "value": {"value", "budget"},
    }
    for goal in goals:
        score += len(route_tags & goal_tags.get(goal, set()))
    if profile.get("pace") == route.get("pace"):
        score += 2
    if profile.get("travel_style") in (route.get("budget_level") or []):
        score += 2
    if profile.get("days", 5) >= (route.get("recommended_days") or {}).get("min", 1):
        score += 1
    return score


def _localized(value, lang: str, fallback: str = "") -> str:
    if isinstance(value, dict):
        return str(value.get(lang) or value.get("en") or value.get("zh") or fallback)
    return str(value or fallback)


def _professional_route_document(profile: dict, route_id: str = "", lang: str = "en") -> dict:
    data = _bali_data()
    routes = data.get("routes") or []
    regions = {item.get("id"): item for item in data.get("regions") or []}
    pois = data.get("pois") or []
    route = next((item for item in routes if item.get("id") == route_id), None)
    if route is None:
        route = max(routes, key=lambda item: _route_score(item, profile), default={})
    if not route:
        raise HTTPException(503, "Bali route data is unavailable")
    days = int(profile.get("days") or 5)
    preview_days = days if days <= 1 else min(days - 1, max(1, math.ceil(days * 0.7)))
    outline = route.get("free_outline") or []
    region_ids = list(route.get("base_regions") or []) + list(route.get("optional_regions") or [])
    if not region_ids:
        region_ids = list(regions)
    full_days = []
    for index in range(days):
        outline_item = outline[index] if index < len(outline) else {}
        region_id = outline_item.get("region_id") or region_ids[index % len(region_ids)]
        region = regions.get(region_id, {})
        region_name = _localized(region.get("name"), lang, region_id)
        theme = _localized(outline_item.get("theme"), lang)
        if not theme:
            experiences = route.get("core_experiences") or ["Bali experience"]
            theme = f"{region_name} · {experiences[index % len(experiences)].replace('_', ' ')}"
        route_pois = [
            poi for poi in pois
            if poi.get("region_id") == region_id
            and route.get("id") in (poi.get("route_ids") or [])
            and poi.get("verification_status") == "verified"
        ][:3]
        full_days.append({
            "day": index + 1,
            "region_id": region_id,
            "region_name": region_name,
            "theme": theme,
            "places": [
                {
                    "id": poi.get("id", ""),
                    "name": poi.get("name", ""),
                    "type": poi.get("type", ""),
                    "verification_status": poi.get("verification_status", "pending_review"),
                }
                for poi in route_pois
            ],
            "experience_tags": list(route.get("secondary_tags") or [])[:4],
            "route_note": "Structured route layer; access, timing and availability still require confirmation.",
        })
    reasons = {
        "zh": "根据你的天数、同行者、旅行目标、预算和节奏，从 Bali 的 G1–G7 区域事实与 R1–R6 路线家族中匹配。",
        "en": "Matched from Bali's G1–G7 geography and R1–R6 route families using your dates, group, goals, budget and pace.",
        "ja": "日数、同行者、目的、予算、ペースをもとに、Bali の G1–G7 地理と R1–R6 ルートから提案しています。",
        "ko": "여행 기간, 동행자, 목표, 예산과 속도를 바탕으로 Bali G1–G7 지리와 R1–R6 경로를 매칭했습니다.",
        "id": "Rute ini dicocokkan dari geografi Bali G1–G7 dan keluarga rute R1–R6 berdasarkan tanggal, rombongan, tujuan, anggaran, dan tempo Anda.",
    }
    return {
        "route_id": route.get("id"),
        "route_name": _localized(route.get("name"), lang, route.get("id", "Bali route")),
        "route_promise": _localized(route.get("promise"), lang),
        "recommendation_reason": reasons.get(lang, reasons["en"]),
        "days": days,
        "preview_days": preview_days,
        "locked_days": max(0, days - preview_days),
        "full_days": full_days,
        "profile": profile,
    }


def _public_professional_route(document: dict, unlocked: bool, lang: str) -> dict:
    result = {key: value for key, value in document.items() if key not in {"full_days", "profile"}}
    visible_days = []
    for index, day in enumerate(document.get("full_days") or []):
        if unlocked or index < int(document.get("preview_days") or 0):
            visible_days.append({**day, "locked": False})
        else:
            visible_days.append({
                "day": day.get("day"),
                "region_id": day.get("region_id"),
                "region_name": day.get("region_name"),
                "theme": day.get("theme"),
                "locked": True,
                "lock_reason": {
                    "zh": "完成预览。解锁后查看地点顺序、体验模块和执行备注。",
                    "en": "Preview shown. Unlock to see places, experience modules and execution notes.",
                    "ja": "プレビューです。解放すると場所、体験モジュール、実行メモを確認できます。",
                    "ko": "미리보기입니다. 잠금 해제 후 장소, 체험 모듈과 실행 메모를 볼 수 있습니다.",
                    "id": "Ini adalah pratinjau. Buka kunci untuk melihat tempat, modul pengalaman, dan catatan pelaksanaan.",
                }.get(lang, "Preview shown. Unlock to see the complete details."),
            })
    result["days_plan"] = visible_days
    result["unlocked"] = bool(unlocked)
    return result


def _professional_route_unlocked(conn, trip: dict) -> bool:
    if int(trip.get("professional_route_entitlement") or 0):
        return True
    return bool(conn.execute(
        """SELECT 1 FROM professional_route_orders
           WHERE trip_id=? AND status='confirmed' LIMIT 1""",
        (trip["id"],),
    ).fetchone())


def _professional_adjustment_limit(conn, trip: dict, unlocked: bool) -> int:
    stored_limit = int(trip.get("professional_adjustment_limit") or 0)
    if stored_limit > 0:
        return stored_limit
    # A confirmed order created before this per-trip field existed was sold under
    # the former 10-adjustment promise. Preserve that entitlement; newly
    # confirmed payment and points unlocks persist the current limit below.
    if unlocked and conn.execute(
        """SELECT 1 FROM professional_route_orders
           WHERE trip_id=? AND status='confirmed' LIMIT 1""",
        (trip["id"],),
    ).fetchone():
        return 10
    return PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT


def _trip_allowance(conn, trip: dict, user) -> dict:
    is_admin = bool(user and _db_user(conn, user).get("role") == "admin")
    rough_used = int(trip.get("rough_used") or 0)
    adjustments_used = int(trip.get("adjustments_used") or 0)
    professional_used = int(trip.get("professional_used") or 0)
    professional_adjustments_used = int(trip.get("professional_adjustments_used") or 0)
    unlocked = _professional_route_unlocked(conn, trip)
    professional_adjustment_limit = _professional_adjustment_limit(conn, trip, unlocked)
    professional_entitlement = unlocked or is_admin
    ai_plan_remaining = 1 if is_admin else max(0, 1 - rough_used)
    ai_adjustments_remaining = 2 if is_admin else max(0, 2 - adjustments_used)
    professional_adjustments_remaining = professional_adjustment_limit if is_admin else (
        max(0, professional_adjustment_limit - professional_adjustments_used)
        if professional_entitlement else 0
    )
    professional_route_remaining = 1 if is_admin else (
        max(0, 1 - professional_used) if professional_entitlement else 0
    )
    return {
        "trip_id": trip["id"],
        "rough_route": {"used": rough_used, "limit": 1, "remaining": ai_plan_remaining},
        "adjustments": {"used": adjustments_used, "limit": 2, "remaining": ai_adjustments_remaining},
        "ai_plan_generations_remaining": ai_plan_remaining,
        "ai_adjustments_remaining": ai_adjustments_remaining,
        "professional_route": {
            "used": professional_used,
            "limit": 1,
            "remaining": professional_route_remaining,
        },
        "professional_route_entitlement": bool(professional_entitlement),
        "professional_route_unlocked": bool(professional_entitlement),
        "professional_adjustments_used": professional_adjustments_used,
        "professional_adjustments_remaining": professional_adjustments_remaining,
        "professional_adjustment_limit": professional_adjustment_limit,
        "admin_unlimited": is_admin,
    }


def _resolve_trip_action(allowance: dict, action: str) -> str:
    action = (action or "").strip().lower()
    if action not in {"rough_route", "adjustment", "professional_route"}:
        raise HTTPException(400, "trip_action must be rough_route, adjustment, or professional_route")
    return action


def _consume_trip_action(conn, trip: dict, user, action: str) -> dict:
    allowance = _trip_allowance(conn, trip, user)
    action = _resolve_trip_action(allowance, action)
    if allowance["admin_unlimited"]:
        allowance["consumed_action"] = action
        return allowance
    if action == "professional_route" and not allowance["professional_route_entitlement"]:
        raise HTTPException(
            402,
            detail={
                "error": "professional_route_unlock_required",
                "action": action,
                "payment_reason": "professional_route_unlock",
                "professional_route_price": {"amount": 9.9, "currency": "CNY"},
            },
        )
    quota_key = {
        "rough_route": "rough_route",
        "adjustment": "adjustments",
        "professional_route": "professional_route",
    }[action]
    if allowance[quota_key]["remaining"] <= 0:
        error = "ai_usage_exhausted" if action in {"rough_route", "adjustment"} else "professional_route_usage_exhausted"
        raise HTTPException(
            402,
            detail={
                "error": error,
                "action": action,
                "payment_reason": "ai_usage_exhausted" if action in {"rough_route", "adjustment"} else "professional_route_adjustment",
                "professional_route_price": {"amount": 9.9, "currency": "CNY"},
            },
        )
    column = {
        "rough_route": "rough_used",
        "adjustment": "adjustments_used",
        "professional_route": "professional_used",
    }[action]
    consumed = conn.execute(
        f"""UPDATE product_trips
            SET {column}=COALESCE({column},0)+1,updated_at=?
            WHERE id=? AND COALESCE({column},0)<?
            RETURNING {column}""",
        (int(time.time()), trip["id"], allowance[quota_key]["limit"]),
    ).fetchone()
    if not consumed:
        conn.rollback()
        is_ai_action = action in {"rough_route", "adjustment"}
        error = (
            "ai_usage_exhausted"
            if is_ai_action
            else "professional_route_usage_exhausted"
        )
        raise HTTPException(
            402,
            detail={
                "error": error,
                "action": action,
                "payment_reason": (
                    "ai_usage_exhausted"
                    if is_ai_action
                    else "professional_route_adjustment"
                ),
                "professional_route_price": {"amount": 9.9, "currency": "CNY"},
            },
        )
    conn.commit()
    refreshed = dict(conn.execute("SELECT * FROM product_trips WHERE id=?", (trip["id"],)).fetchone())
    result = _trip_allowance(conn, refreshed, user)
    result["consumed_action"] = action
    return result


@app.post("/api/product-trips")
async def create_product_trip(
    data: ProductTripCreateReq,
    user=Depends(optional_user),
    anon_id=Depends(anon_id_header),
):
    if not user and not anon_id:
        raise HTTPException(400, "A signed-in account or anonymous session id is required")
    destination = (data.destination or "bali").strip().lower()[:80] or "bali"
    now = int(time.time())
    trip_id = str(uuid.uuid4())
    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO product_trips
               (id,user_id,anon_id,destination,brief,rough_used,adjustments_used,professional_used,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                trip_id, user["sub"] if user else None, None if user else anon_id,
                destination, json.dumps(data.brief or {}, ensure_ascii=False),
                0, 0, 0, now, now,
            ),
        )
        conn.commit()
        trip = dict(conn.execute(
            "SELECT * FROM product_trips WHERE id=?", (trip_id,)
        ).fetchone())
        return {"ok": True, **_trip_allowance(conn, trip, user)}
    finally:
        conn.close()


def _stored_trip_profile(trip: dict) -> dict:
    try:
        brief = json.loads(trip.get("brief") or "{}")
    except (TypeError, ValueError):
        brief = {}
    return _normalise_trip_profile(brief.get("trip_profile") or brief)


def _stored_trip_route_id(trip: dict) -> str:
    try:
        brief = json.loads(trip.get("brief") or "{}")
    except (TypeError, ValueError):
        brief = {}
    return str(brief.get("route_id") or "").strip().upper()


def _professional_route_response(conn, trip: dict, user, document: dict, lang: str) -> dict:
    allowance = _trip_allowance(conn, trip, user)
    return {
        "ok": True,
        "route": _public_professional_route(
            document,
            bool(allowance.get("professional_route_entitlement")),
            lang,
        ),
        "profile": document.get("profile") or {},
        **allowance,
    }


@app.post("/api/bali/professional-route")
async def create_bali_professional_route(
    data: ProfessionalRouteReq,
    user=Depends(optional_user),
    anon_id=Depends(anon_id_header),
):
    if not user and not anon_id:
        raise HTTPException(400, "A signed-in account or anonymous session id is required")
    profile = _normalise_trip_profile(data.trip_profile)
    route_id = (data.route_id or "").strip().upper()
    lang = (data.lang or "en").strip().lower()
    conn = get_db()
    try:
        if data.trip_id:
            trip = _trip_owner(conn, data.trip_id, user, anon_id)
        else:
            trip_id = str(uuid.uuid4())
            now = int(time.time())
            brief = {"trip_profile": profile, "route_id": route_id}
            conn.execute(
                """INSERT INTO product_trips
                   (id,user_id,anon_id,destination,brief,rough_used,adjustments_used,professional_used,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    trip_id, user["sub"] if user else None, None if user else anon_id,
                    "bali", json.dumps(brief, ensure_ascii=False), 0, 0, 0, now, now,
                ),
            )
            conn.commit()
            trip = dict(conn.execute("SELECT * FROM product_trips WHERE id=?", (trip_id,)).fetchone())
        unlocked = _professional_route_unlocked(conn, trip) or bool(user and _db_user(conn, user).get("role") == "admin")
        if unlocked:
            stored_profile = _stored_trip_profile(trip)
            stored_route_id = _stored_trip_route_id(trip)
            if profile != stored_profile or (
                route_id and stored_route_id and route_id != stored_route_id
            ):
                raise HTTPException(
                    409,
                    detail={"error": "professional_route_adjustment_required"},
                )
            profile = stored_profile
            route_id = stored_route_id or route_id
        document = _professional_route_document(profile, route_id, lang)
        try:
            brief = json.loads(trip.get("brief") or "{}")
        except (TypeError, ValueError):
            brief = {}
        brief["trip_profile"] = profile
        brief["route_id"] = document["route_id"]
        payload = json.dumps(document, ensure_ascii=False)
        conn.execute(
            """UPDATE product_trips
               SET brief=?,professional_route_payload=?,updated_at=?
               WHERE id=?""",
            (json.dumps(brief, ensure_ascii=False), payload, int(time.time()), trip["id"]),
        )
        conn.commit()
        trip = dict(conn.execute("SELECT * FROM product_trips WHERE id=?", (trip["id"],)).fetchone())
        return _professional_route_response(conn, trip, user, document, lang)
    finally:
        conn.close()


@app.post("/api/bali/professional-route/{trip_id}/adjust")
async def adjust_bali_professional_route(
    trip_id: str,
    data: ProfessionalRouteAdjustReq,
    user=Depends(current_user),
    anon_id=Depends(anon_id_header),
):
    profile = _normalise_trip_profile(data.trip_profile)
    route_id = (data.route_id or "").strip().upper()
    lang = (data.lang or "en").strip().lower()
    conn = get_db()
    try:
        trip = _trip_owner(conn, trip_id, user, anon_id)
        _lock_professional_route_transaction(conn, trip_id, user["sub"])
        trip = _trip_owner(conn, trip_id, user, anon_id)
        allowance = _trip_allowance(conn, trip, user)
        if not allowance["professional_route_entitlement"]:
            raise HTTPException(402, detail={"error": "professional_route_unlock_required"})
        if not allowance["admin_unlimited"] and allowance["professional_adjustments_remaining"] <= 0:
            raise HTTPException(
                402,
                detail={
                    "error": "professional_route_adjustments_exhausted",
                    "payment_reason": "professional_route_adjustment",
                    "limit": allowance["professional_adjustment_limit"],
                },
            )
        if not data.trip_profile:
            profile = _stored_trip_profile(trip)
        document = _professional_route_document(profile, route_id, lang)
        try:
            brief = json.loads(trip.get("brief") or "{}")
        except (TypeError, ValueError):
            brief = {}
        brief["trip_profile"] = profile
        brief["route_id"] = document["route_id"]
        if allowance["admin_unlimited"]:
            updated = conn.execute(
                """UPDATE product_trips
                   SET brief=?,professional_route_payload=?,updated_at=?
                   WHERE id=?
                   RETURNING professional_adjustments_used""",
                (
                    json.dumps(brief, ensure_ascii=False),
                    json.dumps(document, ensure_ascii=False),
                    int(time.time()), trip_id,
                ),
            ).fetchone()
        else:
            updated = conn.execute(
                """UPDATE product_trips
                   SET brief=?,professional_route_payload=?,
                       professional_adjustments_used=COALESCE(professional_adjustments_used,0)+1,
                       updated_at=?
                   WHERE id=? AND COALESCE(professional_adjustments_used,0)<?
                   RETURNING professional_adjustments_used""",
                (
                    json.dumps(brief, ensure_ascii=False),
                    json.dumps(document, ensure_ascii=False),
                    int(time.time()), trip_id,
                    allowance["professional_adjustment_limit"],
                ),
            ).fetchone()
        if not updated:
            conn.rollback()
            raise HTTPException(
                402,
                detail={
                    "error": "professional_route_adjustments_exhausted",
                    "payment_reason": "professional_route_adjustment",
                    "limit": allowance["professional_adjustment_limit"],
                },
            )
        conn.commit()
        refreshed = dict(conn.execute("SELECT * FROM product_trips WHERE id=?", (trip_id,)).fetchone())
        return _professional_route_response(conn, refreshed, user, document, lang)
    finally:
        conn.close()


@app.get("/api/product-trips/{trip_id}/allowance")
async def product_trip_allowance(
    trip_id: str,
    user=Depends(optional_user),
    anon_id=Depends(anon_id_header),
):
    conn = get_db()
    try:
        trip = _trip_owner(conn, trip_id, user, anon_id)
        return _trip_allowance(conn, trip, user)
    finally:
        conn.close()


@app.post("/api/product-trips/{trip_id}/consume")
async def consume_product_trip_allowance(
    trip_id: str,
    data: ProductTripUseReq,
    user=Depends(optional_user),
    anon_id=Depends(anon_id_header),
):
    action = (data.action or "").strip().lower()
    if action not in {"rough_route", "adjustment", "professional_route"}:
        raise HTTPException(
            400, "action must be rough_route, adjustment, or professional_route"
        )
    conn = get_db()
    try:
        trip = _trip_owner(conn, trip_id, user, anon_id)
        return {"ok": True, **_consume_trip_action(conn, trip, user, action)}
    finally:
        conn.close()


def _paypal_error(error: Exception) -> HTTPException:
    if isinstance(error, paypal_service.PayPalError):
        return HTTPException(error.status_code, detail={"error": error.code})
    return HTTPException(502, detail={"error": "paypal_unavailable"})


def _paypal_capture_details(payload: dict) -> dict:
    captures = []
    for unit in payload.get("purchase_units") or []:
        custom_id = str(unit.get("custom_id") or "")
        for capture in ((unit.get("payments") or {}).get("captures") or []):
            if capture.get("status") == "COMPLETED":
                amount = capture.get("amount") or {}
                captures.append({
                    "capture_id": str(capture.get("id") or ""),
                    "currency": str(amount.get("currency_code") or "").upper(),
                    "value": str(amount.get("value") or ""),
                    "custom_id": custom_id,
                })
    if len(captures) != 1 or not captures[0]["capture_id"]:
        raise HTTPException(409, detail={"error": "paypal_capture_incomplete"})
    return captures[0]


def _paypal_capture_matches(order: dict, capture: dict) -> bool:
    try:
        amount_cents = int(
            Decimal(str(capture["value"])).quantize(Decimal("0.01")) * 100
        )
    except (InvalidOperation, TypeError, ValueError):
        return False
    return (
        amount_cents == int(order["amount_cents"])
        and capture["currency"] == str(order["currency"]).upper()
        and (not capture["custom_id"] or capture["custom_id"] == order["id"])
    )


def _confirm_paypal_order(
    conn, order: dict, capture_id: str, provider_status: str, *, lock_transaction: bool = True
) -> dict:
    if lock_transaction:
        _lock_professional_route_transaction(conn, order["trip_id"], order["user_id"])
    current_row = conn.execute(
        "SELECT * FROM professional_route_orders WHERE id=?", (order["id"],)
    ).fetchone()
    if not current_row:
        raise HTTPException(404, "Order not found")
    current = dict(current_row)
    if current["status"] == "confirmed":
        if current.get("provider_capture_id") not in {None, "", capture_id}:
            raise HTTPException(409, detail={"error": "paypal_capture_conflict"})
        return current
    if current["status"] != "pending" or current.get("payment_method") != "paypal":
        raise HTTPException(409, detail={"error": "paypal_order_not_payable"})
    now = int(time.time())
    conn.execute(
        """UPDATE professional_route_orders
           SET status='confirmed',payment_reference=?,provider_capture_id=?,
               provider_status=?,updated_at=?,confirmed_at=?,confirmed_by='paypal'
           WHERE id=? AND status='pending' AND payment_method='paypal'""",
        (
            "paypal:" + capture_id,
            capture_id,
            provider_status[:40],
            now,
            now,
            current["id"],
        ),
    )
    conn.execute(
        """UPDATE product_trips
           SET professional_route_entitlement=1,professional_adjustment_limit=?,updated_at=?
           WHERE id=?""",
        (PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT, now, current["trip_id"]),
    )
    conn.execute(
        """UPDATE professional_route_orders
           SET status='cancelled',provider_status='SUPERSEDED',updated_at=?
           WHERE trip_id=? AND id<>? AND status='pending'""",
        (now, current["trip_id"], current["id"]),
    )
    return dict(
        conn.execute(
            "SELECT * FROM professional_route_orders WHERE id=?", (current["id"],)
        ).fetchone()
    )


@app.get("/api/paypal/config")
async def paypal_public_config():
    try:
        config = paypal_service.settings()
    except paypal_service.PayPalError:
        return {"enabled": False}
    return {
        "enabled": config["enabled"],
        "environment": config["environment"] if config["enabled"] else "",
        "client_id": config["client_id"] if config["enabled"] else "",
        "currency": config["currency"],
        "amount": config["amount_text"],
    }


@app.post("/api/paypal/orders")
async def create_paypal_order(
    data: PayPalOrderReq,
    user=Depends(current_user),
    anon_id=Depends(anon_id_header),
):
    try:
        config = paypal_service.settings(require_enabled=True)
    except Exception as error:
        raise _paypal_error(error)
    conn = get_db()
    try:
        trip = _trip_owner(conn, data.trip_id, user, anon_id)
        _lock_professional_route_transaction(conn, data.trip_id, user["sub"])
        trip = _trip_owner(conn, data.trip_id, user, anon_id)
        allowance = _trip_allowance(conn, trip, user)
        if allowance["professional_route_unlocked"]:
            return {"ok": True, "already_unlocked": True, **allowance}
        existing_row = conn.execute(
            """SELECT * FROM professional_route_orders
               WHERE trip_id=? AND user_id=? AND payment_method='paypal'
                 AND status='pending'
               ORDER BY created_at DESC LIMIT 1""",
            (data.trip_id, user["sub"]),
        ).fetchone()
        now = int(time.time())
        if existing_row:
            order = dict(existing_row)
            if (
                int(order["amount_cents"]) != config["amount_cents"]
                or str(order["currency"]).upper() != config["currency"]
            ):
                conn.execute(
                    "UPDATE professional_route_orders SET status='cancelled',updated_at=? WHERE id=?",
                    (now, order["id"]),
                )
                existing_row = None
        if not existing_row:
            order = {
                "id": str(uuid.uuid4()),
                "trip_id": data.trip_id,
                "user_id": user["sub"],
                "amount_cents": config["amount_cents"],
                "currency": config["currency"],
                "status": "pending",
                "payment_method": "paypal",
                "provider_order_id": "",
                "created_at": now,
            }
            conn.execute(
                """INSERT INTO professional_route_orders
                   (id,trip_id,user_id,amount_cents,currency,status,payment_method,
                    provider_status,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    order["id"], order["trip_id"], order["user_id"],
                    order["amount_cents"], order["currency"], order["status"],
                    order["payment_method"], "CREATING", now, now,
                ),
            )
        conn.commit()
        if order.get("provider_order_id"):
            return {
                "ok": True,
                "provider_order_id": order["provider_order_id"],
                "amount": config["amount_text"],
                "currency": config["currency"],
                "environment": config["environment"],
            }
        provider = await paypal_service.create_order(config, order["id"])
        provider_id = str(provider.get("id") or "")
        provider_status = str(provider.get("status") or "")
        if not provider_id or provider_status not in {"CREATED", "APPROVED"}:
            raise HTTPException(502, detail={"error": "paypal_response_invalid"})
        conn.execute(
            """UPDATE professional_route_orders
               SET provider_order_id=?,provider_status=?,updated_at=?
               WHERE id=? AND status='pending'""",
            (provider_id, provider_status, int(time.time()), order["id"]),
        )
        conn.commit()
        return {
            "ok": True,
            "provider_order_id": provider_id,
            "amount": config["amount_text"],
            "currency": config["currency"],
            "environment": config["environment"],
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as error:
        conn.rollback()
        raise _paypal_error(error)
    finally:
        conn.close()


@app.post("/api/paypal/orders/{provider_order_id}/capture")
async def capture_paypal_order(
    provider_order_id: str,
    user=Depends(current_user),
):
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", provider_order_id):
        raise HTTPException(400, detail={"error": "paypal_order_id_invalid"})
    try:
        config = paypal_service.settings(require_enabled=True)
    except Exception as error:
        raise _paypal_error(error)
    conn = get_db()
    try:
        row = conn.execute(
            """SELECT * FROM professional_route_orders
               WHERE provider_order_id=? AND user_id=? AND payment_method='paypal'""",
            (provider_order_id, user["sub"]),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Order not found")
        order = dict(row)
        if order["status"] == "confirmed":
            trip = _trip_owner(conn, order["trip_id"], user, None)
            return {"ok": True, "already_captured": True, **_trip_allowance(conn, trip, user)}
        if order["status"] != "pending":
            raise HTTPException(409, detail={"error": "paypal_order_not_payable"})
        trip = _trip_owner(conn, order["trip_id"], user, None)
        if _trip_allowance(conn, trip, user)["professional_route_unlocked"]:
            conn.execute(
                "UPDATE professional_route_orders SET status='cancelled',provider_status='SUPERSEDED',updated_at=? WHERE id=?",
                (int(time.time()), order["id"]),
            )
            conn.commit()
            raise HTTPException(409, detail={"error": "professional_route_already_unlocked"})
        payload = await paypal_service.capture_order(config, provider_order_id, order["id"])
        if str(payload.get("id") or "") != provider_order_id or payload.get("status") != "COMPLETED":
            raise HTTPException(409, detail={"error": "paypal_capture_incomplete"})
        capture = _paypal_capture_details(payload)
        if not _paypal_capture_matches(order, capture):
            raise HTTPException(409, detail={"error": "paypal_capture_mismatch"})
        _confirm_paypal_order(conn, order, capture["capture_id"], "COMPLETED")
        conn.commit()
        trip = _trip_owner(conn, order["trip_id"], user, None)
        return {"ok": True, "capture_id": capture["capture_id"], **_trip_allowance(conn, trip, user)}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as error:
        conn.rollback()
        raise _paypal_error(error)
    finally:
        conn.close()


@app.post("/api/paypal/webhook")
async def paypal_webhook(request: Request):
    if int(request.headers.get("content-length") or 0) > 262144:
        raise HTTPException(413, "Webhook payload too large")
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid webhook payload")
    if not isinstance(event, dict):
        raise HTTPException(400, "Invalid webhook payload")
    try:
        config = paypal_service.settings(require_enabled=True)
        verified = await paypal_service.verify_webhook(
            config, {key.lower(): value for key, value in request.headers.items()}, event
        )
    except Exception as error:
        raise _paypal_error(error)
    if not verified:
        raise HTTPException(400, detail={"error": "paypal_webhook_invalid"})
    event_id = str(event.get("id") or "")[:120]
    event_type = str(event.get("event_type") or "")[:120]
    if not event_id or not event_type:
        raise HTTPException(400, "Invalid webhook event")
    now = int(time.time())
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT status FROM payment_webhook_events WHERE event_id=?", (event_id,)
        ).fetchone()
        if existing:
            return {"ok": True, "duplicate": True}
        resource = event.get("resource") or {}
        related = (resource.get("supplementary_data") or {}).get("related_ids") or {}
        provider_order_id = str(related.get("order_id") or "")
        order_row = None
        if provider_order_id:
            order_row = conn.execute(
                "SELECT * FROM professional_route_orders WHERE provider_order_id=?",
                (provider_order_id,),
            ).fetchone()
        if event_type == "PAYMENT.CAPTURE.COMPLETED" and order_row:
            order_for_lock = dict(order_row)
            _lock_professional_route_transaction(
                conn, order_for_lock["trip_id"], order_for_lock["user_id"]
            )
            order_row = conn.execute(
                "SELECT * FROM professional_route_orders WHERE provider_order_id=?",
                (provider_order_id,),
            ).fetchone()
        conn.execute(
            """INSERT INTO payment_webhook_events
               (event_id,event_type,provider,status,received_at)
               VALUES (?,?,?,'received',?)""",
            (event_id, event_type, "paypal", now),
        )
        if event_type == "PAYMENT.CAPTURE.COMPLETED" and order_row:
            order = dict(order_row)
            amount = resource.get("amount") or {}
            capture = {
                "capture_id": str(resource.get("id") or ""),
                "currency": str(amount.get("currency_code") or "").upper(),
                "value": str(amount.get("value") or ""),
                "custom_id": str(resource.get("custom_id") or ""),
            }
            if resource.get("status") != "COMPLETED" or not _paypal_capture_matches(order, capture):
                raise HTTPException(409, detail={"error": "paypal_capture_mismatch"})
            if order["status"] == "cancelled":
                conn.execute(
                    """UPDATE professional_route_orders
                       SET status='refund_review',provider_capture_id=?,provider_status='COMPLETED',
                           payment_reference=?,updated_at=? WHERE id=?""",
                    (
                        capture["capture_id"], "paypal:" + capture["capture_id"],
                        now, order["id"],
                    ),
                )
            else:
                _confirm_paypal_order(
                    conn, order, capture["capture_id"], "COMPLETED",
                    lock_transaction=False,
                )
        elif event_type in {"PAYMENT.CAPTURE.DENIED", "CHECKOUT.PAYMENT-APPROVAL.REVERSED"} and order_row:
            order = dict(order_row)
            if order["status"] == "pending":
                conn.execute(
                    "UPDATE professional_route_orders SET status='failed',provider_status=?,updated_at=? WHERE id=?",
                    (event_type[:40], now, order["id"]),
                )
        elif event_type in {"PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"}:
            capture_id = str(related.get("capture_id") or resource.get("invoice_id") or "")
            if capture_id:
                refund_row = conn.execute(
                    "SELECT * FROM professional_route_orders WHERE provider_capture_id=?",
                    (capture_id,),
                ).fetchone()
                if refund_row:
                    conn.execute(
                        """UPDATE professional_route_orders
                           SET status='refund_review',provider_status=?,updated_at=?,refunded_at=?
                           WHERE id=?""",
                        (event_type[:40], now, now, dict(refund_row)["id"]),
                    )
        conn.execute(
            "UPDATE payment_webhook_events SET status='processed',processed_at=? WHERE event_id=?",
            (int(time.time()), event_id),
        )
        conn.commit()
        return {"ok": True}
    except HTTPException:
        conn.rollback()
        raise
    except IntegrityError:
        conn.rollback()
        return {"ok": True, "duplicate": True}
    finally:
        conn.close()


@app.post("/api/professional-route/orders")
async def create_professional_route_order(
    data: ProRouteOrderReq,
    user=Depends(current_user),
    anon_id=Depends(anon_id_header),
):
    conn = get_db()
    try:
        trip = _trip_owner(conn, data.trip_id, user, anon_id)
        _lock_professional_route_transaction(conn, data.trip_id, user["sub"])
        trip = _trip_owner(conn, data.trip_id, user, anon_id)
        allowance = _trip_allowance(conn, trip, user)
        if allowance["professional_route_unlocked"]:
            return {"ok": True, "already_unlocked": True, **allowance}
        existing = conn.execute(
            """SELECT * FROM professional_route_orders
               WHERE trip_id=? AND user_id=? AND status='pending'
                 AND payment_method='manual_qr'
               ORDER BY created_at DESC LIMIT 1""",
            (data.trip_id, user["sub"]),
        ).fetchone()
        if existing:
            order = dict(existing)
        else:
            order = {
                "id": str(uuid.uuid4()),
                "trip_id": data.trip_id,
                "user_id": user["sub"],
                "amount_cents": 990,
                "currency": "CNY",
                "status": "pending",
                "payment_method": "manual_qr",
                "created_at": int(time.time()),
            }
            conn.execute(
                """INSERT INTO professional_route_orders
                   (id,trip_id,user_id,amount_cents,currency,status,payment_method,
                    created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    order["id"], order["trip_id"], order["user_id"],
                    order["amount_cents"], order["currency"], order["status"],
                    order["payment_method"], order["created_at"], order["created_at"],
                ),
            )
            conn.commit()
        return {
            "ok": True,
            "order": {
                "id": order["id"],
                "trip_id": order["trip_id"],
                "status": order["status"],
                "amount": order["amount_cents"] / 100,
                "currency": order["currency"],
                "payment_method": "manual_qr",
            },
        }
    finally:
        conn.close()


@app.get("/api/admin/professional-route/orders")
async def list_professional_route_orders(
    status: str = "pending",
    admin=Depends(current_admin),
):
    normalized_status = (status or "pending").strip().lower()
    if normalized_status not in {"pending", "confirmed"}:
        raise HTTPException(400, "status must be pending or confirmed")
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT o.id,o.trip_id,o.amount_cents,o.currency,o.status,
                      o.payment_method,o.provider_status,o.payment_reference,
                      o.created_at,o.confirmed_at,
                      u.email,u.name,t.destination,t.brief
               FROM professional_route_orders o
               JOIN users u ON u.id=o.user_id
               JOIN product_trips t ON t.id=o.trip_id
               WHERE o.status=?
               ORDER BY o.created_at DESC
               LIMIT 100""",
            (normalized_status,),
        ).fetchall()
        return {
            "orders": [
                {
                    **dict(row),
                    "amount": int(dict(row)["amount_cents"]) / 100,
                }
                for row in rows
            ]
        }
    finally:
        conn.close()


@app.post("/api/admin/professional-route/orders/{order_id}/confirm")
async def confirm_professional_route_order(
    order_id: str,
    data: ProRouteConfirmReq,
    admin=Depends(current_admin),
):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM professional_route_orders WHERE id=?", (order_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Order not found")
        order = dict(row)
        _lock_professional_route_transaction(conn, order["trip_id"], order["user_id"])
        row = conn.execute(
            "SELECT * FROM professional_route_orders WHERE id=?", (order_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Order not found")
        order = dict(row)
        if order["status"] == "confirmed":
            return {"ok": True, "already_confirmed": True, "order_id": order_id}
        if order["status"] != "pending":
            raise HTTPException(409, "Only pending orders can be confirmed")
        if order.get("payment_method") != "manual_qr":
            raise HTTPException(409, "Only manual QR orders can be confirmed by an admin")
        now = int(time.time())
        conn.execute(
            """UPDATE professional_route_orders
               SET status='confirmed',payment_reference=?,updated_at=?,confirmed_at=?,confirmed_by=?
               WHERE id=? AND status='pending'""",
            (
                (data.payment_reference or "").strip()[:120],
                now, now, admin["id"], order_id,
            ),
        )
        conn.execute(
            """UPDATE product_trips
               SET professional_route_entitlement=1,professional_adjustment_limit=?,updated_at=?
               WHERE id=?""",
            (PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT, now, order["trip_id"]),
        )
        conn.execute(
            """UPDATE professional_route_orders
               SET status='cancelled',provider_status='SUPERSEDED',updated_at=?
               WHERE trip_id=? AND id<>? AND status='pending'""",
            (now, order["trip_id"], order_id),
        )
        conn.commit()
        return {"ok": True, "order_id": order_id, "status": "confirmed"}
    finally:
        conn.close()


# ─── Referral points (separate from Travel Beans) ───────────
@app.get("/api/referrals/status")
async def referral_status(request: Request, user=Depends(current_user)):
    conn = get_db()
    try:
        now = int(time.time())
        _mature_referrals(conn, user["sub"], now)
        code = _ensure_referral_code(conn, user["sub"])
        pending_row = conn.execute(
            """SELECT COUNT(*) AS n FROM referrals
               WHERE (inviter_user_id=? OR invitee_user_id=?) AND status='pending'""",
            (user["sub"], user["sub"]),
        ).fetchone()
        month_row = conn.execute(
            """SELECT COUNT(*) AS n FROM referrals
               WHERE inviter_user_id=? AND created_at>=?""",
            (user["sub"], _month_start_utc(now)),
        ).fetchone()
        return {
            "referral_code": code,
            "share_url": f"{_public_base_url(request)}/ai-tool?ref={code}",
            "points": _points_balance(conn, user["sub"]),
            "points_required_per_professional_route": 30,
            "pending_referrals": int(dict(pending_row).get("n") or 0),
            "valid_invites_this_month": int(dict(month_row).get("n") or 0),
            "monthly_invite_limit": 5,
            "reward_delay_hours": 24,
        }
    finally:
        conn.close()


@app.post("/api/referrals/redeem-professional-route")
async def redeem_referral_points(
    data: ReferralRedeemReq,
    user=Depends(current_user),
    anon_id=Depends(anon_id_header),
):
    conn = get_db()
    try:
        now = int(time.time())
        _mature_referrals(conn, user["sub"], now)
        trip = _trip_owner(conn, data.trip_id, user, anon_id)
        _lock_professional_route_transaction(conn, data.trip_id, user["sub"])
        trip = _trip_owner(conn, data.trip_id, user, anon_id)
        allowance = _trip_allowance(conn, trip, user)
        if allowance["professional_route_unlocked"]:
            return {"ok": True, "already_unlocked": True, **allowance}
        balance = _points_balance(conn, user["sub"])
        if balance < 30:
            raise HTTPException(
                402,
                detail={"error": "insufficient_route_points", "required": 30, "balance": balance},
            )
        pending = conn.execute(
            """SELECT * FROM professional_route_orders
               WHERE trip_id=? AND user_id=? AND status='pending'
                 AND payment_method='manual_qr'
               ORDER BY created_at ASC LIMIT 1""",
            (data.trip_id, user["sub"]),
        ).fetchone()
        redemption_id = dict(pending)["id"] if pending else str(uuid.uuid4())
        conn.execute(
            """INSERT INTO route_points_ledger
               (id,user_id,delta,reason,ref_id,created_at)
               VALUES (?,?,?,?,?,?)""",
            (str(uuid.uuid4()), user["sub"], -30, "professional_route_redeem", redemption_id, now),
        )
        if pending:
            conn.execute(
                """UPDATE professional_route_orders
                   SET amount_cents=0,currency='POINTS',status='confirmed',
                       payment_method='points',payment_reference='route_points:30',
                       updated_at=?,confirmed_at=?,confirmed_by=?
                   WHERE id=? AND status='pending'""",
                (now, now, user["sub"], redemption_id),
            )
        else:
            conn.execute(
                """INSERT INTO professional_route_orders
                   (id,trip_id,user_id,amount_cents,currency,status,payment_method,
                    payment_reference,created_at,updated_at,confirmed_at,confirmed_by)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    redemption_id, data.trip_id, user["sub"], 0, "POINTS", "confirmed",
                    "points", "route_points:30", now, now, now, user["sub"],
                ),
            )
        conn.execute(
            """UPDATE product_trips
               SET professional_route_entitlement=1,professional_adjustment_limit=?,updated_at=?
               WHERE id=?""",
            (PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT, now, data.trip_id),
        )
        conn.execute(
            """UPDATE professional_route_orders
               SET status='cancelled',provider_status='SUPERSEDED',updated_at=?
               WHERE trip_id=? AND id<>? AND status='pending'""",
            (now, data.trip_id, redemption_id),
        )
        trip["professional_adjustment_limit"] = PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT
        conn.commit()
        refreshed = _trip_allowance(conn, trip, user)
        return {
            "ok": True,
            "points_spent": 30,
            "points_remaining": _points_balance(conn, user["sub"]),
            **refreshed,
        }
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
async def share_fuse(token: str, data: FuseReq, user=Depends(current_user)):
    """Guest of a shared trip submits their preferences; AI returns a
    merged plan that respects both parties. Sign-in is required."""
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


# ─── Privacy-minimised launch measurement ───────────────────
_MARKETING_EVENTS = {
    "page_view",
    "home_ai_plan",
    "home_professional_route",
    "bali_public_route_select",
    "bali_professional_route_start",
    "driver_form_start",
    "driver_request_submitted",
}
_MARKETING_WINDOW_SECONDS = 10 * 60
_MARKETING_EVENT_LIMIT = 120
_MARKETING_LIMIT_RETENTION_SECONDS = 24 * 60 * 60
_MARKETING_EVENT_RETENTION_SECONDS = 180 * 24 * 60 * 60
_MARKETING_PAGE_PATHS = {
    "/", "/index", "/index.html", "/about", "/about.html",
    "/services", "/services.html", "/contact", "/contact.html",
    "/ai-tool", "/ai-tool.html", "/bali", "/bali.html",
    "/find-driver", "/find-driver.html", "/privacy", "/privacy.html",
}


def _purge_expired_marketing_data(conn, now: int) -> None:
    conn.execute(
        "DELETE FROM marketing_event_rate_limits WHERE updated_at < ?",
        (now - _MARKETING_LIMIT_RETENTION_SECONDS,),
    )
    conn.execute(
        "DELETE FROM marketing_events WHERE created_at < ?",
        (now - _MARKETING_EVENT_RETENTION_SECONDS,),
    )


def _marketing_token(value: str, max_length: int = 80) -> str:
    """Keep only campaign-safe labels; never accept free-form visitor text."""
    raw = (value or "").strip().lower()
    if "@" in raw or "://" in raw or sum(char.isdigit() for char in raw) >= 7:
        return ""
    normalized = re.sub(r"[^a-z0-9._-]+", "_", raw)
    return normalized.strip("_")[:max_length]


def _marketing_page_path(value: str) -> str:
    path = (value or "/").split("?", 1)[0].split("#", 1)[0]
    return path if path in _MARKETING_PAGE_PATHS else "/"


def _marketing_client_key(request: Request) -> str:
    host = _request_origin_host(request) or "unknown"
    return hmac.new(
        _SECRET.encode(), f"marketing-event-rate:{host}".encode(), hashlib.sha256
    ).hexdigest()


def _consume_marketing_event_attempt(client_key: str, now: int) -> int:
    cutoff = now - _MARKETING_WINDOW_SECONDS
    conn = get_db()
    try:
        _purge_expired_marketing_data(conn, now)
        row = conn.execute(
            """
            INSERT INTO marketing_event_rate_limits
                (client_key,window_started_at,request_count,updated_at)
            VALUES (?,?,1,?)
            ON CONFLICT(client_key) DO UPDATE SET
                request_count = CASE
                    WHEN marketing_event_rate_limits.window_started_at <= ? THEN 1
                    WHEN marketing_event_rate_limits.request_count < ?
                        THEN marketing_event_rate_limits.request_count + 1
                    ELSE marketing_event_rate_limits.request_count
                END,
                window_started_at = CASE
                    WHEN marketing_event_rate_limits.window_started_at <= ?
                        THEN excluded.window_started_at
                    ELSE marketing_event_rate_limits.window_started_at
                END,
                updated_at = excluded.updated_at
            RETURNING request_count
            """,
            (
                client_key,
                now,
                now,
                cutoff,
                _MARKETING_EVENT_LIMIT + 1,
                cutoff,
            ),
        ).fetchone()
        conn.commit()
        if not row:
            raise RuntimeError("marketing event rate limit did not return a counter")
        return int(dict(row)["request_count"])
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()


@app.post("/api/marketing/events", status_code=204)
async def marketing_event(data: MarketingEventReq, request: Request):
    event_name = (data.event_name or "").strip()
    if event_name not in _MARKETING_EVENTS:
        raise HTTPException(400, "Unknown marketing event")
    now = int(time.time())
    try:
        count = _consume_marketing_event_attempt(_marketing_client_key(request), now)
    except Exception:
        raise HTTPException(503, "Measurement is temporarily unavailable")
    if count > _MARKETING_EVENT_LIMIT:
        raise HTTPException(429, "Too many measurement events")

    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO marketing_events
                (id,event_name,page_path,source,medium,campaign,content,lang,
                 device_class,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                str(uuid.uuid4()),
                event_name,
                _marketing_page_path(data.page_path),
                _marketing_token(data.source),
                _marketing_token(data.medium),
                _marketing_token(data.campaign),
                _marketing_token(data.content),
                _clean_lang(data.lang),
                data.device_class if data.device_class in {"mobile", "tablet", "desktop"} else "",
                now,
            ),
        )
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(503, "Measurement is temporarily unavailable")
    finally:
        conn.close()
    return Response(status_code=204)


@app.get("/api/admin/marketing-summary")
async def marketing_summary(days: int = 14, _admin=Depends(current_admin)):
    days = min(90, max(1, days))
    now = int(time.time())
    since = now - days * 24 * 60 * 60
    conn = get_db()
    try:
        _purge_expired_marketing_data(conn, now)
        conn.commit()
        events = conn.execute(
            """
            SELECT event_name,COUNT(*) AS count
            FROM marketing_events WHERE created_at >= ?
            GROUP BY event_name ORDER BY count DESC,event_name ASC
            """,
            (since,),
        ).fetchall()
        channels = conn.execute(
            """
            SELECT source,medium,COUNT(*) AS count
            FROM marketing_events WHERE created_at >= ? AND source <> ''
            GROUP BY source,medium ORDER BY count DESC,source ASC LIMIT 30
            """,
            (since,),
        ).fetchall()
        campaigns = conn.execute(
            """
            SELECT campaign,content,COUNT(*) AS count
            FROM marketing_events WHERE created_at >= ? AND campaign <> ''
            GROUP BY campaign,content ORDER BY count DESC,campaign ASC LIMIT 50
            """,
            (since,),
        ).fetchall()
        return {
            "days": days,
            "since": since,
            "events": [dict(row) for row in events],
            "channels": [dict(row) for row in channels],
            "campaigns": [dict(row) for row in campaigns],
        }
    finally:
        conn.close()


# ─── Find a Driver → email the request to the driver ──────────
# Privacy by design: we do NOT persist any of the traveller's contact
# details. The request is relayed once by email and never stored in the DB.
_DRIVER_REQUEST_WINDOW_SECONDS = 30 * 60
_DRIVER_REQUEST_LIMIT = 5
_DRIVER_REQUEST_LIMIT_RETENTION_SECONDS = 24 * 60 * 60


def _driver_request_client_key(request: Request) -> str:
    """Return a scoped pseudonymous key without storing the raw client address."""
    host = _request_origin_host(request) or "unknown"
    return hmac.new(
        _SECRET.encode(), f"driver-request-rate:{host}".encode(), hashlib.sha256
    ).hexdigest()


def _consume_driver_request_attempt(client_key: str, now: int) -> int:
    """Atomically consume one attempt in the client's first-request 30m window."""
    cutoff = now - _DRIVER_REQUEST_WINDOW_SECONDS
    conn = get_db()
    try:
        conn.execute(
            "DELETE FROM driver_request_rate_limits WHERE updated_at < ?",
            (now - _DRIVER_REQUEST_LIMIT_RETENTION_SECONDS,),
        )
        row = conn.execute(
            """
            INSERT INTO driver_request_rate_limits
                (client_key,window_started_at,request_count,updated_at)
            VALUES (?,?,1,?)
            ON CONFLICT(client_key) DO UPDATE SET
                request_count = CASE
                    WHEN driver_request_rate_limits.window_started_at <= ? THEN 1
                    WHEN driver_request_rate_limits.request_count < ?
                        THEN driver_request_rate_limits.request_count + 1
                    ELSE driver_request_rate_limits.request_count
                END,
                window_started_at = CASE
                    WHEN driver_request_rate_limits.window_started_at <= ?
                        THEN excluded.window_started_at
                    ELSE driver_request_rate_limits.window_started_at
                END,
                updated_at = excluded.updated_at
            RETURNING request_count
            """,
            (
                client_key,
                now,
                now,
                cutoff,
                _DRIVER_REQUEST_LIMIT + 1,
                cutoff,
            ),
        ).fetchone()
        conn.commit()
        if not row:
            raise RuntimeError("driver request rate limit did not return a counter")
        return int(dict(row)["request_count"])
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()


def _check_driver_request_rate_limit(request: Request) -> None:
    """Apply a persistent pseudonymous counter; traveller details are not stored."""
    try:
        count = _consume_driver_request_attempt(
            _driver_request_client_key(request), int(time.time())
        )
    except Exception:
        raise HTTPException(
            503, "Request protection is temporarily unavailable. Please retry shortly."
        )
    if count > _DRIVER_REQUEST_LIMIT:
        raise HTTPException(429, "Too many requests. Please wait before sending another request.")


@app.post("/api/driver-request")
async def driver_request(data: DriverReq, request: Request):
    _check_driver_request_rate_limit(request)
    if data.website.strip():
        # Honeypot bots receive an indistinguishable acknowledgement, but no mail is sent.
        return {"ok": True, "delivered": False}
    if not data.privacy_consent:
        raise HTTPException(400, "Please confirm that WanderMind may forward this request to the selected driver")
    # Email-only handoff keeps driver phone and social accounts out of the flow.
    if not data.contact_email.strip():
        raise HTTPException(400, "Please provide an email address")
    if not (data.first_name.strip() or data.last_name.strip()):
        raise HTTPException(400, "Please provide your name")
    driver_id = data.driver_id.strip().lower()
    if driver_id not in {"dicky", "gede"}:
        raise HTTPException(400, "Unknown driver")
    request_id = data.request_id.strip()
    if request_id:
        try:
            request_id = str(uuid.UUID(request_id))
        except ValueError:
            raise HTTPException(400, "Invalid request ID")
    else:
        # Backwards-compatible fallback for older clients. The current web form
        # always supplies a stable UUID so a network retry reuses the same
        # provider idempotency key without storing traveller data on our side.
        request_id = str(uuid.uuid4())
    payload = {
        "request_id": request_id,
        "driver_id": driver_id,
        "route_id": data.route_id.strip().upper(),
        "package_id": data.package_id.strip().lower(),
        "first_name": data.first_name.strip(),
        "last_name": data.last_name.strip(),
        "intro": data.intro.strip(),
        "contact_email": _clean_email(data.contact_email),
        "num_people": data.num_people,
        "num_days": data.num_days,
        "attractions": data.attractions.strip(),
        "start_date": data.start_date.strip(),
        "end_date": data.end_date.strip(),
        "preferred_time": data.preferred_time.strip(),
        "pickup_location": data.pickup_location.strip(),
        "budget_range": data.budget_range.strip(),
        "requested_services": [str(item).strip() for item in data.requested_services if str(item).strip()],
        "arrival_details": data.arrival_details.strip(),
        "lang": _clean_lang(data.lang),
    }
    result = await send_driver_request(payload)
    if not result.get("ok"):
        raise HTTPException(503, "Request email could not be delivered. Please retry shortly.")
    return {"ok": True, "delivered": True}


# ─── Destination info (curated presets + optional AI draft) ──
_DEST_INFO_CACHE: dict = {}          # (dest_lower, lang) -> (ts, data)
_DEST_INFO_TTL = 24 * 3600           # regions/tips/season barely change day-to-day
_DEST_INFO_LANGS = {"zh", "en", "ja", "ko", "id"}
_CURATED_DEST_INFO_PATH = Path(__file__).parent / "data" / "destination_intel.json"


def _load_curated_destination_intel() -> dict:
    try:
        payload = json.loads(_CURATED_DEST_INFO_PATH.read_text(encoding="utf-8"))
        if payload.get("schema_version") != 1 or not isinstance(payload.get("destinations"), dict):
            raise ValueError("unsupported destination intel schema")
        return payload
    except Exception as exc:
        print(f"[wandermind] curated destination intel unavailable: {exc}")
        return {"schema_version": 1, "destinations": {}}


_CURATED_DEST_INFO = _load_curated_destination_intel()


def _normalize_destination_alias(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).casefold()


_CURATED_DEST_ALIAS_INDEX = {
    _normalize_destination_alias(alias): key
    for key, entry in _CURATED_DEST_INFO["destinations"].items()
    for alias in entry.get("aliases", [])
}


def _curated_destination_response(destination: str, lang: str) -> Optional[dict]:
    destination_key = _CURATED_DEST_ALIAS_INDEX.get(
        _normalize_destination_alias(destination)
    )
    if not destination_key:
        return None

    entry = _CURATED_DEST_INFO["destinations"][destination_key]
    content = entry.get("content", {}).get(lang) or entry.get("content", {}).get("en")
    if not isinstance(content, dict):
        return None

    response = deepcopy(content)
    response.update({
        "destination_key": destination_key,
        "timezone": entry["timezone"],
        "currency_code": entry["currency_code"],
        "source_kind": "curated",
        "meta": {
            "language": lang,
            "content_version": _CURATED_DEST_INFO.get("content_version"),
            "reviewed_at": _CURATED_DEST_INFO.get("reviewed_at"),
            "sources": deepcopy(entry.get("sources", [])),
            "dynamic_fields": [
                "weather",
                "exchange_rate",
                "entry_requirements",
                "opening_hours",
                "prices",
            ],
        },
    })
    return response


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


def _strip_bad_unicode(obj):
    """Drop lone surrogates / un-encodable chars from all strings in a parsed
    JSON value (streamed CJK occasionally arrives with a broken codepoint)."""
    if isinstance(obj, str):
        return obj.encode("utf-8", "ignore").decode("utf-8", "ignore")
    if isinstance(obj, list):
        return [_strip_bad_unicode(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _strip_bad_unicode(v) for k, v in obj.items()}
    return obj


@app.post("/api/dest_info")
async def get_dest_info(req: DestInfoReq, user=Depends(optional_user)):
    """Serve reviewed presets without AI; custom/enhanced requests use an AI draft."""
    destination = (req.destination or "").strip()
    if not destination or len(destination) > 120:
        raise HTTPException(422, "Destination must contain 1-120 characters")
    normalized_lang = req.lang if req.lang in _DEST_INFO_LANGS else "en"

    curated = _curated_destination_response(destination, normalized_lang)
    if curated is not None and not req.enhance:
        return curated

    # Only authenticated users may spend model budget on custom or enhanced intel.
    dest_key = _normalize_destination_alias(destination)
    cache_key = (dest_key, normalized_lang)
    if not user:
        raise HTTPException(401, "Sign in is required to generate destination intel")
    now = time.time()
    cached = _DEST_INFO_CACHE.get(cache_key)
    if cached and now - cached[0] < _DEST_INFO_TTL:
        return cached[1]
    if not _API_KEY and not _FAST_KEY:
        raise HTTPException(500, "API_KEY not set")

    lang_map = {"zh": "中文", "en": "English", "ja": "日本語", "ko": "한국어", "id": "Bahasa Indonesia"}
    lang_name = lang_map[normalized_lang]

    # The AI result is explicitly a draft. Weather, exchange rates, entry rules,
    # opening hours and prices belong to independent live/official sources.
    example = """示例（目的地=京都，日本）：
{"timezone":"Asia/Tokyo","season":"四季分明","seasonDesc":"天气和花期每年变化，出发前核对官方季节信息","regions":[{"name":"祇园与东山","tag":"文化","desc":"传统街区、寺社与步行探索"},{"name":"岚山","tag":"自然","desc":"竹林、河岸与西部景点"},{"name":"京都站周边","tag":"交通","desc":"铁路换乘与城市中部住宿据点"}],"tips":[{"title":"入境要求","tag":"需核验","desc":"按护照和出发地查询日本官方入境要求"},{"title":"货币与支付","tag":"需核验","desc":"使用日元，出发前核对实时汇率和支付方式"}],"hotelAreas":[{"name":"京都站","q":"Kyoto Station"},{"name":"祇园与东山","q":"Gion Kyoto"},{"name":"河原町","q":"Kawaramachi Kyoto"}]}"""

    prompt = f"""你是旅行资料草稿生成器。仿照下面的示例，为目的地「{destination}」生成同样结构的JSON，所有文字用{lang_name}。不要声称信息已实时核验，不要输出天气、实时汇率、具体签证结论、营业时间、评分或价格。

{example}

现在为「{destination}」生成JSON：regions恰好3条、tips恰好2条（入境核验/货币核验）、hotelAreas恰好3条真实街区。只输出JSON对象本身，值简短，不使用“实时、最新、已核验”等表述。"""

    # Use the capable PRO model (MiMo) — the free 7B fast model degenerates on this
    # structured task. Stream it (non-streaming hangs on these providers) and collect
    # the answer (content) separately from any reasoning trace.
    url, headers, model, _label = _route("pro")
    try:
        content_parts: list[str] = []
        reasoning_parts: list[str] = []
        async with httpx.AsyncClient(timeout=110.0) as client:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json={
                    "model": model,
                    "max_tokens": 2600,        # reasoning model needs room to think + answer
                    "temperature": 0.5,
                    "stream": True,
                    "messages": [
                        {"role": "system", "content": "你只输出一个严格合法的JSON对象，字段名与示例完全一致。"},
                        {"role": "user", "content": prompt},
                    ],
                },
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise HTTPException(resp.status_code, body.decode(errors="replace")[:200])
                # Buffer raw BYTES and split on newlines, then decode each complete
                # line as UTF-8. aiter_lines() decodes per-chunk and corrupts multibyte
                # CJK chars split across chunk boundaries (lone surrogates / mojibake).
                buf = b""
                done = False
                async for chunk in resp.aiter_bytes():
                    buf += chunk
                    while b"\n" in buf:
                        rawline, buf = buf.split(b"\n", 1)
                        line = rawline.decode("utf-8", errors="ignore").strip()
                        if not line or not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if raw == "[DONE]":
                            done = True
                            break
                        try:
                            ev = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        choices = ev.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {}) or {}
                        if delta.get("content"):
                            content_parts.append(delta["content"])
                        elif delta.get("reasoning_content"):
                            reasoning_parts.append(delta["reasoning_content"])
                    if done:
                        break
        joined = "".join(content_parts)
        data = _extract_json(joined)
        if data is None:                       # answer empty → look in the reasoning trace
            joined = "".join(reasoning_parts)
            data = _extract_json(joined)
        if data is None:
            raise HTTPException(500, "AI did not return valid JSON")
        data = _strip_bad_unicode(data)        # drop any stray surrogate/broken chars
        # Quality gate — reject (and don't cache) empty / placeholder-echo garbage.
        regions = data.get("regions")
        tz = str(data.get("timezone") or "")
        if not isinstance(regions, list) or len(regions) < 2 or "如" in tz or "示例" in tz or "IANA" in tz:
            raise HTTPException(502, "AI returned low-quality data, please retry")
        data.pop("weather", None)
        data.pop("rate", None)
        # Assign card colours server-side (we dropped cls from the prompt to lighten
        # the small model's load) so regions/tips render with varied tags.
        _cls_cycle = ["tag-blue", "tag-amber", "tag-green", "tag-red"]
        for i, r in enumerate(data.get("regions") or []):
            if isinstance(r, dict):
                r.setdefault("cls", _cls_cycle[i % len(_cls_cycle)])
        for i, tp in enumerate(data.get("tips") or []):
            if isinstance(tp, dict):
                tp.setdefault("cls", _cls_cycle[i % len(_cls_cycle)])
        data["source_kind"] = "ai_generated"
        data["meta"] = {
            "language": normalized_lang,
            "generated_at": int(now),
            "verification_status": "draft",
            "dynamic_fields": [
                "weather",
                "exchange_rate",
                "entry_requirements",
                "opening_hours",
                "prices",
            ],
        }
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
async def search_flights(req: FlightSearchReq, user=Depends(current_user)):
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
async def search_hotels(req: HotelSearchReq, user=Depends(current_user)):
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
_WEATHER_CACHE: dict = {}
_WEATHER_CACHE_TTL = 30 * 60

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
async def get_weather(city: str, lang: str = "en", user=Depends(optional_user)):
    """Live weather for a destination. Gracefully returns 503 with hint
    if OPENWEATHER_API_KEY is not configured, so the frontend can fall
    back to the AI-generated dest_info data."""
    # Resolve to a canonical name OpenWeather understands
    key = city.strip().lower()
    q = _WEATHER_CITY_ALIAS.get(key) or _WEATHER_CITY_ALIAS.get(city.strip()) or city.strip()
    is_curated = key in _WEATHER_CITY_ALIAS or city.strip() in _WEATHER_CITY_ALIAS
    normalized_lang = lang if lang in {"zh", "en", "ja", "ko", "id"} else "en"
    cache_key = (q.lower(), normalized_lang)
    if not user and not is_curated:
        raise HTTPException(401, "Sign in is required for custom weather searches")
    now = time.time()
    cached = _WEATHER_CACHE.get(cache_key)
    if cached and now - cached[0] < _WEATHER_CACHE_TTL:
        return cached[1]
    if not _OPENWEATHER_KEY:
        raise HTTPException(503, "OPENWEATHER_API_KEY not set — set it in Render env to enable live weather")

    # OpenWeather lang code mapping
    ow_lang = {"zh": "zh_cn", "en": "en", "ja": "ja", "ko": "kr", "id": "id"}[normalized_lang]

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
        details = details_tpl[normalized_lang]

        result = {
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
        _WEATHER_CACHE[cache_key] = (now, result)
        return result
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
async def chat(req: ChatReq, user=Depends(current_user), anon_id=Depends(anon_id_header)):
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
async def chat_once(req: ChatReq, user=Depends(current_user), anon_id=Depends(anon_id_header)):
    if not _API_KEY:
        raise HTTPException(500, "API_KEY not set")
    product_trip = None
    product_action = (req.trip_action or "").strip().lower()
    if req.product_trip_id:
        conn = get_db()
        try:
            product_trip = _trip_owner(conn, req.product_trip_id, user, anon_id)
            allowance = _trip_allowance(conn, product_trip, user)
            product_action = _resolve_trip_action(allowance, product_action)
            key = {
                "rough_route": "rough_route",
                "adjustment": "adjustments",
                "professional_route": "professional_route",
            }[product_action]
            if not allowance["admin_unlimited"] and allowance[key]["remaining"] <= 0:
                raise HTTPException(
                    402,
                    detail={
                        "error": "trip_allowance_exhausted",
                        "action": product_action,
                        "professional_route_price": {"amount": 9.9, "currency": "CNY"},
                    },
                )
        finally:
            conn.close()
    else:
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
        result = {
            "text":          text,
            "mode":          mode_label,
            "model":         chat_model,
            "searched":      searched,
            "search_count":  len(search_results),
            "search_results": search_results,
        }
        if product_trip:
            conn = get_db()
            try:
                owned_trip = _trip_owner(conn, req.product_trip_id, user, anon_id)
                result["product_allowance"] = _consume_trip_action(
                    conn, owned_trip, user, product_action
                )
            finally:
                conn.close()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ─── Team mode: 3 agents in parallel, merged output ──────────
@app.post("/api/chat/team")
async def chat_team(req: ChatReq, user=Depends(current_user), anon_id=Depends(anon_id_header)):
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
async def generate(req: GenerateReq, user=Depends(current_user), anon_id=Depends(anon_id_header)):
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
_SITEMAP_PATHS = [
    "/", "/about", "/services", "/bali", "/ai-tool", "/find-driver",
    "/contact", "/privacy",
]


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

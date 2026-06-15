"""
Email service — thin wrapper over Resend (https://resend.com).

USAGE
─────
Set RESEND_API_KEY in env to enable real sending. Without it the service
runs in dev mode and just logs to stdout, so flow remains testable.

ENV VARS
─────────
  RESEND_API_KEY   API key from resend.com/api-keys (required for real send)
  EMAIL_FROM       Sender, e.g. "WanderMind <noreply@yourdomain.com>"
                   Defaults to onboarding@resend.dev for dev/testing.
  PUBLIC_URL       Base URL for links in emails, e.g. "https://yourdomain.com"
                   Auto-detected from request when not set.

Templates are inlined HTML — fine for transactional volume.
For onboarding@resend.dev (Resend default sender), Resend restricts
the recipient to your account email. Once you verify a custom domain on
resend.com → Domains, set EMAIL_FROM to use your own sender and you can
mail anyone.
"""
import os
import json
import asyncio
from typing import Optional

import httpx

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
# Until the wandermind.cc domain is verified on Resend, keep using the shared
# onboarding@resend.dev sender (only delivers to your own account email).
# After verification, set EMAIL_FROM=WanderMind <noreply@wandermind.cc> on Render.
EMAIL_FROM = os.getenv("EMAIL_FROM", "WanderMind <onboarding@resend.dev>").strip()
PUBLIC_URL_DEFAULT = os.getenv("PUBLIC_URL", "https://wandermind.cc").strip().rstrip("/")

_RESEND_ENDPOINT = "https://api.resend.com/emails"


def _is_enabled() -> bool:
    return bool(RESEND_API_KEY)


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> dict:
    """Send an email. Returns {'ok': bool, 'id': str|None, 'reason': str|None}.

    Failure is non-fatal — caller decides what to do.
    reply_to lets the recipient reply straight to a third party (e.g. driver
    replies to the traveller).
    """
    if not _is_enabled():
        # Use sys.stdout to bypass Windows GBK console errors on emoji subjects
        import sys
        msg = f"[email DEV] to={to} subject={subject!r}  (set RESEND_API_KEY to actually send)\n"
        try:
            sys.stdout.write(msg)
        except UnicodeEncodeError:
            sys.stdout.write(msg.encode("ascii", "replace").decode("ascii"))
        return {"ok": False, "id": None, "reason": "RESEND_API_KEY not configured"}

    payload = {
        "from": EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if reply_to:
        payload["reply_to"] = reply_to

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(_RESEND_ENDPOINT, headers=headers, json=payload)
        if r.status_code >= 400:
            return {"ok": False, "id": None, "reason": f"HTTP {r.status_code}: {r.text[:200]}"}
        data = r.json()
        return {"ok": True, "id": data.get("id"), "reason": None}
    except Exception as e:
        return {"ok": False, "id": None, "reason": f"{type(e).__name__}: {e}"}


# ─── Templates ────────────────────────────────────────────────────────────
# Inline gold/teal palette matches the Studio brand (--ws-amber + --ws-teal)

def _wrapper(inner: str, preheader: str = "") -> str:
    """Common shell: brand header + body + footer."""
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>WanderMind</title></head>
<body style="margin:0;padding:0;background:#f5f3ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1e293b;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">{preheader}</span>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
         style="max-width:560px;width:100%;margin:0 auto;background:#ffffff;border-radius:14px;
                box-shadow:0 1px 3px rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.08);
                margin-top:32px;margin-bottom:32px;overflow:hidden;">
    <tr><td style="padding:28px 36px 18px;text-align:center;background:linear-gradient(135deg,#fcbf1e,#d97706);">
      <div style="font-size:22px;font-weight:800;letter-spacing:.02em;color:#fff;">
        WanderMind <span style="font-size:11px;font-weight:400;opacity:.82;letter-spacing:.18em;">STUDIO</span>
      </div>
    </td></tr>
    <tr><td style="padding:30px 36px 36px;">
      {inner}
    </td></tr>
    <tr><td style="padding:18px 36px 28px;border-top:1px solid #e5e2d8;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
      WanderMind · AI Travel Planning<br>
      <a href="{PUBLIC_URL_DEFAULT}" style="color:#94a3b8;text-decoration:none;">{PUBLIC_URL_DEFAULT}</a>
    </td></tr>
  </table>
</body></html>"""


def render_welcome(name: str, public_url: Optional[str] = None) -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    base = (public_url or PUBLIC_URL_DEFAULT).rstrip("/")
    subject = f"Welcome to WanderMind, {name}! ✈️"
    inner = f"""
      <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#1e293b;line-height:1.3;">
        Hi {name}, welcome aboard 🌍
      </h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">
        Thanks for joining <strong>WanderMind</strong> — your team of 6 AI travel agents is ready to help you plan
        anywhere, in any language.
      </p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;">
        Tell them where you want to go, when, and with whom — they'll handle the rest:
        flights, hotels, day-by-day itineraries, budget breakdowns, and live local intel.
      </p>
      <div style="text-align:center;margin:28px 0 22px;">
        <a href="{base}/ai-tool" style="display:inline-block;padding:13px 32px;border-radius:24px;
           background:linear-gradient(135deg,#fcbf1e,#d97706);color:#fff;text-decoration:none;
           font-weight:700;font-size:14px;letter-spacing:.01em;">
          Start planning your first trip →
        </a>
      </div>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#94a3b8;text-align:center;">
        Have a destination in mind? Try Bali · Kyoto · Paris · Santorini · or any city worldwide.
      </p>
    """
    text = (
        f"Hi {name}, welcome to WanderMind!\n\n"
        f"Your team of 6 AI travel agents is ready. Start at: {base}/ai-tool\n\n"
        f"— WanderMind"
    )
    return subject, _wrapper(inner, preheader=f"Welcome to WanderMind — let's plan your next trip."), text


def render_password_reset(name: str, reset_link: str) -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    subject = "Reset your WanderMind password"
    inner = f"""
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#1e293b;line-height:1.3;">
        Reset your password
      </h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">
        Hi {name},
      </p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;">
        We received a request to reset your WanderMind password.
        Click the button below to set a new one — this link is valid for <strong>1 hour</strong>.
      </p>
      <div style="text-align:center;margin:28px 0 22px;">
        <a href="{reset_link}" style="display:inline-block;padding:13px 32px;border-radius:24px;
           background:linear-gradient(135deg,#fcbf1e,#d97706);color:#fff;text-decoration:none;
           font-weight:700;font-size:14px;letter-spacing:.01em;">
          Reset password
        </a>
      </div>
      <p style="margin:22px 0 12px;font-size:13px;line-height:1.7;color:#94a3b8;">
        Or copy & paste this URL into your browser:<br>
        <a href="{reset_link}" style="color:#0e7c6b;word-break:break-all;">{reset_link}</a>
      </p>
      <p style="margin:18px 0 0;font-size:12.5px;line-height:1.6;color:#94a3b8;
                background:#f5f3ed;padding:12px 14px;border-radius:8px;">
        <strong>Didn't request this?</strong> You can safely ignore this email — your current password remains active.
      </p>
    """
    text = (
        f"Hi {name},\n\n"
        f"Reset your WanderMind password using this link (valid for 1 hour):\n{reset_link}\n\n"
        f"If you didn't request this, ignore the email.\n\n— WanderMind"
    )
    return subject, _wrapper(inner, preheader="Reset your WanderMind password — link valid 1 hour."), text


async def send_welcome(to: str, name: str, public_url: Optional[str] = None) -> dict:
    subject, html, text = render_welcome(name, public_url)
    return await send_email(to, subject, html, text)


async def send_password_reset(to: str, name: str, reset_link: str) -> dict:
    subject, html, text = render_password_reset(name, reset_link)
    return await send_email(to, subject, html, text)


# ─── Driver request (Find a Driver → email to Dicky) ──────────────────────
DRIVER_EMAIL = os.getenv("DRIVER_EMAIL", "Dickymahaputramahaputra@gmail.com").strip()
DRIVER_PHONE = os.getenv("DRIVER_PHONE", "+62 898-0532-230").strip()


def _esc(s) -> str:
    s = "" if s is None else str(s)
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def render_driver_request(data: dict) -> tuple:
    """Build the email that goes to the driver. `data` keys:
    first_name, last_name, intro, contact_whatsapp, contact_email,
    contact_phone, num_people, num_days, attractions."""
    full_name = f"{_esc(data.get('first_name',''))} {_esc(data.get('last_name',''))}".strip() or "A traveller"
    subject = f"🚗 New Bali driver request from {full_name}"

    def row(label, value):
        if not value:
            return ""
        return (f'<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;'
                f'white-space:nowrap;vertical-align:top;width:130px;">{_esc(label)}</td>'
                f'<td style="padding:8px 0;color:#1e293b;font-size:14.5px;line-height:1.6;">{_esc(value)}</td></tr>')

    contacts = []
    if data.get("contact_whatsapp"):
        contacts.append(("WhatsApp", data["contact_whatsapp"]))
    if data.get("contact_email"):
        contacts.append(("Email", data["contact_email"]))
    if data.get("contact_phone"):
        contacts.append(("Phone", data["contact_phone"]))
    contacts_html = "".join(row(l, v) for l, v in contacts)

    inner = f"""
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#1e293b;">
        🚗 New driver request
      </h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
        A traveller found you through WanderMind and would like to book your driving service in Bali.
        Just hit <strong>Reply</strong> to contact them directly.
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
             style="border-collapse:collapse;background:#f8fafc;border-radius:10px;padding:6px 16px;">
        {row("Name", full_name)}
        {row("Group size", (str(data.get("num_people")) + " people") if data.get("num_people") else "")}
        {row("Duration", (str(data.get("num_days")) + " days in Bali") if data.get("num_days") else "")}
        {contacts_html}
      </table>

      {("<div style='margin-top:18px;'><div style='font-size:13px;color:#94a3b8;margin-bottom:6px;'>About them</div>"
        "<div style='font-size:14.5px;line-height:1.7;color:#1e293b;background:#f8fafc;border-radius:10px;padding:14px 16px;white-space:pre-wrap;'>"
        + _esc(data.get("intro","")) + "</div></div>") if data.get("intro") else ""}

      {("<div style='margin-top:18px;'><div style='font-size:13px;color:#94a3b8;margin-bottom:6px;'>Places they want to visit</div>"
        "<div style='font-size:14.5px;line-height:1.7;color:#1e293b;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;white-space:pre-wrap;'>"
        + _esc(data.get("attractions","")) + "</div></div>") if data.get("attractions") else ""}

      <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e2d8;font-size:12.5px;color:#94a3b8;line-height:1.7;">
        <strong style="color:#475569;">Your listed service (for reference):</strong><br>
        📞 {_esc(DRIVER_PHONE)}<br>
        🕙 Full-day tours 10–12 hours · ~550–650k IDR/day (10h)<br>
        ✈️ Airport &amp; hotel pickup / drop-off
      </div>
    """
    text = (
        f"New Bali driver request from {full_name}\n\n"
        f"Group: {data.get('num_people','?')} people, {data.get('num_days','?')} days\n"
        + "".join(f"{l}: {v}\n" for l, v in contacts)
        + (f"\nAbout: {data.get('intro','')}\n" if data.get("intro") else "")
        + (f"\nPlaces: {data.get('attractions','')}\n" if data.get("attractions") else "")
        + f"\nYour service ref: {DRIVER_PHONE} · 10-12h tours · ~550-650k IDR/day · airport & hotel pickup\n"
    )
    return subject, _wrapper(inner, preheader=f"New Bali driver request from {full_name}"), text


async def send_driver_request(data: dict) -> dict:
    """Email the driver. Sets reply_to to the traveller's email when given."""
    subject, html, text = render_driver_request(data)
    reply_to = data.get("contact_email") or None
    return await send_email(DRIVER_EMAIL, subject, html, text, reply_to=reply_to)

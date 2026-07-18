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
    bcc: Optional[str] = None,
) -> dict:
    """Send an email. Returns {'ok': bool, 'id': str|None, 'reason': str|None}.

    Failure is non-fatal — caller decides what to do.
    reply_to lets the recipient reply straight to a third party (e.g. driver
    replies to the traveller).
    bcc silently copies a hidden recipient — it never appears in any header the
    'to'/visible recipients can see (used so the owner is copied on driver leads
    without the driver or traveller knowing).
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
    if bcc:
        payload["bcc"] = [bcc]

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


_MAIL_COPY = {
    "en": {
        "code_subject": "Your WanderMind verification code",
        "code_title": "Verify your email",
        "code_intro": "Use this 6-digit code to create your WanderMind account:",
        "code_expiry": "This code expires in 10 minutes. If you did not request it, you can ignore this email.",
        "welcome_subject": "Welcome to WanderMind",
        "welcome_title": "Welcome aboard, {name}",
        "welcome_body": "Your WanderMind travel workspace is ready. Save trips, compare options and continue planning on any device.",
        "welcome_cta": "Start planning",
        "reset_subject": "Reset your WanderMind password",
        "reset_title": "Reset your password",
        "reset_body": "Hi {name}, use the button below to set a new password. This link is valid for 1 hour.",
        "reset_cta": "Reset password",
        "reset_ignore": "If you did not request this, you can safely ignore this email.",
    },
    "zh": {
        "code_subject": "你的 WanderMind 邮箱验证码",
        "code_title": "验证你的邮箱",
        "code_intro": "使用下面的 6 位验证码创建 WanderMind 账户：",
        "code_expiry": "验证码 10 分钟内有效。如非本人操作，可忽略此邮件。",
        "welcome_subject": "欢迎加入 WanderMind",
        "welcome_title": "欢迎启程，{name}",
        "welcome_body": "你的 WanderMind 旅行工作台已准备好。你可以保存行程、比较方案，并在不同设备上继续规划。",
        "welcome_cta": "开始规划",
        "reset_subject": "重置 WanderMind 密码",
        "reset_title": "重置你的密码",
        "reset_body": "你好，{name}。点击下方按钮设置新密码，此链接在 1 小时内有效。",
        "reset_cta": "重置密码",
        "reset_ignore": "如果不是你发起的请求，可以安全忽略此邮件。",
    },
    "ja": {
        "code_subject": "WanderMind メール認証コード",
        "code_title": "メールを認証",
        "code_intro": "WanderMind アカウント作成用の6桁コードです：",
        "code_expiry": "コードは10分間有効です。心当たりがなければ無視してください。",
        "welcome_subject": "WanderMindへようこそ",
        "welcome_title": "ようこそ、{name}さん",
        "welcome_body": "旅行ワークスペースの準備ができました。旅程を保存し、選択肢を比較して、どの端末からでも計画を続けられます。",
        "welcome_cta": "計画を始める",
        "reset_subject": "WanderMind パスワードをリセット",
        "reset_title": "パスワードをリセット",
        "reset_body": "{name}さん、下のボタンから新しいパスワードを設定してください。リンクは1時間有効です。",
        "reset_cta": "パスワードをリセット",
        "reset_ignore": "心当たりがなければ、このメールを無視してください。",
    },
    "ko": {
        "code_subject": "WanderMind 이메일 인증 코드",
        "code_title": "이메일 인증",
        "code_intro": "WanderMind 계정을 만들려면 아래 6자리 코드를 입력하세요:",
        "code_expiry": "코드는 10분 동안 유효합니다. 요청하지 않았다면 이 메일을 무시하세요.",
        "welcome_subject": "WanderMind에 오신 것을 환영합니다",
        "welcome_title": "환영합니다, {name}님",
        "welcome_body": "여행 워크스페이스가 준비되었습니다. 여행을 저장하고 옵션을 비교하며 모든 기기에서 계속 계획하세요.",
        "welcome_cta": "계획 시작",
        "reset_subject": "WanderMind 비밀번호 재설정",
        "reset_title": "비밀번호 재설정",
        "reset_body": "{name}님, 아래 버튼에서 새 비밀번호를 설정하세요. 링크는 1시간 동안 유효합니다.",
        "reset_cta": "비밀번호 재설정",
        "reset_ignore": "요청하지 않았다면 이 메일을 무시해도 됩니다.",
    },
    "id": {
        "code_subject": "Kode verifikasi email WanderMind",
        "code_title": "Verifikasi email Anda",
        "code_intro": "Gunakan kode 6 digit ini untuk membuat akun WanderMind:",
        "code_expiry": "Kode berlaku 10 menit. Abaikan email ini jika Anda tidak memintanya.",
        "welcome_subject": "Selamat datang di WanderMind",
        "welcome_title": "Selamat datang, {name}",
        "welcome_body": "Ruang kerja perjalanan Anda sudah siap. Simpan perjalanan, bandingkan pilihan, dan lanjutkan rencana di perangkat apa pun.",
        "welcome_cta": "Mulai merencanakan",
        "reset_subject": "Reset kata sandi WanderMind",
        "reset_title": "Reset kata sandi Anda",
        "reset_body": "Hai {name}, gunakan tombol di bawah untuk membuat kata sandi baru. Tautan berlaku 1 jam.",
        "reset_cta": "Reset kata sandi",
        "reset_ignore": "Jika Anda tidak memintanya, abaikan email ini.",
    },
}


def _copy(lang: str) -> dict:
    return _MAIL_COPY.get(lang, _MAIL_COPY["en"])


def render_verification_code(code: str, lang: str = "en") -> tuple[str, str, str]:
    copy = _copy(lang)
    inner = f"""
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#1e293b;">{copy['code_title']}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569;">{copy['code_intro']}</p>
      <div style="margin:20px 0;padding:18px;text-align:center;background:#f5f3ed;border-radius:12px;
                  font-size:32px;font-weight:800;letter-spacing:.24em;color:#0e7c6b;">{code}</div>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#94a3b8;">{copy['code_expiry']}</p>
    """
    text = f"{copy['code_title']}\n\n{copy['code_intro']} {code}\n\n{copy['code_expiry']}"
    return copy["code_subject"], _wrapper(inner, preheader=copy["code_subject"]), text


def render_welcome(name: str, public_url: Optional[str] = None, lang: str = "en") -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    base = (public_url or PUBLIC_URL_DEFAULT).rstrip("/")
    copy = _copy(lang)
    subject = copy["welcome_subject"]
    inner = f"""
      <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#1e293b;line-height:1.3;">
        {copy['welcome_title'].format(name=name)}
      </h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">
        {copy['welcome_body']}
      </p>
      <div style="text-align:center;margin:28px 0 22px;">
        <a href="{base}/ai-tool" style="display:inline-block;padding:13px 32px;border-radius:24px;
           background:linear-gradient(135deg,#fcbf1e,#d97706);color:#fff;text-decoration:none;
           font-weight:700;font-size:14px;letter-spacing:.01em;">
          {copy['welcome_cta']} →
        </a>
      </div>
    """
    text = (
        f"{copy['welcome_title'].format(name=name)}\n\n"
        f"{copy['welcome_body']} {base}/ai-tool\n\n"
        f"— WanderMind"
    )
    return subject, _wrapper(inner, preheader=subject), text


def render_password_reset(name: str, reset_link: str, lang: str = "en") -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    copy = _copy(lang)
    subject = copy["reset_subject"]
    inner = f"""
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#1e293b;line-height:1.3;">
        {copy['reset_title']}
      </h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;">
        {copy['reset_body'].format(name=name)}
      </p>
      <div style="text-align:center;margin:28px 0 22px;">
        <a href="{reset_link}" style="display:inline-block;padding:13px 32px;border-radius:24px;
           background:linear-gradient(135deg,#fcbf1e,#d97706);color:#fff;text-decoration:none;
           font-weight:700;font-size:14px;letter-spacing:.01em;">
          {copy['reset_cta']}
        </a>
      </div>
      <p style="margin:22px 0 12px;font-size:13px;line-height:1.7;color:#94a3b8;">
        URL:<br>
        <a href="{reset_link}" style="color:#0e7c6b;word-break:break-all;">{reset_link}</a>
      </p>
      <p style="margin:18px 0 0;font-size:12.5px;line-height:1.6;color:#94a3b8;
                background:#f5f3ed;padding:12px 14px;border-radius:8px;">
        {copy['reset_ignore']}
      </p>
    """
    text = (
        f"{copy['reset_title']}\n\n{copy['reset_body'].format(name=name)}\n{reset_link}\n\n"
        f"{copy['reset_ignore']}\n\n— WanderMind"
    )
    return subject, _wrapper(inner, preheader=subject), text


async def send_verification_code(to: str, code: str, lang: str = "en") -> dict:
    subject, html, text = render_verification_code(code, lang)
    return await send_email(to, subject, html, text)


async def send_welcome(to: str, name: str, public_url: Optional[str] = None, lang: str = "en") -> dict:
    subject, html, text = render_welcome(name, public_url, lang)
    return await send_email(to, subject, html, text)


async def send_password_reset(to: str, name: str, reset_link: str, lang: str = "en") -> dict:
    subject, html, text = render_password_reset(name, reset_link, lang)
    return await send_email(to, subject, html, text)


# ─── Driver request (Find a Driver → email to Dicky) ──────────────────────
DRIVER_EMAIL = os.getenv("DRIVER_EMAIL", "Dickymahaputramahaputra@gmail.com").strip()
DRIVER_PHONE = os.getenv("DRIVER_PHONE", "+62 898-0532-230").strip()
# Silent owner copy on every driver lead — hidden from the driver and traveller
# (BCC), so the owner always knows when a customer contacts Dicky. Blank disables.
OWNER_BCC_EMAIL = os.getenv("OWNER_BCC_EMAIL", "wlfyyds666@gmail.com").strip()


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
        {row("Travel dates", (str(data.get("start_date")) + " → " + str(data.get("end_date"))) if data.get("start_date") else "")}
        {row("Preferred pickup time", data.get("preferred_time"))}
        {row("Pickup / hotel", data.get("pickup_location"))}
        {row("Budget range", data.get("budget_range"))}
        {row("Services requested", ", ".join(data.get("requested_services") or []))}
        {row("Flight / arrival", data.get("arrival_details"))}
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
        + (f"Dates: {data.get('start_date','')} → {data.get('end_date','')}\n" if data.get("start_date") else "")
        + (f"Preferred time: {data.get('preferred_time','')}\n" if data.get("preferred_time") else "")
        + (f"Pickup / hotel: {data.get('pickup_location','')}\n" if data.get("pickup_location") else "")
        + (f"Budget: {data.get('budget_range','')}\n" if data.get("budget_range") else "")
        + (f"Services: {', '.join(data.get('requested_services') or [])}\n" if data.get("requested_services") else "")
        + (f"Flight / arrival: {data.get('arrival_details','')}\n" if data.get("arrival_details") else "")
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
    return await send_email(
        DRIVER_EMAIL, subject, html, text,
        reply_to=reply_to,
        bcc=OWNER_BCC_EMAIL or None,
    )

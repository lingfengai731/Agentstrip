"""
Database compatibility layer — auto-switches between SQLite and PostgreSQL.

USAGE
─────
Local dev (no env var)        → uses local SQLite file (wandermind.db)
Production (DATABASE_URL set) → uses PostgreSQL via psycopg2

The wrapper keeps the existing sqlite3-style API alive:

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    rows = conn.execute("SELECT id FROM x").fetchall()
    conn.execute("INSERT INTO ... VALUES (?,?)", (a, b))
    conn.commit()
    conn.close()

Same interface as before. Internally:
  • Placeholders `?` are auto-translated to `%s` for psycopg2
  • Row objects are dict-like in both backends (sqlite3.Row + RealDictRow)
  • IntegrityError is unified for both backends
"""
import os
import re
import sqlite3
import time
from pathlib import Path

# ─── Backend selection ───────────────────────────────────────
_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
USE_POSTGRES = _DATABASE_URL.startswith(("postgres://", "postgresql://"))

# Render hands out URLs starting with postgres://; psycopg2 prefers postgresql://
if USE_POSTGRES and _DATABASE_URL.startswith("postgres://"):
    _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1)

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
    IntegrityError = psycopg2.IntegrityError
else:
    IntegrityError = sqlite3.IntegrityError


_SQLITE_PATH = Path(os.getenv("DB_PATH", str(Path(__file__).parent / "wandermind.db")))


# ─── Cursor wrapper ──────────────────────────────────────────
class _Result:
    """Cursor wrapper that mirrors the sqlite3 chain pattern."""
    __slots__ = ("_cur",)

    def __init__(self, cur):
        self._cur = cur

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()


# ─── Connection wrapper ──────────────────────────────────────
class _Conn:
    """Wraps raw sqlite3 / psycopg2 connection with a unified interface."""
    __slots__ = ("_conn", "_is_pg")

    def __init__(self, conn, is_postgres):
        self._conn = conn
        self._is_pg = is_postgres

    def execute(self, sql, params=()):
        if self._is_pg:
            sql = sql.replace("?", "%s")
            cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            cur = self._conn.cursor()
        cur.execute(sql, params)
        return _Result(cur)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


# ─── Public API ──────────────────────────────────────────────
def get_db():
    """Open a fresh DB connection. Caller owns close()."""
    if USE_POSTGRES:
        conn = psycopg2.connect(_DATABASE_URL)
        return _Conn(conn, True)
    else:
        conn = sqlite3.connect(_SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return _Conn(conn, False)


# ─── Schema bootstrap ────────────────────────────────────────
def init_db():
    """Create tables on first run. Idempotent for both backends.

    Note: PG uses BIGINT for unix timestamps (avoids the year-2038 32-bit
    overflow); SQLite is dynamically typed so INTEGER works fine.
    """
    conn = get_db()
    try:
        if USE_POSTGRES:
            ts_type = "BIGINT"
        else:
            ts_type = "INTEGER"

        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT UNIQUE,
                name          TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                lang          TEXT DEFAULT 'zh',
                preferences   TEXT DEFAULT '{{}}',
                free_uses     INTEGER DEFAULT 0,
                beans         INTEGER DEFAULT 0,
                created_at    {ts_type} NOT NULL
            )
        """)
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS auth_identities (
                id                TEXT PRIMARY KEY,
                user_id           TEXT NOT NULL,
                provider          TEXT NOT NULL,
                provider_subject  TEXT NOT NULL,
                email_at_provider TEXT,
                created_at        {ts_type} NOT NULL,
                last_seen_at      {ts_type} NOT NULL,
                UNIQUE(provider, provider_subject)
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_auth_identities_user "
            "ON auth_identities(user_id)"
        )
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS email_verification_codes (
                email         TEXT PRIMARY KEY,
                code_hash     TEXT NOT NULL,
                expires_at    {ts_type} NOT NULL,
                resend_after  {ts_type} NOT NULL,
                attempts      INTEGER DEFAULT 0,
                lang          TEXT DEFAULT 'en',
                created_at    {ts_type} NOT NULL
            )
        """)
        # Anonymous (not-logged-in) usage quota, keyed by client-generated id
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS guest_usage (
                anon_id     TEXT PRIMARY KEY,
                free_uses   INTEGER DEFAULT 0,
                beans       INTEGER DEFAULT 0,
                created_at  {ts_type} NOT NULL,
                updated_at  {ts_type} NOT NULL
            )
        """)
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS conversations (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                dest        TEXT DEFAULT 'bali',
                title       TEXT,
                messages    TEXT DEFAULT '[]',
                created_at  {ts_type} NOT NULL,
                updated_at  {ts_type} NOT NULL
            )
        """)

        # Shared trips — public read-only snapshots
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS shared_trips (
                token       TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                conv_id     TEXT,
                dest        TEXT,
                title       TEXT,
                snapshot    TEXT NOT NULL,
                views       INTEGER DEFAULT 0,
                created_at  {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_shared_trips_user ON shared_trips(user_id)"
        )

        # Trip fusions — guest adds prefs to someone else's shared trip,
        # AI re-plans for both parties. Public read by token.
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS trip_fusions (
                token         TEXT PRIMARY KEY,
                source_token  TEXT NOT NULL,
                guest_name    TEXT,
                guest_prefs   TEXT,
                ai_response   TEXT NOT NULL,
                views         INTEGER DEFAULT 0,
                created_at    {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_fusion_source ON trip_fusions(source_token)"
        )

        # Product trips — a fresh trip receives one complete rough route and
        # two free adjustments. Professional-route access is tracked separately
        # from the legacy AI beans quota.
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS product_trips (
                id                TEXT PRIMARY KEY,
                user_id           TEXT,
                anon_id           TEXT,
                destination       TEXT DEFAULT 'bali',
                brief             TEXT DEFAULT '{{}}',
                rough_used        INTEGER DEFAULT 0,
                adjustments_used  INTEGER DEFAULT 0,
                 professional_used INTEGER DEFAULT 0,
                 professional_route_entitlement INTEGER DEFAULT 0,
                 professional_adjustments_used INTEGER DEFAULT 0,
                 professional_adjustment_limit INTEGER,
                 professional_route_payload TEXT DEFAULT '{{}}',
                 created_at        {ts_type} NOT NULL,
                updated_at        {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_product_trips_user ON product_trips(user_id)"
        )

        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS professional_route_orders (
                id                 TEXT PRIMARY KEY,
                trip_id            TEXT NOT NULL,
                user_id            TEXT NOT NULL,
                amount_cents       INTEGER NOT NULL DEFAULT 990,
                currency           TEXT NOT NULL DEFAULT 'CNY',
                status             TEXT NOT NULL DEFAULT 'pending',
                payment_method     TEXT NOT NULL DEFAULT 'manual_qr',
                payment_reference  TEXT,
                provider_order_id  TEXT,
                provider_capture_id TEXT,
                provider_status    TEXT,
                created_at         {ts_type} NOT NULL,
                updated_at         {ts_type},
                confirmed_at       {ts_type},
                confirmed_by       TEXT,
                refunded_at        {ts_type}
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pro_orders_user ON professional_route_orders(user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pro_orders_trip ON professional_route_orders(trip_id)"
        )
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS payment_webhook_events (
                event_id       TEXT PRIMARY KEY,
                event_type     TEXT NOT NULL,
                provider       TEXT NOT NULL DEFAULT 'paypal',
                status         TEXT NOT NULL,
                received_at    {ts_type} NOT NULL,
                processed_at   {ts_type}
            )
        """)

        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS referrals (
                id               TEXT PRIMARY KEY,
                inviter_user_id  TEXT NOT NULL,
                invitee_user_id  TEXT UNIQUE NOT NULL,
                status           TEXT NOT NULL DEFAULT 'pending',
                available_at     {ts_type} NOT NULL,
                created_at       {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_user_id)"
        )

        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS route_points_ledger (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                delta       INTEGER NOT NULL,
                reason      TEXT NOT NULL,
                ref_id      TEXT NOT NULL,
                created_at  {ts_type} NOT NULL,
                UNIQUE(user_id, reason, ref_id)
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_route_points_user ON route_points_ledger(user_id)"
        )

        # Portfolio assets are stored externally (Cloudinary or a compatible
        # object store). The database keeps only verified delivery references
        # and editorial metadata, so Render's ephemeral filesystem is never
        # part of the publishing path.
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS portfolio_assets (
                id                       TEXT PRIMARY KEY,
                destination              TEXT NOT NULL DEFAULT 'bali',
                primary_theme            TEXT NOT NULL,
                sub_category             TEXT DEFAULT '',
                region                   TEXT DEFAULT '',
                area                     TEXT DEFAULT '',
                place_name               TEXT DEFAULT '',
                place_type               TEXT DEFAULT '',
                prominence               TEXT DEFAULT 'supporting',
                route_ids                TEXT DEFAULT '[]',
                extension_ids            TEXT DEFAULT '[]',
                tags                     TEXT DEFAULT '[]',
                mood                     TEXT DEFAULT '',
                photography_style        TEXT DEFAULT '',
                title                    TEXT DEFAULT '{{}}',
                description              TEXT DEFAULT '{{}}',
                alt_text                 TEXT DEFAULT '{{}}',
                verification_status      TEXT DEFAULT 'caption-only',
                original_filename        TEXT DEFAULT '',
                sha256                   TEXT NOT NULL,
                file_bytes               INTEGER DEFAULT 0,
                width                    INTEGER DEFAULT 0,
                height                   INTEGER DEFAULT 0,
                format                   TEXT DEFAULT '',
                exif                     TEXT DEFAULT '{{}}',
                cloudinary_asset_id      TEXT UNIQUE NOT NULL,
                cloudinary_public_id     TEXT UNIQUE NOT NULL,
                cloudinary_version       {ts_type} NOT NULL,
                secure_url               TEXT NOT NULL,
                web_url                  TEXT NOT NULL,
                thumbnail_url            TEXT NOT NULL,
                status                   TEXT NOT NULL DEFAULT 'draft',
                sort_order               INTEGER NOT NULL DEFAULT 0,
                created_by               TEXT NOT NULL,
                created_at               {ts_type} NOT NULL,
                updated_at               {ts_type} NOT NULL,
                published_at             {ts_type},
                archived_at              {ts_type}
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_portfolio_public "
            "ON portfolio_assets(destination,status,sort_order)"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_sha256 "
            "ON portfolio_assets(destination,sha256)"
        )

        # Admins may approve newly uploaded Portfolio images without waiting
        # for the repository manifest to be regenerated. The approval remains
        # hash-bound and auditable; it does not weaken authentication or the
        # five-language publishing requirements.
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS portfolio_publish_approvals (
                destination       TEXT NOT NULL,
                sha256            TEXT NOT NULL,
                approved_by       TEXT NOT NULL,
                approval_source   TEXT NOT NULL DEFAULT 'admin_upload_confirmation',
                usage_permission  TEXT NOT NULL DEFAULT 'approved',
                portrait_consent  TEXT NOT NULL DEFAULT 'approved_or_not_applicable',
                manual_review     TEXT NOT NULL DEFAULT 'approved',
                original_filename TEXT DEFAULT '',
                approved_at       {ts_type} NOT NULL,
                PRIMARY KEY (destination, sha256)
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_portfolio_approvals_time "
            "ON portfolio_publish_approvals(approved_at)"
        )

        # Persistent abuse protection for the driver-request email relay. The
        # client key is an HMAC digest; no raw IP or traveller details are kept.
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS driver_request_rate_limits (
                client_key         TEXT PRIMARY KEY,
                window_started_at  {ts_type} NOT NULL,
                request_count      {ts_type} NOT NULL DEFAULT 0,
                updated_at         {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_driver_request_limits_updated "
            "ON driver_request_rate_limits(updated_at)"
        )

        # Authenticated driver handoffs are retained as a minimal, private
        # conversation record so a WeChat-only traveller can receive a
        # driver's reply in the Mini Program. Anonymous email handoffs keep
        # their historical no-storage behaviour. The opaque reply capability
        # is stored only as a SHA-256 digest and is cleared after one use.
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS driver_requests (
                request_id              TEXT PRIMARY KEY,
                user_id                 TEXT,
                driver_id               TEXT NOT NULL,
                route_id                TEXT DEFAULT '',
                package_id              TEXT DEFAULT '',
                first_name              TEXT DEFAULT '',
                last_name               TEXT DEFAULT '',
                num_people              INTEGER,
                num_days                INTEGER,
                start_date              TEXT DEFAULT '',
                end_date                TEXT DEFAULT '',
                pickup_location         TEXT DEFAULT '',
                budget_range            TEXT DEFAULT '',
                requested_services      TEXT DEFAULT '[]',
                request_fingerprint     TEXT NOT NULL DEFAULT '',
                status                  TEXT NOT NULL DEFAULT 'pending',
                provider_message_id     TEXT DEFAULT '',
                reply_token_hash        TEXT,
                reply_token_expires_at  {ts_type},
                reply_used_at           {ts_type},
                created_at              {ts_type} NOT NULL,
                updated_at              {ts_type} NOT NULL,
                sent_at                 {ts_type}
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_driver_requests_user "
            "ON driver_requests(user_id,created_at)"
        )
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS driver_request_replies (
                id          TEXT PRIMARY KEY,
                request_id  TEXT UNIQUE NOT NULL,
                message     TEXT NOT NULL,
                created_at  {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_driver_request_replies_request "
            "ON driver_request_replies(request_id)"
        )

        # Privacy-minimised launch measurement. Events contain only a bounded
        # event name, page path and campaign labels; no contact details, raw IP,
        # cookie identifier or browser fingerprint is stored.
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS marketing_events (
                id            TEXT PRIMARY KEY,
                event_name    TEXT NOT NULL,
                page_path     TEXT NOT NULL,
                source        TEXT DEFAULT '',
                medium        TEXT DEFAULT '',
                campaign      TEXT DEFAULT '',
                content       TEXT DEFAULT '',
                lang          TEXT DEFAULT 'en',
                device_class  TEXT DEFAULT '',
                created_at    {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_marketing_events_created "
            "ON marketing_events(created_at)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_marketing_events_name_created "
            "ON marketing_events(event_name,created_at)"
        )
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS marketing_event_rate_limits (
                client_key         TEXT PRIMARY KEY,
                window_started_at  {ts_type} NOT NULL,
                request_count      {ts_type} NOT NULL DEFAULT 0,
                updated_at         {ts_type} NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_marketing_event_limits_updated "
            "ON marketing_event_rate_limits(updated_at)"
        )

        # Commit table/index creation BEFORE running migrations. On Postgres a
        # failing ALTER (e.g. column already exists) aborts the whole transaction;
        # without this commit the subsequent rollback would also undo any table
        # created above (this is exactly how guest_usage went missing in prod).
        conn.commit()

        # Retention cleanup also runs at service startup. Request-time cleanup
        # in main.py handles long-running instances between restarts.
        now = int(time.time())
        conn.execute(
            "DELETE FROM marketing_event_rate_limits WHERE updated_at < ?",
            (now - 24 * 60 * 60,),
        )
        conn.execute(
            "DELETE FROM marketing_events WHERE created_at < ?",
            (now - 180 * 24 * 60 * 60,),
        )
        conn.commit()

        # Legacy migrations: add columns on pre-existing tables (both backends)
        for col_sql in (
            "ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'",
            "ALTER TABLE users ADD COLUMN free_uses INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN beans INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'password'",
            "ALTER TABLE users ADD COLUMN google_sub TEXT",
            "ALTER TABLE users ADD COLUMN username TEXT",
            "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
            "ALTER TABLE users ADD COLUMN referral_code TEXT",
            "ALTER TABLE users ADD COLUMN signup_ip_hash TEXT",
            "ALTER TABLE product_trips ADD COLUMN professional_used INTEGER DEFAULT 0",
            "ALTER TABLE product_trips ADD COLUMN professional_route_entitlement INTEGER DEFAULT 0",
            "ALTER TABLE product_trips ADD COLUMN professional_adjustments_used INTEGER DEFAULT 0",
            "ALTER TABLE product_trips ADD COLUMN professional_adjustment_limit INTEGER",
            "ALTER TABLE product_trips ADD COLUMN professional_route_payload TEXT DEFAULT '{}'",
            "ALTER TABLE professional_route_orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'manual_qr'",
            "ALTER TABLE professional_route_orders ADD COLUMN provider_order_id TEXT",
            "ALTER TABLE professional_route_orders ADD COLUMN provider_capture_id TEXT",
            "ALTER TABLE professional_route_orders ADD COLUMN provider_status TEXT",
            "ALTER TABLE professional_route_orders ADD COLUMN updated_at " + ts_type,
            "ALTER TABLE professional_route_orders ADD COLUMN refunded_at " + ts_type,
        ):
            try:
                conn.execute(col_sql)
                conn.commit()
            except Exception:
                # column already exists — rollback so the connection stays usable
                try:
                    conn.rollback()
                except Exception:
                    pass

        # The first SQLite schema used ``email TEXT UNIQUE NOT NULL``. SQLite
        # cannot drop a column constraint in place, so rebuild that one table
        # transactionally while preserving every existing column and value.
        # PostgreSQL supports the migration directly. This is intentionally a
        # hard startup failure if the rebuild cannot be completed: creating a
        # WeChat-only account without a nullable email would be unsafe.
        try:
            if USE_POSTGRES:
                conn.execute("ALTER TABLE users ALTER COLUMN email DROP NOT NULL")
                conn.commit()
            else:
                _sqlite_make_users_email_nullable(conn)
                conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise

        for index_sql in (
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_orders_provider_order ON professional_route_orders(provider_order_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_orders_provider_capture ON professional_route_orders(provider_capture_id)",
        ):
            try:
                conn.execute(index_sql)
                conn.commit()
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass

        try:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)")
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass

        # Existing Google accounts remain fully compatible with the legacy
        # google_sub column while also becoming visible to the generic identity
        # table. No provider secret or credential is copied here.
        try:
            google_rows = conn.execute(
                "SELECT id,google_sub,email,created_at FROM users "
                "WHERE google_sub IS NOT NULL AND TRIM(google_sub) <> ''"
            ).fetchall()
            for row in google_rows:
                identity = dict(row)
                conn.execute(
                    """INSERT INTO auth_identities
                       (id,user_id,provider,provider_subject,email_at_provider,created_at,last_seen_at)
                       VALUES (?,?,?,?,?,?,?)
                       ON CONFLICT(provider,provider_subject) DO NOTHING""",
                    (
                        f"google-{identity['id']}", identity["id"], "google",
                        identity["google_sub"], identity.get("email"),
                        identity.get("created_at") or int(time.time()),
                        identity.get("created_at") or int(time.time()),
                    ),
                )
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise

        try:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)")
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass

        conn.commit()
    finally:
        conn.close()


# ─── Helpers for code outside ────────────────────────────────
def backend_name() -> str:
    return "postgres" if USE_POSTGRES else "sqlite"


def _sqlite_make_users_email_nullable(conn) -> None:
    """Rebuild legacy SQLite ``users`` only when email is still NOT NULL."""
    columns = [dict(row) for row in conn.execute("PRAGMA table_info(users)").fetchall()]
    email_column = next(
        (column for column in columns if str(column.get("name", "")).lower() == "email"),
        None,
    )
    if not email_column or not int(email_column.get("notnull") or 0):
        return

    schema_row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchone()
    schema_sql = dict(schema_row).get("sql") if schema_row else None
    if not schema_sql:
        raise RuntimeError("users schema is unavailable")

    rebuilt_sql = schema_sql.replace(
        "CREATE TABLE users", "CREATE TABLE users__email_nullable", 1
    )
    if rebuilt_sql == schema_sql:
        rebuilt_sql = re.sub(
            r"(?i)(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)[\"`\[]?users[\"`\]]?",
            r"\1users__email_nullable",
            schema_sql,
            count=1,
        )
    rebuilt_sql, replacements = re.subn(
        r"(?i)(\bemail\s+TEXT\s+UNIQUE)\s+NOT\s+NULL\b",
        r"\1",
        rebuilt_sql,
        count=1,
    )
    if "users__email_nullable" not in rebuilt_sql or replacements != 1:
        raise RuntimeError("could not prepare nullable users schema")

    conn.execute("ALTER TABLE users RENAME TO users__email_required")
    conn.execute(rebuilt_sql)
    column_names = [str(column["name"]) for column in columns]
    quoted = ", ".join('"' + name.replace('"', '""') + '"' for name in column_names)
    conn.execute(
        f"INSERT INTO users__email_nullable ({quoted}) "
        f"SELECT {quoted} FROM users__email_required"
    )
    conn.execute("DROP TABLE users__email_required")
    conn.execute("ALTER TABLE users__email_nullable RENAME TO users")

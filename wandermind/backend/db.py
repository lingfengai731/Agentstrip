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
import sqlite3
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
                email         TEXT UNIQUE NOT NULL,
                name          TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                lang          TEXT DEFAULT 'zh',
                preferences   TEXT DEFAULT '{{}}',
                free_uses     INTEGER DEFAULT 0,
                beans         INTEGER DEFAULT 0,
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

        # Commit table/index creation BEFORE running migrations. On Postgres a
        # failing ALTER (e.g. column already exists) aborts the whole transaction;
        # without this commit the subsequent rollback would also undo any table
        # created above (this is exactly how guest_usage went missing in prod).
        conn.commit()

        # Legacy migrations: add columns on pre-existing tables (both backends)
        for col_sql in (
            "ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'",
            "ALTER TABLE users ADD COLUMN free_uses INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN beans INTEGER DEFAULT 0",
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

        conn.commit()
    finally:
        conn.close()


# ─── Helpers for code outside ────────────────────────────────
def backend_name() -> str:
    return "postgres" if USE_POSTGRES else "sqlite"

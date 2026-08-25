"""Real-PostgreSQL integration tests for the persistent driver-request limiter.

The module is inert in ordinary local runs. CI supplies an isolated temporary
PostgreSQL service through DATABASE_URL; production databases must never be used.
"""

import os
import sys
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def _postgres_test_enabled():
    if not DATABASE_URL:
        return False
    parsed = urlparse(DATABASE_URL)
    if parsed.scheme not in {"postgres", "postgresql"}:
        return False
    if (
        os.getenv("WANDERMIND_ALLOW_LOCAL_POSTGRES_TESTS") != "1"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
    ):
        raise RuntimeError(
            "refusing to import the backend for PostgreSQL integration tests "
            "without an explicitly allowed loopback database"
        )
    return True


POSTGRES_ENABLED = _postgres_test_enabled()

if POSTGRES_ENABLED:
    BACKEND_DIR = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(BACKEND_DIR))

    import db  # noqa: E402
    import main  # noqa: E402


@unittest.skipUnless(POSTGRES_ENABLED, "requires an isolated PostgreSQL DATABASE_URL")
class DriverRateLimitPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init_db()
        cls.keys = []
        cls.marketing_keys = []

    @classmethod
    def tearDownClass(cls):
        conn = db.get_db()
        try:
            for key in cls.keys:
                conn.execute(
                    "DELETE FROM driver_request_rate_limits WHERE client_key=?",
                    (key,),
                )
            for key in cls.marketing_keys:
                conn.execute(
                    "DELETE FROM marketing_event_rate_limits WHERE client_key=?",
                    (key,),
                )
            conn.commit()
        finally:
            conn.close()

    @classmethod
    def new_key(cls, label):
        key = f"ci-{label}-{uuid.uuid4().hex}"
        cls.keys.append(key)
        return key

    @classmethod
    def new_marketing_key(cls, label):
        key = f"ci-marketing-{label}-{uuid.uuid4().hex}"
        cls.marketing_keys.append(key)
        return key

    def test_schema_uses_bigint_and_expected_index(self):
        conn = db.get_db()
        try:
            rows = conn.execute(
                """
                SELECT column_name,data_type
                FROM information_schema.columns
                WHERE table_schema=current_schema()
                  AND table_name='driver_request_rate_limits'
                """
            ).fetchall()
            indexes = conn.execute(
                """
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname=current_schema()
                  AND tablename='driver_request_rate_limits'
                """
            ).fetchall()
        finally:
            conn.close()

        column_types = {row["column_name"]: row["data_type"] for row in rows}
        self.assertEqual(
            column_types,
            {
                "client_key": "text",
                "window_started_at": "bigint",
                "request_count": "bigint",
                "updated_at": "bigint",
            },
        )
        self.assertIn(
            "idx_driver_request_limits_updated",
            {row["indexname"] for row in indexes},
        )

    def test_counter_is_atomic_across_postgres_connections(self):
        key = self.new_key("atomic")
        now = int(time.time())
        with ThreadPoolExecutor(max_workers=8) as pool:
            counts = list(
                pool.map(
                    lambda _: main._consume_driver_request_attempt(key, now),
                    range(8),
                )
            )

        self.assertEqual(
            sum(count <= main._DRIVER_REQUEST_LIMIT for count in counts),
            main._DRIVER_REQUEST_LIMIT,
        )
        self.assertEqual(max(counts), main._DRIVER_REQUEST_LIMIT + 1)

        conn = db.get_db()
        try:
            row = conn.execute(
                "SELECT request_count FROM driver_request_rate_limits WHERE client_key=?",
                (key,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["request_count"], main._DRIVER_REQUEST_LIMIT + 1)

    def test_schema_reinitialization_preserves_counter(self):
        key = self.new_key("restart")
        now = int(time.time())
        self.assertEqual(main._consume_driver_request_attempt(key, now), 1)
        db.init_db()
        self.assertEqual(main._consume_driver_request_attempt(key, now + 1), 2)

    def test_fixed_window_resets_at_boundary(self):
        key = self.new_key("window")
        started = int(time.time())
        for offset in range(main._DRIVER_REQUEST_LIMIT):
            self.assertEqual(
                main._consume_driver_request_attempt(key, started + offset),
                offset + 1,
            )
        self.assertEqual(
            main._consume_driver_request_attempt(key, started + 60),
            main._DRIVER_REQUEST_LIMIT + 1,
        )
        self.assertEqual(
            main._consume_driver_request_attempt(
                key, started + main._DRIVER_REQUEST_WINDOW_SECONDS
            ),
            1,
        )

    def test_marketing_counter_and_schema_are_postgres_safe(self):
        key = self.new_marketing_key("atomic")
        now = int(time.time())
        with ThreadPoolExecutor(max_workers=8) as pool:
            counts = list(
                pool.map(
                    lambda _: main._consume_marketing_event_attempt(key, now),
                    range(8),
                )
            )
        self.assertEqual(sorted(counts), list(range(1, 9)))

        conn = db.get_db()
        try:
            expired_event_id = str(uuid.uuid4())
            expired_key = self.new_marketing_key("expired")
            conn.execute(
                "INSERT INTO marketing_events "
                "(id,event_name,page_path,source,medium,campaign,content,lang,device_class,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    expired_event_id, "page_view", "/old", "", "", "", "",
                    "en", "desktop", now - main._MARKETING_EVENT_RETENTION_SECONDS - 1,
                ),
            )
            conn.execute(
                "INSERT INTO marketing_event_rate_limits "
                "(client_key,window_started_at,request_count,updated_at) VALUES (?,?,?,?)",
                (
                    expired_key, 1, 1,
                    now - main._MARKETING_LIMIT_RETENTION_SECONDS - 1,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        main._consume_marketing_event_attempt(self.new_marketing_key("purge"), now)

        conn = db.get_db()
        try:
            self.assertIsNone(
                conn.execute(
                    "SELECT 1 FROM marketing_events WHERE id=?", (expired_event_id,)
                ).fetchone()
            )
            self.assertIsNone(
                conn.execute(
                    "SELECT 1 FROM marketing_event_rate_limits WHERE client_key=?",
                    (expired_key,),
                ).fetchone()
            )
            columns = conn.execute(
                """
                SELECT column_name,data_type
                FROM information_schema.columns
                WHERE table_schema=current_schema()
                  AND table_name='marketing_events'
                """
            ).fetchall()
            indexes = conn.execute(
                """
                SELECT indexname FROM pg_indexes
                WHERE schemaname=current_schema()
                  AND tablename='marketing_events'
                """
            ).fetchall()
        finally:
            conn.close()
        column_types = {row["column_name"]: row["data_type"] for row in columns}
        self.assertEqual(column_types["created_at"], "bigint")
        self.assertEqual(column_types["event_name"], "text")
        self.assertIn(
            "idx_marketing_events_name_created",
            {row["indexname"] for row in indexes},
        )


if __name__ == "__main__":
    unittest.main()

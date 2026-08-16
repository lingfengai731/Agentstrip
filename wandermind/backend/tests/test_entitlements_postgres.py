"""Real-PostgreSQL concurrency tests for paid-route entitlements.

The module is inert in ordinary local runs. CI supplies an isolated temporary
PostgreSQL service; production databases are explicitly rejected.
"""

import asyncio
import os
import sys
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException


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
class EntitlementPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.init_db()
        cls.user_ids = []
        cls.trip_ids = []

    @classmethod
    def tearDownClass(cls):
        conn = db.get_db()
        try:
            for user_id in cls.user_ids:
                conn.execute("DELETE FROM route_points_ledger WHERE user_id=?", (user_id,))
                conn.execute("DELETE FROM professional_route_orders WHERE user_id=?", (user_id,))
            for trip_id in cls.trip_ids:
                conn.execute("DELETE FROM product_trips WHERE id=?", (trip_id,))
            for user_id in cls.user_ids:
                conn.execute("DELETE FROM users WHERE id=?", (user_id,))
            conn.commit()
        finally:
            conn.close()

    @classmethod
    def new_user(cls, label, role="user"):
        user_id = f"ci-user-{label}-{uuid.uuid4().hex}"
        cls.user_ids.append(user_id)
        conn = db.get_db()
        try:
            conn.execute(
                """INSERT INTO users
                   (id,email,name,password_hash,lang,email_verified,auth_provider,
                    role,referral_code,signup_ip_hash,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    user_id,
                    f"{user_id}@example.test",
                    label,
                    "unused-test-hash",
                    "en",
                    1,
                    "password",
                    role,
                    f"CI{uuid.uuid4().hex[:10].upper()}",
                    f"ci-ip-{uuid.uuid4().hex}",
                    int(time.time()),
                ),
            )
            conn.commit()
        finally:
            conn.close()
        return user_id

    @classmethod
    def new_trip(cls, user_id=None, anon_id=None):
        trip_id = f"ci-trip-{uuid.uuid4().hex}"
        cls.trip_ids.append(trip_id)
        now = int(time.time())
        conn = db.get_db()
        try:
            conn.execute(
                """INSERT INTO product_trips
                   (id,user_id,anon_id,destination,brief,rough_used,adjustments_used,
                    professional_used,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (trip_id, user_id, anon_id, "bali", "{}", 0, 0, 0, now, now),
            )
            conn.commit()
        finally:
            conn.close()
        return trip_id

    @staticmethod
    def call(coro):
        try:
            return 200, asyncio.run(coro)
        except HTTPException as exc:
            return exc.status_code, exc.detail

    def seed_points(self, user_id, points):
        conn = db.get_db()
        try:
            conn.execute(
                """INSERT INTO route_points_ledger
                   (id,user_id,delta,reason,ref_id,created_at)
                   VALUES (?,?,?,?,?,?)""",
                (
                    str(uuid.uuid4()), user_id, points, "ci_credit",
                    str(uuid.uuid4()), int(time.time()),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    @staticmethod
    def adjustment_request(days=5):
        return main.ProfessionalRouteAdjustReq(
            trip_profile={
                "audience": "first",
                "goals": ["local"],
                "travel_style": "comfort",
                "travellers": 2,
                "days": days,
                "pace": "balanced",
            },
            lang="en",
        )

    def test_anonymous_trip_claim_has_one_account_winner(self):
        anon_id = f"ci-anon-{uuid.uuid4().hex}"
        trip_id = self.new_trip(anon_id=anon_id)
        user_ids = [self.new_user("claim-a"), self.new_user("claim-b")]

        def create(user_id):
            return self.call(
                main.create_professional_route_order(
                    main.ProRouteOrderReq(trip_id=trip_id),
                    user={"sub": user_id},
                    anon_id=anon_id,
                )
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(create, user_ids))
        self.assertEqual(sorted(status for status, _ in responses), [200, 403])
        conn = db.get_db()
        try:
            owner = conn.execute(
                "SELECT user_id,anon_id FROM product_trips WHERE id=?", (trip_id,)
            ).fetchone()
            orders = conn.execute(
                "SELECT COUNT(*) AS n FROM professional_route_orders WHERE trip_id=?",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertIn(owner["user_id"], user_ids)
        self.assertIsNone(owner["anon_id"])
        self.assertEqual(orders["n"], 1)

    def test_concurrent_order_creation_returns_one_effective_order(self):
        user_id = self.new_user("orders")
        trip_id = self.new_trip(user_id)

        def create(_):
            return self.call(
                main.create_professional_route_order(
                    main.ProRouteOrderReq(trip_id=trip_id),
                    user={"sub": user_id},
                    anon_id=None,
                )
            )

        with ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(create, range(8)))
        self.assertEqual([status for status, _ in responses], [200] * 8)
        order_ids = {payload["order"]["id"] for _, payload in responses}
        self.assertEqual(len(order_ids), 1)
        conn = db.get_db()
        try:
            row = conn.execute(
                """SELECT COUNT(*) AS n FROM professional_route_orders
                   WHERE trip_id=? AND status IN ('pending','confirmed')""",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["n"], 1)

    def test_thirty_points_cannot_unlock_two_trips_concurrently(self):
        user_id = self.new_user("points")
        trip_ids = [self.new_trip(user_id), self.new_trip(user_id)]
        self.seed_points(user_id, 30)

        def redeem(trip_id):
            return self.call(
                main.redeem_referral_points(
                    main.ReferralRedeemReq(trip_id=trip_id),
                    user={"sub": user_id},
                    anon_id=None,
                )
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(redeem, trip_ids))
        self.assertEqual(sorted(status for status, _ in responses), [200, 402])
        conn = db.get_db()
        try:
            self.assertEqual(main._points_balance(conn, user_id), 0)
            confirmed = conn.execute(
                """SELECT COUNT(*) AS n FROM professional_route_orders
                   WHERE user_id=? AND status='confirmed'""",
                (user_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(confirmed["n"], 1)

    def test_concurrent_adjustments_stop_at_entitlement_limit(self):
        user_id = self.new_user("adjustments")
        trip_id = self.new_trip(user_id)
        conn = db.get_db()
        try:
            conn.execute(
                """UPDATE product_trips
                   SET professional_route_entitlement=1,
                       professional_adjustment_limit=3,
                       professional_adjustments_used=0
                   WHERE id=?""",
                (trip_id,),
            )
            conn.commit()
        finally:
            conn.close()

        def adjust(index):
            return self.call(
                main.adjust_bali_professional_route(
                    trip_id,
                    self.adjustment_request(5 + (index % 2)),
                    user={"sub": user_id},
                    anon_id=None,
                )
            )

        with ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(adjust, range(8)))
        self.assertEqual(sum(status == 200 for status, _ in responses), 3)
        self.assertEqual(sum(status == 402 for status, _ in responses), 5)
        conn = db.get_db()
        try:
            row = conn.execute(
                "SELECT professional_adjustments_used FROM product_trips WHERE id=?",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["professional_adjustments_used"], 3)

    def test_pending_manual_order_converts_to_points_without_duplication(self):
        user_id = self.new_user("pending-points")
        trip_id = self.new_trip(user_id)
        status, payload = self.call(
            main.create_professional_route_order(
                main.ProRouteOrderReq(trip_id=trip_id),
                user={"sub": user_id},
                anon_id=None,
            )
        )
        self.assertEqual(status, 200)
        pending_id = payload["order"]["id"]
        self.seed_points(user_id, 30)

        status, payload = self.call(
            main.redeem_referral_points(
                main.ReferralRedeemReq(trip_id=trip_id),
                user={"sub": user_id},
                anon_id=None,
            )
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["points_remaining"], 0)
        conn = db.get_db()
        try:
            rows = conn.execute(
                """SELECT id,amount_cents,currency,status,payment_reference
                   FROM professional_route_orders WHERE trip_id=?""",
                (trip_id,),
            ).fetchall()
        finally:
            conn.close()
        self.assertEqual(len(rows), 1)
        order = dict(rows[0])
        self.assertEqual(order["id"], pending_id)
        self.assertEqual(order["amount_cents"], 0)
        self.assertEqual(order["currency"], "POINTS")
        self.assertEqual(order["status"], "confirmed")
        self.assertEqual(order["payment_reference"], "route_points:30")

    def test_legacy_professional_order_consumes_exactly_ten_adjustments(self):
        user_id = self.new_user("legacy")
        trip_id = self.new_trip(user_id)
        now = int(time.time())
        conn = db.get_db()
        try:
            conn.execute(
                """UPDATE product_trips
                   SET professional_route_entitlement=1,
                       professional_adjustments_used=2,
                       professional_adjustment_limit=NULL
                   WHERE id=?""",
                (trip_id,),
            )
            conn.execute(
                """INSERT INTO professional_route_orders
                   (id,trip_id,user_id,amount_cents,currency,status,created_at,
                    confirmed_at,confirmed_by)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    str(uuid.uuid4()), trip_id, user_id, 990, "CNY", "confirmed",
                    now, now, user_id,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        for index in range(8):
            status, _ = self.call(
                main.adjust_bali_professional_route(
                    trip_id,
                    self.adjustment_request(5 + (index % 2)),
                    user={"sub": user_id},
                    anon_id=None,
                )
            )
            self.assertEqual(status, 200)
        status, detail = self.call(
            main.adjust_bali_professional_route(
                trip_id,
                self.adjustment_request(),
                user={"sub": user_id},
                anon_id=None,
            )
        )
        self.assertEqual(status, 402)
        self.assertEqual(detail["error"], "professional_route_adjustments_exhausted")
        conn = db.get_db()
        try:
            row = conn.execute(
                "SELECT professional_adjustments_used FROM product_trips WHERE id=?",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["professional_adjustments_used"], 10)

    def test_admin_adjustments_are_unlimited_and_not_counted(self):
        admin_id = self.new_user("admin", role="admin")
        trip_id = self.new_trip(admin_id)
        for index in range(10):
            status, _ = self.call(
                main.adjust_bali_professional_route(
                    trip_id,
                    self.adjustment_request(5 + (index % 2)),
                    user={"sub": admin_id},
                    anon_id=None,
                )
            )
            self.assertEqual(status, 200)
        conn = db.get_db()
        try:
            row = conn.execute(
                "SELECT professional_adjustments_used FROM product_trips WHERE id=?",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["professional_adjustments_used"], 0)

    def test_insufficient_points_leaves_no_partial_entitlement(self):
        user_id = self.new_user("rollback")
        trip_id = self.new_trip(user_id)
        status, detail = self.call(
            main.redeem_referral_points(
                main.ReferralRedeemReq(trip_id=trip_id),
                user={"sub": user_id},
                anon_id=None,
            )
        )
        self.assertEqual(status, 402)
        self.assertEqual(detail["error"], "insufficient_route_points")
        conn = db.get_db()
        try:
            trip = conn.execute(
                "SELECT professional_route_entitlement FROM product_trips WHERE id=?",
                (trip_id,),
            ).fetchone()
            orders = conn.execute(
                "SELECT COUNT(*) AS n FROM professional_route_orders WHERE trip_id=?",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(trip["professional_route_entitlement"], 0)
        self.assertEqual(orders["n"], 0)


if __name__ == "__main__":
    unittest.main()

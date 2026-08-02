import asyncio
import os
import sys
import tempfile
import time
import unittest
import uuid
from pathlib import Path

import httpx


TEST_DIR = tempfile.TemporaryDirectory(prefix="wandermind-product-test-")
os.environ.pop("DATABASE_URL", None)
os.environ["DB_PATH"] = str(Path(TEST_DIR.name) / "test.db")
os.environ["ENVIRONMENT"] = "development"
os.environ.pop("ADMIN_BOOTSTRAP_PASSWORD", None)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402
from db import get_db  # noqa: E402
from email_service import render_driver_request  # noqa: E402


class ProductAccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.user_id = cls._create_user("member@example.test", "member")
        cls.user_token = main.make_token(cls.user_id, "member@example.test")
        conn = get_db()
        try:
            admin = conn.execute(
                "SELECT id,email FROM users WHERE username='admin'"
            ).fetchone()
            assert admin
            cls.admin_id = admin["id"]
            cls.admin_token = main.make_token(admin["id"], admin["email"])
        finally:
            conn.close()

    @staticmethod
    def _create_user(email: str, name: str) -> str:
        uid = str(uuid.uuid4())
        conn = get_db()
        try:
            conn.execute(
                """INSERT INTO users
                   (id,email,name,password_hash,lang,email_verified,auth_provider,
                    role,referral_code,signup_ip_hash,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    uid,
                    email,
                    name,
                    main.hash_pw("safe-test-password"),
                    "en",
                    1,
                    "password",
                    "user",
                    f"REF{uuid.uuid4().hex[:7].upper()}",
                    f"ip-{uuid.uuid4().hex}",
                    int(time.time()),
                ),
            )
            conn.commit()
            return uid
        finally:
            conn.close()

    @staticmethod
    def _run(coro):
        return asyncio.run(coro)

    async def _request(self, method, path, *, token=None, json=None, anon_id=None):
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if anon_id:
            headers["X-Anon-Id"] = anon_id
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            return await client.request(method, path, headers=headers, json=json)

    def _new_trip(self, token=None, anon_id=None):
        response = self._run(
            self._request(
                "POST",
                "/api/product-trips",
                token=token,
                anon_id=anon_id,
                json={"destination": "bali", "brief": {"days": 5}},
            )
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["trip_id"]

    def test_normal_trip_has_one_rough_route_and_two_adjustments(self):
        trip_id = self._new_trip(token=self.user_token)
        for action in ("rough_route", "adjustment", "adjustment"):
            response = self._run(
                self._request(
                    "POST",
                    f"/api/product-trips/{trip_id}/consume",
                    token=self.user_token,
                    json={"action": action},
                )
            )
            self.assertEqual(response.status_code, 200, response.text)

        rough_over = self._run(
            self._request(
                "POST",
                f"/api/product-trips/{trip_id}/consume",
                token=self.user_token,
                json={"action": "rough_route"},
            )
        )
        adjustment_over = self._run(
            self._request(
                "POST",
                f"/api/product-trips/{trip_id}/consume",
                token=self.user_token,
                json={"action": "adjustment"},
            )
        )
        self.assertEqual(rough_over.status_code, 402)
        self.assertEqual(adjustment_over.status_code, 402)

    def test_admin_is_unlimited(self):
        trip_id = self._new_trip(token=self.admin_token)
        for _ in range(5):
            response = self._run(
                self._request(
                    "POST",
                    f"/api/product-trips/{trip_id}/consume",
                    token=self.admin_token,
                    json={"action": "rough_route"},
                )
            )
            self.assertEqual(response.status_code, 200, response.text)
            self.assertTrue(response.json()["admin_unlimited"])

    def test_anonymous_trip_can_be_claimed_after_login_with_same_session(self):
        anon_id = "anon_claim_test_123"
        trip_id = self._new_trip(anon_id=anon_id)
        claimed = self._run(
            self._request(
                "GET",
                f"/api/product-trips/{trip_id}/allowance",
                token=self.user_token,
                anon_id=anon_id,
            )
        )
        self.assertEqual(claimed.status_code, 200, claimed.text)
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT user_id,anon_id FROM product_trips WHERE id=?", (trip_id,)
            ).fetchone()
            self.assertEqual(row["user_id"], self.user_id)
            self.assertIsNone(row["anon_id"])
        finally:
            conn.close()

    def test_only_admin_can_confirm_and_confirmation_is_idempotent(self):
        trip_id = self._new_trip(token=self.user_token)
        order_response = self._run(
            self._request(
                "POST",
                "/api/professional-route/orders",
                token=self.user_token,
                json={"trip_id": trip_id},
            )
        )
        self.assertEqual(order_response.status_code, 200, order_response.text)
        order_id = order_response.json()["order"]["id"]

        list_denied = self._run(
            self._request(
                "GET",
                "/api/admin/professional-route/orders?status=pending",
                token=self.user_token,
            )
        )
        self.assertEqual(list_denied.status_code, 403)

        pending = self._run(
            self._request(
                "GET",
                "/api/admin/professional-route/orders?status=pending",
                token=self.admin_token,
            )
        )
        self.assertEqual(pending.status_code, 200, pending.text)
        self.assertIn(order_id, [order["id"] for order in pending.json()["orders"]])

        denied = self._run(
            self._request(
                "POST",
                f"/api/admin/professional-route/orders/{order_id}/confirm",
                token=self.user_token,
                json={"payment_reference": "test-payment"},
            )
        )
        self.assertEqual(denied.status_code, 403)

        first = self._run(
            self._request(
                "POST",
                f"/api/admin/professional-route/orders/{order_id}/confirm",
                token=self.admin_token,
                json={"payment_reference": "test-payment"},
            )
        )
        second = self._run(
            self._request(
                "POST",
                f"/api/admin/professional-route/orders/{order_id}/confirm",
                token=self.admin_token,
                json={"payment_reference": "test-payment"},
            )
        )
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertTrue(second.json()["already_confirmed"])

    def test_three_mature_invites_unlock_one_route_once(self):
        now = int(time.time())
        for index in range(3):
            invitee = self._create_user(
                f"invitee-{uuid.uuid4().hex}@example.test",
                f"invitee-{index}",
            )
            conn = get_db()
            try:
                conn.execute(
                    """INSERT INTO referrals
                       (id,inviter_user_id,invitee_user_id,status,available_at,created_at)
                       VALUES (?,?,?,?,?,?)""",
                    (
                        str(uuid.uuid4()),
                        self.user_id,
                        invitee,
                        "pending",
                        now - 1,
                        now - 86401,
                    ),
                )
                conn.commit()
            finally:
                conn.close()

        status = self._run(
            self._request("GET", "/api/referrals/status", token=self.user_token)
        )
        self.assertEqual(status.status_code, 200, status.text)
        self.assertGreaterEqual(status.json()["points"], 30)

        trip_id = self._new_trip(token=self.user_token)
        redeemed = self._run(
            self._request(
                "POST",
                "/api/referrals/redeem-professional-route",
                token=self.user_token,
                json={"trip_id": trip_id},
            )
        )
        self.assertEqual(redeemed.status_code, 200, redeemed.text)
        self.assertTrue(redeemed.json()["professional_route_unlocked"])

        repeated = self._run(
            self._request(
                "POST",
                "/api/referrals/redeem-professional-route",
                token=self.user_token,
                json={"trip_id": trip_id},
            )
        )
        self.assertEqual(repeated.status_code, 200, repeated.text)
        self.assertTrue(repeated.json()["already_unlocked"])

    def test_driver_email_has_selected_driver_and_no_unverified_fixed_rate(self):
        _, html, text = render_driver_request(
            {
                "driver_id": "gede",
                "first_name": "Test",
                "last_name": "Traveller",
                "contact_email": "traveller@example.test",
                "num_people": 2,
                "num_days": 5,
            }
        )
        self.assertIn("Gede", html)
        self.assertIn("Gede", text)
        self.assertNotIn("550", html)
        self.assertNotIn("550", text)

    def test_unknown_driver_is_rejected_before_email_delivery(self):
        response = self._run(
            self._request(
                "POST",
                "/api/driver-request",
                json={
                    "driver_id": "invented-driver",
                    "first_name": "Test",
                    "contact_email": "traveller@example.test",
                },
            )
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()

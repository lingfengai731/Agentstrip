import asyncio
import hashlib
import json
import os
import sys
import tempfile
import time
import unittest
import uuid
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException


TEST_DIR = tempfile.TemporaryDirectory(prefix="wandermind-product-test-")
os.environ.pop("DATABASE_URL", None)
os.environ["DB_PATH"] = str(Path(TEST_DIR.name) / "test.db")
os.environ["ENVIRONMENT"] = "development"
os.environ.pop("ADMIN_BOOTSTRAP_PASSWORD", None)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import email_service  # noqa: E402
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

    def setUp(self):
        main._driver_request_attempts.clear()

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

    def test_professional_route_is_deterministic_and_masks_seven_day_preview(self):
        profile = {
            "audience": "first",
            "goals": ["photo", "local"],
            "travel_style": "comfort",
            "travellers": 2,
            "departure_date": "2026-10-01",
            "return_date": "2026-10-08",
            "days": 7,
            "budget_range": "15000-25000",
            "pace": "balanced",
            "origin_region": "Shanghai",
        }
        anon_id = "professional_preview_test_123"
        first = self._run(
            self._request(
                "POST",
                "/api/bali/professional-route",
                anon_id=anon_id,
                json={"trip_profile": profile, "lang": "en"},
            )
        )
        self.assertEqual(first.status_code, 200, first.text)
        first_payload = first.json()
        route = first_payload["route"]
        self.assertEqual(route["preview_days"], 5)
        self.assertEqual(route["locked_days"], 2)
        self.assertEqual(len(route["days_plan"]), 7)
        self.assertEqual(sum(1 for day in route["days_plan"] if day["locked"]), 2)
        self.assertFalse(route["unlocked"])

        second = self._run(
            self._request(
                "POST",
                "/api/bali/professional-route",
                anon_id=anon_id,
                json={
                    "trip_id": first_payload["trip_id"],
                    "trip_profile": profile,
                    "lang": "en",
                },
            )
        )
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(second.json()["route"]["route_id"], route["route_id"])
        self.assertEqual(second.json()["route"]["days_plan"], route["days_plan"])

    def test_professional_preview_keeps_at_least_one_day_locked(self):
        for days, expected in {3: (2, 1), 5: (4, 1), 7: (5, 2)}.items():
            with self.subTest(days=days):
                route = main._professional_route_document(
                    {
                        "audience": "first",
                        "goals": ["local"],
                        "travel_style": "comfort",
                        "travellers": 2,
                        "days": days,
                        "pace": "balanced",
                    },
                    lang="en",
                )
                self.assertEqual(
                    (route["preview_days"], route["locked_days"]),
                    expected,
                )
                preview = main._public_professional_route(route, False, "en")
                self.assertEqual(
                    sum(1 for day in preview["days_plan"] if day["locked"]),
                    expected[1],
                )

    def test_professional_adjustment_endpoint_is_separate_from_ai_quota(self):
        self.assertEqual(main.PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT, 3)
        profile = {
            "audience": "first",
            "goals": ["local"],
            "travel_style": "comfort",
            "travellers": 2,
            "days": 5,
            "pace": "balanced",
        }
        created = self._run(
            self._request(
                "POST",
                "/api/bali/professional-route",
                token=self.user_token,
                json={"trip_profile": profile, "lang": "en"},
            )
        )
        self.assertEqual(created.status_code, 200, created.text)
        trip_id = created.json()["trip_id"]
        order = self._run(
            self._request(
                "POST",
                "/api/professional-route/orders",
                token=self.user_token,
                json={"trip_id": trip_id},
            )
        )
        self.assertEqual(order.status_code, 200, order.text)
        order_id = order.json()["order"]["id"]
        confirmed = self._run(
            self._request(
                "POST",
                f"/api/admin/professional-route/orders/{order_id}/confirm",
                token=self.admin_token,
                json={"payment_reference": "separate-quota-test"},
            )
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.text)

        changed_profile = {**profile, "days": 6}
        bypass = self._run(
            self._request(
                "POST",
                "/api/bali/professional-route",
                token=self.user_token,
                json={
                    "trip_id": trip_id,
                    "trip_profile": changed_profile,
                    "lang": "en",
                },
            )
        )
        self.assertEqual(bypass.status_code, 409, bypass.text)
        self.assertEqual(
            bypass.json()["detail"]["error"],
            "professional_route_adjustment_required",
        )

        for action in ("rough_route", "adjustment", "adjustment"):
            consumed = self._run(
                self._request(
                    "POST",
                    f"/api/product-trips/{trip_id}/consume",
                    token=self.user_token,
                    json={"action": action},
                )
            )
            self.assertEqual(consumed.status_code, 200, consumed.text)

        adjustment_profiles = (
            {
                **profile,
                "departure_date": "2026-10-01",
                "return_date": "2026-10-07",
                "days": 6,
                "travellers": 3,
            },
            {
                **profile,
                "pace": "slow",
                "budget_range": 9000,
                "goals": ["photo", "value"],
            },
            {**profile, "travel_style": "luxury", "travellers": 4},
        )
        for expected_remaining, adjusted_profile in zip(
            (2, 1, 0), adjustment_profiles
        ):
            adjustment = self._run(
                self._request(
                    "POST",
                    f"/api/bali/professional-route/{trip_id}/adjust",
                    token=self.user_token,
                    json={"trip_profile": adjusted_profile, "lang": "en"},
                )
            )
            self.assertEqual(adjustment.status_code, 200, adjustment.text)
            self.assertEqual(
                adjustment.json()["professional_adjustments_remaining"],
                expected_remaining,
            )

        exhausted = self._run(
            self._request(
                "POST",
                f"/api/bali/professional-route/{trip_id}/adjust",
                token=self.user_token,
                json={"trip_profile": profile, "lang": "en"},
            )
        )
        self.assertEqual(exhausted.status_code, 402, exhausted.text)
        self.assertEqual(
            exhausted.json()["detail"]["error"],
            "professional_route_adjustments_exhausted",
        )
        self.assertEqual(exhausted.json()["detail"]["limit"], 3)

        conn = get_db()
        try:
            stored = conn.execute(
                "SELECT professional_adjustments_used,professional_adjustment_limit FROM product_trips WHERE id=?",
                (trip_id,),
            ).fetchone()
            self.assertEqual(stored["professional_adjustments_used"], 3)
            self.assertEqual(stored["professional_adjustment_limit"], 3)
        finally:
            conn.close()

    def test_legacy_confirmed_professional_order_keeps_ten_adjustments(self):
        trip_id = self._new_trip(token=self.user_token)
        now = int(time.time())
        conn = get_db()
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
                   (id,trip_id,user_id,amount_cents,currency,status,created_at,confirmed_at,confirmed_by)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    str(uuid.uuid4()), trip_id, self.user_id, 990, "CNY",
                    "confirmed", now, now, self.admin_id,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        allowance = self._run(
            self._request(
                "GET",
                f"/api/product-trips/{trip_id}/allowance",
                token=self.user_token,
            )
        )
        self.assertEqual(allowance.status_code, 200, allowance.text)
        self.assertEqual(allowance.json()["professional_adjustment_limit"], 10)
        self.assertEqual(allowance.json()["professional_adjustments_remaining"], 8)

    def test_frontend_has_separate_professional_and_ai_entry_contracts(self):
        frontend_dir = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        index_html = (frontend_dir / "index.html").read_text(encoding="utf-8")
        bali_html = (frontend_dir / "bali.html").read_text(encoding="utf-8")
        ai_js = (frontend_dir / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )
        professional_js = (
            frontend_dir / "assets" / "js" / "bali-professional.js"
        ).read_text(encoding="utf-8")
        self.assertIn("bali.html#professional-planner", index_html)
        self.assertIn("ai-tool.html?mode=diy", index_html)
        self.assertIn('id="professional-planner"', bali_html)
        self.assertIn("assets/js/bali-professional.js", bali_html)
        self.assertNotIn("ai-tool.html?professional=1", bali_html)
        self.assertNotIn("professional_requested", ai_js)
        self.assertIn("history.replaceState({}, document.title, window.location.pathname);", ai_js)
        self.assertIn("authHeaders()", ai_js)
        self.assertIn("requestAuthRecovery()", ai_js)
        self.assertIn("/adjust", professional_js)
        self.assertEqual(professional_js.count("adjustScope:"), 5)
        self.assertIn('data-i18n="baliRouteSectionSub"', bali_html)

    def test_only_admin_can_confirm_and_confirmation_is_idempotent(self):
        trip_id = self._new_trip(token=self.user_token)
        for action in ("rough_route", "adjustment", "adjustment"):
            consumed = self._run(
                self._request(
                    "POST",
                    f"/api/product-trips/{trip_id}/consume",
                    token=self.user_token,
                    json={"action": action},
                )
            )
            self.assertEqual(consumed.status_code, 200, consumed.text)
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

        allowance = self._run(
            self._request(
                "GET",
                f"/api/product-trips/{trip_id}/allowance",
                token=self.user_token,
            )
        )
        self.assertEqual(allowance.status_code, 200, allowance.text)
        self.assertTrue(allowance.json()["professional_route_entitlement"])
        self.assertEqual(
            allowance.json()["professional_adjustments_remaining"],
            main.PROFESSIONAL_ROUTE_ADJUSTMENT_LIMIT,
        )

        ai_adjustment = self._run(
            self._request(
                "POST",
                f"/api/product-trips/{trip_id}/consume",
                token=self.user_token,
                json={"action": "adjustment"},
            )
        )
        self.assertEqual(ai_adjustment.status_code, 402, ai_adjustment.text)
        self.assertEqual(ai_adjustment.json()["detail"]["error"], "ai_usage_exhausted")

        professional = self._run(
            self._request(
                "POST",
                f"/api/product-trips/{trip_id}/consume",
                token=self.user_token,
                json={"action": "professional_route"},
            )
        )
        self.assertEqual(professional.status_code, 200, professional.text)
        self.assertEqual(
            professional.json()["professional_route"]["remaining"], 0
        )
        exhausted = self._run(
            self._request(
                "POST",
                f"/api/product-trips/{trip_id}/consume",
                token=self.user_token,
                json={"action": "adjustment"},
            )
        )
        self.assertEqual(exhausted.status_code, 402)

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

        allowance = self._run(
            self._request(
                "GET",
                f"/api/product-trips/{trip_id}/allowance",
                token=self.user_token,
            )
        )
        self.assertEqual(allowance.status_code, 200, allowance.text)
        self.assertTrue(allowance.json()["professional_route_entitlement"])
        self.assertEqual(allowance.json()["professional_adjustments_remaining"], 3)

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

        professional = self._run(
            self._request(
                "POST",
                f"/api/product-trips/{trip_id}/consume",
                token=self.user_token,
                json={"action": "professional_route"},
            )
        )
        self.assertEqual(professional.status_code, 200, professional.text)
        self.assertEqual(
            professional.json()["consumed_action"], "professional_route"
        )

    def test_anonymous_ai_requires_login_even_with_rotating_session_ids(self):
        quota = self._run(
            self._request("GET", "/api/quota", anon_id="rotating_id_000")
        )
        self.assertEqual(quota.status_code, 200, quota.text)
        self.assertTrue(quota.json()["login_required"])
        self.assertFalse(quota.json()["can_use"])

        for anon_id in ("rotating_id_001", "rotating_id_002", "rotating_id_003"):
            with self.assertRaises(HTTPException) as denied:
                main.consume_quota(None, anon_id)
            self.assertEqual(denied.exception.status_code, 401)

        anonymous_trip = self._new_trip(anon_id="anonymous_trip_001")
        response = self._run(
            self._request(
                "POST",
                "/api/chat/once",
                anon_id="anonymous_trip_001",
                json={
                    "messages": [{"role": "user", "content": "Plan Bali"}],
                    "system": "test",
                    "product_trip_id": anonymous_trip,
                    "trip_action": "rough_route",
                },
            )
        )
        self.assertEqual(response.status_code, 401, response.text)

        protected_requests = (
            ("POST", "/api/dest_info", {"destination": "Uncached Test City", "lang": "en"}),
            (
                "POST",
                "/api/search/flights",
                {
                    "origin": "PVG",
                    "destination": "DPS",
                    "depart_date": "2026-10-01",
                    "adults": 1,
                },
            ),
            (
                "POST",
                "/api/search/hotels",
                {
                    "destination": "Bali",
                    "check_in": "2026-10-01",
                    "check_out": "2026-10-03",
                    "adults": 1,
                },
            ),
            ("POST", "/api/share/ABC123/fuse", {"guest_name": "Guest", "guest_prefs": {}}),
        )
        for method, path, payload in protected_requests:
            denied = self._run(self._request(method, path, json=payload))
            self.assertEqual(denied.status_code, 401, f"{path}: {denied.text}")

        custom_weather = self._run(
            self._request("GET", "/api/weather?city=Uncached%20Test%20City&lang=en")
        )
        self.assertEqual(custom_weather.status_code, 401, custom_weather.text)

        cache_key = ("cached test city", "en")
        main._DEST_INFO_CACHE[cache_key] = (
            time.time(),
            {"timezone": "UTC", "regions": [{"name": "Public"}]},
        )
        try:
            cached = self._run(
                self._request(
                    "POST",
                    "/api/dest_info",
                    json={"destination": "Cached Test City", "lang": "en"},
                )
            )
            self.assertEqual(cached.status_code, 401, cached.text)
        finally:
            main._DEST_INFO_CACHE.pop(cache_key, None)

        weather_cache_key = ("denpasar,id", "en")
        main._WEATHER_CACHE[weather_cache_key] = (
            time.time(),
            {"city": "Denpasar", "source": "cache"},
        )
        try:
            normalized_weather = self._run(
                self._request("GET", "/api/weather?city=bali&lang=attacker-value")
            )
            self.assertEqual(
                normalized_weather.status_code, 200, normalized_weather.text
            )
            self.assertEqual(normalized_weather.json()["source"], "cache")
        finally:
            main._WEATHER_CACHE.pop(weather_cache_key, None)

        private_weather_key = ("private test city", "en")
        main._WEATHER_CACHE[private_weather_key] = (
            time.time(),
            {"city": "Private Test City", "source": "cache"},
        )
        try:
            private_weather = self._run(
                self._request(
                    "GET",
                    "/api/weather?city=Private%20Test%20City&lang=en",
                )
            )
            self.assertEqual(private_weather.status_code, 401, private_weather.text)
        finally:
            main._WEATHER_CACHE.pop(private_weather_key, None)

    def test_curated_destination_intel_is_public_localized_and_model_free(self):
        aliases = {
            "Bali, Indonesia": "bali",
            "Kyoto, Japan": "kyoto",
            "Paris, France": "paris",
            "Santorini, Greece": "santorini",
        }
        with patch.object(
            main,
            "_route",
            side_effect=AssertionError("curated destination request called model routing"),
        ):
            for destination, expected_key in aliases.items():
                localized_seasons = set()
                for lang in ("zh", "en", "ja", "ko", "id"):
                    response = self._run(
                        self._request(
                            "POST",
                            "/api/dest_info",
                            json={"destination": destination, "lang": lang},
                        )
                    )
                    self.assertEqual(response.status_code, 200, response.text)
                    payload = response.json()
                    self.assertEqual(payload["destination_key"], expected_key)
                    self.assertEqual(payload["source_kind"], "curated")
                    self.assertEqual(payload["meta"]["language"], lang)
                    self.assertEqual(len(payload["regions"]), 3)
                    self.assertEqual(len(payload["tips"]), 2)
                    self.assertEqual(len(payload["hotelAreas"]), 3)
                    self.assertNotIn("weather", payload)
                    self.assertIn("exchange_rate", payload["meta"]["dynamic_fields"])
                    self.assertTrue(
                        all(
                            source["url"].startswith("https://")
                            for source in payload["meta"]["sources"]
                        )
                    )
                    localized_seasons.add(payload["season"])
                self.assertEqual(len(localized_seasons), 5, destination)

        invalid_lang = self._run(
            self._request(
                "POST",
                "/api/dest_info",
                json={"destination": "Bali", "lang": "attacker-value"},
            )
        )
        self.assertEqual(invalid_lang.status_code, 200, invalid_lang.text)
        self.assertEqual(invalid_lang.json()["meta"]["language"], "en")

    def test_curated_destination_aliases_do_not_match_custom_places(self):
        cache_key = ("paris, texas", "en")
        main._DEST_INFO_CACHE[cache_key] = (
            time.time(),
            {"source_kind": "ai_generated", "season": "cached private draft"},
        )
        custom = self._run(
            self._request(
                "POST",
                "/api/dest_info",
                json={"destination": "Paris, Texas", "lang": "en"},
            )
        )
        self.assertEqual(custom.status_code, 401, custom.text)
        main._DEST_INFO_CACHE.pop(cache_key, None)

        enhanced = self._run(
            self._request(
                "POST",
                "/api/dest_info",
                json={
                    "destination": "Bali",
                    "lang": "en",
                    "enhance": True,
                },
            )
        )
        self.assertEqual(enhanced.status_code, 401, enhanced.text)

    def test_curated_destination_dataset_has_complete_language_contract(self):
        destinations = main._CURATED_DEST_INFO["destinations"]
        self.assertEqual(set(destinations), {"bali", "kyoto", "paris", "santorini"})
        for destination_key, entry in destinations.items():
            self.assertEqual(
                set(entry["content"]), {"zh", "en", "ja", "ko", "id"},
                destination_key,
            )
            self.assertTrue(entry["aliases"], destination_key)
            for lang, content in entry["content"].items():
                self.assertEqual(len(content["regions"]), 3, (destination_key, lang))
                self.assertEqual(len(content["tips"]), 2, (destination_key, lang))
                self.assertEqual(len(content["hotelAreas"]), 3, (destination_key, lang))
                self.assertNotIn("weather", content, (destination_key, lang))

    def test_driver_email_has_selected_driver_and_no_unverified_fixed_rate(self):
        _, html, text = render_driver_request(
            {
                "driver_id": "gede",
                "route_id": "R5",
                "first_name": "Test",
                "last_name": "Traveller",
                "contact_email": "traveller@example.test",
                "num_people": 2,
                "num_days": 5,
            }
        )
        self.assertIn("Gede", html)
        self.assertIn("Gede", text)
        self.assertIn("R5", html)
        self.assertIn("R5", text)
        self.assertNotIn("550", html)
        self.assertNotIn("550", text)

    def test_driver_email_forwards_only_the_traveller_email(self):
        _, html, text = render_driver_request(
            {
                "driver_id": "gede",
                "first_name": "Test",
                "contact_email": "traveller@example.test",
                "contact_whatsapp": "private-wa-value",
                "contact_phone": "private-phone-value",
            }
        )
        self.assertIn("traveller@example.test", html)
        self.assertIn("traveller@example.test", text)
        self.assertNotIn("private-wa-value", html)
        self.assertNotIn("private-wa-value", text)
        self.assertNotIn("private-phone-value", html)
        self.assertNotIn("private-phone-value", text)

    def test_driver_email_routing_uses_private_env_or_owner_fallback(self):
        cases = (
            ("dicky", "dicky@example.test", "", "dicky@example.test", "owner@example.test"),
            ("dicky", "", "", "owner@example.test", None),
            ("gede", "", "gede@example.test", "gede@example.test", "owner@example.test"),
            ("gede", "", "", "owner@example.test", None),
        )
        for driver_id, dicky_email, gede_email, recipient, bcc in cases:
            with self.subTest(driver_id=driver_id, recipient=recipient, bcc=bcc):
                with (
                    patch.object(email_service, "DRIVER_EMAIL", dicky_email),
                    patch.object(email_service, "GEDE_DRIVER_EMAIL", gede_email),
                    patch.object(email_service, "OWNER_BCC_EMAIL", "owner@example.test"),
                    patch.object(email_service, "send_email", new_callable=AsyncMock) as send,
                ):
                    send.return_value = {"ok": True, "id": "email-test"}
                    result = self._run(
                        email_service.send_driver_request(
                            {
                                "driver_id": driver_id,
                                "first_name": "Test",
                                "contact_email": "traveller@example.test",
                            }
                        )
                    )
                self.assertTrue(result["ok"])
                self.assertEqual(send.await_args.args[0], recipient)
                self.assertEqual(send.await_args.kwargs["bcc"], bcc)
                self.assertEqual(send.await_args.kwargs["reply_to"], "traveller@example.test")

    def test_driver_request_passes_route_and_trip_details_to_selected_driver(self):
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            send.return_value = {"ok": True}
            response = self._run(
                self._request(
                    "POST",
                    "/api/driver-request",
                    json={
                        "driver_id": "dicky",
                        "route_id": "r5",
                        "first_name": "Test",
                        "contact_email": "traveller@example.test",
                        "num_people": 3,
                        "num_days": 7,
                        "attractions": "Day 1: Ubud\nDay 2: Sidemen",
                        "start_date": "2026-10-01",
                        "end_date": "2026-10-08",
                        "budget_range": "USD 6000",
                        "privacy_consent": True,
                    },
                )
            )
        self.assertEqual(response.status_code, 200, response.text)
        payload = send.await_args.args[0]
        self.assertEqual(payload["driver_id"], "dicky")
        self.assertEqual(payload["route_id"], "R5")
        self.assertEqual(payload["num_people"], 3)
        self.assertEqual(payload["start_date"], "2026-10-01")
        self.assertEqual(payload["end_date"], "2026-10-08")
        self.assertEqual(payload["budget_range"], "USD 6000")
        self.assertIn("Day 2: Sidemen", payload["attractions"])

    def test_driver_request_requires_explicit_privacy_consent(self):
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            response = self._run(
                self._request(
                    "POST", "/api/driver-request", json={
                        "driver_id": "dicky", "first_name": "Test",
                        "contact_email": "traveller@example.test",
                    }
                )
            )
        self.assertEqual(response.status_code, 400, response.text)
        send.assert_not_awaited()

    def test_driver_request_requires_email_instead_of_phone_or_whatsapp(self):
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            send.return_value = {"ok": True}
            response = self._run(
                self._request(
                    "POST", "/api/driver-request", json={
                        "driver_id": "dicky", "first_name": "Test",
                        "contact_whatsapp": "private-wa-value",
                        "contact_phone": "private-phone-value",
                        "privacy_consent": True,
                    }
                )
            )
        self.assertEqual(response.status_code, 400, response.text)
        send.assert_not_awaited()

    def test_driver_request_honeypot_does_not_deliver_email(self):
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            response = self._run(
                self._request(
                    "POST", "/api/driver-request", json={
                        "driver_id": "dicky", "first_name": "Test",
                        "contact_email": "traveller@example.test",
                        "privacy_consent": True, "website": "https://spam.example",
                    }
                )
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"ok": True, "delivered": False})
        send.assert_not_awaited()

    def test_driver_request_rate_limit_blocks_sixth_attempt(self):
        payload = {
            "driver_id": "dicky", "first_name": "Test",
            "contact_email": "traveller@example.test", "privacy_consent": True,
        }
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            send.return_value = {"ok": True}
            responses = [self._run(self._request("POST", "/api/driver-request", json=payload)) for _ in range(6)]
        self.assertEqual([response.status_code for response in responses[:5]], [200] * 5)
        self.assertEqual(responses[5].status_code, 429, responses[5].text)
        self.assertEqual(send.await_count, 5)

    def test_bali_route_map_has_coordinates_for_every_region(self):
        data_path = (
            BACKEND_DIR.parents[1]
            / "wandermind-studio"
            / "frontend"
            / "assets"
            / "data"
            / "bali-travel-data.json"
        )
        data = json.loads(data_path.read_text(encoding="utf-8"))
        region_ids = {region["id"] for region in data["regions"]}
        geo_coordinates = set()
        self.assertEqual(len(region_ids), 7)
        for region in data["regions"]:
            self.assertIn("map", region)
            self.assertIn("geo", region)
            self.assertEqual(
                set(region["name"]),
                {"zh", "en", "ja", "ko", "id"},
                region["id"],
            )
            self.assertGreaterEqual(region["map"]["x"], 0)
            self.assertLessEqual(region["map"]["x"], 100)
            self.assertGreaterEqual(region["map"]["y"], 0)
            self.assertLessEqual(region["map"]["y"], 100)
            self.assertGreaterEqual(region["geo"]["lat"], -9.0)
            self.assertLessEqual(region["geo"]["lat"], -8.0)
            self.assertGreaterEqual(region["geo"]["lng"], 114.8)
            self.assertLessEqual(region["geo"]["lng"], 115.8)
            self.assertEqual(region["geo"]["source"], "OpenStreetMap Nominatim")
            self.assertEqual(region["geo"]["role"], "planning_anchor")
            self.assertIn(region["geo"]["verification_status"], data["verification_states"])
            self.assertTrue(region["geo"]["anchor"], region["id"])
            geo_coordinates.add((region["geo"]["lat"], region["geo"]["lng"]))
        self.assertEqual(len(geo_coordinates), 7)
        for route in data["routes"]:
            self.assertEqual(
                set(route["name"]),
                {"zh", "en", "ja", "ko", "id"},
                route["id"],
            )
            self.assertEqual(
                set(route["promise"]),
                {"zh", "en", "ja", "ko", "id"},
                route["id"],
            )
            referenced = set(route.get("base_regions", []))
            referenced.update(route.get("optional_regions", []))
            self.assertTrue(referenced.issubset(region_ids), route["id"])
            outline = route.get("free_outline", [])
            self.assertGreaterEqual(len(outline), 2, route["id"])
            self.assertEqual(
                [item["day"] for item in outline],
                list(range(1, len(outline) + 1)),
                route["id"],
            )
            self.assertTrue(
                {item["region_id"] for item in outline}.issubset(referenced),
                route["id"],
            )

        route_ids = {route["id"] for route in data["routes"]}
        poi_ids = [poi["id"] for poi in data["pois"]]
        poi_by_id = {poi["id"]: poi for poi in data["pois"]}
        self.assertEqual(len(poi_ids), len(set(poi_ids)))
        verification_states = {
            "verified",
            "pending_review",
            "needs_supplier_confirmation",
            "retired",
        }
        for poi in data["pois"]:
            self.assertIn(poi["region_id"], region_ids, poi["id"])
            self.assertTrue(set(poi["route_ids"]).issubset(route_ids), poi["id"])
            self.assertIsInstance(poi["name"], str, poi["id"])
            self.assertTrue(poi["name"].strip(), poi["id"])
            self.assertIn(poi["verification_status"], verification_states, poi["id"])
        self.assertEqual(
            {poi["verification_status"] for poi in data["pois"]},
            {"pending_review"},
            "No Bali POI should be presented as verified before source review",
        )
        for route in data["routes"]:
            outline_regions = {item["region_id"] for item in route["free_outline"]}
            compatible = [
                poi
                for poi in data["pois"]
                if route["id"] in poi["route_ids"]
                and poi["region_id"] in outline_regions
            ]
            self.assertTrue(compatible, route["id"])
            self.assertEqual(
                len(route["free_outline"]),
                route["recommended_days"]["ideal"],
                route["id"],
            )
            suggested_ids = []
            for day in route["free_outline"]:
                self.assertEqual(
                    set(day["theme"]),
                    {"zh", "en", "ja", "ko", "id"},
                    (route["id"], day["day"]),
                )
                self.assertIn("suggested_poi_ids", day, (route["id"], day["day"]))
                self.assertGreaterEqual(len(day["suggested_poi_ids"]), 1)
                self.assertLessEqual(len(day["suggested_poi_ids"]), 2)
                for poi_id in day["suggested_poi_ids"]:
                    self.assertIn(poi_id, poi_by_id, poi_id)
                    self.assertEqual(poi_by_id[poi_id]["region_id"], day["region_id"])
                    self.assertIn(
                        route["id"],
                        poi_by_id[poi_id]["route_ids"],
                        (route["id"], day["day"], poi_id),
                    )
                    suggested_ids.append(poi_id)
            self.assertEqual(len(suggested_ids), len(set(suggested_ids)), route["id"])

    def test_bali_route_map_uses_pinned_leaflet_with_fallback(self):
        html = (
            BACKEND_DIR.parents[1]
            / "wandermind-studio"
            / "frontend"
            / "bali.html"
        ).read_text(encoding="utf-8")
        self.assertEqual(html.count("leaflet@1.9.4/dist/leaflet"), 2)
        self.assertIn("sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=", html)
        self.assertIn("sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=", html)
        self.assertIn("tile.openstreetmap.org/{z}/{x}/{y}.png", html)
        self.assertIn("data-route-map-fallback", html)
        self.assertIn("if (!window.L) { loadRouteMapFallback(canvas); return; }", html)
        self.assertIn("if (tileFailed) return;", html)
        self.assertIn("canvas.classList.remove('leaflet-ready')", html)
        self.assertIn("event.key !== 'Enter' && event.key !== ' '", html)
        self.assertIn("prefers-reduced-motion: reduce", html)

    def test_portfolio_manager_requires_admin_and_storage_configuration(self):
        denied = self._run(
            self._request("GET", "/api/admin/portfolio", token=self.user_token)
        )
        self.assertEqual(denied.status_code, 403)

        with patch.dict(
            os.environ,
            {
                "CLOUDINARY_CLOUD_NAME": "",
                "CLOUDINARY_API_KEY": "",
                "CLOUDINARY_API_SECRET": "",
            },
            clear=False,
        ):
            disabled = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/upload-signature",
                    token=self.admin_token,
                    json={"destination": "bali", "filename": "lovina.jpg"},
                )
            )
        self.assertEqual(disabled.status_code, 503)
        self.assertNotIn("secret", disabled.text.lower())

    def test_portfolio_signed_upload_publish_hide_replace_and_reorder(self):
        cloud_env = {
            "CLOUDINARY_CLOUD_NAME": "wandermind-test",
            "CLOUDINARY_API_KEY": "public-test-key",
            "CLOUDINARY_API_SECRET": "portfolio-test-secret",
        }

        def signed_upload(filename, suffix, *, replacement_asset_id=""):
            request_json = {"destination": "bali", "filename": filename}
            if replacement_asset_id:
                request_json["replacement_asset_id"] = replacement_asset_id
            signature_response = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/upload-signature",
                    token=self.admin_token,
                    json=request_json,
                )
            )
            self.assertEqual(signature_response.status_code, 200, signature_response.text)
            signature_payload = signature_response.json()
            self.assertNotIn("api_secret", signature_payload)
            signed_fields = signature_payload["signed_fields"]
            self.assertEqual(
                signed_fields["allowed_formats"], "jpg,jpeg,png,webp,avif,heic"
            )
            serialized = "&".join(
                f"{key}={signed_fields[key]}" for key in sorted(signed_fields)
            )
            self.assertEqual(
                signature_payload["signature"],
                hashlib.sha1(
                    f"{serialized}{cloud_env['CLOUDINARY_API_SECRET']}".encode()
                ).hexdigest(),
            )
            public_id = signed_fields["public_id"]
            if signed_fields.get("folder"):
                public_id = f"{signed_fields['folder']}/{public_id}"
            version = int(time.time()) + int(suffix)
            response_signature = hashlib.sha1(
                f"public_id={public_id}&version={version}{cloud_env['CLOUDINARY_API_SECRET']}".encode()
            ).hexdigest()
            return {
                "original_filename": filename,
                "sha256": hashlib.sha256(f"image-{suffix}".encode()).hexdigest(),
                "file_bytes": 240000 + int(suffix),
                "width": 1600,
                "height": 1000,
                "format": "jpg",
                "image_metadata": {"Make": "WanderMind test"},
                "cloudinary_asset_id": f"cloud-asset-{uuid.uuid4().hex}",
                "cloudinary_public_id": public_id,
                "cloudinary_version": version,
                "secure_url": f"https://res.cloudinary.com/wandermind-test/image/upload/v{version}/{public_id}.jpg",
                "response_signature": response_signature,
            }

        def create_asset(filename, suffix, title, status="draft"):
            payload = {
                "destination": "bali",
                "primary_theme": "experiences",
                "sub_category": "wildlife",
                "region": "G5",
                "area": "Lovina",
                "place_name": "Lovina Dolphin Watching",
                "place_type": "boat wildlife experience",
                "prominence": "signature",
                "route_ids": ["R2"],
                "extension_ids": ["sunrise", "boat"],
                "tags": ["wildlife", "golden-hour"],
                "mood": "curious",
                "photography_style": "sunrise-documentary",
                "title": {"en": title, "zh": "罗威纳追海豚"},
                "description": {"en": "A sunrise wildlife experience in North Bali."},
                "alt_text": {"en": "Dolphins seen from a Lovina sunrise boat"},
                "verification_status": "route-linked",
                "status": status,
            }
            payload.update(signed_upload(filename, suffix))
            response = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/assets",
                    token=self.admin_token,
                    json=payload,
                )
            )
            self.assertEqual(response.status_code, 200, response.text)
            return response.json()["asset"]

        with patch.dict(os.environ, cloud_env, clear=False):
            first = create_asset("lovina-one.jpg", "1", "Lovina at sunrise")
            second = create_asset("lovina-two.jpg", "2", "Dolphin boat moment")

            public_draft = self._run(
                self._request("GET", "/api/portfolio?destination=bali")
            )
            self.assertEqual(public_draft.status_code, 200)
            self.assertNotIn(first["id"], {item["id"] for item in public_draft.json()["assets"]})

            published = self._run(
                self._request(
                    "PATCH",
                    f"/api/admin/portfolio/assets/{first['id']}",
                    token=self.admin_token,
                    json={"status": "published"},
                )
            )
            self.assertEqual(published.status_code, 200, published.text)
            public_live = self._run(
                self._request("GET", "/api/portfolio?destination=bali")
            )
            public_item = next(
                item for item in public_live.json()["assets"] if item["id"] == first["id"]
            )
            self.assertEqual(public_item["title"]["en"], "Lovina at sunrise")
            self.assertNotIn("cloudinary_asset_id", public_item)
            self.assertEqual(public_live.headers["cache-control"], "no-store")

            replacement = signed_upload(
                "lovina-replacement.jpg", "3", replacement_asset_id=first["id"]
            )
            replaced = self._run(
                self._request(
                    "POST",
                    f"/api/admin/portfolio/assets/{first['id']}/replace",
                    token=self.admin_token,
                    json=replacement,
                )
            )
            self.assertEqual(replaced.status_code, 200, replaced.text)
            self.assertEqual(replaced.json()["asset"]["title"]["en"], "Lovina at sunrise")
            self.assertEqual(
                replaced.json()["asset"]["cloudinary_public_id"],
                first["cloudinary_public_id"],
            )

            reordered = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/reorder?destination=bali",
                    token=self.admin_token,
                    json={"asset_ids": [second["id"], first["id"]]},
                )
            )
            self.assertEqual(reordered.status_code, 200, reordered.text)

            hidden = self._run(
                self._request(
                    "PATCH",
                    f"/api/admin/portfolio/assets/{first['id']}",
                    token=self.admin_token,
                    json={"status": "hidden"},
                )
            )
            self.assertEqual(hidden.status_code, 200, hidden.text)
            public_hidden = self._run(
                self._request("GET", "/api/portfolio?destination=bali")
            )
            self.assertNotIn(first["id"], {item["id"] for item in public_hidden.json()["assets"]})

    def test_portfolio_admin_page_uses_direct_signed_upload_and_static_fallback(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        admin_html = (frontend / "admin" / "portfolio.html").read_text(encoding="utf-8")
        admin_js = (frontend / "assets" / "js" / "admin-portfolio.js").read_text(encoding="utf-8")
        bali_html = (frontend / "bali.html").read_text(encoding="utf-8")
        self.assertIn('id="fileInput"', admin_html)
        self.assertIn("multiple", admin_html)
        self.assertIn('id="manifestStatus"', admin_html)
        self.assertIn('id="queueDialog"', admin_html)
        self.assertIn("/api/admin/portfolio/upload-signature", admin_js)
        self.assertIn("image-publish-manifest.json?v=p2", admin_js)
        self.assertIn("state.manifestByHash[record.sha256]", admin_js)
        self.assertIn("record.metadataEdited", admin_js)
        self.assertIn("publishNeedsManifestReview", admin_js)
        self.assertIn("xhr.open('POST', signature.upload_url)", admin_js)
        self.assertIn("isSupportedImageFile(file)", admin_js)
        self.assertIn("t('preview')", admin_js)
        self.assertIn("https://api.cloudinary.com", Path(main.__file__).read_text(encoding="utf-8"))
        self.assertNotIn("CLOUDINARY_API_SECRET", admin_js)
        self.assertNotIn("/api/admin/portfolio/upload-file", admin_js)
        self.assertIn("/api/portfolio?destination=bali", bali_html)
        self.assertIn("dynamicGalleryCopy", bali_html)
        self.assertGreaterEqual(bali_html.count('class="bali-shot"'), 37)

    def test_approved_image_manifest_contains_unique_108_and_new_lempuyang_hash(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        images = manifest["images"]
        self.assertEqual(len(images), 108)
        hashes = [item["sha256"] for item in images]
        self.assertEqual(len(hashes), len(set(hashes)))
        self.assertEqual(manifest["approval"]["approval_source"], "user_global_confirmation")
        self.assertEqual(manifest["approval"]["approval_date"], "2026-08-05")
        lempuyang = [
            item
            for item in images
            if item["relative_path"] == "assets/images/Lempuyang Temple.jpg"
        ]
        self.assertEqual(len(lempuyang), 1)
        item = lempuyang[0]
        expected_hash = "90b2d9be2187fd871790d4fc5e84abf5f75bc0127991723ab4c8dec199a436e9"
        self.assertEqual(item["sha256"], expected_hash)
        self.assertEqual(item["web_optimized_path"], "assets/images/web/90b2d9be2187fd87.webp")
        self.assertEqual(item["thumbnail_path"], "assets/images/thumbs/90b2d9be2187fd87.webp")
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertTrue((frontend / item["thumbnail_path"]).is_file())

    def test_bali_gallery_uses_theme_and_tag_taxonomy(self):
        frontend_dir = (
            BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        )
        html = (frontend_dir / "bali.html").read_text(encoding="utf-8")

        class GalleryParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.shots = []
                self.current = None

            def handle_starttag(self, tag, attrs):
                values = dict(attrs)
                classes = values.get("class", "").split()
                if tag == "button" and "bali-shot" in classes:
                    self.current = values
                    self.shots.append(values)
                elif tag == "img" and self.current is not None:
                    self.current["image_src"] = values.get("src", "")

            def handle_endtag(self, tag):
                if tag == "button":
                    self.current = None

        parser = GalleryParser()
        parser.feed(html)
        self.assertEqual(len(parser.shots), 37)

        expected_categories = {
            "landscapes",
            "culture",
            "experiences",
        }
        category_counts = {category: 0 for category in expected_categories}
        valid_routes = {f"R{index}" for index in range(1, 7)}
        for shot in parser.shots:
            category = shot.get("data-category")
            self.assertIn(category, expected_categories)
            category_counts[category] += 1
            self.assertTrue(shot.get("data-sub-category"))
            self.assertTrue(shot.get("data-tags"))
            self.assertTrue(shot.get("data-mood"))
            self.assertTrue(shot.get("data-season"))
            self.assertTrue(shot.get("data-place"))
            for field in (
                "data-region",
                "data-area",
                "data-place-name",
                "data-place-type",
                "data-prominence",
                "data-photography-style",
                "data-verification-status",
            ):
                self.assertTrue(shot.get(field), field)
            route_ids = set(shot.get("data-route-ids", "").split())
            if shot.get("data-verification-status") == "route-linked":
                self.assertTrue(route_ids)
                self.assertTrue(route_ids.issubset(valid_routes))
            else:
                self.assertNotEqual(shot.get("data-verification-status"), "route-linked")
            image_path = frontend_dir / shot["image_src"]
            self.assertTrue(image_path.is_file(), image_path)

        self.assertTrue(all(count >= 2 for count in category_counts.values()))
        self.assertIn('data-filter-kind="category"', html)
        self.assertIn('data-filter-kind="tag"', html)
        self.assertIn('data-i18n="baliFilterTheme" data-i18n-attr="aria-label"', html)
        self.assertIn('data-i18n="baliFilterTags" data-i18n-attr="aria-label"', html)
        self.assertIn("categoryMatches && tagMatches", html)
        self.assertIn('id="bali-place-route-link"', html)
        self.assertIn('id="bali-place-verification"', html)
        self.assertIn("activeShot.dataset.verificationStatus === 'route-linked'", html)
        self.assertIn("routeLink.hidden = !handoffReady", html)
        self.assertIn("actions.hidden = !handoffReady", html)
        self.assertIn("ai.removeAttribute('href')", html)
        self.assertIn("driver.removeAttribute('href')", html)
        self.assertNotIn("This approved image", html)
        self.assertIn("handoff.set('route', routeId)", html)
        self.assertIn("driverHandoff.set('route', routeId)", html)
        self.assertNotIn("place:placeName, route:routeId", html)
        self.assertNotIn("find-driver.html?route=' + encodeURIComponent(routeId)", html)
        self.assertIn('id="bali-place-driver"', html)
        self.assertIn("source:'gallery'", html)
        self.assertIn("openstreetmap.org/export/embed.html", html)
        self.assertIn("Real basemap", html)
        self.assertIn("item.suggested_poi_ids || []", html)
        self.assertIn("bali-map-overlay", html)
        self.assertIn("function routeUiCopy()", html)
        self.assertIn("function poiCanonicalName(poi)", html)
        self.assertIn("function poiDisplayName(poi)", html)
        self.assertIn("function poiStatusLabel(poi)", html)
        self.assertIn("function poiIsAvailable(poi)", html)
        self.assertIn("poiStatusKey(poi) !== 'retired'", html)
        self.assertIn('data-verification-status="', html)
        self.assertIn("place_verification: placeVerification", html)
        self.assertIn("verification_summary: verificationSummary", html)
        for localized_status in (
            "Planning anchor · verify details",
            "规划参考 · 细节待核验",
            "計画用候補 · 最新情報を要確認",
            "일정 참고 · 최신 정보 확인 필요",
            "Titik rencana · verifikasi detail",
        ):
            self.assertIn(localized_status, html)
        for localized_route_copy in (
            "おすすめの順序と場所に戻しますか？",
            "추천 순서와 장소로 복원할까요?",
            "Pulihkan urutan dan tempat yang direkomendasikan?",
        ):
            self.assertIn(localized_route_copy, html)
        self.assertNotIn("language() === 'zh'", html)
        self.assertIn("matchedRouteId(activeShot)", html)
        self.assertIn("activeId = requestedRoute", html)
        self.assertIn("window.setTimeout(renderModal, 0)", html)
        self.assertIn(
            ".bali-route-grid{display:flex;width:100%;max-width:100%;min-width:0;",
            html,
        )
        self.assertNotIn("margin-right:-15px", html)
        self.assertIn(
            ".bali-filterbar { width:100%; min-width:0; max-width:100%;",
            html,
        )

        driver_html = (frontend_dir / "find-driver.html").read_text(encoding="utf-8")
        self.assertIn("var requestedPlace = requestParams.get('place')", driver_html)
        self.assertIn("var requestedBudget = requestParams.get('budget')", driver_html)
        self.assertIn("var requestedCurrency = requestParams.get('currency')", driver_html)
        self.assertIn("[requestedRoute, requestedPlace]", driver_html)
        self.assertIn("My name is I Kadek Dicky Maha Putra", driver_html)
        self.assertIn("I will be your tour guide and driver", driver_html)
        self.assertIn("I am Gede Nico, a local Balinese guide", driver_html)
        self.assertIn("working in this field for 7 years", driver_html)
        self.assertIn("Driver Moments", driver_html)
        self.assertIn("object-fit:contain", driver_html)
        self.assertIn("7bb50e6252cf6125.webp", driver_html)
        self.assertIn("888fef90456d4604.webp", driver_html)
        self.assertIn("profile.moments.map", driver_html)
        self.assertIn("DRIVER_PROFILES[choice.querySelector('input').value]", driver_html)
        self.assertIn("IDR 700k base + IDR 50k per guest", driver_html)
        self.assertIn("IDR 500k base + IDR 50k per guest", driver_html)
        self.assertIn("IDR 75k per hour", driver_html)
        self.assertIn("Daihatsu Xenia — 7 Seater", driver_html)
        self.assertIn("Comfortable for up to 6 guests with one driver", driver_html)
        self.assertNotIn("direct contact details pending", driver_html)
        self.assertNotIn('id="fd-wa"', driver_html)
        self.assertNotIn('id="fd-phone"', driver_html)
        self.assertNotIn("availability confirmed privately", driver_html)

        i18n_js = (frontend_dir / "assets" / "js" / "i18n.js").read_text(
            encoding="utf-8"
        )
        dictionary_start = i18n_js.index("const LANGS =")
        first_override = i18n_js.index("Object.assign(LANGS.en")
        self.assertGreater(first_override, dictionary_start)
        for language in ("en", "zh", "ja", "ko", "id"):
            self.assertIn(f"Object.assign(LANGS.{language}", i18n_js)
        self.assertIn("fdQuoteBoundary", i18n_js)
        for private_value in (
            "availability confirmed privately",
            "私密确认档期",
            "空き状況は非公開で確認",
            "가능 일정은 비공개로 확인",
            "ketersediaan dikonfirmasi secara privat",
        ):
            self.assertNotIn(private_value, i18n_js)

        public_frontend = "\n".join(
            path.read_text(encoding="utf-8")
            for path in frontend_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in {".html", ".js", ".json", ".css"}
        )
        self.assertNotIn("contact_whatsapp", public_frontend)
        self.assertNotIn("contact_phone", public_frontend)
        self.assertNotIn("wa.me/", public_frontend)

        legacy_html = (BACKEND_DIR.parent / "frontend" / "index.html").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("c.whatsapp", legacy_html)
        self.assertNotIn("c.wechat", legacy_html)
        self.assertNotIn("c.xhs", legacy_html)
        self.assertNotIn("dr.contacts", legacy_html)
        self.assertIn("Dicky", legacy_html)
        self.assertIn("Gede Nico", legacy_html)
        self.assertIn("/find-driver", legacy_html)

        about_html = (frontend_dir / "about.html").read_text(encoding="utf-8")
        contact_html = (frontend_dir / "contact.html").read_text(encoding="utf-8")
        self.assertNotIn("WeChat ID", about_html)
        self.assertNotIn("wa.me/", about_html)
        self.assertNotIn("Xiaohongshu: Wander with ky", about_html)
        self.assertNotIn("Dicky · trusted local driver", contact_html)

        ai_js = (frontend_dir / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("const routeId = q.get('route') || ''", ai_js)
        self.assertIn("routeHints", ai_js)

    def test_unknown_driver_is_rejected_before_email_delivery(self):
        response = self._run(
            self._request(
                "POST",
                "/api/driver-request",
                json={
                    "driver_id": "invented-driver",
                    "first_name": "Test",
                    "contact_email": "traveller@example.test",
                    "privacy_consent": True,
                },
            )
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()

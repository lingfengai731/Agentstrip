import asyncio
import json
import os
import sys
import tempfile
import time
import unittest
import uuid
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi import HTTPException


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

        professional = self._run(
            self._request(
                "POST",
                f"/api/product-trips/{trip_id}/consume",
                token=self.user_token,
                json={"action": "adjustment"},
            )
        )
        self.assertEqual(professional.status_code, 200, professional.text)
        self.assertEqual(
            professional.json()["consumed_action"], "professional_route"
        )
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
        self.assertEqual(len(region_ids), 7)
        for region in data["regions"]:
            self.assertIn("map", region)
            self.assertGreaterEqual(region["map"]["x"], 0)
            self.assertLessEqual(region["map"]["x"], 100)
            self.assertGreaterEqual(region["map"]["y"], 0)
            self.assertLessEqual(region["map"]["y"], 100)
        for route in data["routes"]:
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
        self.assertEqual(len(poi_ids), len(set(poi_ids)))
        for poi in data["pois"]:
            self.assertIn(poi["region_id"], region_ids, poi["id"])
            self.assertTrue(set(poi["route_ids"]).issubset(route_ids), poi["id"])
        for route in data["routes"]:
            outline_regions = {item["region_id"] for item in route["free_outline"]}
            compatible = [
                poi
                for poi in data["pois"]
                if route["id"] in poi["route_ids"]
                and poi["region_id"] in outline_regions
            ]
            self.assertTrue(compatible, route["id"])

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
        self.assertEqual(len(parser.shots), 15)

        expected_categories = {
            "landscapes",
            "culture",
            "experiences",
            "places",
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
            route_ids = set(shot.get("data-route-ids", "").split())
            self.assertTrue(route_ids)
            self.assertTrue(route_ids.issubset(valid_routes))
            image_path = frontend_dir / shot["image_src"]
            self.assertTrue(image_path.is_file(), image_path)

        self.assertTrue(all(count >= 2 for count in category_counts.values()))
        self.assertIn('data-filter-kind="category"', html)
        self.assertIn('data-filter-kind="tag"', html)
        self.assertIn('data-i18n="baliFilterTheme" data-i18n-attr="aria-label"', html)
        self.assertIn('data-i18n="baliFilterTags" data-i18n-attr="aria-label"', html)
        self.assertIn("categoryMatches && tagMatches", html)

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

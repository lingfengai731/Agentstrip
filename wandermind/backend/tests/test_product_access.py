import asyncio
import csv
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from fastapi import HTTPException


TEST_DIR = tempfile.TemporaryDirectory(prefix="wandermind-product-test-")
os.environ.pop("DATABASE_URL", None)
os.environ["DB_PATH"] = str(Path(TEST_DIR.name) / "test.db")
os.environ["ENVIRONMENT"] = "development"
os.environ.pop("ADMIN_USERNAME", None)
os.environ.pop("ADMIN_EMAIL", None)
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
        conn = get_db()
        try:
            conn.execute("DELETE FROM driver_request_rate_limits")
            conn.execute("DELETE FROM marketing_event_rate_limits")
            conn.execute("DELETE FROM marketing_events")
            conn.commit()
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

    async def _request(
        self, method, path, *, token=None, json=None, anon_id=None,
        headers=None, client_ip="127.0.0.1",
    ):
        headers = dict(headers or {})
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if anon_id:
            headers["X-Anon-Id"] = anon_id
        transport = httpx.ASGITransport(app=main.app, client=(client_ip, 12345))
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            return await client.request(method, path, headers=headers, json=json)

    def test_cors_allows_wandermind_and_rejects_unknown_origins(self):
        allowed = self._run(
            self._request(
                "GET", "/healthz", headers={"Origin": "https://wandermind.cc"}
            )
        )
        www_allowed = self._run(
            self._request(
                "GET", "/healthz", headers={"Origin": "https://www.wandermind.cc"}
            )
        )
        local_allowed = self._run(
            self._request(
                "GET", "/healthz", headers={"Origin": "http://localhost:8770"}
            )
        )
        rejected = self._run(
            self._request(
                "GET", "/healthz", headers={"Origin": "https://attacker.example"}
            )
        )
        preflight = self._run(
            self._request(
                "OPTIONS",
                "/api/product-trips",
                headers={
                    "Origin": "https://wandermind.cc",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "authorization,content-type,x-anon-id",
                },
            )
        )
        rejected_preflight = self._run(
            self._request(
                "OPTIONS",
                "/api/product-trips",
                headers={
                    "Origin": "https://attacker.example",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
        )
        self.assertEqual(
            allowed.headers.get("access-control-allow-origin"),
            "https://wandermind.cc",
        )
        self.assertEqual(
            www_allowed.headers.get("access-control-allow-origin"),
            "https://www.wandermind.cc",
        )
        self.assertEqual(
            local_allowed.headers.get("access-control-allow-origin"),
            "http://localhost:8770",
        )
        self.assertEqual(allowed.headers.get("access-control-allow-credentials"), "true")
        self.assertIsNone(rejected.headers.get("access-control-allow-origin"))
        self.assertEqual(preflight.status_code, 200, preflight.text)
        self.assertEqual(
            preflight.headers.get("access-control-allow-origin"),
            "https://wandermind.cc",
        )
        allowed_headers = preflight.headers.get("access-control-allow-headers", "").lower()
        for header in ("authorization", "content-type", "x-anon-id"):
            self.assertIn(header, allowed_headers)
        self.assertEqual(rejected_preflight.status_code, 400)
        self.assertIsNone(
            rejected_preflight.headers.get("access-control-allow-origin")
        )

    def test_cors_config_accepts_explicit_origins_and_rejects_wildcards(self):
        with patch.dict(
            os.environ,
            {
                "CORS_ALLOWED_ORIGINS": (
                    "https://preview.wandermind.cc/, *, ftp://files.example, "
                    "https://wandermind.cc/"
                )
            },
            clear=False,
        ):
            self.assertEqual(
                main._cors_allowed_origins(),
                [
                    "https://wandermind.cc",
                    "https://www.wandermind.cc",
                    "https://preview.wandermind.cc",
                ],
            )

    def test_marketing_events_are_bounded_anonymous_and_queryable_by_admin(self):
        response = self._run(
            self._request(
                "POST",
                "/api/marketing/events",
                client_ip="203.0.113.10",
                json={
                    "event_name": "bali_public_route_select",
                    "page_path": "/bali.html?email=private@example.test#routes",
                    "source": "Google Search!!",
                    "medium": "CPC",
                    "campaign": "Bali Search ZH 01",
                    "content": "R3",
                    "lang": "zh",
                    "device_class": "mobile",
                },
            )
        )
        self.assertEqual(response.status_code, 204, response.text)

        conn = get_db()
        try:
            row = conn.execute(
                "SELECT event_name,page_path,source,medium,campaign,content,lang,device_class "
                "FROM marketing_events"
            ).fetchone()
            limiter = conn.execute(
                "SELECT client_key FROM marketing_event_rate_limits"
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(
            dict(row),
            {
                "event_name": "bali_public_route_select",
                "page_path": "/bali.html",
                "source": "google_search",
                "medium": "cpc",
                "campaign": "bali_search_zh_01",
                "content": "r3",
                "lang": "zh",
                "device_class": "mobile",
            },
        )
        self.assertNotIn("203.0.113.10", dict(limiter)["client_key"])
        self.assertNotIn("private@example.test", json.dumps(dict(row)))

        expired_event_id = str(uuid.uuid4())
        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO marketing_events "
                "(id,event_name,page_path,source,medium,campaign,content,lang,device_class,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    expired_event_id, "page_view", "/old", "", "", "", "",
                    "en", "desktop", int(time.time()) - main._MARKETING_EVENT_RETENTION_SECONDS - 1,
                ),
            )
            conn.execute(
                "INSERT INTO marketing_event_rate_limits "
                "(client_key,window_started_at,request_count,updated_at) VALUES (?,?,?,?)",
                (
                    "expired-client", 1, 1,
                    int(time.time()) - main._MARKETING_LIMIT_RETENTION_SECONDS - 1,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        anonymous = self._run(self._request("GET", "/api/admin/marketing-summary"))
        member = self._run(
            self._request("GET", "/api/admin/marketing-summary", token=self.user_token)
        )
        admin = self._run(
            self._request(
                "GET", "/api/admin/marketing-summary?days=14", token=self.admin_token
            )
        )
        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(member.status_code, 403)
        self.assertEqual(admin.status_code, 200, admin.text)
        summary = admin.json()
        self.assertEqual(summary["events"][0], {"event_name": "bali_public_route_select", "count": 1})
        self.assertEqual(summary["channels"][0]["source"], "google_search")
        self.assertEqual(summary["campaigns"][0]["campaign"], "bali_search_zh_01")
        conn = get_db()
        try:
            expired_event = conn.execute(
                "SELECT 1 FROM marketing_events WHERE id=?", (expired_event_id,)
            ).fetchone()
            expired_limiter = conn.execute(
                "SELECT 1 FROM marketing_event_rate_limits WHERE client_key=?",
                ("expired-client",),
            ).fetchone()
        finally:
            conn.close()
        self.assertIsNone(expired_event)
        self.assertIsNone(expired_limiter)

    def test_marketing_event_allowlist_and_rate_limit(self):
        self.assertEqual(main._marketing_token("private@example.test"), "")
        self.assertEqual(main._marketing_token("+62 87860353273"), "")
        self.assertEqual(main._marketing_token("+1 (202) 555-0123"), "")
        self.assertEqual(main._marketing_token("https://example.test"), "")
        self.assertEqual(main._marketing_page_path("/private-202-555-0123"), "/")
        self.assertEqual(main._marketing_page_path("/bali.html?private=1"), "/bali.html")
        oversized = self._run(
            self._request(
                "POST",
                "/api/marketing/events",
                json={"event_name": "page_view", "campaign": "x" * 257},
            )
        )
        self.assertEqual(oversized.status_code, 422)
        unknown = self._run(
            self._request(
                "POST", "/api/marketing/events", json={"event_name": "email_capture"}
            )
        )
        self.assertEqual(unknown.status_code, 400)

        with patch.object(main, "_MARKETING_EVENT_LIMIT", 2):
            statuses = [
                self._run(
                    self._request(
                        "POST",
                        "/api/marketing/events",
                        client_ip="198.51.100.9",
                        json={"event_name": "page_view", "page_path": "/bali"},
                    )
                ).status_code
                for _ in range(3)
            ]
        self.assertEqual(statuses, [204, 204, 429])

    def test_launch_measurement_assets_privacy_and_sitemap(self):
        studio = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        measurement = (studio / "assets" / "js" / "marketing-events.js").read_text(encoding="utf-8")
        privacy = (studio / "privacy.html").read_text(encoding="utf-8")
        i18n = (studio / "assets" / "js" / "i18n.js").read_text(encoding="utf-8")
        self.assertNotIn("cookie", measurement.lower())
        self.assertIn("sessionStorage", measurement)
        self.assertIn("driver_request_submitted", measurement)
        self.assertIn("window.addEventListener('wm:bali-route-selected'", measurement)
        driver_html = (studio / "find-driver.html").read_text(encoding="utf-8")
        self.assertIn("data && data.delivered === true", driver_html)
        self.assertIn("entries older than 24 hours", i18n)
        self.assertIn("超过 24 小时", i18n)
        self.assertIn("marketing-events.js", privacy)
        for lang in ("en", "zh", "ja", "ko", "id"):
            self.assertIn(f"Object.assign(LANGS.{lang}", i18n)
        for name in (
            "index.html", "about.html", "services.html", "contact.html",
            "ai-tool.html", "bali.html", "find-driver.html",
        ):
            source = (studio / name).read_text(encoding="utf-8")
            self.assertIn("marketing-events.js?v=p2", source, name)
            self.assertIn('href="privacy.html"', source, name)
        sitemap = self._run(self._request("GET", "/sitemap.xml"))
        self.assertEqual(sitemap.status_code, 200)
        self.assertIn("https://wandermind.cc/privacy", sitemap.text)

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

    def test_unlocked_route_reports_every_day_open_and_restores_by_account(self):
        email = f"route-restore-{uuid.uuid4().hex}@example.test"
        user_id = self._create_user(email, "route restore")
        token = main.make_token(user_id, email)
        profile = {
            "audience": "first",
            "goals": ["photo"],
            "travel_style": "comfort",
            "travellers": 2,
            "days": 7,
            "pace": "balanced",
        }
        created = self._run(
            self._request(
                "POST",
                "/api/bali/professional-route",
                token=token,
                json={"trip_profile": profile, "route_id": "R1", "lang": "zh"},
            )
        )
        self.assertEqual(created.status_code, 200, created.text)
        trip_id = created.json()["trip_id"]
        conn = get_db()
        try:
            conn.execute(
                "UPDATE product_trips SET professional_route_entitlement=1 WHERE id=?",
                (trip_id,),
            )
            conn.commit()
        finally:
            conn.close()

        restored = self._run(
            self._request(
                "GET",
                "/api/bali/professional-route/recent-unlocked?lang=zh",
                token=token,
            )
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        payload = restored.json()
        self.assertEqual(payload["trip_id"], trip_id)
        self.assertTrue(payload["professional_route_entitlement"])
        self.assertTrue(payload["route"]["unlocked"])
        self.assertEqual(payload["route"]["preview_days"], 7)
        self.assertEqual(payload["route"]["locked_days"], 0)
        self.assertFalse(any(day["locked"] for day in payload["route"]["days_plan"]))

    def test_professional_route_places_are_verified_execution_facts(self):
        excluded = {
            "thousand_islands_viewpoint",
            "mount_batur_trailhead",
            "mount_batur_jeep",
            "bali_fire_shooting_club",
            "celuk_silver_class",
        }
        seen = set()
        for route_id in ("R1", "R2", "R3", "R4", "R5", "R6"):
            with self.subTest(route_id=route_id):
                route = main._professional_route_document(
                    {
                        "audience": "first",
                        "goals": ["local", "photo"],
                        "travel_style": "comfort",
                        "travellers": 2,
                        "days": 12,
                        "pace": "balanced",
                    },
                    route_id=route_id,
                    lang="en",
                )
                for day in route["full_days"]:
                    for place in day["places"]:
                        seen.add(place["id"])
                        self.assertEqual(place["verification_status"], "verified")
        self.assertTrue(seen)
        self.assertIn("batur_hot_springs", seen)
        self.assertTrue(excluded.isdisjoint(seen))

    def test_concurrent_professional_order_creation_returns_one_order(self):
        email = f"order-race-{uuid.uuid4().hex}@example.test"
        user_id = self._create_user(email, "order-race")
        token = main.make_token(user_id, email)
        trip_id = self._new_trip(token=token)

        def create_order(_):
            return self._run(
                self._request(
                    "POST",
                    "/api/professional-route/orders",
                    token=token,
                    json={"trip_id": trip_id},
                )
            )

        with ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(create_order, range(8)))
        self.assertEqual([response.status_code for response in responses], [200] * 8)
        order_ids = {response.json()["order"]["id"] for response in responses}
        self.assertEqual(len(order_ids), 1)
        conn = get_db()
        try:
            row = conn.execute(
                """SELECT COUNT(*) AS n FROM professional_route_orders
                   WHERE trip_id=? AND status IN ('pending','confirmed')""",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["n"], 1)

    def test_postgres_tests_reject_unsafe_database_before_backend_import(self):
        cases = (
            (
                "wandermind.backend.tests.test_driver_rate_limit_postgres",
                "postgresql://ci:ci@localhost.evil/wandermind",
                True,
            ),
            (
                "wandermind.backend.tests.test_entitlements_postgres",
                "postgresql://ci:ci@127.0.0.1.evil/wandermind",
                True,
            ),
            (
                "wandermind.backend.tests.test_entitlements_postgres",
                "postgresql://ci:ci@127.0.0.1/wandermind",
                False,
            ),
        )
        for module_name, database_url, allow_local in cases:
            env = os.environ.copy()
            env["DATABASE_URL"] = database_url
            if allow_local:
                env["WANDERMIND_ALLOW_LOCAL_POSTGRES_TESTS"] = "1"
            else:
                env.pop("WANDERMIND_ALLOW_LOCAL_POSTGRES_TESTS", None)
            probe = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    f"import importlib; importlib.import_module('{module_name}')",
                ],
                cwd=BACKEND_DIR.parents[1],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            output = probe.stdout + probe.stderr
            self.assertNotEqual(probe.returncode, 0)
            self.assertIn("explicitly allowed loopback database", output)
            self.assertNotIn("[wandermind] DB backend", output)

    def test_concurrent_rough_route_consumption_is_atomic(self):
        email = f"rough-race-{uuid.uuid4().hex}@example.test"
        user_id = self._create_user(email, "rough-race")
        token = main.make_token(user_id, email)
        trip_id = self._new_trip(token=token)

        def consume(_):
            return self._run(
                self._request(
                    "POST",
                    f"/api/product-trips/{trip_id}/consume",
                    token=token,
                    json={"action": "rough_route"},
                )
            )

        with ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(consume, range(8)))
        self.assertEqual(sum(response.status_code == 200 for response in responses), 1)
        self.assertEqual(sum(response.status_code == 402 for response in responses), 7)
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT rough_used FROM product_trips WHERE id=?", (trip_id,)
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["rough_used"], 1)

    def test_concurrent_points_redemption_cannot_overspend_across_trips(self):
        email = f"points-race-{uuid.uuid4().hex}@example.test"
        user_id = self._create_user(email, "points-race")
        token = main.make_token(user_id, email)
        trip_ids = [self._new_trip(token=token), self._new_trip(token=token)]
        conn = get_db()
        try:
            conn.execute(
                """INSERT INTO route_points_ledger
                   (id,user_id,delta,reason,ref_id,created_at)
                   VALUES (?,?,?,?,?,?)""",
                (
                    str(uuid.uuid4()), user_id, 30, "test_credit",
                    str(uuid.uuid4()), int(time.time()),
                ),
            )
            conn.commit()
        finally:
            conn.close()

        def redeem(trip_id):
            return self._run(
                self._request(
                    "POST",
                    "/api/referrals/redeem-professional-route",
                    token=token,
                    json={"trip_id": trip_id},
                )
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(redeem, trip_ids))
        self.assertEqual(sorted(response.status_code for response in responses), [200, 402])
        conn = get_db()
        try:
            balance = main._points_balance(conn, user_id)
            confirmed = conn.execute(
                """SELECT COUNT(*) AS n FROM professional_route_orders
                   WHERE user_id=? AND status='confirmed'""",
                (user_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(balance, 0)
        self.assertEqual(confirmed["n"], 1)

    def test_concurrent_professional_adjustments_stop_at_three(self):
        email = f"adjust-race-{uuid.uuid4().hex}@example.test"
        user_id = self._create_user(email, "adjust-race")
        token = main.make_token(user_id, email)
        trip_id = self._new_trip(token=token)
        conn = get_db()
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
            return self._run(
                self._request(
                    "POST",
                    f"/api/bali/professional-route/{trip_id}/adjust",
                    token=token,
                    json={
                        "trip_profile": {
                            "audience": "first",
                            "goals": ["local"],
                            "travel_style": "comfort",
                            "travellers": 2,
                            "days": 5 + (index % 2),
                            "pace": "balanced",
                        },
                        "lang": "en",
                    },
                )
            )

        with ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(adjust, range(8)))
        self.assertEqual(sum(response.status_code == 200 for response in responses), 3)
        self.assertEqual(sum(response.status_code == 402 for response in responses), 5)
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT professional_adjustments_used FROM product_trips WHERE id=?",
                (trip_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["professional_adjustments_used"], 3)

    def test_points_redemption_converts_pending_order_without_duplication(self):
        email = f"points-pending-{uuid.uuid4().hex}@example.test"
        user_id = self._create_user(email, "points-pending")
        token = main.make_token(user_id, email)
        trip_id = self._new_trip(token=token)
        pending = self._run(
            self._request(
                "POST",
                "/api/professional-route/orders",
                token=token,
                json={"trip_id": trip_id},
            )
        )
        self.assertEqual(pending.status_code, 200, pending.text)
        pending_id = pending.json()["order"]["id"]
        conn = get_db()
        try:
            conn.execute(
                """INSERT INTO route_points_ledger
                   (id,user_id,delta,reason,ref_id,created_at)
                   VALUES (?,?,?,?,?,?)""",
                (
                    str(uuid.uuid4()), user_id, 30, "test_credit",
                    str(uuid.uuid4()), int(time.time()),
                ),
            )
            conn.commit()
        finally:
            conn.close()

        redeemed = self._run(
            self._request(
                "POST",
                "/api/referrals/redeem-professional-route",
                token=token,
                json={"trip_id": trip_id},
            )
        )
        self.assertEqual(redeemed.status_code, 200, redeemed.text)
        conn = get_db()
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
        services_html = (frontend_dir / "services.html").read_text(encoding="utf-8")
        i18n = (frontend_dir / "assets" / "js" / "i18n.js").read_text(
            encoding="utf-8"
        )
        ai_js = (frontend_dir / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )
        professional_js = (
            frontend_dir / "assets" / "js" / "bali-professional.js"
        ).read_text(encoding="utf-8")
        self.assertIn("bali.html#professional-planner", index_html)
        self.assertIn("ai-tool.html?mode=diy", index_html)
        self.assertIn('href="bali.html#professional-planner"', services_html)
        self.assertIn('href="ai-tool.html?mode=diy"', services_html)
        self.assertIn('href="find-driver.html"', services_html)
        self.assertNotIn('href="ai-tool.html#hotels"', services_html)
        self.assertNotIn('href="ai-tool.html#flights"', services_html)
        self.assertNotIn('href="ai-tool.html#itinerary"', services_html)
        self.assertIn("assets/js/i18n.js?v=services2", services_html)
        self.assertEqual(i18n.count("srv1Meta:"), 5)
        self.assertEqual(i18n.count("srvDestBaliBtn:"), 5)
        self.assertNotIn("Real-time pricing across Booking", i18n)
        self.assertNotIn("六项 AI 驱动的服务", i18n)
        self.assertIn('id="professional-planner"', bali_html)
        self.assertIn("assets/js/bali-professional.js?v=p62", bali_html)
        self.assertNotIn("ai-tool.html?professional=1", bali_html)
        self.assertNotIn("professional_requested", ai_js)
        self.assertIn("history.replaceState({}, document.title, window.location.pathname);", ai_js)
        self.assertIn("authHeaders()", ai_js)
        self.assertIn("requestAuthRecovery()", ai_js)
        self.assertIn("/adjust", professional_js)
        self.assertIn("wm:bali-route-selected", bali_html)
        self.assertIn("window.history.replaceState", bali_html)
        self.assertIn("window.addEventListener('wm:bali-route-selected'", professional_js)
        self.assertIn("route_id:state.pendingRouteId || ''", professional_js)
        self.assertIn("bali-professional-adjustments-badge", bali_html)
        self.assertEqual(professional_js.count("adjustScope:"), 5)
        self.assertEqual(professional_js.count("routeSwitchPending:"), 5)
        self.assertEqual(professional_js.count("tripUnavailable:"), 5)
        self.assertIn("/api/bali/professional-route/recent-unlocked", professional_js)
        self.assertIn("function clearStoredTrip()", professional_js)
        self.assertIn("localStorage.removeItem('wm_studio_professional_trip_id')", professional_js)
        self.assertIn("response.status === 403 || response.status === 404 || response.status === 409", professional_js)
        self.assertIn("window.location.pathname + window.location.search + '#professional-planner'", professional_js)
        self.assertIn("editor.scrollIntoView", professional_js)
        self.assertIn('data-i18n="baliRouteSectionSub"', bali_html)

    def test_bali_cards_and_packages_avoid_subjective_intensity_labels(self):
        frontend_dir = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        bali_html = (frontend_dir / "bali.html").read_text(encoding="utf-8")
        packages_js = (
            frontend_dir / "assets" / "js" / "bali-packages.js"
        ).read_text(encoding="utf-8")

        self.assertNotIn("data-package-energy", packages_js)
        self.assertNotIn("filters.energy", packages_js)
        self.assertNotIn("labels.pace", bali_html)
        self.assertNotIn("labels.activity", bali_html)
        self.assertNotIn('id="itinerary"', bali_html)

    def test_global_account_link_opens_account_modal_directly(self):
        frontend_dir = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        global_auth = (
            frontend_dir / "assets" / "js" / "global-auth.js"
        ).read_text(encoding="utf-8")
        search_html = (frontend_dir / "search.html").read_text(encoding="utf-8")
        ai_tool = (frontend_dir / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("ai-tool.html?account=open", global_auth)
        self.assertIn("authQuery.get('account') === 'open'", ai_tool)
        self.assertIn("setTimeout(openAccountModal, 80)", ai_tool)
        self.assertIn("assets/js/global-auth.js?v=p53", search_html)

    def test_public_login_uses_email_without_exposing_admin_username(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        ai_html = (frontend / "ai-tool.html").read_text(encoding="utf-8")
        ai_js = (frontend / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("assets/js/ai-tool.js?v=p60", ai_html)
        self.assertIn("initialDestQuery", ai_js)
        self.assertIn("function openHashTarget()", ai_js)
        self.assertIn("switchCompareSub(target)", ai_js)
        self.assertIn("window.addEventListener('hashchange', openHashTarget)", ai_js)
        self.assertIn("if (window.location.hash) setTimeout(openHashTarget, 0);", ai_js)
        self.assertIn("attachLangWatcher();\n  setTimeout(openHashTarget, 0);", ai_js)
        self.assertIn("const hasPlannerEntry", ai_js)
        self.assertIn("if (!hasPlannerEntry) return;", ai_js)
        self.assertNotIn("&& !savedBrief && !savedProfile", ai_js)
        self.assertNotIn("Auto-pick destination from ?dest=", ai_html)
        self.assertIn(
            'type="email" class="ws-form-input ws-auth-input" id="ws-li-email"',
            ai_js,
        )
        self.assertIn("${escapeHtml(T.authEmailLabel)}", ai_js)
        self.assertNotIn("authLoginIdentifierLabel", ai_js)
        for public_admin_hint in (
            "Email or admin username",
            "邮箱或管理员用户名",
            "メールまたは管理者名",
            "이메일 또는 관리자 이름",
            "Email atau nama admin",
        ):
            self.assertNotIn(public_admin_hint, ai_js)
        self.assertNotIn("email.toLowerCase() !== 'admin'", ai_js)

    def test_ai_tool_mobile_drawers_reduce_duplicate_actions_without_changing_desktop_grid(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        ai_html = (frontend / "ai-tool.html").read_text(encoding="utf-8")
        ai_css = (frontend / "assets" / "css" / "ai-tool.css").read_text(
            encoding="utf-8"
        )
        ai_js = (frontend / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("assets/css/ai-tool.css?v=p60", ai_html)
        self.assertIn('aria-controls="ws-left-drawer"', ai_html)
        self.assertIn('aria-controls="ws-right-drawer"', ai_html)
        self.assertIn(".ws-rightpanel.mobile-open {\n    display: flex;", ai_css)
        self.assertIn('body.ws-drawer-open', ai_css)
        self.assertIn('.ws-quick-btn[data-quick="map"]', ai_css)
        self.assertIn("grid-template-columns: 280px 1fr 360px", ai_css)
        self.assertIn("function setMobileDrawer(side, forceOpen)", ai_js)
        self.assertIn("if (event.key === 'Escape') closeMobileDrawers();", ai_js)
        self.assertEqual(ai_js.count("toolIntroTitle:"), 5)
        self.assertEqual(ai_js.count("mobileTrips:"), 5)
        self.assertEqual(ai_js.count("mobileTools:"), 5)

    def test_admin_account_exposes_private_portfolio_manager_entry(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        ai_js = (frontend / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("authUser.role === 'admin'", ai_js)
        self.assertIn('href="admin/portfolio"', ai_js)
        self.assertIn('href="admin/marketing"', ai_js)
        self.assertIn("accountPortfolioOpen", ai_js)
        self.assertIn("accountMarketingOpen", ai_js)
        for label in (
            "Open content manager",
            "打开内容管理器",
            "コンテンツ管理を開く",
            "콘텐츠 관리자 열기",
            "Buka pengelola konten",
        ):
            self.assertIn(label, ai_js)

    def test_admin_launch_measurement_page_is_private_responsive_and_multilingual(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        admin_html = (frontend / "admin" / "marketing.html").read_text(
            encoding="utf-8"
        )
        admin_js = (frontend / "assets" / "js" / "admin-marketing.js").read_text(
            encoding="utf-8"
        )
        self.assertIn('name="robots" content="noindex,nofollow"', admin_html)
        self.assertIn('admin-marketing.js?v=p1', admin_html)
        self.assertIn('@media(max-width:520px)', admin_html)
        self.assertIn("wm_studio_token", admin_js)
        self.assertIn("/api/admin/marketing-summary?days=", admin_js)
        self.assertIn("Authorization:'Bearer ' + token", admin_js)
        self.assertIn("window.location.assign('../ai-tool.html?auth=login", admin_js)
        for lang in ("en", "zh", "ja", "ko", "id"):
            self.assertIn(f"{lang}:{{", admin_js)
        self.assertNotIn("innerHTML", admin_js)

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

    def test_paypal_config_is_fail_closed_without_server_credentials(self):
        with patch.dict(
            os.environ,
            {
                "PAYPAL_CLIENT_ID": "",
                "PAYPAL_CLIENT_SECRET": "",
                "PAYPAL_WEBHOOK_ID": "",
                "PAYPAL_ROUTE_PRICE": "1.49",
            },
            clear=False,
        ):
            response = self._run(self._request("GET", "/api/paypal/config"))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["enabled"], False)
        self.assertNotIn("client_secret", response.json())

    def test_paypal_capture_revalidates_amount_and_unlocks_once(self):
        trip_id = self._new_trip(token=self.user_token)
        config = {
            "enabled": True,
            "environment": "sandbox",
            "client_id": "public-sandbox-client",
            "client_secret": "server-only-secret",
            "webhook_id": "webhook-test",
            "currency": "USD",
            "amount_text": "1.49",
            "amount_cents": 149,
        }
        provider_order_id = "PAYPALTESTORDER123"

        async def create_order(_config, local_order_id):
            self.assertEqual(_config["amount_text"], "1.49")
            self.assertTrue(local_order_id)
            return {"id": provider_order_id, "status": "CREATED"}

        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(main.paypal_service, "create_order", side_effect=create_order),
        ):
            created = self._run(
                self._request(
                    "POST",
                    "/api/paypal/orders",
                    token=self.user_token,
                    json={"trip_id": trip_id},
                )
            )
        self.assertEqual(created.status_code, 200, created.text)
        self.assertEqual(created.json()["provider_order_id"], provider_order_id)

        conn = get_db()
        try:
            order = dict(
                conn.execute(
                    "SELECT * FROM professional_route_orders WHERE provider_order_id=?",
                    (provider_order_id,),
                ).fetchone()
            )
        finally:
            conn.close()

        capture_payload = {
            "id": provider_order_id,
            "status": "COMPLETED",
            "purchase_units": [
                {
                    "custom_id": order["id"],
                    "payments": {
                        "captures": [
                            {
                                "id": "CAPTURETEST123",
                                "status": "COMPLETED",
                                "amount": {"currency_code": "USD", "value": "1.49"},
                            }
                        ]
                    },
                }
            ],
        }
        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(
                main.paypal_service,
                "capture_order",
                new=AsyncMock(return_value=capture_payload),
            ),
        ):
            first = self._run(
                self._request(
                    "POST",
                    f"/api/paypal/orders/{provider_order_id}/capture",
                    token=self.user_token,
                )
            )
            second = self._run(
                self._request(
                    "POST",
                    f"/api/paypal/orders/{provider_order_id}/capture",
                    token=self.user_token,
                )
            )
        self.assertEqual(first.status_code, 200, first.text)
        self.assertTrue(first.json()["professional_route_unlocked"])
        self.assertEqual(second.status_code, 200, second.text)
        self.assertTrue(second.json()["already_captured"])

    def test_paypal_buyer_cancel_abandons_local_order_and_retry_is_fresh(self):
        trip_id = self._new_trip(token=self.user_token)
        config = {
            "enabled": True,
            "environment": "sandbox",
            "client_id": "public-sandbox-client",
            "client_secret": "server-only-secret",
            "webhook_id": "webhook-test",
            "currency": "USD",
            "amount_text": "1.49",
            "amount_cents": 149,
        }
        provider_ids = iter(("PAYPALCANCEL123", "PAYPALRETRY123"))

        async def create_order(_config, _local_order_id):
            return {"id": next(provider_ids), "status": "CREATED"}

        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(main.paypal_service, "create_order", side_effect=create_order),
        ):
            first = self._run(self._request(
                "POST", "/api/paypal/orders", token=self.user_token,
                json={"trip_id": trip_id},
            ))
            abandoned = self._run(self._request(
                "POST", "/api/paypal/orders/PAYPALCANCEL123/abandon",
                token=self.user_token,
            ))
            duplicate = self._run(self._request(
                "POST", "/api/paypal/orders/PAYPALCANCEL123/abandon",
                token=self.user_token,
            ))
            retried = self._run(self._request(
                "POST", "/api/paypal/orders", token=self.user_token,
                json={"trip_id": trip_id},
            ))

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(abandoned.status_code, 200, abandoned.text)
        self.assertTrue(abandoned.json()["abandoned"])
        self.assertTrue(duplicate.json()["already_abandoned"])
        self.assertEqual(retried.status_code, 200, retried.text)
        self.assertEqual(retried.json()["provider_order_id"], "PAYPALRETRY123")

        conn = get_db()
        try:
            abandoned_order = dict(conn.execute(
                "SELECT * FROM professional_route_orders WHERE provider_order_id=?",
                ("PAYPALCANCEL123",),
            ).fetchone())
        finally:
            conn.close()
        self.assertEqual(abandoned_order["status"], "cancelled")
        self.assertEqual(abandoned_order["provider_status"], "BUYER_CANCELLED")

        late_capture = {
            "id": "WH-CANCEL-LATE-CAPTURE-123",
            "event_type": "PAYMENT.CAPTURE.COMPLETED",
            "resource": {
                "id": "CAPTURECANCELLATE123",
                "status": "COMPLETED",
                "custom_id": abandoned_order["id"],
                "amount": {"currency_code": "USD", "value": "1.49"},
                "supplementary_data": {
                    "related_ids": {"order_id": "PAYPALCANCEL123"}
                },
            },
        }
        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(
                main.paypal_service,
                "verify_webhook",
                new=AsyncMock(return_value=True),
            ),
        ):
            late = self._run(self._request(
                "POST", "/api/paypal/webhook", json=late_capture,
            ))
        self.assertEqual(late.status_code, 200, late.text)

        conn = get_db()
        try:
            abandoned_order = dict(conn.execute(
                "SELECT * FROM professional_route_orders WHERE provider_order_id=?",
                ("PAYPALCANCEL123",),
            ).fetchone())
            trip = dict(conn.execute(
                "SELECT * FROM product_trips WHERE id=?", (trip_id,)
            ).fetchone())
        finally:
            conn.close()
        self.assertEqual(abandoned_order["status"], "refund_review")
        self.assertEqual(trip["professional_route_entitlement"], 0)

    def test_paypal_amount_mismatch_does_not_unlock_or_allow_admin_bypass(self):
        trip_id = self._new_trip(token=self.user_token)
        config = {
            "enabled": True,
            "environment": "sandbox",
            "client_id": "public-sandbox-client",
            "client_secret": "server-only-secret",
            "webhook_id": "webhook-test",
            "currency": "USD",
            "amount_text": "1.49",
            "amount_cents": 149,
        }
        provider_order_id = "PAYPALMISMATCH123"
        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(
                main.paypal_service,
                "create_order",
                new=AsyncMock(return_value={"id": provider_order_id, "status": "CREATED"}),
            ),
        ):
            created = self._run(
                self._request(
                    "POST", "/api/paypal/orders", token=self.user_token,
                    json={"trip_id": trip_id},
                )
            )
        self.assertEqual(created.status_code, 200, created.text)
        conn = get_db()
        try:
            order = dict(
                conn.execute(
                    "SELECT * FROM professional_route_orders WHERE provider_order_id=?",
                    (provider_order_id,),
                ).fetchone()
            )
        finally:
            conn.close()
        capture_payload = {
            "id": provider_order_id,
            "status": "COMPLETED",
            "purchase_units": [{
                "custom_id": order["id"],
                "payments": {"captures": [{
                    "id": "CAPTUREMISMATCH123", "status": "COMPLETED",
                    "amount": {"currency_code": "USD", "value": "1.48"},
                }]},
            }],
        }
        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(
                main.paypal_service, "capture_order",
                new=AsyncMock(return_value=capture_payload),
            ),
        ):
            captured = self._run(
                self._request(
                    "POST", f"/api/paypal/orders/{provider_order_id}/capture",
                    token=self.user_token,
                )
            )
        self.assertEqual(captured.status_code, 409, captured.text)
        bypass = self._run(
            self._request(
                "POST", f"/api/admin/professional-route/orders/{order['id']}/confirm",
                token=self.admin_token, json={"payment_reference": "must-not-bypass"},
            )
        )
        self.assertEqual(bypass.status_code, 409, bypass.text)
        allowance = self._run(
            self._request(
                "GET", f"/api/product-trips/{trip_id}/allowance",
                token=self.user_token,
            )
        )
        self.assertFalse(allowance.json()["professional_route_unlocked"])

    def test_verified_paypal_webhook_is_idempotent_and_refund_requires_review(self):
        trip_id = self._new_trip(token=self.user_token)
        local_order_id = str(uuid.uuid4())
        provider_order_id = "PAYPALWEBHOOK123"
        now = int(time.time())
        conn = get_db()
        try:
            conn.execute(
                """INSERT INTO professional_route_orders
                   (id,trip_id,user_id,amount_cents,currency,status,payment_method,
                    provider_order_id,provider_status,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    local_order_id, trip_id, self.user_id, 149, "USD", "pending",
                    "paypal", provider_order_id, "APPROVED", now, now,
                ),
            )
            conn.commit()
        finally:
            conn.close()
        config = {
            "enabled": True, "environment": "sandbox",
            "client_id": "public-sandbox-client", "client_secret": "server-secret",
            "webhook_id": "webhook-test", "currency": "USD",
            "amount_text": "1.49", "amount_cents": 149,
        }
        completed_event = {
            "id": "WH-COMPLETED-123",
            "event_type": "PAYMENT.CAPTURE.COMPLETED",
            "resource": {
                "id": "CAPTUREWEBHOOK123", "status": "COMPLETED",
                "custom_id": local_order_id,
                "amount": {"currency_code": "USD", "value": "1.49"},
                "supplementary_data": {"related_ids": {"order_id": provider_order_id}},
            },
        }
        invalid_event = dict(completed_event)
        invalid_event["id"] = "WH-INVALID-123"
        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(
                main.paypal_service, "verify_webhook", new=AsyncMock(return_value=False)
            ),
        ):
            invalid = self._run(
                self._request("POST", "/api/paypal/webhook", json=invalid_event)
            )
        self.assertEqual(invalid.status_code, 400, invalid.text)
        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(
                main.paypal_service, "verify_webhook", new=AsyncMock(return_value=True)
            ),
        ):
            first = self._run(
                self._request("POST", "/api/paypal/webhook", json=completed_event)
            )
            duplicate = self._run(
                self._request("POST", "/api/paypal/webhook", json=completed_event)
            )
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(duplicate.status_code, 200, duplicate.text)
        self.assertTrue(duplicate.json()["duplicate"])

        refund_event = {
            "id": "WH-REFUND-123",
            "event_type": "PAYMENT.CAPTURE.REFUNDED",
            "resource": {
                "id": "REFUND123",
                "supplementary_data": {
                    "related_ids": {"capture_id": "CAPTUREWEBHOOK123"}
                },
            },
        }
        with (
            patch.object(main.paypal_service, "settings", return_value=config),
            patch.object(
                main.paypal_service, "verify_webhook", new=AsyncMock(return_value=True)
            ),
        ):
            refunded = self._run(
                self._request("POST", "/api/paypal/webhook", json=refund_event)
            )
        self.assertEqual(refunded.status_code, 200, refunded.text)
        conn = get_db()
        try:
            order = dict(
                conn.execute(
                    "SELECT * FROM professional_route_orders WHERE id=?",
                    (local_order_id,),
                ).fetchone()
            )
            trip = dict(
                conn.execute("SELECT * FROM product_trips WHERE id=?", (trip_id,)).fetchone()
            )
        finally:
            conn.close()
        self.assertEqual(order["status"], "refund_review")
        self.assertEqual(trip["professional_route_entitlement"], 1)

        review = self._run(self._request(
            "GET", "/api/admin/professional-route/orders?status=refund_review",
            token=self.admin_token,
        ))
        self.assertEqual(review.status_code, 200, review.text)
        review_order = next(
            item for item in review.json()["orders"] if item["id"] == local_order_id
        )
        self.assertEqual(
            review_order["provider_capture_id"],
            "CAPTUREWEBHOOK123",
        )
        self.assertIsNotNone(review_order["refunded_at"])

    def test_paypal_frontend_uses_server_orders_and_never_embeds_a_secret(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        script = (frontend / "assets" / "js" / "bali-professional.js").read_text(
            encoding="utf-8"
        )
        privacy = (frontend / "privacy.html").read_text(encoding="utf-8")
        html = (frontend / "bali.html").read_text(encoding="utf-8")
        self.assertIn("/api/paypal/config", script)
        self.assertIn("/api/paypal/orders", script)
        self.assertIn("/capture", script)
        self.assertIn("/abandon", script)
        self.assertIn("pc.cancelled", script)
        self.assertIn("https://www.paypal.com/sdk/js?client-id=", script)
        self.assertIn("Sandbox test · no real charge", script)
        self.assertNotIn("PAYPAL_CLIENT_SECRET", script)
        self.assertIn("privacyPaymentTitle", privacy)
        self.assertIn("bali-professional-paypal", html)
        self.assertIn("portfolioPlaceAlreadyShown", html)
        self.assertIn("officialBooking", html)

    def test_paypal_webhook_handles_current_v2_and_checkout_status_events(self):
        config = {
            "enabled": True, "environment": "sandbox",
            "client_id": "public-sandbox-client", "client_secret": "server-secret",
            "webhook_id": "webhook-test", "currency": "USD",
            "amount_text": "1.49", "amount_cents": 149,
        }

        def new_paypal_order(provider_order_id):
            trip_id = self._new_trip(token=self.user_token)
            local_order_id = str(uuid.uuid4())
            now = int(time.time())
            conn = get_db()
            try:
                conn.execute(
                    """INSERT INTO professional_route_orders
                       (id,trip_id,user_id,amount_cents,currency,status,payment_method,
                        provider_order_id,provider_status,created_at,updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        local_order_id, trip_id, self.user_id, 149, "USD", "pending",
                        "paypal", provider_order_id, "CREATED", now, now,
                    ),
                )
                conn.commit()
            finally:
                conn.close()
            return local_order_id

        def send(event):
            with (
                patch.object(main.paypal_service, "settings", return_value=config),
                patch.object(
                    main.paypal_service, "verify_webhook",
                    new=AsyncMock(return_value=True),
                ),
            ):
                return self._run(
                    self._request("POST", "/api/paypal/webhook", json=event)
                )

        provider_order_id = "PAYPALV2STATUS123"
        local_order_id = new_paypal_order(provider_order_id)
        pending = send({
            "id": "WH-PENDING-V2-123",
            "event_type": "PAYMENT.CAPTURE.PENDING",
            "resource": {
                "id": "CAPTUREPENDING123",
                "supplementary_data": {
                    "related_ids": {"order_id": provider_order_id}
                },
            },
        })
        self.assertEqual(pending.status_code, 200, pending.text)
        conn = get_db()
        try:
            pending_order = dict(conn.execute(
                "SELECT * FROM professional_route_orders WHERE id=?",
                (local_order_id,),
            ).fetchone())
        finally:
            conn.close()
        self.assertEqual(pending_order["status"], "pending")
        self.assertEqual(pending_order["provider_status"], "PAYMENT.CAPTURE.PENDING")

        declined = send({
            "id": "WH-DECLINED-V2-123",
            "event_type": "PAYMENT.CAPTURE.DECLINED",
            "resource": {
                "id": "CAPTUREDECLINED123",
                "supplementary_data": {
                    "related_ids": {"order_id": provider_order_id}
                },
            },
        })
        self.assertEqual(declined.status_code, 200, declined.text)
        conn = get_db()
        try:
            declined_order = dict(conn.execute(
                "SELECT * FROM professional_route_orders WHERE id=?",
                (local_order_id,),
            ).fetchone())
        finally:
            conn.close()
        self.assertEqual(declined_order["status"], "failed")
        self.assertEqual(declined_order["provider_status"], "PAYMENT.CAPTURE.DECLINED")

        checkout_order_id = "PAYPALCHECKOUTSTATUS123"
        checkout_local_id = new_paypal_order(checkout_order_id)
        approved = send({
            "id": "WH-CHECKOUT-APPROVED-123",
            "event_type": "CHECKOUT.ORDER.APPROVED",
            "resource": {"id": checkout_order_id, "status": "APPROVED"},
        })
        self.assertEqual(approved.status_code, 200, approved.text)
        voided = send({
            "id": "WH-CHECKOUT-VOIDED-123",
            "event_type": "CHECKOUT.ORDER.VOIDED",
            "resource": {"id": checkout_order_id, "status": "VOIDED"},
        })
        self.assertEqual(voided.status_code, 200, voided.text)
        conn = get_db()
        try:
            checkout_order = dict(conn.execute(
                "SELECT * FROM professional_route_orders WHERE id=?",
                (checkout_local_id,),
            ).fetchone())
        finally:
            conn.close()
        self.assertEqual(checkout_order["status"], "failed")
        self.assertEqual(checkout_order["provider_status"], "CHECKOUT.ORDER.VOIDED")

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
                "package_id": "batur-dawn-choice",
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
        self.assertIn("batur-dawn-choice", html)
        self.assertIn("batur-dawn-choice", text)
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

    def test_driver_email_uses_provider_idempotency_key(self):
        request_id = "61e9e884-359b-45bb-bc49-3f3b53c04c42"
        with (
            patch.object(email_service, "DRIVER_EMAIL", "dicky@example.test"),
            patch.object(email_service, "send_email", new_callable=AsyncMock) as send,
        ):
            send.return_value = {"ok": True, "id": "email-test"}
            result = self._run(
                email_service.send_driver_request(
                    {
                        "request_id": request_id,
                        "driver_id": "dicky",
                        "first_name": "Test",
                        "contact_email": "traveller@example.test",
                    }
                )
            )
        self.assertTrue(result["ok"])
        self.assertEqual(
            send.await_args.kwargs["idempotency_key"],
            f"driver-request/dicky/{request_id}",
        )

    def test_send_email_sets_resend_idempotency_header(self):
        response = MagicMock(status_code=200)
        response.json.return_value = {"id": "email-test"}
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post.return_value = response
        with (
            patch.object(email_service, "RESEND_API_KEY", "test-key"),
            patch.object(email_service.httpx, "AsyncClient", return_value=client),
        ):
            result = self._run(
                email_service.send_email(
                    "driver@example.test",
                    "Subject",
                    "<p>Body</p>",
                    idempotency_key="driver-request/dicky/test-id",
                )
            )
        self.assertTrue(result["ok"])
        self.assertEqual(
            client.post.await_args.kwargs["headers"]["Idempotency-Key"],
            "driver-request/dicky/test-id",
        )

    def test_driver_request_passes_route_and_trip_details_to_selected_driver(self):
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            send.return_value = {"ok": True}
            response = self._run(
                self._request(
                    "POST",
                    "/api/driver-request",
                    json={
                        "driver_id": "dicky",
                        "request_id": "61e9e884-359b-45bb-bc49-3f3b53c04c42",
                        "route_id": "r5",
                        "package_id": "batur-dawn-choice",
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
        self.assertEqual(payload["request_id"], "61e9e884-359b-45bb-bc49-3f3b53c04c42")
        self.assertEqual(payload["route_id"], "R5")
        self.assertEqual(payload["package_id"], "batur-dawn-choice")
        self.assertEqual(payload["num_people"], 3)
        self.assertEqual(payload["start_date"], "2026-10-01")
        self.assertEqual(payload["end_date"], "2026-10-08")
        self.assertEqual(payload["budget_range"], "USD 6000")
        self.assertIn("Day 2: Sidemen", payload["attractions"])

    def test_driver_request_rejects_invalid_request_id(self):
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            response = self._run(
                self._request(
                    "POST",
                    "/api/driver-request",
                    json={
                        "request_id": "not-a-uuid",
                        "driver_id": "dicky",
                        "first_name": "Test",
                        "contact_email": "traveller@example.test",
                        "privacy_consent": True,
                    },
                )
            )
        self.assertEqual(response.status_code, 400, response.text)
        send.assert_not_awaited()

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

    def test_driver_request_rate_limit_separates_clients_behind_render_proxy(self):
        payload = {
            "driver_id": "dicky", "first_name": "Test",
            "contact_email": "traveller@example.test", "privacy_consent": True,
        }
        with patch.dict(os.environ, {"RENDER": "true"}), patch.object(
            main, "send_driver_request", new_callable=AsyncMock
        ) as send:
            send.return_value = {"ok": True}
            first_client = [
                self._run(
                    self._request(
                        "POST", "/api/driver-request", json=payload,
                        client_ip="10.0.0.7",
                        headers={"X-Forwarded-For": "203.0.113.17, 10.0.0.7"},
                    )
                )
                for _ in range(main._DRIVER_REQUEST_LIMIT)
            ]
            second_client = self._run(
                self._request(
                    "POST", "/api/driver-request", json=payload,
                    client_ip="10.0.0.7",
                    headers={"X-Forwarded-For": "203.0.113.18, 10.0.0.7"},
                )
            )
            blocked_first_client = self._run(
                self._request(
                    "POST", "/api/driver-request", json=payload,
                    client_ip="10.0.0.7",
                    headers={"X-Forwarded-For": "203.0.113.17, 10.0.0.7"},
                )
            )
        self.assertEqual([response.status_code for response in first_client], [200] * 5)
        self.assertEqual(second_client.status_code, 200, second_client.text)
        self.assertEqual(blocked_first_client.status_code, 429, blocked_first_client.text)
        self.assertEqual(send.await_count, 6)

    def test_driver_request_rate_limit_ignores_spoofed_forwarded_for_off_render(self):
        payload = {
            "driver_id": "dicky", "first_name": "Test",
            "contact_email": "traveller@example.test", "privacy_consent": True,
        }
        with patch.dict(os.environ, {"RENDER": ""}), patch.object(
            main, "send_driver_request", new_callable=AsyncMock
        ) as send:
            send.return_value = {"ok": True}
            responses = [
                self._run(
                    self._request(
                        "POST", "/api/driver-request", json=payload,
                        client_ip="10.0.0.7",
                        headers={"X-Forwarded-For": f"203.0.113.{index}"},
                    )
                )
                for index in range(1, main._DRIVER_REQUEST_LIMIT + 2)
            ]
        self.assertEqual([response.status_code for response in responses[:5]], [200] * 5)
        self.assertEqual(responses[5].status_code, 429, responses[5].text)
        self.assertEqual(send.await_count, 5)

    def test_driver_request_rate_limit_persists_only_pseudonymous_counter(self):
        payload = {
            "driver_id": "dicky", "first_name": "Private Name",
            "contact_email": "private@example.test", "privacy_consent": True,
            "attractions": "Private itinerary text", "budget_range": "Private budget",
        }
        with patch.object(main, "send_driver_request", new_callable=AsyncMock) as send:
            send.return_value = {"ok": True}
            response = self._run(
                self._request(
                    "POST", "/api/driver-request", json=payload,
                    client_ip="203.0.113.17",
                )
            )
        self.assertEqual(response.status_code, 200, response.text)
        conn = get_db()
        try:
            row = conn.execute("SELECT * FROM driver_request_rate_limits").fetchone()
        finally:
            conn.close()
        self.assertIsNotNone(row)
        stored = dict(row)
        self.assertEqual(
            set(stored),
            {"client_key", "window_started_at", "request_count", "updated_at"},
        )
        self.assertRegex(stored["client_key"], r"^[0-9a-f]{64}$")
        self.assertEqual(stored["request_count"], 1)
        self.assertNotIn("203.0.113.17", json.dumps(stored))
        self.assertNotIn("Private", json.dumps(stored))

    def test_driver_request_rate_limit_is_atomic_and_separates_clients(self):
        key = hashlib.sha256(b"same-client").hexdigest()
        with ThreadPoolExecutor(max_workers=8) as pool:
            counts = list(
                pool.map(
                    lambda _: main._consume_driver_request_attempt(key, 1_000_000),
                    range(8),
                )
            )
        self.assertEqual(
            sum(count <= main._DRIVER_REQUEST_LIMIT for count in counts), 5
        )
        self.assertEqual(max(counts), main._DRIVER_REQUEST_LIMIT + 1)
        other_count = main._consume_driver_request_attempt(
            hashlib.sha256(b"other-client").hexdigest(), 1_000_000
        )
        self.assertEqual(other_count, 1)

    def test_driver_request_rate_limit_resets_after_window(self):
        key = hashlib.sha256(b"expiring-client").hexdigest()
        counts = [
            main._consume_driver_request_attempt(key, 1_000_000)
            for _ in range(main._DRIVER_REQUEST_LIMIT)
        ]
        self.assertEqual(counts[-1], main._DRIVER_REQUEST_LIMIT)
        self.assertEqual(
            main._consume_driver_request_attempt(key, 1_000_060),
            main._DRIVER_REQUEST_LIMIT + 1,
        )
        conn = get_db()
        try:
            blocked_row = dict(
                conn.execute(
                    "SELECT window_started_at,request_count,updated_at "
                    "FROM driver_request_rate_limits WHERE client_key=?",
                    (key,),
                ).fetchone()
            )
        finally:
            conn.close()
        self.assertEqual(blocked_row["window_started_at"], 1_000_000)
        self.assertEqual(blocked_row["request_count"], main._DRIVER_REQUEST_LIMIT + 1)
        self.assertEqual(blocked_row["updated_at"], 1_000_060)
        self.assertEqual(
            main._consume_driver_request_attempt(
                key, 1_000_000 + main._DRIVER_REQUEST_WINDOW_SECONDS
            ),
            1,
        )

    def test_driver_request_rate_limit_fails_closed_when_db_is_unavailable(self):
        payload = {
            "driver_id": "dicky", "first_name": "Test",
            "contact_email": "traveller@example.test", "privacy_consent": True,
        }
        with patch.object(main, "get_db", side_effect=RuntimeError("db unavailable")), patch.object(
            main, "send_driver_request", new_callable=AsyncMock
        ) as send:
            response = self._run(
                self._request("POST", "/api/driver-request", json=payload)
            )
        self.assertEqual(response.status_code, 503, response.text)
        self.assertNotIn("db unavailable", response.text)
        send.assert_not_awaited()

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
        self.assertEqual(len(poi_ids), 62)
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
        verified_ids = {
            "tirta_empul",
            "tanah_lot",
            "besakih_temple",
            "gwk",
            "ubud_monkey_forest",
            "uluwatu_temple",
            "seminyak_beach",
            "batu_bolong_beach",
            "echo_beach",
            "petitenget_temple",
            "yoga_barn",
            "pyramids_of_chi",
            "tibumana_waterfall",
            "melasti_beach",
            "jimbaran_bay",
            "sanur_beach",
            "mertasari_beach",
            "tegalalang_rice_terrace",
            "ubud_palace",
            "ubud_art_market",
            "campuhan_ridge_walk",
            "padang_padang_beach",
            "pandawa_beach",
            "bingin_beach",
            "nusa_dua_beach",
            "suluban_beach",
            "kelingking_beach",
            "broken_beach",
            "angels_billabong",
            "crystal_bay",
            "diamond_beach",
            "rumah_pohon_molenteng",
            "atuh_beach",
            "celuk_village",
            "goa_gajah",
            "kanto_lampo_waterfall",
            "tirta_gangga",
            "sidemen_valley",
            "banyumala_waterfall",
            "tamblingan_lake",
            "tukad_cepung_waterfall",
            "amed_beach",
            "ulun_danu_beratan",
            "tegenungan_waterfall",
            "jatiluwih_rice_terraces",
            "lempuyang_temple",
            "taman_ujung",
            "virgin_beach",
            "heart_space_bali",
            "intuitive_flow",
            "munduk_waterfall",
            "gitgit_waterfall",
            "tulamben",
            "taman_ayun",
            "taman_saraswati",
            "sundays_beach_club",
            "batur_hot_springs",
        }
        self.assertEqual(
            {poi["id"] for poi in data["pois"] if poi["verification_status"] == "verified"},
            verified_ids,
        )
        self.assertEqual(
            sum(poi["verification_status"] == "pending_review" for poi in data["pois"]),
            2,
        )
        gated_ids = {
            "thousand_islands_viewpoint": "pending_review",
            "mount_batur_trailhead": "pending_review",
            "bali_fire_shooting_club": "needs_supplier_confirmation",
            "celuk_silver_class": "needs_supplier_confirmation",
            "mount_batur_jeep": "needs_supplier_confirmation",
        }
        for poi_id, expected_status in gated_ids.items():
            poi = poi_by_id[poi_id]
            self.assertEqual(poi["verification_status"], expected_status, poi_id)
            verification = poi["verification"]
            expected_reviewed = (
                "2026-08-27" if poi_id == "bali_fire_shooting_club" else "2026-08-26"
            )
            self.assertEqual(verification["reviewed_at"], expected_reviewed, poi_id)
            self.assertTrue(verification["verified_scope"], poi_id)
            self.assertTrue(verification["live_checks"], poi_id)
            self.assertTrue(verification["sources"], poi_id)
            for source in verification["sources"]:
                self.assertTrue(source["title"], (poi_id, source))
                self.assertTrue(source["url"].startswith("https://"), (poi_id, source))
        for route_grouped_id in {
            "ulun_danu_beratan",
            "tegenungan_waterfall",
            "jatiluwih_rice_terraces",
        }:
            self.assertIn("itinerary grouping", poi_by_id[route_grouped_id]["notes"])
        self.assertIn("Penataran Agung", poi_by_id["lempuyang_temple"]["notes"])
        self.assertIn("summit temple", poi_by_id["lempuyang_temple"]["notes"])
        self.assertIn("Pantai Perasi", poi_by_id["virgin_beach"]["name"])
        self.assertIn("does not promise", poi_by_id["virgin_beach"]["notes"])
        self.assertIn("does not verify medical benefit", poi_by_id["heart_space_bali"]["notes"])
        self.assertIn("does not verify medical benefit", poi_by_id["intuitive_flow"]["notes"])
        self.assertIn("must not be merged", poi_by_id["munduk_waterfall"]["notes"])
        self.assertIn("must not be merged", poi_by_id["gitgit_waterfall"]["notes"])
        self.assertIn("does not verify any dive operator", poi_by_id["tulamben"]["notes"])
        self.assertIn("World Heritage", poi_by_id["taman_ayun"]["notes"])
        self.assertIn("public access", poi_by_id["taman_saraswati"]["notes"])
        self.assertIn("tide", poi_by_id["sundays_beach_club"]["verification"]["live_checks"])
        shooting = poi_by_id["bali_fire_shooting_club"]
        self.assertEqual(
            shooting["booking_url"], "https://balifireshootingclub.com/product/"
        )
        self.assertIn("historical public figures", shooting["notes"])
        self.assertEqual(
            poi_by_id["thousand_islands_viewpoint"]["verification_status"],
            "pending_review",
        )
        self.assertIn(
            "do not uniquely bind",
            poi_by_id["thousand_islands_viewpoint"]["notes"],
        )
        self.assertEqual(
            poi_by_id["mount_batur_trailhead"]["name"],
            "Mount Batur Hiking Area",
        )
        self.assertIn(
            "multiple hiking posts",
            poi_by_id["mount_batur_trailhead"]["notes"],
        )
        self.assertEqual(
            poi_by_id["batur_hot_springs"]["name"],
            "Batur Natural Hot Spring",
        )
        self.assertIn(
            "hygiene",
            poi_by_id["batur_hot_springs"]["verification"]["live_checks"],
        )
        supplier_confirmation_ids = {
            "mount_batur_jeep",
            "bali_fire_shooting_club",
            "celuk_silver_class",
        }
        self.assertEqual(
            {
                poi["id"]
                for poi in data["pois"]
                if poi["verification_status"] == "needs_supplier_confirmation"
            },
            supplier_confirmation_ids,
        )
        self.assertEqual(
            sum(
                poi["verification_status"] == "needs_supplier_confirmation"
                for poi in data["pois"]
            ),
            3,
        )
        r1 = next(route for route in data["routes"] if route["id"] == "R1")
        self.assertEqual(
            r1["verification_status"],
            "needs_supplier_confirmation",
        )
        r1_outline_ids = {
            poi_id
            for day in r1["free_outline"]
            for poi_id in day["suggested_poi_ids"]
        }
        self.assertEqual(len(r1_outline_ids), 16)
        self.assertEqual(
            {
                poi_by_id[poi_id]["verification_status"]
                for poi_id in r1_outline_ids
            },
            {"verified", "needs_supplier_confirmation"},
        )
        self.assertEqual(
            {
                poi_id
                for poi_id in r1_outline_ids
                if poi_by_id[poi_id]["verification_status"]
                == "needs_supplier_confirmation"
            },
            {"mount_batur_jeep"},
        )
        r2 = next(route for route in data["routes"] if route["id"] == "R2")
        self.assertEqual(r2["verification_status"], "verified")
        r2_outline_ids = {
            poi_id
            for day in r2["free_outline"]
            for poi_id in day["suggested_poi_ids"]
        }
        self.assertEqual(len(r2_outline_ids), 10)
        self.assertEqual(
            {poi_by_id[poi_id]["verification_status"] for poi_id in r2_outline_ids},
            {"verified"},
        )
        r3 = next(route for route in data["routes"] if route["id"] == "R3")
        self.assertEqual(r3["verification_status"], "verified")
        r3_outline_ids = {
            poi_id
            for day in r3["free_outline"]
            for poi_id in day["suggested_poi_ids"]
        }
        self.assertEqual(len(r3_outline_ids), 8)
        self.assertEqual(
            {poi_by_id[poi_id]["verification_status"] for poi_id in r3_outline_ids},
            {"verified"},
        )
        r4 = next(route for route in data["routes"] if route["id"] == "R4")
        self.assertEqual(r4["verification_status"], "verified")
        r4_outline_ids = {
            poi_id
            for day in r4["free_outline"]
            for poi_id in day["suggested_poi_ids"]
        }
        self.assertEqual(len(r4_outline_ids), 10)
        self.assertEqual(
            {poi_by_id[poi_id]["verification_status"] for poi_id in r4_outline_ids},
            {"verified"},
        )
        self.assertEqual(
            r4["free_outline"][2]["suggested_poi_ids"],
            ["celuk_village", "tegalalang_rice_terrace"],
        )
        r5 = next(route for route in data["routes"] if route["id"] == "R5")
        self.assertEqual(r5["verification_status"], "needs_supplier_confirmation")
        r5_outline_ids = {
            poi_id
            for day in r5["free_outline"]
            for poi_id in day["suggested_poi_ids"]
        }
        self.assertEqual(len(r5_outline_ids), 9)
        self.assertEqual(
            {
                poi_by_id[poi_id]["verification_status"]
                for poi_id in r5_outline_ids
            },
            {"verified", "pending_review", "needs_supplier_confirmation"},
        )
        self.assertEqual(
            {
                poi_id
                for poi_id in r5_outline_ids
                if poi_by_id[poi_id]["verification_status"] == "pending_review"
            },
            {"mount_batur_trailhead"},
        )
        self.assertEqual(
            {
                poi_id
                for poi_id in r5_outline_ids
                if poi_by_id[poi_id]["verification_status"]
                == "needs_supplier_confirmation"
            },
            {"mount_batur_jeep"},
        )
        r6 = next(route for route in data["routes"] if route["id"] == "R6")
        self.assertEqual(r6["verification_status"], "verified")
        r6_outline_ids = {
            poi_id
            for day in r6["free_outline"]
            for poi_id in day["suggested_poi_ids"]
        }
        self.assertEqual(len(r6_outline_ids), 10)
        self.assertEqual(
            {poi_by_id[poi_id]["verification_status"] for poi_id in r6_outline_ids},
            {"verified"},
        )
        self.assertIn("opening_hours", data["verification_policy"]["live_checks_required"])
        bali_html = (data_path.parents[2] / "bali.html").read_text(encoding="utf-8")
        self.assertNotIn("Stable route facts reviewed", bali_html)
        self.assertNotIn("路线稳定事实已核验", bali_html)
        self.assertIn("Confirm before booking", bali_html)
        self.assertIn("预约前确认", bali_html)
        self.assertIn(
            "https://maimelali.banglikab.go.id/objek/batur-natural-hot-spring",
            {
                source["url"]
                for source in poi_by_id["batur_hot_springs"]["verification"]["sources"]
            },
        )
        for poi_id in verified_ids:
            poi = poi_by_id[poi_id]
            self.assertTrue(poi["official_url"].startswith("https://"), poi_id)
            verification = poi["verification"]
            self.assertRegex(verification["reviewed_at"], r"^\d{4}-\d{2}-\d{2}$")
            self.assertTrue(verification["verified_scope"], poi_id)
            self.assertTrue(verification["live_checks"], poi_id)
            self.assertTrue(verification["sources"], poi_id)
            for source in verification["sources"]:
                self.assertTrue(source["url"].startswith("https://"), (poi_id, source))
                self.assertIn(
                    source["kind"],
                    {
                        "official_venue",
                        "official_booking",
                        "government_tourism",
                        "government_registry",
                        "international_heritage_registry",
                    },
                    (poi_id, source),
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

    def test_dicky_five_day_route_gaps_are_normalized_without_generic_pois(self):
        data_path = (
            BACKEND_DIR.parents[1]
            / "wandermind-studio"
            / "frontend"
            / "assets"
            / "data"
            / "bali-travel-data.json"
        )
        data = json.loads(data_path.read_text(encoding="utf-8"))
        poi_by_id = {poi["id"]: poi for poi in data["pois"]}

        for poi_id in {
            "suluban_beach",
            "kelingking_beach",
            "broken_beach",
            "angels_billabong",
            "crystal_bay",
            "diamond_beach",
            "rumah_pohon_molenteng",
            "atuh_beach",
        }:
            self.assertEqual(poi_by_id[poi_id]["verification_status"], "verified")
            self.assertIn("R1", poi_by_id[poi_id]["route_ids"])

        self.assertIn("Blue Point", poi_by_id["suluban_beach"]["name"])
        self.assertEqual(
            poi_by_id["thousand_islands_viewpoint"]["verification_status"],
            "pending_review",
        )
        self.assertEqual(
            poi_by_id["bali_fire_shooting_club"]["verification_status"],
            "needs_supplier_confirmation",
        )
        for generic_id in {
            "airport_pickup",
            "airport_dropoff",
            "hotel_check_in",
            "lunch_dinner",
            "cliff_road",
            "shopping",
            "blue_point",
        }:
            self.assertNotIn(generic_id, poi_by_id)

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

    def test_bali_route_editor_uses_visual_place_picker_and_reports_outcomes(self):
        html = (
            BACKEND_DIR.parents[1]
            / "wandermind-studio"
            / "frontend"
            / "bali.html"
        ).read_text(encoding="utf-8")
        for message in (
            "Point to a place to preview it.",
            "将鼠标移到地点上可预览",
            "場所にポインターを合わせるとプレビューできます。",
            "장소에 마우스를 올리면 미리 볼 수 있습니다.",
            "Arahkan penunjuk untuk melihat pratinjau.",
        ):
            self.assertIn(message, html)
        self.assertIn('class="bali-day-feedback', html)
        self.assertIn("aria-describedby=\"' + feedbackId + '\"", html)
        self.assertIn('role="listbox"', html)
        self.assertIn('data-open-place-picker="', html)
        self.assertIn('data-route-picker-confirm', html)
        self.assertIn("image-publish-manifest.json?v=20260825p3", html)
        self.assertIn("variant === 'thumbnail'", html)
        self.assertIn("pickerAttributionMarkup(media, copy)", html)
        self.assertIn('rel="noopener noreferrer"', html)
        self.assertIn('decoding="async"', html)
        self.assertIn("text(media.description) || copy.fit", html)
        self.assertIn("poiMediaState === 'failed' ? copy.mediaErrorBody", html)
        self.assertIn("routeEditorFeedback = { routeId:context.route.id", html)
        self.assertIn("nextTrigger.focus({ preventScroll:true })", html)
        self.assertIn("appendApprovedLibraryPortfolio", html)
        self.assertIn("shot.dataset.fullImage", html)
        self.assertIn('id="bali-place-credit"', html)
        self.assertIn("rights.license_name", html)
        for localized_subcategory in (
            "Ocean & beach",
            "海岸与沙滩",
            "海岸とビーチ",
            "해안과 해변",
            "Pesisir & pantai",
        ):
            self.assertIn(localized_subcategory, html)

    def test_bali_mobile_journey_uses_progressive_disclosure_without_hiding_desktop(self):
        html = (
            BACKEND_DIR.parents[1]
            / "wandermind-studio"
            / "frontend"
            / "bali.html"
        ).read_text(encoding="utf-8")
        self.assertEqual(html.count('data-mobile-section="'), 3)
        self.assertEqual(html.count('data-mobile-nav="'), 3)
        self.assertIn("function openExclusive(section)", html)
        self.assertIn("setActiveMobileNav(section.dataset.mobileSection)", html)
        self.assertIn("setActiveMobileNav(null)", html)
        self.assertIn(".bali-mobile-section-body { display:contents; }", html)
        self.assertIn("[data-mobile-section].bali-mobile-collapsed .bali-mobile-section-body { display:none; }", html)
        self.assertIn("window.matchMedia('(max-width:575px)').matches ? 6 : 12", html)
        self.assertIn("body { padding-bottom:calc(66px + env(safe-area-inset-bottom)); }", html)
        self.assertIn("@media (hover:hover) and (pointer:fine)", html)

    def test_mobile_navigation_and_driver_photo_keep_their_readable_full_frame_contract(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        css = (frontend / "assets" / "css" / "style-starter.css").read_text(
            encoding="utf-8"
        )
        bali_html = (frontend / "bali.html").read_text(encoding="utf-8")

        self.assertIn("body:not(.dark) .w3l-header-4 .navbar .navbar-collapse.show", css)
        self.assertIn("background: #fffaf0 !important", css)
        self.assertIn("color: #17373a !important", css)
        self.assertIn(
            ".bali-driver-car { aspect-ratio:auto; height:auto; object-fit:contain; object-position:center bottom; }",
            bali_html,
        )
        self.assertNotIn(
            ".bali-driver-car { aspect-ratio:16/10; object-fit:cover; }",
            bali_html,
        )
        for page_name in (
            "index.html",
            "about.html",
            "services.html",
            "bali.html",
            "ai-tool.html",
            "find-driver.html",
            "contact.html",
        ):
            with self.subTest(page=page_name):
                html = (frontend / page_name).read_text(encoding="utf-8")
                self.assertIn("assets/css/style-starter.css?v=search1", html)

    def test_find_driver_light_dark_focus_and_mobile_styles_are_explicit(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        driver_html = (frontend / "find-driver.html").read_text(encoding="utf-8")

        self.assertIn("--fd-muted: #52605c", driver_html)
        self.assertIn("--fd-border: #d8d2c5", driver_html)
        self.assertIn(".fd-driver-choice:focus-within", driver_html)
        self.assertIn("body.dark .fd-driver-choice span { color:#c9c6bd; }", driver_html)
        self.assertIn(".fd-input:focus-visible", driver_html)
        self.assertIn("@media (max-width: 480px)", driver_html)
        self.assertIn(".fd-spin { animation: none; }", driver_html)
        self.assertNotIn(
            ".fd-driver li { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; line-height: 1.6; padding: 6px 0; color: rgba(255,255,255,.92); }",
            driver_html,
        )

    def test_find_driver_phone_flow_progressively_reveals_form_and_profiles(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        driver_html = (frontend / "find-driver.html").read_text(encoding="utf-8")
        i18n_js = (frontend / "assets" / "js" / "i18n.js").read_text(
            encoding="utf-8"
        )

        self.assertEqual(
            driver_html.count('<section class="fd-mobile-step'), 3
        )
        self.assertEqual(driver_html.count('data-fd-step-target="'), 3)
        self.assertIn("function setMobileStep(step, focusHeading)", driver_html)
        self.assertIn("function setProfileOpen(open, shouldScroll)", driver_html)
        self.assertIn("showRequestError(L.fdErrDates", driver_html)
        self.assertIn(".fd-mobile-step.active { display:block; }", driver_html)
        self.assertIn(".fd-profile-shell.is-open { display:block; }", driver_html)
        self.assertIn('aria-controls="fd-profile-shell"', driver_html)
        for key in (
            "fdStepTrip:",
            "fdStepNeeds:",
            "fdStepReview:",
            "fdViewDriver:",
        ):
            self.assertEqual(i18n_js.count(key), 5)

    def test_find_driver_reuses_request_id_only_for_unchanged_retry(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        driver_html = (frontend / "find-driver.html").read_text(encoding="utf-8")

        self.assertIn("var driverRequestId = '';", driver_html)
        self.assertIn("var driverRequestFingerprint = '';", driver_html)
        self.assertIn("var fingerprint = JSON.stringify(payload);", driver_html)
        self.assertIn("driverRequestFingerprint !== fingerprint", driver_html)
        self.assertIn("payload.request_id = driverRequestId;", driver_html)

    def test_find_driver_form_and_header_expose_mobile_accessibility_contracts(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        driver_html = (frontend / "find-driver.html").read_text(encoding="utf-8")
        global_auth = (frontend / "assets" / "js" / "global-auth.js").read_text(
            encoding="utf-8"
        )

        self.assertIn('aria-controls="navbarTogglerDemo02"', driver_html)
        self.assertIn('aria-label="Search WanderMind"', driver_html)
        self.assertIn('aria-label="Toggle color theme"', driver_html)
        self.assertIn(".theme-selector input { display: block !important;", driver_html)
        self.assertIn(".theme-selector:focus-within", driver_html)
        self.assertIn('<form class="fd-card" id="fd-form-card" novalidate>', driver_html)
        self.assertIn('type="submit" class="fd-submit"', driver_html)
        self.assertIn("form.addEventListener('submit'", driver_html)
        self.assertIn('id="fd-msg" role="status" aria-live="polite"', driver_html)
        self.assertIn('id="fd-success-title" tabindex="-1"', driver_html)
        self.assertIn("successTitle.focus({ preventScroll: true })", driver_html)
        self.assertIn(".fd-input, .fd-textarea, .fd-num { width: 100%; min-height: 44px;", driver_html)
        self.assertIn(".fd-source-btn { min-height: 44px;", driver_html)
        self.assertIn('for="fd-first"', driver_html)
        self.assertIn('for="fd-last"', driver_html)
        self.assertIn('id="fd-src-manual" aria-pressed="true"', driver_html)
        self.assertIn('id="fd-src-import" aria-pressed="false"', driver_html)
        self.assertIn("emailEl.checkValidity()", driver_html)
        self.assertIn("document.addEventListener('wm:language-change', render)", global_auth)

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

    def test_portfolio_orphan_cleanup_is_scoped_idempotent_and_admin_only(self):
        cloud_env = {
            "CLOUDINARY_CLOUD_NAME": "wandermind-test",
            "CLOUDINARY_API_KEY": "public-test-key",
            "CLOUDINARY_API_SECRET": "portfolio-test-secret",
        }

        destination = "cleanup-test"

        def signed_cleanup(filename):
            signature_response = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/upload-signature",
                    token=self.admin_token,
                    json={"destination": destination, "filename": filename},
                )
            )
            self.assertEqual(signature_response.status_code, 200, signature_response.text)
            signature_payload = signature_response.json()
            cleanup = signature_payload["cleanup"]
            self.assertTrue(cleanup["public_id"].startswith(
                f"wandermind/portfolio/{destination}/"
            ))
            version = cleanup["timestamp"] + 1
            response_signature = hashlib.sha1(
                (
                    f"public_id={cleanup['public_id']}&version={version}"
                    f"{cloud_env['CLOUDINARY_API_SECRET']}"
                ).encode()
            ).hexdigest()
            return signature_payload, {
                "destination": destination,
                "cloudinary_public_id": cleanup["public_id"],
                "cloudinary_version": version,
                "response_signature": response_signature,
                "cleanup_timestamp": cleanup["timestamp"],
                "cleanup_token": cleanup["token"],
            }

        with patch.dict(os.environ, cloud_env, clear=False):
            signature_payload, cleanup_payload = signed_cleanup("orphan.jpg")
            replacement_signature = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/upload-signature",
                    token=self.admin_token,
                    json={
                        "destination": destination,
                        "filename": "replacement.jpg",
                        "replacement_asset_id": "missing-asset",
                    },
                )
            )
            self.assertEqual(replacement_signature.status_code, 404)

            denied = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/upload-cleanup",
                    token=self.user_token,
                    json=cleanup_payload,
                )
            )
            self.assertEqual(denied.status_code, 403)

            invalid_payload = dict(cleanup_payload)
            invalid_payload["cleanup_token"] = "0" * 64
            invalid = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/upload-cleanup",
                    token=self.admin_token,
                    json=invalid_payload,
                )
            )
            self.assertEqual(invalid.status_code, 400)
            self.assertIn("cleanup authorization", invalid.text)

            destroy = AsyncMock(return_value="ok")
            with patch.object(main, "_cloudinary_destroy_image", destroy):
                cleaned = self._run(
                    self._request(
                        "POST",
                        "/api/admin/portfolio/upload-cleanup",
                        token=self.admin_token,
                        json=cleanup_payload,
                    )
                )
            self.assertEqual(cleaned.status_code, 200, cleaned.text)
            self.assertEqual(cleaned.json()["result"], "deleted")
            destroy.assert_awaited_once_with(cleanup_payload["cloudinary_public_id"])

            with patch.object(
                main, "_cloudinary_destroy_image", AsyncMock(return_value="not found")
            ):
                repeated = self._run(
                    self._request(
                        "POST",
                        "/api/admin/portfolio/upload-cleanup",
                        token=self.admin_token,
                        json=cleanup_payload,
                    )
                )
            self.assertEqual(repeated.status_code, 200, repeated.text)
            self.assertEqual(repeated.json()["result"], "not_found")

            _, registered_cleanup = signed_cleanup("registered.jpg")
            registered_asset = {
                "destination": destination,
                "primary_theme": "culture",
                "original_filename": "registered.jpg",
                "sha256": hashlib.sha256(b"registered-image").hexdigest(),
                "file_bytes": 240000,
                "width": 1600,
                "height": 1000,
                "format": "jpg",
                "image_metadata": {},
                "cloudinary_asset_id": f"registered-{uuid.uuid4().hex}",
                "cloudinary_public_id": registered_cleanup["cloudinary_public_id"],
                "cloudinary_version": registered_cleanup["cloudinary_version"],
                "secure_url": (
                    "https://res.cloudinary.com/wandermind-test/image/upload/"
                    f"v{registered_cleanup['cloudinary_version']}/"
                    f"{registered_cleanup['cloudinary_public_id']}.jpg"
                ),
                "response_signature": registered_cleanup["response_signature"],
                "status": "draft",
            }
            created = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/assets",
                    token=self.admin_token,
                    json=registered_asset,
                )
            )
            self.assertEqual(created.status_code, 200, created.text)
            repeated_create = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/assets",
                    token=self.admin_token,
                    json=registered_asset,
                )
            )
            self.assertEqual(repeated_create.status_code, 200, repeated_create.text)
            self.assertTrue(repeated_create.json()["idempotent"])
            self.assertEqual(
                repeated_create.json()["asset"]["id"], created.json()["asset"]["id"]
            )
            conflicting_asset = dict(registered_asset)
            conflicting_asset["cloudinary_asset_id"] = f"conflict-{uuid.uuid4().hex}"
            conflict = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/assets",
                    token=self.admin_token,
                    json=conflicting_asset,
                )
            )
            self.assertEqual(conflict.status_code, 409, conflict.text)
            registered_destroy = AsyncMock(return_value="ok")
            with patch.object(main, "_cloudinary_destroy_image", registered_destroy):
                registered = self._run(
                    self._request(
                        "POST",
                        "/api/admin/portfolio/upload-cleanup",
                        token=self.admin_token,
                        json=registered_cleanup,
                    )
                )
            self.assertEqual(registered.status_code, 200, registered.text)
            self.assertEqual(registered.json()["result"], "registered")
            registered_destroy.assert_not_awaited()

            expired_payload = dict(cleanup_payload)
            expired_payload["cleanup_timestamp"] = int(time.time()) - 7200
            expired_payload["cleanup_token"] = main._portfolio_cleanup_token(
                destination,
                expired_payload["cloudinary_public_id"],
                expired_payload["cleanup_timestamp"],
                cloud_env["CLOUDINARY_API_SECRET"],
            )
            expired = self._run(
                self._request(
                    "POST",
                    "/api/admin/portfolio/upload-cleanup",
                    token=self.admin_token,
                    json=expired_payload,
                )
            )
            self.assertEqual(expired.status_code, 400)
            self.assertIn("expired", expired.text)

    def test_cloudinary_destroy_uses_signed_image_endpoint_and_rejects_unknown_result(self):
        cloud_env = {
            "CLOUDINARY_CLOUD_NAME": "wandermind-test",
            "CLOUDINARY_API_KEY": "public-test-key",
            "CLOUDINARY_API_SECRET": "portfolio-test-secret",
        }

        class FakeResponse:
            def __init__(self, result):
                self.result = result

            def raise_for_status(self):
                return None

            def json(self):
                return {"result": self.result}

        class FakeClient:
            def __init__(self, result):
                self.result = result
                self.url = ""
                self.data = {}

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return None

            async def post(self, url, data):
                self.url = url
                self.data = data
                return FakeResponse(self.result)

        public_id = "wandermind/portfolio/bali/orphan-test"
        ok_client = FakeClient("ok")
        with patch.dict(os.environ, cloud_env, clear=False), patch.object(
            main.httpx, "AsyncClient", return_value=ok_client
        ):
            result = self._run(main._cloudinary_destroy_image(public_id))
        self.assertEqual(result, "ok")
        self.assertEqual(
            ok_client.url,
            "https://api.cloudinary.com/v1_1/wandermind-test/image/destroy",
        )
        self.assertEqual(ok_client.data["public_id"], public_id)
        self.assertEqual(ok_client.data["invalidate"], "true")
        self.assertEqual(ok_client.data["api_key"], "public-test-key")
        self.assertNotIn("portfolio-test-secret", json.dumps(ok_client.data))
        expected_params = {
            "invalidate": ok_client.data["invalidate"],
            "public_id": ok_client.data["public_id"],
            "timestamp": ok_client.data["timestamp"],
        }
        self.assertEqual(
            ok_client.data["signature"],
            main._cloudinary_sign(expected_params, cloud_env["CLOUDINARY_API_SECRET"]),
        )

        unknown_client = FakeClient("pending")
        with patch.dict(os.environ, cloud_env, clear=False), patch.object(
            main.httpx, "AsyncClient", return_value=unknown_client
        ):
            with self.assertRaises(HTTPException) as caught:
                self._run(main._cloudinary_destroy_image(public_id))
        self.assertEqual(caught.exception.status_code, 502)

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
            if replacement_asset_id:
                self.assertIsNone(signature_payload["cleanup"])
            else:
                self.assertTrue(signature_payload["cleanup"]["public_id"].startswith(
                    "wandermind/portfolio/bali/"
                ))
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
            def localized(value):
                return {
                    lang: value if lang == "en" else f"{value} [{lang}]"
                    for lang in ("zh", "en", "ja", "ko", "id")
                }

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
                "title": localized(title),
                "description": localized("A sunrise wildlife experience in North Bali."),
                "alt_text": localized("Dolphins seen from a Lovina sunrise boat"),
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

        approved_hashes = {
            hashlib.sha256(f"image-{suffix}".encode()).hexdigest()
            for suffix in ("1", "2", "3")
        }
        with patch.dict(os.environ, cloud_env, clear=False), patch.object(
            main, "_portfolio_approved_hashes", return_value=approved_hashes
        ):
            first = create_asset("lovina-one.jpg", "1", "Lovina at sunrise")
            second = create_asset("lovina-two.jpg", "2", "Dolphin boat moment")

            public_draft = self._run(
                self._request("GET", "/api/portfolio?destination=bali")
            )
            self.assertEqual(public_draft.status_code, 200)
            self.assertNotIn(first["id"], {item["id"] for item in public_draft.json()["assets"]})

            with patch.object(main, "_portfolio_approved_hashes", return_value=set()):
                blocked_publish = self._run(
                    self._request(
                        "PATCH",
                        f"/api/admin/portfolio/assets/{second['id']}",
                        token=self.admin_token,
                        json={"status": "published"},
                    )
                )
            self.assertEqual(blocked_publish.status_code, 400, blocked_publish.text)
            self.assertIn("approved manifest", blocked_publish.text)

            unapproved_create = {
                "destination": "bali",
                "primary_theme": "culture",
                "place_name": "Unapproved place",
                "title": {"en": "Unapproved image"},
                "alt_text": {"en": "Unapproved image"},
                "verification_status": "route-linked",
                "status": "published",
            }
            unapproved_create.update(signed_upload("unapproved.jpg", "4"))
            with patch.object(main, "_portfolio_approved_hashes", return_value=set()):
                blocked_create = self._run(
                    self._request(
                        "POST",
                        "/api/admin/portfolio/assets",
                        token=self.admin_token,
                        json=unapproved_create,
                    )
                )
            self.assertEqual(blocked_create.status_code, 400, blocked_create.text)

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

            unapproved_replacement = signed_upload(
                "unapproved-replacement.jpg", "4", replacement_asset_id=first["id"]
            )
            with patch.object(main, "_portfolio_approved_hashes", return_value=set()):
                blocked_replacement = self._run(
                    self._request(
                        "POST",
                        f"/api/admin/portfolio/assets/{first['id']}/replace",
                        token=self.admin_token,
                        json=unapproved_replacement,
                    )
                )
            self.assertEqual(blocked_replacement.status_code, 400, blocked_replacement.text)

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

    def test_portfolio_publish_requires_all_five_locales_but_draft_does_not(self):
        incomplete = {
            "primary_theme": "experiences",
            "place_name": "Lovina Dolphin Watching",
            "title": {"en": "Lovina at sunrise"},
            "description": {"en": "A North Bali wildlife experience."},
            "alt_text": {"en": "Dolphins seen from a Lovina boat"},
            "status": "draft",
        }
        draft = main._validate_portfolio_metadata(incomplete)
        self.assertEqual(draft["status"], "draft")
        self.assertEqual(draft["title"], {"en": "Lovina at sunrise"})

        with self.assertRaises(main.HTTPException) as caught:
            main._validate_portfolio_metadata({**incomplete, "status": "published"})
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("title.zh", caught.exception.detail)
        self.assertIn("description.ja", caught.exception.detail)
        self.assertIn("alt_text.id", caught.exception.detail)

        localized = {
            lang: f"Complete metadata {lang}"
            for lang in ("zh", "en", "ja", "ko", "id")
        }
        published = main._validate_portfolio_metadata(
            {
                **incomplete,
                "title": localized,
                "description": localized,
                "alt_text": localized,
                "status": "published",
            }
        )
        self.assertEqual(published["status"], "published")

    def test_portfolio_publish_approval_fails_closed_for_invalid_manifest(self):
        with patch.object(main.json, "loads", return_value=[]):
            with self.assertRaises(main.HTTPException) as caught:
                main._portfolio_approved_hashes()
        self.assertEqual(caught.exception.status_code, 503)
        self.assertIn("invalid structure", caught.exception.detail)
        with patch.object(main.json, "loads", return_value={"images": None}):
            with self.assertRaises(main.HTTPException) as caught:
                main._portfolio_approved_hashes()
        self.assertEqual(caught.exception.status_code, 503)
        self.assertIn("invalid images list", caught.exception.detail)

    def test_portfolio_admin_page_uses_direct_signed_upload_and_static_fallback(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        admin_html = (frontend / "admin" / "portfolio.html").read_text(encoding="utf-8")
        admin_js = (frontend / "assets" / "js" / "admin-portfolio.js").read_text(encoding="utf-8")
        bali_html = (frontend / "bali.html").read_text(encoding="utf-8")
        self.assertIn('id="fileInput"', admin_html)
        self.assertIn("multiple", admin_html)
        self.assertIn('id="manifestStatus"', admin_html)
        self.assertIn('id="queueDialog"', admin_html)
        self.assertIn("admin-portfolio.js?v=p6", admin_html)
        self.assertIn('id="uploadDefaults"', admin_html)
        self.assertNotIn('id="uploadDefaults" open', admin_html)
        self.assertIn("Approved images are filled automatically", admin_html)
        self.assertIn("/api/admin/portfolio/upload-signature", admin_js)
        self.assertIn("image-publish-manifest.json?v=p2", admin_js)
        self.assertIn("state.manifestByHash[record.sha256]", admin_js)
        self.assertIn("record.metadataEdited", admin_js)
        self.assertIn("publishNeedsManifestReview", admin_js)
        self.assertIn("isApprovedPortfolioAsset", admin_js)
        self.assertIn("manifestApprovalRequired", admin_js)
        self.assertIn("duplicateAsset", admin_js)
        self.assertIn("asset.sha256 === record.sha256", admin_js)
        self.assertIn("localizedSuggestion(item.title", admin_js)
        self.assertIn("localizedSuggestion(item.description", admin_js)
        self.assertIn("reviewAutoMetadata", admin_js)
        self.assertIn("hasCompletePublishedMetadata", admin_js)
        self.assertIn("draftUploadFinished", admin_js)
        self.assertIn("/api/admin/portfolio/upload-cleanup", admin_js)
        self.assertIn("retryUploadCleanup", admin_js)
        self.assertIn("retryUploadRecovery", admin_js)
        self.assertIn("isDeterministicSaveRejection", admin_js)
        self.assertIn("uploadRecoveryPending", admin_js)
        self.assertIn("uploadCleanupFailed", admin_js)
        self.assertIn("summaryParts.join(' · ')", admin_js)
        self.assertIn("xhr.open('POST', signature.upload_url)", admin_js)
        self.assertIn("isSupportedImageFile(file)", admin_js)
        self.assertIn("t('preview')", admin_js)
        self.assertIn("https://api.cloudinary.com", Path(main.__file__).read_text(encoding="utf-8"))
        self.assertIn("_require_portfolio_publish_approval", Path(main.__file__).read_text(encoding="utf-8"))
        self.assertIn("_validate_portfolio_cleanup_claim", Path(main.__file__).read_text(encoding="utf-8"))
        self.assertIn("/image/destroy", Path(main.__file__).read_text(encoding="utf-8"))
        self.assertNotIn("CLOUDINARY_API_SECRET", admin_js)
        self.assertNotIn("/api/admin/portfolio/upload-file", admin_js)
        self.assertIn("/api/portfolio?destination=bali", bali_html)
        self.assertIn("dynamicGalleryCopy", bali_html)
        self.assertGreaterEqual(bali_html.count('class="bali-shot"'), 37)

    def test_approved_image_manifest_contains_unique_118_and_new_lempuyang_hash(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        intake_path = frontend / "assets" / "data" / "image-intake-review.csv"
        with intake_path.open(encoding="utf-8", newline="") as handle:
            intake_rows = list(csv.DictReader(handle))
        self.assertEqual(len(intake_rows), 117)
        for row in intake_rows:
            self.assertNotIn(None, row, row.get("Filename"))
            self.assertEqual(row["EligibleForPublish"], "True", row["Filename"])
            self.assertTrue(row["WebOptimizedPath"], row["Filename"])
            self.assertTrue((frontend / row["WebOptimizedPath"]).is_file(), row["Filename"])

        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        images = manifest["images"]
        self.assertEqual(len(images), 118)
        self.assertEqual(len(images), len(intake_rows) + 1)
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

        tanah_lot = next(
            item
            for item in images
            if item["relative_path"] == "assets/images/Pura Tanah Lot.jpg"
        )
        self.assertEqual(
            tanah_lot["sha256"],
            "f7cd422d0d2322bcb90cb2a7b4c5538441ecdc1cf61715860b9949a4e74967cf",
        )
        self.assertEqual(tanah_lot["region_ids"], ["G1"])
        self.assertEqual(tanah_lot["route_ids"], ["R1", "R4", "R6"])
        self.assertEqual(tanah_lot["poi_ids"], ["tanah_lot"])
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(tanah_lot[field]), {"zh", "en", "ja", "ko", "id"})
            self.assertTrue(all("?" not in value for value in tanah_lot[field].values()))

    def test_external_exact_poi_image_batch_has_mobile_assets_locales_and_rights(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        rights_manifest = json.loads(
            (frontend / "assets" / "data" / "image-rights-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        bali_data = json.loads(
            (frontend / "assets" / "data" / "bali-travel-data.json").read_text(
                encoding="utf-8"
            )
        )
        expected = {
            "assets/images/Campuhan Ridge Walk - Artem Beliaikin.jpg": (
                "campuhan_ridge_walk",
                "CC0 1.0",
            ),
            "assets/images/Tegallalang Rice Terraces - Philip Nalangan.jpg": (
                "tegalalang_rice_terrace",
                "CC BY 4.0",
            ),
            "assets/images/Ubud Art Market - Jorge Lascar.jpg": (
                "ubud_art_market",
                "CC BY 2.0",
            ),
            "assets/images/Melasti Beach - Dare2Leap.jpg": (
                "melasti_beach",
                "CC BY-SA 4.0",
            ),
            "assets/images/Ubud Palace - Jorge Lascar.jpg": (
                "ubud_palace",
                "CC BY 2.0",
            ),
            "assets/images/Broken Beach - Aaron Rentfrew.jpg": (
                "broken_beach",
                "CC BY-SA 4.0",
            ),
            "assets/images/Jatiluwih Rice Terraces - Jorge Franganillo.jpg": (
                "jatiluwih_rice_terraces",
                "CC BY 2.0",
            ),
            "assets/images/Jimbaran Bay Sunset - Simon Sees.jpg": (
                "jimbaran_bay",
                "CC BY 2.0",
            ),
            "assets/images/Seminyak Beach Sunset - Christophe95.jpg": (
                "seminyak_beach",
                "CC BY-SA 4.0",
            ),
            "assets/images/Tirta Gangga - Bair175.jpg": (
                "tirta_gangga",
                "CC BY-SA 3.0",
            ),
        }
        by_path = {item["relative_path"]: item for item in manifest["images"]}
        rights_by_hash = {
            item["sha256"]: item
            for item in rights_manifest["assets"]
            if item.get("sha256")
        }
        poi_by_id = {item["id"]: item for item in bali_data["pois"]}
        languages = {"zh", "en", "ja", "ko", "id"}

        self.assertEqual(len(rights_manifest["assets"]), 118)
        for path, (poi_id, license_name) in expected.items():
            item = by_path[path]
            self.assertEqual(item["poi_ids"], [poi_id])
            self.assertEqual(poi_by_id[poi_id]["verification_status"], "verified")
            self.assertEqual(item["rights"]["license_name"], license_name)
            self.assertTrue(item["rights"]["creator"])
            self.assertTrue(item["rights"]["source_url"].startswith("https://commons.wikimedia.org/"))
            self.assertTrue(item["rights"]["license_url"].startswith("https://creativecommons.org/"))
            self.assertIn("WebP", item["rights"]["adaptation_notice"])
            for field in ("title", "description", "alt_text"):
                self.assertEqual(set(item[field]), languages)
                self.assertTrue(all(value.strip() for value in item[field].values()))
            for field in (
                "destination",
                "primary_theme",
                "region",
                "area",
                "place_name",
                "place_type",
                "prominence",
                "mood",
                "photography_style",
                "verification_status",
            ):
                self.assertTrue(item[field], (path, field))
            self.assertEqual(item["destination"], "bali")
            self.assertEqual(item["verification_status"], "route-linked")
            self.assertIsInstance(item["extension_ids"], list)
            original = frontend / item["relative_path"]
            web = frontend / item["web_optimized_path"]
            thumbnail = frontend / item["thumbnail_path"]
            self.assertTrue(original.is_file())
            self.assertTrue(web.is_file())
            self.assertTrue(thumbnail.is_file())
            self.assertLess(thumbnail.stat().st_size, web.stat().st_size)
            self.assertLess(web.stat().st_size, original.stat().st_size)
            rights_item = rights_by_hash[item["sha256"]]
            self.assertEqual(rights_item["license_name"], license_name)
            self.assertEqual(rights_item["approval_source"], "source_license_audit")
            self.assertTrue(rights_item["publishable"])

        melasti = by_path["assets/images/Melasti Beach - Dare2Leap.jpg"]
        self.assertIn("CC BY-SA 4.0", melasti["rights"]["adaptation_notice"])

    def test_first_route_linked_d8_portfolio_batch_has_reviewed_five_language_copy(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        bali_data = json.loads(
            (frontend / "assets" / "data" / "bali-travel-data.json").read_text(
                encoding="utf-8"
            )
        )
        expected_paths = {
            "assets/images/Garuda Wisnu Kencana.jpg",
            "assets/images/Intuitive Flow1.jpg",
            "assets/images/Pura Besakih1.png",
            "assets/images/Pura Besakih2.png",
            "assets/images/Pura Besakih3.png",
            "assets/images/Pura Besakih4.png",
            "assets/images/Pura Luhur Uluwatu1.jpg",
            "assets/images/Pura Luhur Uluwatu2.jpg",
            "assets/images/Pura Tanah Lot.jpg",
            "assets/images/Pura Ulun Danu.jpg",
            "assets/images/Pyramids_Of_Chi音疗1.jpg",
            "assets/images/Pyramids_Of_Chi音疗2.jpg",
            "assets/images/Tirta Empul Water Purification Temple.jpg",
            "assets/images/ubud yogabarn1.jpg",
            "assets/images/ubud yogabarn2.jpg",
        }
        d8_themes = {"landscapes", "culture", "experiences"}
        batch = [
            item
            for item in manifest["images"]
            if item["relative_path"] in expected_paths
            and item["category"] in d8_themes
            and item["region_ids"]
            and item["route_ids"]
            and item["poi_ids"]
        ]
        self.assertEqual({item["relative_path"] for item in batch}, expected_paths)

        poi_status = {item["id"]: item["verification_status"] for item in bali_data["pois"]}
        languages = {"zh", "en", "ja", "ko", "id"}
        for item in batch:
            self.assertTrue((frontend / item["web_optimized_path"]).is_file())
            for field in ("title", "description", "alt_text"):
                self.assertEqual(set(item[field]), languages)
                self.assertTrue(all(value.strip() for value in item[field].values()))
                self.assertTrue(all("?" not in value for value in item[field].values()))
            for poi_id in item["poi_ids"]:
                self.assertEqual(poi_status.get(poi_id), "verified")

        gwk = next(item for item in batch if item["poi_ids"] == ["gwk"])
        self.assertNotIn("temple", gwk["tags"])
        self.assertIn("cultural-park", gwk["tags"])

    def test_second_d8_portfolio_batch_has_verified_pois_and_five_language_copy(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        bali_data = json.loads(
            (frontend / "assets" / "data" / "bali-travel-data.json").read_text(
                encoding="utf-8"
            )
        )
        expected = {
            "assets/images/Pura Taman Ayun.jpg": "taman_ayun",
            "assets/images/Pura Taman Saraswati1.jpg": "taman_saraswati",
            "assets/images/Pura Taman Saraswati2.jpg": "taman_saraswati",
            "assets/images/uluwatu_sunday beach club1.jpg": "sundays_beach_club",
            "assets/images/uluwatu_sunday beach club2.jpg": "sundays_beach_club",
            "assets/images/Lempuyang Temple.jpg": "lempuyang_temple",
        }
        by_path = {item["relative_path"]: item for item in manifest["images"]}
        poi_by_id = {item["id"]: item for item in bali_data["pois"]}
        languages = {"zh", "en", "ja", "ko", "id"}

        for path, poi_id in expected.items():
            item = by_path[path]
            self.assertEqual(item["poi_ids"], [poi_id])
            self.assertEqual(poi_by_id[poi_id]["verification_status"], "verified")
            self.assertTrue((frontend / item["web_optimized_path"]).is_file())
            for field in ("title", "description", "alt_text"):
                self.assertEqual(set(item[field]), languages)
                self.assertTrue(all(value.strip() for value in item[field].values()))
                self.assertTrue(all("?" not in value for value in item[field].values()))

        complete_d8 = [
            item
            for item in manifest["images"]
            if item["category"] in {"landscapes", "culture", "experiences"}
            and all(
                set(item.get(field, {})) == languages
                and all(value.strip() for value in item[field].values())
                for field in ("title", "description", "alt_text")
            )
        ]
        self.assertEqual(len(complete_d8), 53)

        lempuyang = by_path["assets/images/Lempuyang Temple.jpg"]
        self.assertIn("Penataran Agung", lempuyang["title"]["en"])
        self.assertIn("not the summit temple", lempuyang["description"]["en"])

    def test_tenth_d8_batch_syncs_static_bali_cards_and_quarantines_non_bali_assets(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        by_path = {item["relative_path"]: item for item in manifest["images"]}
        languages = {"zh", "en", "ja", "ko", "id"}
        static_paths = {
            f"assets/images/bali-{index}.jpg"
            for index in (5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19)
        }

        for path in static_paths:
            item = by_path[path]
            self.assertEqual(item["destination"], "bali")
            self.assertTrue(item["route_ids"], path)
            self.assertTrue(item["place_name"], path)
            self.assertTrue(item["place_type"], path)
            self.assertTrue(item["photography_style"], path)
            for field in ("title", "description", "alt_text"):
                self.assertEqual(set(item[field]), languages, path)
                self.assertTrue(all(value.strip() for value in item[field].values()), path)

        broken = by_path["assets/images/rock-ocean-landscape.jpg"]
        self.assertEqual(broken["destination"], "bali")
        self.assertEqual(broken["region_ids"], ["G3"])
        self.assertEqual(broken["poi_ids"], ["broken_beach"])
        self.assertTrue(broken["route_ids"])

        foreign_destinations = {
            "assets/images/aerial-view-lush-green-rock-islands-palau-turquoise-waters.jpg": "palau",
            "assets/images/aerial-view-turquoise-water-boats-phuket-beach-thailand.jpg": "phuket-thailand",
            "assets/images/beautiful-beach-view-koh-chang-island-seascape-trad-province-eastern-thailand-blue-sky-background.jpg": "koh-chang-thailand",
            "assets/images/high-angle-shot-beautiful-foggy-cliffs-calm-blue-ocean-captured-kauai-hawaii.jpg": "kauai-hawaii",
            "assets/images/wide-angle-shot-aegean-sea-rocky-coast-with-greenery-around-bushes-trees-hills-mountain-blue-water-with-waves-view-from-drone-greece.jpg": "greece",
        }
        for path, destination in foreign_destinations.items():
            item = by_path[path]
            self.assertEqual(item["location_status"], "non_bali_named")
            self.assertEqual(item["destination"], destination)
            self.assertFalse(item["region_ids"] or item["route_ids"] or item["poi_ids"])

        isolated = {
            "assets/images/travelling-china.jpg": ("location_conflict", ""),
            "assets/images/aerial-view-tropical-beach-with-turquoise-ocean-waves.jpg": ("unknown", ""),
            "assets/images/vertical-overhead-shot-beautiful-shoreline-sea-with-blue-clean-water-sandy-beach.jpg": ("unknown", ""),
            "assets/images/mesmerizing-view-calm-ocean-trees-shore-sunset-indonesia.jpg": ("indonesia_named", "indonesia"),
        }
        for path, (status, destination) in isolated.items():
            item = by_path[path]
            self.assertEqual(item["location_status"], status)
            self.assertEqual(item["destination"], destination)
            self.assertFalse(item["region_ids"] or item["route_ids"] or item["poi_ids"])

        core = [
            item
            for item in manifest["images"]
            if item["category"] in {"landscapes", "culture", "experiences"}
        ]
        incomplete = [
            item
            for item in core
            if not all(
                set(item.get(field, {})) == languages
                and all(value.strip() for value in item[field].values())
                for field in ("title", "description", "alt_text")
            )
        ]
        self.assertEqual(len(incomplete), 9)
        self.assertTrue(
            all(
                not (item["region_ids"] or item["route_ids"] or item["poi_ids"])
                for item in incomplete
            )
        )

    def test_third_d8_portfolio_batch_maps_bali_12_to_verified_monkey_forest(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        bali_data = json.loads(
            (frontend / "assets" / "data" / "bali-travel-data.json").read_text(
                encoding="utf-8"
            )
        )
        by_path = {item["relative_path"]: item for item in manifest["images"]}
        poi_by_id = {item["id"]: item for item in bali_data["pois"]}
        item = by_path["assets/images/bali-12.jpg"]
        languages = {"zh", "en", "ja", "ko", "id"}

        self.assertEqual(
            item["sha256"],
            "3d75af3a6b693c122721ed8c0ab8a01be453a641f7daf06482af4cc2cea217e8",
        )
        self.assertEqual(item["web_optimized_path"], "assets/images/web/3d75af3a6b693c12.webp")
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertEqual(item["category"], "landscapes")
        self.assertEqual(item["sub_category"], "nature-wildlife")
        self.assertEqual(item["region_ids"], ["G4"])
        self.assertEqual(item["route_ids"], ["R1", "R2", "R4"])
        self.assertEqual(item["poi_ids"], ["ubud_monkey_forest"])
        self.assertEqual(
            poi_by_id["ubud_monkey_forest"]["verification_status"], "verified"
        )
        self.assertTrue(
            {"forest", "wildlife", "culture", "entrance"}.issubset(item["tags"])
        )
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(item[field]), languages)
            self.assertTrue(all(value.strip() for value in item[field].values()))
            self.assertTrue(all("?" not in value for value in item[field].values()))
        self.assertIn("official", item["description"]["en"].lower())

    def test_fourth_d8_portfolio_batch_describes_galungan_without_inventing_a_place(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        html = (frontend / "bali.html").read_text(encoding="utf-8")
        intake_csv = (
            frontend / "assets" / "data" / "image-intake-review.csv"
        ).read_text(encoding="utf-8")
        intake_line = next(
            line for line in intake_csv.splitlines() if line.startswith("Galungan.jpg,")
        )
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        by_path = {item["relative_path"]: item for item in manifest["images"]}
        item = by_path["assets/images/Galungan.jpg"]
        languages = {"zh", "en", "ja", "ko", "id"}

        self.assertEqual(
            item["sha256"],
            "a637d36cf0e9f53a7b940cdff9787e5581af61cdfcd7882c03d87c3ba0591006",
        )
        self.assertEqual(
            item["web_optimized_path"], "assets/images/web/a637d36cf0e9f53a.webp"
        )
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertEqual(item["category"], "culture")
        self.assertEqual(item["sub_category"], "balinese-culture")
        self.assertTrue({"culture", "festival", "penjor"}.issubset(item["tags"]))
        self.assertNotIn("temple", item["tags"])
        self.assertEqual(item["location_status"], "bali-named")
        self.assertEqual(item["region_ids"], [])
        self.assertEqual(item["route_ids"], ["R4"])
        self.assertEqual(item["poi_ids"], [])
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(item[field]), languages)
            self.assertTrue(all(value.strip() for value in item[field].values()))
            self.assertTrue(all("?" not in value for value in item[field].values()))
        self.assertIn("associated", item["title"]["en"].lower())
        self.assertIn("unverified", item["description"]["en"].lower())
        self.assertIn(
            'data-place="galungan" data-category="culture"', html
        )
        self.assertIn('data-tags="culture festival penjor"', html)
        self.assertIn('data-route-ids="R4"', html)
        self.assertIn(
            'alt="Rows of curved bamboo penjor decorations beside a road in Bali under a blue sky"',
            html,
        )
        self.assertIn("galungan:'galungan'", html)
        self.assertIn("culture;festival;penjor", intake_line)
        self.assertNotIn("culture;temple", intake_line)
        self.assertIn(item["alt_text"]["en"], intake_line)
        for copy in (
            "Balinese penjor associated with Galungan",
            "与加隆安节相关的巴厘岛佩恩乔尔",
            "ガルンガンに関連するバリ島のペンジョール",
            "갈룽안과 관련된 발리의 펜조르",
            "Penjor Bali yang berkaitan dengan Galungan",
        ):
            self.assertIn(copy, html)

    def test_fifth_d8_portfolio_batch_corrects_nyepi_filename_to_visible_seminyak_scene(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        html = (frontend / "bali.html").read_text(encoding="utf-8")
        intake_csv = (
            frontend / "assets" / "data" / "image-intake-review.csv"
        ).read_text(encoding="utf-8")
        intake_line = next(
            line for line in intake_csv.splitlines() if line.startswith("Nyepi.jpg,")
        )
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        by_path = {item["relative_path"]: item for item in manifest["images"]}
        item = by_path["assets/images/Nyepi.jpg"]
        languages = {"zh", "en", "ja", "ko", "id"}

        self.assertEqual(
            item["sha256"],
            "5ea1261626ebac26342958d6ca299cfff578f8f01ec04c41a1281f05ced1a550",
        )
        self.assertEqual(
            item["web_optimized_path"], "assets/images/web/5ea1261626ebac26.webp"
        )
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertEqual(item["category"], "culture")
        self.assertEqual(item["sub_category"], "balinese-culture")
        self.assertTrue(
            {"culture", "community", "temple", "penjor"}.issubset(item["tags"])
        )
        self.assertEqual(item["location_status"], "bali-named")
        self.assertEqual(item["region_ids"], ["G1"])
        self.assertEqual(item["route_ids"], ["R6"])
        self.assertEqual(item["poi_ids"], [])
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(item[field]), languages)
            self.assertTrue(all(value.strip() for value in item[field].values()))
            self.assertTrue(all("?" not in value for value in item[field].values()))
        self.assertIn("unverified", item["description"]["en"].lower())
        self.assertIn("culture;community;temple;penjor", intake_line)
        self.assertIn(item["alt_text"]["en"], intake_line)
        self.assertIn('data-place="pura-desa-seminyak-gathering"', html)
        self.assertIn('data-region="G1" data-area="Seminyak"', html)
        self.assertIn('data-route-ids="R6"', html)
        self.assertNotIn('data-place="nyepi"', html)
        self.assertNotIn('alt="Nyepi cultural moment in Bali"', html)
        for copy in (
            "Balinese cultural gathering at Pura Desa Adat Seminyak",
            "塞米亚克村社神庙的巴厘文化聚会",
            "プラ・デサ・アダット・スミニャックのバリ文化の集い",
            "푸라 데사 아다트 스미냑의 발리 문화 모임",
            "Pertemuan budaya Bali di Pura Desa Adat Seminyak",
        ):
            self.assertIn(copy, html)

    def test_sixth_d8_portfolio_batch_does_not_treat_bali_filename_as_location_evidence(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        intake_csv = (
            frontend / "assets" / "data" / "image-intake-review.csv"
        ).read_text(encoding="utf-8")
        intake_line = next(
            line for line in intake_csv.splitlines() if line.startswith("bali-1.jpg,")
        )
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        item = next(
            image
            for image in manifest["images"]
            if image["relative_path"] == "assets/images/bali-1.jpg"
        )
        languages = {"zh", "en", "ja", "ko", "id"}

        self.assertEqual(
            item["sha256"],
            "51ab7ab45565e4b5238bda9a7991263b8fdbf31dd4c076242bd4b3ef58eb0966",
        )
        self.assertEqual(
            item["web_optimized_path"], "assets/images/web/51ab7ab45565e4b5.webp"
        )
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertEqual(item["category"], "landscapes")
        self.assertEqual(item["sub_category"], "ocean-beach")
        self.assertEqual(
            item["tags"],
            ["coast", "ocean", "intertidal", "rocky-shore", "twilight", "coastal-building"],
        )
        self.assertEqual(item["location_status"], "unknown")
        self.assertEqual(item["region_ids"], [])
        self.assertEqual(item["route_ids"], [])
        self.assertEqual(item["poi_ids"], [])
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(item[field]), languages)
            self.assertTrue(all(value.strip() for value in item[field].values()))
            self.assertTrue(all("?" not in value for value in item[field].values()))
        self.assertIn("unverified", item["description"]["en"].lower())
        self.assertNotIn("bali", " ".join(item["tags"]).lower())
        self.assertIn(
            "coast;ocean;intertidal;rocky-shore;twilight;coastal-building",
            intake_line,
        )
        self.assertIn(",unknown,,,,", intake_line)
        self.assertIn(item["alt_text"]["en"], intake_line)

    def test_seventh_d8_portfolio_batch_keeps_unverified_split_gate_location_unknown(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        intake_csv = (
            frontend / "assets" / "data" / "image-intake-review.csv"
        ).read_text(encoding="utf-8")
        intake_line = next(
            line for line in intake_csv.splitlines() if line.startswith("bali-2.jpg,")
        )
        manifest = json.loads(
            (frontend / "assets" / "data" / "image-publish-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        item = next(
            image
            for image in manifest["images"]
            if image["relative_path"] == "assets/images/bali-2.jpg"
        )
        languages = {"zh", "en", "ja", "ko", "id"}

        self.assertEqual(
            item["sha256"],
            "94036e2811302fc80417370f6ca64f13a6d85b667a1c222751d8b0f6f5bd6d90",
        )
        self.assertEqual(
            item["web_optimized_path"], "assets/images/web/94036e2811302fc8.webp"
        )
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertEqual(item["category"], "culture")
        self.assertEqual(item["sub_category"], "balinese-culture")
        self.assertEqual(
            item["tags"],
            [
                "culture",
                "architecture",
                "split-gate",
                "mountain",
                "greenery",
                "road",
                "cloth-decoration",
            ],
        )
        self.assertEqual(item["location_status"], "unknown")
        self.assertEqual(item["region_ids"], [])
        self.assertEqual(item["route_ids"], [])
        self.assertEqual(item["poi_ids"], [])
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(item[field]), languages)
            self.assertTrue(all(value.strip() for value in item[field].values()))
            self.assertTrue(all("?" not in value for value in item[field].values()))
        self.assertIn("Handara Gate", item["description"]["en"])
        self.assertIn("unverified", item["description"]["en"].lower())
        self.assertNotIn("handara", " ".join(item["tags"]).lower())
        self.assertIn(
            "culture;architecture;split-gate;mountain;greenery;road;cloth-decoration",
            intake_line,
        )
        self.assertIn(",unknown,,,,", intake_line)
        self.assertIn(item["alt_text"]["en"], intake_line)

    def test_eighth_d8_portfolio_batch_maps_kelingking_viewpoint_safely(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        intake_csv = (frontend / "assets" / "data" / "image-intake-review.csv").read_text(encoding="utf-8")
        intake_line = next(line for line in intake_csv.splitlines() if line.startswith("bali-3.jpg,"))
        manifest = json.loads((frontend / "assets" / "data" / "image-publish-manifest.json").read_text(encoding="utf-8"))
        item = next(image for image in manifest["images"] if image["relative_path"] == "assets/images/bali-3.jpg")

        self.assertEqual(item["sha256"], "c11a45dfcccc8767d48929e159242a184b9521a295b07498684e1df04265a857")
        self.assertEqual(item["web_optimized_path"], "assets/images/web/c11a45dfcccc8767.webp")
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertEqual(item["category"], "landscapes")
        self.assertEqual(item["sub_category"], "ocean-beach")
        self.assertEqual(item["location_status"], "route-linked")
        self.assertEqual(item["region_ids"], ["G3"])
        self.assertEqual(item["route_ids"], ["R1", "R6"])
        self.assertEqual(item["poi_ids"], ["kelingking_beach"])
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(item[field]), {"zh", "en", "ja", "ko", "id"})
            self.assertTrue(all(value.strip() and "?" not in value for value in item[field].values()))
        self.assertIn("steep descent", item["description"]["en"].lower())
        self.assertIn("G3,R1;R6,kelingking_beach", intake_line)

    def test_ninth_d8_portfolio_batch_keeps_unverified_mountain_location_unknown(self):
        frontend = BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend"
        intake_csv = (frontend / "assets" / "data" / "image-intake-review.csv").read_text(encoding="utf-8")
        intake_line = next(line for line in intake_csv.splitlines() if line.startswith("bali-4.jpg,"))
        manifest = json.loads((frontend / "assets" / "data" / "image-publish-manifest.json").read_text(encoding="utf-8"))
        item = next(image for image in manifest["images"] if image["relative_path"] == "assets/images/bali-4.jpg")

        self.assertEqual(item["sha256"], "353e3b2879150547b42f7ee92518a6423416effa123b045c4fea5805e3502fad")
        self.assertEqual(item["web_optimized_path"], "assets/images/web/353e3b2879150547.webp")
        self.assertTrue((frontend / item["web_optimized_path"]).is_file())
        self.assertEqual(item["category"], "landscapes")
        self.assertEqual(item["sub_category"], "mountains-volcano")
        self.assertEqual(item["tags"], ["mountain", "rocky-terrain", "forest", "clouds", "scattered-buildings"])
        self.assertEqual(item["location_status"], "unknown")
        self.assertEqual(item["region_ids"], [])
        self.assertEqual(item["route_ids"], [])
        self.assertEqual(item["poi_ids"], [])
        for field in ("title", "description", "alt_text"):
            self.assertEqual(set(item[field]), {"zh", "en", "ja", "ko", "id"})
            self.assertTrue(all(value.strip() and "?" not in value for value in item[field].values()))
        self.assertIn("unverified", item["description"]["en"].lower())
        self.assertNotIn("bali", " ".join(item["tags"]).lower())
        self.assertNotIn("batur", json.dumps(item).lower())
        self.assertNotIn("kintamani", json.dumps(item).lower())
        self.assertIn("mountain;rocky-terrain;forest;clouds;scattered-buildings", intake_line)
        self.assertIn(",unknown,,,,", intake_line)
        self.assertIn(item["alt_text"]["en"], intake_line)

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
            "Check before travel",
            "出发前确认",
            "出発前に確認",
            "출발 전 확인",
            "Periksa sebelum berangkat",
        ):
            self.assertIn(localized_status, html)
        for internal_status in (
            "Stable facts reviewed",
            "稳定事实已核验",
            "Planning anchor · verify details",
            "规划参考 · 细节待核验",
        ):
            self.assertNotIn(internal_status, html)
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
        self.assertIn("document.addEventListener('wm:language-change'", driver_html)
        self.assertIn('assets/js/i18n.js?v=search2', driver_html)
        self.assertIn('assets/js/driver-estimate.js?v=p2', driver_html)
        self.assertIn('id="fd-full-days"', driver_html)
        self.assertIn('id="fd-half-days"', driver_html)
        self.assertIn('id="fd-estimator-total"', driver_html)
        self.assertIn('aria-live="polite"', driver_html)
        self.assertIn('aria-describedby="fd-estimator-boundary"', driver_html)
        self.assertIn('.fd-estimator-input:focus-visible', driver_html)
        self.assertIn('outline: 3px solid var(--fd-teal)', driver_html)
        self.assertIn('id="fd-estimator-total">—</strong>', driver_html)
        self.assertIn('inputmode="numeric"', driver_html)
        self.assertIn('viewport-fit=cover', driver_html)
        self.assertIn("Full day: IDR 700k", driver_html)
        self.assertIn("half day: IDR 500k", driver_html)
        self.assertIn("Overtime is IDR 70k per hour", driver_html)
        self.assertIn('class="fd-rate-details"', driver_html)
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
        for estimate_key in (
            "fdEstimateTitle",
            "fdEstimateIntro",
            "fdEstimateFullDays",
            "fdEstimateHalfDays",
            "fdEstimateTotal",
            "fdEstimateStart",
            "fdEstimateBoundary",
            "fdEstimateFullLine",
            "fdEstimateHalfLine",
        ):
            self.assertEqual(i18n_js.count(estimate_key), 5)
        for confirmed_quote in (
            "Full day: IDR 700k",
            "全天：70 万印尼盾",
            "終日：70万 IDR",
            "종일: 70만 IDR",
            "Seharian: IDR 700k",
        ):
            self.assertIn(confirmed_quote, i18n_js)
        for removed_quote in (
            "IDR 50k per guest",
            "每位游客 5 万印尼盾",
            "1名につき 5万 IDR",
            "1인당 5만 IDR",
            "IDR 50k per tamu",
            "IDR 75k per hour",
        ):
            self.assertNotIn(removed_quote, i18n_js)
        for stale_quote in (
            "From IDR 750k",
            "IDR 750k 起",
            "IDR 750k〜",
            "IDR 750k부터",
            "mulai <strong>IDR 750k",
        ):
            self.assertNotIn(stale_quote, i18n_js)
        self.assertIn("new CustomEvent('wm:language-change'", i18n_js)
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
        self.assertNotIn('action="mailto:', contact_html)
        self.assertIn("window.location.href = 'mailto:lfwu22@126.com?subject='", contact_html)

        ai_js = (frontend_dir / "assets" / "js" / "ai-tool.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("const routeId = q.get('route') || ''", ai_js)
        self.assertIn("routeHints", ai_js)

    def test_driver_estimate_uses_confirmed_public_baseline(self):
        estimator = (
            BACKEND_DIR.parents[1]
            / "wandermind-studio"
            / "frontend"
            / "assets"
            / "js"
            / "driver-estimate.js"
        )
        script = """
const estimate = require(process.argv[1]);
const cases = [
  [{people: 1, fullDays: 1, halfDays: 0}, 700000],
  [{people: 2, fullDays: 1, halfDays: 0}, 700000],
  [{people: 2, fullDays: 0, halfDays: 1}, 500000],
  [{people: 2, fullDays: 3, halfDays: 1}, 2600000],
  [{people: 0, fullDays: 3, halfDays: 1}, 2600000]
];
for (const [input, total] of cases) {
  if (estimate.calculate(input).total !== total) process.exit(1);
}
if ('perGuestPerDay' in estimate.constants) process.exit(1);
"""
        result = subprocess.run(
            ["node", "-e", script, str(estimator)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        estimator_js = estimator.read_text(encoding="utf-8")
        self.assertNotIn("fetch(", estimator_js)
        self.assertNotIn("localStorage.setItem", estimator_js)
        driver_html = (
            BACKEND_DIR.parents[1] / "wandermind-studio" / "frontend" / "find-driver.html"
        ).read_text(encoding="utf-8")
        self.assertNotIn("WMDriverEstimate.requestSummary", driver_html)

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

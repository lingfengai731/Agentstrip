"""Small fail-closed PayPal Orders v2 client.

Only public configuration leaves this module. Client secrets stay server-side,
and all payment decisions are revalidated by the caller before an entitlement
is written.
"""

from __future__ import annotations

import os
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import httpx


class PayPalError(RuntimeError):
    def __init__(self, code: str, status_code: int = 502):
        super().__init__(code)
        self.code = code
        self.status_code = status_code


def settings(require_enabled: bool = False) -> dict:
    environment = os.getenv("PAYPAL_ENV", "sandbox").strip().lower()
    if environment not in {"sandbox", "live"}:
        environment = "sandbox"
    client_id = os.getenv("PAYPAL_CLIENT_ID", "").strip()
    client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "").strip()
    webhook_id = os.getenv("PAYPAL_WEBHOOK_ID", "").strip()
    currency = os.getenv("PAYPAL_CURRENCY", "USD").strip().upper()
    if currency != "USD":
        raise PayPalError("paypal_currency_not_supported", 503)
    try:
        amount = Decimal(os.getenv("PAYPAL_ROUTE_PRICE", "1.49")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    except (InvalidOperation, ValueError):
        raise PayPalError("paypal_price_invalid", 503)
    if amount <= 0:
        raise PayPalError("paypal_price_invalid", 503)
    enabled = bool(client_id and client_secret)
    if require_enabled and not enabled:
        raise PayPalError("paypal_not_configured", 503)
    return {
        "environment": environment,
        "base_url": (
            "https://api-m.paypal.com"
            if environment == "live"
            else "https://api-m.sandbox.paypal.com"
        ),
        "client_id": client_id,
        "client_secret": client_secret,
        "webhook_id": webhook_id,
        "currency": currency,
        "amount": amount,
        "amount_text": format(amount, ".2f"),
        "amount_cents": int(amount * 100),
        "enabled": enabled,
    }


async def _access_token(config: dict) -> str:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                config["base_url"] + "/v1/oauth2/token",
                data={"grant_type": "client_credentials"},
                auth=(config["client_id"], config["client_secret"]),
                headers={"Accept": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise PayPalError("paypal_unavailable") from exc
    if response.status_code != 200:
        raise PayPalError("paypal_auth_failed", 503)
    try:
        token = response.json().get("access_token", "")
    except ValueError as exc:
        raise PayPalError("paypal_auth_failed", 503) from exc
    if not token:
        raise PayPalError("paypal_auth_failed", 503)
    return token


async def _post(config: dict, path: str, payload: dict, request_id: str = "") -> dict:
    token = await _access_token(config)
    headers = {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if request_id:
        headers["PayPal-Request-Id"] = request_id[:108]
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                config["base_url"] + path, json=payload, headers=headers
            )
    except httpx.HTTPError as exc:
        raise PayPalError("paypal_unavailable") from exc
    if response.status_code < 200 or response.status_code >= 300:
        raise PayPalError("paypal_request_failed", 502)
    try:
        return response.json()
    except ValueError as exc:
        raise PayPalError("paypal_response_invalid", 502) from exc


async def create_order(config: dict, local_order_id: str) -> dict:
    return await _post(
        config,
        "/v2/checkout/orders",
        {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": local_order_id,
                    "custom_id": local_order_id,
                    "invoice_id": local_order_id,
                    "description": "WanderMind professional Bali route unlock",
                    "amount": {
                        "currency_code": config["currency"],
                        "value": config["amount_text"],
                    },
                }
            ],
            "application_context": {
                "shipping_preference": "NO_SHIPPING",
                "user_action": "PAY_NOW",
            },
        },
        request_id=local_order_id,
    )


async def capture_order(config: dict, provider_order_id: str, local_order_id: str) -> dict:
    return await _post(
        config,
        "/v2/checkout/orders/" + provider_order_id + "/capture",
        {},
        request_id=local_order_id + ":capture",
    )


async def verify_webhook(config: dict, headers: dict, event: dict) -> bool:
    webhook_id = config.get("webhook_id", "")
    if not webhook_id:
        raise PayPalError("paypal_webhook_not_configured", 503)
    required = {
        "auth_algo": headers.get("paypal-auth-algo", ""),
        "cert_url": headers.get("paypal-cert-url", ""),
        "transmission_id": headers.get("paypal-transmission-id", ""),
        "transmission_sig": headers.get("paypal-transmission-sig", ""),
        "transmission_time": headers.get("paypal-transmission-time", ""),
        "webhook_id": webhook_id,
        "webhook_event": event,
    }
    if not all(required[key] for key in required if key != "webhook_event"):
        return False
    result = await _post(
        config,
        "/v1/notifications/verify-webhook-signature",
        required,
    )
    return result.get("verification_status") == "SUCCESS"

# PayPal Sandbox abnormal-flow canary runbook — 2026-08-29

Purpose: close the external-evidence gap for buyer cancel, provider decline and genuine webhook redelivery without reusing the accepted Sandbox purchase, exposing secrets, changing Live credentials, refunding money or silently changing route entitlements.

This is a preparation and execution checklist. Creating a disposable production-side user/trip or sending a PayPal event is still an external write and requires the gates below.

## Current verified boundary

- Production publicly reports PayPal enabled in `sandbox` at `USD 1.49`; the client response exposes no Client Secret.
- The accepted owner Sandbox order must not be reused, cancelled, refunded or mutated.
- Local tests already prove:
  - buyer cancel records `cancelled / BUYER_CANCELLED` and a retry creates a fresh provider order;
  - a late completed capture after local cancellation becomes `refund_review` and does not unlock the trip;
  - declined/denied/voided webhook states fail a pending order;
  - duplicate event IDs return `duplicate: true`;
  - refund/reversal enters `refund_review` while entitlement remains unchanged pending a policy decision.
- These tests do not prove PayPal-to-Render delivery or production database writes.

## Official PayPal constraints used by this runbook

- Sandbox Orders v2 supports negative testing with the `PayPal-Mock-Response` request header, including `INSTRUMENT_DECLINED` and `TRANSACTION_REFUSED`: <https://developer.paypal.com/negative-testing/request-headers/>.
- The Webhooks Events dashboard can resend a genuine Sandbox app event: <https://developer.paypal.com/api/rest/webhooks/events-dashboard/>.
- Webhook Simulator events are mock, are not associated with an app or transaction, cannot be resent, and cannot be verified by PayPal's postback verification endpoint: <https://developer.paypal.com/api/rest/webhooks/simulator/>. Therefore a simulator-only event is **not** accepted as WanderMind order E2E evidence.

## Hard stop conditions

Stop immediately if any of the following is true:

- `/api/paypal/config` is not `environment=sandbox` and `amount=1.49`, `currency=USD`;
- the user, trip, local order, provider order or capture ID matches the previously accepted order;
- a step requires a Live credential, real payment method, refund, entitlement revocation, database deletion or secret display;
- the disposable account cannot be distinguished from a real user;
- a genuine event cannot be mapped to the disposable provider order;
- the before-state evidence is incomplete.

## Disposable data contract

Prepare one dedicated test identity and one separate trip per scenario. Do not put passwords, cookies, access tokens or PayPal credentials into Git or evidence files.

| Field | Required format | Example shape | Storage rule |
|---|---|---|---|
| Test owner label | `wm-sbx-YYYYMMDD-operator` | `wm-sbx-20260829-owner` | Evidence only; no credential. |
| WanderMind account | dedicated email alias controlled by owner | `...+wm-sbx-20260829@...` | Never reuse a real traveller account. |
| PayPal payer | disposable Sandbox Personal account | dashboard-created payer | Keep credentials only in PayPal's private account store. |
| Trip label | `wm-sbx-YYYYMMDD-<case>` | `wm-sbx-20260829-cancel` | One trip per case. |
| Case ID | `PP-SBX-YYYYMMDD-01..` | `PP-SBX-20260829-01` | Use in the evidence ledger. |
| IDs captured | local trip/order, provider order, event/capture | exact identifiers | Evidence may record IDs; never secret values. |

## Read-only preflight

Record each check with timestamp before any write:

1. `origin/main` SHA and deployed Render SHA/status.
2. `/healthz` HTTP status.
3. `/api/paypal/config`: enabled, environment, currency and amount only.
4. Existing allowance for the disposable trip: locked, adjustment count 0.
5. No pending/confirmed/refund-review order already exists for the disposable trip.
6. Admin order-list access works without logging credentials or response PII.
7. The accepted owner order's identifiers are copied into a private **do-not-touch** comparison list, not into Git.

## Scenario and rollback matrix

“Rollback” here means isolate and retire test data without deleting production records or rewriting audit history.

| Case | External action | Expected WanderMind state | Required evidence | Reversible retirement | Stop before |
|---|---|---|---|---|---|
| PP-SBX-01 Buyer cancel | Create a new order for the cancel trip, open PayPal, choose Cancel/return to merchant. | First local order `cancelled`, `provider_status=BUYER_CANCELLED`; trip remains locked; retry creates a different provider order. | UI cancel message, two provider order IDs, allowance before/after, admin order status. | Leave cancelled audit row; abandon the fresh retry if still pending; disable/label test account after all cases. | Capture, refund or manual admin confirmation. |
| PP-SBX-02 Provider decline | Use a **disposable** order and an officially supported Sandbox negative response. Current production code does not inject `PayPal-Mock-Response`, so first prepare a temporary, sandbox-only canary path with a hard production-mode denial and no public control. | Capture call shows a recoverable failure; no entitlement; order is failed only when a genuine mapped decline event arrives or reconciliation records the provider failure. | PayPal debug ID/error code with secrets removed, UI error, allowance, mapped event/order status. | Remove/disable the canary switch after evidence; retain failed order audit row; no entitlement change needed. | Any Live environment, generic user-controllable header, or false claim that a direct PayPal API call proved the WanderMind UI. |
| PP-SBX-03 Genuine webhook redelivery | Complete or fail a disposable Sandbox transaction, locate its genuine app event in PayPal Sandbox Webhooks Events, then click Resend once. | First delivery is processed; redelivery with the same event ID returns idempotently and creates no second entitlement/order effect. | Same event ID, first and second delivery status, one webhook-event row, unchanged allowance/order count. | Keep immutable event audit rows; retire disposable account/trip label. | Simulator event presented as genuine; modifying payload or signature. |
| PP-SBX-04 Late completion after cancel | Only if a genuine disposable Sandbox flow naturally produces this ordering. Do not force a capture of the accepted order. | Order becomes `refund_review`; trip remains locked. | event/order/capture IDs, before/after allowance, admin refund-review visibility. | Leave review row for manual resolution; no automatic revocation or refund. | Initiating any refund or granting access. |
| PP-SBX-05 Refund/reversal | **Not authorized in this canary.** Prepare only. | Existing policy keeps entitlement unchanged and marks `refund_review`. | Policy decision and a new explicit authorization are required. | N/A | Before any refund API/dashboard action. |
| PP-SBX-06 Points/admin-unlimited | Separate from PayPal cases. | Only dedicated test identities; exact point delta or admin bypass; no impact on real users. | Before/after account balances, allowance and audit row. | Use compensating test-only credit or disable test identity; never edit/delete history silently. | No dedicated identity or no approved compensation procedure. |

## Decline canary design constraints

The official negative-test header must never become a general production request parameter. If implemented for the external canary, all conditions below are mandatory:

1. `PAYPAL_ENVIRONMENT == sandbox` on the server.
2. A new temporary server-only flag defaults to off.
3. Only an authenticated admin/test identity can select an allowlisted code (`INSTRUMENT_DECLINED` or `TRANSACTION_REFUSED`).
4. The header is added by WanderMind's server when calling PayPal; it is never accepted verbatim from a public client.
5. The response and PayPal debug ID are sanitized; tokens and secrets are never logged.
6. The flag is turned off after the evidence run, and the normal success path is rechecked.
7. This canary needs its own reviewed code change and deployment evidence; it must not be slipped into a documentation-only release.

## Evidence checklist

For every executed case, record:

| Field | Value |
|---|---|
| Case ID | |
| Started / finished (UTC and +08:00) | |
| Git / deployed SHA | |
| Disposable account label | |
| Trip ID | |
| Local order ID | |
| Provider order ID | |
| Event / capture ID, if applicable | |
| Before allowance | |
| User-visible result | |
| Admin-visible order state | |
| After allowance | |
| Duplicate/order-count check | |
| Console/network errors, sanitized | |
| Retirement action | |
| Deviations / stop reason | |

## Authorization needed before execution

The owner must provide or authorize:

1. one dedicated WanderMind test-email alias and one disposable PayPal Sandbox Personal payer;
2. production writes for clearly labelled disposable accounts/trips/orders only;
3. if PP-SBX-02 is required, a separate reviewed sandbox-only decline-canary deployment;
4. no authorization in this runbook covers refunds, automatic entitlement revocation, Live credentials, real money or database deletion.

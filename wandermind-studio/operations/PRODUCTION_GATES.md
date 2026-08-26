# WanderMind production gates

This file separates implementation readiness from actions that can affect real users, money, messages or public channels.

| Gate | Current engineering state | Required before execution | Current decision |
|---|---|---|---|
| Paid unlock / points / admin unlimited E2E | Local and CI tests cover order creation, admin confirmation, points debit, concurrency and admin bypass. | Dedicated non-real account, reversible data plan, strong admin credential check, explicit approval for production writes, and an evidence checklist. | Do not run against production yet. |
| Real driver email | Routing and persistent rate limits exist; request retries now use a provider idempotency key. | One owner-approved real itinerary request or a dedicated test recipient; no repeated delivery tests. | Do not send another test email. |
| Route-level final quote | Reference estimator exists. Separate Dicky/Gede authorization forms are prepared. | Dated answers from each driver, rate version/effective date and explicit permission to publish as an estimate. | Do not claim a final price. |
| Automatic payment | Manual QR plus admin confirmation exists; no provider adapter or webhook exists. | Merchant entity, provider, supported currency, sandbox account, refund/failure policy, signed idempotent webhook design and reconciliation owner. | Independent production gate; no implementation pretending to be live. |
| First public social post | Copy, images, driver packs and UTM plan exist. | Owner explicitly authorizes a named account/post; capture public URL and 14-day log. | Prepare only; do not publish. |
| Google/Microsoft paid ads | Campaign structure and copy can be prepared. | Account, region/currency, daily and total budget, payment method and explicit spend approval. | No account creation or spend. |


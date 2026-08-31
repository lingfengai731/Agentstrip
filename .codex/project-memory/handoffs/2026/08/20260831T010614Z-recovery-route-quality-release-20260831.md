# Handoff: recovery, route quality and package geography release 2026-08-31

- Status: live and production-verified
- Owner: codex-sol
- Captured at: 2026-08-31T01:06:14Z
- Product commit and origin/main: `62069ee8f16da70e1a0214948db8a0da312d6b01`
- Branch: `codex/fullsite-design-audit-20260828`
- Render: `dep-daad46mq1p3s73963kvg`, live, finished `2026-08-31T01:01:35.182756Z`

## Verified result

The Bali product now addresses the real geographic problem with a concise five-language promise: attractions are dispersed, so the route should not double back. Eight editable packages expose their area in all five languages and are constrained by explicit region ids. The Penida package is correctly limited to G3 and no longer treats Tulamben in east Bali as a same-area extension.

Personalized route generation now rotates verified POIs when adjacent days revisit the same region, instead of repeating the same first three places. This does not change the product boundary: public R1-R6 routes remain fully free, while only a personalized professional route uses the approximately 70 percent preview and the existing entitlement.

AI failures now show an explicit localized retry. Retrying keeps one visible user message and sends the current prompt once per API request. Browser recovery evidence also confirms that a professional-route 503 preserves submitted choices, a driver-request 503 preserves fields and its idempotency id, and an expired AI session prompts for login once before resuming with the refreshed Bearer header.

Local acceptance passed 103 backend tests with 13 PostgreSQL-only skips, 62/62 POI media/package coverage, four AI responsive widths, five-language Bali browser checks, shared recovery checks, search, SEO and diff validation. Production serves the exact cache versions from `62069ee`, `/healthz` is healthy, and the public browser suites passed with every write request intercepted.

## PayPal answer and boundary

PayPal success checkout and paid-route restoration were already verified in previous production evidence. The abnormal-flow work is not fully closed: local code covers buyer cancel, declined/pending/refund-review states, duplicate webhooks and idempotency, but the real disposable buyer-cancel and genuine Sandbox webhook-redelivery evidence remain external. Do not reuse, cancel, capture or refund the accepted paid order.

## Driver fact boundary

Confirmed shared public facts remain: full day IDR 700k up to 10 hours, half day IDR 500k up to 6 hours, overtime IDR 70k/hour with the supplied rounding rule, and no per-guest surcharge. Public internet sources cannot establish Dicky/Gede-specific meals, delayed-flight waiting, baggage limits, quote validity, taxes or the exact Penida embarkation point. Keep these omitted or route-specific until each driver gives a dated direct reply.

Official general facts are independent traveller costs, not driver inclusions: Bali's official tourist levy FAQ states IDR 150,000 per international visitor per Bali trip; Ngurah Rai Immigration lists Visa on Arrival at IDR 500,000; Indonesia Travel lists Sanur, Kusamba and Padang Bai among Penida access options, so no single port should be promised for every trip.

## Portfolio correction

The old statement “Portfolio Content Manager is designed, not implemented” is stale. Current code contains `/admin/portfolio`, signed Cloudinary upload, PostgreSQL metadata, draft/publish/hide/archive, replace and reorder flows, plus multilingual publish gates. Correct state: implemented and tested in code, but authenticated production upload → publish → public Portfolio → hide/restore still needs one controlled disposable-image evidence chain.

## Unified next priority

| Priority | Item | State | Next acceptance |
|---|---|---|---|
| P0 | PayPal Sandbox abnormal external evidence | External gate | Dedicated non-admin disposable buyer cancel and genuine webhook redelivery; preserve screenshots/log ids, never touch the accepted order. |
| P0 | Production Portfolio admin E2E | External authenticated gate | One approved disposable image: signed upload, publish without deploy, public visibility, hide and restore; no Render filesystem. |
| P1 | First organic launch | Prepared, owner posting gate | Publish one named Xiaohongshu/Instagram/X post with UTM and record the public URL. |
| P1 | Fourteen-day funnel measurement | Waiting for launch | Record visits, route matches, professional unlock starts and valid driver enquiries. |
| P2 | Driver operational facts | Supplier gate | Obtain dated direct answers; do not infer meal, delay, baggage, tax or port terms from the internet. |
| P2 | Dynamic travel facts and route timing | Open after launch | Add dated opening-hours, drive-time, weather and operator checks without weakening verification labels. |
| P3 | More destinations, native app and broad admin roles | Deferred | Wait for Bali conversion evidence. |

## Worker status

Averroes (`01a05365-789c-7830-933b-f72d50138249`, formal `luna_worker`, `gpt-5.6-luna`, max) returned a usage-limit error before producing a final. It made no accepted changes or conclusions. Sol performed the implementation, diff review, local regression, deployment and production acceptance; do not report Luna as completed.

## Next exact action

Use the authenticated admin only for the controlled Portfolio Content Manager evidence chain if a disposable approved image is available. In parallel, prepare—but do not silently execute—the two remaining PayPal Sandbox external cases. After those gates, start the first owner-authorized social post and 14-day measurement loop.

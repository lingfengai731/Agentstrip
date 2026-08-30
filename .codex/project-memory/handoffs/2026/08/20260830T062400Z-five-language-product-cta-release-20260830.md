# Handoff: five-language product CTA release 2026-08-30

- Status: live and production-verified
- Owner: codex-sol
- Captured at: 2026-08-30T06:24:00Z
- Product commit: `5521daf1c35beb39044ded174ad25e1bb8196a7f`
- Branch and origin/main before this docs record: `5521daf1c35beb39044ded174ad25e1bb8196a7f`
- Render: `dep-da9snd67bikc73b7m4v0`, live, finished `2026-08-30T06:21:53.605398Z`

## Verified result

The only demonstrated product-name drift was Korean: the homepage and professional-route component used `전문 루트`, while Services and the rest of the product used `전문 경로`. The old term is now absent from the frontend source and production asset. The canonical product paths remain:

1. Professional route: `bali.html#professional-planner`
2. AI self-planning: `ai-tool.html?mode=diy`
3. Local driver request: `find-driver.html`

Local acceptance passed 89 tests and the full browser suite. Production acceptance covered 20 mobile page-language combinations across index, about, contact and services, with zero horizontal overflow, no legacy rough-route copy and exact CTA destinations.

## Current unified priority order

| Priority | Item | State | Next action |
|---|---|---|---|
| P0 | PayPal Sandbox abnormal flows | Externally gated | Dedicated non-admin test identity, pre-state and owner-interactive Sandbox login are required. |
| P0 | Driver/supplier facts and unstable pricing | Externally gated | Obtain dated replies before verified publication. |
| P0 | First organic launch | Prepared, authorization gated | Owner chooses and authorizes the actual social accounts/posts. |
| P1 | Professional form, mobile AI/driver, Services, Portfolio filter, CTA naming | Complete and live | Owner visual callback and production monitoring only. |
| P2 | Shared retry, empty and recovery states | Next autonomous | Audit preserved-input, retry and authentication recovery patterns; fix only reproducible inconsistency. |
| P2 | Route quality and public-route comparison | Open | Reduce repeated adjacent-day places and improve comparison without changing free R1-R6 access. |
| P2 | Launch measurement | Prepared | Activate analysis after the first authorized posts. |
| P3 | More destinations, native app and broad admin roles | Deferred | Wait for Bali conversion evidence. |

## Worker status

The formal Luna reviewer remains `errored` from an explicit usage-limit response and returned no final. Sol completed and verified this bounded naming release; no Luna completion is claimed.

## Next exact action

Run a bounded read-only audit of shared retry, empty and recovery states across the professional-route form, AI self-planning, driver request and account/auth flows. Implement only a reproducible inconsistency and preserve entered data on recoverable failures.

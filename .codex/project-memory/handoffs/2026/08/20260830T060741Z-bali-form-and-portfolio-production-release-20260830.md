# Handoff: Bali form and Portfolio production release 2026-08-30

- Status: product changes live; external canaries and launch authorization remain gated
- Owner: codex-sol
- Captured at: 2026-08-30T06:07:41Z
- Branch: codex/fullsite-design-audit-20260828
- Product HEAD and origin/main: `474a90972a71efde7c201909ba96accd837f151e`
- Worktree: `E:\Agentstrip-wt-fullsite-design-20260828`
- Tracked product tree: clean before this memory record
- Local-only untracked path: `.codex/run-state/`

## Current verified state

The professional-route form release at `9371733` and the Portfolio mobile-filter release at `474a909` are both included in `origin/main`. Render deploy `dep-da9sese7bikc73b7gdeg` is live for `474a909`. Production HTTP and the production-domain Playwright suite passed. No real payment, refund, accepted-order reuse or entitlement mutation occurred.

The professional form now uses semantic controls grouped into trip basics, travel approach and priorities. An unpaid traveller can edit and rematch without spending one of the three paid adjustments. The seven-day preview remains five open days and two locked days. Paid-route adjustment behavior remains separate.

On mobile, Portfolio keeps the primary Landscapes, Culture and Experiences themes visible. Secondary tags now open in one bottom sheet with an active count, reset, close, Escape handling and focus return. Desktop keeps both filter rows inline.

## Verification evidence

- Evidence: `ev-20260830T060741Z-bali-form-and-portfolio-production-release-20260830`
- Product tests: 89 passed
- Local browser: 320, 390, 768 and 1440; five languages; no horizontal overflow; Portfolio sheet and route/payment callback checks passed
- Visual artifacts:
  - `output/playwright/2026-08-30-professional-form-ux/professional-form-390-en.png`
  - `output/playwright/2026-08-30-professional-form-ux/professional-form-1440-zh.png`
  - `output/playwright/2026-08-30-portfolio-filter/portfolio-filter-390-open.png`
  - `output/playwright/2026-08-30-portfolio-filter/portfolio-filter-1440.png`
- Git: feature branch and `origin/main` are both `474a909` before this docs-only handoff commit
- Render: `dep-da9sese7bikc73b7gdeg`, live, finished `2026-08-30T06:03:43.336542Z`
- Production: full browser suite passed against `https://wandermind.cc`

## Unified priority order

| Priority | Item | State | Exact next gate or action |
|---|---|---|---|
| P0 | PayPal Sandbox abnormal flows | Externally gated | Use a dedicated non-admin WanderMind identity, capture admin pre-state, then perform owner-interactive Sandbox decline/cancel/duplicate tests without touching the accepted order. |
| P0 | Bali route, driver and supplier facts | Externally gated | Obtain dated replies and approval before presenting unstable prices, schedules or supplier claims as verified. |
| P0 | First organic launch | Prepared, authorization gated | Select the actual Xiaohongshu, Instagram and Douyin accounts and explicitly authorize posting; copy and media packs already exist. |
| P1 | Professional-route form semantics and edit path | Complete and live | Owner visual callback only. |
| P1 | AI mobile hierarchy, Find Driver mobile flow and Services positioning | Complete and live | Monitor production feedback; do not redesign again without evidence. |
| P1 | Portfolio mobile filter density | Complete and live | Owner visual callback only. |
| P1 | CTA and product-name consistency | Next autonomous item | Audit the global labels for professional route, AI DIY and driver handoff, then make the smallest five-language corrections. |
| P2 | Shared recovery and empty/error states | Open | Unify retry and preserved-input behavior where evidence shows inconsistent states. |
| P2 | Route quality and comparison | Open | Reduce adjacent-day place repetition and add useful public-route comparison without hiding free R1-R6 content. |
| P2 | Launch measurement | Prepared | Start monitoring only after the first authorized public posts. |
| P3 | More destinations, native app and broader admin roles | Deferred | Do not start before Bali conversion and launch evidence exist. |

## Worker record

Formal `luna_worker` review `01a0506a-b20a-7051-8096-1ea72846c263` used `gpt-5.6-luna` with `max` and returned an explicit usage-limit error. It produced no final, so no Luna completion or acceptance is claimed. Sol independently inspected the diff, reran tests, reviewed screenshots and performed the release.

## Do not repeat

- Do not rerun or alter the owner's already accepted PayPal Sandbox order.
- Do not call `.codex/run-state/` synchronized; it remains local-only.
- Do not develop in or clean the original dirty `E:\Agentstrip` checkout.
- Do not relaunch the same Luna review within the exhausted quota window.

## Next exact action

Start a bounded five-language CTA and product-name consistency audit from this clean product baseline. Keep professional route, AI DIY and driver handoff as separate products. Only change labels that are demonstrably inconsistent; then repeat local browser verification before another release.

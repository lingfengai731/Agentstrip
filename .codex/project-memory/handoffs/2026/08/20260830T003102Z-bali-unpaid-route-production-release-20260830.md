# Handoff: bali-unpaid-route-production-release-20260830

- Status: production live; owner account callback pending
- Owner: codex-sol
- Captured at: 2026-08-30T00:31:02Z
- Branch: codex/fullsite-design-audit-20260828
- Product commit: 8a8dccf25afec71505b735f5abcdc38f42047bcd
- Production main: 8a8dccf25afec71505b735f5abcdc38f42047bcd
- Worktree: E:\Agentstrip-wt-fullsite-design-20260828
- Product working tree before this memory-only record: clean

## Current state

The first-time unpaid Bali professional-route failure is fixed and deployed. Render deploy `dep-da9ncmc9v7es73dppgs0` is live at product commit `8a8dccf`. A fresh production browser generated a 7-day personalized route with 5 open and 2 locked days, displayed both CNY 9.9 and 30-point unlock choices, and produced no console errors. The accepted Services redesign is also live with all three product paths, five-language switching and responsive production checks.

Public R1-R6 routes remain intentionally complete and free. The approximately 70 percent preview applies only to the personalized professional route. An existing paid 7-day route is a saved personalized order and is not expected to match the public R1 recommended 8-day template exactly.

## Verified evidence

- Evidence: `ev-20260830T003100Z-bali-unpaid-route-production-release-20260830`
- Local browser suite: passed, including fresh unpaid matching, 5/2 preview, unlock entry, stale previous-account trip recovery and paid-route recovery
- Tests: 97 passed; 8 PostgreSQL-only tests skipped locally
- Git: product commit `8a8dccf` is on both the feature branch and `origin/main`
- Render: `dep-da9ncmc9v7es73dppgs0`, status `live`, finished `2026-08-30T00:17:44.733409Z`
- Production Bali artifact: `output/playwright/prod-bali-unpaid-preview-390-8a8dccf.png`
- Production Services artifacts: `output/playwright/prod-services-390-8a8dccf.png`, `output/playwright/prod-services-1440-8a8dccf.png`

## Files changed in the product release

- `wandermind-studio/frontend/assets/js/bali-professional.js`
- `wandermind-studio/frontend/bali.html`
- `tools/test_bali_browser.cjs`
- `wandermind/backend/tests/test_product_access.py`
- `wandermind-studio/frontend/services.html`
- `wandermind-studio/frontend/assets/js/i18n.js`

The first four files close the unpaid-route defect. The last two are the owner-accepted Services product-path redesign that was already on the release branch. `.codex/run-state/` remains local-only and must not be described as cross-account synchronized.

## Risks and unknowns

- The owner's actual signed-in unpaid account has not been independently callback-tested after this deployment because credentials and browser session data were not requested or inspected.
- The owner's existing paid account has not been independently re-entry-tested after this specific deployment; local deterministic paid-route recovery passed.
- No new PayPal Sandbox payment, refund, entitlement mutation or Live-money action was performed.
- Personalized R1 still repeats some places across adjacent days; this is a route-quality P1, not the now-closed P0 interaction failure.
- Luna history audit stopped on its concurrent-edit STOP condition, and the final Luna review did not start because of usage limits. Sol performed the implementation, regression, release and production acceptance checks.

## Next exact action

Using the normal unpaid WanderMind test account in the owner's own browser, hard-refresh `https://wandermind.cc/bali.html`, enter a 7-day profile and click the match button. Verify that 5 days are open, 2 days are locked, both unlock choices are visible, then open the PayPal option and confirm it shows Sandbox USD 1.49. Do not complete another payment unless separately intended.

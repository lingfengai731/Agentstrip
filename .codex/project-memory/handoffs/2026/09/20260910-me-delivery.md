# Customer account-page fixes

Baseline 3b2b3a9, branch codex/miniprogram-ui-languages-20260909.

Actual defects addressed: guest cannot reach language selector; website button promises opening a browser but only copies a link; copy failure has no feedback; account page copy is Chinese-only. Language now available before sign-in, labels/modal/feedback cover five locales, clipboard button is honest, long account text wraps.

Evidence: test_miniprogram_me.cjs covers five locales, guest access, logout cancel/confirm and clipboard success/failure. Auto-language and recovery tests pass. Contracts 307 pass. Official Preview succeeded at 1591230 bytes: E:/Agentstrip-artifacts/2026-09-09/mini-ui-tools/preview-me.jpg.

Steve Jobs perspective used as an explicitly simulated product-review framework: remove unnecessary login hurdle; button promise must match behavior; retain current style rather than add features. Based on actual source and user feedback, not a claim to be Jobs.

Luna not dispatched: prepare_role_window preflight failed because registry/plugin-packages.json is missing. Do not mark a worker as running or complete.

NOT globally deliverable yet: remaining local Chinese copy on index, driver, itinerary, preferences/history/chat/compare/gallery/place; comprehensive native device and full-site interaction checks not finished. No Upload/review/public release. Existing website browser matrix passed previously; do not repeat real payment orders.

Exact next action: localize index first (new user sees it before the localized planner), including errors and one-click WeChat login feedback; preserve auth/linking API contracts. Then driver and itinerary. Finish branch integration after checks. Original E:/Agentstrip protected.

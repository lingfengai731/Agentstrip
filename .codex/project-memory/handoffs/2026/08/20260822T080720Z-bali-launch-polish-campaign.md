# Handoff: Bali launch polish, limiter gate and first campaign kit

- Status: verified branch; production deployment pending
- Owner: codex-sol
- Captured at: 2026-08-22T08:07:20Z
- Branch: codex/account2-integration-20260816
- Code commit: a24cd32ee9b1db0b4d9567e1533284f800ba156b
- Worktree: E:\Agentstrip2-worktree
- Pull request: https://github.com/lingfengai731/Agentstrip/pull/3

## Current state

The safe integration branch is pushed and CI-green. Bali public-route detail uses a warm paper atlas instead of an uninterrupted green slab, keeps every day free and reachable, expands only the active day editor, and previews 12 Portfolio moments before a five-language reveal-all control. R1–R6 selection still drives the detail map and matched professional-route link. Driver copy is shorter and the public CTA remains a controlled WanderMind request rather than a private contact route.

The first launch campaign handbook contains a complete Xiaohongshu carousel, driver Instagram carousel, TikTok/Douyin script, eight independently reviewed approved images, privacy rules, UTM links, a 14-day release cadence and a simple funnel diagnostic table.

## Verified evidence

| Gate | Actual result |
|---|---|
| Local product tests | 61/61 passed |
| Local full discovery | 73 discovered; 61 passed; 12 isolated-PostgreSQL tests skipped by design |
| GitHub SQLite | 61/61 passed in run 32561281247 |
| GitHub PostgreSQL 16 | 12/12 passed in run 32561281247; log confirms `DB backend: postgres` |
| Project memory CI | run 32561281258 passed |
| Browser widths | 320, 390, 768 and 1440 passed with no document-level horizontal overflow |
| Browser languages | zh, en, ja, ko and id each produced distinct route and gallery-reveal labels |
| Browser flow | R3 selection, route-specific professional link, map markers, day selection, same-region add callback and gallery reveal passed |
| Browser console/motion | zero console errors; reduced-motion returned zero route-detail animations |
| Image intake | 108 rows parse without extra columns; every approved row has an existing Web image |
| Production | fresh public HTTP is still p54, schema 1.2.0, 6 routes / 50 POIs; this branch is not deployed |

## Files changed in the code commit

- Bali page and five-language copy: `wandermind-studio/frontend/bali.html`, `wandermind-studio/frontend/assets/js/i18n.js`
- Render proxy limiter and tests: `wandermind/backend/main.py`, `wandermind/backend/tests/test_product_access.py`
- Image intake repair: `wandermind-studio/frontend/assets/data/image-intake-review.csv`
- Launch handbook: `wandermind-studio/MARKETING_LAUNCH_PLAYBOOK.md`
- Design plan, feedback and documentation: `.codex/plans/bali-launch-visual-motion-2026-08-22.md`, `.codex/ui-visual-review-signals.md`, `README.md`, `wandermind-studio/README.md`

## Risks and boundaries

- PR #3 remains draft because authenticated Render presence checks and a post-deploy proxy smoke are not available through this task's callable tools.
- Production database contents and historical paid users were not read or changed. Existing legacy 10-adjustment compatibility remains intact in code and CI.
- No Render environment variable was read, overwritten or added. No merge or deployment occurred.
- The campaign entitlement wording must not be published until production displays the same 3-adjustment and 70% preview behavior.
- The remaining 25 D8 candidates are not silently promoted; `bali-4.jpg` remains the next image unit after launch.

## Next exact action

Using an authenticated Render control surface or purpose-built connector, confirm by presence only that production has PostgreSQL and a strong stable `SECRET_KEY` without displaying either value. Deploy `a24cd32` to a safe canary/preview when available, verify two external clients receive independent driver-request counters, then run the full production browser matrix. If all gates are green, mark PR #3 ready, merge to main, wait for production p55, rerun the same matrix, and only then begin day 1 of `MARKETING_LAUNCH_PLAYBOOK.md`.

# Mini Program localization, session privacy and native UI evidence

Captured: 2026-09-11T06:26:54.597Z. Owner: current main task.
Worktree: E:/Agentstrip-worktrees/active/account1/miniprogram-ui-languages-20260909
Branch: codex/miniprogram-ui-languages-20260909. Implementation baseline: 7e663fcbec289a3c731f5dac59cdb9b819042fed; fresh GitHub main before integration: 0cc8582a146f137597d9f0b1adf02dbbdfb02860.

## Verified implementation and commands

- Nine tools/test_miniprogram_*.cjs suites pass; test_miniprogram_contract.cjs reports 315 checks. Final local command enumerated the nine scripts with immediate nonzero-exit failure, followed by git diff --check.
- Verified: manual language precedence, automatic WeChat locale normalization, five-language page dictionaries/bindings, navigation callbacks, duplicate-auth guard, Bearer headers, single expiry redirect, stale-account-response rejection.
- Chat/driver drafts and preferences now use account-scoped keys. Legacy unowned device caches are retained but not silently assigned. VM tests cover switching account, restoring the original owner, failed saves and late responses.
- Driver full-day/half-day/overtime rates remain IDR 700000/500000/70000. No per-person surcharge. Tests preserve the 1900000 estimate for two full days plus one half day.
- New CI workflow runs all nine Mini Program scripts on Node 22 without production credentials.

## Native evidence and corrections

Official miniprogram-automator against DevTools, 390 x 671 CSS-pixel viewport, guest-only. No payments, driver submissions or authenticated server mutations. Transient global state restored after each run.

| Verification | Concrete result |
|---|---|
| Frozen matrix: zh/en/ja/ko/id x index/chat/compare/driver/prefs/gallery/history/itinerary/planner/place | 50 rows, 180 visible button measurements, 0 runtime exceptions, 0 measured button overflow |
| Defect from that matrix | Place error-state retry was 41px in all five locales; not reported as a pass |
| Targeted repair | Place retry/link/action controls explicitly use min-height 44px and scoped widths |
| Five-language place content + missing-place/retry | 10 cases passed after repair, all visible buttons >=44px and inside viewport |
| Five-language gallery filter and planner selections | 10 cases passed; correct filter value, returning visitor, active pace, fourth interest refused, choices/chips/fields >=44px |
| Screenshots | 11 English captures covering nine pages plus driver/planner bottom; one Indonesian planner capture |
| Preview | Official CLI preview succeeded, total 1662338 bytes |

Native screenshots were inspected for hierarchy, text wrapping, visible selected states and reachable bottom controls. Driver privacy consent and planner interest chips remain above the sticky action at the bottom. Gallery horizontal filter scrolling is intentional, not page overflow.

The first pre-freeze matrix mixed old/new bundles during hot reload and is invalid acceptance evidence. An initial optimized selector returned no buttons; it was rejected, replaced with SDK page element queries, and guarded against empty-element false passes. Initial reconnect/screenshot timeouts were not application test successes. Separate project open, then auto after startup, restored the channel. Preview can disturb the automation session; restarting auto restored screenshot capture.

## Artifact locations

All under E:/Agentstrip-artifacts/2026-09-09/mini-ui-tools/:
- final-test-log.txt
- native-frozen.cjs and native-frozen.json (50 rows, including the five repaired failures)
- native-final-targets.cjs and native-final-targets.json (20 passing checks)
- native-screens.cjs and native-screens.json
- native-en-{index,chat,compare,driver,prefs,gallery,itinerary,place,planner}.png
- native-en-driver-bottom.png, native-en-planner-bottom.png, native-final-id-planner.png
- preview-delivery.jpg and preview-delivery-info.json

These absolute artifact paths are host-local; the verification summary is Git-tracked. Preview is not Upload, review submission, public release or physical-device acceptance.

## Skill and worker callback

quota-safe-project-continuation preserved the exact freeze/reconnect pointer; cross-account-project-memory kept E:/Agentstrip untouched and separated local, pushed and release states. ui-implementation-workflow preserved cream/teal/gold operational UI, repaired measured controls, and required rendered inspection. No new component library, animation or visual redesign.

Luna worker 01a08a20-2133-7bd0-9d4d-5dedbd0f1d78 errored at quota and left partial driver files in its isolated worktree. The parent reviewed, repaired, integrated and tested them. There is no independent Luna final approval.

## Boundaries and remaining gaps

Final asynchronous review reproduced old preference/driver callbacks clearing a new account's busy state. Token guards now cover finally blocks and preference error modals; three additional callback scenarios in test_miniprogram_support_languages.cjs fail before the fix and pass after it. All nine suites were rerun successfully. The final Preview was rebuilt at 1662338 bytes after this non-layout correction; native screenshots and geometry above remain applicable to unchanged templates/styles.

- Native matrix covers guest/public states, not a new real sign-in, driver email or payment transaction. Those code paths have behavioral tests; earlier accepted external orders are not repeated.
- Fresh native viewport is 390px; no new tablet/desktop Mini Program or physical iOS/Android acceptance claim.
- Interface dictionaries are localized; third-party place names, customer text and some source-data factual notes may remain in their source language. Budget is explicitly CNY, not an invented currency conversion.
- The website/backend were not modified in this batch. A Mini Program Preview does not deploy website UI.
- PR/CI/merge references belong in the subsequent integration callback; this pre-commit evidence does not claim remote synchronization.

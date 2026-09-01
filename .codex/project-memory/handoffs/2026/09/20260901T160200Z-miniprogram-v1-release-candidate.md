# Handoff: miniprogram-v1-release-candidate

- Status: verified release candidate
- Owner: sol-main
- Captured at: 2026-09-01T16:02:00Z
- Branch: codex/premini-final-20260901
- Product commit: b5f7fa3c61f46c6b157564d0f4fa23e89b7f860b
- Worktree: E:\Agentstrip-wt-premini-final-20260901
- Remote branch: pushed
- Main / Render / WeChat release: not yet

## Current state

The mini-program v1 foundation now uses the existing WanderMind account, route, entitlement, AI and driver APIs. It contains registration with email verification, public and professional Bali routes, 70% preview and unlocked-route display, chat persistence and recovery, conversation history, language selection and email-only Dicky/Gede driver requests. The final Sol review corrected driver handoff profile extraction and the planner's budget intent value.

## Verified evidence

- Product commit `b5f7fa3` is pushed to `origin/codex/premini-final-20260901`.
- `node tools/test_miniprogram_contract.cjs`: 212 checks passed.
- `git diff --check`: passed; only Windows line-ending warnings remain.
- WeChat DevTools recompiled the current worktree and returned to the login page; Problems panel remained at zero.
- English and Chinese language callbacks previously verified synchronized TabBar labels.
- The only remaining DevTools diagnostics are grey-library/framework messages with no project source frame.

## Luna lifecycle

Darwin (`01a05da1-9060-7fd0-8c42-dc3bedc00dec`, formal `luna_worker`, `gpt-5.6-luna` / `max`) started a frozen read-only release audit. It ran beyond the 10-minute baseline and one 2-minute convergence window without a final. It was closed while still running and finished as `shutdown`. No Luna finding was accepted; Sol independently reviewed the code and tests.

## Do not repeat

- Do not repeat the owner-accepted Portfolio production E2E or PayPal Sandbox webhook redelivery.
- Do not add `.codex/run-state/`, `output/` or the DevTools-only newline changes in `project.config.json` / `project.private.config.json` to Git.
- Do not call the mini-program uploaded, submitted or released.
- Do not use Preview, Upload or submission controls without a fresh go/no-go.

## Next exact action

Open the task branch pull request to `main`, wait for fixed-head checks, and merge only after review. Then verify the exact merged website commit on Render. Separately confirm the WeChat request-domain/privacy configuration and obtain a fresh go/no-go before physical-phone preview, upload or submission.

# Handoff: miniprogram-wechat-auth-20260902

- Status: ready_for_integration
- Owner: Codex Luna
- Captured at: 2026-09-02T11:47:49Z
- Branch: codex/miniprogram-wechat-auth-20260902
- Commit: 946dfb7772c250a1666398816ff078a94c9bf633
- Worktree: E:\Agentstrip-worktrees\active\account1\wechat-auth-20260902
- Working tree: clean before this evidence/handoff record

## Current state

The bounded implementation adds a generic `auth_identities` table keyed by `(provider, provider_subject)`, makes legacy `users.email` nullable through an idempotent migration, and adds WeChat login plus explicit authenticated-account linking. Existing email and Google responses retain their behavior and expose only a safe `wechat_linked` flag. The Mini Program keeps its existing email flow and receives a touch-sized WeChat one-click login button and an explicit binding control without requesting a phone number.

## Verified evidence

- `python -m unittest wandermind.backend.tests.test_product_access`: 106 tests passed.
- `node tools/test_miniprogram_contract.cjs`: 234 checks passed.
- `git diff --check`: passed.
- `python -m py_compile wandermind/backend/db.py wandermind/backend/main.py wandermind/backend/tests/test_product_access.py`: passed.
- Evidence record: `.codex/project-memory/evidence/2026/09/20260902T114749Z-miniprogram-wechat-auth-20260902.json`.

## Files changed

- `wandermind/backend/db.py` — identity table, nullable-email bootstrap/migration, safe Google identity backfill.
- `wandermind/backend/main.py` — WeChat code exchange, login, explicit link, safe responses and linked-state reporting.
- `wandermind/backend/tests/test_product_access.py` — new-account, existing-account, link, conflict, remote-error and missing-config coverage.
- `miniprogram/utils/api.js` — login and link API wrappers.
- `miniprogram/pages/index/index.js` — WeChat login/link handlers and auth-state handling.
- `miniprogram/pages/index/index.wxml` — one-click login and explicit binding UI.
- `miniprogram/pages/index/index.wxss` — existing teal/cream/gold-compatible touch controls.
- `tools/test_miniprogram_contract.cjs` — API/UI contract assertions.

## Risks and unknowns

- Production still needs valid `WECHAT_MINIPROGRAM_APP_ID` and `WECHAT_MINIPROGRAM_APP_SECRET`; their values were not read or recorded.
- Real `wx.login`/`jscode2session` behavior, WeChat DevTools compilation, Preview, and production deployment were not performed in this bounded worker task.
- The change is committed locally but not pushed, opened as a PR, merged, or deployed. Do not describe it as synchronized or live until the parent agent independently integrates and verifies it.
- Driver email relay, phone authorization, payment, Upload, review submission and release remain separate tasks.

## Next exact action

The parent agent should independently inspect this commit and cherry-pick or merge it into an isolated integration branch, rerun the listed validation, then perform owner-authorized WeChat Preview and production gates. Stop integration if the target tree has drifted or the WeChat production configuration is missing.

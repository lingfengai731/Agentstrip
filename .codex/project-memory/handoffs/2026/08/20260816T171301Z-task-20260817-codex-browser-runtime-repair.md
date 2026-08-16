# Handoff: task-20260817-codex-browser-runtime-repair

- Status: verified
- Owner: codex-sol
- Captured at: 2026-08-16T17:13:01Z
- Branch: codex/account2-integration-20260816
- Commit: 7e781ef6b715914b15ba21cf6125e3d4a8f43712
- Worktree: E:\Agentstrip2-worktree
- Working tree: dirty

## Current state

The device matches openai/codex issue 25220: EFS-protected MSIX resources caused repeated bundled marketplace and executable relocation failures. A complete official resource mirror and reversible user-scope overrides are staged and hash-verified.

## Verified evidence

- Verification command: Desktop log signature audit; full SHA-256 source/destination comparison; required path checks; project-memory validate
- Verification result: File integrity passed; no production or repository product mutation; current process cannot receive newly restored Browser tooling.

## Files changed

-  M .codex/project-memory/current-state.json
-  M .codex/role-windows.md
- ?? .codex/project-memory/evidence/2026/08/20260816T171301Z-task-20260817-codex-browser-runtime-repair.json

## Risks and unknowns

Do not reuse the two retired Render tasks. Do not call Browser restored merely from plugin list or file presence. The first fresh task must prove callable Browser or node_repl tooling and Computer Use native-pipe readiness. If it fails, inspect only the new post-restart Desktop log before considering AppX-volume reinstall.

## Next exact action

Fully exit Codex Desktop, relaunch it, create one fresh local Agentstrip task, and run a Browser capability probe before registering the task or accessing Render.

# Agentstrip shared project context

This file is the account-independent entry point for work on Agentstrip and WanderMind.
It stores verifiable project facts, not hidden chain-of-thought or complete chat transcripts.

## Authority order

When sources disagree, use this order:

1. A fresh production or external-system check with timestamped evidence.
2. The current Git commit, pull request, CI result, and code.
3. Accepted decision records and immutable evidence in `.codex/project-memory/`.
4. Handoffs and task descriptions.
5. Old conversations and recollections.

Never claim that deployment, configuration, tests, or external data are current without a
verification timestamp and evidence reference.

## Start protocol

Every account or agent starts a task by running:

```powershell
.\tools\project-memory.ps1 brief
.\tools\project-memory.ps1 validate
```

Then it must:

1. Confirm the repository path, worktree, branch, HEAD, and dirty state.
2. Fetch remote references without automatically pulling into a dirty worktree.
3. Read the relevant decision records and the newest handoff for the task.
4. Claim a GitHub Issue and record the account, branch, worktree, scope, and stop condition.
5. Re-verify drift-prone facts before relying on them.

## Checkpoint protocol

Create immutable evidence at meaningful milestones:

```powershell
.\tools\project-memory.ps1 checkpoint `
  -Task "ISSUE-123" `
  -Owner "account-name" `
  -Summary "What was verified" `
  -VerificationCommand "command that was run" `
  -VerificationResult "pass"
```

Create a handoff before changing accounts or ending incomplete work:

```powershell
.\tools\project-memory.ps1 handoff `
  -Task "ISSUE-123" `
  -Owner "account-name" `
  -Summary "Current state" `
  -NextAction "One exact next action"
```

## End protocol

1. Run relevant tests and `git diff --check`.
2. Add evidence and, when needed, an ADR or handoff.
3. Link the task, commit, pull request, CI run, deployment, and production evidence.
4. Push the task branch and update the GitHub Issue.
5. Do not store passwords, tokens, cookies, private keys, personal data, or hidden reasoning.

## Conflict rules

- One account uses one worktree and one task branch.
- Never let two accounts edit the same dirty worktree.
- Evidence and handoffs use unique timestamped files; do not append to one shared JSONL file.
- `current-state.json` is a snapshot, not the sole source of truth.
- Merge through a reviewed pull request. Resolve semantic conflicts explicitly.

## Current integration boundary

PR #28 merged at main commit `aa670459629b4c628867a63df18d21df84ade299`; GitHub project-memory
workflow run 83 passed. Render production served the stronger 12-second teal/gold ambient layer,
AI workspace product context and utility-page index controls on 2026-08-27. Fresh production
Playwright passed the homepage/Bali ambient suite at 320/390/768/1440 plus reduced motion and the
AI workspace suite at 320/390/768/1440; `/healthz`, `/`, `/bali`, `/ai-tool`, `/search`, `/shared`,
`/reset-password`, `/robots.txt` and `/sitemap.xml` returned HTTP 200. Search, shared-trip and
password-reset pages returned their intended noindex signals.

The project owner reports that the PayPal China merchant account is approved for cross-border
receipts and a mainland China bank card is bound. Local code now implements PayPal Orders v2,
server-side amount verification, signed/idempotent webhooks, refund review and responsive checkout
at a USD 1.49 Sandbox price while retaining CNY 9.90 manual QR fallback. Eighty-two product-access
tests pass, but no Render PayPal credential, real Sandbox buyer payment, webhook delivery, refund,
settlement or production entitlement mutation has been verified. The feature stays disabled when
credentials are absent. The owner separately confirmed that `/ai-tool` is indexed; Search Console
still reported `sitemap.xml` as unreadable with zero discovered URLs on 2026-08-27 even though the
public endpoint returned HTTP 200, `application/xml` and eight URLs. Re-submit and await a fresh
Google fetch before closing that external-state gate. Pak Nanok and SUNSRI remain unpublished
candidates pending legal-entity, insurance, safety, capacity, cancellation and final-price confirmation.

The existing root `AGENTS.md` is intentionally unchanged. Therefore Codex cannot be guaranteed
to auto-load this file solely because it exists. Until the project owner permits a small entry-rule
addition to `AGENTS.md`, each account must open this file or run `project-memory.ps1 brief` at the
start of a task.

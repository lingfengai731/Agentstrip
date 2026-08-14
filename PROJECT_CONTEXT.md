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

The existing root `AGENTS.md` is intentionally unchanged. Therefore Codex cannot be guaranteed
to auto-load this file solely because it exists. Until the project owner permits a small entry-rule
addition to `AGENTS.md`, each account must open this file or run `project-memory.ps1 brief` at the
start of a task.

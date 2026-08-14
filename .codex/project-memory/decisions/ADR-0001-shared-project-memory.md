# ADR-0001: Use Git-auditable shared project memory

- Status: accepted
- Date: 2026-08-14
- Owner: project owner
- Task: project-memory-bootstrap

## Context

Two Codex accounts work on the same repository. Sidebar tasks and account memory are isolated, and
two accounts were mapped to the same local working directory. Chat history alone cannot provide an
auditable or current project state.

## Decision

Use four separate layers:

1. Git worktrees and task branches for code isolation.
2. GitHub Issues/Projects for task claims, ownership, dependencies, and human visibility.
3. Repository records in `.codex/project-memory/` for decisions, evidence, and handoffs.
4. Optional semantic-memory tools only as read/search indexes over the authoritative records.

Records must exclude secrets and hidden chain-of-thought. Drift-prone facts require timestamps and
evidence. Evidence and handoffs use unique files to reduce branch conflicts.

## Alternatives considered

- Synchronize complete chats: rejected because it is account-dependent, noisy, and not a reliable
  representation of current code or production state.
- Use one shared Markdown or JSONL ledger: rejected because concurrent branches would repeatedly
  modify the same file.
- Use a memory database as the authority: rejected because retrieval systems can contain stale or
  derived facts and do not replace Git, CI, or production verification.
- Adopt Beads, Mem0, Graphiti, or Letta immediately: deferred until task scale or retrieval volume
  justifies the additional operational burden.

## Consequences

- Another account can recover project state from Git without receiving a copied conversation.
- Agents still need an entry rule that makes them read the context at task start.
- External state is never assumed current merely because an older memory says so.
- Git merge and reviewed PRs remain the final integration mechanism.

## Evidence

- Bootstrap evidence: `ev-20260814-project-memory-bootstrap`
- Git worktree documentation: https://git-scm.com/docs/git-worktree.html
- GitHub Issues documentation: https://docs.github.com/en/issues/tracking-your-work-with-issues

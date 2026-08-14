# Project memory protocol

This directory is a Git-auditable exchange layer for multiple accounts and coding agents.

## What belongs here

- Decisions: accepted choices, alternatives, consequences, and supporting evidence.
- Evidence: timestamped claims tied to a commit, command, CI run, deployment, or URL.
- Handoffs: current task state, remaining risks, and one exact next action.
- Snapshot: a concise index of the last deliberately captured project state.

## What does not belong here

- Hidden chain-of-thought or complete chat transcripts.
- Secrets, credentials, cookies, private keys, access links, or personal data.
- Generated logs, screenshots, binaries, caches, or copied source files.
- Unverified claims presented as current facts.

## Status vocabulary

- `verified`: checked against the stated evidence at `captured_at`.
- `claimed`: reported but not independently verified.
- `stale`: once valid, but the source may have changed.
- `unknown`: no sufficient evidence is available.

## Record layout

```text
.codex/project-memory/
├── current-state.json
├── decisions/
├── evidence/YYYY/MM/
├── handoffs/YYYY/MM/
└── templates/
```

Decision, evidence, and handoff records are separate files so parallel branches normally add
different paths instead of modifying one shared append-only file.

## Required evidence fields

Every evidence JSON file must contain:

- `schema_version`
- `evidence_id`
- `task_ref`
- `owner`
- `captured_at`
- `status`
- `claim`
- `source`

The validator rejects malformed JSON, missing required fields, invalid statuses, duplicate evidence
IDs, and common credential patterns.

## Validation

```powershell
.\tools\project-memory.ps1 validate
```

The command is read-only. GitHub Actions runs the same validator when project-memory files change.

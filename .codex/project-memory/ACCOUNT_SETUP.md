# Two-account setup

## Required topology

Each account needs a different directory and task branch. Both directories point to the same Git
remote, while Git worktree metadata keeps their indexes and HEADs separate.

Recommended eventual layout:

```text
Account 1: E:\Agentstrip
Account 2: E:\Agentstrip2-worktree
```

Do not create the second operational worktree from an unreviewed bootstrap branch. First merge the
project-memory pull request, then create a task branch from the updated main branch:

```powershell
git -C E:\Agentstrip fetch origin
git -C E:\Agentstrip worktree add -b codex/account2-start E:\Agentstrip2-worktree origin/main
```

Safety checks before running the command:

1. `E:\Agentstrip2-worktree` must not already exist.
2. The branch name must not already exist locally or remotely.
3. Existing dirty files in `E:\Agentstrip` must remain untouched.
4. Each new task should use a new `codex/...` branch rather than sharing `main` for active edits.

## Codex project mapping

After the worktree exists, map the two saved Codex projects to different paths:

- `Agentstrip` -> `E:\Agentstrip`
- `Agentstrip2` -> `E:\Agentstrip2-worktree`

Changing the saved path is a Codex application setting and is deliberately not automated by this
repository. Confirm the folder visually before changing it.

## Synchronization cycle

```text
claim GitHub Issue
  -> fetch remote references
  -> create/switch task branch in the account's own worktree
  -> read PROJECT_CONTEXT and run brief
  -> implement and verify
  -> create checkpoint/handoff
  -> commit and push
  -> link PR, CI, deployment, and evidence to the Issue
```

Never auto-pull, auto-merge, or auto-commit a dirty worktree.

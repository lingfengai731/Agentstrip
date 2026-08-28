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

PR #30 merged at `3cb398b5d39e1d14533a4842946758a8ae5655ff`. Fresh production checks on
2026-08-28 CST found `/`, `/bali`, `/assets/js/bali-professional.js`, `/api/paypal/config` and
`/sitemap.xml` at HTTP 200. The Bali page loaded p56 with Portfolio place deduplication and official
supplier booking disclosure; Chromium at 390 px had zero horizontal overflow and zero console
errors or warnings. The project owner has since configured all six Render Sandbox values and the
registered webhook. A fresh public config check returned `enabled:true`, `environment:sandbox`, USD
and 1.49 with a public Client ID present and no Client Secret field. No test transaction had been
performed at that checkpoint.

The project owner reports that the PayPal China merchant account is approved for cross-border
receipts and a mainland China bank card is bound. Local code now implements PayPal Orders v2,
server-side amount verification, signed/idempotent webhooks, refund review and responsive checkout
at a USD 1.49 Sandbox price while retaining CNY 9.90 manual QR fallback. Eighty-two product-access
tests passed before the compatibility update; the current suite passes 83 tests after adding current
Payments v2 `DECLINED/PENDING` and available Checkout order status handling. No Sandbox buyer
payment, webhook delivery, refund, settlement or production entitlement mutation has been verified.
The feature still fails closed whenever credentials are absent. The owner separately confirmed that `/ai-tool` is indexed; Search Console
still reported `sitemap.xml` as unreadable with zero discovered URLs on 2026-08-27 even though the
public endpoint returned HTTP 200, `application/xml` and eight URLs. Re-submit and await a fresh
Google fetch before closing that external-state gate. Pak Nanok and SUNSRI remain unpublished
candidates pending legal-entity, insurance, safety, capacity, cancellation and final-price confirmation.

The existing root `AGENTS.md` is intentionally unchanged. Therefore Codex cannot be guaranteed
to auto-load this file solely because it exists. Until the project owner permits a small entry-rule
addition to `AGENTS.md`, each account must open this file or run `project-memory.ps1 brief` at the
start of a task.

## 2026-08-28 paid-route UI release candidate

The owner completed one USD 1.49 PayPal Sandbox buyer checkout and observed the professional route
unlock. That fresh report supersedes the earlier handoff which said no buyer transaction had been
performed, but it does not prove cancellation, duplicate webhook, refund, settlement or Live money.
The same field test exposed route re-entry and copy inconsistencies. The isolated branch
`codex/paid-route-ui-audit-20260828` now restores the purchasing account's latest unlocked Bali trip,
normalises all unlocked days as open, removes unlocked preview/locked copy, gives the adjustment
button visible focus feedback and preserves route selection through login. It also removes subjective
package intensity and public-route pace/fitness labels, removes the duplicated legacy itinerary,
repairs AI workspace feature/deep-destination links, prevents saved trip data from opening an
unrequested modal before My Account, and adds the global account entry to Search. Local evidence is
86/86 tests plus Chromium 320/390/768/1440; this remains a release candidate until PR/CI/Render and a
signed-in production restoration smoke complete.

PR #34 merged as `f156cadc125c7b4f5bb07c8f33832d1119125f71`; its Project memory and
PostgreSQL integration checks passed. Production smoke then exposed two deep-link timing races which
were not visible in local fast-network tests. PR #36 merged as `fcec737d48030b5abd0cc78c223e5c35626dd9e0`
and PR #37 merged as `17cb54b03dadfee2f402c08ca0f4346fd4e9d77f`; their PostgreSQL checks passed.
Render now serves `ai-tool.js?v=p59`. A fresh production Chromium matrix at 320/390/768/1440 passed
Bali layout, objective package filters, unlocked-route recovery simulation, adjustment feedback,
Search/account entry, package-to-driver handoff, `?dest=`, `#itinerary` and `#hotels`, including a
1.5-second delayed `/api/auth/me` response. The only remaining release acceptance is an owner-run
signed-in refresh using the same already-paid Sandbox account; public simulation cannot prove that
account's stored entitlement.

On 2026-08-28 the owner completed that acceptance with the same already-paid Sandbox buyer account:
the full route stayed unlocked after re-entry, the adjustment flow opened without another payment,
and the direct account entry worked. This closes the successful paid-route restoration stage. It
does not prove a refund, declined funding source, external webhook redelivery, settlement or Live
money.

The next isolated engineering stage adds a local buyer-cancel boundary: PayPal JavaScript `onCancel`
marks only WanderMind's pending checkout as `BUYER_CANCELLED`, so a retry creates a fresh provider
order. It does not claim to void a PayPal order remotely. A late completed-capture webhook for an
abandoned order moves it to `refund_review` without granting route access. Refund-review, failed and
cancelled orders are now visible to administrators with provider order, capture and refund reference
fields. The product-access suite passes 87 tests, and deterministic Chromium checks cover the cancel
feedback at 390, 768 and 1440 px. These are local engineering checks until the branch is reviewed,
merged, deployed and separately verified.

Four generated photorealistic activity images remain excluded from the Portfolio because Portfolio is
presented as real island moments. They may be used later only as explicitly labelled AI illustrations;
they must not be represented as traveller or supplier evidence.

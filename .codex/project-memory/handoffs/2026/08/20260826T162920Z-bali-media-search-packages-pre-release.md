# Bali media, search, packages and driver documents — pre-release handoff

## Current truth

- Safe worktree: `E:\Agentstrip-wt-bali-packages-search-20260826`
- Branch: `codex/bali-packages-search-driver-docs-20260826`
- Fixed implementation head before this evidence commit: `c267be0df8a9aaa0d25a214b474c548804691009`
- Base: `origin/main` at `2e563d524e5d3276b8ec15d828e5549847a8e9e0`
- The original dirty `E:\Agentstrip` checkout was not modified.
- Implementation and local browser QA pass. At this checkpoint the branch is not yet pushed, merged or deployed.

## Completed in code

1. Route picker media coverage is 62/62. Fifty-four POIs use exact-place visuals; eight use clearly labelled experience, area or terrain context. The former missing-photo message is absent.
2. Global search is functional from seven public pages and covers pages, R1–R6 and all 62 active POIs in five languages.
3. Eight editable one-to-two-day Bali packages cover Batur, Ubud, Penida, south cliffs and east Bali, then hand a `package_id` to the driver form.
4. The driver budget copy attributes known prices to Dicky as initial prices and makes his reply final; Gede Nico quotes separately.
5. Dicky and Gede Nico each have one 13-page Chinese merged review guide plus a mobile ZIP. Old Chinese split documents were deleted only after the replacements rendered correctly.
6. `DICKY_SUPPLIER_VERIFICATION_MESSAGE_ID.md` contains one concise Indonesian all-in-one question set. Supplier-gated records remain gated.
7. `PAYMENT_ONBOARDING_OPTIONS_ZH.md` records the merchant-account decision and explains why a personal Mastercard alone cannot accept website card payments.

## Verification

- Full local suite: 90 run, 13 PostgreSQL-only tests skipped by design, zero failures.
- Static media/package check: 62/62 POIs, 29 new exact photos, 8 labelled context visuals, 8 packages.
- Search contract check: pass.
- Chromium: 320/390/768/1440 pass for hover/tap route media, packages, search, driver handoff and overflow.
- `git diff --check`: pass.

## Next exact action

Push the branch, create a pull request to `main`, wait for fixed-head Project memory and PostgreSQL CI, merge only if green, then verify Render public markers and rerun production read-only browser smoke. Create separate post-release evidence; do not rewrite this checkpoint.

## Remaining external gates

- Site owner reviews both Chinese merged guides before Indonesian replacements are generated.
- Send the Indonesian supplier question once to Dicky; preserve the dated reply.
- Gede Nico must provide his own rates. Dicky's prices must not be copied to him.
- Choose and verify a merchant entity/provider before automatic card payments are implemented.
- Production write E2E, real synthetic driver email, public posts and paid ads remain separate authorization gates.

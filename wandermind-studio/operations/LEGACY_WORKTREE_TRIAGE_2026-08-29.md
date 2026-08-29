# Legacy `E:\Agentstrip` worktree triage — 2026-08-29

Purpose: explain why the original worktree is dirty and decide what may be migrated, retained or later cleaned without mixing stale code, source media and generated QA artifacts into one commit.

Authority used: `origin/main@cf8f890`, the isolated branch `codex/fullsite-design-audit-20260828`, current image review/manifests, current project memory and SHA-256 comparison. The original worktree remains on `main@bf7c7ef`, 168 commits behind `origin/main`; it must not be pulled, merged or committed as a whole.

## Tracked changes

| Original-worktree change | Finding | Decision |
|---|---|---|
| `.codex/plans/wandermind-master-roadmap-2026-08-02.md` | Its 30-points/3-adjustments wording was valid in August, but current main contains a later and more complete 70% preview, same-entitlement and legacy-compatibility decision. | Do not migrate the stale file. Current main wins. |
| `.codex/role-windows.md` | Adds four 2026-08-04/05 callbacks. Current main has a much newer 107KB role ledger and later production callbacks. Copying the old file would discard newer facts. | Do not migrate or commit the old ledger. |
| `AGENTS.md` | Adds the project-level Sol main / Luna Max worker routing contract. That block is absent from current main but still matches the owner's confirmed mechanism and current global behavior. | Migrate only this block into the current branch; never commit the stale file wholesale. |
| deleted `assets/images/car_photo.jpg` | Current main restored the approved image and its optimized WebP; the asset remains in the rights/review manifest. | Reject the old deletion. |
| modified `assets/images/hero-1.jpg` | The old worktree contains a 14.3MB aerial-coast candidate while current main uses a different 168KB boat/snorkelling image under the same name. The candidate also has `web/hero-bali-coast.webp`. | Preserve as an unintegrated design candidate; do not overwrite current Hero without visual/product acceptance. |

## Untracked images

- 51 files, approximately 158.19MB, were hashed.
- 49 hashes already exist in the approved image-intake review; every corresponding optimized WebP exists in current main.
- Of those 49, 47 original-resolution files exist only in the old worktree. They are source masters, not disposable duplicates.
- `car_photodicky.jpg` and `hero-4.jpg` also exist byte-for-byte in current main; they are the only proven raw duplicates.
- `service-private-guide.png` is the source-resolution version of the WebP already used by Home Step 3 and Find Driver social metadata. It is integrated visually even though its source PNG hash is not in the image-intake CSV.
- `web/hero-bali-coast.webp` is the optimized derivative of the unintegrated aerial-coast Hero candidate.

Decision: retain the source images. Do not commit 158MB of source masters into the website branch, and do not delete the only originals. A later media-archive task may copy them to durable object storage, verify hashes, then remove only proven redundant local copies.

## Documents and generated directories

| Item | Evidence | Decision |
|---|---|---|
| `20260802.txt`, two WanderMind DOCX files and the image-classification TXT | User requirement/source documents; no same-named tracked copy exists. | Retain locally; do not silently publish or delete. |
| `.playwright-cli/` | 314 files, about 16.9MB, generated browser snapshots; current `.gitignore` already ignores it. | Moved to the Windows Recycle Bin after exact-path verification on 2026-08-29. Re-creatable; no product or historical screenshot source was removed. |
| `output/` | 81 files, about 24MB: 78 screenshots and 3 QA scripts. Current visual-review records reference `output/playwright/...`. | Retain as historical QA evidence until references are archived or replaced. |
| `.idea/` | Nine local IDE files, about 6.5KB. | Added `.idea/` to current `.gitignore`, then moved the verified legacy directory to the Windows Recycle Bin on 2026-08-29. |

## Result

The dirty state is not a single missed cross-account commit. It is a mixed legacy workspace containing one valid project-policy delta, stale documents, unique source media, unintegrated visual candidates and historical QA artifacts. Only the Luna routing block and `.idea/` ignore rule are safe and useful to migrate now. The two proven disposable cache directories were removed recoverably; all source media, requirement documents and `output/` evidence remain untouched.

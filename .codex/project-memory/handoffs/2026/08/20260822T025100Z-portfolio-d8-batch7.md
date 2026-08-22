# Handoff: Portfolio D8 batch 7, unverified split-gate unit

- Status: verified locally
- Owner: codex-sol
- Captured at: 2026-08-22T02:51:00Z
- Branch: codex/portfolio-d8-batch7
- Code commit: c055de40b248ed195d80cf8c14e9db9d26157a5b
- Worktree: E:\Agentstrip-wt-portfolio-d8-batch7

## Current state

`bali-2.jpg` is retained as a stable historical asset path, not as Handara Gate evidence. Its metadata describes a visible Balinese-style split gate, mountain landscape, greenery, road and cloth decorations. `location_status` is `unknown`; region, route and POI are empty. D8 complete-copy count is now 26; route/region/POI/all-geo counts remain 23/23/22/22; 26 D8 theme candidates remain.

## Verified evidence

- Original SHA-256 matches manifest and CSV; the original and WebP are both 1401x951; rights and approval fields did not change.
- EXIF contains no location or capture-time evidence. Official Handara sources support a visual comparison but not unique identity, so the image remains unlinked.
- 58/58 product tests, PowerShell 7 image-intake regression and diff check passed.
- Luna Max first rejected the old Bali inference as P1, then reviewed immutable commit `c055de4` and returned GO with P0/P1/P2 all zero.

## Risks and boundaries

Do not add Handara, G5, R1/R5, POI, opening hours, price, queue or guaranteed photography claims without independent image provenance or location evidence. This asset is not referenced by the static gallery, so no rendered UI changed. No upload, publication, Render access, merge or deployment was performed.

## Next exact action

Inspect `bali-3.jpg` as the next single-image D8 unit. Treat its filename as a path only; use the broadest metadata supported by the image and independent evidence.

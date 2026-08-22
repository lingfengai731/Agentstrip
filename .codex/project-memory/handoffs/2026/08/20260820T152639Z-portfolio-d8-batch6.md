# Handoff: Portfolio D8 batch 6, unknown coast unit

- Status: verified locally
- Owner: codex-sol
- Captured at: 2026-08-20T15:26:39Z
- Branch: codex/portfolio-d8-batch6
- Code commit: 4877aa30b6380ba0219012ccdec61277e52e222d
- Worktree: E:\Agentstrip-wt-portfolio-d8-batch6

## Current state

`bali-1.jpg` is retained as a stable historical asset path, not as location evidence. Its metadata now describes only a coastal building, exposed rocky shore at low tide and twilight sky. `location_status` is `unknown`; region, route and POI are empty; the `bali` tag and `bali-landscape` subcategory were removed. D8 complete-copy count is now 25; route/region/POI/all-geo counts remain 23/23/22/22; 27 D8 theme candidates remain.

## Verified evidence

- Original SHA-256 matches manifest and CSV; WebP exists; rights and approval fields did not change.
- EXIF contains no location or capture-time evidence, and the scene has no unique place marker.
- 57/57 product tests, PowerShell 7 image-intake regression and diff check passed.
- Luna Max first rejected the old metadata as P1, then reviewed immutable commit `4877aa3` and returned GO with P0/P1/P2 all zero.

## Risks and boundaries

Do not restore Bali, hotel, beach, region, route or POI claims from the filename alone. This asset is not currently referenced by the static gallery, so no rendered UI changed and no browser check was required. No upload, publication, Render access, merge or deployment was performed.

## Next exact action

Inspect `bali-2.jpg` as the next single-image D8 unit. Treat its filename as a path only; use the broadest metadata supported by the image and independent evidence.

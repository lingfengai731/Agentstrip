# Handoff: Portfolio D8 batch 3, first unit

- Status: verified locally
- Owner: codex-sol
- Captured at: 2026-08-20T13:08:40Z
- Branch: codex/portfolio-d8-batch3
- Code commit: 6179c3272b262274b6f09422a9b8f7e6ed7d06ae
- Worktree: E:\Agentstrip-wt-portfolio-d8-batch3

## Current state

`bali-12.jpg` is mapped to `ubud_monkey_forest`, G4 and R1/R2/R4. Its five-language title, description and alt text describe only the visible moss-covered sculpture, gold lettering and entrance sign; current hours, admission and temporary closures remain official live checks. D8 complete count is now 22, with 30 candidates remaining.

## Verified evidence

- Original SHA-256 matches the manifest; original and WebP were visually checked.
- Official Monkey Forest Ubud material and a separate image of the same entrance support the location identity; local feature matching found 161 good matches and 114 RANSAC inliers.
- 54/54 product tests, image-intake regression, Node syntax and diff check passed.
- Luna Max first audit was blocked by expected parent-thread drift; immutable commit review then completed with GO.

## Risks and boundaries

The comparison image was not imported. No upload, publication, Render access, merge or deployment was performed. The branch is not production.

## Next exact action

Verify the exact scene and cultural context of `Galungan.jpg` before assigning any POI, region or route metadata.

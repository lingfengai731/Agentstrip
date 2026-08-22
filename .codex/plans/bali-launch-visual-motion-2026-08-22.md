# Bali launch visual and motion plan

## Outcome

Make the public-route area faster to scan without changing WanderMind's identity or hiding any free route content. Keep the release surface small enough to ship with the current PR.

## Surface classification

- Page type: content-led destination and route-selection page.
- Primary user job: compare a Bali route family, inspect its full route, then continue to a personal professional route, AI DIY, or a controlled driver request.
- Visual direction: real photography for emotion; warm paper for long reading; teal only for task state; amber only for brand/current selection.

## Active reference ledger

| Reference | Adopt | Avoid |
| --- | --- | --- |
| `DESIGN.md` | Travel Paper, Warm Canvas, ink text, teal actions, restrained motion | A new page-specific identity |
| User review, 2026-08-22 | Reduce the uninterrupted green area and repeated copy | Removing R1-R6 detail or the full free route promise |
| UI UX Pro Max query | One or two meaningful motion cues, visible focus, reduced-motion support | Its unrelated dark newsletter palette and GSAP dependency |
| Impeccable 4.1.1 | Hide internal QA vocabulary, preserve the incumbent world, run one bounded detector pass | Installing project hooks or smuggling in a redesign during release polish |

## Find Animation Opportunities audit

| Priority | Opportunity | Decision | Reason |
| --- | --- | --- | --- |
| P0 | Route-card selection updates the large detail panel | Implement one short enter transition when the route ID changes | Confirms cause and effect without delaying navigation |
| P0 | Active day changes map marker and editor state | Keep and clarify existing color transition | Already useful feedback; no new animation system needed |
| P1 | Gallery image hover | Keep existing restrained zoom | Provides affordance and does not run continuously |
| P1 | Professional route loading | Keep current textual loading state | No need to add decorative skeletons before launch |
| Rejected | Scroll reveal, parallax, bouncing CTA, animated map path | Do not implement | Adds motion and runtime risk without improving route choice |

## Improve Animations repair plan

1. Add a 180 ms ease-out transition only when the selected R route changes.
2. Preserve instant updates for place add/remove/reorder so editing never feels delayed.
3. Add a page-level `prefers-reduced-motion: reduce` rule that disables route, card, button, marker, and gallery transitions/transforms.
4. Verify route switching, keyboard focus, mobile widths, and reduced-motion mode.

## Visual implementation plan

1. Replace the route-detail teal slab with a warm paper atlas surface, dark text, white day cards, and a quiet topographic background.
2. Keep all day headings visible; show place controls only for the active day so the complete route remains free but the editor is less dense.
3. Keep verification state in data/admin handoff, hide the public `verified` badge, and show only actionable `check before travel` or `confirm before booking` labels when needed.
4. Change the driver band from bright teal to deep ink-teal so teal returns to being an action color.
5. Do not add a component library; the static HTML page already has the required controls and Leaflet map.

## Acceptance criteria

- R1-R6 card switching updates the detail and matched professional route.
- Every day remains reachable without payment or login.
- Add/remove/reorder and map-marker selection still work.
- No horizontal overflow at 320, 390, 768, and 1440 px.
- Five language switches continue to localize route cards and dynamic controls.
- The default Portfolio view shows 12 moments, with an explicit five-language control to reveal the full approved gallery.
- Reduced-motion mode removes nonessential movement.
- Existing backend tests and `git diff --check` pass.

## Review Animations verdict

**Approved for launch.** Route switching uses one 180 ms ease-out response with a 4 px maximum displacement. Place editing remains immediate, no scroll reveal/parallax/bouncing CTA was added, and `prefers-reduced-motion` removes the transition. The motion communicates a real state change and does not become the visual subject.

## Tooling decision

`pbakaus/impeccable` 4.1.1 was installed outside the repository at `E:/CodexSkills/.sources/impeccable` and exposed through a user-scope Junction. This release uses its `polish` guidance and one manual detector pass only. Project hooks remain intentionally uninstalled because they add a separate trust/configuration surface and are not required for this bounded release correction.

The bounded detector pass found two thick one-sided accent borders and three incumbent/intentional signals. The two borders were replaced with complete one-pixel borders. Roboto remains because `DESIGN.md` deliberately selects it with full CJK fallbacks; the empty modal image receives its source before the modal opens; the amber hover shadow remains a narrowly scoped brand CTA treatment. The detector ran in degraded regex mode because its optional parser modules are not installed, so browser and screenshot QA remain the visual authority.

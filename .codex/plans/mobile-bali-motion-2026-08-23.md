# 001 — Explain Bali mobile state changes without decorative motion

- **Status**: DONE
- **Commit**: pending branch commit
- **Severity**: MEDIUM
- **Category**: missed opportunities, accessibility, performance
- **Estimated scope**: 1 file, small CSS and interaction changes

## Problem

The current Bali route change already uses a restrained state transition, but the new mobile-only section disclosure and place picker would otherwise appear without spatial context. The fix must not add scroll reveals, parallax, animated maps, staggered galleries, or movement to keyboard-repeated day navigation.

Current route-change exemplar in `wandermind-studio/frontend/bali.html:1351`:

```js
detail.animate(
  [{ opacity:.72, transform:'translateY(4px)' }, { opacity:1, transform:'translateY(0)' }],
  { duration:180, easing:'cubic-bezier(.16,1,.3,1)' }
);
```

## Target

Use two shared motion tokens and only three purposeful responses:

```css
--bali-ease-out: cubic-bezier(.23,1,.32,1);
--bali-ease-drawer: cubic-bezier(.32,.72,0,1);
```

- Mobile section disclosure icon: `transform 160ms var(--bali-ease-out)`; content itself changes immediately, avoiding animated height.
- Place picker: overlay opacity and sheet/panel transform for `220ms var(--bali-ease-drawer)`; on reduced motion keep opacity feedback but remove positional movement.
- Pressable mobile controls: `transform 140ms var(--bali-ease-out)` and `scale(.97)` only during active press.

## Repo conventions to follow

- Keep the existing restrained route-change exemplar in `wandermind-studio/frontend/bali.html:1351`.
- Use the established teal, amber and warm-paper palette from `DESIGN.md`.
- Keep all motion inside the Bali page; add no dependency or global animation framework.

## Steps

1. Add the two motion tokens to the Bali page variables and use them only for disclosure, picker and press feedback.
2. Gate hover movement behind `@media (hover:hover) and (pointer:fine)` so touch does not retain false hover states.
3. In `prefers-reduced-motion`, remove picker and disclosure translation while retaining short opacity/color feedback.
4. Leave route-day keyboard navigation, map paths and scroll position unanimated.

## Boundaries

- Do NOT change desktop composition or global navigation motion.
- Do NOT animate height, width, margin, padding, top or left.
- Do NOT add scroll reveal, parallax, bounce, haptics, swipe-only navigation or new dependencies.
- If the mobile picker cannot remain keyboard accessible, STOP and ship it without movement rather than weakening accessibility.

## Verification

- **Mechanical**: run the existing product tests, Node syntax checks for inline scripts, `git diff --check`, and the Impeccable detector on the changed targets.
- **Feel check**: at 390px, open and close a section and the place picker repeatedly; controls must respond immediately, the picker must visibly come from the bottom, and no map or gallery motion should compete.
- **Reduced motion**: emulate `prefers-reduced-motion: reduce`; confirm the picker remains understandable with opacity feedback and has no translate animation.
- **Keyboard**: use Tab, Enter, arrows and Escape; repeated navigation must not wait for decorative animation.
- **Done when**: mobile state changes are spatially clear, all motion remains below 300ms, and desktop layout/screenshots are unchanged.

## Result

- Implemented the three planned responses only; no scroll reveal, parallax, animated height, haptics, or new dependency was added.
- At 390px the section disclosure, place picker, touch target sizes, and fixed journey navigation were exercised in Microsoft Edge with zero horizontal overflow.
- `prefers-reduced-motion: reduce` computes the picker transform as `none` and its transition duration as `0.001s`.
- Keyboard activation moves focus into the place list; Arrow Up/Down changes the focused option, and Escape closes the dialog and returns focus to its trigger.
- The strict source review found no `transition: all`, `ease-in`, or layout-property animation in the changed interaction.

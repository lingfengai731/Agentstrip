# WanderMind pre-launch UI polish

## Outcome

Make the already deployed product easier to understand and more credible when promotion begins, without changing the dual planning model, payment rules, route architecture, or admin workflow.

## Visual direction

- Concept: a calm Bali travel studio where real photography creates desire and warm paper surfaces make planning feel trustworthy.
- Design variance: 3/10 — refine the established teal, amber and paper system rather than redesign it.
- Motion intensity: 2/10 — retain only short state feedback and respect reduced motion.
- Visual density: 4/10 — keep route depth, but remove repeated and developer-facing wording.
- Foundation: existing `DESIGN.md` tokens and components.
- Typography: keep Roboto with the current CJK fallbacks and existing hierarchy.
- Palette: amber for the first journey action, teal for functional progress, warm paper for reading, deep ink for trust.
- Composition: route choice first, personalised route second, evidence and local fulfilment later.
- Assets: only already approved real project photography.
- Avoid: a new visual identity, all-green content slabs, repeated free/AI claims, internal verification vocabulary, decorative motion.

## Bounded implementation

1. Correct the Bali hero conversion path: professional route and complete public routes replace the conflicting AI/driver hero pair.
2. Fix first-load localisation for dynamic Bali gallery and route components; add localised loading fallbacks.
3. Reduce repeated public-route copy while preserving the explicit free R1-R6 promise and 70% professional preview rule.
4. Replace the driver profile's large green slab with the existing warm-paper system while preserving all profiles, vehicles, moments and prices.
5. Remove repository/developer links from customer-facing footers; use the contact-page third card for the professional route.
6. Upgrade the home and driver social-preview images from the logo to approved real photography.

## Acceptance

- Home remains split between AI self-planning and the Bali professional route.
- Bali hero no longer routes visitors back into AI DIY or prematurely into driver contact.
- First-load zh/en/ja/ko/id dynamic labels match the selected language without a second switch.
- R1-R6 remain fully browsable; professional route remains about 70% preview with three adjustments after unlock.
- Dicky and Gede Nico, vehicle information, Driver Moments, privacy copy and price rules remain intact.
- No public footer or contact card exposes the GitHub repository.
- 1440, 768 and 390 px screenshots have no horizontal overflow, overlap or clipped controls.
- Existing product tests, targeted browser callbacks, `git diff --check`, and the Impeccable detector pass succeed.

## STOP conditions

- A required change touches paid-user entitlements or production data.
- A fix requires a new backend architecture or a destructive production action.
- Existing user files in `E:\Agentstrip` would need to be overwritten.

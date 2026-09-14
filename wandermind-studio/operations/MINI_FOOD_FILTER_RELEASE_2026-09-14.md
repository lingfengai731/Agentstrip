# Mini dining filter repair and first-release boundary

## Scope and cause boundary
- User reports six native selectors do not open in phone Preview. Catalogs already contain options; it is not an empty or unimplemented restaurant database.
- Earlier native QA measured layout/data and invoked filtering logic, but did not prove opening all six native pickers by taps. Underlying device/native-picker cause was not established; do not attribute it to missing data or claim an OS diagnosis.
- Replace these six pickers with actual buttons and one in-page bottom sheet, not a redesign or new UI dependency. The trip-day picker is unchanged and is not covered by this repair claim.

## UI implementation plan
- Page type: mobile operational list. Keep WanderMind branding, five existing tabs, independent Dining entry, warm paper/teal tokens and two-column filters.
- Hierarchy: clear field label → selected value/button → localized panel heading → scrollable options. Existing hero, trip context, restaurant cards and itinerary/driver integration remain unchanged.
- Reuse app semantic paper/ink/teal/radius tokens;44px controls, normal wrapping, safe-area padding. No decorative motion or external reference/library needed.
- Opening is blocked during loading/error; selected row has background, text and tick feedback. Choose applies immediately; Close/backdrop cancels without changing value. Invalid indices and stale-account selection cannot commit.
- Native-only surface: no desktop/tablet website CSS change. Acceptance at390px and five locales; long list bottom selection and backdrop cancellation separately tested.

## Accepted evidence
-386 Mini contracts and all offline Mini suites pass; native lanes without explicit flags are skips, not visual evidence.
-30 native SDK `button.tap()` open/select/close/reset callbacks: six fields × zh/en/ja/ko/id. Every filter height44px;zero simulator exceptions. No live requests forwarded.
- Separate focused native long-list test:36 cuisine options;scroll to final option35, select and backdrop-cancel preserves it. Screenshots reviewed, including English bottom sheet.
- Official CLI Preview generated:1,719,880 bytes; local `output/food-filters-preview.jpg`. Preview is not Upload/review/public release.
- `restaurant-media/` supplied pack is preserved and stays untracked until permission/identity audit acceptance. Official source links alone cannot substantiate63 claimed owner authorizations; review of third-party pack assertions is independent of this filter release.

## First release decision
- Do not wait for restaurant photography expansion before a first Mini release. This interaction blocker takes priority; current50-record/40-public dining data and existing accepted functionality remain intact.
- Developer-version Upload and WeChat review/publication must be recorded separately. Review needs actual console service category, privacy declarations, production domain and tester/access details; do not infer configured status from local compilation or tools being logged in.
- No changes to user rights, payments, driver submissions, production database or Render environment. Mini-only source changes do not require a Render deployment.

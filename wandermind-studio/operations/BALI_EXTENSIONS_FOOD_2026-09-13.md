# Bali extensions and dining — implementation contract (2026-09-13)

## Release boundary
The owner accepted the previous native Preview. Keep main@88fc025 and Mini subtree 1a4c8490ffae3f1f0da7266f09167be9f87a12b4 as the first-release candidate. Food must not delay that candidate. This branch is the next content release; no new Upload, review submission or public Mini release is implied.

## Product / UI plan
- Page types: existing Bali detail/editor and native mobile itinerary; Food discovery is a list/detail surface.
- Preserve WanderMind, teal/cream/gold tokens, existing typography, R1–R6 and all five native tabs.
- Native Food is a first-level discovery entry, not a renamed price tab or a crowded sixth native tab.
- Extensions are optional, separate days: West, East, Sea experience. R1/R3/R6 are editorial fits; no new route-family numbers.
- Reuse route cards, day rows and place picker. Each action names the day and result. Loading, unavailable data, no candidates and retry must be explicit.
- Text hierarchy: existing section title, compact module name, one short planning note, details disclosure for supplier conditions/source date.
- Reuse existing spacing/radius/color CSS; minimum 44px controls, visible focus and selected state. No new decorative animation.
- Desktop: compact module strip within route details; tablet wraps; mobile single-column options and horizontal route indicator remains.
- References: existing accepted WanderMind UI is the visual foundation. External culinary sites inform taxonomy and discovery only, not brand/layout cloning.
- Build sequence: source-backed catalog → deterministic shared selectors → itinerary persistence → handoffs → web/native UI → images → callback tests. No restaurant hardcoding in HTML.
- Acceptance: 320/390/768/1440 widths; five languages; module add/remove/reload; Sanur cannot silently gain an island stop; no duplicate module; paid adjustment rules unchanged; all receivers retain stops.
- Do not turn demonstration route lines into driving directions, straight-line distance into drive time, or web supplier examples into booked times.

## Research — confirmed and excluded
Accessed 2026-09-13:
- https://axestonefastcruise.com/west-nusa-penida-tour/ : west cluster Broken Beach/Angel's Billabong/Kelingking/Crystal Bay. This is an operator itinerary example, not WanderMind's guaranteed schedule or price.
- https://axestonefastcruise.com/east-nusa-penida-tour/ : east cluster Diamond/Atuh/Molenteng viewpoints.
- https://axestonefastcruise.com/snorkeling-package/ : Manta Bay/Gamat Bay/Toyapakeh Wall/Crystal Bay are operator-listed possibilities. Manta Bay is not Manta Point. Wildlife sightings and individual stops cannot be promised.
- https://axestonefastcruise.com/faq/ : crossing guidance around 30–45 minutes and check-in 30–60 minutes, conditional on operator/weather.
- https://axestonefastcruise.com/time-schedule/ : published WITA timetable. Do not import its pickup grid: several AM/PM values are inconsistent. Snorkeling sample return 13:30 does not match this timetable; exclude it.
- https://www.indonesia.travel/id/id/travel-ideas/adventure/nusa-penida : regional cliff/beach context.
- https://www.indonesia.travel/id/en/destination/bali-nusa-tenggara/bali/snorkeling-nusa-penida : marine context, not a safety certification.
No new ticket prices, taxes, opening hours or fixed boat tickets are being inferred from those examples.

## Roles actually applied
These are framework-based internal review lenses, not endorsements or live opinions of the named people.
| Skill/role | Lens | Finding | Adopted | Rejected |
|---|---|---|---|---|
| Steve Jobs perspective | Product, UX/UI, commercial focus | Food scope can indefinitely delay accepted Mini; five existing tabs already serve core tasks | Split release candidate and expansion; preserve navigation | Rename the product or replace price comparison |
| Andrej Karpathy perspective | Data architecture, engineering/QA | G3 spans sea-separated nodes; rendered labels alone do not enforce itinerary correctness | Deterministic geographic filter and receiver contract tests | Let an LLM silently decide ferry feasibility |
| UI implementation workflow | Responsive product interface | Module choice needs a visible outcome, not another decorative card | Reuse day editor and explain separate-day behavior | New visual system or marketing animation in editor |
| Sol + source research | Travel product, content/editorial | Published example times conflict; dining needs source-kind separation | Mark editorial recommendations and live confirmation boundaries | Treat review popularity as halal/safety/price verification |
| Luna bounded research | Food source gathering | Worker quota error; partial valid 30-record JSON recovered, no final acceptance | Parent reconciled regions and sources; combined with owner's 27-record input, deduplicated to 50 | No claim that worker completed or all operational fields are verified |

## Current facts / remaining work
Baseline has 65 POIs, including West/East Penida names, but no executable extension catalog. Same-area UI already avoids route_ids restriction; it still needs subregion separation. Existing mainland G3 days must not imply a ferry trip.
Research output, implementation, tests and production publication are separate acceptance stages. No new content is published merely because this document exists.

## Resumed implementation and acceptance
- Owner files were read in full. Their claimed 65-note XHS sample is not independently verified. Current region definitions override report G5/G6/G7 conflicts.
- Canonical travel POIs: 66 (added Pererenan Beach in G1/Canggu). Suluban, Uluwatu Temple, Melasti and Sundays already existed. Sundays is within The Ungasan context; its day pass does not give access to the resort pool or all hotel facilities.
- Extension POIs: 4 operator-listed marine/activity identities. Their supplier-confirmation flags remain; no precise marine coordinates or guaranteed animal sighting.
- Food: 50 source records, 40 eligible editorial discovery records, 10 drafts/closed/insufficient-source records. `published` in this candidate JSON is a visibility flag, not proof of production deployment. Only 3 restaurant branch identities were independently directly checked (Merah Putih, Cuca, Yuki Uluwatu); prices and coordinates are not verified.
- Yuki Canggu is excluded after its own official page reported temporary closure: https://www.yuki-bali.com/canggu .
- 41 records have same-named-area POI associations; these are not verified walking distances or live driving estimates. Geographic/meal selectors, day persistence and strict backend handoff validation are implemented. Changed trip lengths/regions can reject stale restaurant choices rather than silently reroute them.
- Web Dining has five languages, area/category/budget/meal filters, itinerary day selection, map/storefront links, sources, route links and add-to-day. It does not republish Google/venue storefront photos.
- Mini adds `pages/food/food` with a public first-level discovery entry. All five existing native tabs remain unchanged. Shared engine/copy are checked for parity. Public edited plans are account-scoped. Planner and private driver summaries retain dining stops.
- Web extension modules use existing licensed POI visuals; no new photo batch or primary Portfolio theme is published. Food album/new licensed storefront and marine images remain open.
- Map West/East references use credited Commons camera/viewpoint coordinates, not port coordinates; dashed links are explicitly schematic. Actual marine stop selection is still supplier-dependent.
- Local acceptance: Food data/engine contracts, 379 native contracts and other offline native suites passed; 3 new backend dining behavior tests passed. Existing 120-test product suite has the same 17 stale static failures on both main@88fc025 and this branch before the food slice. This is tracked test debt, not a clean full-suite result.
- Browser acceptance: deterministic Chromium 20 Food cases (four widths × five languages) plus four Bali add/remove/persist cases. Screenshots and matrix are under ignored output/playwright/bali-food. This is not native Browser/Render-admin evidence.
- Native DevTools CLI `auto` succeeded on HTTP9420/WS9421, but SDK returned `timeout waiting for automator response`; its report has an empty matrix and is NOT accepted visual evidence.
- No expansion merge, production deployment, new Preview, Mini Upload/review/public release, payment, driver email, environment-variable or production database change is claimed.

## Unified next actions (do not broaden first-release scope)
| Priority | Task | Acceptance |
|---|---|---|
| P0 | Close native Food/itinerary extension rendering and interaction callbacks | Fresh five-language native screenshots; add/restore/account-switch and planner/driver callbacks |
| P0 | Close AI receiver parity and restaurant geographic/day remapping UX | User-visible feedback when public plan days differ from paid personal dates; no silent loss; native AI retains chosen stops |
| P1 | Source-check remaining restaurant branches and enrich cuisine/scene coverage | Official identity/status references, dated live fields, branch-level location; no XHS popularity treated as fact |
| P1 | Licensed Penida/marine/storefront batch and Food & Dining album | Attribution/permission audit, optimized files, manifests, route/extension tags, separately counted approved/verified/published |
| P1 | Fixed-head PR/CI, merge and deploy this expansion only after gates | Exact commit/tree, production public Browser evidence and regression; no Render-admin impersonation |
| P2 | Update stale product static tests without weakening behavior coverage | Separate repair of 17 baseline assertions; validated current media/cache contracts |
| P2 | Mini first release using already accepted candidate | Keep next-version food branch separate; official Upload/review status recorded independently |

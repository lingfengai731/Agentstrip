# Mini Program gallery and payment-boundary plan

## Existing visual system

- Preserve the Mini Program cream paper background, deep teal editorial surfaces, warm gold highlights, rounded cards, generous mobile spacing, and 88rpx touch targets.
- Reuse the website's reviewed Bali data and media sources. Do not copy full-size destination photos into the Mini Program package.
- Keep the five-item tab bar unchanged. Gallery and place detail are secondary pages reached from Home and Trips.

## Information architecture

1. Home gains one editorial `岛屿作品集` entry that explains the difference between real traveller moments and exact-place references.
2. Trips loads routes and the media index together. Every visible unlocked place name becomes a clear, accessible tap target.
3. Place detail uses a full-width swipe gallery, place facts, visual-scope disclosure, rights attribution, and an action back to the selected route.
4. Gallery combines published Cloudinary Portfolio items with approved static Bali Portfolio items, removes duplicates, and supports compact theme filters.

## Mobile behavior

- One-column reading flow at all phone widths; no desktop hover dependency.
- Images use remote thumbnails in lists and full web assets only in the detail swiper.
- Long names wrap without clipping. Buttons and filter chips remain at least 88rpx high where they trigger navigation.
- Loading, partial-source failure, empty state, image failure, and retry paths remain visible and actionable.

## Payment boundary

- PayPal remains Sandbox-only until the account and the exact product are approved for live collection.
- The paid item is digital professional-route access, not transport, a taxi booking, or collection on behalf of a driver.
- Driver fares and supplier services stay in a separate quote/referral flow and are paid directly under the provider's confirmed terms.
- A second environment flag is required before PayPal Live can become enabled, preventing an accidental environment-only switch.

## Acceptance

- Contract tests declare both new pages and validate every bound handler.
- Route place objects retain stable POI ids and open the correct detail page.
- Gallery and POI media URLs resolve only to `https://wandermind.cc` or already-published Cloudinary HTTPS URLs.
- Mini Program package remains under the WeChat main-package limit because no destination photo is bundled.
- No PayPal Live payment, production entitlement write, driver email, Mini Program Upload, review submission, or release occurs in this slice.

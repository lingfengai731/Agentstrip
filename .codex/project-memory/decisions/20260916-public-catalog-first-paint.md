# Public catalog first paint

Use a generated, source-parity-checked snapshot of existing public Web data for Mini first paint. Network refresh is bounded and optional. Public catalog data is not authorization: matching, orders and entitlements continue to require the real backend.

Rationale: route/Food/gallery screens previously depended on multiple remote responses before becoming usable. Immutable Luna audit confirmed cascading failure and cached-empty paths. Ship the same public facts, not invented substitute content. Keep per-restaurant verification dates and source links. New administrator photos remain live API content and are added without blocking the shipped gallery.

Build `node tools/build_miniprogram_catalog.cjs --write` only after shared source changes; CI checks parity. Full image descriptions arrive through live refresh; snapshot keeps title, alt and license/source attribution. No new dependency, product redesign, payment mutation or private data cache.

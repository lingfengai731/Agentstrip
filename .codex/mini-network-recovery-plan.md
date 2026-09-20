# Phone network recovery — 2026-09-20

Mobile portfolio/form correction, not a redesign. Existing teal/gold tokens, type hierarchy, radius and spacing retained; no animation or external design reference required.

Evidence: owner's new phone report supersedes simulator acceptance; local direct wandermind.cc health times out while proxy returns200. DevTools private urlCheck=false. Gallery removes image after15s, losing late success; dynamic images omit explicit WebP decoding. Route POST timeout15s.

Implement: gallery then food then logout within signed-in content. Retain image nodes under loading/error overlay so late success recovers; explicit WebP flag, same-size retry, detail retry. Route bounded45s request with no automatic POST retry, honest errors and lifecycle/account guards. Add user-triggered no-auth/no-write network diagnostic for API and actual sample image; distinguish request versus downloadFile domain errors. Never fake private route results, entitlement or successful generation.

Validate: fake delayed/silent/error platform callbacks;5locale labels; index order; all media surfaces and native image callbacks/screenshots at390. Desktop/tablet unchanged; shared API remains backend authority. No network-hosting or DNS changes without verified authority; do not assume local network matches phone. Final physical-phone acceptance pending until owner confirms new Preview. No Upload/review.

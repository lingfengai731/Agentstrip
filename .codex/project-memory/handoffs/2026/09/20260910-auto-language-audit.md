# Auto language and first customer-flow audit

Branch codex/miniprogram-ui-languages-20260909; baseline d70dca2. User accepted the prior Preview as simple and good; this is owner feedback, not agent screenshot verification.

Implemented: startup language from wx.getAppBaseInfo().language (legacy fallback), supported locale normalization including id/in and region suffixes, saved manual preference wins, unsupported or failed detection defaults zh. Automatic detection does not persist wm_lang. Invalid manual codes are rejected. No personal data requested.

Evidence: test_miniprogram_auto_language.cjs passed locale/manual/persistence/error scenarios; recovery suite and 306 contracts passed. Official Preview 1587357 bytes at E:/Agentstrip-artifacts/2026-09-09/mini-ui-tools/preview-auto-language.jpg.

Local real Chromium test_bali_browser.cjs reported success for 320/390/768/1440 Bali, Portfolio filters/admin suggestions, mocked professional flow and PayPal cancellation, account/search links and driver handoff. This is existing scenario coverage, not exhaustive all-site button or production E2E. Screenshot professional-form-390-en.png inspected; possible excess lower-form whitespace needs viewport-scroll confirmation before changing CSS.

Next priorities:
1. Complete local copy localization on other Mini Program pages: index, itinerary, driver, me, prefs, history, chat, compare, gallery/place. Auto-language does NOT imply all these pages are translated.
2. Extend customer-path audits to remaining website surfaces; inspect mobile blank space with viewport screenshots.
3. Integrate reviewed branch through PR; Mini Program Upload/review/public release remain distinct. No website runtime changed, so Render deployment is not needed for these Mini Program changes.

Never repeat paid orders or expose driver private contacts. Original E:/Agentstrip remains protected. No worker dispatched for the small language initialization slice.

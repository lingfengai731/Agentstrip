const { webkit } = require('playwright');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await webkit.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/bali.html`, { waitUntil: 'domcontentloaded' });
      const openPicker = page.locator('[data-open-place-picker]:not([disabled])').first();
      await openPicker.waitFor({ state:'visible' });
      await openPicker.scrollIntoViewIfNeeded();
      await openPicker.click();
      await page.locator('#bali-route-picker.show').waitFor({ state: 'visible' });
      const options = page.locator('[data-picker-poi]');
      check(await options.count() > 0, `No place choices at ${viewport.width}px`);
      await options.first().click();
      const preview = page.locator('#bali-route-picker-preview img').first();
      await preview.waitFor({ state: 'visible' });
      await preview.evaluate(image => image.decode ? image.decode() : Promise.resolve());
      const images = await page.locator('#bali-route-picker img').evaluateAll(items => items.map(image => ({
        src: image.currentSrc || image.src,
        complete: image.complete,
        naturalWidth: image.naturalWidth
      })));
      check(images.length > 0, `No place media rendered at ${viewport.width}px`);
      check(images.every(image => image.complete && image.naturalWidth > 0), `Broken place media at ${viewport.width}px: ${JSON.stringify(images)}`);
      check(images.every(image => {
        const url = new URL(image.src);
        return url.origin === new URL(base).origin && url.pathname.includes('/assets/images/');
      }), `External place display URL remains at ${viewport.width}px: ${JSON.stringify(images)}`);
      check(images.some(image => new URL(image.src).pathname.includes('/assets/images/poi/commons/')), `Localized POI media was not exercised at ${viewport.width}px`);
      check(errors.length === 0, `WebKit page errors at ${viewport.width}px: ${errors.join(' | ')}`);
      results.push({ width: viewport.width, images: images.length });
      await page.close();
    }
    console.log(`WebKit POI media checks passed: ${results.map(item => `${item.width}px=${item.images}`).join(', ')}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

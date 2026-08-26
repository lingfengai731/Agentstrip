const { chromium } = require('playwright');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';
const viewports = [
  { width: 320, height: 760 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1440, height: 1000 },
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(base + '/bali.html', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-package-select]').first().waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 1, `Bali overflow at ${viewport.width}px: ${overflow}`);
      check(await page.locator('[data-package-select]').count() === 8, `Package count at ${viewport.width}px`);

      const openPicker = page.locator('[data-open-place-picker]').first();
      await openPicker.scrollIntoViewIfNeeded();
      await openPicker.click();
      await page.locator('#bali-route-picker.show').waitFor();
      const options = page.locator('[data-picker-poi]');
      check(await options.count() > 0, `No route POIs at ${viewport.width}px`);
      if (viewport.width <= 575) {
        await options.first().click();
        await page.locator('#bali-route-picker.has-selection .bali-route-picker-preview img').waitFor();
      } else {
        await options.first().hover();
        await page.locator('#bali-route-picker-preview img').waitFor();
      }
      check(!(await page.locator('body').innerText()).includes('该地点照片尚未接入'), `Legacy missing-photo copy at ${viewport.width}px`);
      await page.locator('[data-route-picker-close]').last().click();

      const firstPackage = page.locator('[data-package-select]').first();
      const packageId = await firstPackage.getAttribute('data-package-select');
      await firstPackage.click();
      const handoff = await page.locator('.bali-package-summary a').getAttribute('href');
      check(handoff.includes(`package=${packageId}`), `Package handoff missing at ${viewport.width}px`);
      await page.close();
    }

    const search = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await search.goto(base + '/search.html?q=Tirta%20Empul', { waitUntil: 'domcontentloaded' });
    await search.locator('#site-search-results li').first().waitFor();
    check(await search.locator('#site-search-results li').count() > 0, 'Search returned no results');
    check(await search.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'Search mobile overflow');

    await search.goto(base + '/find-driver.html?package=batur-dawn-choice', { waitUntil: 'domcontentloaded' });
    await search.locator('#fd-places').waitFor();
    check((await search.locator('#fd-places').inputValue()).includes('batur-dawn-choice'), 'Package was not handed to driver form');
    await search.close();
    console.log('Browser checks passed: 4 responsive Bali viewports, hover/tap media, 8 packages, search, driver handoff');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

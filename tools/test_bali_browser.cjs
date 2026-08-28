const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';
const artifactRoot = path.resolve('output', 'playwright', '2026-08-28-paid-route-ui');
fs.mkdirSync(artifactRoot, { recursive:true });
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
      await page.locator('.bali-route-card').first().waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 1, `Bali overflow at ${viewport.width}px: ${overflow}`);
      check(await page.locator('[data-package-select]').count() === 8, `Package count at ${viewport.width}px`);
      const publicRouteMeta = page.locator('.bali-route-card').first().locator('.bali-route-meta > span');
      check(await publicRouteMeta.count() === 1, `Public route metadata is still overloaded at ${viewport.width}px`);
      const packageCopy = await page.locator('#experience-packages').innerText();
      check(await page.locator('.bali-package-filters > div').count() === 1, `Subjective package filter remains at ${viewport.width}px`);
      check(!/Energy|强度/.test(packageCopy), `Subjective package intensity remains at ${viewport.width}px`);
      check(await page.locator('#itinerary').count() === 0, `Duplicate legacy itinerary remains at ${viewport.width}px`);

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
      await page.screenshot({ path:path.join(artifactRoot, `bali-${viewport.width}.png`), fullPage:true });
      await page.close();
    }

    const search = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await search.goto(base + '/search.html?q=Tirta%20Empul', { waitUntil: 'domcontentloaded' });
    await search.locator('#site-search-results li').first().waitFor();
    check(await search.locator('#site-search-results li').count() > 0, 'Search returned no results');
    check(await search.locator('.wm-global-auth-link').count() === 1, 'Search page has no global account entry');
    check(await search.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'Search mobile overflow');

    await search.goto(base + '/find-driver.html?package=batur-dawn-choice', { waitUntil: 'domcontentloaded' });
    await search.locator('#fd-places').waitFor();
    check((await search.locator('#fd-places').inputValue()).includes('batur-dawn-choice'), 'Package was not handed to driver form');
    await search.close();

    const unlockedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers:'block' });
    const unlocked = await unlockedContext.newPage();
    const unlockedErrors = [];
    unlocked.on('pageerror', error => unlockedErrors.push(error.message));
    await unlocked.addInitScript(() => {
      localStorage.setItem('wm_studio_token', 'browser-test-token');
      localStorage.setItem('wm_studio_user', JSON.stringify({ id:'browser-user', email:'browser@example.test', name:'Browser test' }));
      localStorage.setItem('wm_studio_professional_trip_id', 'browser-trip');
      localStorage.setItem('wm_studio_trip_profile', JSON.stringify({ audience:'first', goals:['photo'], travel_style:'comfort', travellers:2, departure_date:'2026-10-01', return_date:'2026-10-08', days:7, currency:'CNY', budget_range:15000, pace:'balanced' }));
    });
    await unlocked.route('**/api/paypal/config', route => route.fulfill({ json:{ enabled:false } }));
    const unlockedPayload = {
      ok:true, trip_id:'browser-trip', professional_route_entitlement:true,
      professional_adjustments_remaining:3,
      profile:{ audience:'first', goals:['photo'], travel_style:'comfort', travellers:2, departure_date:'2026-10-01', return_date:'2026-10-08', days:7, currency:'CNY', budget_range:15000, pace:'balanced' },
      route:{ route_id:'R1', route_name:'First Bali', route_promise:'A clear first trip', recommendation_reason:'Matched to the trip.', days:7, preview_days:7, locked_days:0, unlocked:true,
        days_plan:Array.from({ length:7 }, (_, index) => ({ day:index+1, region_name:'Bali', theme:`Theme ${index+1}`, locked:false, places:[{ name:`Place ${index+1}` }] })) }
    };
    await unlocked.route('**/api/bali/professional-route**', route => {
      if (route.request().url().includes('/recent-unlocked')) return route.fulfill({ json:unlockedPayload });
      return route.fulfill({ status:409, json:{ detail:{ error:'professional_route_adjustment_required' } } });
    });
    await unlocked.goto(base + '/bali.html?route=R2#professional-planner', { waitUntil:'domcontentloaded' });
    await unlocked.locator('#bali-professional-edit').waitFor();
    const unlockedCopy = await unlocked.locator('#bali-professional-app').innerText();
    check(!/Free preview|days locked/.test(unlockedCopy), 'Unlocked route still exposes preview or lock labels');
    await unlocked.locator('#bali-professional-edit').click();
    await unlocked.locator('#bali-professional-editor').waitFor();
    check(await unlocked.locator('#bali-professional-edit').getAttribute('aria-expanded') === 'true', 'Adjustment button has no expanded feedback');
    check(await unlocked.evaluate(() => document.querySelector('#bali-professional-editor').contains(document.activeElement)), 'Adjustment editor did not receive focus');
    await unlocked.screenshot({ path:path.join(artifactRoot, 'professional-unlocked-edit-390.png'), fullPage:true });
    await unlocked.goto(base + '/index.html', { waitUntil:'domcontentloaded' });
    await unlocked.locator('.wm-global-auth-link').waitFor({ state:'attached' });
    check((await unlocked.locator('.wm-global-auth-link').getAttribute('href')).includes('account=open'), 'Account link does not open account view directly');
    await unlocked.goto(base + '/ai-tool.html?dest=paris#itinerary', { waitUntil:'domcontentloaded' });
    await unlocked.waitForTimeout(700);
    const itineraryState = await unlocked.evaluate(() => ({ hash:location.hash, active:Array.from(document.querySelectorAll('.ws-panel-content.active')).map(node => node.dataset.panel) }));
    check(itineraryState.active.includes('itinerary'), `Itinerary deep link did not activate: ${JSON.stringify(itineraryState)} errors=${unlockedErrors.join('|')}`);
    check(await unlocked.evaluate(() => localStorage.getItem('wm_studio_dest')) === 'paris', 'Destination query was applied after initial render');
    await unlocked.goto(base + '/ai-tool.html#hotels', { waitUntil:'domcontentloaded' });
    await unlocked.waitForTimeout(700);
    const hotelState = await unlocked.evaluate(() => ({ active:Array.from(document.querySelectorAll('.ws-panel-content.active')).map(node => node.dataset.panel), hotel:!!document.querySelector('.ws-subtab[data-sub="hotels"].active') }));
    check(hotelState.active.includes('compare') && hotelState.hotel, `Hotel deep link did not activate: ${JSON.stringify(hotelState)} errors=${unlockedErrors.join('|')}`);
    await unlockedContext.close();
    console.log('Browser checks passed: responsive Bali, objective package filters, paid-route recovery, route editor feedback, account/search links, AI deep links and driver handoff');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

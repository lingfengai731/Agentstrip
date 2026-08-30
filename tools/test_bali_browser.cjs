const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';
const artifactRoot = path.resolve('output', 'playwright', '2026-08-30-professional-form-ux');
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
  const launchOptions = { headless:true };
  if (process.env.WM_CHROMIUM_EXECUTABLE) launchOptions.executablePath = process.env.WM_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(launchOptions);
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

    const freshPreviewContext = await browser.newContext({ viewport: { width:390, height:844 }, serviceWorkers:'block' });
    const freshPreview = await freshPreviewContext.newPage();
    const freshPreviewErrors = [];
    const freshPreviewRequests = [];
    let freshPreviewAdjustmentCalled = false;
    freshPreview.on('pageerror', error => freshPreviewErrors.push(error.message));
    await freshPreview.addInitScript(() => {
      localStorage.setItem('wm_studio_lang', 'en');
      localStorage.setItem('wm_studio_token', 'fresh-preview-token');
      localStorage.setItem('wm_studio_user', JSON.stringify({ id:'fresh-preview-user', email:'fresh-preview@example.test', name:'Fresh preview' }));
    });
    await freshPreview.route('**/api/auth/me', route => route.fulfill({ json:{ id:'fresh-preview-user', email:'fresh-preview@example.test', name:'Fresh preview' } }));
    await freshPreview.route('**/api/paypal/config', route => route.fulfill({ json:{ enabled:true, environment:'sandbox', client_id:'public-test-client', currency:'USD', amount:'1.49' } }));
    await freshPreview.route('**/api/bali/professional-route/recent-unlocked**', route => route.fulfill({ status:404, json:{ detail:{ error:'professional_route_not_found' } } }));
    await freshPreview.route('**/api/bali/professional-route/**/adjust', route => {
      freshPreviewAdjustmentCalled = true;
      return route.fulfill({ status:500, json:{ detail:'Unpaid rematch must not consume an adjustment' } });
    });
    await freshPreview.route('**/api/bali/professional-route', async route => {
      const freshPreviewRequest = route.request().postDataJSON();
      freshPreviewRequests.push(freshPreviewRequest);
      const profile = freshPreviewRequest.trip_profile;
      const previewDays = profile.days <= 1 ? profile.days : Math.min(profile.days - 1, Math.max(1, Math.ceil(profile.days * 0.7)));
      await route.fulfill({ json:{
        ok:true, trip_id:'fresh-preview-trip', professional_route_entitlement:false,
        professional_adjustments_remaining:0, profile,
        route:{ route_id:'R1', route_name:'First Bali', route_promise:'A clear first trip', recommendation_reason:'Matched to the trip.', days:profile.days, preview_days:previewDays, locked_days:profile.days - previewDays, unlocked:false,
          days_plan:Array.from({ length:profile.days }, (_, index) => ({ day:index+1, region_name:'Bali', theme:`Theme ${index+1}`, locked:index >= previewDays, places:index >= previewDays ? [] : [{ name:`Place ${index+1}` }] })) }
      } });
    });
    await freshPreview.goto(base + '/bali.html#professional-planner', { waitUntil:'domcontentloaded' });
    const semanticControlMetrics = await freshPreview.locator('#bali-professional-form').evaluate(form => {
      const radio = form.querySelector('[name="audience"]');
      const option = radio.nextElementSibling;
      return { radioWidth:radio.getBoundingClientRect().width, optionHeight:option.getBoundingClientRect().height, fieldsets:form.querySelectorAll('fieldset').length, profile:!!form.querySelector('.bali-professional-profile') };
    });
    check(semanticControlMetrics.radioWidth <= 2 && semanticControlMetrics.optionHeight >= 44, `Professional choice controls are not semantic cards: ${JSON.stringify(semanticControlMetrics)}`);
    check(semanticControlMetrics.fieldsets === 3 && semanticControlMetrics.profile, 'Professional form lacks the three question groups or live trip profile');
    await freshPreview.locator('.bali-professional-empty').screenshot({ path:path.join(artifactRoot, 'professional-form-390-en.png') });
    await freshPreview.locator('#bali-professional-form [name="budget"]').fill('12000');
    await freshPreview.locator('#bali-professional-form button[type="submit"]').click();
    await freshPreview.locator('#bali-professional-unlock').waitFor();
    const freshPreviewRequest = freshPreviewRequests[0];
    check(freshPreviewRequest && freshPreviewRequest.trip_id === '', 'Fresh professional preview did not submit without a saved profile');
    check(freshPreviewRequest.trip_profile.currency === 'CNY', 'Fresh professional preview did not apply the default currency');
    check(await freshPreview.locator('.bali-professional-day.is-locked').count() === 2, 'Fresh seven-day professional preview did not preserve the five-open/two-locked gate');
    check(freshPreviewErrors.length === 0, `Fresh professional preview raised page errors: ${freshPreviewErrors.join('|')}`);
    await freshPreview.locator('#bali-professional-edit').click();
    await freshPreview.locator('#bali-professional-editor').waitFor();
    check(await freshPreview.locator('#bali-professional-editor [name="budget"]').inputValue() === '12000', 'Unpaid edit did not preserve the submitted trip information');
    await freshPreview.locator('#bali-professional-editor [name="budget"]').fill('13000');
    await freshPreview.locator('#bali-professional-editor button[type="submit"]').click();
    await freshPreview.locator('#bali-professional-unlock').waitFor();
    check(freshPreviewRequests.length === 2 && freshPreviewRequests[1].trip_profile.budget_range === 13000, 'Unpaid preview did not re-match with the corrected trip information');
    check(!freshPreviewAdjustmentCalled, 'Unpaid preview edit consumed a professional-route adjustment');
    await freshPreview.locator('#bali-professional-unlock').click();
    await freshPreview.locator('#bali-professional-payment').waitFor();
    await freshPreviewContext.close();

    const languageExpectations = { en:'Trip basics', zh:'基本行程', ja:'基本情報', ko:'기본 일정', id:'Dasar perjalanan' };
    for (const [language, expected] of Object.entries(languageExpectations)) {
      const languageContext = await browser.newContext({ viewport:{ width: language === 'zh' ? 1440 : 390, height:900 }, serviceWorkers:'block' });
      const languagePage = await languageContext.newPage();
      await languagePage.addInitScript(lang => localStorage.setItem('wm_studio_lang', lang), language);
      await languagePage.route('**/api/paypal/config', route => route.fulfill({ json:{ enabled:false } }));
      await languagePage.goto(base + '/bali.html#professional-planner', { waitUntil:'domcontentloaded' });
      await languagePage.locator('#bali-professional-form').waitFor();
      check((await languagePage.locator('.bali-professional-form-section legend').first().innerText()).includes(expected), `Professional form did not localize ${language}`);
      check(await languagePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `Professional form overflow in ${language}`);
      if (language === 'zh') await languagePage.locator('.bali-professional-empty').screenshot({ path:path.join(artifactRoot, 'professional-form-1440-zh.png') });
      await languageContext.close();
    }

    const staleTripContext = await browser.newContext({ viewport: { width:390, height:844 }, serviceWorkers:'block' });
    const staleTrip = await staleTripContext.newPage();
    const staleTripErrors = [];
    const staleTripRequests = [];
    staleTrip.on('pageerror', error => staleTripErrors.push(error.message));
    await staleTrip.addInitScript(() => {
      localStorage.setItem('wm_studio_token', 'new-account-token');
      localStorage.setItem('wm_studio_user', JSON.stringify({ id:'new-account', email:'new-account@example.test', name:'New account' }));
      localStorage.setItem('wm_studio_professional_trip_id', 'previous-account-trip');
      localStorage.setItem('wm_studio_trip_profile', JSON.stringify({ audience:'first', goals:['photo'], travel_style:'comfort', travellers:2, departure_date:'2026-10-01', return_date:'2026-10-06', days:5, currency:'CNY', budget_range:12000, pace:'balanced' }));
    });
    await staleTrip.route('**/api/paypal/config', route => route.fulfill({ json:{ enabled:false } }));
    await staleTrip.route('**/api/auth/me', route => route.fulfill({ json:{ id:'new-account', email:'new-account@example.test', name:'New account' } }));
    await staleTrip.route('**/api/bali/professional-route/recent-unlocked**', route => route.fulfill({ status:404, json:{ detail:{ error:'professional_route_not_found' } } }));
    await staleTrip.route('**/api/bali/professional-route', async route => {
      const request = route.request().postDataJSON();
      staleTripRequests.push(request);
      if (request.trip_id === 'previous-account-trip') return route.fulfill({ status:403, json:{ detail:'This trip belongs to another account' } });
      const profile = request.trip_profile;
      return route.fulfill({ json:{
        ok:true, trip_id:'new-account-trip', professional_route_entitlement:false,
        professional_adjustments_remaining:0, profile,
        route:{ route_id:'R1', route_name:'First Bali', route_promise:'A clear first trip', recommendation_reason:'Matched to the trip.', days:5, preview_days:4, locked_days:1, unlocked:false,
          days_plan:Array.from({ length:5 }, (_, index) => ({ day:index+1, region_name:'Bali', theme:`Theme ${index+1}`, locked:index >= 4, places:index >= 4 ? [] : [{ name:`Place ${index+1}` }] })) }
      } });
    });
    await staleTrip.goto(base + '/bali.html#professional-planner', { waitUntil:'domcontentloaded' });
    await staleTrip.locator('#bali-professional-unlock').waitFor();
    check(staleTripRequests.length === 2, `Stale trip recovery made ${staleTripRequests.length} route requests instead of 2`);
    check(staleTripRequests[0].trip_id === 'previous-account-trip' && staleTripRequests[1].trip_id === '', 'Stale trip recovery did not retry as the current account');
    check(await staleTrip.evaluate(() => localStorage.getItem('wm_studio_professional_trip_id')) === 'new-account-trip', 'Stale trip id was not replaced');
    check(staleTripErrors.length === 0, `Stale trip recovery raised page errors: ${staleTripErrors.join('|')}`);
    await staleTripContext.close();

    for (const viewport of [
      { width:390, height:844 },
      { width:768, height:900 },
      { width:1440, height:1000 },
    ]) {
      const cancelContext = await browser.newContext({ viewport, serviceWorkers:'block' });
      const cancelPage = await cancelContext.newPage();
      let abandonCalled = false;
      await cancelPage.addInitScript(() => {
        const profile = { audience:'first', goals:['photo'], travel_style:'comfort', travellers:2, departure_date:'2026-10-01', return_date:'2026-10-06', days:5, currency:'CNY', budget_range:10000, pace:'balanced' };
        localStorage.setItem('wm_studio_lang', 'en');
        localStorage.setItem('wm_studio_token', 'cancel-test-token');
        localStorage.setItem('wm_studio_user', JSON.stringify({ id:'cancel-user', email:'cancel@example.test', name:'Cancel test' }));
        localStorage.setItem('wm_studio_trip_profile', JSON.stringify(profile));
        window.paypal = {
          Buttons(options) {
            window.__wmPaypalOptions = options;
            return {
              async render(selector) {
                const target = document.querySelector(selector);
                if (target) target.innerHTML = '<button type="button" data-mock-paypal>Mock PayPal checkout</button>';
              }
            };
          }
        };
      });
      await cancelPage.route('**/api/auth/me', route => route.fulfill({ json:{ id:'cancel-user', email:'cancel@example.test', name:'Cancel test' } }));
      await cancelPage.route('**/api/paypal/config', route => route.fulfill({ json:{ enabled:true, environment:'sandbox', client_id:'public-test-client', currency:'USD', amount:'1.49' } }));
      await cancelPage.route('**/api/bali/professional-route/recent-unlocked**', route => route.fulfill({ status:404, json:{ detail:'not found' } }));
      await cancelPage.route('**/api/bali/professional-route', route => route.fulfill({ json:{
        ok:true, trip_id:'cancel-trip', professional_route_entitlement:false,
        professional_adjustments_remaining:0,
        profile:{ audience:'first', goals:['photo'], travel_style:'comfort', travellers:2, departure_date:'2026-10-01', return_date:'2026-10-06', days:5, currency:'CNY', budget_range:10000, pace:'balanced' },
        route:{ route_id:'R1', route_name:'First Bali', route_promise:'A clear first trip', recommendation_reason:'Matched to the trip.', days:5, preview_days:3, locked_days:2, unlocked:false,
          days_plan:Array.from({ length:5 }, (_, index) => ({ day:index+1, region_name:'Bali', theme:`Theme ${index+1}`, locked:index >= 3, places:index >= 3 ? [] : [{ name:`Place ${index+1}` }] })) }
      } }));
      await cancelPage.route('**/api/paypal/orders/PAYPALCANCELUI123/abandon', route => {
        abandonCalled = true;
        return route.fulfill({ json:{ ok:true, abandoned:true } });
      });
      await cancelPage.goto(base + '/bali.html#professional-planner', { waitUntil:'domcontentloaded' });
      await cancelPage.locator('#bali-professional-unlock').waitFor();
      await cancelPage.locator('#bali-professional-unlock').click();
      await cancelPage.locator('[data-mock-paypal]').waitFor();
      await cancelPage.evaluate(async () => window.__wmPaypalOptions.onCancel({ orderID:'PAYPALCANCELUI123' }));
      await cancelPage.locator('#bali-professional-payment-status').getByText('Checkout closed', { exact:false }).waitFor();
      check(abandonCalled, `PayPal abandon endpoint not called at ${viewport.width}px`);
      check(await cancelPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `PayPal cancel overflow at ${viewport.width}px`);
      await cancelPage.screenshot({ path:path.join(artifactRoot, `paypal-cancel-${viewport.width}.png`), fullPage:true });
      await cancelContext.close();
    }

    const search = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await search.goto(base + '/search.html?q=Tirta%20Empul', { waitUntil: 'domcontentloaded' });
    await search.locator('#site-search-results li').first().waitFor();
    check(await search.locator('#site-search-results li').count() > 0, 'Search returned no results');
    check(await search.locator('.wm-global-auth-link').count() === 1, 'Search page has no global account entry');
    check(await search.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'Search mobile overflow');

    await search.goto(base + '/find-driver.html?package=batur-dawn-choice', { waitUntil: 'domcontentloaded' });
    await search.locator('#fd-places').waitFor({ state:'attached' });
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
    await unlocked.route('**/api/auth/me', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fulfill({ status:401, json:{ detail:'test token' } });
    });
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

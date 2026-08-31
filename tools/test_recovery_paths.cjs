const { chromium } = require('playwright');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function routePayload(profile) {
  return {
    ok: true,
    trip_id: 'recovery-professional-trip',
    professional_route_entitlement: false,
    professional_adjustments_remaining: 0,
    profile,
    route: {
      route_id: 'R1', route_name: 'First Bali', route_promise: 'A clear first trip',
      recommendation_reason: 'Matched to the trip.', days: 7, preview_days: 5,
      locked_days: 2, unlocked: false,
      days_plan: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1, region_name: 'Bali', theme: `Theme ${index + 1}`,
        locked: index >= 5,
        places: index >= 5 ? [] : [{ name: `Place ${index + 1}` }],
      })),
    },
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const professionalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const professional = await professionalContext.newPage();
    const professionalErrors = [];
    const professionalBodies = [];
    const profile = {
      audience: 'first', goals: ['photo'], travel_style: 'comfort', travellers: 2,
      departure_date: '2026-10-01', return_date: '2026-10-08', days: 7,
      currency: 'CNY', budget_range: 15000, budget_tier: 'comfort', pace: 'balanced',
    };
    professional.on('pageerror', error => professionalErrors.push(error.message));
    await professional.addInitScript(value => {
      localStorage.setItem('wm_studio_lang', 'en');
      localStorage.setItem('wm_studio_trip_profile', JSON.stringify(value));
    }, profile);
    await professional.route('**/api/paypal/config', route => route.fulfill({ json: { enabled: false } }));
    await professional.route('**/api/bali/professional-route**', async route => {
      if (route.request().url().includes('/recent-unlocked')) {
        return route.fulfill({ status: 404, json: { detail: { error: 'professional_route_not_found' } } });
      }
      const body = JSON.parse(route.request().postData() || '{}');
      professionalBodies.push(body);
      if (professionalBodies.length === 1) {
        return route.fulfill({ status: 503, json: { detail: 'temporary_route_failure' } });
      }
      return route.fulfill({ status: 200, json: routePayload(body.trip_profile) });
    });
    await professional.goto(`${base}/bali.html#professional-planner`, { waitUntil: 'domcontentloaded' });
    await professional.locator('#bali-professional-form-status.error').waitFor();
    check(await professional.locator('[name="budget_tier"][value="comfort"]').isChecked(), 'Professional route failure lost the budget tier');
    check(await professional.locator('[name="goal"][value="photo"]').isChecked(), 'Professional route failure lost priorities');
    await professional.locator('#bali-professional-form button[type="submit"]').click();
    await professional.locator('#bali-professional-unlock').waitFor();
    check(professionalBodies.length === 2, `Professional route retry made ${professionalBodies.length} POSTs`);
    check(professionalBodies[1].trip_profile.budget_tier === 'comfort', 'Professional route retry changed the saved profile');
    check(professionalErrors.length === 0, `Professional route recovery page errors: ${professionalErrors.join('|')}`);
    await professionalContext.close();

    const driverContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const driver = await driverContext.newPage();
    const driverErrors = [];
    const driverBodies = [];
    driver.on('pageerror', error => driverErrors.push(error.message));
    await driver.route('**/api/driver-request', async route => {
      driverBodies.push(JSON.parse(route.request().postData() || '{}'));
      if (driverBodies.length === 1) return route.fulfill({ status: 503, json: { detail: 'temporary_mail_failure' } });
      return route.fulfill({ status: 200, json: { ok: true, delivered: true } });
    });
    await driver.goto(`${base}/find-driver.html`, { waitUntil: 'domcontentloaded' });
    await driver.locator('#fd-first').fill('Recovery');
    await driver.locator('#fd-email').fill('recovery@example.test', { force: true });
    await driver.locator('#fd-start').fill('2026-10-01');
    await driver.locator('#fd-end').fill('2026-10-05');
    await driver.locator('#fd-consent').evaluate(element => { element.checked = true; element.dispatchEvent(new Event('change', { bubbles: true })); });
    await driver.locator('#fd-submit').click();
    await driver.locator('#fd-msg.err').waitFor();
    check(await driver.locator('#fd-first').inputValue() === 'Recovery', 'Driver request failure lost the name');
    check(await driver.locator('#fd-email').inputValue() === 'recovery@example.test', 'Driver request failure lost the email');
    check(await driver.locator('#fd-submit').isEnabled(), 'Driver request retry stayed disabled');
    await driver.locator('#fd-submit').click();
    await driver.locator('#fd-success-title').waitFor();
    check(driverBodies.length === 2, `Driver request retry made ${driverBodies.length} POSTs`);
    check(driverBodies[0].request_id === driverBodies[1].request_id, 'Driver request retry did not reuse its idempotency ID');
    check(driverErrors.length === 0, `Driver request recovery page errors: ${driverErrors.join('|')}`);
    await driverContext.close();

    const authContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const auth = await authContext.newPage();
    const authErrors = [];
    const chatHeaders = [];
    let authMeCalls = 0;
    auth.on('pageerror', error => authErrors.push(error.message));
    await auth.addInitScript(() => {
      localStorage.setItem('wm_studio_lang', 'en');
      localStorage.setItem('wm_studio_token', 'expired-token');
      localStorage.setItem('wm_studio_user', JSON.stringify({ id: 'old-user', email: 'old@example.test', name: 'Old user' }));
    });
    await auth.route('**/api/auth/me', route => {
      authMeCalls += 1;
      if (authMeCalls === 1) return route.fulfill({ status: 200, json: { id: 'old-user', email: 'old@example.test', name: 'Old user' } });
      return route.fulfill({ status: 401, json: { detail: 'expired' } });
    });
    await auth.route('**/api/auth/config', route => route.fulfill({ json: {} }));
    await auth.route('**/api/auth/login', route => route.fulfill({ json: { token: 'fresh-token', user: { id: 'new-user', email: 'new@example.test', name: 'New user' } } }));
    await auth.route('**/api/conversations**', route => route.fulfill({ json: [] }));
    await auth.route('**/api/quota', route => route.fulfill({ json: { free_left: 5, beans: 0 } }));
    await auth.route('**/api/chat/once', route => {
      chatHeaders.push(route.request().headers());
      if (chatHeaders.length === 1) return route.fulfill({ status: 401, json: { detail: 'expired' } });
      return route.fulfill({ status: 200, json: { text: 'Recovered after login' } });
    });
    await auth.goto(`${base}/ai-tool.html`, { waitUntil: 'domcontentloaded' });
    await auth.locator('#ws-input').fill('Continue my Bali plan');
    await auth.locator('#ws-send-btn').click();
    await auth.locator('#ws-li-email').waitFor();
    check(await auth.locator('.ws-auth-modal').count() === 1, 'Expired token opened more than one login modal');
    await auth.locator('#ws-li-email').fill('new@example.test');
    await auth.locator('#ws-li-pw').fill('sandbox-only-password');
    await auth.locator('#ws-li-btn').click();
    await auth.getByText('Recovered after login', { exact: true }).waitFor();
    check(chatHeaders.length === 2, `Protected AI request retried ${chatHeaders.length} times instead of 2`);
    check(chatHeaders[0].authorization === 'Bearer expired-token', 'Initial protected request did not carry the old bearer');
    check(chatHeaders[1].authorization === 'Bearer fresh-token', 'Recovered protected request did not carry the new bearer');
    check(await auth.locator('.ws-msg.user').count() === 1, 'Login recovery duplicated the interrupted AI request');
    check(authErrors.length === 0, `Auth recovery page errors: ${authErrors.join('|')}`);
    await authContext.close();

    console.log('Recovery checks passed: professional route, driver request and one-time auth resume');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

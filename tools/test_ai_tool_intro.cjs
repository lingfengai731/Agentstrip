const { chromium } = require('playwright');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';
const widths = [320, 390, 768, 1440];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/ai-tool.html`, { waitUntil: 'networkidle' });
      const intro = page.locator('.ws-tool-intro');
      await intro.waitFor({ state: 'attached' });
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        introVisible: Boolean(document.querySelector('.ws-tool-intro')?.getBoundingClientRect().height),
        introText: document.querySelector('.ws-tool-intro')?.textContent || '',
      }));
      check(result.overflow <= 1, `AI tool overflows at ${width}px: ${result.overflow}`);
      check(result.introVisible === (width >= 992), `AI product context visibility drifted at ${width}px`);
      check(result.introText.trim().length > 20, `AI product context missing at ${width}px`);
      check(errors.length === 0, `AI tool page errors at ${width}px: ${errors.join('; ')}`);
      await page.close();
    }
    const retryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const requestBodies = [];
    await retryPage.route('**/api/chat/once', async route => {
      requestBodies.push(JSON.parse(route.request().postData() || '{}'));
      if (requestBodies.length === 1) {
        await route.fulfill({ status: 503, json: { detail: 'temporary_test_failure' } });
      } else {
        await route.fulfill({ status: 200, json: { text: 'Recovered plan' } });
      }
    });
    await retryPage.goto(`${base}/ai-tool.html`, { waitUntil: 'domcontentloaded' });
    await retryPage.locator('#ws-input').fill('Plan one quiet Bali day');
    await retryPage.locator('#ws-send-btn').click();
    const retryButton = retryPage.locator('[data-retry-message]');
    await retryButton.waitFor();
    check(await retryPage.locator('.ws-msg.user').count() === 1, 'Failed AI request lost or duplicated the user message');
    await retryButton.click();
    await retryPage.getByText('Recovered plan', { exact: true }).waitFor();
    check(requestBodies.length === 2, `AI retry made ${requestBodies.length} requests instead of 2`);
    check(await retryPage.locator('.ws-msg.user').count() === 1, 'AI retry duplicated the visible user message');
    for (const body of requestBodies) {
      const matchingUserTurns = (body.messages || []).filter(message => message.role === 'user' && message.content === 'Plan one quiet Bali day');
      check(matchingUserTurns.length === 1, `AI request repeated the current prompt ${matchingUserTurns.length} times`);
    }
    await retryPage.close();
    console.log('AI tool product context checks passed at 320/390/768/1440');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

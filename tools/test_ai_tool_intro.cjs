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
      await intro.waitFor();
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        introVisible: Boolean(document.querySelector('.ws-tool-intro')?.getBoundingClientRect().height),
        introText: document.querySelector('.ws-tool-intro')?.textContent || '',
      }));
      check(result.overflow <= 1, `AI tool overflows at ${width}px: ${result.overflow}`);
      check(result.introVisible, `AI product context hidden at ${width}px`);
      check(result.introText.includes('Six specialist agents'), `AI product context missing at ${width}px`);
      check(errors.length === 0, `AI tool page errors at ${width}px: ${errors.join('; ')}`);
      await page.close();
    }
    console.log('AI tool product context checks passed at 320/390/768/1440');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

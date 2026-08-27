const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';
const captureDir = process.env.WM_CAPTURE_DIR || '';
const pages = [
  { path: '/index.html', selector: '.w3l-main-slider .banner-view' },
  { path: '/bali.html', selector: '.bali-hero' },
];
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
    for (const target of pages) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + target.path, { waitUntil: 'networkidle' });
        await page.locator(target.selector).first().waitFor();

        const result = await page.evaluate(selector => {
          const hero = document.querySelector(selector);
          const ambient = getComputedStyle(hero, '::after');
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            content: ambient.content,
            animationName: ambient.animationName,
            animationDuration: ambient.animationDuration,
            backgroundImage: ambient.backgroundImage,
            pointerEvents: ambient.pointerEvents,
            transform: ambient.transform,
          };
        }, target.selector);

        check(result.overflow <= 1, `${target.path} overflow at ${viewport.width}px: ${result.overflow}`);
        check(result.content !== 'none', `${target.path} ambient layer missing at ${viewport.width}px`);
        check(result.pointerEvents === 'none', `${target.path} ambient layer intercepts input`);
        if (viewport.width <= 767) {
          check(result.animationName === 'none', `${target.path} mobile ambient motion should be static`);
        } else {
          check(result.animationName === 'wm-ambient-drift', `${target.path} desktop ambient motion missing`);
          check(result.animationDuration === '12s', `${target.path} ambient motion duration drifted`);
          check(result.backgroundImage.includes('linear-gradient'), `${target.path} visible light sweep missing`);
          await page.waitForTimeout(700);
          const movedTransform = await page.locator(target.selector).first().evaluate(hero => getComputedStyle(hero, '::after').transform);
          check(movedTransform !== result.transform, `${target.path} ambient motion is not visibly advancing`);
        }
        check(errors.length === 0, `${target.path} page errors: ${errors.join('; ')}`);
        if (captureDir) {
          fs.mkdirSync(captureDir, { recursive: true });
          const slug = target.path.includes('bali') ? 'bali' : 'home';
          await page.screenshot({ path: path.join(captureDir, `${slug}-${viewport.width}.png`), fullPage: true });
        }
        await page.close();
      }

      const reduced = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      await reduced.goto(base + target.path, { waitUntil: 'networkidle' });
      const reducedAnimation = await reduced.locator(target.selector).first().evaluate(hero => getComputedStyle(hero, '::after').animationName);
      check(reducedAnimation === 'none', `${target.path} ignores prefers-reduced-motion`);
      await reduced.close();
    }

    console.log('Ambient hero checks passed: index and Bali at 320/390/768/1440 plus reduced motion');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

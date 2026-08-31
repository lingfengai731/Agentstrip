const { chromium } = require('playwright');

const base = process.env.WM_TEST_BASE || 'http://127.0.0.1:8765';
const pages = ['index.html','about.html','services.html','bali.html','ai-tool.html','find-driver.html','contact.html','search.html','shared.html'];
const viewports = [{width:390,height:844},{width:1440,height:900}];

function check(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const browser = await chromium.launch({headless:true});
  const matrix = [];
  try {
    for (const viewport of viewports) {
      for (const file of pages) {
        const page = await browser.newPage({viewport});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
          const request = route.request();
          if (request.method() !== 'GET' && request.method() !== 'HEAD') return route.abort();
          return route.continue();
        });
        await page.addInitScript(() => {
          window.__wmOpened = [];
          window.open = url => { window.__wmOpened.push(String(url || '')); return null; };
        });
        await page.goto(`${base}/${file}`, {waitUntil:'domcontentloaded'});
        await page.waitForTimeout(500);

        const result = await page.evaluate(() => {
          const visible = element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          };
          const accessibleName = element => (element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.textContent || '').trim();
          const buttons = [...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')].filter(visible);
          const unnamed = buttons.filter(button => !accessibleName(button)).map(button => button.outerHTML.slice(0,180));
          const links = [...document.querySelectorAll('a[href]')].filter(visible);
          const badLinks = links.filter(link => {
            const href = (link.getAttribute('href') || '').trim();
            if (!href || /^javascript:/i.test(href)) return true;
            if (href === '#') return true;
            if (href.startsWith('#')) return !document.getElementById(decodeURIComponent(href.slice(1)));
            return false;
          }).map(link => link.outerHTML.slice(0,180));
          return {buttons:buttons.length, links:links.length, unnamed, badLinks, overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
        });

        check(result.unnamed.length === 0, `${file} ${viewport.width}px has unnamed controls: ${result.unnamed.join(' | ')}`);
        check(result.badLinks.length === 0, `${file} ${viewport.width}px has inert links: ${result.badLinks.join(' | ')}`);
        check(result.overflow <= 1, `${file} ${viewport.width}px horizontal overflow: ${result.overflow}`);
        check(errors.length === 0, `${file} ${viewport.width}px page errors: ${errors.join(' | ')}`);

        const toggler = page.locator('.navbar-toggler:visible').first();
        if (await toggler.count()) {
          await toggler.click();
          await page.locator('.navbar-collapse.show').waitFor({state:'visible'});
          check(await page.locator('.navbar-collapse.show').count() === 1, `${file} mobile navigation toggle has no visible result`);
        }

        const language = page.locator('#langPicker:visible').first();
        if (await language.count()) {
          const options = await language.locator('option').count();
          check(options >= 5, `${file} language selector exposes only ${options} options`);
          await language.selectOption('zh');
          check(await language.inputValue() === 'zh', `${file} language selector did not retain Chinese`);
        }

        matrix.push({file,width:viewport.width,buttons:result.buttons,links:result.links});
        await page.close();
      }
    }
    const totalButtons = matrix.reduce((sum,item)=>sum+item.buttons,0);
    const totalLinks = matrix.reduce((sum,item)=>sum+item.links,0);
    console.log(`Public control checks passed: ${matrix.length} page/viewport cases, ${totalButtons} visible buttons and ${totalLinks} visible links inspected`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });

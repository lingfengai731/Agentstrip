// Opt-in official DevTools acceptance. No orders, requests, or persistent user edits.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.env.MINI_NATIVE_OUTPUT;
if (!output) { console.log('Native navigation: skipped (set MINI_NATIVE_OUTPUT and enable DevTools automation).'); process.exit(0); }
const automator = require('miniprogram-automator');
const endpoint = process.env.WECHAT_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9421';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Native operation timed out (20s)')), 20000); })]); }
  finally { clearTimeout(timer); }
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const mini = await bounded(automator.connect({ wsEndpoint: endpoint }));
  const report = { endpoint, capturedAt: new Date().toISOString(), pages: [], errors: [], interactions: [] };
  mini.on('exception', error => report.errors.push(String(error.message || error)));
  try {
    report.device = await mini.systemInfo();
    await mini.evaluate(() => {
      const app = getApp();
      app.__nativeReview = { data: app.globalData, key: app.privateStorageKey, mode: wx.getStorageSync('wm_chat_mode') };
      app.globalData = { ...app.globalData, token: '', user: null, preferences: {}, professionalRoute: null, currentDest: 'bali', customDestName: '' };
      app.privateStorageKey = name => '__native_review_unused__' + name;
    });
    async function capture(lang, name, page, selectors) {
      const controls = [];
      for (const selector of selectors) {
        const elements = await page.$$(selector);
        assert(elements.length, `${lang}/${name}: missing ${selector}`);
        for (const size of await Promise.all(elements.map(element => element.size()))) {
          controls.push({ selector, ...size });
          assert(size.height >= 43.9, `${lang}/${name}: ${selector} height ${size.height} <44px`);
        }
      }
      const file = path.join(output, `${lang}-${name}.png`);
      await bounded(mini.screenshot({ path: file }));
      report.pages.push({ lang, name, route: page.path, controls, file });
    }
    const languages = process.env.MINI_NATIVE_LANGUAGES ? process.env.MINI_NATIVE_LANGUAGES.split(',') : ['zh', 'en', 'ja', 'ko', 'id'];
    assert(languages.every(lang => ['zh', 'en', 'ja', 'ko', 'id'].includes(lang)), 'Unsupported acceptance language');
    for (const lang of languages) {
      await mini.evaluate(language => { getApp().globalData.currentLang = language; }, lang);
      let page = await mini.reLaunch('/pages/index/index');
      await mini.evaluate(() => getApp().updateTabBarLanguage());
      await pause(300);
      await capture(lang, 'home', page, []);
      page = await mini.reLaunch('/pages/chat/chat');
      await page.setData({ messages: [], inputText: '', canSend: false, retryText: '', saveError: '' });
      await pause(250);
      await capture(lang, 'chat', page, ['.mode-btn', '.sugg-chip', '.send-btn']);
      const modes = await page.$$('.mode-btn');
      await modes[1].tap();
      assert.equal(await page.data('mode'), 'pro');
      await modes[0].tap();
      assert.equal(await page.data('mode'), 'fast');
      report.interactions.push(`${lang}: chat fast/pro/fast`);
      page = await mini.reLaunch('/pages/compare/compare');
      await pause(250);
      await capture(lang, 'prices-hotels', page, ['.sub-tab', '.chip', '.picker-display', '.search-btn']);
      const tabs = await page.$$('.sub-tab');
      await tabs[1].tap();
      assert.equal(await page.data('tab'), 'flights');
      if (lang === 'en') {
        await page.setData({ flightAdultsIdx: 0 });
        let labels = await Promise.all((await page.$$('.picker-display')).map(element => element.text()));
        assert(labels.some(text => text.trim() === '1 person'), 'English singular traveller label');
        await page.setData({ flightAdultsIdx: 1 });
        labels = await Promise.all((await page.$$('.picker-display')).map(element => element.text()));
        assert(labels.some(text => text.trim() === '2 people'), 'English plural traveller label');
        await page.setData({ flightAdultsIdx: 0 });
      }
      await capture(lang, 'prices-flights', page, ['.sub-tab', '.chip', '.picker-display', '.trip-btn', '.search-btn']);
      const trips = await page.$$('.trip-btn');
      await trips[1].tap();
      assert.equal(await page.data('flightTripType'), 'oneway');
      await trips[0].tap();
      assert.equal(await page.data('flightTripType'), 'round');
      await tabs[0].tap();
      assert.equal(await page.data('tab'), 'hotels');
      report.interactions.push(`${lang}: hotels/flights/hotels; round/oneway/round`);
    }
    assert.equal(report.errors.length, 0, 'Native runtime exceptions');
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    await bounded(mini.evaluate(() => {
      const app = getApp();
      const snapshot = app.__nativeReview;
      if (!snapshot) return;
      app.globalData = snapshot.data;
      app.privateStorageKey = snapshot.key;
      if (snapshot.mode) wx.setStorageSync('wm_chat_mode', snapshot.mode);
      else wx.removeStorageSync('wm_chat_mode');
      delete app.__nativeReview;
      app.updateTabBarLanguage();
    })).catch(error => { report.restoreError = error.message; });
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    mini.disconnect();
  }
  assert(!report.restoreError, report.restoreError);
  console.log(JSON.stringify({ pages: report.pages.length, interactions: report.interactions, errors: report.errors, output }));
})().catch(error => { console.error(error); process.exitCode = 1; });

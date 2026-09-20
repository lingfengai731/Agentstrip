const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const copy = require('../miniprogram/pages/planner/copy.js');
const source = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/planner/planner.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/planner/planner.wxml'), 'utf8');
(async () => {
  for (const lang of ['zh', 'en', 'ja', 'ko', 'id']) {
    assert.deepEqual(Object.keys(copy[lang]).sort(), Object.keys(copy.zh).sort());
    for (const [, key] of template.matchAll(/copy\.(\w+)/g)) assert.ok(copy[lang][key], `${lang}.${key}`);
    let page, sent;
    const app = { globalData: { currentLang: lang }, privateStorageKey: name => name + '_guest', setProfessionalRoute() {} };
    vm.runInNewContext(source, {
      Page(value) { page = value; }, getApp: () => app, Date, setTimeout() {},
      require: name => name.includes('network-check') ? require('../miniprogram/utils/network-check.js') : name === './copy.js' ? copy : { async createProfessionalRoute(profile, route, language) { sent = { profile, language }; return {}; } },
      wx: { getStorageSync() { return {}; }, setNavigationBarTitle() {}, showToast() {} },
    });
    page.setData = update => Object.assign(page.data, update);
    page.onShow();
    assert.equal(page.data.copy.submit, copy[lang].submit);
    assert.equal(page.data.goalOptions[0].label, copy[lang].local);
    page.data.departureDate = '2026-10-10'; page.data.returnDate = '2026-10-09';
    await page.submit();
    assert.equal(sent, undefined);
    assert.equal(page.data.error, copy[lang].invalidDates);
    page.data.returnDate = '2026-10-17';
    await page.submit();
    assert.equal(sent.language, lang);
    assert.equal(sent.profile.budget_range, '10000-20000');
    assert.equal(sent.profile.pace, 'balanced');
    assert.deepEqual(Array.from(sent.profile.goals), ['local', 'photo']);
    app.globalData.currentLang = lang === 'zh' ? 'en' : 'zh';
    page.onShow();
    assert.equal(page.data.departureDate, '2026-10-10');
    assert.equal(page.data.goalOptions[0].selected, true);
  }
  console.log('Planner: five-language template keys, errors, API IDs, currency and input preservation passed');
})().catch(error => { console.error(error); process.exitCode = 1; });

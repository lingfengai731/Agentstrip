const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/language/language.js'), 'utf8');
for (const lang of ['zh', 'en', 'ja', 'ko', 'id']) {
  let page, navTitle, toast, refreshed = 0;
  const app = { globalData: { currentLang: lang }, setLang(value) { this.globalData.currentLang = value; }, updateTabBarLanguage() { refreshed++; } };
  vm.runInNewContext(source, {
    Page(value) { page = value; }, getApp: () => app, require: () => ({ LANGS: [] }),
    setTimeout(callback) { callback(); },
    wx: { setNavigationBarTitle({ title }) { navTitle = title; }, showToast({ title }) { toast = title; }, navigateBack({ success }) { success(); } },
  });
  page.setData = update => Object.assign(page.data, update);
  page.onShow();
  assert.equal(page.data.current, lang);
  assert.equal(navTitle, page.data.copy.title);
  assert.ok(page.data.copy.subtitle.length > 10);
  if (lang !== 'zh') assert.notEqual(navTitle, '选择你的语言');
  page.choose({ currentTarget: { dataset: { id: lang } } });
  assert.equal(toast, page.data.copy.updated);
  assert.equal(refreshed, 1, 'returning to a tab must refresh native labels');
  page.choose({ currentTarget: { dataset: { id: 'unknown' } } });
  assert.equal(app.globalData.currentLang, lang, 'invalid language must not enter persistent state');
}
console.log('Language page: all five locales, navigation titles, feedback and return callbacks passed');

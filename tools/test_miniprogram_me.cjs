const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const copy = require('../miniprogram/pages/me/copy.js');
const source = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/me/me.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/me/me.wxml'), 'utf8');
assert.ok(template.indexOf('bindtap="openLanguage"') < template.indexOf('wx:if'), 'language must be outside authentication gates');
for (const lang of Object.keys(copy)) {
  let page, modal, clipboard, toast, destination, cleared = 0;
  const app = { globalData: { currentLang: lang, token: '', user: null }, updateTabBarLanguage() {}, clearAuth() { cleared++; } };
  vm.runInNewContext(source, {
    require: name => name === './copy.js' ? copy : { LANGS: Object.keys(copy).map(id => ({ id, flag: '', label: id })) },
    getApp: () => app, Page(value) { page = value; },
    wx: { setNavigationBarTitle() {}, navigateTo({url}) { destination = url; }, showModal(value) { modal = value; }, setClipboardData(value) { clipboard = value; }, showToast(value) { toast = value; } },
  });
  page.setData = update => Object.assign(page.data, update);
  page.onShow();
  assert.equal(page.data.loggedIn, false);
  assert.equal(page.data.copy.title, copy[lang].title);
  for (const [, key] of template.matchAll(/copy\.(\w+)/g)) assert.ok(copy[lang][key]);
  page.openLanguage(); assert.equal(destination, '/pages/language/language');
  page.doLogout(); modal.success({confirm:false}); assert.equal(cleared, 0);
  modal.success({confirm:true}); assert.equal(cleared, 1);
  assert.equal(toast.title, copy[lang].loggedOut);
  page.openH5(); assert.equal(clipboard.data, 'https://wandermind.cc');
  clipboard.fail(); assert.equal(toast.title, copy[lang].copyFailed);
  clipboard.success(); assert.equal(toast.title, copy[lang].copied);
}
console.log('Me: five languages, guest language access, logout confirmation and clipboard callbacks passed');

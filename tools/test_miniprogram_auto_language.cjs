const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../miniprogram/app.js'), 'utf8');
function launch(locale, saved, legacy = false, fail = false) {
  let app;
  const storage = saved ? { wm_lang: saved } : {};
  const wx = {
    getStorageSync: key => storage[key], setStorageSync: (key, value) => { storage[key] = value; },
    getAppBaseInfo() { if (legacy || fail) throw Error('unavailable'); return { language: locale }; },
    getSystemInfoSync() { if (fail) throw Error('unavailable'); return { language: locale }; },
    getDeviceInfo: () => ({}), getWindowInfo: () => ({}), setTabBarItem() {},
  };
  vm.runInNewContext(source, { App(value) { app = value; }, wx, setTimeout(fn) { fn(); } });
  app.onLaunch();
  return { app, storage };
}
for (const [locale, expected] of [['id','id'], ['id_ID','id'], ['in-ID','id'], ['en_US','en'], ['ja-JP','ja'], ['ko','ko'], ['zh_TW','zh'], ['fr','zh'], [undefined,'zh']]) {
  const {app, storage} = launch(locale);
  assert.equal(app.globalData.currentLang, expected);
  assert.equal(storage.wm_lang, undefined, 'auto-detection must not override future device language');
}
assert.equal(launch('id','en').app.globalData.currentLang, 'en');
assert.equal(launch('id','invalid').app.globalData.currentLang, 'id');
assert.equal(launch('id',undefined,true).app.globalData.currentLang, 'id');
assert.equal(launch('id',undefined,false,true).app.globalData.currentLang, 'zh');
const chosen = launch('id');
chosen.app.setLang('ja');
assert.equal(chosen.storage.wm_lang, 'ja');
chosen.app.setLang('invalid');
assert.equal(chosen.storage.wm_lang, 'ja');
assert.equal(launch('ko', chosen.storage.wm_lang).app.globalData.currentLang, 'ja');
console.log('Auto language: locale mapping, manual precedence, persistence, legacy fallback and errors passed');

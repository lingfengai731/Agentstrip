const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../miniprogram');
function pageFor(name, lang, api = {}) {
  let page;
  const copy = require(path.join(root, 'pages', name, 'copy.js'));
  const app = { globalData: { currentLang: lang, currentDest:'bali', token:'', user:null }, updateTabBarLanguage() {}, setToken() {}, setPrefs() {}, resumePendingRoute() {} };
  vm.runInNewContext(fs.readFileSync(path.join(root,'pages',name,`${name}.js`),'utf8'), {
    Page(value) { page=value; }, getApp:()=>app,
    require: source => source === './copy.js' ? copy : source.includes('const.js') ? require(path.join(root,'utils/const.js')) : api,
    wx: {setNavigationBarTitle(){},showToast(){}},
    setTimeout(){},setInterval(){},clearInterval(){},
  });
  page.setData = update => Object.assign(page.data,update);
  return {page,app,copy};
}
(async () => {
  for (const name of ['index','itinerary']) {
    const template=fs.readFileSync(path.join(root,'pages',name,`${name}.wxml`),'utf8');
    for (const lang of ['zh','en','ja','ko','id']) {
      const {page,copy}=pageFor(name,lang);
      assert.deepEqual(Object.keys(copy[lang]).sort(),Object.keys(copy.zh).sort());
      for (const [,key] of template.matchAll(/copy\.(\w+)/g)) assert.ok(copy[lang][key],`${name}/${lang}/${key}`);
      if (name === 'index') {
        page._refreshAuthState();
        assert.equal(page.data.destinations.length,1,'only Bali may be public before local research is ready');
        assert.equal(page.data.destinations[0].name,copy[lang].bali);
        assert.equal(page.data.showFutureDestinations,false);
        page.data.email=''; await page.doAuth(); assert.equal(page.data.authError,copy[lang].required);
        page.data.email='not-email'; await page.sendCode(); assert.equal(page.data.authError,copy[lang].validEmail);
        assert.ok(copy[lang].linkHint.length>30);
      }
    }
  }
  let count=0, resolveLogin;
  const {page}=pageFor('index','en',{login:()=>{count++;return new Promise(resolve=>{resolveLogin=resolve;});},getPrefs:async()=>({})});
  page._refreshAuthState(); page.data.email='test@example.test'; page.data.password='test-only';
  const first=page.doAuth(); await page.doAuth();
  assert.equal(count,1,'duplicate taps must issue only one login');
  page.switchAuth({currentTarget:{dataset:{mode:'register'}}}); assert.equal(page.data.authMode,'login');
  resolveLogin({token:'test',user:{id:1}}); await first;
  assert.equal(page.data.authBusy,false); assert.equal(page.data.password,'');
  let resolveMe;
  const session=pageFor('index','en',{me:()=>new Promise(r=>resolveMe=r)});
  session.app.globalData.token='old-account';
  let restored=false;session.app.setToken=()=>{restored=true;};
  const check=session.page._validateSession();
  session.app.globalData.token='new-account';resolveMe({id:1});await check;
  assert.equal(restored,false,'late session response must not overwrite another account');
  console.log('Entry pages: five-language bindings, errors, duplicate auth and stale-session protection passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function planner(storage, userId = 1) {
  let page;
  let calls = 0;
  const app = { globalData: { user: { id: userId }, currentLang: 'zh' }, setProfessionalRoute() {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/planner/planner.js'), 'utf8'), {
    Page(value) { page = value; }, getApp: () => app,
    require: name => name === './copy.js' ? require('../miniprogram/pages/planner/copy.js') : ({ async createProfessionalRoute() { calls++; throw new Error('offline'); } }),
    wx: { getStorageSync: key => storage[key], setStorageSync: (key, value) => { storage[key] = JSON.parse(JSON.stringify(value)); }, showToast() {} },
    setTimeout() {}, Date,
  });
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = update => Object.assign(page.data, update);
  page.onLoad({ routeId: 'R2' });
  return { page, calls: () => calls };
}

(async () => {
  let application;
  const authStorage = { wm_professional_route: { route: { unlocked: true } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/app.js'), 'utf8'), {
    App(value) { application = value; },
    wx: { setStorageSync: (key, value) => { authStorage[key] = value; }, removeStorageSync: key => { delete authStorage[key]; } },
  });
  application.globalData.professionalRoute = authStorage.wm_professional_route;
  application.clearAuth();
  assert.equal(application.globalData.professionalRoute, null, 'logout must clear the private route');
  assert.equal(authStorage.wm_professional_route, undefined, 'logout must clear persistent route cache');

  const storage = {};
  const first = planner(storage);
  first.page.onDeparture({ detail: { value: '2026-10-10' } });
  first.page.onReturn({ detail: { value: '2026-10-09' } });
  await first.page.submit();
  assert.equal(first.calls(), 0, 'reversed dates must never reach the route API');
  assert.equal(first.page.data.days, 0, 'invalid dates must clear the stale duration');
  first.page.onReturn({ detail: { value: '2026-10-10' } });
  await first.page.submit();
  assert.equal(first.calls(), 0, 'equal dates must be rejected');
  first.page.onReturn({ detail: { value: '2026-10-17' } });
  first.page.changePeople({ currentTarget: { dataset: { delta: 1 } } });
  first.page.setChoice({ currentTarget: { dataset: { field: 'pace', value: 'relaxed' } } });
  await first.page.submit();
  assert.equal(first.calls(), 1);
  assert.equal(first.page.data.busy, false, 'failed request must release the submit button');
  assert.equal(first.page.data.error, 'offline');
  const restored = planner(storage).page;
  assert.equal(restored.data.departureDate, '2026-10-10', 'reopening must restore dates');
  assert.equal(restored.data.days, 7);
  assert.equal(restored.data.travellers, 3);
  assert.equal(restored.data.pace, 'relaxed');
  assert.equal(restored.data.routeId, 'R2');
  assert.equal(planner(storage, 2).page.data.travellers, 2, 'another account must not inherit the draft');
  let itinerary;
  let resolveRoute;
  const routeApp = { globalData: { token: '', currentLang: 'zh', professionalRoute: { private: true } }, setProfessionalRoute(value) { this.globalData.professionalRoute = value; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/itinerary/itinerary.js'), 'utf8'), {
    Page(value) { itinerary = value; }, getApp: () => routeApp,
    require: name => name === './copy.js' ? require('../miniprogram/pages/itinerary/copy.js') : ({
      baliRouteData: async () => ({ routes: ['R1', 'R2'].map(id => ({ id, name: { zh: `中文${id}`, en: `English ${id}` }, free_outline: [] })) }),
      recentUnlockedProfessionalRoute: () => new Promise(resolve => { resolveRoute = resolve; }),
    }),
  });
  itinerary.setData = update => Object.assign(itinerary.data, update);
  await itinerary.loadProfessionalRoute();
  assert.equal(itinerary.data.professional, null, 'signed-out route page must not show private cache');
  await itinerary.loadRoutes();
  itinerary.selectRoute({ currentTarget: { dataset: { id: 'R2' } } });
  routeApp.globalData.currentLang = 'en';
  await itinerary.loadRoutes();
  assert.equal(itinerary.data.selected.name, 'English R2', 'language changes must refresh cached route labels and retain selection');
  routeApp.globalData.token = 'old-session';
  const pending = itinerary.loadProfessionalRoute();
  routeApp.globalData.token = 'new-session';
  routeApp.globalData.professionalRoute = null;
  resolveRoute({ oldAccount: true });
  await pending;
  assert.equal(routeApp.globalData.professionalRoute, null, 'late response from old account must not repopulate cache');
  console.log('Mini-program recovery: date, draft, account isolation and route-language behaviors passed');
})().catch(error => { console.error(error); process.exitCode = 1; });

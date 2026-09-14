const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

async function run() {
  let request, api, deadline, aborted = 0, relaunches = 0;
  const app = {globalData: {token:'synthetic', currentLang:'zh', apiBase:'https://example.invalid'}, rememberCurrentRoute(){}, clearAuth(){this.globalData.token='';}};
  const context = {getApp:()=>app, module:{exports:{}}, require:()=>require('../miniprogram/utils/error-copy.js'),
    setTimeout(fn){deadline=fn;return 1;}, clearTimeout(){},
    wx:{request(options){request=options;return {abort(){aborted++;options.fail({errMsg:'abort'});}};},reLaunch(){relaunches++;},showToast(){}}};
  vm.runInNewContext(source('miniprogram/utils/api.js'),context);api=context.module.exports;
  const pending=api.createProfessionalRoute({days:7},'R1').then(()=>null,e=>e);
  assert.equal(request.timeout,15000,'professional matching must have a bounded 15s wait');
  assert.equal(typeof deadline,'function','silent platform callbacks must still settle');
  deadline();const error=await pending;
  assert.match(error.message,/超时/);assert.equal(aborted,1);
  request.success({statusCode:401,data:{}});assert.equal(relaunches,0,'late response must not clear a newer session');
  app.globalData.token='other';
  const changed=api.createProfessionalRoute({days:7}).catch(e=>e);
  app.globalData.token='new';request.success({statusCode:200,data:{}});
  assert.match((await changed).message,/切换/);
  const one=api.baliFood(),two=api.baliFood();
  assert.equal(one,two,'concurrent public catalog requests must coalesce');
  request.success({statusCode:200,data:{restaurants:[]}});await one;
  assert.equal(api.baliFood(),one,'navigation must reuse a successful public catalog');
  const failedCatalog=api.baliExtensions().catch(e=>e);request.fail({errMsg:'offline'});await failedCatalog;
  const retryCatalog=api.baliExtensions();request.success({statusCode:200,data:{extensions:[]}});await retryCatalog;

  let page, resolve;
  const cached={trip_id:'new-preview',route:{unlocked:false}};
  const routeApp={globalData:{token:'synthetic',currentLang:'zh',professionalRoute:cached},privateStorageKey:n=>n+'_qa',setProfessionalRoute(p){this.globalData.professionalRoute=p;}};
  vm.runInNewContext(source('miniprogram/pages/itinerary/itinerary.js'),{getApp:()=>routeApp,Page:p=>page=p,wx:{},
    require:n=>n==='./copy.js'?require('../miniprogram/pages/itinerary/copy.js'):{recentUnlockedProfessionalRoute:()=>new Promise(r=>resolve=r)}});
  page.setData=p=>Object.assign(page.data,p);
  const load=page.loadProfessionalRoute();resolve({trip_id:'old-paid-trip',route:{unlocked:true}});await load;
  assert.equal(routeApp.globalData.professionalRoute.trip_id,'new-preview','old unlocked route must not replace a new match');
  const load2=page.loadProfessionalRoute();routeApp.globalData.professionalRoute={trip_id:'newer-preview',route:{unlocked:false}};
  resolve({trip_id:'new-preview',route:{unlocked:true}});await load2;
  assert.equal(routeApp.globalData.professionalRoute.trip_id,'newer-preview','in-flight response must not overwrite another match');
  const load3=page.loadProfessionalRoute();resolve({trip_id:'newer-preview',route:{unlocked:true}});await load3;
  assert.equal(routeApp.globalData.professionalRoute.route.unlocked,true,'same-trip paid refresh must still work');

  assert.match(source('miniprogram/pages/me/me.wxml'),/bindtap="openFood"/);
  assert.ok(source('miniprogram/pages/me/me.wxml').indexOf('bindtap="openFood"')<source('miniprogram/pages/me/me.wxml').indexOf('bindtap="doLogout"'));
  for(const lang of ['zh','en','ja','ko','id'])assert.ok(require('../miniprogram/pages/me/copy.js')[lang].food);
  for(const lang of ['zh','en','ja','ko','id']){
    let planner,finish,switched;
    const stored={},plannerApp={globalData:{currentLang:lang},privateStorageKey:n=>n+'_qa',setProfessionalRoute(p){this.result=p;}};
    vm.runInNewContext(source('miniprogram/pages/planner/planner.js'),{
      Page:p=>planner=p,getApp:()=>plannerApp,require:n=>n==='./copy.js'?require('../miniprogram/pages/planner/copy.js'):{createProfessionalRoute:()=>new Promise(r=>finish=r)},
      wx:{getStorageSync:k=>stored[k],setStorageSync:(k,v)=>stored[k]=v,setNavigationBarTitle(){},showToast(){},switchTab:o=>switched=o.url},Date,setTimeout(){}
    });
    planner.setData=p=>Object.assign(planner.data,p);planner.onLoad({routeId:'R1'});planner.onShow();
    const matching=planner.submit();assert.equal(planner.data.busy,true);
    finish({trip_id:'fresh',route:{unlocked:false}});await matching;
    assert.equal(switched,'/pages/itinerary/itinerary');assert.equal(planner.data.busy,false);assert.equal(plannerApp.result.trip_id,'fresh');
    planner.setData({error:'retained error'});planner.onShow();assert.equal(planner.data.error,'retained error','onShow must not hide failure feedback');
  }
  console.log('Match recovery: bounded/silent timeout, abort, late401, account switch, preview isolation, same-trip unlock, Me dining placement/5langs passed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});

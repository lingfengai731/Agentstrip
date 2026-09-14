// Local mocked API + synthetic simulator identity only; never sends driver requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(!process.env.WM_PRO_DRIVER_OUTPUT){console.log('Professional/driver native QA skipped: requires explicit local simulator output.');process.exit(0);}
const automator=require(process.env.WM_MINI_AUTOMATOR || 'miniprogram-automator');
const data=path.resolve(__dirname,'../wandermind-studio/frontend/assets/data'),catalogs={};
for(const name of ['bali-travel-data','bali-extensions','bali-food'])catalogs[name]=JSON.parse(fs.readFileSync(path.join(data,name+'.json'),'utf8'));
const engine=require('../miniprogram/utils/bali-itinerary.js'),r=catalogs['bali-travel-data'].routes.find(r=>r.id==='R1');
const restaurant=catalogs['bali-food'].restaurants.find(r=>r.published && r.extensionIds.includes('penida-west') && r.suitableDayparts.includes('lunch'));
const plan=engine.append({route_id:'R1',days:r.free_outline.map(d=>({region_id:d.region_id,theme:d.theme,place_ids:d.suggested_poi_ids}))},catalogs['bali-extensions'],'penida-west');
plan.days[8].food_stops=[{restaurant_id:restaurant.id,meal:'lunch'}];
const out=process.env.WM_PRO_DRIVER_OUTPUT,report={scope:'Synthetic local identity and intercepted API; no production request, entitlement, order, payment or driver email',checks:[],errors:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let mini;
async function ready(page,key,predicate){for(let i=0;i<35;i++){const value=await page.data(key);if(predicate(value))return value;await wait(200);}throw Error('Native state timeout: '+key);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});console.log('Native QA: connecting');mini=await automator.connect({wsEndpoint:process.env.WM_MINI_WS || 'ws://127.0.0.1:9421'});
 mini.on('exception',e=>report.errors.push(String(e.message || e)));
 try {
  console.log('Native QA: intercepting local requests');await mini.evaluate(function(catalogs,plan){
   const app=getApp();app.__pdQASnapshot={...app.globalData};app.__pdQARequest=wx.request;app.__pdQAModal=wx.showModal;
   app.globalData={...app.globalData,user:{id:'nativeqa_pro_driver',name:'Local QA'},token:'local-qa-not-a-server-token',currentLang:'en',currentDest:'bali',professionalRoute:null};
   const names=['wm_public_route_plans','wm_planner_draft','wm_driver_draft','wm_driver_request_id'];
   app.__pdQAStorage=names.map(n=>{const key=app.privateStorageKey(n);return {key,exists:wx.getStorageInfoSync().keys.includes(key),value:wx.getStorageSync(key)};});
   for(const key of ['wm_professional_route'])app.__pdQAStorage.push({key,exists:wx.getStorageInfoSync().keys.includes(key),value:wx.getStorageSync(key)});
   app.__pdQAStorage.forEach(i=>wx.removeStorageSync(i.key));wx.setStorageSync(app.privateStorageKey('wm_public_route_plans'),{R1:plan});
   app.__pdQA={calls:[],blocked:[],mode:'fail',confirm:false};
   wx.showModal=options=>{app.__pdQA.modal=options.content;options.success({confirm:app.__pdQA.confirm,cancel:!app.__pdQA.confirm});};
   wx.request=options=>{
    const url=String(options.url || ''),name=Object.keys(catalogs).find(n=>url.includes('/'+n+'.json'));
    const finish=(code,data)=>Promise.resolve().then(()=>{options.success?.({statusCode:code,data});options.complete?.();});
    if(name)finish(200,catalogs[name]);
    else if(url.endsWith('/api/bali/professional-route') && options.method==='POST'){
     app.__pdQA.calls.push(options.data);
     if(app.__pdQA.mode==='fail')finish(503,{detail:'local QA simulated failure'});
     else {const profile=options.data.trip_profile;const days=Array.from({length:profile.days},(_,i)=>({day:i+1,theme:i===profile.days-1?'Penida West':'Bali day',region_name:i===profile.days-1?'Nusa Penida':'Bali',locked:i>=5,places:i>=5?[]:[{id:'sanur_beach',name:'Sanur Beach'}],restaurants:[]}));
      app.__pdQA.fullDays=JSON.parse(JSON.stringify(days));app.__pdQA.fullDays.forEach(d=>{d.locked=false;});
      for(const stop of profile.dining_stops || []){const item=catalogs['bali-food'].restaurants.find(i=>i.id===stop.restaurant_id);app.__pdQA.fullDays[stop.day-1].restaurants.push({id:item.id,name:item.name});}
      finish(200,{route:{route_id:options.data.route_id,route_name:'R1 · Local QA',unlocked:false,days_plan:days},profile,professional_adjustments_remaining:3});}
    }else if(url.includes('/api/driver-requests/mine'))finish(200,{requests:[]});
    else if(url.includes('/recent-unlocked'))finish(404,{detail:'not_found'});
    else {app.__pdQA.blocked.push({url,method:options.method || 'GET'});Promise.resolve().then(()=>options.fail?.({errMsg:'Blocked by local QA: no network permitted'}));}
    return {abort(){}};
   };
  },catalogs,plan);
  console.log('Native QA: opening planner');await mini.reLaunch('/pages/itinerary/itinerary');await wait(600);
  await mini.navigateTo('/pages/planner/planner?routeId=R1');await wait(600);let page=await mini.currentPage();assert.equal(page.path,'pages/planner/planner');
  await page.callMethod('onDeparture',{detail:{value:'2026-10-01'}});await page.callMethod('onReturn',{detail:{value:'2026-10-08'}});
  console.log('Native QA: dispatching submit');await mini.pageScrollTo(1600);await page.waitFor(350);
  const submitButton=await page.$('.submit');report.inputMechanism='Official SDK native WXML tap event dispatch (not physical-device touch)';
  await submitButton.trigger('tap');
  for(let i=0;i<35;i++){if(await mini.evaluate(function(){return !!getApp().__pdQA.modal;}))break;await wait(200);}
  await ready(page,'busy',v=>v===false);
  const cancel=await mini.evaluate(function(){return getApp().__pdQA;});report.cancelProbe={qa:cancel,page:await page.data()};assert.equal(cancel.calls.length,0);assert.ok(cancel.modal && cancel.modal.includes(restaurant.name),'Relocation modal missing: '+JSON.stringify(report.cancelProbe));assert.equal(await page.data('days'),7);report.checks.push({case:'cancel dining relocation',requests:0,days:7,inputsRetained:true});
  await mini.evaluate(function(){getApp().__pdQA.confirm=true;});await (await page.$('.submit')).trigger('tap');await ready(page,'error',v=>!!v);assert.equal(await page.data('departureDate'),'2026-10-01');report.checks.push({case:'mock503',errorShown:true,inputRetained:true});
  await mini.evaluate(function(){getApp().__pdQA.mode='success';});await (await page.$('.submit')).trigger('tap');await wait(1000);
  const received=await mini.evaluate(function(){return {payload:getApp().globalData.professionalRoute,qa:getApp().__pdQA};});
  assert.deepEqual(received.qa.calls[1].trip_profile.extension_ids,['penida-west']);assert.equal(received.qa.calls[1].trip_profile.dining_stops[0].day,7);assert.equal(received.qa.calls.length,2);
  assert.equal(received.payload.route.days_plan.filter(d=>d.locked).length,2);report.checks.push({case:'retry matches route',modules:['penida-west'],diningDay:7,previewOpen:5,previewLocked:2,requests:2});
  report.screenshots='Not captured in callback-only lane; separate native visual evidence required';
  // Synthetic full route enables draft-only handoff; not proof of paid unlock.
  await mini.evaluate(function(){const app=getApp();app.globalData.professionalRoute={...app.globalData.professionalRoute,route:{...app.globalData.professionalRoute.route,unlocked:true,days_plan:app.__pdQA.fullDays}};});
  console.log('Native QA: checking private driver drafts');page=await mini.navigateTo('/pages/driver/driver');await page.waitFor(600);await ready(page,'loadingRequests',v=>v===false);
  for(const driverId of ['dicky','gede']){
   await (await page.$('.driver-card[data-id="'+driverId+'"]')).tap();await wait(200);
   const draft=await mini.evaluate(function(){return wx.getStorageSync(getApp().privateStorageKey('wm_driver_draft'));});
   assert.equal(draft.driverId,driverId);assert.equal(draft.routeId,'R1');assert.equal(draft.startDate,'2026-10-01');assert.equal(draft.endDate,'2026-10-08');assert.equal(draft.people,2);assert.ok(draft.budget);assert.ok(draft.attractions.includes(restaurant.name));assert.ok(draft.attractions.includes('Penida'));
   report.checks.push({case:'private driver draft',driverId,routeId:draft.routeId,people:draft.people,dateRange:[draft.startDate,draft.endDate],budget:draft.budget,hasDining:true,hasIsland:true,submitted:false});
  }
  const qa=await mini.evaluate(function(){return getApp().__pdQA;});assert.equal(qa.blocked.length,0);report.liveNetworkRequests=0;
 }catch(error){report.failure=error.message;throw error;}finally{
  await mini.evaluate(function(){const app=getApp();if(app.__pdQAStorage){app.__pdQAStorage.forEach(i=>{if(i.exists)wx.setStorageSync(i.key,i.value);else wx.removeStorageSync(i.key);});delete app.__pdQAStorage;}if(app.__pdQARequest){wx.request=app.__pdQARequest;delete app.__pdQARequest;}if(app.__pdQAModal){wx.showModal=app.__pdQAModal;delete app.__pdQAModal;}if(app.__pdQASnapshot){app.globalData=app.__pdQASnapshot;delete app.__pdQASnapshot;}delete app.__pdQA;}).catch(e=>report.errors.push('restore: '+e.message));
  fs.writeFileSync(path.join(out,'professional-driver.json'),JSON.stringify(report,null,2));mini.disconnect();
 }
 assert.equal(report.errors.length,0);console.log('Native professional/driver: cancel,503,retry,5+2preview,dining relocation,Dicky/Gede draft callbacks passed; no live requests');
})().catch(error=>{console.error(error);process.exitCode=1;});

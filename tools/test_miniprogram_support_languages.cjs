const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root=path.resolve(__dirname,'..');
function page(name,lang='en',api={}) {
  let p; const storage={}, toasts=[], modals=[], nav=[];
  const app={globalData:{currentLang:lang,token:'test',user:{id:1},preferences:{notes:'kept'},professionalRoute:null},setPrefs(v){this.globalData.preferences=v;}};
  app.privateStorageKey=name=>name+'_'+(app.globalData.user?app.globalData.user.id:'guest');
  const wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],setNavigationBarTitle:v=>nav.push(v),showToast:v=>toasts.push(v),showModal:v=>modals.push(v),navigateBack(){},switchTab(){},navigateTo:v=>nav.push(v),setClipboardData:v=>v.fail()};
  vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/pages',name,name+'.js'),'utf8'),{Page:v=>p=v,getApp:()=>app,wx,require:s=>s.includes('api.js')?api:s.includes('bali-media.js')?api:require(path.resolve(root,'miniprogram/pages',name,s)),setTimeout(){},Date});
  p.data=JSON.parse(JSON.stringify(p.data));p.setData=(v,cb)=>{Object.assign(p.data,v);if(cb)cb();};
  return {p,app,wx,storage,toasts,modals,nav};
}
function parity(file,pages){
 const copy=require('../'+file), keys=Object.keys(copy.zh).sort();
 for(const lang of ['zh','en','ja','ko','id']){
  assert.deepEqual(Object.keys(copy[lang]).sort(),keys);
  for(const value of Object.values(copy[lang])) assert.ok(value && typeof value==='string');
  for(const name of pages){
   const template=fs.readFileSync(path.join(root,'miniprogram/pages',name,name+'.wxml'),'utf8');
   for(const m of template.matchAll(/copy\.(\w+)/g))assert.ok(copy[lang][m[1]],lang+': '+m[1]);
   assert.ok(!/\{\{[^}]*\{\{/.test(template),'no nested bindings');
  }
 }
}
(async()=>{
 parity('miniprogram/utils/browse-copy.js',['gallery','history','place']);
 parity('miniprogram/pages/driver/copy.js',['driver']);
 parity('miniprogram/pages/prefs/copy.js',['prefs']);
 parity('miniprogram/pages/chat/copy.js',['chat']);
 parity('miniprogram/pages/compare/copy.js',['compare']);
 for (const lang of ['zh','en','ja','ko','id']) {
   const compare=page('compare',lang,{searchHotels:async(...args)=>{assert.equal(args[4],lang);return {hotels:[]};}});
   compare.app.globalData.currentDest='bali';compare.p.onLoad();compare.p.onShow();
   assert.equal(compare.p.data.areas[0].name,compare.p.data.copy.all);
   compare.p.selectArea({currentTarget:{dataset:{key:'ubud'}}});compare.p.onShow();
   assert.equal(compare.p.data.currentArea,'ubud','returning must preserve selected area');
   await compare.p.searchHotelsHandler();assert.equal(compare.p.data.hotelSearched,true);
   compare.p.openHotelLink({currentTarget:{dataset:{}}});assert.equal(compare.toasts.at(-1).title,compare.p.data.copy.missingLink);
   compare.p.setData({flightReturn:''});await compare.p.searchFlightsHandler();assert.equal(compare.toasts.at(-1).title,compare.p.data.copy.returnInvalid);
   const chat=page('chat',lang,{checkUserContent:async()=>{},chatOnce:async()=>{throw new Error('offline');}});
   chat.app.globalData.currentDest='bali';chat.app.buildMemoryPrompt=()=>'';chat.p.onLoad();await chat.p.onShow();
   assert.equal(chat.p.data.modeLabel,chat.p.data.copy.fastLabel);
   chat.p.onInputChange({detail:{value:'test question'}});await chat.p.sendMsg();
   assert.equal(chat.p.data.inputText,'test question');assert.equal(chat.p.data.retryText,'test question');assert.equal(chat.p.data.busy,false);
   assert.equal(chat.modals.at(-1).title,chat.p.data.copy.error);
 }
 const dc=require('../miniprogram/pages/driver/copy.js'), estimate=require('../miniprogram/utils/driver-estimate.js');
 for(const lang of Object.keys(dc)){
  assert.equal(estimate.calculate({fullDays:2,halfDays:1,people:6},dc[lang]).total,1900000);
  const x=page('driver',lang,{listDriverRequests:async()=>({requests:[{status:'replied',num_days:3,reply:{message:'UNCHANGED'}}]})});
  x.p.onLoad();x.p.onShow();await x.p.loadRequests();
  assert.equal(x.p.data.requests[0].statusLabel,dc[lang].statusReplied);
  assert.equal(x.p.data.requests[0].reply.message,'UNCHANGED');
  await x.p.submit();assert.equal(x.p.data.error,dc[lang].nameRequired);
  x.p.setData({firstName:'Test',email:''});x.app.globalData.token='';
  await x.p.submit();assert.equal(x.p.data.error,dc[lang].guestEmailRequired);
 }
 const gallery=page('gallery','id',{loadBaliMedia:async()=>({gallery:[{key:'a',theme:'culture'},{key:'b',theme:'landscapes'}]}),clearCache(){}});
 gallery.p.onLoad();await gallery.p.loadGallery();
 gallery.p.chooseFilter({currentTarget:{dataset:{id:'culture'}}});assert.equal(gallery.p.data.visibleCount,1);
 gallery.p.markImageFailed({currentTarget:{dataset:{key:'a'}}});assert.equal(gallery.p.data.visibleAssets[0].imageFailed,true);
 const place=page('place','ja',{loadBaliMedia:async()=>({allImages:[],poiById:{}})});
 place.p.onLoad();await place.p.loadPlace();assert.equal(place.p.data.error,place.p.data.copy.notFound);
 place.p.copyLink({currentTarget:{dataset:{value:'https://example.com'}}});assert.equal(place.toasts.at(-1).title,place.p.data.copy.copyFailed);
 let resolvePrefs;
 const prefs=page('prefs','id',{getPrefs:()=>new Promise(r=>resolvePrefs=r),savePrefs:async()=>{throw new Error('offline');}});
 prefs.p.onLoad();prefs.p.onShow();prefs.p.onNotesChange({detail:{value:'new input'}});
 resolvePrefs({notes:'stale remote'});await Promise.resolve();await Promise.resolve();assert.equal(prefs.p.data.notes,'new input');
 prefs.p.clearPrefs();await prefs.modals.at(-1).success({confirm:true});
 assert.equal(prefs.p.data.notes,'new input','failed clear must preserve form');
 assert.equal(prefs.app.globalData.preferences.notes,'kept','failed clear must preserve cache');
 assert.equal(prefs.toasts.length,0,'failed clear cannot claim success');
 assert.equal(prefs.p.data.busy,false);
 const driver=page('driver','en',{listDriverRequests:async()=>({requests:[]})});
 driver.p.onLoad();driver.p.setData({firstName:'Account A',pickup:'A hotel'});driver.p.saveDraft();
 driver.app.globalData.token='second';driver.app.globalData.user={id:2,name:'Account B'};driver.p.onShow();
 assert.equal(driver.p.data.firstName,'Account B');assert.equal(driver.p.data.pickup,'');
 assert.equal(driver.storage.wm_driver_draft_1.pickup,'A hotel','prior account draft remains available to its owner');
 const chat=page('chat','en',{});chat.app.globalData.currentDest='bali';chat.p.onLoad();
 chat.p.onInputChange({detail:{value:'account A private draft'}});
 chat.app.globalData.user={id:2};chat.app.globalData.token='second';await chat.p.onShow();
 assert.equal(chat.p.data.inputText,'');assert.equal(chat.storage.wm_chat_state_1.inputText,'account A private draft');
 let application;
 const cache={wm_prefs:{notes:'legacy unowned'},wm_prefs_1:{notes:'one'},wm_prefs_2:{notes:'two'}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/app.js'),'utf8'),{App:v=>application=v,wx:{getStorageSync:k=>cache[k],setStorageSync:(k,v)=>cache[k]=v,removeStorageSync:k=>delete cache[k]}});
 application.setToken('first',{id:1});assert.equal(application.globalData.preferences.notes,'one');
 application.setToken('second',{id:2});assert.equal(application.globalData.preferences.notes,'two');
 application.clearAuth();assert.equal(Object.keys(application.globalData.preferences).length,0);
 assert.equal(cache.wm_prefs.notes,'legacy unowned','unowned legacy cache is retained, not reassigned');
 for(const action of ['save','clear']){
  let rejectSave;
  const stale=page('prefs','en',{checkUserContent:async()=>{},savePrefs:()=>new Promise((_,r)=>rejectSave=r)});
  stale.p.onShow();let pending;
  if(action==='save')pending=stale.p.savePrefs();
  else{stale.p.clearPrefs();pending=stale.modals.at(-1).success({confirm:true});}
  await new Promise(setImmediate);assert.ok(rejectSave);
  const modalCount=stale.modals.length;
  stale.app.globalData.token='new-account';stale.p.setData({busy:true});rejectSave(Error('old account failure'));await pending;
  assert.equal(stale.p.data.busy,true,'old preference request must not reset the new account busy state');
  assert.equal(stale.modals.length,modalCount,'old request must not show an error in the new account');
 }
 let resolveSend;
 const staleDriver=page('driver','en',{checkUserContent:async()=>{},sendDriverRequest:()=>new Promise(r=>resolveSend=r)});
 staleDriver.p.setData({firstName:'Test',startDate:'2026-10-01',endDate:'2026-10-02',pickup:'Test hotel',privacyConsent:true});
 const pendingDriver=staleDriver.p.submit();await new Promise(setImmediate);assert.ok(resolveSend);
 staleDriver.app.globalData.token='new-account';staleDriver.p.setData({busy:true});resolveSend({});await pendingDriver;
 assert.equal(staleDriver.p.data.busy,true,'old driver request must not reset a new account operation');
 console.log('Supporting pages: five languages, price invariance, validation, recovery, late-response and account-cache isolation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

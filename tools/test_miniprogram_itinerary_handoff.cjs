const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const storage={};let userId=1,requests=0;
const app={globalData:{token:'test',user:{id:1},currentDest:'bali',currentLang:'en'},privateStorageKey:key=>key+'_'+userId,updateTabBarLanguage(){}};
const wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>{storage[key]=value;},removeStorageSync:key=>{delete storage[key];},switchTab(){},showToast(){},setNavigationBarTitle(){}};
function load(file){let page;const full=path.resolve(__dirname,'../miniprogram/pages/'+file);vm.runInNewContext(fs.readFileSync(full,'utf8'),{getApp:()=>app,Page:p=>{page=p;},wx,require:name=>name.includes('api.js')?{chatOnce(){requests++;}}:require(path.resolve(path.dirname(full),name)),setTimeout,Date});page.data=JSON.parse(JSON.stringify(page.data));page.setData=update=>Object.assign(page.data,update);return page;}
(async()=>{
  const itinerary=load('itinerary/itinerary.js');itinerary.owner=app.privateStorageKey('wm_public_route_plans');
  itinerary.data.foodCopy={day:'Day',failed:'Failed'};
  itinerary.data.selected={id:'R1',name:'First Bali',days:[{day:1,theme:'Ubud',places:[{name:'Monkey Forest'}],food:[{name:'Warung',meal:'Lunch'}]},{day:2,theme:'Penida West',places:[{name:'Kelingking'}],food:[]}]};
  itinerary.goChat();assert.match(storage.wm_itinerary_context_1.text,/Lunch · Warung/);assert.match(storage.wm_itinerary_context_1.text,/Penida West/);
  const chat=load('chat/chat.js');chat.onLoad();chat.data.inputText='Please keep my budget';await chat.onShow();
  assert.match(chat.data.inputText,/Please keep my budget/);assert.match(chat.data.inputText,/Kelingking/);assert.equal(requests,0,'handoff must not auto send');assert.equal(storage.wm_itinerary_context_1,undefined);
  const once=chat.data.inputText;await chat.onShow();assert.equal(chat.data.inputText,once,'consume once');
  itinerary.goChat();userId=2;app.globalData.token='other';app.globalData.user={id:2};await chat.onShow();assert.equal(chat.data.inputText,'','new account must not inherit route draft');assert.ok(storage.wm_itinerary_context_1,'old account context preserved');
  console.log('Native route/food/extension to AI draft: editable, persistent, once-only, no auto send and account isolation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

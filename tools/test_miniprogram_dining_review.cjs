const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const travel=require('../wandermind-studio/frontend/assets/data/bali-travel-data.json');
const catalog=require('../wandermind-studio/frontend/assets/data/bali-extensions.json');
const food=require('../wandermind-studio/frontend/assets/data/bali-food.json');
const engine=require('../miniprogram/utils/bali-itinerary.js');
const route=travel.routes.find(item=>item.id==='R1');
const restaurant=food.restaurants.find(item=>item.published && item.extensionIds.includes('penida-west') && item.suitableDayparts.includes('lunch'));
const plan={route_id:'R1',extension_ids:['penida-west'],days:route.free_outline.map(day=>({region_id:day.region_id})).concat(engine.extensionDay(catalog.extensions.find(item=>item.id==='penida-west')))};
plan.days[8].food_stops=[{restaurant_id:restaurant.id,meal:'lunch'}];
function load(options={}){
  let page,identity=1,created=[],accepted=[],modal;
  const app={globalData:{user:{id:1},currentLang:'en'},privateStorageKey:key=>key+'_'+identity,setProfessionalRoute:value=>accepted.push(value)};
  const api={baliRouteData:async()=>travel,baliExtensions:async()=>catalog,baliFood:async()=>{if(options.switchDuringRead) identity=2;return food;},createProfessionalRoute:async profile=>{created.push(profile);if(options.switchDuringWrite) identity=2;return {test:true};}};
  const full=path.resolve(__dirname,'../miniprogram/pages/planner/planner.js');
  const storage={wm_public_route_plans_1:{R1:plan}};
  const wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>{storage[key]=value;},showToast(){},navigateBack(){},showModal:value=>{modal=value.content;value.success({confirm:options.confirm!==false});}};
  vm.runInNewContext(fs.readFileSync(full,'utf8'),{getApp:()=>app,Page:value=>{page=value;},wx,Date,setTimeout:fn=>fn(),require:name=>name.includes('api.js')?api:require(path.resolve(path.dirname(full),name))});
  page.data=JSON.parse(JSON.stringify(page.data));page.setData=update=>Object.assign(page.data,update);page.onLoad({routeId:'R1'});
  return {page,created,accepted,modal:()=>modal};
}
(async()=>{
  const approved=load();await approved.page.submit();assert.equal(approved.created.length,1);assert.equal(approved.created[0].dining_stops[0].day,7);assert.ok(approved.modal().includes(restaurant.name));assert.ok(!approved.modal().includes(restaurant.id));assert.equal(approved.page.data.busy,false);
  const cancelled=load({confirm:false});await cancelled.page.submit();assert.equal(cancelled.created.length,0);assert.equal(cancelled.page.data.days,7);assert.equal(cancelled.page.data.busy,false);
  const readSwitch=load({switchDuringRead:true});await readSwitch.page.submit();assert.equal(readSwitch.created.length,0);assert.equal(readSwitch.accepted.length,0);
  const writeSwitch=load({switchDuringWrite:true});await writeSwitch.page.submit();assert.equal(writeSwitch.accepted.length,0);
  assert.equal(plan.days[8].food_stops[0].restaurant_id,restaurant.id);
  console.log('Native dining review: day 9→7, human names, cancel preserves input, late-account response rejected; no live API');
})().catch(error=>{console.error(error);process.exitCode=1;});

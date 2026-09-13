const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../miniprogram'),data=path.resolve(__dirname,'../wandermind-studio/frontend/assets/data');
const travel=require(data+'/bali-travel-data.json'),catalog=require(data+'/bali-extensions.json'),food=require(data+'/bali-food.json');
const foodWxml=fs.readFileSync(root+'/pages/food/food.wxml','utf8');
assert.ok(foodWxml.includes('{{!loading && !error && !items.length}}'),'WXML uses native operators, not escaped XML entities');
assert.ok(!/{{[^}]*&amp;/.test(foodWxml),'encoded operator must not enter a WXML binding');
assert.ok(foodWxml.includes('BALI · {{copy.title}}'),'native section stamp follows the selected language');
let identity=1,storage={},navigations=0;
const app={globalData:{currentLang:'en',currentDest:'bali',token:''},privateStorageKey:key=>key+'_'+identity,updateTabBarLanguage(){}};
const wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>{storage[key]=value;},removeStorageSync:key=>{delete storage[key];},setNavigationBarTitle(){},switchTab(){navigations++;},showToast(){}};
function load(name,api) {
  const file=root+'/pages/'+name+'/'+name+'.js';let page;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:value=>{page=value;},getApp:()=>app,wx,Date,require:source=>source.includes('api.js')?api:require(path.resolve(path.dirname(file),source))});
  page.data=JSON.parse(JSON.stringify(page.data));page.setData=update=>Object.assign(page.data,update);return page;
}
(async()=>{
  const api={baliRouteData:async()=>travel,baliExtensions:async()=>catalog,baliFood:async()=>food};
  const dining=load('food',api);dining.onLoad({});await dining.load();
  const routed=load('food',api);routed.route='pages/food/food';routed.onLoad({routeId:'R1'});await routed.load();
  assert.equal(routed.route,'pages/food/food','framework page route must remain a path string');
  assert.equal(routed.routeFamily.id,'R1');
  const item=food.restaurants.find(item=>item.published && item.routeIds.includes('R2') && item.routeIds[0]==='R2');
  assert.ok(item);dining.add({currentTarget:{dataset:{id:item.id}}});assert.equal(navigations,1);assert.equal(storage.wm_bali_route_selection_1,'R2');
  const itinerary=load('itinerary',api);await itinerary.loadRoutes();assert.equal(itinerary.data.selected.id,'R2');assert.equal(storage.wm_bali_route_selection_1,undefined,'consume once');
  dining.browse();assert.equal(navigations,2);
  storage.wm_bali_route_selection_1='R2';identity=2;
  const other=load('itinerary',api);await other.loadRoutes();assert.equal(other.data.selected.id,'R1');assert.equal(storage.wm_bali_route_selection_1,'R2','old account selection preserved');
  const failed=load('food',{...api,baliFood:async()=>{identity=3;throw Error('stale failure');}});failed.onLoad({});await failed.load();assert.equal(failed.data.error,'','stale account errors rejected');
  const localeFailure=load('food',{...api,baliFood:async()=>{app.globalData.currentLang='id';throw Error('stale locale failure');}});localeFailure.onLoad({});await localeFailure.load();assert.equal(localeFailure.data.error,'','stale locale errors rejected');
  console.log('Food to route: R2 selection,once-only,account isolation; stale account/language errors rejected');
})().catch(error=>{console.error(error);process.exitCode=1;});

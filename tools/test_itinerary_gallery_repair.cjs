const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('../miniprogram/utils/bali-itinerary.js');
const travel=require('../wandermind-studio/frontend/assets/data/bali-travel-data.json');
const extensions=require('../wandermind-studio/frontend/assets/data/bali-extensions.json');
const food=require('../miniprogram/utils/bali-food-copy.js');
for(const lang of ['zh','en','ja','ko','id']){
 assert.ok(food[lang].chooseRestaurant);assert.notEqual(food[lang].chooseRestaurant,food[lang].add);
 assert.ok(require('../miniprogram/pages/itinerary/copy.js')[lang].extensions);
}
const r1=travel.routes.find(r=>r.id==='R1');
assert.ok(r1.free_outline[2].suggested_poi_ids.includes('uluwatu_temple'));
const day=i=>({region_id:r1.free_outline[i].region_id,place_ids:r1.free_outline[i].suggested_poi_ids});
const used=r1.free_outline.flatMap(d=>d.suggested_poi_ids);
const south=engine.candidates(day(1),travel.pois,used,extensions);
const cliff=engine.candidates(day(2),travel.pois,used,extensions);
assert.ok(!south.some(p=>p.node_id==='uluwatu'));
assert.ok(cliff.some(p=>p.id==='suluban_beach'));
assert.ok(!cliff.some(p=>south.some(s=>s.id===p.id)));
const view=fs.readFileSync('miniprogram/pages/itinerary/itinerary.wxml','utf8');
assert.ok(view.indexOf('public-days')<view.indexOf('class="extensions"'));
assert.ok(view.includes('foodCopy.chooseRestaurant'));
let page;const callbacks=[];
vm.runInNewContext(fs.readFileSync('miniprogram/pages/gallery/gallery.js','utf8'),{
 require:p=>p.includes('bali-media')?{}:{zh:{}},getApp:()=>({globalData:{currentLang:'zh'}}),Page:p=>page=p,
 setTimeout:f=>{callbacks.push(f);return callbacks.length;},clearTimeout(){},Set,Map,wx:{}
});
page.data={...page.data,assets:Array.from({length:30},(_,i)=>({key:String(i),theme:'landscapes',fullUrl:'full'+i}))};
page.setData=function(d){Object.assign(this.data,d);};
page.applyFilter('all');assert.equal(page.data.visibleAssets.length,12);assert.equal(page.data.visibleCount,30);
page.markImageLoaded({currentTarget:{dataset:{key:'0'}}});
callbacks.at(-1)();assert.equal(page.data.visibleAssets[0].imageFailed,false);assert.equal(page.data.visibleAssets[1].imageFailed,true);
page.retryImage({currentTarget:{dataset:{key:'1'}}});assert.equal(page.data.visibleAssets[1].thumbUrl,'full1');assert.equal(page.data.visibleAssets[1].imageFailed,false);
page.onReachBottom();assert.equal(page.data.visibleAssets.length,24);
page.applyFilter('culture');assert.equal(page.data.visibleAssets.length,0);
let routePage,modal,owner='u1',saved={R1:{days:[]},R2:{days:['keep']}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/itinerary/itinerary.js','utf8'),{
 require:p=>p.includes('copy')?{zh:{}}:{},getApp:()=>({globalData:{},privateStorageKey:()=>owner}),Page:p=>routePage=p,
 wx:{showModal:o=>modal=o,getStorageSync:()=>saved,setStorageSync:(key,value)=>{assert.equal(key,'u1');saved=value;}}
});
routePage.owner='u1';routePage.data.selected={id:'R1'};routePage.loadRoutes=()=>{};
routePage.resetRoute();modal.success({confirm:false});assert.ok(saved.R1);
routePage.resetRoute();owner='u2';modal.success({confirm:true});assert.ok(saved.R1,'Late account modal must not reset a different account');
owner='u1';routePage.resetRoute();modal.success({confirm:true});assert.ok(!saved.R1);assert.deepEqual(saved.R2.days,['keep']);
console.log('Itinerary/gallery repair regressions passed: 5-language actions, node-based suggestions, cliff-day assignment, gallery pagination/timeouts/retry.');

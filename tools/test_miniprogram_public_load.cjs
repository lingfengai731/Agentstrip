const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.equal(read('miniprogram/utils/public-catalog-seed.js').replace(/\r\n/g,'\n'),require('./build_miniprogram_catalog.cjs').build().replace(/\r\n/g,'\n'),'Snapshot must match shared Web sources (ignoring checkout line endings only)');
const seed=require('../miniprogram/utils/public-catalog-seed.js');
let now=1,requests=[],timers=[];
const app={globalData:{apiBase:'https://example.invalid',currentLang:'zh',token:''},privateStorageKey:k=>k+'_qa'};
const apiContext={module:{exports:{}},getApp:()=>app,require:n=>require('../miniprogram/utils/'+n.replace('./','')),Date:{now:()=>now},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},wx:{request:o=>{requests.push(o);return {abort(){}};}}};
vm.runInNewContext(read('miniprogram/utils/api.js'),apiContext);const api=apiContext.module.exports;
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function page(name,dependencies){let p;vm.runInNewContext(read('miniprogram/pages/'+name+'/'+name+'.js'),{Page:v=>p=v,getApp:()=>app,require:n=>dependencies[n]||require(path.join(root,'miniprogram/pages',name,n)),wx:{getStorageSync:()=>null,setNavigationBarTitle(){},removeStorageSync(){}},Date});p.data=JSON.parse(JSON.stringify(p.data));p.setData=u=>Object.assign(p.data,u);return p;}
(async()=>{
 const data=await Promise.all([api.baliRouteData(),api.baliFood(),api.baliExtensions(),api.imagePublishManifest(),api.baliMediaCatalog()]);
 assert.equal(data[0].routes.length,6);assert.ok(data[1].restaurants.length>=30);assert.ok(data[3].images.length>50);
 assert.equal(requests.length,5);requests.forEach(r=>{assert.equal(r.timeout,8000);assert.equal(r.header.Authorization,undefined);});
 requests.forEach(r=>r.fail({errMsg:'request:fail url not in domain list'}));await flush();
 assert.equal((await api.baliRouteData()).routes.length,6,'Offline failure must not poison public catalog');
 now=16001;api.baliRouteData();requests.at(-1).success({statusCode:200,data:'<html>proxy failure</html>'});await flush();
 assert.equal((await api.baliRouteData()).routes.length,6,'Invalid 200 must not replace usable snapshot');
 now=32002;api.baliFood();requests.at(-1).success({statusCode:200,data:{restaurants:seed.catalogs['bali-food'].restaurants.slice(0,31)}});await flush();
 assert.equal((await api.baliFood()).restaurants.length,31,'Background refresh must remain available');
 const food=page('food',{'../../utils/api.js':api});food.onLoad({});await food.load();assert.equal(food.data.loading,false);assert.equal(food.data.error,'');
 for(const key of ['regionIndex','categoryIndex','cuisineIndex','sceneIndex','budgetIndex','mealIndex']){food.openFilter({currentTarget:{dataset:{key}}});assert.equal(food.data.filterOpen,true);assert.ok(food.data.filterOptions.length>1);food.closeFilter();}
 const itinerary=page('itinerary',{'../../utils/api.js':api});await itinerary.loadRoutes();assert.equal(itinerary.data.routes.length,6);assert.equal(itinerary.data.loading,false);
 app.globalData.token='synthetic';app.globalData.professionalRoute=null;
 api.recentUnlockedProfessionalRoute=()=>Promise.reject(new Error('offline'));
 await itinerary.loadProfessionalRoute();assert.equal(itinerary.data.error,'');assert.equal(itinerary.data.professionalError,'offline');
 const mediaContext={module:{exports:{}},require:()=>api,Set,Promise,Number};vm.runInNewContext(read('miniprogram/utils/bali-media.js'),mediaContext);const media=mediaContext.module.exports;
 api.publicPortfolio=()=>new Promise(()=>{});
 const gallery=await media.loadBaliMedia('zh');assert.ok(gallery.gallery.length>40,'A silent optional Portfolio must not block static gallery');
 api.publicPortfolio=()=>Promise.reject(new Error('offline'));await assert.rejects(media.loadBaliMedia('zh',true,true),/offline/);
 assert.ok((await media.loadBaliMedia('zh')).gallery.length>40,'Optional failure must not erase photos');
 api.publicPortfolio=async()=>({assets:[{id:'published-qa',web_url:'https://example.invalid/photo.webp',primary_theme:'experiences'}]});
 assert.ok((await media.loadBaliMedia('zh',false,true)).allImages.some(i=>i.key==='published-qa'),'Retry must load new administrator publication');
 const privateCall=api.createProfessionalRoute({days:7}).catch(e=>e);assert.equal(requests.at(-1).header.Authorization,'Bearer synthetic');
 requests.at(-1).fail({errMsg:'request:fail url not in domain list'});assert.equal((await privateCall).code,'WX_DOMAIN','Private matching must fail honestly, not use public snapshot');
 console.log('Public loading: source parity, immediate offline 6 routes/30+ restaurants/gallery, six filters, bounded refresh, invalid200, optional Portfolio failure/retry, protected match isolation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('E:/Agentstrip-artifacts/2026-09-09/mini-ui-tools/node_modules/miniprogram-automator');
const output=process.env.WM_CLARITY_NATIVE_OUTPUT;
if(!output){console.log('Clarity native QA skipped: explicit output and DevTools required');process.exit(0);}
const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
const report={capturedAt:new Date().toISOString(),scope:'Native DevTools; real public requests, isolated guest route edits restored; not physical phone',checks:[],errors:[]};
const bounded=(p,label,ms=20000)=>{let timer;return Promise.race([p,new Promise((_,r)=>timer=setTimeout(()=>r(Error(label+' timeout')),ms))]).finally(()=>clearTimeout(timer));};
(async()=>{
 const mini=await bounded(automator.connect({wsEndpoint:'ws://127.0.0.1:9421'}),'connect');
 mini.on('exception',e=>report.errors.push(String(e.message||e)));
 const shot=async name=>{await bounded(mini.screenshot({path:path.join(out,name+'.png')}),'screenshot '+name);report.checks.push({screenshot:name});console.log(name);};
 const tap=async(page,selector)=>{await mini.pageScrollTo(0);await page.waitFor(150);const el=await page.$(selector);assert.ok(el,selector);const pos=await el.offset();await mini.pageScrollTo(Math.max(0,pos.top-180));await page.waitFor(250);await el.tap();await page.waitFor(800);};
 const destination=async route=>{for(let n=0;n<30;n++){const p=await mini.currentPage();if(p&&p.path===route)return p;await new Promise(r=>setTimeout(r,250));}throw Error('Navigation did not reach '+route);};
 try {
  await mini.evaluate(function(){const app=getApp();app.__clarityQA={global:{...app.globalData}};app.globalData.token='';app.globalData.user=null;app.globalData.professionalRoute=null;app.globalData.currentDest='bali';app.globalData.currentLang='zh';app.__clarityQA.storage=['wm_public_route_plans','wm_bali_route_selection'].map(n=>{const key=app.privateStorageKey(n);return {key,exists:wx.getStorageInfoSync().keys.includes(key),value:wx.getStorageSync(key)};});app.__clarityQA.storage.forEach(i=>wx.removeStorageSync(i.key));});
  report.width=(await mini.systemInfo()).windowWidth;
  let page=await mini.reLaunch('/pages/itinerary/itinerary');await page.waitFor(800);
  let selected=await page.data('selected');assert.equal(selected.id,'R1');assert.equal(selected.days.length,8);assert.equal(await page.data('openDay'),0);assert.equal(await page.data('extensionsOpen'),false);
  assert.ok(await page.$('.extension-toggle'));assert.equal((await page.$$('.extension-card')).length,0);
  await mini.pageScrollTo(200);await shot('itinerary-day1');
  await tap(page,'.day-toggle[data-day="2"]');assert.equal(await page.data('openDay'),2);
  assert.ok(selected.days[2].places.some(p=>p.id==='uluwatu_temple'));await shot('itinerary-day3');
  report.dayStyle={};const dayButton=await page.$('.day-toggle');for(const key of ['width','margin-left','margin-right','padding-left','justify-content'])report.dayStyle[key]=await dayButton.style(key);
  const controls=await page.$$('.day-toggle, .place-link, .btn.full');
  const sizes=await Promise.all(controls.map(async e=>({...await e.size(),...await e.offset()})));
  assert.ok(sizes.every(s=>s.height>=43.5&&s.left>=-1&&s.left+s.width<=report.width+1),'control size/overflow');
  report.checks.push({dayAccordion:true,uluwatuDay:3,controls:sizes.length,minHeight:Math.min(...sizes.map(s=>s.height))});
  await tap(page,'.place-link[data-id="uluwatu_temple"]');
  page=await destination('pages/place/place');await page.waitFor(1200);assert.ok((await page.data('place')).title);await shot('place-uluwatu');
  page=await mini.reLaunch('/pages/itinerary/itinerary');await page.waitFor(500);await tap(page,'.extension-toggle');assert.equal(await page.data('extensionsOpen'),true);assert.equal((await page.$$('.extension-card')).length,3);
  await shot('itinerary-extensions');
  await tap(page,'.extension-card button[data-id="penida-west"]');selected=await page.data('selected');assert.equal(selected.days.length,9);assert.ok(selected.modules.find(m=>m.id==='penida-west').selected);
  await tap(page,'.day-toggle[data-day="8"]');assert.equal(await page.data('openDay'),8);await shot('itinerary-penida-day9');
  await tap(page,'.day-body button[data-day="8"]');page=await destination('pages/food/food');await page.waitFor(800);assert.ok((await page.data('addLabel')).includes('9'));await shot('food-day9');
  report.checks.push({extensionAddedSeparateDay:9,foodTargetDay:9,navigation:'actual SDK taps'});
  await mini.evaluate(function(){getApp().globalData.currentLang='en';});
  page=await mini.reLaunch('/pages/itinerary/itinerary');await page.waitFor(500);await mini.pageScrollTo(200);await shot('itinerary-en');
  await mini.evaluate(function(){getApp().globalData.currentLang='zh';});
  page=await mini.reLaunch('/pages/gallery/gallery');await page.waitFor(1500);assert.equal(await page.data('loading'),false);assert.ok((await page.data('assets')).length>=64);await shot('gallery-top');
  const cards=await page.$$('.gallery-card');
  for(let i=0;i<cards.length;i+=6){const pos=await cards[i].offset();await mini.pageScrollTo(pos.top);await page.waitFor(450);}
  await page.waitFor(1800);await shot('gallery-bottom');
  report.gallery=await mini.evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {count:p.data.assets.length,loaded:Object.keys(p.loadedImages||{}).length,failed:p.data.assets.filter(a=>a.imageFailed).length,positive:Object.values(p.loadedImages||{}).every(v=>v.width>0&&v.height>0)};});
  assert.equal(report.gallery.failed,0);assert.ok(report.gallery.loaded>12);assert.ok(report.gallery.positive);
  await mini.pageScrollTo(0);await page.waitFor(200);await tap(page,'.gallery-card[data-index="0"]');page=await destination('pages/place/place');await page.waitFor(1800);await shot('gallery-detail');
  report.detail=await mini.evaluate(function(){const p=getCurrentPages().slice(-1)[0];return {imageCount:p.data.images.length,loaded:p.loadedImages||{},failed:p.data.images.filter(i=>i.imageFailed).length};});
  assert.equal(report.detail.failed,0);assert.ok(Object.keys(report.detail.loaded).length>0);assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.message;process.exitCode=1;}
 finally{
  await mini.evaluate(function(){const app=getApp(),qa=app.__clarityQA;if(qa){qa.storage.forEach(i=>{if(i.exists)wx.setStorageSync(i.key,i.value);else wx.removeStorageSync(i.key);});app.globalData=qa.global;delete app.__clarityQA;}}).then(()=>report.restored=true).catch(e=>{report.restoreError=e.message;process.exitCode=1;});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));mini.disconnect();console.log(JSON.stringify(report));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

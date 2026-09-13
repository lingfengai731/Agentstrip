const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'../wandermind-studio/frontend');
const artifacts = process.env.WM_FOOD_ARTIFACTS || path.resolve('output/playwright/bali-food');
const types = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  const file = path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');res.end(data);});
});
(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  const matrix=[];
  try {
    for (const width of (process.env.WM_FOOD_QA_ONLY?[]:[320,390,768,1440])) {
      const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
      for (const lang of ['zh','en','ja','ko','id']) {
        await page.goto(base+'/dining.html?lang='+lang+'&route=R1&day=0');
        await page.locator('.food-card').first().waitFor();
        const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth-document.documentElement.clientWidth,nodes:Array.from(document.querySelectorAll('body *')).filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>({tag:n.tagName,class:n.className,right:n.getBoundingClientRect().right})).slice(0,8)}));
        assert.equal(overflow.width,0,JSON.stringify({width,lang,...overflow}));
        assert.ok((await page.locator('#food-heading').innerText()).length);
        assert.ok(!/undefined/.test(await page.locator('main').innerText()));
        const count=await page.locator('.food-card').count();assert.ok(count>0);
        await page.locator('.food-card button').first().click();
        const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('wm_bali_route_draft')));
        assert.equal(stored.dining_stops[0].day,1);
        assert.equal(stored.dining_stops[0].meal,'lunch');
        assert.ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('wm_studio_lastPlan')).text)).includes(stored.dining_stops[0].restaurant_id===undefined?'invalid':(await page.locator('.food-card h2').first().innerText())));
        const heights=await page.locator('button,select').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height));assert.ok(heights.every(h=>h>=44));
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:path.join(artifacts,`food-${width}-${lang}.png`),fullPage:false});
        matrix.push({width,lang,count,overflow:0,minControl:Math.min(...heights),pageErrors:errors.length});
      }
      assert.deepEqual(errors,[]);await page.close();
    }
    if(!process.env.WM_FOOD_QA_ONLY){
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(base+'/dining.html?lang=zh');await page.locator('.food-card').first().waitFor();
    await page.selectOption('#food-meal','');
    assert.equal(await page.locator('.food-card').count(),40);
    await page.selectOption('#food-language','id');assert.equal(await page.locator('#food-language').inputValue(),'id');
    await page.selectOption('#food-region','G5');assert.ok(await page.locator('.food-card').count()>0);
    await page.close();
    }
    for(const width of (process.env.WM_FOOD_QA_ONLY?[]:[320,390,768,1440])){
      const bali=await browser.newPage({viewport:{width,height:900}}),errors=[];
      bali.on('pageerror',error=>errors.push(error.message));
      await bali.goto(base+'/bali.html?lang=zh&route=R1',{waitUntil:'domcontentloaded'});
      await bali.locator('[data-extension-add="penida-west"]').waitFor();
      await bali.locator('[data-extension-add="penida-west"]').click();
      await bali.locator('[data-extension-remove="penida-west"]').waitFor();
      await bali.locator('[data-extension-add="penida-east"]').click();
      await bali.locator('[data-extension-remove="penida-east"]').waitFor();
      const saved=await bali.evaluate(()=>JSON.parse(localStorage.getItem('wm_bali_route_draft')));
      assert.deepEqual(saved.extension_ids,['penida-west','penida-east']);
      assert.equal(saved.days.length,10);
      assert.equal(saved.days[8].extension_id,'penida-west');
      assert.equal(saved.days[9].extension_id,'penida-east');
      assert.equal(await bali.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
      await bali.screenshot({path:path.join(artifacts,`bali-extensions-${width}.png`),fullPage:false});
      assert.deepEqual(errors,[]);await bali.close();
      matrix.push({page:'bali.html',width,modules:['penida-west','penida-east'],days:10,overflow:0,pageErrors:0});
    }
    for(const lang of (process.env.WM_FOOD_QA_ONLY==='review'?[]:['zh','en','ja','ko','id'])){
      const gallery=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
      gallery.on('pageerror',error=>errors.push(error.message));
      await gallery.route('**/*',request=>new URL(request.request().url()).origin===base?request.continue():request.abort());
      await gallery.goto(base+'/bali.html?lang='+lang,{waitUntil:'domcontentloaded'});
      const photo=gallery.locator('.bali-shot[data-place-name="Balinese nasi campur"]');
      await photo.waitFor({state:'attached'});
      const toggle=gallery.locator('#gallery [data-mobile-section-toggle]');
      if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click();
      await gallery.locator('#bali-filter-sheet-open').click();
      await gallery.locator('[data-filter="food-dining"]').click();
      await gallery.locator('.is-primary[data-gallery-filter-close]').click();
      await photo.scrollIntoViewIfNeeded();
      await photo.locator('img').evaluate(image=>image.decode());
      assert.equal(await gallery.locator('.bali-shot').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).length),1);
      assert.equal(await gallery.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
      await photo.click();
      await gallery.locator('#bali-place-modal').waitFor({state:'visible'});
      assert.ok((await gallery.locator('#bali-place-modal').innerText()).includes('CC BY-SA 3.0'));
      await gallery.screenshot({path:path.join(artifacts,`food-album-${lang}.png`),fullPage:false});
      assert.deepEqual(errors,[]);
      matrix.push({page:'bali.html',width:390,lang,album:'Food & Dining',visiblePhotos:1,decode:true,credit:'CC BY-SA 3.0',overflow:0,pageErrors:0});
      await gallery.close();
    }
    if(process.env.WM_FOOD_QA_ONLY!=='gallery') for(const width of [390,1440]) {
      const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[],prompts=[];
      let approve=false;
      page.on('pageerror',error=>errors.push(error.message));
      page.on('dialog',async dialog=>{prompts.push(dialog.message());if(approve)await dialog.accept();else await dialog.dismiss();});
      await page.route('**/*',async request=>{
        const url=new URL(request.request().url());
        if(url.pathname==='/api/bali/professional-route' && request.request().method()==='POST') {
          requests.push(request.request().postDataJSON());
          await request.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'offline_test_retry'})});return;
        }
        if(url.pathname.startsWith('/api/')) {await request.fulfill({status:404,contentType:'application/json',body:'{}'});return;}
        if(url.origin!==base) {await request.abort();return;}
        await request.continue();
      });
      await page.goto(base+'/bali.html?lang=zh&route=R1',{waitUntil:'domcontentloaded'});
      await page.locator('[data-extension-add="penida-west"]').click();
      await page.locator('[data-extension-remove="penida-west"]').waitFor();
      await page.locator('[data-professional-route]').first().click();
      const plannerToggle=page.locator('#professional-planner [data-mobile-section-toggle]');
      if(await plannerToggle.count() && await plannerToggle.getAttribute('aria-expanded')==='false') await plannerToggle.click();
      const restaurant=require('../wandermind-studio/frontend/assets/data/bali-food.json').restaurants.find(item=>item.published && item.extensionIds.includes('penida-west') && item.suitableDayparts.includes('lunch'));
      await page.evaluate(item=>{
        const plan=JSON.parse(localStorage.getItem('wm_bali_route_draft'));
        plan.days[8].food_stops=[{restaurant_id:item.id,meal:'lunch'}];
        plan.dining_stops=window.WMBaliItinerary.diningStops(plan);
        localStorage.setItem('wm_bali_route_draft',JSON.stringify(plan));
      },restaurant);
      const form=page.locator('#bali-professional-form');
      await form.locator('[name="start"]').fill('2026-10-10');
      await form.locator('[name="end"]').fill('2026-10-17');
      for(const name of ['audience','budget_tier','style','pace','goal']) {
        await form.locator('label:has(input[name="'+name+'"])').first().click();
        assert.ok(await form.locator('[name="'+name+'"]').first().isChecked(),'visible option selects '+name);
      }
      await form.locator('[data-form-submit]').click();
      await page.waitForFunction(()=>!document.querySelector('[data-form-submit]').disabled);
      assert.equal(requests.length,0,'cancel must not create a route');
      assert.ok(prompts.length,'Expected dining review: '+await page.locator('#bali-professional-form-status').innerText());
      assert.ok(prompts[0].includes(restaurant.name) && prompts[0].includes('9 → 7'));
      assert.equal(await form.locator('[name="start"]').inputValue(),'2026-10-10');
      approve=true;
      for(let attempt=0;attempt<2;attempt++) {
        await page.locator('#bali-professional-form [data-form-submit]').click();
        await page.locator('#bali-professional-form-status').filter({hasText:'offline_test_retry'}).waitFor();
        assert.equal(await page.locator('#bali-professional-form [name="end"]').inputValue(),'2026-10-17');
      }
      assert.equal(requests.length,2,'failure exposes working retry');
      assert.ok(requests.every(request=>request.trip_profile.days===7 && request.trip_profile.dining_stops[0].day===7 && request.trip_profile.extension_ids.includes('penida-west')));
      const retained=await page.evaluate(()=>JSON.parse(localStorage.getItem('wm_bali_route_draft')));
      assert.equal(retained.dining_stops[0].day,9,'review must not overwrite source draft');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
      await page.screenshot({path:path.join(artifacts,`professional-dining-review-${width}.png`),fullPage:false});
      assert.deepEqual(errors,[]);
      matrix.push({page:'bali.html',width,callback:'dining review/cancel/failure/retry',from:9,to:7,cancelRequests:0,retryRequests:2,inputRetained:true,sourceDraftDay:9,overflow:0,pageErrors:0});
      await page.close();
    }
    fs.writeFileSync(path.join(artifacts,'matrix.json'),JSON.stringify(matrix,null,2));
    console.log('Deterministic Browser: '+matrix.length+' cases passed ('+(process.env.WM_FOOD_QA_ONLY || '20 Food,4 extensions,5 album,2 professional dining callbacks')+'); zero page errors/overflow. Not Render admin or native Browser evidence.');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

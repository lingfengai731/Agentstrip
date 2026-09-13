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
    for (const width of [320,390,768,1440]) {
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
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(base+'/dining.html?lang=zh');await page.locator('.food-card').first().waitFor();
    await page.selectOption('#food-meal','');
    assert.equal(await page.locator('.food-card').count(),40);
    await page.selectOption('#food-language','id');assert.equal(await page.locator('#food-language').inputValue(),'id');
    await page.selectOption('#food-region','G5');assert.ok(await page.locator('.food-card').count()>0);
    await page.close();
    for(const width of [320,390,768,1440]){
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
    fs.writeFileSync(path.join(artifacts,'matrix.json'),JSON.stringify(matrix,null,2));
    console.log('Browser:20 Food viewport/language cases plus4 Bali extension cases,44px Food controls,route/day persistence,handoff,40 eligible public candidates and region filter passed');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

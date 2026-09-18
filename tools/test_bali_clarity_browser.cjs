const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../wandermind-studio/frontend');
const artifacts = path.resolve('output/clarity-browser');
const types = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, bytes) => { if (err) return res.writeHead(404).end(); res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream'); res.end(bytes); });
});
(async () => {
  fs.mkdirSync(artifacts,{recursive:true});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true});
  const matrix = [];
  try {
    for (const width of (process.env.WM_CLARITY_QUICK ? [1440] : [320,390,768,1440])) {
      for (const lang of (process.env.WM_CLARITY_QUICK ? ['zh'] : ['zh','en','ja','ko','id'])) {
        const page = await browser.newPage({viewport:{width,height:900}}), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
        await page.goto(base+'/bali.html?lang='+lang+'&route=R1',{waitUntil:'domcontentloaded'});
        await page.locator('[data-select-day="2"]').click();
        assert.match(await page.locator('.bali-day-row[data-day-index="2"]').innerText(),/Uluwatu|乌鲁瓦图/);
        await page.locator('[data-open-place-picker="2"]').click();
        await page.mouse.move(0,0);
        const choices = page.locator('[data-picker-poi]');
        assert.equal(await choices.first().getAttribute('data-picker-poi'),'suluban_beach');
        await choices.nth(1).click();
        assert.equal(await page.locator('[data-picker-poi][aria-selected="true"]').getAttribute('data-picker-poi'),'bingin_beach');
        assert.match(await page.locator('#bali-route-picker-preview-title').innerText(),/Bingin/);
        await page.locator('#bali-route-picker-preview img').evaluate(img=>img.decode());
        await page.mouse.move(0,0);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        if (process.env.WM_CLARITY_QUICK) console.log(await choices.evaluateAll(nodes=>nodes.slice(0,2).map(n=>({id:n.dataset.pickerPoi,selected:n.getAttribute('aria-selected'),background:getComputedStyle(n).backgroundColor,focus:n.matches(':focus-visible')}))));
        if (lang==='zh') await page.screenshot({path:path.join(artifacts,'picker-'+width+'.png')});
        await page.locator('[data-route-picker-confirm]').click();
        const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('wm_bali_route_plans_v1')));
        assert.ok(saved.R1.days[2].place_ids.includes('bingin_beach'));
        await page.reload({waitUntil:'domcontentloaded'});
        await page.locator('[data-select-day="2"]').click();
        assert.match(await page.locator('.bali-day-row[data-day-index="2"]').innerText(),/Bingin/);
        await page.locator('[data-open-place-picker="2"]').click();
        assert.equal(await page.locator('[data-picker-poi="bingin_beach"]').count(),0);
        await page.locator('.bali-route-picker-close').click();
        const alignment=await page.locator('.bali-day-row.active a.bali-day-select').evaluate(n=>({display:getComputedStyle(n).display,align:getComputedStyle(n).alignItems,justify:getComputedStyle(n).justifyContent,height:n.getBoundingClientRect().height}));
        assert.deepEqual([alignment.display,alignment.align,alignment.justify],['flex','center','center']);
        assert.ok(alignment.height>=44);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
        assert.deepEqual(errors,[]);
        matrix.push({width,lang,selection:'bingin_beach',savedAndReloaded:true,overflow:0,errors:0,alignment});
        await page.close();
      }
    }
    fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(matrix,null,2));
    console.log('Clarity Browser: '+matrix.length+' cases; explicit selection/preview/save/reload, day3 Uluwatu, centered CTA, zero overflow/errors. Local deterministic evidence.');
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

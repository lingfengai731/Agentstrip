const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../wandermind-studio/frontend'),out=process.env.WM_ROUTE_REPAIR_OUTPUT;
if(!out)throw Error('WM_ROUTE_REPAIR_OUTPUT required');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream');res.end(d);});});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'chrome'}),report=[];
 try{
  for(const width of [390,768,1440])for(const id of ['R1','R2','R3','R4','R5','R6']){
   const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base+'/bali.html?lang=zh&route='+id,{waitUntil:'domcontentloaded'});await p.locator('.bali-day-select').first().waitFor();
   const actions=[];
   for(let i=0;i<await p.locator('[data-select-day]').count();i++){
    await p.locator('[data-select-day]').nth(i).click();
    actions.push(await p.locator('a.bali-day-select').nth(i).evaluate(n=>({text:n.textContent,height:n.getBoundingClientRect().height,align:getComputedStyle(n).alignItems,justify:getComputedStyle(n).justifyContent})));
   }
   assert.ok(actions.every(a=>a.text==='为当天选餐厅'&&a.height>=44&&a.align==='center'&&a.justify==='center'),JSON.stringify(actions));
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
   await p.locator('.bali-route-detail').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,id+'-'+width+'.png')});
   await p.locator('[data-select-day]').first().click();
   const pick=p.locator('.bali-day-row.active [data-open-place-picker]:not([disabled])').first();
   if(await pick.count()){await pick.click();assert.ok(await p.locator('[role="dialog"]').last().isVisible());await p.keyboard.press('Escape');}
   assert.deepEqual(errors,[]);report.push({width,route:id,days:actions.length,overflow:0,errors:0});await p.close();
  }
 }finally{await browser.close();server.close();fs.writeFileSync(path.join(out,'web-route-repair.json'),JSON.stringify(report,null,2));}
 console.log('Web route repair:18 route/viewport combinations passed; centered restaurant actions, nearby picker,zero overflow/errors.');
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

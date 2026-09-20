// Native public navigation only. No account/order/driver writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=process.env.WM_REPAIR_NATIVE_OUTPUT;
if(!output){console.log('Native repair QA skipped: set WM_REPAIR_NATIVE_OUTPUT');process.exit(0);}
const auto=require(process.env.WM_MINI_AUTOMATOR || 'miniprogram-automator');
(async()=>{
 const mini=await auto.connect({wsEndpoint:process.env.WM_MINI_WS || 'ws://127.0.0.1:9421'});
 const report={scope:'Native simulator SDK event callbacks, layout and real image requests; not physical touch or phone acceptance; no production writes',errors:[],routes:[],gallery:[]};
 mini.on('exception',e=>report.errors.push(String(e.message||e)));
 let original='zh';
 fs.mkdirSync(output,{recursive:true});
 try{
  await new Promise(r=>setTimeout(r,3000));
  original=await mini.evaluate(()=>getApp().globalData.currentLang);
  const width=(await mini.systemInfo()).windowWidth;
  for(const lang of ['zh','en','ja','ko','id']){
   await mini.evaluate(l=>{getApp().globalData.currentLang=l;},lang);
   let page=await mini.reLaunch('/pages/itinerary/itinerary');await page.waitFor(1500);
   assert.equal(await page.data('loading'),false);assert.equal(await page.data('error'),'');
   for(const route of await page.data('routes')){
    await page.callMethod('selectRoute',{currentTarget:{dataset:{id:route.id}}});await page.waitFor(80);
    const controls=await page.$$('.public-card button');
    for(const button of controls){const size=await button.size(),offset=await button.offset();assert.ok(size.height>=43.5 && offset.left>=-1 && offset.left+size.width<=width+1,JSON.stringify({lang,route:route.id,size,offset,width}));}
    report.routes.push({lang,route:route.id,buttons:controls.length,days:route.days.length});
   }
   await page.callMethod('selectRoute',{currentTarget:{dataset:{id:'R1'}}});
   await mini.pageScrollTo(420);await page.waitFor(100);
   await mini.screenshot({path:path.join(output,'days-'+lang+'.png')});
   await page.callMethod('toggleExtensions');await mini.pageScrollTo(100000);await page.waitFor(120);
   await mini.screenshot({path:path.join(output,'extensions-'+lang+'.png')});
   // Follow the actual public gallery button rather than launching the destination directly.
   await mini.pageScrollTo(0);await page.waitFor(300);await (await page.$('.gallery-link')).trigger('tap');await new Promise(r=>setTimeout(r,1500));
   page=await mini.currentPage();assert.equal(page.path,'pages/gallery/gallery');
   await page.waitFor(5000);const data=await page.data();assert.ok(data.assets.length>=59);assert.equal(data.loading,false);
   for(const filter of ['landscapes','culture','experiences','foodDining','all']){
    await page.callMethod('chooseFilter',{currentTarget:{dataset:{id:filter}}});assert.equal(await page.data('filter'),filter);
   }
   await page.waitFor(1500);await mini.screenshot({path:path.join(output,'gallery-'+lang+'.png')});
   const visible=await page.data('visibleAssets');assert.ok(visible.some(x=>x.imageLoaded),'No actual loaded images '+lang);
   report.gallery.push({lang,total:data.totalCount,shown:visible.length,loaded:visible.filter(x=>x.imageLoaded).length,notice:data.updateNotice});
   await (await page.$('.gallery-card')).trigger('tap');
   for(let i=0;i<15;i++){await new Promise(r=>setTimeout(r,300));if((await mini.currentPage()).path==='pages/place/place')break;}
   page=await mini.currentPage();assert.equal(page.path,'pages/place/place');assert.ok(await page.data('place'));
  }
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.message;throw e;}
 finally{
  await mini.evaluate(l=>{getApp().globalData.currentLang=l;},original).catch(()=>{});
  fs.writeFileSync(path.join(output,'native-repair.json'),JSON.stringify(report,null,2));await mini.disconnect();
 }
 console.log('Native repair:30 route layouts,5 gallery/filter/detail flows,real image loads passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

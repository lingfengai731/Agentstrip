// Opt-in SDK tap acceptance. LIVE enables public GETs only; no payments/submissions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=process.env.WM_FOOD_FILTER_OUTPUT;
const live=process.env.WM_FOOD_FILTER_LIVE==='1';
if(!output){console.log('Native Food filter taps skipped: set WM_FOOD_FILTER_OUTPUT');process.exit(0);}
const automator=require(process.env.WM_MINI_AUTOMATOR || 'miniprogram-automator');
const catalogs={};for(const name of ['bali-travel-data','bali-extensions','bali-food'])catalogs[name]=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../wandermind-studio/frontend/assets/data',name+'.json'),'utf8'));
(async()=>{
  const mini=await automator.connect({wsEndpoint:process.env.WM_MINI_WS || 'ws://127.0.0.1:9421'});
  fs.mkdirSync(output,{recursive:true});const report={surface:'DevTools native SDK actual button.tap; not physical phone',catalogMode:live?'real public network + shipped snapshot':'injected catalogs',matrix:[],errors:[]};
  const capture=async name=>{if(process.env.WM_NATIVE_NO_SCREENSHOT==='1'){report.screenshots='SDK capture unavailable; independent Computer Use inspection';return;}await mini.screenshot({path:path.join(output,name)});};
  mini.on('exception',e=>report.errors.push(String(e.message || e)));
  try {
    report.step='catalog injection';console.log(report.step);
    await mini.evaluate(function(catalogs){const app=getApp();app.__filterQA={lang:app.globalData.currentLang,request:wx.request};app.globalData.currentLang='zh';if(!catalogs)return;wx.request=function(o){const name=Object.keys(catalogs).find(k=>o.url.includes('/'+k+'.json'));Promise.resolve().then(()=>{if(name)o.success({statusCode:200,data:catalogs[name]});else if(o.fail)o.fail({errMsg:'blocked by read-only filter QA'});});return {abort(){}};};},live?null:catalogs);
    for(const lang of (process.env.WM_FOOD_FILTER_SCROLL_ONLY ? [] : ['zh','en','ja','ko','id'])){
      report.step='launch '+lang;console.log(report.step);
      await mini.evaluate(function(lang){getApp().globalData.currentLang=lang;},lang);
      const page=await mini.reLaunch('/pages/food/food');await page.waitFor(700);
      assert.equal(await page.data('loading'),false);assert.equal(await page.data('error'),'');
      report.step='screenshot '+lang;console.log(report.step);
      await capture('food-'+lang+'.png');
      for(const key of ['regionIndex','categoryIndex','cuisineIndex','sceneIndex','budgetIndex','mealIndex']){
        report.step=lang+' '+key;console.log(report.step);
        const control=await page.$('button.control[data-key="'+key+'"]');assert.ok(control,key);
        const size=await control.size();assert.ok(size.height>=43.5,key+' 44px');
        await control.tap();await page.waitFor(120);assert.equal(await page.data('filterOpen'),true,key+' actual tap opens');
        assert.equal(await page.data('filterKey'),key);const options=await page.data('filterOptions');assert.ok(options.length>1);
        if(key==='cuisineIndex')await capture('cuisine-sheet-'+lang+'.png');
        await (await page.$('.filter-option[data-index="1"]')).tap();await page.waitFor(120);
        assert.equal(await page.data(key),1);assert.equal(await page.data('filterOpen'),false);
        // Reset via UI, not Page.setData: confirms selected feedback and cancel.
        await control.tap();await page.waitFor(100);assert.equal(await page.data('filterSelected'),1);
        await (await page.$('.filter-close')).tap();await page.waitFor(100);assert.equal(await page.data(key),1);assert.equal(await page.data('filterOpen'),false);
        await control.tap();await page.waitFor(100);await (await page.$('.filter-option[data-index="0"]')).tap();await page.waitFor(100);
        assert.equal(await page.data(key),0);report.matrix.push({lang,key,options:options.length,height:size.height,opened:true,selected:true,cancelPreserved:true,reset:true,candidates:(await page.data('items')).length});
      }
    }
    assert.equal(report.matrix.length,process.env.WM_FOOD_FILTER_SCROLL_ONLY ? 0 : 30);
    await mini.evaluate(function(){getApp().globalData.currentLang='en';});
    const page=await mini.reLaunch('/pages/food/food');await page.waitFor(600);
    await (await page.$('button.control[data-key="cuisineIndex"]')).tap();await page.waitFor(100);
    const options=await page.data('filterOptions'),last=options.length-1;
    await (await page.$('.filter-options')).scrollTo(0,10000);await page.waitFor(200);
    await capture('long-list-bottom.png');
    await (await page.$('.filter-option[data-index="'+last+'"]')).tap();await page.waitFor(150);
    assert.equal(await page.data('cuisineIndex'),last);assert.equal(await page.data('filterOpen'),false);
    await (await page.$('button.control[data-key="cuisineIndex"]')).tap();await page.waitFor(100);
    await (await page.$('.filter-backdrop')).tap();await page.waitFor(100);
    assert.equal(await page.data('filterOpen'),false);assert.equal(await page.data('cuisineIndex'),last);
    report.longList={options:options.length,lastSelection:last,scrollable:true,backdropCancelPreserved:true};assert.deepEqual(report.errors,[]);
  }catch(e){report.failure=e.message;throw e;}finally{
    await mini.evaluate(function(){const app=getApp(),s=app.__filterQA;if(s){app.globalData.currentLang=s.lang;wx.request=s.request;delete app.__filterQA;}}).catch(e=>report.errors.push(e.message));
    fs.writeFileSync(path.join(output,process.env.WM_FOOD_FILTER_SCROLL_ONLY ? 'native-filter-scroll.json' : 'native-filter-taps.json'),JSON.stringify(report,null,2));mini.disconnect();
  }
  console.log('Native Food: '+report.matrix.length+' filter callbacks and long-list scroll passed; catalog mode: '+report.catalogMode);
})().catch(e=>{console.error(e);process.exitCode=1;});

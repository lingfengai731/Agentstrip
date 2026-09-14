// Opt-in SDK tap acceptance; no live requests, payments or driver submissions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=process.env.WM_FOOD_FILTER_OUTPUT;
if(!output){console.log('Native Food filter taps skipped: set WM_FOOD_FILTER_OUTPUT');process.exit(0);}
const automator=require(process.env.WM_MINI_AUTOMATOR || 'miniprogram-automator');
const catalogs={};for(const name of ['bali-travel-data','bali-extensions','bali-food'])catalogs[name]=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../wandermind-studio/frontend/assets/data',name+'.json'),'utf8'));
(async()=>{
  const mini=await automator.connect({wsEndpoint:process.env.WM_MINI_WS || 'ws://127.0.0.1:9421'});
  fs.mkdirSync(output,{recursive:true});const report={surface:'DevTools native SDK actual button.tap; not physical phone or production',matrix:[],errors:[],liveRequests:0};
  mini.on('exception',e=>report.errors.push(String(e.message || e)));
  try {
    report.step='catalog injection';console.log(report.step);
    await mini.evaluate(function(catalogs){const app=getApp();app.__filterQA={lang:app.globalData.currentLang,request:wx.request};app.globalData.currentLang='zh';wx.request=function(o){const name=Object.keys(catalogs).find(k=>o.url.includes('/'+k+'.json'));Promise.resolve().then(()=>{if(name)o.success({statusCode:200,data:catalogs[name]});else if(o.fail)o.fail({errMsg:'blocked by read-only filter QA'});});return {abort(){}};};},catalogs);
    for(const lang of (process.env.WM_FOOD_FILTER_SCROLL_ONLY ? [] : ['zh','en','ja','ko','id'])){
      report.step='launch '+lang;console.log(report.step);
      await mini.evaluate(function(lang){getApp().globalData.currentLang=lang;},lang);
      const page=await mini.reLaunch('/pages/food/food');await page.waitFor(700);
      assert.equal(await page.data('loading'),false);assert.equal(await page.data('error'),'');
      report.step='screenshot '+lang;console.log(report.step);
      await mini.screenshot({path:path.join(output,'food-'+lang+'.png')});
      for(const key of ['regionIndex','categoryIndex','cuisineIndex','sceneIndex','budgetIndex','mealIndex']){
        report.step=lang+' '+key;console.log(report.step);
        const control=await page.$('button.control[data-key="'+key+'"]');assert.ok(control,key);
        const size=await control.size();assert.ok(size.height>=43.5,key+' 44px');
        await control.tap();await page.waitFor(120);assert.equal(await page.data('filterOpen'),true,key+' actual tap opens');
        assert.equal(await page.data('filterKey'),key);const options=await page.data('filterOptions');assert.ok(options.length>1);
        if(key==='cuisineIndex')await mini.screenshot({path:path.join(output,'cuisine-sheet-'+lang+'.png')});
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
    await mini.screenshot({path:path.join(output,'long-list-bottom.png')});
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
  console.log(process.env.WM_FOOD_FILTER_SCROLL_ONLY ? 'Native Food: long list scroll/last option/backdrop cancel passed; no live requests' : 'Native Food: 30 actual filter tap/open/select/cancel/reset callbacks passed,5 languages, long list; no live requests');
})().catch(e=>{console.error(e);process.exitCode=1;});

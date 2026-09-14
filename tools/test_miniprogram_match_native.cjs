// Native controls + ONE disposable anonymous production match. No real user
// session, payment, adjustment, driver email or admin action is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(!process.env.WM_MATCH_NATIVE_OUTPUT){console.log('Match native QA skipped: explicit output/DevTools required.');process.exit(0);}
const automator=require(process.env.WM_MINI_AUTOMATOR || 'miniprogram-automator');
const out=process.env.WM_MATCH_NATIVE_OUTPUT;
const report={scope:'Native SDK controls, injected silent request, one REAL anonymous production POST; recent-unlocked response locally intercepted. Not a real buyer account acceptance.',checks:[],errors:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));let mini;
async function ready(page,key,predicate,seconds=25){for(let i=0;i<seconds*5;i++){const v=await page.data(key);if(predicate(v))return v;await wait(200);}throw Error('Native timeout: '+key);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});mini=await automator.connect({wsEndpoint:process.env.WM_MINI_WS || 'ws://127.0.0.1:9421'});
 mini.on('exception',e=>report.errors.push(String(e.message || e)));
 try{
  report.step='initialize Me page';console.log(report.step);
  await mini.reLaunch('/pages/me/me');await wait(700);
  report.step='isolated synthetic QA setup';console.log(report.step);
  await mini.evaluate(function(){
   const app=getApp();app.__matchSnapshot={...app.globalData};
   app.__matchStorage=['wm_professional_route','wm_planner_draft_qa-match-native'].map(key=>({key,value:wx.getStorageSync(key),exists:wx.getStorageInfoSync().keys.includes(key)}));
   app.globalData.user={id:'qa-match-native',name:'QA',email:''};app.globalData.token='synthetic-local-only';app.globalData.currentLang='zh';app.globalData.professionalRoute=null;
   app.__matchQA={mode:'silent',calls:[],navigation:[],aborts:0,anon:'qa-match-'+Date.now()};app.__matchRequest=wx.request;
   app.__matchNavigate=wx.navigateTo;
   wx.navigateTo=function(o){app.__matchQA.navigation.push({url:o.url});return app.__matchNavigate({...o,fail(e){app.__matchQA.navigation.push({error:e.errMsg});if(o.fail)o.fail(e);}});};
   wx.request=function(options){
    if(options.url.includes('/api/bali/professional-route/recent-unlocked')){
      setTimeout(()=>options.success({statusCode:200,data:{trip_id:'old-paid-trip',route:{unlocked:true}}}),300);return {abort(){}};
    }
    if(options.url.endsWith('/api/bali/professional-route')){
      app.__matchQA.calls.push({mode:app.__matchQA.mode,started:Date.now()});
      if(app.__matchQA.mode==='silent')return {abort(){app.__matchQA.aborts++;}};
      const header={...options.header,'X-Anon-Id':app.__matchQA.anon};delete header.Authorization;
      const started=Date.now();return app.__matchRequest({...options,header,success(res){
        app.__matchQA.result={status:res.statusCode,ms:Date.now()-started,trip_id:res.data.trip_id};options.success(res);
      }});
    }
    if(options.url.includes('/api/')){
      setTimeout(()=>options.success({statusCode:404,data:{detail:'QA blocked protected action'}}),0);return {abort(){}};
    }
    return app.__matchRequest(options);
   };
  });
  for(const lang of ['zh','en','ja','ko','id']){
    report.step='Me menu '+lang;console.log(report.step);
    await mini.evaluate(function(lang){getApp().globalData.currentLang=lang;},lang);
    const page=await mini.reLaunch('/pages/me/me');await wait(350);
    const food=await page.$('.food-row'),logout=await page.$('.logout-btn');
    const box=await food.offset(),last=await logout.offset(),size=await food.size();
    assert.ok(box.top<last.top);assert.ok(size.height>=44);
    await mini.screenshot({path:path.join(out,'me-'+lang+'.png')});
    // SDK coordinate taps did not dispatch on this runtime. Explicit native
    // event tests the handler, not a physical-phone touch acceptance.
    await food.trigger('tap');await wait(500);
    let event='SDK trigger(tap), physical touch pending';
    if((await mini.currentPage()).path!=='pages/food/food'){
      report.navigationDiagnostic=await mini.evaluate(function(){return getApp().__matchQA.navigation;});
      await page.callMethod('openFood');await wait(600);
      event='SDK Page.callMethod only; tap/trigger did not dispatch; physical touch pending';
    }
    assert.equal((await mini.currentPage()).path,'pages/food/food');
    report.checks.push({case:'Me dining above logout',lang,height:size.height,navigated:true,event});
  }
  await mini.evaluate(function(){getApp().globalData.currentLang='zh';});
  report.step='native planner timeout';console.log(report.step);
  let page=await mini.navigateTo('/pages/planner/planner?routeId=R1');await wait(300);
  await page.setData({departureDate:'2026-10-10',returnDate:'2026-10-17'});
  const started=Date.now();await (await page.$('.submit')).tap();await wait(250);
  if(!await page.data('busy')){await (await page.$('.submit')).trigger('tap');report.submitFallback='SDK tap did not dispatch; explicit native event fallback used';}
  assert.equal(await page.data('busy'),true);
  await (await page.$('.submit')).trigger('tap');
  await ready(page,'busy',v=>v===false,20);
  assert.match(await page.data('error'),/超时/);assert.equal(await page.data('departureDate'),'2026-10-10');
  const qa=await mini.evaluate(function(){return {calls:getApp().__matchQA.calls.length,aborts:getApp().__matchQA.aborts};});
  assert.equal(qa.calls,1);assert.equal(qa.aborts,1);
  await mini.screenshot({path:path.join(out,'match-timeout.png')});
  report.checks.push({case:'silent timeout + duplicate prevention',ms:Date.now()-started,requests:qa.calls,aborts:qa.aborts,inputRetained:true});
  await mini.evaluate(function(){getApp().__matchQA.mode='real';});
  report.step='real anonymous production match';console.log(report.step);
  await (await page.$('.submit')).trigger('tap');
  for(let i=0;i<100;i++){const current=await mini.currentPage();if(current.path==='pages/itinerary/itinerary'){page=current;break;}await wait(200);}
  assert.equal(page.path,'pages/itinerary/itinerary');await wait(600);
  const payload=await page.data('professional'),result=await mini.evaluate(function(){return getApp().__matchQA.result;});
  assert.equal(result.status,200);assert.equal(payload.trip_id,result.trip_id);
  assert.equal(payload.route.days_plan.length,7);assert.equal(payload.route.days_plan.filter(d=>d.locked).length,2);
  assert.notEqual(payload.trip_id,'old-paid-trip');await mini.screenshot({path:path.join(out,'match-real-result.png')});
  report.checks.push({case:'REAL anonymous match + result navigation + old-trip isolation',...result,openDays:5,lockedDays:2});
 }catch(e){report.failure=e.message;throw e;}
 finally{
   await mini.evaluate(function(){const app=getApp();if(app.__matchRequest)wx.request=app.__matchRequest;
    if(app.__matchStorage)app.__matchStorage.forEach(s=>{if(s.exists)wx.setStorageSync(s.key,s.value);else wx.removeStorageSync(s.key);});
    if(app.__matchSnapshot)app.globalData=app.__matchSnapshot;
    if(app.__matchNavigate)wx.navigateTo=app.__matchNavigate;
    delete app.__matchNavigate;delete app.__matchRequest;delete app.__matchStorage;delete app.__matchSnapshot;delete app.__matchQA;
   }).catch(e=>report.errors.push('restore: '+e.message));
   fs.writeFileSync(path.join(out,'match-native.json'),JSON.stringify(report,null,2));mini.disconnect();
 }
 assert.equal(report.errors.length,0);console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});

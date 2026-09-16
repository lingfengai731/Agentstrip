// Opt-in native public-data failure injection. No account/order/payment writes.
const output=process.env.WM_PUBLIC_NATIVE_OUTPUT;
if(!output){console.log('Public native QA skipped: explicit output and fresh DevTools automation required');process.exit(0);}
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require(process.env.WM_MINI_AUTOMATOR || 'miniprogram-automator');
(async()=>{
 const mini=await automator.connect({wsEndpoint:'ws://127.0.0.1:9421'});
 const report={scope:'DevTools native with public JSON/Portfolio GET failures injected; images and private API are not mocked. Not physical-phone offline acceptance.',pages:[],exceptions:[]};
 mini.on('exception',e=>report.exceptions.push(String(e.message||e)));
 try{
  await mini.evaluate(function(){const app=getApp();app.__publicQA={request:wx.request,calls:0};wx.request=function(o){if(/\/assets\/data\/|\/api\/portfolio\?/.test(o.url)){app.__publicQA.calls++;setTimeout(()=>o.fail({errMsg:'request:fail simulated offline'}),0);return {abort(){}};}return app.__publicQA.request(o);};});
  for(const name of ['itinerary','food','gallery']){
   const started=Date.now(),page=await mini.reLaunch('/pages/'+name+'/'+name);await page.waitFor(250);
   const d=await page.data();assert.equal(d.loading,false,name+' must not wait for network');
   const count=(d.routes||d.items||d.assets).length;assert.ok(count>=({itinerary:6,food:30,gallery:40}[name]));
   if(name==='food'){await (await page.$('button.control[data-key="regionIndex"]')).tap();await page.waitFor(150);assert.equal(await page.data('filterOpen'),true);await (await page.$('.filter-close')).tap();}
   report.pages.push({name,count,loading:false,firstObservedMs:Date.now()-started,error:d.error||'',note:'Host duration includes SDK navigation/poll overhead; not network request latency'});
  }
  report.injectedRequests=await mini.evaluate(function(){return getApp().__publicQA.calls;});
  assert.ok(report.injectedRequests>=5,'Run against fresh app, not warm catalog cache');assert.deepEqual(report.exceptions,[]);
 }catch(e){report.failure=e.message;throw e;}
 finally{
  await mini.evaluate(function(){const app=getApp();if(app.__publicQA){wx.request=app.__publicQA.request;delete app.__publicQA;}}).catch(e=>report.restoreFailure=e.message);
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'public-native.json'),JSON.stringify(report,null,2));mini.disconnect();
 }
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});

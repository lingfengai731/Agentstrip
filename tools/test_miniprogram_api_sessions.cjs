const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
(async()=>{
 for(const lang of ['zh','en','ja','ko','id']) {
  const pending=[],toasts=[];let redirects=0;
  const app={globalData:{token:'one',currentLang:lang,apiBase:'https://example.test'},rememberCurrentRoute(){},clearAuth(){this.globalData.token='';}};
  const context={getApp:()=>app,module:{exports:{}},require:()=>require('../miniprogram/utils/error-copy.js'),wx:{request:r=>pending.push(r),showToast:t=>toasts.push(t),reLaunch:()=>redirects++}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/utils/api.js'),'utf8'),context);
  const api=context.module.exports, copy=require('../miniprogram/utils/error-copy.js')[lang];
  const a=api.me().catch(e=>e), b=api.me().catch(e=>e);
  assert.equal(pending[0].header.Authorization,'Bearer one');
  pending.shift().success({statusCode:401});pending.shift().success({statusCode:401});
  assert.equal((await a).message,copy.expired);assert.equal((await b).message,copy.changed);
  assert.equal(redirects,1,'concurrent expiry must redirect once');
  app.globalData.token='old';const c=api.me().catch(e=>e);app.globalData.token='new';
  pending.shift().success({statusCode:200,data:{id:'old'}});assert.equal((await c).message,copy.changed);
  assert.equal(app.globalData.token,'new');
  const d=api.me().catch(e=>e);pending.shift().fail({errMsg:'request:fail'});assert.equal((await d).message,copy.network);
 }
 console.log('API sessions: five-language network/expiry feedback, Bearer token, single expiry redirect and stale account response rejection passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

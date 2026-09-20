const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const network=require('../miniprogram/utils/network-check.js');
for(const lang of ['zh','en','ja','ko','id'])assert.deepEqual(Object.keys(network.COPY[lang]),Object.keys(network.COPY.zh));
assert.equal(network.classify({errMsg:'downloadFile:fail url not in domain list'}),'DOMAIN');
assert.equal(network.classify({errMsg:'request:fail timeout'}),'TIMEOUT');
assert.equal(network.classify({errMsg:'SSL certificate'}),'TLS');
assert.equal(network.retryUrl('https://a/p.webp?v=1&wm_retry=2',3),'https://a/p.webp?v=1&wm_retry=3');
assert.equal(network.retryUrl('https://a/p.webp?wm_retry=2',3),'https://a/p.webp?wm_retry=3');
const home=read('miniprogram/pages/index/index.wxml');
assert.ok(home.indexOf('bindtap="openGallery"')<home.indexOf('bindtap="openFood"'));
assert.ok(home.indexOf('bindtap="openFood"')<home.indexOf('bindtap="doLogout"'));
for(const page of ['gallery','place']){
 const wxml=read('miniprogram/pages/'+page+'/'+page+'.wxml');
 assert.match(wxml,/webp="{{true}}"/);assert.doesNotMatch(wxml,/<image wx:if="{{!item.imageFailed}}"/,'Slow image must remain mounted for late load');
 assert.match(wxml,/bindload="markImageLoaded"/);assert.match(wxml,/catchtap="retryImage"/);
}
assert.equal(JSON.parse(read('miniprogram/project.config.json')).setting.urlCheck,true);
assert.equal(JSON.parse(read('miniprogram/project.private.config.json')).setting.urlCheck,true);
(async()=>{
 let pending=[],deadlines=[],modal,copy;
 const app={globalData:{currentLang:'zh',apiBase:'https://example.invalid',token:'MUST_NOT_SEND',user:{id:'MUST_NOT_SEND'}}};
 const ctx={module:{exports:{}},getApp:()=>app,setTimeout:fn=>{deadlines.push(fn);return deadlines.length;},clearTimeout(){},
 wx:{request:o=>{pending.push(o);return{abort(){}};},downloadFile:o=>{pending.push(o);return{abort(){}};},showModal:o=>modal=o,setClipboardData:o=>copy=o.data}};
 vm.runInNewContext(read('miniprogram/utils/network-check.js'),ctx);
 const n=ctx.module.exports,p=n.checkConnection('https://images.invalid/a.webp');
 assert.equal(pending.length,2);pending.forEach(o=>{assert.equal(o.header,undefined);assert.equal(o.data,undefined);assert.equal(o.timeout,10000);});
 pending[0].success({statusCode:200});pending[1].fail({errMsg:'downloadFile:fail url not in domain list'});
 await p;assert.match(modal.content,/\[OK\]/);assert.match(modal.content,/\[DOMAIN\]/);assert.match(modal.content,/downloadFile/);assert.ok(!modal.content.includes('MUST_NOT_SEND'));
 modal.success({confirm:true});assert.equal(copy,modal.content);
 const p2=n.checkConnection();deadlines.at(-1)();await p2;assert.match(modal.content,/TIMEOUT/);
 let planner,finish,owner='a',writes=0;
 const plannerApp={globalData:{currentLang:'zh'},privateStorageKey:()=>owner,setProfessionalRoute(){writes++;}};
 vm.runInNewContext(read('miniprogram/pages/planner/planner.js'),{getApp:()=>plannerApp,Page:p=>planner=p,Date,
 require:p=>p.includes('network-check')?network:p==='./copy.js'?require('../miniprogram/pages/planner/copy.js'):{createProfessionalRoute:()=>new Promise(r=>finish=r)},
 wx:{getStorageSync:()=>({}),setStorageSync(){},showToast(){},switchTab(){}}});
 planner.setData=o=>Object.assign(planner.data,o);planner.data.departureDate='2026-10-01';planner.data.returnDate='2026-10-06';
 const submit=planner.submit();owner='b';finish({});await submit;assert.equal(writes,0);assert.equal(planner.data.busy,true,'Old owner must not clear new owner status');
 owner='a';planner.data.busy=false;const submit2=planner.submit();planner.onUnload();finish({});await submit2;assert.equal(writes,0);
 console.log('Phone network: 5locale copy,diagnostic domain/timeout/TLS,credential-free probes,silent deadline,late-image DOM,small retry,home order,account/unload guards passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

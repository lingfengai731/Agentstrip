// Local catalog injection only: native rendering evidence, not production API evidence.
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.WM_FOOD_NATIVE_OUTPUT;
if(!output){console.log('Food native QA skipped: set WM_FOOD_NATIVE_OUTPUT and connect DevTools.');process.exit(0);}
const automator=require(process.env.WM_MINI_AUTOMATOR || 'miniprogram-automator');
const root=path.resolve(__dirname,'../wandermind-studio/frontend/assets/data');
const catalogs={};for(const name of ['bali-travel-data','bali-extensions','bali-food'])catalogs[name]=JSON.parse(fs.readFileSync(path.join(root,name+'.json'),'utf8'));
const limit=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error(label+' timeout')),15000))]);
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const mini=await limit(automator.connect({wsEndpoint:process.env.WM_MINI_WS || 'ws://127.0.0.1:9421'}),'connect');
  const report={scope:'Guest native simulator using local catalog snapshots; no payment, account, message or production writes',matrix:[],errors:[]};
  mini.on('exception',error=>report.errors.push(String(error.message || error)));
  try {
    await mini.evaluate(function(catalogs){
      const app=getApp();app.__foodQASnapshot={...app.globalData};app.globalData.token='';app.globalData.user=null;app.globalData.professionalRoute=null;app.globalData.currentDest='bali';
      app.__foodQAStorage=['wm_public_route_plans','wm_bali_route_selection','wm_itinerary_context','wm_chat_state','wm_open_conversation'].map(name=>{const key=app.privateStorageKey(name);return {key,exists:wx.getStorageInfoSync().keys.includes(key),value:wx.getStorageSync(key)};});
      app.__foodQAStorage.forEach(item=>wx.removeStorageSync(item.key));
      app.__foodQARequest=wx.request;
      wx.request=function(options){
        const name=Object.keys(catalogs).find(key=>options.url.indexOf('/'+key+'.json')>=0);
        if(!name)return app.__foodQARequest(options);
        Promise.resolve().then(()=>options.success({statusCode:200,data:catalogs[name]}));return {abort(){}};
      };
    },catalogs);
    const sys=await mini.systemInfo();report.width=sys.windowWidth;
    for(const lang of (process.env.WM_FOOD_NATIVE_RECEIVERS_ONLY ? [] : ['zh','en','ja','ko','id'])){
      await mini.evaluate(function(language){getApp().globalData.currentLang=language;},lang);
      const page=await limit(mini.reLaunch('/pages/food/food?routeId=R1&day=0'),'launch '+lang);
      await page.waitFor(600);
      if(await page.data('loading') || await page.data('error'))throw Error('Catalog/page not ready '+lang);
      const items=await page.data('items');if(!items.length)throw Error('No day candidates '+lang);
      const buttons=await page.$$('button');
      const sizes=await Promise.all(buttons.map(async button=>{const [size,offset]=await Promise.all([button.size(),button.offset()]);return {...size,left:offset.left,right:offset.left+size.width};}));
      if(sizes.some(size=>size.height<43.5 || size.left< -1 || size.right>sys.windowWidth+1))throw Error('Native control layout failure '+lang);
      await mini.screenshot({path:path.join(output,'food-'+lang+'.png')});
      report.matrix.push({lang,width:sys.windowWidth,candidates:items.length,buttons:buttons.length,minHeight:Math.min(...sizes.map(size=>size.height))});
    }
    await mini.evaluate(function(){getApp().globalData.currentLang='en';});
    let route=await limit(mini.reLaunch('/pages/itinerary/itinerary'),'route receiver');await route.waitFor(600);
    await route.callMethod('toggleExtensions');
    for(const id of ['penida-west','penida-east','penida-snorkeling']){
      const button=await route.$('.extension-card button[data-id="'+id+'"]');
      if(!button)throw Error('Missing native extension '+id);
      await button.tap();await route.waitFor(350);
    }
    const selected=await route.data('selected');
    if(selected.days.length!==11 || selected.modules.filter(item=>item.selected).length!==3)throw Error('Native extension day separation failed');
    await mini.screenshot({path:path.join(output,'itinerary-extensions.png')});
    let dining=await mini.reLaunch('/pages/food/food?routeId=R1&day=8');await dining.waitFor(600);
    const islandItems=await dining.data('items');if(!islandItems.length)throw Error('No west lunch candidates');
    await mini.pageScrollTo(500);await dining.waitFor(150);
    await (await dining.$('.food-card .add')).tap();await dining.waitFor(150);
    route=await mini.reLaunch('/pages/itinerary/itinerary');await route.waitFor(600);
    const after=await route.data('selected'),stop=after.days[8].food[0];
    if(!stop || stop.id!==islandItems[0].id)throw Error('Native dining storage/route receiver failed');
    report.receivers={modules:3,days:11,diningDay:9,restaurant:stop.name,storageRestoredOnFinish:false,aiDraft:false,autoSend:false};
    await mini.pageScrollTo(0);await route.waitFor(100);
    await (await route.$('.hero-actions .ghost')).tap();await new Promise(resolve=>setTimeout(resolve,500));
    let chat,input='';
    for(let attempt=0;attempt<20;attempt++){
      chat=await mini.currentPage();
      if(chat.path==='pages/chat/chat'){input=await chat.data('inputText');if(input.includes(stop.name))break;}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    report.aiProbe={path:chat.path,inputLength:input.length,hasRestaurant:input.includes(stop.name),hasIsland:input.includes('Penida')};
    if(chat.path!=='pages/chat/chat' || !input.includes(stop.name) || !input.includes('Penida'))throw Error('Native editable AI context receiver failed');
    if(await chat.data('busy'))throw Error('AI draft must not auto send');
    await mini.screenshot({path:path.join(output,'chat-dining-draft.png')});
    report.receivers={modules:3,days:11,diningDay:9,restaurant:stop.name,storageRestoredOnFinish:true,aiDraft:true,autoSend:false};
  } catch(error) { report.failure=error.message;throw error; } finally {
    await mini.evaluate(function(){const app=getApp();if(app.__foodQAStorage){app.__foodQAStorage.forEach(item=>{if(item.exists)wx.setStorageSync(item.key,item.value);else wx.removeStorageSync(item.key);});delete app.__foodQAStorage;}if(app.__foodQARequest){wx.request=app.__foodQARequest;delete app.__foodQARequest;}if(app.__foodQASnapshot){app.globalData=app.__foodQASnapshot;delete app.__foodQASnapshot;}}).catch(error=>report.errors.push(error.message));
    report.storageRestoreFailed=report.errors.length>0;
    fs.writeFileSync(path.join(output,'native-food.json'),JSON.stringify(report,null,2));mini.disconnect();
  }
  if(report.errors.length)throw Error(report.errors.join('\n'));
  console.log(process.env.WM_FOOD_NATIVE_RECEIVERS_ONLY ? 'Native receivers: separate extension days, saved dining and editable AI draft passed; language matrix not rerun in this focused lane' : 'Native Food: five languages, local catalogs,44px controls, no measured button overflow and receivers passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

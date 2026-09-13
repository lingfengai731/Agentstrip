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
      const app=getApp();app.__foodQASnapshot={...app.globalData};app.globalData.token='';app.globalData.user=null;app.globalData.professionalRoute=null;
      app.__foodQARequest=wx.request;
      wx.request=function(options){
        const name=Object.keys(catalogs).find(key=>options.url.indexOf('/'+key+'.json')>=0);
        if(!name)return app.__foodQARequest(options);
        Promise.resolve().then(()=>options.success({statusCode:200,data:catalogs[name]}));return {abort(){}};
      };
    },catalogs);
    const sys=await mini.systemInfo();report.width=sys.windowWidth;
    for(const lang of ['zh','en','ja','ko','id']){
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
  } finally {
    await mini.evaluate(function(){const app=getApp();if(app.__foodQARequest){wx.request=app.__foodQARequest;delete app.__foodQARequest;}if(app.__foodQASnapshot){app.globalData=app.__foodQASnapshot;delete app.__foodQASnapshot;}}).catch(error=>report.errors.push(error.message));
    fs.writeFileSync(path.join(output,'native-food.json'),JSON.stringify(report,null,2));mini.disconnect();
  }
  if(report.errors.length)throw Error(report.errors.join('\n'));
  console.log('Native Food: five languages, local catalogs,44px controls, no measured button overflow passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

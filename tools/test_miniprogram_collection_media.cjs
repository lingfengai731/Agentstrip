const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'..'),data=base+'/wandermind-studio/frontend/assets/data/';
const manifest=require(data+'image-publish-manifest.json'),rights=require(data+'image-rights-manifest.json');
const travel=require(data+'bali-travel-data.json'),extensions=require(data+'bali-extensions.json');
const photos=manifest.images.filter(item=>item.approval_status==='approved' && item.publication_status==='pending_deploy');
assert.equal(photos.length,2);
photos.forEach(item=>{
  assert.equal(item.primary_theme,'experiences');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(base+'/wandermind-studio/frontend/'+item.relative_path)).digest('hex'),item.sha256);
  assert.ok(rights.assets.some(asset=>asset.sha256===item.sha256 && asset.publishable && asset.license_url));
  assert.ok(fs.statSync(base+'/wandermind-studio/frontend/'+item.thumbnail_path).size<30000);
});
let exported;
const api={baliRouteData:async()=>travel,baliExtensions:async()=>extensions,baliMediaCatalog:async()=>({images:[]}),imagePublishManifest:async()=>manifest,publicPortfolio:async()=>({assets:[]})};
const context={module:{exports:{}},require:()=>api,Set,Promise,Number};
vm.runInNewContext(fs.readFileSync(base+'/miniprogram/utils/bali-media.js','utf8'),context);exported=context.module.exports;
(async()=>{
  const media=await exported.loadBaliMedia('zh');
  const food=media.gallery.find(item=>item.album==='Food & Dining');assert.ok(food);assert.equal(food.theme,'experiences');assert.equal(food.primaryPoiId,'');assert.equal(food.scope,'destination_context');assert.ok(food.rights.licenseUrl);
  const marine=media.imagesByPoi.penida_snorkeling_session.find(item=>item.album==='Sea & Snorkeling');assert.ok(marine);assert.equal(marine.scope,'experience_context');assert.ok(marine.extensionIds.includes('penida-snorkeling'));
  let page;
  vm.runInNewContext(fs.readFileSync(base+'/miniprogram/pages/gallery/gallery.js','utf8'),{Page:value=>{page=value;},getApp:()=>({globalData:{currentLang:'zh'}}),wx:{},require:name=>name.includes('bali-media')?{}:require(base+'/miniprogram/utils/browse-copy.js')});
  page.data.assets=media.gallery;page.setData=update=>Object.assign(page.data,update);page.applyFilter('foodDining');assert.equal(page.data.visibleAssets.length,1);
  console.log('Native collection media: originals/hash/license/thumbnail,3 themes,Food album,marine context and extension IDs passed; no production claim');
})().catch(error=>{console.error(error);process.exitCode=1;});

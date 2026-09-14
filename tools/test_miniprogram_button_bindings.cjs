// Declaration audit only; this is NOT a claim that every button was clicked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../miniprogram/pages');let files=0,bindings=0;
const missing=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}
 if(!file.endsWith('.wxml'))continue;files++;
 const script=file.slice(0,-5)+'.js';const js=fs.existsSync(script)?fs.readFileSync(script,'utf8'):'';
 for(const hit of fs.readFileSync(file,'utf8').matchAll(/(?:bind|catch)(?::)?(?:tap|change|input|confirm|submit|blur|focus|touchstart|touchend|longpress)\s*=\s*["']([A-Za-z_$][\w$]*)["']/g)){
  bindings++;const handler=hit[1];if(!new RegExp('\\b'+handler+'\\s*(?:\\(|:)').test(js))missing.push(path.relative(root,file)+': '+handler);
 }
}}
walk(root);assert.deepEqual(missing,[],'template events must have a handler in their page');
console.log(`Mini button/event declarations: ${bindings} bindings across ${files} pages resolve; native/live callback coverage is reported separately`);

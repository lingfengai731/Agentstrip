const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mini = path.join(root, 'miniprogram');
const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function walk(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, extension) : (full.endsWith(extension) ? [full] : []);
  });
}

const appConfig = JSON.parse(read('miniprogram/app.json'));
check(appConfig.pages.length >= 10, 'app.json should declare the v1 feature pages');

for (const page of appConfig.pages) {
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
    check(fs.existsSync(path.join(mini, page + ext)), `missing declared page file: ${page}${ext}`);
  }
}

for (const file of walk(mini, '.json')) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { failures.push(`invalid JSON ${path.relative(root, file)}: ${error.message}`); }
  checks += 1;
}

for (const file of walk(mini, '.js')) {
  const source = fs.readFileSync(file, 'utf8');
  try { new vm.Script(source, { filename: file }); }
  catch (error) { failures.push(`invalid JavaScript ${path.relative(root, file)}: ${error.message}`); }
  checks += 1;
}

for (const wxmlFile of walk(mini, '.wxml')) {
  const wxml = fs.readFileSync(wxmlFile, 'utf8');
  const jsFile = wxmlFile.replace(/\.wxml$/, '.js');
  const js = fs.existsSync(jsFile) ? fs.readFileSync(jsFile, 'utf8') : '';
  for (const match of wxml.matchAll(/\b(?:bind|catch)(?:tap|input|change|submit|confirm|longpress)="([A-Za-z_$][\w$]*)"/g)) {
    const handler = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check(new RegExp(`\\b${handler}\\s*(?:\\(|:)`).test(js), `${path.relative(root, wxmlFile)} binds missing handler ${match[1]}`);
  }
  check(!/\.(?:trim|join|indexOf|map|filter)\s*\(/.test(wxml), `${path.relative(root, wxmlFile)} contains a method call inside WXML binding`);
  check(!/open-type="navigateBack"/.test(wxml), `${path.relative(root, wxmlFile)} uses unsupported navigateBack open-type`);
}

const allText = walk(mini, '.js').concat(walk(mini, '.wxml')).map(file => fs.readFileSync(file, 'utf8')).join('\n');
for (const [pattern, label] of [
  [/todo\s*\(/i, 'inert todo handler'],
  [/即将上线|coming soon/i, 'placeholder copy'],
  [/6 位智能体/, 'misleading six-agent claim'],
  [/agentstrip\.onrender\.com/i, 'legacy API host'],
]) check(!pattern.test(allText), `mini-program still contains ${label}`);

const api = read('miniprogram/utils/api.js');
const app = read('miniprogram/app.js');
const auth = read('miniprogram/pages/index/index.js');
const chat = read('miniprogram/pages/chat/chat.js');
const driver = read('miniprogram/pages/driver/driver.js');
const language = read('miniprogram/pages/language/language.js');

check(/apiBase:\s*'https:\/\/wandermind\.cc'/.test(app), 'API base must use the canonical production domain');
check(/timeout:\s*130000/.test(api), 'AI chat timeout must exceed the backend 120-second window');
check(api.includes('/api/auth/send-verification-code'), 'verification-code API wrapper missing');
check(/data:\s*\{\s*email,\s*password,\s*name,\s*code,\s*lang\s*\}/.test(api), 'registration payload must include verification code and language');
check(api.includes('/api/wechat/content-check') && api.includes('wx.login') && api.includes('allowed'), 'WeChat content-safety wrapper missing');
check(api.includes('_chunkUtf8') && api.includes('chunks[index]') && api.includes('checkChunk(index + 1)'), 'content safety must inspect every UTF-8 chunk');
check(auth.includes('sendCode()') && auth.includes('verificationCode'), 'registration UI must send and submit the verification code');
check(auth.includes('api.checkUserContent(regName.trim(), 1)'), 'registration name must be checked before account creation');
check(chat.includes('contentForSafetyCheck') && chat.includes('api.checkUserContent(contentForSafetyCheck, 2)'), 'AI user messages must be checked before sending');
check(chat.includes('customDestination') && chat.includes('${customDestination}\\n${text}'), 'custom destinations must be included in AI content checks');
check(read('miniprogram/pages/prefs/prefs.js').includes('api.checkUserContent(prefs.notes, 2)'), 'preference notes must be checked before saving');
check(driver.includes('contentForSafetyCheck') && driver.includes('api.checkUserContent(contentForSafetyCheck, 2)'), 'driver request text must be checked before handoff');
check(api.includes('/api/bali/professional-route') && api.includes('recent-unlocked'), 'shared professional-route API wrappers missing');
check(api.includes('/api/driver-request') && driver.includes('privacy_consent: true'), 'driver handoff contract missing');
check(driver.includes('payload.profile || route.trip_profile') && driver.includes('budget: profile.budget_range'), 'driver handoff must restore the professional-route profile and budget');
check(driver.includes('num_days: this.data.days || null'), 'driver handoff must forward the matched trip length');
check(read('miniprogram/pages/planner/planner.js').includes("{ id: 'value', label: '控制预算'"), 'planner budget goal must use the backend value intent');
check(chat.includes('saveConversation') && chat.includes('getConversation'), 'chat must save and restore account conversations');
check(chat.includes('pendingText') && chat.includes('retryLast()'), 'chat must preserve and retry interrupted input');
check(app.includes('rememberCurrentRoute') && app.includes('resumePendingRoute'), 'login recovery route contract missing');
check(!/(?:whatsapp|wechat|Nicho\.otir|gmail\.com|\+62)/i.test(driver), 'driver page must not expose private contact channels');
check(/wx\.setTabBarItem/.test(app), 'five-language tab labels are not wired');
check(/onShow\(\)\s*\{\s*app\.updateTabBarLanguage\(\)/.test(auth), 'Home must refresh translated tab labels when shown');
check(/success:\s*\(\)\s*=>\s*setTimeout\(\(\)\s*=>\s*app\.updateTabBarLanguage\(\)/.test(language), 'language page must refresh tab labels after returning');

if (failures.length) {
  console.error(`Mini-program contract: ${failures.length} failure(s) across ${checks} checks`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`Mini-program contract: ${checks} checks passed`);

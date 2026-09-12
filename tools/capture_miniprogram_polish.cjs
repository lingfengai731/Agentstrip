const fs = require('node:fs');
const path = require('node:path');
const automator = require('miniprogram-automator');

const output = process.argv[2] || path.resolve(process.cwd(), 'artifacts', 'mini-polish');
const endpoint = process.env.WECHAT_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420';
fs.mkdirSync(output, { recursive: true });

function withTimeout(promise, ms = 18000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

(async () => {
  const mini = await withTimeout(automator.connect({ wsEndpoint: endpoint }));
  const report = { endpoint, files: [], errors: [] };
  mini.on('exception', error => report.errors.push(String(error && (error.message || error))));
  try {
    await mini.evaluate(() => {
      const app = getApp();
      app.__polishSnapshot = { ...app.globalData };
      app.globalData.currentLang = 'zh';
      app.globalData.currentDest = 'bali';
      app.globalData.customDestName = '';
      app.globalData.token = '';
      app.globalData.user = null;
    });

    const targets = [
      { name: 'home', route: '/pages/index/index' },
      { name: 'chat', route: '/pages/chat/chat' },
      { name: 'prices-hotels', route: '/pages/compare/compare' },
    ];
    for (const target of targets) {
      await mini.reLaunch(target.route);
      await new Promise(resolve => setTimeout(resolve, 350));
      const file = path.join(output, `${target.name}.png`);
      await withTimeout(mini.screenshot({ path: file }));
      report.files.push(file);
    }

    const compare = await mini.currentPage();
    await compare.setData({ tab: 'flights' });
    await new Promise(resolve => setTimeout(resolve, 250));
    const flightFile = path.join(output, 'prices-flights.png');
    await withTimeout(mini.screenshot({ path: flightFile }));
    report.files.push(flightFile);
  } finally {
    await mini.evaluate(() => {
      const app = getApp();
      if (app.__polishSnapshot) {
        app.globalData = app.__polishSnapshot;
        delete app.__polishSnapshot;
      }
    });
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    mini.disconnect();
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});


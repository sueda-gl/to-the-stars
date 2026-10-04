import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:8870/?intro=none&autostart=1&opening=none', { waitUntil: 'load' });
await p.waitForFunction('window.__agora && window.__agora.introDone', { timeout: 90000 });
await p.addStyleTag({ content: '[class*="ag-"]:not(canvas){display:none!important}' });
await new Promise(r => setTimeout(r, 1500));
p.evaluate(() => window.__agora.stages.goMoon());
for (let i = 0; i < 16; i++) { await new Promise(r => setTimeout(r, 500)); await p.screenshot({ path: `shots/voyage-debug/q${String(i).padStart(2, '0')}.png` }); }
await b.close();

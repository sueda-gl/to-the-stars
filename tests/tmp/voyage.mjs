import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
p.on('pageerror', e => console.log('[pageerror]', e.message)); p.on('console', m => { if (/stage|plisse|moon|voyage|error/i.test(m.text())) console.log('[c]', m.text().slice(0, 160)); });
await p.goto('http://localhost:8870/?intro=none&autostart=1&opening=none', { waitUntil: 'load' });
await p.waitForFunction('window.__agora && window.__agora.introDone', { timeout: 90000 });
await new Promise(r => setTimeout(r, 3000)); await p.keyboard.press('Escape');
const t0 = Date.now();
p.evaluate(() => window.__agora.stages.goMoon().catch(e => console.log('goMoon error ' + e.message)));
for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 1000)); await p.screenshot({ path: `shots/voyage-debug/f${String(i).padStart(2, '0')}.png` });
  const s = await p.evaluate(() => { const st = window.__agora.stages; return { scene: st.scene, st: st.state || st.phase || null }; }); if (i % 3 === 0) console.log(i, JSON.stringify(s)); }
await b.close();

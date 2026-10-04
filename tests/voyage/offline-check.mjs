// The moon with NO internet: jsDelivr is made unresolvable for the whole browser; the lounge must still load
// (three r147 answered by web/worlds/lounge-sw.js from web/worlds/vendor). -> shots/voyage/offline-arrived.png
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
const root = new URL('../../', import.meta.url).pathname;
const port = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900', '--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:9, MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9'], defaultViewport: { width: 1440, height: 900 } });
let ok = false;
try {
  const page = await browser.newPage();
  page.on('console', m => console.log('  console:', m.text()));
  await page.goto(`http://127.0.0.1:${port}/web/voyage-lab.html?lab=0`);
  await page.waitForFunction(() => window.__lab, { timeout: 20000 });
  await page.evaluate(() => { window.__lab.voyage.arrive(); });
  await page.waitForFunction(() => window.__lab.voyage.state === 'moon', { timeout: 40000 });
  await new Promise(r => setTimeout(r, 1500));
  const s = await page.evaluate(() => window.__lab.driver.state());
  ok = s.ready;
  await page.screenshot({ path: root + 'shots/voyage/offline-arrived.png' });
  console.log(ok ? 'PASS lounge loaded with jsDelivr unreachable' : 'FAIL', JSON.stringify(s));
} catch (e) { console.log('FAIL', e.message); } finally { await browser.close(); srv.kill(); }
process.exit(ok ? 0 : 1);

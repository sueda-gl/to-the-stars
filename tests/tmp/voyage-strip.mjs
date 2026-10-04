// Frame strip of the Plissé voyage in the real game (CDP screencast, real timestamps): node tests/tmp/voyage-strip.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const PORT = process.env.PORT || 8906, OUT = process.env.OUT || 'shots/voyage-fix/a', SECS = +(process.env.SECS || 18);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(`http://localhost:${PORT}/?intro=none&autostart=1&opening=none`, { waitUntil: 'load' });
await p.waitForFunction('window.__agora && window.__agora.introDone', { timeout: 90000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 12; i++) { await sleep(1000); await p.evaluate(() => { [...document.querySelectorAll('button')].filter(b => /fold it away/i.test(b.textContent)).forEach(b => b.click()); }); }
await p.keyboard.press('Escape'); await sleep(1500);
await p.screenshot({ path: `${OUT}-start.png` });
const cdp = await p.target().createCDPSession();
const frames = [];
cdp.on('Page.screencastFrame', async f => { frames.push({ t: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) {} });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 720, maxHeight: 450, everyNthFrame: 1 });
await sleep(300);
const t0 = Date.now() / 1000;
const log = [];
p.evaluate(() => { window.__agora.stages.goMoon().catch(e => console.log('goMoon ' + e.message)); });
const probe = () => p.evaluate(() => {
  const A = window.__agora, s = A.stages.standin, cam = A.planet.camera; if (!s) return null;
  const v = s.group.position.clone().project(cam); const U = s.uniforms;
  return { ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], d: Math.round(cam.position.distanceTo(s.group.position)), blend: +A.planet.post.post.uniforms.uBlend.value.toFixed(2), toon: +U.uToon.value.toFixed(2), scene: A.stages.scene };
});
while (Date.now() / 1000 - t0 < SECS) { log.push([(Date.now() / 1000 - t0).toFixed(1), JSON.stringify(await probe())]); await sleep(500); }
await cdp.send('Page.stopScreencast');
let k = 0;
const STEP = +(process.env.STEP || 0.5); for (let s = 0; s < SECS; s += STEP) {
  let best = null; for (const f of frames) if (!best || Math.abs(f.t - t0 - s) < Math.abs(best.t - t0 - s)) best = f;
  if (best) fs.writeFileSync(`${OUT}${String(k).padStart(2, '0')}.jpg`, Buffer.from(best.data, 'base64')); k++;
}
console.log('frames', frames.length, 'fps', (frames.length / SECS).toFixed(1));
log.forEach(l => console.log(l.join(' ')));
await b.close();

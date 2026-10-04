import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:8870/?intro=none&autostart=1&opening=none', { waitUntil: 'load' });
await p.waitForFunction('window.__agora && window.__agora.introDone', { timeout: 90000 });
await new Promise(r => setTimeout(r, 2000));
p.evaluate(() => window.__agora.stages.goMoon());
for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 700));
  console.log(i, JSON.stringify(await p.evaluate(() => { const A = window.__agora, s = A.stages.standin, cam = A.planet.camera; if (!s) return 'no standin';
    const g = s.group || s.object || null; const pos = g ? g.position : null; let scr = null, vis = null, inScene = null;
    if (g) { const v = pos.clone().project(cam); scr = [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)]; vis = g.visible; let o = g; while (o.parent) o = o.parent; inScene = o === A.planet.scene; }
    return { keys: Object.keys(s).slice(0, 30).join(','), pos: pos && pos.toArray().map(x => Math.round(x)), scr, vis, inScene, cam: cam.position.toArray().map(x => Math.round(x)), far: cam.far, dist: pos ? Math.round(pos.distanceTo(cam.position)) : null }; }))); }
await b.close();

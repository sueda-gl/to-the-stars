// marks + folk click on the seaside map: a drawn loop -> a field; a click inside it -> "a house here" lands on the X (fields are buildable)
import puppeteer from 'puppeteer-core';
const BASE = process.argv[2] || 'http://localhost:8870';
const OUT = '/Users/suedagul/agora/shots/integ/mk-';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
const errs = []; page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms = 60000, ...a) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn, ...a).catch(() => false)) return true; await sleep(200); } return false; };
await page.goto(`${BASE}/?intro=none&autostart=1&opening=none&minds=off`, { waitUntil: 'load' });
await until(() => window.__agora && window.__agora.introDone && window.__agora.stages.surface === 'sea', 90000);
await sleep(2500); await page.keyboard.press('Escape'); await ev(() => { try { __agora.ui.letters.close(); } catch (_) {} });
// come closer over the plot so the loop is a field-sized area
await ev(() => __agora.world.focus(8, -6, { dist: 60, ms: 10 })); await sleep(1500);
// a loop, left-drag, round world (10, -8) (clear of the sim's reserved stockpile at (-9, 13))
const c0 = await ev(() => { const s = __agora.world.project(10, null, -8); return { x: Math.round(s.x), y: Math.round(s.y) }; });
const cx = c0.x, cy = c0.y, R = 100; const m = page.mouse;
await m.move(cx + R, cy); await m.down({ button: 'left' });
for (let i = 1; i <= 44; i++) { const a = i / 40 * Math.PI * 2; await m.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.7, { steps: 2 }); }
await m.up({ button: 'left' }); await sleep(500);
const mark = await ev(() => { const c = __agora.marks.current(); return c ? { kind: c.kind, n: (c.poly || []).length, centroid: c.centroid } : null; });
console.log('area mark', JSON.stringify(mark));
await page.screenshot({ path: OUT + '1-loop.png' });
await ev(() => __agora.handle('make this a field'));
const okF = await until(() => __agora.game.state.buildings.some(b => b.shape && b.shape.poly), 20000);
const field = await ev(() => { const b = __agora.game.state.buildings.find(b => b.shape && b.shape.poly); setTimeout(() => __agora.game.completeBuilding(b), 800); return { id: b.id, kind: b.kind, x: b.x, z: b.z, poly: b.shape.poly }; });
console.log('field', okF, field.kind, field.x, field.z);
await sleep(9000); await page.screenshot({ path: OUT + '2-field.png' });
// a click inside the field -> a pencil X; "a house here"
const fc = await ev(f => { const s = __agora.world.project(f.x + 1, null, f.z + 0.5); return { x: Math.round(s.x), y: Math.round(s.y) }; }, field); console.log('field centre on screen', JSON.stringify(fc));
await m.click(fc.x, fc.y); await sleep(400);
const x = await ev(() => { const c = __agora.marks.current(); return c ? { kind: c.kind, x: c.x, z: c.z } : null; });
console.log('point mark', JSON.stringify(x));
await page.screenshot({ path: OUT + '3-x.png' });
await ev(p => __agora.handle('build a house here', p), fc);
await until(() => __agora.game.state.buildings.some(b => b.kind === 'house'), 20000);
const h = await ev(() => { const b = __agora.game.state.buildings.find(b => b.kind === 'house'); return { x: b.x, z: b.z, nudge: b.nudge || null, siteY: __agora.world.siteY(b) }; });
const inside = await ev((h, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > h.z) !== (zj > h.z) && h.x < (xj - xi) * (h.z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }, h, field.poly);
console.log('house', JSON.stringify(h), 'dist from X', x ? Math.hypot(h.x - x.x, h.z - x.z).toFixed(2) : 'n/a', 'inside field', inside);
await sleep(3500); await page.screenshot({ path: OUT + '4-house-on-field.png' });
// a folk click opens its card
const f = await ev(() => { const A = __agora; for (const a of A.game.state.agents) { const s = A.agents.screenOf(a.id); if (s && s.x > 100 && s.x < 1340 && s.y > 120 && s.y < 800) return { id: a.id, name: a.name, x: s.x, y: s.y }; } return null; });
console.log('folk on screen', JSON.stringify(f));
if (f) {
  const id = await ev(f => __agora.agents.pickAgent(f.x, f.y, { radiusPx: 14 }), f);
  const p = await ev(i => __agora.agents.screenOf(i), id);
  await m.click(p.x, p.y + 4); await sleep(700);
  console.log('card', await ev(() => { const c = document.querySelector('.ag-card, .ag-agent-card, [class*=card]'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ').slice(0, 120) : null; }));
  await page.screenshot({ path: OUT + '5-card.png' });
}
console.log('errors', JSON.stringify(await ev(() => __agora.errors)), errs.length);
await b.close();

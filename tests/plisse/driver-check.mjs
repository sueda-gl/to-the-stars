// Checks the Plissé driver against the real scene (on :8870, never restarted), through web/plisse-lab.html.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/plisse/driver-check.mjs [base]
// Test-only probe: in THIS test browser, THREE.Clock and THREE.OrbitControls are wrapped from outside (a property trap on
// the frame's window.THREE) so the real clock and camera can be READ and compared with the driver's model. The file
// web/worlds/plisse.html is untouched (sha256 checked before and after).
import puppeteer from 'puppeteer-core';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const ROOT = '/Users/suedagul/agora/';
const BASE = process.argv[2] || 'http://localhost:8870';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sha = f => createHash('sha256').update(readFileSync(ROOT + f)).digest('hex');
const REF = readFileSync(ROOT + 'reference/SHA256', 'utf8').split('\n').find(l => l.includes('plisse-the-lantern-planet.html')).slice(0, 64);
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); };
check('plisse.html byte-identical before', sha('web/worlds/plisse.html') === REF);
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.evaluateOnNewDocument(() => {
  if (!location.pathname.endsWith('/worlds/plisse.html')) return;
  let T, wc = false;
  Object.defineProperty(window, 'THREE', { configurable: true, set(v) { T = v; }, get() {
    if (T && T.Clock && !wc) { wc = true; const g = T.Clock.prototype.getDelta; T.Clock.prototype.getDelta = function () { const r = g.call(this); if (window.__clock === undefined) window.__clock = this; return r; }; }
    if (T && T.OrbitControls && !T.OrbitControls.__probe) { const O = T.OrbitControls; const W = class extends O { constructor(...a) { super(...a); window.__ctl = this; } }; W.__probe = true; T.OrbitControls = W; }
    return T;
  } });
});
await p.goto(BASE + '/plisse-lab.html', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__lab && window.__planet);
await p.evaluate(() => window.__planet.ready);
await p.evaluate(() => window.__lab.travel());
await p.waitForFunction(() => window.__lab.state === 'plisse', { timeout: 60000, polling: 100 });
const real = () => p.evaluate(() => {
  const d = window.__lab.driver, w = d.window, c = w.__ctl, o = c.object.position, r = Math.hypot(o.x, o.y, o.z);
  return { real: { theta: Math.atan2(o.x, o.z), phi: Math.acos(o.y / r), radius: r, auto: c.autoRotate }, model: d.cameraNow(), t: (w.performance.now() - w.__clock.startTime) / 1000, st: d.sceneTime() };
});
const err = (a, b) => Math.max(Math.abs(Math.atan2(Math.sin(a.theta - b.theta), Math.cos(a.theta - b.theta))), Math.abs(a.phi - b.phi), Math.abs(a.radius - b.radius) / 10);
let r = await real();
check('scene clock: driver sceneTime() matches her THREE.Clock', Math.abs(r.t - r.st) < 0.02, `real ${r.t.toFixed(3)} s, driver ${r.st.toFixed(3)} s`);
check('auto-rotation modelled (frame-counted, damped)', err(r.real, r.model) < 0.004 && r.real.auto && r.model.autoRotate, `err ${err(r.real, r.model).toExponential(2)} rad, theta real ${r.real.theta.toFixed(4)} model ${r.model.theta.toFixed(4)}, ${r.model.frames} frames`);
await wait(3000);
r = await real();
check('auto-rotation 3 s later', err(r.real, r.model) < 0.004, `err ${err(r.real, r.model).toExponential(2)} rad, theta ${r.real.theta.toFixed(4)}`);
const lab = p.evaluate.bind(p);
await lab(() => window.__lab.driver.look(140, -40));
r = await real();
check('look(140,-40) turned the real camera and stopped her autoRotate', !r.real.auto && !r.model.autoRotate && err(r.real, r.model) < 0.01, `theta ${r.real.theta.toFixed(3)} phi ${r.real.phi.toFixed(3)}, model err ${err(r.real, r.model).toExponential(2)}`);
await lab(() => window.__lab.driver.zoom(0.7));
await wait(1200);
r = await real();
check('zoom(0.7): wheel notches, radius modelled', Math.abs(r.real.radius - r.model.radius) < 0.01 && r.real.radius < 32, `radius real ${r.real.radius.toFixed(3)} model ${r.model.radius.toFixed(3)}`);
await lab(() => window.__lab.driver.lookHome());
r = await real();
const H = await lab(() => window.__lab.driver.ARRIVAL);
check('lookHome() back to her opening framing', Math.abs(r.real.theta - H.theta) < 0.01 && Math.abs(r.real.phi - H.phi) < 0.01 && Math.abs(r.real.radius - H.radius) < 0.05, `theta ${r.real.theta.toFixed(4)}/${H.theta.toFixed(4)} phi ${r.real.phi.toFixed(4)}/${H.phi.toFixed(4)} r ${r.real.radius.toFixed(3)}/${H.radius.toFixed(3)}`);
// chrome
const op = () => lab(() => { const d = window.__lab.driver.document; return ['.title', '.hint', '.bar'].map(s => d.defaultView.getComputedStyle(d.querySelector(s)).visibility).join(','); });
const hidden = await op();
await lab(() => window.__lab.driver.hideOwnChrome(false)); await wait(700);
const shown = await op();
await lab(() => window.__lab.driver.hideOwnChrome(true)); await wait(700);
check('hideOwnChrome on/off (.title .hint .bar)', hidden === 'hidden,hidden,hidden' && shown === 'visible,visible,visible', `${hidden} -> ${shown}`);
// her paint button
const p1 = await lab(() => window.__lab.driver.setPainted(false)), p2 = await lab(() => window.__lab.driver.setPainted(true));
check('setPainted(false/true) through her #paint', p1 === false && p2 === true);
// focus: a real click on Plissé keeps focus on the parent; Space held there is heard by the parent, and never presses her #paint
const box = await p.$eval('#plisse', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width * 0.7, y: r.top + r.height * 0.5 }; });
await p.mouse.click(box.x, box.y);
await wait(100);
const act = await lab(() => document.activeElement && document.activeElement.id);
await p.keyboard.down('Space'); await wait(80);
const held = await lab(() => document.getElementById('ptt').classList.contains('held'));
await p.keyboard.up('Space'); await wait(80);
const released = await lab(() => !document.getElementById('ptt').classList.contains('held'));
check('click on Plissé: focus stays on the parent, Space push-to-talk heard', act !== 'plisse' && held && released, `active=${act || 'body'}`);
// forced focus inside the frame: keys are forwarded, Space doesn't toggle her button
await lab(() => { const d = window.__lab.driver; d.document.getElementById('paint').focus(); });
await p.keyboard.down('Space'); await wait(80);
const held2 = await lab(() => document.getElementById('ptt').classList.contains('held'));
await p.keyboard.up('Space'); await wait(120);
const painted = await lab(() => window.__lab.driver.state().painted);
check('focus forced into the frame: Space forwarded to the parent, her #paint not pressed', held2 && painted === true);
await b.close();
check('no page errors', errs.length === 0, errs.join(' | '));
check('plisse.html byte-identical after', sha('web/worlds/plisse.html') === REF);
process.exit(fails ? 1 : 0);

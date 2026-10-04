// The Gouache lab end to end: open the game, press G, change controls, screenshot before / after, save, reload,
// confirm the look persisted. Run against YOUR OWN server (never :8870):
//   PORT=8893 AGORA_MOCK=1 AGORA_LOOK_FILE=/tmp/look-test.json node server/index.js &
//   node tests/lab/look-lab.mjs http://localhost:8893     -> shots/look-lab/*.png
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://localhost:8893';
const OUT = new URL('../../shots/look-lab/', import.meta.url).pathname;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900', '--use-fake-ui-for-media-stream'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', m => { if (m.type() === 'error' && !/favicon|404|405/.test(m.text())) console.log('[console.error]', m.text().slice(0, 300)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = n => page.screenshot({ path: OUT + n + '.png' }).then(() => console.log('shot', n));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const checks = [];
const ok = (name, cond, info = '') => { checks.push({ name, pass: !!cond, info }); console.log(cond ? 'PASS' : 'FAIL', name, info); };
async function boot(url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__agora && window.__agora.begin, { timeout: 90000 });
  await ev(() => { __agora.begin({ onboarding: false }); try { __agora.ui.titleCard.hide(); } catch (_) {} });
  await page.waitForFunction(() => window.__agora.introDone, { timeout: 90000 });
  await sleep(2500);
}
const url = base + '/?intro=none';
await boot(url);
const factory = await ev(() => ({ G: { ...__agora.painter.G }, world: __agora.look.world.get(), hasSetLook: typeof __agora.world.setLook === 'function' }));
console.log('factory', JSON.stringify(factory));
await shot('01-before');
await page.keyboard.press('g'); await sleep(400);
ok('G opens the lab', await ev(() => !!document.querySelector('.look-lab:not([hidden])')));
ok('verbatim Gouache settings mounted', await ev(() => !!document.querySelector('.look-lab #tweaks #g-brush')));
await shot('02-lab-open');
// change several controls the way a hand would: slider values + input events
const setRange = (sel, v) => ev((sel, v) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return !i.disabled; }, sel, v);
const setColor = (sel, v) => ev((sel, v) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return !i.disabled; }, sel, v);
const wired = {};
wired.sunEl = await setRange('#ll-sunEl', 14);
wired.sunAz = await setRange('#ll-sunAz', 240);
wired.keyColor = await setColor('#ll-keyColor', '#ffb070');
wired.hemiIntensity = await setRange('#ll-hemiIntensity', 0.48);
wired.camPitch = await setRange('#ll-camPitch', 50);
wired.reliefScale = await setRange('#ll-reliefScale', 1.6);
wired.shadowTint = await setColor('#ll-shadowTint', '#2a3f9e');
await setRange('#g-saturation', 1.3);
await setRange('#g-warmth', 0.25);
await setRange('#g-brush', 3);
console.log('wired', JSON.stringify(wired));
await sleep(1500);
await ev(() => { const s = document.querySelector('.look-lab [data-sec="light"]'); s.scrollIntoView({ block: 'start' }); });
const after = await ev(() => ({ G: { ...__agora.painter.G }, world: __agora.look.world.get() }));
ok('painter G changed live', after.G.saturation === 1.3 && after.G.warmth === 0.25 && after.G.brush === 3, JSON.stringify(after.G));
await shot('03-after-lab-open');
await page.keyboard.press('g'); await sleep(900);
await shot('04-after-clean');
// a preset
await page.keyboard.press('g'); await sleep(300);
await ev(() => document.querySelector('.ll-presets [data-p="Golden"]').click()); await sleep(1500);
await shot('05-preset-golden');
await ev(() => document.querySelector('.ll-presets [data-p="Moodboard 1"]').click()); await sleep(1500);
await shot('06-preset-moodboard1');
// back to the hand-tuned state, then save
await ev(() => document.querySelector('[data-a="reset"]').click()); await sleep(300);
await setRange('#ll-sunEl', 14); await setRange('#ll-sunAz', 240); await setColor('#ll-keyColor', '#ffb070'); await setRange('#ll-hemiIntensity', 0.48);
await setRange('#ll-camPitch', 50);
await setRange('#g-saturation', 1.3); await setRange('#g-warmth', 0.25); await setRange('#g-brush', 3);
await sleep(600);
const tuned = await ev(() => ({ G: { ...__agora.painter.G }, world: __agora.look.world.get(), json: __agora.look.lab.lookJSON() }));
console.log('saving', JSON.stringify(tuned.json));
await ev(() => document.querySelector('.ll-save').click()); await sleep(1200);
const st = await ev(() => document.querySelector('.ll-status').textContent);
ok('saved', /Saved as the default/.test(st), st);
await shot('07-saved');
// reload: the saved look must come back
await boot(url);
const reloaded = await ev(() => ({ G: { ...__agora.painter.G }, world: __agora.look.world.get(), saved: __agora.look.saved }));
ok('painter G persisted', reloaded.G.saturation === 1.3 && reloaded.G.warmth === 0.25 && reloaded.G.brush === 3, JSON.stringify(reloaded.G));
for (const k of Object.keys(tuned.json.world || {})) {
  const a = tuned.world[k], r = reloaded.world[k];
  ok('world.' + k + ' persisted', typeof a === 'number' ? Math.abs(a - r) < 0.6 : JSON.stringify(a) === JSON.stringify(r), `${JSON.stringify(a)} -> ${JSON.stringify(r)}`);
}
await shot('08-reloaded');
await page.keyboard.press('g'); await sleep(400);
await shot('09-reloaded-lab');
ok('no page errors', !errs.length && !(await ev(() => __agora.errors.length)), JSON.stringify(errs.concat(await ev(() => __agora.errors))));
console.log(JSON.stringify({ pass: checks.every(c => c.pass), checks: checks.length, failed: checks.filter(c => !c.pass).map(c => c.name) }));
await b.close();

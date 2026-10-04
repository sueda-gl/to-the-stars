// diplomacy on the seaside: show the globe (lift), visit a nation on her planet, come home (descent + hand-off); skip during the intro descent
import puppeteer from 'puppeteer-core';
const BASE = process.argv[2] || 'http://localhost:8870';
const OUT = '/Users/suedagul/agora/shots/integ/vs-';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage(); const errs = []; page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
const sleep = ms => new Promise(r => setTimeout(r, ms)); const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn).catch(() => false)) return true; await sleep(150); } return false; };
const st = () => ev(() => { const s = __agora.stages; return { scene: s.scene, surface: s.surface, sea: s.paintSea, planet: s.paintPlanet, flying: s.flying, fish: +__agora.planet.post.post.uniforms.uFish.value.toFixed(3), rig: __agora.world.rig.enabled }; });
await page.goto(`${BASE}/?minds=off&opening=none`, { waitUntil: 'load' });
await until(() => document.querySelector('.tt') && !document.querySelector('.tt').hidden, 90000); await sleep(1500);
await page.click('.tt__begin'); await sleep(1800);
await page.keyboard.press('x');                              // any key skips the descent
await sleep(300); console.log('after skip', JSON.stringify(await st()));
await until(() => __agora.introDone, 20000); await sleep(800); await page.screenshot({ path: OUT + '0-skipped.png' });
await sleep(3000); await page.keyboard.press('Escape'); await ev(() => { try { __agora.ui.letters.close(); } catch (_) {} });
await ev(() => { __agora.handle('show me the neighbours'); });
await sleep(1200); await page.screenshot({ path: OUT + '1-lifting.png' });
await until(() => __agora.stages.scene === 'globe' && !__agora.stages.flying, 20000); await sleep(1500);
console.log('globe', JSON.stringify(await st())); await page.screenshot({ path: OUT + '2-globe.png' });
await ev(() => { __agora.stages.visitNation('n2').then(() => __agora.stages.homeFromGlobe()); });
await sleep(6500); await page.screenshot({ path: OUT + '3-visit.png' }); console.log('visit', JSON.stringify(await st()));
await until(() => __agora.stages.surface === 'sea' && __agora.stages.scene === 'world', 40000);
await sleep(1500); await page.screenshot({ path: OUT + '4-home.png' }); console.log('home', JSON.stringify(await st()));
// input on the seaside after coming home: wheel zoom + right-drag pan move the map's rig
const p0 = await ev(() => __agora.world.rig.pose());
await page.mouse.move(720, 450); await page.mouse.wheel({ deltaY: -400 }); await sleep(900);
await page.mouse.down({ button: 'right' }); await page.mouse.move(820, 500, { steps: 8 }); await page.mouse.up({ button: 'right' }); await sleep(900);
const p1 = await ev(() => __agora.world.rig.pose());
console.log('rig moved', JSON.stringify({ dist: [p0.dist.toFixed(1), p1.dist.toFixed(1)], tx: [p0.tx.toFixed(1), p1.tx.toFixed(1)], tz: [p0.tz.toFixed(1), p1.tz.toFixed(1)] }));
console.log('errors', JSON.stringify(await ev(() => __agora.errors)), errs.length);
await b.close();

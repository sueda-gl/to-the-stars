// the hand-off's other paths: skip mid-descent, visit a nation and come home, the descent in portrait
import puppeteer from 'puppeteer-core';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = arg('--port', '8883'), OUT = '/Users/suedagul/agora/shots/handoff/flows-';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
async function open(w, h) {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--use-angle=metal', `--window-size=${w},${h}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: w, height: h, deviceScaleFactor: 1 } });
  const page = await b.newPage();
  page.on('pageerror', e => { console.log('[pageerror]', e.message); fails++; });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  await page.goto(`http://localhost:${PORT}/?minds=mock&opening=auto`, { waitUntil: 'load' });
  for (let i = 0; i < 400; i++) { if (await ev(() => !!(window.__agora && document.querySelector('.tt') && !document.querySelector('.tt').hidden)).catch(() => false)) break; await sleep(300); }
  await sleep(2000);
  return { b, page, ev, until: async (fn, ms = 60000) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn).catch(() => false)) return true; await sleep(150); } return false; } };
}
const st = ev => ev(() => { const S = window.__agora.stages, pc = window.__agora.planet.renderer.domElement; return { scene: S.scene, surface: S.surface, move: S.handoffMove, clouds: S.clouds.shown, planetDisplay: pc.style.display, planetOpacity: pc.style.opacity, paintSea: S.paintSea, paintPlanet: S.paintPlanet, errors: window.__agora.errors.slice(0, 3) }; });
{ // 1. skip mid-descent
  const { b, page, ev, until } = await open(1440, 900);
  await page.click('.tt__begin');
  await sleep(4300);                                    // in the cloud
  console.log('before skip', JSON.stringify(await st(ev)));
  await page.keyboard.press('x');
  await until(() => window.__agora.introDone === true, 15000);
  await sleep(600);
  const s = await st(ev); console.log('after skip', JSON.stringify(s));
  ok(s.surface === 'sea' && !s.move && !s.clouds && s.planetDisplay === 'none' && s.paintSea && !s.paintPlanet, 'skip in the cloud lands cleanly on the map');
  await page.screenshot({ path: OUT + '1-skip.png' });
  // 2. a nation and home again
  await until(() => window.__agora.opening && window.__agora.opening.phase === 'done', 150000);
  await sleep(800);
  const id = await ev(() => (window.__agora.stages.planet && window.__agora.world && null) || (window.__agora.geo ? window.__agora.geo.places.nations[0].id : null));
  const nid = id || await ev(() => { const g = window.__agora.pworld ? window.__agora.pworld.geo : null; return g ? g.places.nations[0].id : 'n1'; });
  console.log('nation', nid);
  const r = await ev(n => window.__agora.stages.visitNation(n, { hold: 600 }), nid);
  const s2 = await st(ev); console.log('at nation', r, JSON.stringify(s2));
  ok(r && s2.scene === 'globe' && s2.surface === 'planet' && !s2.clouds && s2.planetDisplay === '' && s2.planetOpacity === '1' && !s2.paintSea, 'visitNation: up through the cloud, on to the nation');
  await page.screenshot({ path: OUT + '2-nation.png' });
  const r2 = await ev(() => window.__agora.stages.homeFromGlobe());
  await sleep(300);
  const s3 = await st(ev); console.log('home', r2, JSON.stringify(s3));
  ok(r2 && s3.scene === 'world' && s3.surface === 'sea' && !s3.clouds && s3.planetDisplay === 'none', 'homeFromGlobe from a nation: orbit, down through the cloud, the leader view');
  await page.screenshot({ path: OUT + '3-home.png' });
  await b.close();
}
{ // 3. portrait: the descent lands, the cloud fills the frame at the swap
  const { b, page, ev, until } = await open(820, 1180);
  await ev(() => { const S = window.__agora.stages; window.__cov = []; const af = S.afterFrame; S.afterFrame = n => { af(n); const d = S.cloudDebug; if (S.handoffMove) window.__cov.push([S.handoffMove.phase, d.W]); }; });
  await page.click('.tt__begin');
  await until(() => window.__agora.stages.surface === 'sea', 20000);
  await sleep(250); await page.screenshot({ path: OUT + '4-portrait-swap.png' });
  await until(() => window.__agora.introDone === true, 20000);
  await sleep(500); await page.screenshot({ path: OUT + '5-portrait-landed.png' });
  const cov = await ev(() => window.__cov);
  const i = cov.findIndex(c => c[0] === 'sea');
  console.log('portrait cover around the swap', JSON.stringify(cov.slice(Math.max(0, i - 3), i + 3)));
  ok(i > 0 && cov[i - 1][1] > 0.98 && cov[i][1] > 0.98, 'portrait: the inside of the cloud is opaque on both sides of the swap');
  const s = await st(ev); ok(s.surface === 'sea' && !s.clouds, 'portrait: landed, no cloud left');
  await b.close();
}
console.log(fails ? `${fails} FAIL` : 'ALL OK');

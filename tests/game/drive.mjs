// ad-hoc driver: node drive.mjs '<url>' '<steps js>'   (steps run inside an async function with page, shot, sleep, ev)
import puppeteer from 'puppeteer-core';
const [,, url, stepsSrc] = process.argv;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
const errs = [], logs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', m => { const t = m.text(); logs.push(t); if (m.type() === 'error' && !/favicon|404/.test(t)) console.log('[console.error]', t.slice(0, 300)); if (/\[agora\]/.test(t)) console.log(t.slice(0, 300)); });
page.on('requestfailed', r => { if (!/favicon/.test(r.url())) console.log('[reqfail]', r.url(), r.failure()?.errorText); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `/Users/suedagul/agora/shots/game/${name}.png` }).then(() => console.log('shot', name));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const t0 = Date.now();
const T = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
await page.goto(url, { waitUntil: 'load' });
try {
  const steps = new Function('page', 'shot', 'sleep', 'ev', 'T', 'errs', `return (async () => { ${stepsSrc} })();`);
  await steps(page, shot, sleep, ev, T, errs);
} catch (e) { console.log('[driver error]', e.message); }
console.log('page errors:', JSON.stringify(await ev(() => (window.__agora && window.__agora.errors) || []).catch(() => 'n/a')), 'puppeteer pageerrors:', errs.length);
await b.close();

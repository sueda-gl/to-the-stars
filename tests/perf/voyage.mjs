// Per-phase performance of the Act 3 voyage in web/act3-lab.html (Chrome headless=new, real GPU via --use-angle=metal).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/perf/voyage.mjs [--url http://localhost:8897] [--dpr 1|2] [--tag before|after] [--home]
// Phases follow window.__lab.state (flying, arriving, plisse, approach, ring, diving, landing, lounge; with --home:
// rising, plisse, lifting, leaving, returning, earth). Writes shots/perf/<tag>-voyage-<phase>.png and prints a table.
import { open, measure, table, sleep, OUT } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8897'), DPR = +(arg('--dpr', '1')), TAG = arg('--tag', 'before'), HOME = process.argv.includes('--home');

const { b, p, cdp } = await open(BASE + '/act3-lab.html?shot=1', { dpr: DPR });
await p.waitForFunction(() => window.__lab && window.__planet, { timeout: 60000 });
await p.evaluate(() => window.__planet.ready);
await p.evaluate(() => window.__lab.bridge.ready());
await sleep(1500);
const rows = [];
const state = () => p.evaluate(() => window.__lab.state);
const shot = name => p.screenshot({ path: `${OUT}${TAG}-voyage-${name}.png` });
// measure while the lab stays in `s` (or until `until`), at most maxMs
async function phase(name, cond, maxMs = 30000) {
  const t0 = Date.now();
  rows.push(await measure(p, cdp, name, async () => { while (Date.now() - t0 < maxMs && await p.evaluate(cond)) await sleep(60); }));
  await shot(name);
}
rows.push(await measure(p, cdp, 'earth-orbit', 4000)); await shot('earth-orbit');
await p.evaluate(() => { window.__lab.playLanding(); });
await phase('flight', () => window.__lab.state === 'flying', 20000);
await phase('arriving-fade', () => window.__lab.state === 'arriving', 10000);
await phase('plisse', () => window.__lab.state === 'plisse', 10000);
await phase('approach', () => window.__lab.state === 'approach' || window.__lab.state === 'ring', 10000);
await phase('dive', () => window.__lab.state === 'diving', 20000);
await phase('landing', () => window.__lab.state === 'landing' || window.__lab.state === 'meadow', 20000);
await p.waitForFunction(() => window.__lab.state === 'lounge' && !window.__lab.busy, { timeout: 30000 });
rows.push(await measure(p, cdp, 'lounge-idle', 5000)); await shot('lounge-idle');
if (HOME) {
  await p.evaluate(() => { window.__lab.backHome(); });
  await phase('rising', () => window.__lab.state === 'rising', 30000);
  await phase('plisse-again', () => window.__lab.state === 'plisse', 10000);
  await phase('lifting', () => window.__lab.state === 'lifting', 10000);
  await phase('leaving', () => window.__lab.state === 'leaving', 10000);
  await phase('returning', () => window.__lab.state === 'returning', 20000);
  await p.waitForFunction(() => window.__lab.state === 'earth' && !window.__lab.busy, { timeout: 30000 });
  rows.push(await measure(p, cdp, 'earth-again', 3000)); await shot('earth-again');
}
const gaps = await p.evaluate(() => Object.fromEntries(Object.entries(window.__lab.gaps).map(([k, v]) => [k, Math.round(v)])));
console.log(`\n## voyage (${TAG}, dpr ${DPR})\n`); console.log(table(rows)); console.log('\nlab longest frame gap per state (ms):', JSON.stringify(gaps));
writeFileSync(`${OUT}${TAG}-voyage-dpr${DPR}.json`, JSON.stringify({ rows, gaps }, null, 1));
await b.close();

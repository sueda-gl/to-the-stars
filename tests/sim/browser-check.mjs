// Runs the sim in headless Chrome through a static server: the browser-check page, then the three acts in-page.
// Run: node tests/sim/browser-check.mjs (needs Chrome at the usual path; port 8931)
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
const port = 8931;
const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: '/Users/suedagul/agora', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--headless=new', '--use-angle=metal', '--no-sandbox'] });
const page = await browser.newPage();
const lines = [];
page.on('console', m => lines.push(m.text()));
page.on('pageerror', e => lines.push('PAGEERROR ' + e.message));
await page.goto(`http://localhost:${port}/tests/sim/browser-check.html`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 500));
console.log(await page.$eval('#out', e => e.textContent));
// a second, deeper run in the page: the three acts in the browser
const out = await page.evaluate(async () => {
  const { createGame } = await import('/web/js/sim/index.js');
  const g = createGame({ seed: 7 });
  const ev = [];
  g.on('*', (p, e) => ev.push(e));
  // the arrival (ART_DIRECTION §11): fleets, the introductions, the click, talk
  g.spawnAll();
  const order = g.introduceFleets({ every: 0.2, first: 0.1 });
  for (let i = 0; i < 40; i++) g.tick(0.1);
  const asked = g.state.election && g.state.election.open;
  const elect = g.electMinister(g.state.agents[0].id);
  for (let i = 0; i < 70; i++) g.tick(0.1);
  const talk = g.talk(g.state.agents[1].id, 'how are you?');
  g.apply({ type: 'build', kind: null, request: 'a rubber duck in the lake', at: { mode: 'auto' } });
  g.apply({ type: 'send_gift', neighbourId: 'loaf republic', gift: 'bread' });
  g.apply({ type: 'go_moon' });
  for (let i = 0; i < 400; i++) g.tick(0.1);
  g.apply({ type: 'moon', do: 'seed' });
  for (let i = 0; i < 100; i++) g.tick(0.1);
  g.apply({ type: 'moon', do: 'go_home' });
  for (let i = 0; i < 150; i++) g.tick(0.1);
  const s = g.snapshot();
  return { fleets: order, asked, minister: elect.ok && g.state.minister, ceremony: ev.includes('ceremony:start'), released: !g.state.fleetHold, talk: talk.reply, jobs: g.state.agents.map(a => a.job),
    scene: s.scene, elected: s.elected, creations: s.creations, events: [...new Set(ev)].sort(), letters: g.state.letters.map(l => l.kind), floating: g.state.buildings[0].floating };
});
console.log(lines.join('\n'));
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.kill();

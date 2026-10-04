// Screenshots every ui-lab preset at 1440x900 (+ the main ones at 390x844) into shots/ui/, and fails on page errors.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/ui/shoot.mjs [preset ...]
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'shots/ui'); mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ALL = ['rest', 'speaking', 'typing', 'notice', 'letter', 'letter&letter=b', 'ledger', 'card', 'onboarding', 'onboarding&step=2', 'hint', 'title', 'director', 'meeting', 'envoy', 'rest&bg=arch', 'letter&bg=arch',
  'inbox', 'inbox-1', 'inbox-30', 'inbox-read', 'inbox-read&long=1', 'inbox-read&font=A', 'agentcard2', 'agentcard2&who=a3', 'agentcard2&font=A', 'talk', 'fleetcaption', 'election', 'election&hover=1', 'elected',
  'pick', 'pick&n=0', 'pick&n=4', 'pick&hover=1', 'inbox-read&who=builds', 'inbox-read&cinema=1',
  'mail-notify', 'mail-column', 'mail-compact', 'mail-compact&long=1', 'mail-compact&bg=folk', 'mail-compact&who=n2', 'mail-seeall'];
const MOBILE = ['rest', 'letter', 'letter&letter=b', 'ledger', 'onboarding', 'inbox', 'inbox-1', 'inbox-30', 'inbox-read', 'inbox-read&font=A', 'agentcard2', 'agentcard2&font=A', 'talk', 'fleetcaption', 'election', 'elected',
  'pick', 'inbox-read&who=builds', 'mail-notify', 'mail-column', 'mail-compact', 'mail-compact&bg=folk', 'mail-seeall'];
const WAIT = { letter: 3400, onboarding: 4200, title: 2800, 'inbox-read': 2000, elected: 2600 };   // the letter's unfolding takes ~2.3 s
// node tests/ui/shoot.mjs mail-notify mail-column      -> desktop only; add --mobile for the 390x844 ones too
const args = process.argv.slice(2), mob = args.includes('--mobile'), want = args.filter(a => a !== '--mobile'); const list = want.length ? want : ALL;
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'web'), stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--hide-scrollbars'] });
let bad = 0;
async function shoot(preset, w, h, suffix = '') {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}/ui-lab.html?state=${preset}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, WAIT[preset.split('&')[0]] || 1800));
  const name = preset.replace(/&step=/, '-').replace(/&letter=/, '-').replace(/&bg=/, '-').replace(/&hover=1/, '-hover').replace(/&long=1/, '-long').replace(/&who=/, '-').replace(/&font=/, '-font').replace(/&n=/, '-n').replace(/&cinema=1/, '-cinema') + suffix;
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`${errors.length ? 'ERR ' : 'ok  '} ${name}${errors.length ? '  ' + errors.join(' | ') : ''}`);
  bad += errors.length; await page.close();
}
try {
  for (const p of list) await shoot(p, 1440, 900);
  if (!want.length) for (const p of MOBILE) await shoot(p, 390, 844, '-mobile');
  else if (mob) for (const p of want) await shoot(p, 390, 844, '-mobile');
} finally { await browser.close(); server.kill(); }
process.exit(bad ? 1 : 0);

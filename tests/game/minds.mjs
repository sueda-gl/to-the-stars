// Headless check of the agent minds in THE game (ART_DIRECTION §18, docs/minds.md "What the game layer must do"): the cast
// lands at spawn (after the squares form, before the introductions), the fleet captions carry a persona's backstory line, the
// loop starts after the election, and within two minutes of play at least 3 mind bubbles and one two-folk conversation
// (alternating chat bubbles over both speakers, the two facing each other) appear; the ledger (Tab) carries the quiet lines
// and the one-line mind status; the director's minister briefing arrives as a letter; "what happens next?" runs the director.
// Screenshots -> shots/game/minds/*.png. Fails on any page error or a step that never happens.
// Usage: node tests/game/minds.mjs [--url http://localhost:8870] [--minds live|mock] [--opening auto|play] [--seed 7] [--window 120]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8870'), MODE = arg('--minds', ''), OPENING = arg('--opening', 'auto'), SEED = arg('--seed', '7'), WINDOW = +arg('--window', '120') * 1000;
const OUT = new URL('../../shots/game/minds/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + '  (' + T() + ')'); if (!ok) fails++; return ok; };
const tag = MODE ? MODE + '-' : '';

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--use-fake-ui-for-media-stream'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('  [pageerror]', e.message); });
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/favicon|manifest\.js|404/.test(t)) console.log('  [console.error]', t.slice(0, 240)); if (/\[agora\] minds/.test(t)) console.log('  ', t.slice(0, 200)); });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const shot = name => page.screenshot({ path: OUT + tag + name + '.png' }).then(() => console.log('  shot', tag + name, T()));
const until = async (fn, ms, label, ...args) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn, ...args)) return true; await sleep(250); } console.log('  timeout:', label); return false; };
const mlog = () => ev(() => window.__mindLog);

try {
  await page.goto(`${BASE}/?intro=none&opening=${OPENING}&autostart=1&seed=${SEED}&log=1${MODE ? '&minds=' + MODE : ''}`, { waitUntil: 'load' });
  check(await until(() => !!window.__agora, 60000, 'boot'), 'booted');
  // a log of everything the minds emit, installed before the opening
  await ev(() => {
    const g = window.__agora.game, L = window.__mindLog = { say: [], conv: [], cast: null, castPhase: null, introduced: 0, captionNotes: [], status: [], direct: [], letters: [] };
    g.on('agent:say', p => L.say.push({ ...p, at: Date.now() }));
    g.on('conversation:start', p => L.conv.push({ ...p, at: Date.now() }));
    g.on('mind:cast', p => { L.cast = { ...p, at: Date.now(), phase: window.__agora.opening && window.__agora.opening.phase }; });
    g.on('fleet:introduce', () => { L.introduced++; setTimeout(() => { const n = document.querySelector('.ag-fleet__note'); L.captionNotes.push(n ? n.textContent.trim() : null); }, 900); });
    g.on('mind:status', s => L.status.push({ mode: s.mode, enabled: s.enabled, calls: { ...s.calls }, failures: s.failures, err: s.lastError && s.lastError.message }));
    g.on('mind:direct', p => L.direct.push(p));
    g.on('letter:new', ({ letter }) => L.letters.push({ id: letter.id, kind: letter.kind, subject: letter.subject, meta: letter.meta || null, from: letter.from }));
  });
  const info = await ev(() => ({ live: window.__agora.live, loop: !!window.__agora.minds, mode: window.__agora.minds && window.__agora.minds.status().mode }));
  console.log('   ', JSON.stringify(info));
  check(info.loop, `the mind loop exists (mode ${info.mode})`);
  check(await until(() => window.__agora.introDone, 60000, 'intro'), 'the intro finished');

  // ---- the cast at spawn: after the squares form, before the introductions ----
  check(await until(() => window.__mindLog.cast != null, 70000, 'cast'), 'the personas were cast');
  let L = await mlog();
  console.log('    cast:', JSON.stringify({ count: L.cast && L.cast.count, phase: L.cast && L.cast.phase, tensions: L.cast && L.cast.tensions.length, introducedBefore: L.introduced }));
  check(L.cast && L.cast.count >= 10 && (L.cast.phase === 'landing' || L.introduced === 0), `${L.cast && L.cast.count} personas cast during the ${L.cast && L.cast.phase} (before the introductions: ${L.introduced} introduced so far)`);
  check(await ev(() => !window.__agora.mindsStarted), 'the loop is not started before the election');
  check(await until(() => window.__agora.opening && window.__agora.opening.phase === 'intro' && document.querySelector('.ag-fleet'), 40000, 'caption'), 'a fleet is introduced with its caption');
  await sleep(1000); await shot('01-caption-backstory');
  const note = await ev(() => { const n = document.querySelector('.ag-fleet__note'); return n ? n.textContent.trim() : null; });
  check(!!note && note.length > 20, `the caption carries a persona's backstory line: "${note}"`);
  if (OPENING === 'play') {
    check(await until(() => window.__agora.opening.phase === 'election', 60000, 'election'), 'the election asks');
    await sleep(1500);
    const at = await ev(() => { const A = window.__agora; for (const a of A.game.state.agents) { const p = A.agents.screenOf(a.id); if (p && p.x > 60 && p.x < innerWidth - 60 && p.y > 120 && p.y < innerHeight - 80) return p; } return null; });
    if (at) { await page.mouse.move(at.x, at.y); await sleep(200); await page.mouse.click(at.x, at.y); }
  }
  check(await until(() => window.__agora.opening && window.__agora.opening.phase === 'done', 90000, 'opening'), 'the opening is done (the seal, the ceremony, the leader view)');
  check(await ev(() => window.__agora.mindsStarted && window.__agora.minds.status().enabled), 'the loop started after the election');
  await ev(() => { try { window.__agora.ui.onboarding.skip(); } catch (_) {} try { window.__agora.ui.letters.close(); } catch (_) {} });
  const playT0 = Date.now();
  await sleep(600); await shot('02-leader-after-opening');

  // ---- within two minutes of play: >= 3 mind bubbles and one two-folk conversation ----
  const minds3 = await until(() => window.__mindLog.say.filter(s => s.kind === 'mind').length >= 3, WINDOW, 'mind bubbles');
  L = await mlog();
  const mindsN = L.say.filter(s => s.kind === 'mind');
  check(minds3, `${mindsN.length} mind bubbles within ${((Date.now() - playT0) / 1000).toFixed(0)} s: ${mindsN.slice(0, 3).map(s => `${s.agentId} "${s.text}" [${s.source}]`).join(' · ')}`);
  if (mindsN.length) { const b = await ev(() => document.querySelectorAll('.agb').length); console.log('    bubbles on screen now:', b); }
  // a conversation: wait for its first chat line, shoot it at the leader view, then close up on the pair
  const chat1 = await until(() => window.__mindLog.say.some(s => s.kind === 'chat'), Math.max(10000, WINDOW - (Date.now() - playT0)), 'a conversation');
  L = await mlog();
  const chats = L.say.filter(s => s.kind === 'chat');
  check(chat1, `a two-folk conversation started within ${((Date.now() - playT0) / 1000).toFixed(0)} s (${L.conv.length} started, ${chats.length} chat lines so far)`);
  if (chat1) {
    const c = chats[0];
    const conv = await ev(id => { const S = window.__agora.game.state; const c = (S.conversations || []).find(x => x.id === id); return c ? { a: c.a, b: c.b, topic: c.topic, lines: c.lines && c.lines.length, status: c.status } : null; }, c.conversationId);
    console.log('    conversation:', JSON.stringify(conv));
    await sleep(300); await shot('03-conversation-leader');
    const onScreen = await ev(() => Array.from(document.querySelectorAll('.agb')).map(e => ({ who: e.dataset.agent, text: e.textContent.trim(), on: e.classList.contains('on') })));
    console.log('    bubbles:', JSON.stringify(onScreen));
    check(onScreen.some(b => b.who === c.agentId), `the chat bubble is over the speaker ${c.agentId} at the leader view`);
    // the listener turns to face the speaker (faceAt set on the bridge record)
    const facing = await ev((a, b) => { const A = window.__agora.agents, ra = A.get(a), rb = A.get(b); return { a: !!(ra && ra.faceAt), b: !!(rb && rb.faceAt), ra: ra && ra.faceAt, rb: rb && rb.faceAt }; }, conv.a, conv.b);
    check(facing.a && facing.b, `the two turn to face each other (${JSON.stringify(facing.ra)} / ${JSON.stringify(facing.rb)})`);
    // close up on the pair for the second line
    await ev((a, b) => { const S = window.__agora.game.state, A = S.agents.find(x => x.id === a), B = S.agents.find(x => x.id === b); return window.__agora.world.focus((A.x + B.x) / 2, (A.z + B.z) / 2, { dist: 13, pitch: 0.55, ms: 900 }); }, conv.a, conv.b);
    const second = await until((id, n) => window.__mindLog.say.filter(s => s.kind === 'chat' && s.conversationId === id).length >= n, 9000, 'second line', c.conversationId, 2);
    await sleep(400); await shot('04-conversation-close');
    L = await mlog();
    const lines = L.say.filter(s => s.kind === 'chat' && s.conversationId === c.conversationId);
    console.log('    lines:', JSON.stringify(lines.map(l => ({ who: l.agentId, turn: l.turn, of: l.of, text: l.text, at: +((l.at - lines[0].at) / 1000).toFixed(1) }))));
    check(second && lines.length >= 2 && lines[0].agentId !== lines[1].agentId, 'the lines alternate between the two speakers');
    check(lines.length < 2 || Math.abs((lines[1].at - lines[0].at) / 1000 - 2.6) < 0.9, `the second line comes ~2.6 s after the first (${lines.length > 1 ? ((lines[1].at - lines[0].at) / 1000).toFixed(1) : '-'} s)`);
    await ev(() => window.__agora.world.home({ ms: 800 })); await sleep(1000);
  }

  // ---- the ledger: the quiet lines and the mind status ----
  await page.keyboard.press('Tab'); await sleep(700);
  const ledger = await ev(() => ({ open: window.__agora.ui.ledger.isOpen, lines: Array.from(document.querySelectorAll('.ag-ledger__socline')).map(e => e.textContent.trim()), mind: (document.querySelector('.ag-ledger__mind') || {}).textContent || null, notices: document.querySelectorAll('.ag-notice, .ag-notices > *').length }));
  console.log('    ledger:', JSON.stringify(ledger));
  check(ledger.open && ledger.lines.length >= 1, `the ledger carries ${ledger.lines.length} quiet lines from the minds`);
  check(!!ledger.mind && /minds/.test(ledger.mind), `the ledger's foot says the mind status: "${ledger.mind}"`);
  await shot('05-ledger');
  await page.keyboard.press('Escape'); await sleep(400);
  check(await ev(() => !window.__agora.ui.ledger.isOpen), 'Esc closes the ledger');

  // ---- the director: the briefing is a minister letter; "what happens next?" is the cue ----
  L = await mlog();
  console.log('    director runs:', L.direct.length, JSON.stringify(L.direct.map(d => ({ reason: d.reason, events: d.events, briefing: d.briefing }))));
  if (!L.letters.some(l => l.meta && l.meta.director)) { await ev(() => window.__agora.handle('what happens next?')); }
  check(await until(() => window.__mindLog.letters.some(l => l.meta && l.meta.director), 100000, 'briefing letter'), 'the director\'s minister briefing arrived as a letter');
  L = await mlog();
  const br = L.letters.find(l => l.meta && l.meta.director);
  console.log('    briefing:', JSON.stringify(br));
  check(!!br && br.kind === 'report' && (br.from.kind === 'minister' || br.from.kind === 'ministry'), `the briefing is a ${br && br.kind} letter from the ${br && br.from.kind} (${br && br.from.name}): "${br && br.subject}"`);
  await sleep(1200); await shot('06-briefing-letter');
  const ids = await ev(() => window.__agora.ui.letters.all.map(l => l.id));
  if (br && ids.includes(br.id)) { await ev(id => { const A = window.__agora; const l = A.ui.letters.all.find(x => x.id === id); A.ui.letters.openCompact ? A.ui.letters.openCompact(l) : A.ui.letters.open(id); }, br.id); await sleep(900); await shot('07-briefing-open'); await page.keyboard.press('Escape'); }

  L = await mlog();
  const st = L.status.at(-1);
  console.log('    status:', JSON.stringify(st), 'say kinds:', JSON.stringify(L.say.reduce((m, s) => (m[s.kind] = (m[s.kind] || 0) + 1, m), {})), 'sources:', JSON.stringify(L.say.filter(s => s.kind === 'mind').reduce((m, s) => (m[s.source] = (m[s.source] || 0) + 1, m), {})));
  const errs = await ev(() => window.__agora.errors);
  check(errs.length === 0 && pageErrors.length === 0, `no page errors (${errs.length} recorded, ${pageErrors.length} uncaught)`);
  if (errs.length) console.log('  recorded:', JSON.stringify(errs.slice(0, 5)));
} catch (e) {
  console.log('FAIL (exception):', e.stack || e.message); fails++;
  try { await shot('99-failure'); } catch (_) {}
}
console.log(`${fails ? 'FAILED' : 'OK'}: ${fails} failing checks in ${T()}`);
await browser.close();
process.exit(fails ? 1 : 0);

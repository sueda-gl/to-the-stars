// Director mode (?director=1): a scripted sequence of beats that plays the demo, for the video.
//   createDirector({ beats = DEFAULT_BEATS, hooks, timing = TIMING }) -> { play(), stop(), skip(), state }
// A beat:
//   { id?, caption?: string,                 // hooks.caption(text) — a stage caption, shown until the next
//     title?: { text, sub?, ms? },           // hooks.title(...) — a title card
//     say?: string | (hooks) => string,      // hooks.say(text) word-by-word, then hooks.command(text, beat)
//     fallback?: (hooks, result) => {},     // runs when the command came back noop-only (or threw): the video never shows a refusal
//     pointer?: { x, y } | string,           // hooks.pointer(...) — scripted cursor (viewport fractions or a named spot)
//     camera?: { to, ms },                   // hooks.camera({ to, ms })
//     wait?: ms | 'idle' | { event, timeout } // sleep, hooks.idle(), or hooks.waitEvent(name, timeout)
//     do?: async (hooks, ctx) => {} }        // anything else
// Hooks are optional: a missing hook is skipped, so the script runs against any partial game.
// The game (game.js) supplies hooks; voice-lab.html has a fake set.

export const TIMING = {
  wordsPerSecond: 3.2,     // caption typing speed (hooks.say)
  afterSay: 350,           // pause between the last word and the command
  descent: 6000,           // camera descent length (the globe dive + the map's descent)
  title: 2800,             // title card hold
  spawn: 2400,             // folk spawn
  settle: 1100,            // small breather after a build finishes
  letterRead: 3800,        // how long an opened letter stays up
  letterWait: 14000,       // max wait for a letter to arrive
  idleMax: 40000,          // max wait for the world to go idle (codegen can take a while)
  neighbourFlight: 8000,   // "show me the neighbours" camera flight
  meeting: 6500,           // up-close meeting hold
  voyage: 45000,           // max wait for the Moon (election letter + the globe's flight) and for the way home
  seedWait: 9000,          // the shadelings gather round the seed
  goldenWait: 6000,        // the lounge eases into golden hour
  outro: 4000,
  speed: 1,                // global multiplier (<1 is faster); ?speed=0.3 in the lab
};

const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(abortErr());
  const t = setTimeout(() => { signal?.removeEventListener('abort', onA); res(); }, ms);
  const onA = () => { clearTimeout(t); rej(abortErr()); };
  signal?.addEventListener('abort', onA, { once: true });
});
const abortErr = () => Object.assign(new Error('director aborted'), { code: 'aborted' });
const isAbort = (e) => e?.code === 'aborted' || e?.name === 'AbortError';

// Shows text as if spoken: onText(soFar) per word at wps words/second. Resolves when done.
export async function wordByWord(text, { wps = TIMING.wordsPerSecond, onText = () => {}, signal = null, speed = 1 } = {}) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const per = (1000 / wps) * speed;
  let out = '';
  for (let i = 0; i < words.length; i++) {
    out = out ? `${out} ${words[i]}` : words[i];
    onText(out, { i, n: words.length });
    // punctuation breathes
    const extra = /[,;:]$/.test(words[i]) ? 0.6 : /[.?!]$/.test(words[i]) ? 1.0 : 0;
    await sleep(per * (0.75 + Math.random() * 0.5) * (1 + extra), signal);
  }
  return out;
}

// A command result that did nothing: no actions, or only noops. Shapes: { actions:[...] } or an array.
export const isNoop = (result) => {
  const acts = Array.isArray(result) ? result : Array.isArray(result?.actions) ? result.actions : null;
  if (!acts) return result == null || result === false;
  return acts.length === 0 || acts.every(a => !a || a.type === 'noop');
};

// The demo video script, three acts in ~4 minutes with the live mind. Names come from hooks.pickAgentName(skill) so any
// seed works. Every utterance carries a build / send / show verb, the diplomacy and meeting beats carry a local fallback,
// and the Moon utterances are functions (they only parse with scene 'moon', so the earth-side intent test skips them).
const DEFAULT_BEATS_V1 = [
  { id: 'descent', camera: { to: 'descent', ms: 'descent' }, caption: null, wait: 'descent' },
  { id: 'title', title: { text: 'AGORA', sub: 'a civilisation you speak into being', ms: 'title' }, wait: 'title' },
  { id: 'spawn', do: (h) => h.spawn?.(), caption: 'Little folk arrive on the cream paper.', wait: 'spawn' },
  { id: 'house', say: "Let's build a house in the middle.", wait: 'idle', caption: 'Say it. They build it.' },
  { id: 'house-settle', wait: 'settle' },
  { id: 'windmill', pointer: 'windmill', say: 'and a windmill there', wait: 'idle', caption: '"There" is wherever your cursor is.' },
  { id: 'baking', say: 'who here is good at baking?', wait: { event: 'letter:new', timeout: 'letterWait' }, caption: 'They cannot speak. They write.' },
  { id: 'baking-letter', do: (h) => h.openLetter?.(), wait: 'letterRead' },
  { id: 'minister', do: (h) => h.closeLetter?.(), say: (h) => `make ${h.pickAgentName?.('baking') || 'Olla'} our minister`, wait: 'settle', caption: 'Appoint a minister by name.' },
  { id: 'lighthouse', pointer: 'cliff', say: 'build a lighthouse on the cliff', caption: 'Nobody shipped a lighthouse. The Ministry of Builds draws one.', wait: 'idle' },
  { id: 'lighthouse-settle', wait: 'settle' },
  { id: 'duck', pointer: 'lake', say: 'put a giant rubber duck there, in the lake', wait: 'idle', caption: 'Anything. Really.' },
  { id: 'envoy', do: (h) => h.envoy?.(), caption: 'An envoy from the neighbours.', wait: { event: 'letter:new', timeout: 'letterWait' } },
  { id: 'envoy-letter', do: (h) => h.openLetter?.(), wait: 'letterRead' },
  { id: 'bread', do: (h) => h.closeLetter?.(), say: 'send the neighbours a basket of bread', wait: 'settle', caption: 'Gifts travel. Visibly.', fallback: (h) => h.gift?.({ what: 'bread' }) },
  { id: 'neighbours', say: 'show me the neighbours', camera: { to: 'neighbours', ms: 'neighbourFlight' }, wait: 'neighbourFlight', caption: 'The real Earth. Three rival nations.', fallback: (h) => h.visitNeighbour?.() },
  { id: 'home-again', do: (h) => h.goHome?.(), wait: 'settle', caption: null },
  { id: 'meeting', say: 'call a meeting', camera: { to: 'meeting', ms: 'settle' }, wait: 'meeting', caption: 'The minister reads the report.', fallback: (h) => h.meeting?.() },
  { id: 'meeting-end', do: (h) => h.endMeeting?.(), wait: 'settle', caption: null },
  { id: 'rocket', say: 'build a rocket', wait: 'idle', caption: 'Act three. The nations elect us Earth’s envoy.' },
  { id: 'moon', say: () => "let's go to the moon", wait: { event: 'stage:moon', timeout: 'voyage' }, caption: 'Earth to the Moon, on the real globe.' },
  { id: 'moon-settle', wait: 'settle', caption: 'The shadelings’ meadow.' },
  { id: 'seed', say: () => 'offer them a seed', wait: 'seedWait', caption: 'Speak here too.' },
  { id: 'golden', say: () => 'wait for the evening', wait: 'goldenWait', caption: 'Golden hour.' },
  { id: 'home', say: () => "let's go home", wait: { event: 'stage:world', timeout: 'voyage' }, caption: 'Home.' },
  { id: 'outro', title: { text: 'AGORA', sub: 'hold Space. speak.', ms: 'outro' }, caption: null, wait: 'outro' },
];

// ---------- v2: the ALOUD trailer's gameplay take (?director=1&beats=v2, tests/record/trailer.mjs gameplay --tag v2) ----------
// The CURRENT game: the pop title with Begin pressed, the seamless cloud descent, the companies landing and the election
// (the opening, auto), then typed lines shown as spoken (the voice bar), the pencil-then-paint builds, a field drawn as a
// pencil loop, a resident's red dot -> the letter, a neighbour's letter, Call the Ministry (chirps + subtitles), the peek
// at a developed civilisation, the rocket and the voyage. No stage captions (the trailer sets its own type). Every beat is
// guarded: a missing feature is skipped in a breath, so the take runs against any partial game.
const A = () => (typeof window !== 'undefined' ? window.__agora : null) || {};
function waitFor(test, timeout = 20000, every = 150) {
  return new Promise(res => {
    const t0 = Date.now();
    const tick = () => { let ok = false; try { ok = !!test(); } catch (_) {} if (ok) return res(true); if (Date.now() - t0 > timeout) return res(false); setTimeout(tick, every); };
    tick();
  });
}
const later = ms => new Promise(r => setTimeout(r, ms));
// the drawn cursor (game/director-hooks.js makes .ag-cursor): eased moves, a press
function cursorEl() {
  const el = typeof document !== 'undefined' ? document.querySelector('.ag-cursor') : null;
  if (el) el.style.zIndex = '2147483000';   // over the title, the mailbox and the call card
  return el;
}
// our moves are eased per frame: the stylesheet's .9 s left/top transition (the hooks' world-spot pointer) must not fight them
function rigid(el, on) { if (el) el.style.transition = on ? 'opacity .4s, transform .12s ease' : ''; }
async function cursorTo(x, y, ms = 700) {
  const el = cursorEl(); if (!el) return;
  const r0 = { x: parseFloat(el.style.left) || innerWidth * 0.62, y: parseFloat(el.style.top) || innerHeight * 0.7 };
  el.classList.add('is-on'); rigid(el, true);
  const t0 = performance.now();
  await new Promise(res => { const step = () => { const k = Math.min(1, (performance.now() - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    el.style.left = (r0.x + (x - r0.x) * e) + 'px'; el.style.top = (r0.y + (y - r0.y) * e) + 'px'; if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
  rigid(el, false);
}
async function press() { const el = cursorEl(); if (!el) return; rigid(el, true); el.style.transform = 'scale(0.7)'; await later(150); el.style.transform = ''; await later(130); rigid(el, false); }
async function clickEl(target, { ms = 800, hold = 250 } = {}) {
  if (!target) return false;
  const r = target.getBoundingClientRect();
  await cursorTo(r.left + r.width / 2, r.top + r.height / 2, ms);
  await later(hold); await press();
  try { target.click(); } catch (_) {}
  return true;
}
function hideCursor() { const el = cursorEl(); if (el) el.classList.remove('is-on'); }
// a pencil loop dragged on the paper with real pointer events (marks.js reads them), the cursor riding along
async function drawLoop(cx, cz, rx = 5, rz = 3.6) {
  const { world, marks } = A(); if (!world || !marks) return false;
  const canvas = A().ctx?.renderer?.domElement || document.querySelector('canvas');
  const pts = []; const n = 44;
  for (let i = 0; i <= n + 2; i++) { const a = (i / n) * Math.PI * 2 + 0.3, wob = 1 + 0.06 * Math.sin(a * 3 + 1); const p = world.project(cx + Math.cos(a) * rx * wob, 0, cz + Math.sin(a) * rz * wob); pts.push(p); }
  const before = (marks.list() || []).length;
  await cursorTo(pts[0].x, pts[0].y, 700); await later(200);
  const ev = (type, p) => new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, composed: true });
  rigid(cursorEl(), true);
  canvas.dispatchEvent(ev('pointerdown', pts[0]));
  for (let i = 1; i < pts.length; i++) { const el = cursorEl(); if (el) { el.style.left = pts[i].x + 'px'; el.style.top = pts[i].y + 'px'; } window.dispatchEvent(ev('pointermove', pts[i])); await later(34); }
  window.dispatchEvent(ev('pointerup', pts.at(-1)));
  rigid(cursorEl(), false);
  await later(300);
  if ((marks.list() || []).length > before) return true;
  // the events did not take: lay the same loop down directly
  try { marks.add({ kind: 'area', poly: Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]; }) }); } catch (_) {}
  return false;
}
const alive = () => (A().game?.state?.agents || []).filter(a => a.status !== 'left');
const newestLetter = (test) => (A().ui?.letters?.all || []).find(test);

export const BEATS_V2 = [
  // the pop title over her planet, Begin pressed (Begin runs the game's own begin(): the descent + the opening, auto)
  { id: 'title', do: async () => {
      const { ui, planet } = A(); if (!ui?.titleCard) return;
      let release = null;
      try { const m = await import('./ui/title.js'); if (m.frameTitlePlanet && planet) release = m.frameTitlePlanet(planet); } catch (_) {}
      ui.titleCard.show({});
      await later(3600);
      const btn = document.querySelector('.tt__begin');
      if (release) { try { release(1400); } catch (_) {} }
      if (btn) await clickEl(btn, { ms: 900, hold: 350 });
      if (ui.titleCard.visible) ui.titleCard.start();
      hideCursor();
    } },
  { id: 'descent', do: () => waitFor(() => A().introDone, 40000) },
  // the companies fly down into their squares, the roll-call; ends as the election opens
  { id: 'spawn', do: () => waitFor(() => ['election', 'ceremony'].includes(A().opening?.phase), 60000) },
  { id: 'minister', do: async () => {
      await waitFor(() => { const o = A().opening; return o && !o.active && (o.phase === 'done' || o.phase === 'idle' || o.phase === 'paused'); }, 30000);
      try { const F = A().game?.future; if (F && !F.ready && F.prepare) F.prepare(); } catch (_) {}   // the peek's city builds in thin slices meanwhile
      await later(1200);
    } },
  { id: 'house', pointer: 'middle', say: 'build a house here', wait: 'idle' },
  { id: 'house-settle', wait: 1500 },
  { id: 'windmill', pointer: 'windmill', say: 'and a windmill there', wait: 'idle' },
  { id: 'field', do: async (h) => {
      const { game, world } = A(); const c = game?.state?.centre || { x: 0, z: 0 };
      try { await world.focus(c.x - 7, c.z + 6, { ms: 1200 }); } catch (_) {}
      await drawLoop(c.x - 9, c.z + 7);
      hideCursor();
    }, say: 'this is a field', wait: 'idle' },
  { id: 'field-settle', wait: 1200 },
  // a resident writes: the red dot over its head, the cursor clicks it, the letter opens (two actions + Write back)
  { id: 'ask', say: 'who here is good at baking?', wait: { event: 'letter:new', timeout: 'letterWait' } },
  { id: 'reddot', do: async () => {
      const { mailDots, world, agents, game } = A(); if (!mailDots) return;
      await waitFor(() => (mailDots.list() || []).length, 6000);
      const d = (mailDots.list() || [])[0]; if (!d) return;
      const a = (game.state.agents || []).find(x => x.id === d.agentId);
      if (a) { let p = { x: a.x, z: a.z }; try { const hd = agents.headOf(a.id); if (hd) p = hd; } catch (_) {} try { await world.focus(p.x, p.z, { dist: 10, pitch: 0.45, ms: 1600 }); } catch (_) {} }
      await later(1700);
      const dd = (mailDots.list() || []).find(x => x.agentId === d.agentId) || d;
      const els = [...document.querySelectorAll('.ag-maildot')];
      const el = els.sort((p, q) => { const rp = p.getBoundingClientRect(), rq = q.getBoundingClientRect(); return Math.hypot(rp.x - dd.x, rp.y - dd.y) - Math.hypot(rq.x - dd.x, rq.y - dd.y); })[0];
      await later(600);
      if (el) await clickEl(el, { ms: 900, hold: 400 }); else A().ui.letters.toggleList(true);
    } },
  { id: 'letter', do: async () => {
      await later(2600);
      const wb = [...document.querySelectorAll('.ag-mread__winput')].find(b => b.offsetParent);
      if (wb) { const r = wb.getBoundingClientRect(); await cursorTo(r.left + r.width / 2, r.top + r.height / 2, 900); }
      await later(1800); hideCursor();
      try { const L = A().ui.letters; if (L.isOpen) L.close(); } catch (_) {}
    } },
  { id: 'lighthouse', pointer: 'cliff', say: 'build a lighthouse on the cliff', wait: 'idle' },
  { id: 'lighthouse-settle', wait: 1500 },
  { id: 'duck', pointer: 'lake', say: 'put a giant rubber duck there, in the lake', wait: 'idle' },
  { id: 'duck-settle', wait: 1200 },
  // the rewards: a build, the "+n" stamps and tokens arcing into the tally
  { id: 'rewards', do: () => { hideCursor(); }, say: 'build a bakery by the road', wait: 'idle' },
  { id: 'rewards-pop', wait: 3200 },
  // a neighbour writes (the mailbox only: nations have no head)
  { id: 'envoy', do: async (h) => { h.envoy?.(); await waitFor(() => newestLetter(x => x?.from?.kind === 'neighbour' && !x.read), 8000); await later(1200); } },
  { id: 'neighbour-letter', do: async () => {
      const L = newestLetter(x => x && x.from && x.from.kind === 'neighbour' && !x.read);
      const ui = A().ui;
      const box = document.querySelector('.ag-mailbox, [class*="mailbox"]');
      if (box && box.offsetParent) { const r = box.getBoundingClientRect(); await cursorTo(r.left + r.width / 2, r.top + r.height / 2, 900); await press(); }
      try { if (L) ui.letters.read(L); else ui.letters.toggleList(true); } catch (_) {}
      await later(4500); hideCursor();
      try { if (ui.letters.isOpen) ui.letters.close(); } catch (_) {}
    } },
  // Call the Ministry: the minister answers in chirps, the English subtitle types itself
  { id: 'call', do: async () => {
      const { ministry } = A(); const call = ministry?.call; if (!call) return;
      const btn = call.button || document.querySelector('.ag-callbtn');
      if (btn && btn.offsetParent) await clickEl(btn, { ms: 900, hold: 300 }); else call.open();
      if (!call.isOpen) call.open();
      await later(1600); hideCursor();
      const ui = A().ui; ui.voiceBar.setState('listening');
      await wordByWord('what should we build next?', { onText: t => ui.voiceBar.setCaption(t, false) });
      ui.voiceBar.setCaption('what should we build next?', true, { holdMs: 2500 });
      try { call.say('what should we build next?', { source: 'voice' }); } catch (_) {}
      ui.voiceBar.setState('done', '');
      const n0 = (call.log || []).length;
      await waitFor(() => (call.log || []).length > n0 + 0, 8000);
      await later(8000);
      if (call.isOpen) { const x = call.el && call.el.querySelector(".ag-call__x"); if (x && x.offsetParent) await clickEl(x, { ms: 700, hold: 200 }); }
      try { if (call.isOpen) call.close(); } catch (_) {}
      try { ui.voiceBar.setState('idle'); ui.voiceBar.setCaption(''); } catch (_) {}
      hideCursor();
      await later(800);
    } },
  // the peek at a developed civilisation (game.future, guarded on .ready) and back
  { id: 'future', do: async () => {
      const { game, futureToggle } = A(); const F = game?.future; if (!F) return;
      try { if (!F.ready && F.prepare) F.prepare(); } catch (_) {}
      await waitFor(() => F.ready, 30000); if (!F.ready) return;
      try { futureToggle?.dock(true); } catch (_) {}
      await later(500);
      const sw = futureToggle?.el;
      if (sw && sw.offsetParent) await clickEl(sw.querySelector('button, input, [role="switch"]') || sw, { ms: 900, hold: 300 });
      if (!F.active && !F.busy) { try { await F.enter(); } catch (_) {} }
      await waitFor(() => F.active && !F.busy, 8000); hideCursor();
    } },
  { id: 'future-hold', wait: 5500 },   // the future's own glide over the city + its "Developed civilisation · PREVIEW" badge (no camera of ours: it flew into the buildings)
  { id: 'future-exit', do: async () => {
      const { game, futureToggle } = A(); const F = game?.future; if (!F || !F.active) return;
      try { await F.exit(); } catch (_) {}
      await waitFor(() => !F.active && !F.busy, 8000);
      try { futureToggle?.dock(false); } catch (_) {}
      await later(800);
    } },
  // act three: the rocket, and the launch to the Moon
  { id: 'rocket', say: 'build a rocket', wait: 'idle' },
  { id: 'rocket-settle', wait: 1200 },
  { id: 'moon', say: () => "let's go to the moon", wait: { event: 'stage:moon', timeout: 'voyage' } },
  { id: 'moon-settle', wait: 4000 },
  { id: 'end', wait: 300 },
];
// ?beats=v2 picks the trailer's take (game.js passes DEFAULT_BEATS)
const BEATS_V1 = DEFAULT_BEATS_V1;

export const DEFAULT_BEATS = (typeof location !== 'undefined' && /[?&]beats=v2\b/.test(location.search)) ? BEATS_V2 : BEATS_V1;

export function createDirector({ beats = DEFAULT_BEATS, hooks = {}, timing = {}, log = () => {}, win = typeof window !== 'undefined' ? window : null } = {}) {
  const T = { ...TIMING, ...timing };
  const ms = (v) => typeof v === 'string' ? (T[v] ?? 0) * T.speed : (Number(v) || 0) * T.speed;
  const state = { index: -1, playing: false, beat: null, done: false };
  let runAc = null, beatAc = null, resolvePlay = null;

  const h = (name, ...args) => (typeof hooks[name] === 'function' ? hooks[name](...args) : undefined);

  async function say(text, signal, beat = null) {
    if (typeof hooks.say === 'function') await hooks.say(text, { wps: T.wordsPerSecond, speed: T.speed, signal, wordByWord });
    else await wordByWord(text, { wps: T.wordsPerSecond, speed: T.speed, signal, onText: (t) => h('caption', t, { spoken: true }) });
    await sleep(ms('afterSay'), signal);
    if (typeof hooks.command !== 'function') return;
    // The game sees the beat too (its `fallback` tells it to swallow a refusal toast for this one).
    let result, failed = null;
    try { result = await hooks.command(text, beat); } catch (e) { if (isAbort(e)) throw e; failed = e; }
    if (beat?.fallback && (failed || isNoop(result))) {
      log('fallback', beat.id, failed ? failed.message : 'noop');
      await beat.fallback(hooks, result, failed);
    } else if (failed) throw failed;
  }

  async function wait(w, signal) {
    if (w == null) return;
    if (w === 'idle') {
      if (typeof hooks.idle !== 'function') return sleep(ms('settle'), signal);
      return Promise.race([hooks.idle(), sleep(ms('idleMax'), signal)]);
    }
    if (typeof w === 'object') {
      const timeout = ms(w.timeout ?? 'letterWait');
      if (typeof hooks.waitEvent !== 'function') return sleep(Math.min(timeout, ms('settle')), signal);
      return Promise.race([hooks.waitEvent(w.event, timeout), sleep(timeout, signal)]);
    }
    return sleep(ms(w), signal);
  }

  async function runBeat(beat, i, signal) {
    state.index = i; state.beat = beat;
    log('beat', beat.id || i);
    h('onBeat', beat, i);
    if ('caption' in beat) h('caption', beat.caption, { spoken: false });
    if (beat.title) h('title', { ...beat.title, ms: ms(beat.title.ms ?? 'title') });
    if (beat.pointer) await h('pointer', beat.pointer);
    if (beat.camera) h('camera', { to: beat.camera.to, ms: ms(beat.camera.ms ?? 'settle') });
    if (beat.do) await beat.do(hooks, { timing: T, signal, index: i });
    if (beat.say) await say(typeof beat.say === 'function' ? beat.say(hooks) : beat.say, signal, beat);
    await wait(beat.wait, signal);
  }

  async function play() {
    if (state.playing) return;
    state.playing = true; state.done = false;
    runAc = new AbortController();
    if (win) { win.__directorDone = false; win.__director = api; }
    h('onPlay');
    try {
      for (let i = 0; i < beats.length; i++) {
        if (runAc.signal.aborted) break;
        beatAc = new AbortController();
        const onRun = () => beatAc.abort();
        runAc.signal.addEventListener('abort', onRun, { once: true });
        try { await runBeat(beats[i], i, beatAc.signal); }
        catch (e) { if (!isAbort(e)) { log('error', beats[i].id || i, e); h('onError', e, beats[i]); } }
        finally { runAc.signal.removeEventListener('abort', onRun); }
      }
    } finally {
      state.playing = false; state.beat = null; state.done = true;
      h('caption', null, { spoken: false });
      if (win) win.__directorDone = true;
      h('onDone');
    }
  }

  const api = {
    play, state, beats, timing: T,
    stop() { runAc?.abort(); beatAc?.abort(); },
    skip() { beatAc?.abort(); },
    // Hooks can be filled in after creation (the game may wire them lazily).
    hooks,
  };
  return api;
}

export const isDirectorMode = (search = (typeof location !== 'undefined' ? location.search : '')) => /[?&]director=(1|true|on)\b/.test(search);

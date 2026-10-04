// The onboarding (ART_DIRECTION §24, Sueda 2026-10-04 11:20 + pm): eight steps right after the landing, in ONE small
// panel (ui.guide, ui/guide.js: a slim strip that tucks itself into a corner pill after the read or as soon as she
// acts), each completed by the real thing, not by reading:
//   welcome     "Welcome to planet R-99"                 the folk glide down into their squares       -> Continue
//   residents   "Meet your residents" (+ the census)      one wide view over every square              -> Continue (the squares break)
//   letters     a resident writes; a red dot over them    the ring on the mailbox, then on the row     -> a letter is opened
//   build       "Build anything, aloud"                   the ring on the mic; Type it / examples      -> the first build (voice or typed)
//   mark        "Mark the land"                           a ✕ or a loop on the ground                  -> a new mark (then "say what goes there")
//   minister    "Pick a minister"                         the ring on a resident; the click elects     -> minister:set (+ the ceremony)
//   neighbours  a nation writes: "keep relations good"    the ring on the mailbox                      -> their letter is opened
//   future      "Want to see how a developed civilisation looks? Toggle this." (a pop switch: game.future.enter / exit)
//               -> toggled back, or Continue: "Now let's go, we have lots to build!"
//   ministry    the Ministry's first jobs (top left) and "Call the Ministry"; "The Ministry will tell you the details from here" -> Start playing
// Then the game runs normally. "Skip tutorial" ends it at any step (the folk elect a minister themselves if none was
// chosen; the Ministry's list still starts). No welcome letter. Works with typed input as well as voice.
//
//   const ob = createOnboarding({ game, ui, world, agents, opening, ministry: () => ministry, log, onDone })
//   await ob.run() · ob.current -> 0..8 · ob.id · ob.goto(n | id) · ob.next() · ob.skip() · ob.state (tests)

import { ONBOARDING_STEPS as STEPS } from '../ui/guide.js';
import { makeLetter } from '../sim/letters.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const EXAMPLES = ['a windmill by the lake', 'a giant rubber duck in the lake', 'a little bakery in the middle'];

export function createOnboarding({ game, ui, world, agents, opening, ministry = () => null, futureToggle = null, mailDots = null, log = () => {}, onDone = null, showCard = null, voyage = null } = {}) {
  const guide = ui.guide;
  const N = STEPS.length;
  let writer = null, refocusAt = 0, futureWatch = 0, cur = 0, poll = 0, resolveRun = null, openingDone = null, sent = { welcome: null, neighbour: null }, built = false, finished = false, stepAt = 0, skipped = false, markAt = '';
  const alive = () => game.state.agents.filter(a => a.status !== 'left');
  const agentOf = id => game.state.agents.find(a => a.id === id) || null;
    const letterOpen = () => { try { return !!ui.letters.isOpen && ui.letters.openId != null; } catch (_) { return false; } };

  // ---------- the residents' letters (makeLetter -> the sim's own post: letter:new, the mailbox, the red dot) ----------
  const fromAgent = a => ({ kind: 'agent', id: a.id, name: a.name, species: a.species, trade: a.trade });
  const trade = a => (a.trade ? String(a.trade).toLowerCase() : 'resident');
  function send(a, letter, delay = 0.6) {
    try {
      const L = makeLetter({ from: fromAgent(a), day: game.state.day || 1, ...letter, meta: { ...(letter.meta || {}), onboarding: true } });
      game.sendLetter(L, { delay });
      return L.id;
    } catch (e) { log('onboarding letter', e.message); return null; }
  }
  // a warm first letter from a resident (no options: step 3 is about opening it)
  function welcomeLetter() {
    const folk = alive(); if (!folk.length) return null;
    const a = folk.slice().sort((x, y) => ((y.skills || {}).diplomacy || 0) - ((x.skills || {}).diplomacy || 0))[1] || folk[0];
    writer = a;
    return send(a, {
      kind: 'hello', subject: 'Hello from the beach',
      body: `Dear leader,\n\nWelcome! I am ${a.name}, one of your ${trade(a)}s, and the others asked me to write first. We landed with very little, but we are glad you are here.\n\nWhen one of us has something to say, we write to you, and a little red dot shows over our head. Click any of us to say hello.\n\n— ${a.name}`
    });
  }
  // a nation writes (the diplomacy step): an envoy flies it in (urgent: within ~3 s)
  function neighbourLetter() {
    const n = (game.state.neighbours || [])[0]; if (!n) return null;
    const name = n.title || n.name;
    try {
      const L = makeLetter({ from: { kind: 'neighbour', id: n.id, name: n.name }, kind: 'envoy', day: game.state.day || 1, subject: `Hello from ${name}`,
        body: `Hello, new neighbour!\n\nWe are ${name}, across the water. We saw your residents land. We hope we can be good friends.\n\nA gift now and then keeps a friendship warm.${n.leaderName ? `\n\n— ${n.leaderName}` : ''}`,
        options: [{ label: 'Send them bread', says: 'send bread to our neighbours' }, { label: 'Say hello back', says: 'say hello to our neighbours' }], meta: { urgent: true, onboarding: true } });
      game.sendLetter(L);
      return L.id;
    } catch (e) { log('neighbour letter', e.message); return null; }
  }

  // ---------- the panel ----------
  const S = n => STEPS[n - 1];
  const IDX = Object.fromEntries(STEPS.map((x, i) => [x.id, i + 1]));
  const at = id => cur === IDX[id];
  function show(id, extra = {}) {
    const n = IDX[id], s = S(n);
    guide.show({ step: n, total: N, id: s.id, icon: s.icon, title: s.title, body: s.body, pill: s.pill, todo: s.todo || null, ...extra });
  }
  const mailboxTarget = () => {
    const row = document.querySelector('.ag-mailcol:not(.is-reading) .ag-mailcol__item.is-unread .ag-mailcol__main');
    if (row) return row;
    const stack = document.querySelector('.ag-stack');
    return stack && !stack.hidden ? stack : null;
  };
  const mailboxLabel = () => (document.querySelector('.ag-mailcol:not(.is-reading)') ? 'open it' : 'mailbox');
  // the writer framed close and low, so the dot over the head reads; re-framed when they wander off the middle
  function frameWriter(ms = 1400) {
    const w = writer && agentOf(writer.id); if (!w) return;
    refocusAt = performance.now();
    try { world.focus(w.x, w.z, { dist: 15, pitch: 0.6, ms }); } catch (_) {}
  }
  const markSig = () => { try { return JSON.stringify(game.state.mark || null); } catch (_) { return ''; } };

  // ---------- the steps ----------
  const enter = {
    welcome() {
      ui.cinema(true);
      show('welcome', { action: { label: 'Continue', onClick: () => goto('residents') } });
    },
    residents() {
      // 15:35 (Sueda): "meet your workers, make me click on one and see their personality" (no 'go to work' camera rise)
      try { opening.overview(); } catch (_) {}
      let going = false, met = false;
      const rightmost = () => { let best = null, bx = -1; for (const a of alive()) { let p = null; try { p = agents.screenOf(a.id); } catch (_) {} if (p && p.x < innerWidth * 0.8 && p.y > 60 && p.y < innerHeight * 0.62 && p.x > bx) { bx = p.x; best = { a, p }; } } return best; };
      const onward = () => {
        if (going) return; going = true;
        try { ui.agentCard.hide(); } catch (_) {}
        guide.update({ point: null, action: null });
        goto('future');
        // the squares break and start work quietly in the background (no caption, no camera move asked for)
        Promise.resolve(opening.introduce({ every: 0, first: 0 })).catch(e => log('intro', e.message));
      };
      show('residents', { title: 'Meet your workers', body: 'Click on one of them to see who they are: their talents, their personality, what they think.', aside: census(), todo: 'Click a resident' });
      setTimeout(() => {
        if (!at('residents') || going) return;
        const r = rightmost(); if (!r) return;
        guide.update({ point: () => { try { const p = agents.screenOf(r.a.id); return p ? { x: p.x, y: p.y + 6, r: 26 } : null; } catch (_) { return null; } }, pointLabel: 'click me' });
      }, 1400);
      const watch = setInterval(() => {
        if (!at('residents') || going) { clearInterval(watch); return; }
        const id = ui.agentCard.agentId;
        if (id != null && !met) {
          met = true;
          const a = alive().find(x => x.id === id);
          guide.update({ point: null, todo: null, ok: null, title: `This is ${a ? a.name : 'one of your workers'}`,
            body: 'Everyone has different talents and opinions, and each of them can play a role in your new civilisation. Treat them well.',
            action: { label: 'Continue', onClick: onward } });
        }
      }, 250);
    },
    letters() {
      // §24 pm: taught from the RED DOT over the resident who wrote (the camera frames them; the dot is bigger and pulses)
      ui.cinema(false);
      try { ui.agentCard.hide(); } catch (_) {}
      if (!sent.welcome) sent.welcome = welcomeLetter();
      const w = writer;
      if (!w) { show('letters', { point: mailboxTarget, pointLabel: 'mailbox' }); return; }
      frameWriter(1600);
      try { mailDots && mailDots.teach(w.id); } catch (_) {}
      // 17:15 (Sueda): after the trip home the MAILBOX must be the obvious next move: the ring sits on it (then on the
      // unread row once it is open); the red dot over the writer still works too
      show('letters', { title: 'You\u2019ve got mail!', body: `${w.name} has written to you. Open your mailbox at the top right to read it. (You can also click the red dot above ${w.name}.)`,
        pill: 'Open your mailbox', todo: 'Open your mailbox, top right',
        point: mailboxTarget, pointLabel: 'open your mailbox' });
    },
    build() {
      show('build', {
        point: () => (ui.voiceBar.typingOpen ? null : '.ag-voice__mark'), pointLabel: '',
        chips: [{ icon: 'type', label: 'Type it', onClick: () => ui.voiceBar.openTyping() },   // 14:00: an easy one-tap build again
          ...EXAMPLES.slice(0, 2).map(t => ({ label: `“${t}”`, onClick: () => { ui.voiceBar.openTyping(); ui.voiceBar.setValue(t); } }))]
      });
      if (built) complete('build');
    },
    mark() {
      markAt = markSig();
      show('mark', { point: null });
    },
    minister() {
      if (game.state.minister) { minister(game.state.minister); return; }
      const hint = suggest();
      show('minister', { point: hint ? () => { try { const p = agents.screenOf(hint.id); return p ? { x: p.x, y: p.y + 6, r: 24 } : null; } catch (_) { return null; } } : null, pointLabel: 'click a resident' });
      try { opening.elect(); } catch (e) { log('elect', e.message); }
    },
    neighbours() {
      if (!sent.neighbour) sent.neighbour = neighbourLetter();
      show('neighbours', { point: mailboxTarget, pointLabel: 'mailbox' });
      if (!sent.neighbour) { setTimeout(() => at('neighbours') && goto('ministry'), 2500); return; }   // no nations in this game: on
      // Sueda 13:40: open their letter for her (she got stuck in the mailbox); the step text teaches the list
      setTimeout(() => {
        if (!at('neighbours') || done.neighbours) return;
        const L = (ui.letters.all || []).find(l => l.id === sent.neighbour);
        if (L) { try { ui.letters.read(L); } catch (e) { log('neighbour open', e.message); } }
      }, 1400);
    },
    future() {
      let said = false;
      const go = async () => {
        if (said) return; said = true;
        if (futureToggle && futureToggle.on) { try { await futureToggle.set(false); } catch (_) {} }
        guide.success('One day your country could look like that.');
        guide.update({ action: null, node: null });
        setTimeout(() => at('future') && goto('planets'), 2400);
      };
      let was = false;
      const sw = futureToggle ? futureToggle.switchEl({ label: 'See a developed civilisation' }) : null;
      show('future', { node: sw, action: { label: 'Continue', onClick: go }, hold: true });
      // toggled on, then back off: on
      futureWatch = setInterval(() => { if (!at('future') || !futureToggle) { clearInterval(futureWatch); return; } if (futureToggle.on) was = true; else if (was) { clearInterval(futureWatch); go(); } }, 250);
    },
    planets() {
      // 13:55: a space trip (just the voyage visuals, no rocket) to the lantern planet, landing at golden hour, then home
      let going = false;
      const home = async () => {
        guide.update({ action: null, todo: 'Flying home…', title: 'Okay, time to return', body: 'We have so much to do. Then maybe you can even discover new planets!' });
        try { if (voyage) await voyage.home(); } catch (e) { log('voyage home', e.message); }
        const t0 = performance.now(); while (voyage && voyage.away() && performance.now() - t0 < 60000) await sleep(300);
        if (at('planets')) goto('letters');
      };
      const go = async () => {
        if (going) return; going = true;
        if (!voyage) { goto('letters'); return; }
        guide.update({ action: null, todo: 'Flying out…' });
        let ok = true;
        try { const r = await voyage.go(); if (!r) ok = false; } catch (e) { log('voyage', e.message); ok = false; }
        const t0 = performance.now(); while (ok && !voyage.landed() && performance.now() - t0 < 45000) await sleep(300);
        if (!voyage.landed()) { log('voyage did not land: going home'); await home(); return; }   // never strand her in space
        try { await voyage.golden(); } catch (e) { log('golden', e.message); }
        if (!at('planets')) return;
        guide.update({ title: 'The lantern folk', body: 'Watch them in the evening light. Every planet has its own creatures.', todo: null,
          action: { label: 'Time to go home', onClick: () => {
            guide.update({ action: null });
            guide.success('Okay, time to return, we have so much to do. Maybe you can even discover new planets!');
            setTimeout(home, 2600);
          } } });
      };
      show('planets', { action: { label: 'Show me', onClick: go } });   // 17:05: the trip is part of the tour (no 'Not now')
    },
    ministry() {
      const m = ministry(); try { m && m.start(); } catch (e) { log('ministry', e.message); }
      show('ministry', { point: '.ag-callbtn', pointLabel: '', action: { label: 'Start playing', onClick: () => finish(false) } });
    }
  };
  // "48 residents · 4 flits · 8 floaties · 9 loaves ..." (every species, the townsfolk companies too)
  const PL = { loaf: 'loaves', floatie: 'floaties', flit: 'flits' };
  function census() {
    const folk = alive(), n = {};
    for (const a of folk) { let sp = null; try { sp = agents.speciesOf(a.id); } catch (_) {} sp = sp || a.species || 'folk'; n[sp] = (n[sp] || 0) + 1; }
    const parts = Object.entries(n).sort((a, b) => b[1] - a[1]).map(([sp, c]) => `${c} ${c === 1 ? sp : PL[sp] || sp + 's'}`);
    const fleets = (game.state.fleets || []).length;
    return { html: `<b>${folk.length} residents</b>${fleets ? ` <span class="n">in ${fleets} companies</span>` : ''}<em>${parts.join(' · ')}</em>` };
  }
  // the folk the ring suggests for minister: the best diplomat
  const suggest = () => alive().slice().sort((a, b) => ((b.skills || {}).diplomacy || 0) - ((a.skills || {}).diplomacy || 0))[0] || null;

  function goto(n) {
    if (finished) return;
    if (typeof n === 'string') n = IDX[n];
    if (!n || n > N) { finish(false); return; }
    cur = n; stepAt = performance.now();
    log('onboarding step', n, S(n).id);
    try { enter[S(n).id](); } catch (e) { log('onboarding', e.message); }
  }

  // ---------- completions by the real thing ----------
  const done = {};
  const openId = () => { try { return ui.letters.isOpen ? ui.letters.openId : null; } catch (_) { return null; } };
  function check() {
    if (finished || !cur) return;
    if (at('letters') && !done.letters) {
      if (writer) {
        let p = null; try { p = agents.screenOf(writer.id); } catch (_) {}
        const off = !p || Math.abs(p.x - innerWidth / 2) > innerWidth * .28 || Math.abs(p.y - innerHeight * .42) > innerHeight * .26;
        if (off && performance.now() - refocusAt > 2200) frameWriter(1600);
        if (letterOpen()) complete('letters');   // from the mailbox or the red dot, any letter
      } else if (letterOpen()) complete('letters');
    }
    if (at('mark') && !done.mark) {
      const sig = markSig();
      if (sig && sig !== 'null' && sig !== markAt) complete('mark');
    }
    if (at('neighbours') && !done.neighbours) {
      guide.update({ pointLabel: mailboxLabel() });
      const id = openId();
      if (id != null && (id === sent.neighbour || (ui.letters.all.find(l => l.id === id) || {}).from?.kind === 'neighbour')) complete('neighbours');
    }
  }
  const SUCCESS = {
    letters: ['That is how letters arrive: a red dot, then the letter. Answer in two taps, or write back.', 'build', 3400],
    build: ['Your residents are on it. Watch them build.', 'mark', 3200],
    mark: ['Marked! Now say what goes there, like “a field here”.', 'minister', 4200],
    neighbours: ['Good. Every letter you get waits in the mailbox, top right. Tap ‹ all letters to see the rest.', 'ministry', 4200]
  };
  function complete(id) {
    if (done[id] || !at(id)) return;
    done[id] = true;
    const [text, nextId, ms] = SUCCESS[id];
    if (id === 'letters') { try { mailDots && mailDots.teach(null); } catch (_) {} setTimeout(() => { try { world.home({ ms: 2800 }); } catch (_) {} }, 1600); }
    guide.success(text);

    setTimeout(() => at(id) && goto(nextId), ms);
  }
  function minister(id) {
    if (!at('minister')) return;
    const a = agentOf(id);
    guide.success(`${a ? a.name : 'Your minister'} is your minister. You can call them any time.`);
    // the ceremony up close, then the camera rises; then the neighbours
    const wait = openingDone ? Promise.race([openingDone, sleep(16000)]) : sleep(2500);
    wait.then(() => sleep(600)).then(() => { if (opening.phase === 'paused') { try { opening.finishGuided(); } catch (_) {} } if (at('minister')) goto('neighbours'); });
  }
  const offs = [];
  const on = (ev, fn) => { game.on(ev, fn); offs.push([ev, fn]); };
  on('building:site', () => { built = true; complete('build'); });
  on('building:needsDesign', () => { built = true; complete('build'); });
  on('minister:set', ({ agentId }) => { if (at('minister')) minister(agentId); });

  // ---------- run / skip / finish ----------
  function run() {
    if (resolveRun) return new Promise(res => { const r0 = resolveRun; resolveRun = v => { r0(v); res(v); }; });
    finished = false; skipped = false; cur = 0; for (const k of Object.keys(done)) delete done[k]; built = false; sent = { welcome: null, neighbour: null };
    const p = new Promise(res => { resolveRun = res; });
    openingDone = Promise.resolve(opening.run({ guided: true })).catch(e => log('opening', e.message));
    poll = setInterval(check, 200);
    goto('welcome');
    return p;
  }
  function finish(wasSkipped) {
    if (finished) return;
    finished = true; skipped = !!wasSkipped;
    clearInterval(poll);
    const was = cur; cur = 0;
    guide.hide();
    ui.cinema(false);
    if (skipped) { try { world.home({ ms: 2600 }); } catch (_) {} }
    { const m = ministry(); try { m && m.start(); } catch (_) {} }   // the Ministry's list starts either way
    clearInterval(futureWatch);
    try { mailDots && mailDots.teach(null); } catch (_) {}
    if (futureToggle) { try { futureToggle.dock(true); } catch (_) {} }   // the jury can peek again later
    try { if (opening.phase !== 'done' && opening.phase !== 'idle') opening.finishGuided({ crowd: true }); } catch (e) { log('finish', e.message); }
    log('onboarding done', skipped ? 'skipped at ' + was : '');
    const r = resolveRun; resolveRun = null; if (r) r({ skipped });
    if (typeof onDone === 'function') { try { onDone({ skipped, at: was }); } catch (_) {} }
  }
  function skip() {
    if (finished || !cur) return false;
    // still on the roll-call: drop it (the squares break at the ask), then the folk choose a minister
    try { opening.skipIntros(); } catch (_) {}
    finish(true);
    return true;
  }

  return {
    run, goto, skip, next: () => goto(cur + 1), start: () => run(),
    get current() { return cur; }, get id() { return cur ? S(cur).id : null; }, get active() { return !!cur; },
    get state() { return { current: cur, id: cur ? S(cur).id : null, built, done: { ...done }, sent: { ...sent }, skipped, finished, opening: opening.phase }; },
    dispose() { clearInterval(poll); offs.forEach(([ev, fn]) => { try { game.off && game.off(ev, fn); } catch (_) {} }); }
  };
}

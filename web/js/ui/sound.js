// Sound (2026-10-04): the game's music, sfx and the folk's ambient chirps. Everything is synthesized offline by
// scripts/make_game_audio.py (the trailer's synth, shots/trailer/sfx/make_audio.py) into web/assets/audio/*.mp3.
//
//   import { createSound } from './ui/sound.js';
//   const sound = createSound({ game, stages, ui, agents });
//   sound.play('chime') · sound.muted · sound.setMuted(bool) · sound.toggle() · sound.stats (tests)
//
// - One WebAudio context, created and resumed on the first user gesture (the title's Begin click or Space: browsers
//   block autoplay). Files are fetched + decoded lazily: the two loops on that gesture, the sfx on first use.
// - Music: `music-loop` on the seaside (stages.scene === 'world'), `music-space` everywhere else (orbit, voyage,
//   Plissé, the lounge), 2.5 s equal-power crossfade. The loops are periodic files with 0.5 s wrap padding
//   (assets/audio/manifest.json), played with loopStart/loopEnd, so they are seamless whatever the mp3 priming.
// - Sfx on game events: building:site -> scribble, building:done -> build-done, letter:new -> letter,
//   reward:gain / reward:milestone -> chime, stage (level-up) -> fanfare, voyage:start -> rumble, camera flights
//   (stages.flying / handoffMove: the cloud descent, the lifts) -> whoosh, buttons -> click.
// - Ambient chirps: every 3-8 s on the seaside a random folk babbles 2-5 syllables (ui/babble.js, volume .08),
//   sometimes answered; paused while the Ministry call is open (it babbles itself) and while muted.
// - A pop-style speaker button (bottom right) mutes/unmutes; the choice is kept in localStorage ('ag-sound-muted').
import { createBabble } from './babble.js';
import { PALETTE as P } from './icons.js';

const BASE = new URL('../../assets/audio/', import.meta.url).href;
const SFX = ['scribble', 'build-done', 'letter', 'chime', 'fanfare', 'click', 'whoosh', 'rumble'];
const VOL = { music: 0.35, sfx: 0.6, chirps: 0.08 };
const SFX_GAIN = { click: 0.35, chime: 0.7, whoosh: 0.6, rumble: 0.9, letter: 0.8, scribble: 0.7, 'build-done': 0.9, fanfare: 1 };
const KEY = 'ag-sound-muted';

const store = {
  get() { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } },
  set(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (_) {} }
};

export function createSound({ game = null, stages = null, ui = null, agents = null, root = document.body } = {}) {
  let ctx = null, master = null, musicBus = null, sfxBus = null, manifest = null;
  let muted = store.get(), started = false, current = null;           // current: { name, src, gain }
  const buffers = new Map(), loading = new Map(), last = new Map();
  const stats = { context: false, state: 'none', started: false, decoded: [], played: [], music: null, chirps: 0, muted };
  const babble = createBabble({ volume: VOL.chirps });

  // ---------------------------------------------------------------- audio graph
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (_) { return null; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = VOL.music; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(master);
    stats.context = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  async function getManifest() {
    if (manifest) return manifest;
    try { manifest = await (await fetch(BASE + 'manifest.json')).json(); } catch (_) { manifest = {}; }
    return manifest;
  }
  function load(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (loading.has(name)) return loading.get(name);
    const p = (async () => {
      if (!ensure()) return null;
      const r = await fetch(BASE + name + '.mp3'); if (!r.ok) throw new Error(name + ': ' + r.status);
      const ab = await r.arrayBuffer();
      const buf = await new Promise((res, rej) => { const q = ctx.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); });
      buffers.set(name, buf); stats.decoded.push(name); return buf;
    })().catch(e => { console.warn('[sound]', e.message || e); loading.delete(name); return null; });
    loading.set(name, p); return p;
  }

  // ---------------------------------------------------------------- sfx
  function play(name, { gain = 1, throttle = 120, rate = 1 } = {}) {
    if (!started || !ctx) return;
    const now = performance.now(); if (now - (last.get(name) || 0) < throttle) return; last.set(name, now);
    load(name).then(buf => {
      if (!buf || !ctx) return;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; src.playbackRate.value = rate; g.gain.value = (SFX_GAIN[name] ?? 1) * gain;
      src.connect(g); g.connect(sfxBus); src.start();
      stats.played.push(name); if (stats.played.length > 40) stats.played.shift();
    });
  }

  // ---------------------------------------------------------------- music
  const wantMusic = () => (!stages || stages.scene === 'world') ? 'music-loop' : 'music-space';
  async function setMusic(name, fade = 2.5) {
    if (!started || !ensure()) return;
    if (current && current.name === name) return;
    const want = name; stats.music = name;
    const [buf, man] = await Promise.all([load(name), getManifest()]);
    if (!buf || stats.music !== want) return;
    const t = ctx.currentTime, info = man[name] || {};
    if (current) { const o = current; o.gain.gain.cancelScheduledValues(t); o.gain.gain.setValueAtTime(o.gain.gain.value, t); o.gain.gain.linearRampToValueAtTime(0, t + fade); try { o.src.stop(t + fade + 0.1); } catch (_) {} }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.loop = true;
    if (info.loop) { src.loopStart = info.pad || 0; src.loopEnd = (info.pad || 0) + info.loop; }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade);
    src.connect(g); g.connect(musicBus); src.start(t, info.pad || 0);
    current = { name, src, gain: g };
  }

  // ---------------------------------------------------------------- the first gesture
  function start() {
    if (started) return; if (!ensure()) return;
    started = true; stats.started = true; babble.unlock();
    setMusic(wantMusic(), 3.5);
    setTimeout(() => SFX.forEach(n => load(n)), 1500);       // warm the sfx after the music is in
    scheduleChirp();
  }
  const onGesture = e => { if (e.type === 'keydown' && e.repeat) return; start(); if (started) { removeEventListener('pointerdown', onGesture, true); removeEventListener('keydown', onGesture, true); } };
  addEventListener('pointerdown', onGesture, true); addEventListener('keydown', onGesture, true);

  // ---------------------------------------------------------------- mute
  function setMuted(v) {
    muted = !!v; stats.muted = muted; store.set(muted);
    if (ctx && master) { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.25); }
    if (muted) babble.stop();
    paintBtn();
  }
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'ag-sound';
  const css = document.createElement('style');
  css.textContent = `.ag-sound { position: fixed; right: max(16px, 2.6vmin); bottom: calc(max(16px, 2.6vmin) + 46px + env(safe-area-inset-bottom, 0px)); z-index: 61;
    width: 44px; height: 44px; padding: 0; border: 0; background: none; cursor: pointer; pointer-events: auto; transition: transform .25s cubic-bezier(.3,1.6,.5,1), opacity .3s; opacity: .92;
    filter: drop-shadow(0 2px 3px rgba(42, 39, 64, .25)); }
  .ag-sound:hover { transform: scale(1.08) rotate(-4deg); opacity: 1; } .ag-sound:active { transform: scale(.94); }
  .ag-sound svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .ag-sound:focus-visible { outline: 2px solid ${P.pink}; outline-offset: 3px; border-radius: 50%; }`;
  document.head.append(css);
  function paintBtn() {
    // a pop-comic speaker in the icons.js grammar: ink keyline, lemon body, pink cone, a misregistered colour drum,
    // halftone dots on the shadow side; sound waves when on, a pink cross when muted
    const k = P.ink, off = 1.3;
    const body = 'M9 18 H15 L24 10 V38 L15 30 H9 Z';
    const waves = muted
      ? `<path d="M30 18 L39 30 M39 18 L30 30" stroke="${P.pink}" stroke-width="4.6" stroke-linecap="round" transform="translate(${off} ${off})"/><path d="M30 18 L39 30 M39 18 L30 30" stroke="${k}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
      : `<path d="M29 17 Q34 24 29 31" stroke="${P.pink}" stroke-width="4.4" stroke-linecap="round" fill="none" transform="translate(${off} ${off})"/><path d="M33 12 Q41 24 33 36" stroke="${P.pink}" stroke-width="4.4" stroke-linecap="round" fill="none" transform="translate(${off} ${off})"/>
         <path d="M29 17 Q34 24 29 31 M33 12 Q41 24 33 36" stroke="${k}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
         <path d="M41 7 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2z" fill="${P.yel}" stroke="${k}" stroke-width="1.2" stroke-linejoin="round"/>`;
    btn.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><pattern id="ag-snd-dots" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".75" fill="${P.mag}"/></pattern></defs>
      <circle cx="24" cy="24" r="22" fill="${P.cream}" stroke="${k}" stroke-width="2.6"/>
      <path d="${body}" fill="${muted ? P.pinkL : P.yel}" transform="translate(${off} ${off})"/>
      <path d="M15 30 L24 38 V26 Z" fill="url(#ag-snd-dots)" opacity=".7" transform="translate(${off} ${off})"/>
      <path d="${body}" fill="none" stroke="${k}" stroke-width="2.6" stroke-linejoin="round"/>
      ${waves}</svg>`;
    btn.setAttribute('aria-label', muted ? 'Sound off: turn the sound on' : 'Sound on: mute');
    btn.title = muted ? 'Sound off' : 'Sound on';
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }
  paintBtn();
  btn.addEventListener('click', e => { e.stopPropagation(); start(); setMuted(!muted); if (!muted) play('click', { throttle: 0 }); });
  root.append(btn);

  // ---------------------------------------------------------------- ui clicks
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('button, [role="button"], .ag-chip');
    if (b && b !== btn) play('click', { throttle: 60 });
  }, true);

  // ---------------------------------------------------------------- game events
  if (game && game.on) {
    const on = (ev, fn) => { try { game.on(ev, p => { try { fn(p || {}); } catch (e) { console.warn('[sound]', ev, e); } }); } catch (_) {} };
    on('building:site', () => play('scribble', { throttle: 600 }));
    on('building:done', () => play('build-done', { throttle: 400 }));
    on('letter:new', () => play('letter', { throttle: 700 }));
    on('reward:gain', () => play('chime', { gain: 0.6, throttle: 1500 }));
    on('reward:milestone', () => play('chime', { gain: 1, throttle: 400, rate: 1.12 }));
    on('stage', () => play('fanfare', { throttle: 2000 }));
    on('voyage:start', () => play('rumble', { throttle: 4000 }));
  }
  if (stages && stages.onChange) stages.onChange(() => setMusic(wantMusic()));
  // camera flights: the cloud descent, the lifts, the globe trips (stages.flying / an in-progress hand-off move)
  let wasFlying = false;
  setInterval(() => {
    if (!stages) return;
    let f = false; try { f = !!(stages.flying || stages.handoffMove); } catch (_) {}
    if (f && !wasFlying) play('whoosh', { throttle: 2500 });
    wasFlying = f;
    if (started && current && current.name !== wantMusic()) setMusic(wantMusic());
  }, 250);

  // ---------------------------------------------------------------- ambient chirps
  const SYL = ['pi', 'ri', 'mi', 'tu', 'wee', 'bo', 'lo', 'chi', 'pa', 'ni', 'ko', 'fi', 'yu', 'ta'];
  const callOpen = () => !!document.querySelector('.ag-ui.is-calling, .ag-call.is-on');
  const titleUp = () => !!document.querySelector('.ag-ui.is-title') || document.body.classList.contains('ag-title-on');
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  function folkList() {
    try { const a = game && game.state && game.state.agents; if (a && a.length) return a; } catch (_) {}
    try { const a = agents && (agents.list || agents.all); const l = typeof a === 'function' ? a() : a; if (l && l.length) return l; } catch (_) {}
    return null;
  }
  function phrase(n) { let s = ''; for (let i = 0; i < n; i++) s += SYL[Math.floor(Math.random() * SYL.length)] + (Math.random() < 0.3 ? ' ' : ''); return s.trim() + (Math.random() < 0.3 ? '?' : ''); }
  function speakAs(who) {
    const id = who ? (who.id ?? who.name) : Math.random();
    const syl = 2 + Math.floor(Math.random() * 4);                      // 2-5 syllables (babble: ~1 per 3 letters)
    const text = phrase(syl);
    const plan = babble.speak(text, { seed: hash(id), pitch: 0.9 + (hash(id) % 100) / 250, rate: 1.05 });
    stats.chirps++; return plan.duration || 0.4;
  }
  let chirpTimer = 0;
  function scheduleChirp() { clearTimeout(chirpTimer); chirpTimer = setTimeout(chirp, 3000 + Math.random() * 5000); }
  function chirp() {
    scheduleChirp();
    if (!started || muted || document.hidden || callOpen() || titleUp()) return;
    if (stages && stages.scene !== 'world') return;
    const list = folkList(); const pickOne = () => list ? list[Math.floor(Math.random() * list.length)] : null;
    const a = pickOne(), t = speakAs(a);
    if (Math.random() < 0.35) {                                         // a little back-and-forth
      const b = pickOne(), who = [b, a], turns = 1 + Math.floor(Math.random() * 3); let k = 0;
      const step = () => {
        if (muted || callOpen() || (stages && stages.scene !== 'world')) return;
        const d = speakAs(who[k % 2]); k++;
        if (k < turns) setTimeout(step, (d + 0.25 + Math.random() * 0.5) * 1000);
      };
      setTimeout(step, (t + 0.25 + Math.random() * 0.5) * 1000);
    }
  }

  const api = {
    play, setMusic, start, setMuted, toggle: () => setMuted(!muted), button: btn, babble,
    get muted() { return muted; }, get context() { return ctx; },
    get stats() { return { ...stats, state: ctx ? ctx.state : 'none', music: current ? current.name : null, decoded: stats.decoded.slice(), played: stats.played.slice() }; }
  };
  try { window.__agoraSound = api; } catch (_) {}   // tests / the console
  return api;
}

// Push-to-talk voice input. Hold Space (or press the mic) and speak; release to send.
// Web Speech API (Chrome) by default; any object with the same small recogniser interface can be
// injected (`recognizerFactory`), which is how tests and the Deepgram relay plug in.
//
//   createVoice({ lang, onStart, onPartial, onFinal, onError, onLevel, onState, ... })
//     -> { start(), stop(), toggle(), holdKey(code), supported, setLang(lang), lang, engine,
//          listening, injectPointer(x, y), pointerNow(), feed(ev) /* tests */, destroy() }
//
// Recogniser interface (what Web Speech gives us, what deepgram.js and fake.js imitate):
//   { lang, continuous, interimResults, start(), stop(), abort(),
//     onstart, onresult(ev{ resultIndex, results[i]{ isFinal, 0:{ transcript } } }), onend, onerror(ev{ error, message }) }
import { createAssembler, findDeictic, settleTranscript, TAIL_WAIT_MS, DEICTIC_LAG_MS } from './transcript.js';
import { createPointerTimeline } from './pointer.js';

export const UNSUPPORTED_MESSAGE = 'Voice needs Chrome (Web Speech). Type your command below instead.';
export const INSECURE_MESSAGE = 'Voice needs https or localhost. Open the game at http://localhost:PORT (not the LAN address), or type below.';
export const LANGS = ['en-US', 'tr-TR'];
// Web Speech gives up on venue Wi-Fi with 'network' (and 'audio-capture' when the mic vanishes). Those end the hold
// at once; a recogniser that keeps dying right after start() (Chrome's silence-stop is never that quick) ends it too.
export const HOLD_ENDING_ERRORS = ['network', 'audio-capture', 'not-allowed', 'service-not-allowed', 'language-not-supported', 'bad-grammar'];
export const MAX_RAPID_RESTARTS = 2;
export const RAPID_RESTART_MS = 1500;

const g = typeof window !== 'undefined' ? window : null;

export function langFromQuery(search = g?.location?.search || '', fallback = 'en-US') {
  const m = /[?&]lang=([A-Za-z]{2}(?:[-_][A-Za-z]{2})?)/.exec(search);
  if (!m) return fallback;
  const [a, b] = m[1].replace('_', '-').split('-');
  return b ? `${a.toLowerCase()}-${b.toUpperCase()}` : ({ en: 'en-US', tr: 'tr-TR' }[a.toLowerCase()] || fallback);
}

export function webSpeechFactory(win = g) {
  const Ctor = win?.SpeechRecognition || win?.webkitSpeechRecognition;
  if (!Ctor) return null;
  // Chrome only serves Web Speech on secure origins: http://192.168.x.x fails with 'not-allowed' every time.
  if (win?.isSecureContext === false) return null;
  return () => new Ctor();
}

// Why voice is unavailable, for the UI: 'ok' | 'insecure' | 'no-webspeech'.
export function voiceSupport(win = g) {
  const Ctor = win?.SpeechRecognition || win?.webkitSpeechRecognition;
  if (!Ctor) return { ok: false, reason: 'no-webspeech', message: UNSUPPORTED_MESSAGE };
  if (win?.isSecureContext === false) return { ok: false, reason: 'insecure', message: INSECURE_MESSAGE };
  return { ok: true, reason: 'ok', message: '' };
}

function isTyping(doc) {
  const el = doc?.activeElement;
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
}

export function createVoice(opts = {}) {
  const {
    lang: lang0 = langFromQuery(),
    onStart = () => {}, onPartial = () => {}, onFinal = () => {}, onError = () => {}, onLevel = null, onState = () => {},
    recognizerFactory = webSpeechFactory(),
    engine: engineName = recognizerFactory ? 'webspeech' : 'none',
    win = g, doc = g?.document || null,
    holdKey: holdKey0 = 'Space',
    tailWaitMs = TAIL_WAIT_MS, deicticLagMs = DEICTIC_LAG_MS,
    now = () => Date.now(),
    setTimeout: setT = (f, ms) => globalThis.setTimeout(f, ms), clearTimeout: clearT = (h) => globalThis.clearTimeout(h),
    level = true,   // AnalyserNode waveform; fails soft
  } = opts;

  const pointer = createPointerTimeline({ now });
  const asm = createAssembler();
  const state = { lang: lang0, listening: false, held: false, settling: false, deictic: null, startedAt: 0, pointerAtStart: null, keyCode: holdKey0 };
  let rec = null, tailTimer = null, restartTimer = null, keyDownSeen = false;
  let lastStartAt = 0, rapidRestarts = 0;
  const supported = Boolean(recognizerFactory);
  const unsupportedMessage = supported ? '' : (win?.isSecureContext === false && (win?.SpeechRecognition || win?.webkitSpeechRecognition)) ? INSECURE_MESSAGE : UNSUPPORTED_MESSAGE;

  const setState = (s) => onState(s, state);

  // ---------- recogniser ----------
  function makeRec() {
    const r = recognizerFactory();
    r.lang = state.lang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = () => {};
    r.onresult = (ev) => handleResult(ev);
    r.onerror = (ev) => {
      if (rec !== r) return;
      const code = ev?.error || 'unknown';
      if (code === 'no-speech' || code === 'aborted') return;   // routine in push-to-talk
      if (HOLD_ENDING_ERRORS.includes(code)) { endHold(code, ev?.message); return; }
      onError({ code, message: ev?.message || describe(code), fatal: false });
    };
    r.onend = () => {
      if (rec !== r) return;
      if (state.held && !state.settling) {
        // Chrome stops continuous recognition on silence; while the key is held we keep going.
        // A recogniser that dies right after starting is not silence: after MAX_RAPID_RESTARTS the hold ends.
        if (now() - lastStartAt < RAPID_RESTART_MS) rapidRestarts++; else rapidRestarts = 0;
        if (rapidRestarts > MAX_RAPID_RESTARTS) { endHold('restart-loop'); return; }
        asm.rollover();
        restartTimer = setT(() => { if (state.held && rec === r) { lastStartAt = now(); try { r.start(); } catch { /* already started */ } } }, 120);
      } else if (state.settling) {
        deliver(false);
      }
    };
    return r;
  }

  // The hold cannot continue (network, mic gone, blocked). Whatever was heard so far is delivered; otherwise one error.
  function endHold(code, message) {
    const fatal = code === 'not-allowed' || code === 'service-not-allowed' || code === 'language-not-supported';
    const heard = asm.text();
    state.held = false; clearT(restartTimer);
    if (state.settling) { deliver(false); onError({ code, message: message || describe(code), fatal }); return; }
    if (heard) {
      // Settle with what we have, then report why the hold ended (the UI can show a quiet toast).
      state.settling = true; state.endedAt = now(); state.pointerAtEnd = pointer.current();
      setState('settling');
      deliver(true);
      onError({ code, message: message || describe(code), fatal, delivered: true });
      return;
    }
    finish(true);
    onError({ code, message: message || describe(code), fatal });
  }

  function describe(code) {
    return ({ 'not-allowed': 'Microphone blocked. Allow the mic for this site, or type below.', 'service-not-allowed': 'Speech service blocked here. Type below instead.', 'audio-capture': 'No microphone found. Type below instead.', 'network': 'Speech service unreachable (no internet?). Type your command below.', 'restart-loop': 'Speech keeps dropping. Type your command below.', 'language-not-supported': `${state.lang} is not supported here.` })[code] || `Speech error: ${code}`;
  }

  function handleResult(ev) {
    const text = asm.ingest(ev.resultIndex || 0, ev.results);
    if (!state.deictic) {
      const d = findDeictic(text, state.lang);
      if (d) {
        const t = now() - deicticLagMs;
        state.deictic = { word: d.word, at: t, pointer: pointer.at(t) || pointer.current() };
      }
    }
    onPartial(text, { interim: asm.interim(), deictic: state.deictic?.word || null });
    if (state.settling && !asm.hasPendingInterim()) deliver(false);
  }

  // ---------- push-to-talk ----------
  function start() {
    // Pressed again inside the settle window: the previous utterance goes out now (with its latest interim) and we start fresh.
    if (state.settling) deliver(true);
    if (state.listening) return false;
    if (!supported) { onError({ code: 'unsupported', message: unsupportedMessage, fatal: true }); return false; }
    clearT(tailTimer); clearT(restartTimer);
    asm.reset();
    state.listening = true; state.held = true; state.settling = false; state.deictic = null;
    state.startedAt = now(); state.pointerAtStart = pointer.current(); state.endedAt = 0; state.pointerAtEnd = null;
    lastStartAt = now(); rapidRestarts = 0;
    try { rec = makeRec(); rec.start(); }
    catch (e) { state.listening = state.held = false; onError({ code: 'start-failed', message: e?.message || String(e) }); return false; }
    levelMeter.start();
    onStart({ startedAt: state.startedAt, lang: state.lang });
    setState('listening');
    return true;
  }

  function stop() {
    if (!state.listening || state.settling) return false;
    state.held = false; state.settling = true; state.endedAt = now(); state.pointerAtEnd = pointer.current();
    clearT(restartTimer);
    setState('settling');
    try { rec?.stop(); } catch { /* ignore */ }
    const t = settleTranscript(asm);
    if (t !== null) { deliver(false); return true; }
    tailTimer = setT(() => deliver(true), tailWaitMs);
    return true;
  }

  function deliver(waitedOut) {
    if (!state.settling) return;
    clearT(tailTimer);
    const text = settleTranscript(asm, { waitedOut: true });
    const r = rec; rec = null;
    try { r?.abort?.(); } catch { /* ignore */ }
    state.settling = false; state.listening = false;
    levelMeter.stop();
    const meta = {
      startedAt: state.startedAt, endedAt: state.endedAt || now(), lang: state.lang, engine: engineName, waitedOut,
      pointerAtStart: state.pointerAtStart, pointerAtEnd: state.pointerAtEnd || pointer.current(),
      pointerAtThere: state.deictic?.pointer || null, deictic: state.deictic?.word || null,
    };
    setState('idle');
    if (text) onFinal(text, meta);
    else onError({ code: 'empty', message: "I didn't catch that. Hold Space and speak, or type below.", meta });
  }

  function finish(abort) { clearT(tailTimer); clearT(restartTimer); if (abort) { try { rec?.abort?.(); } catch { /* ignore */ } rec = null; state.settling = false; state.listening = false; levelMeter.stop(); setState('idle'); } }
  function toggle() { return state.listening ? stop() : start(); }

  // ---------- keys + pointer ----------
  function onKeyDown(e) {
    if (e.code !== state.keyCode || e.repeat || keyDownSeen) return;
    if (isTyping(doc) || e.metaKey || e.ctrlKey || e.altKey) return;
    keyDownSeen = true; e.preventDefault(); start();
  }
  function onKeyUp(e) { if (e.code !== state.keyCode) return; if (keyDownSeen) { keyDownSeen = false; e.preventDefault(); stop(); } }
  function onPointer(e) { pointer.push(e.clientX, e.clientY, now()); }
  function onBlur() { if (keyDownSeen) { keyDownSeen = false; stop(); } }
  win?.addEventListener?.('keydown', onKeyDown);
  win?.addEventListener?.('keyup', onKeyUp);
  win?.addEventListener?.('pointermove', onPointer, { passive: true });
  win?.addEventListener?.('pointerdown', onPointer, { passive: true });
  win?.addEventListener?.('blur', onBlur);

  // ---------- level meter (optional, fails soft) ----------
  const levelMeter = createLevelMeter({ onLevel: level && onLevel ? onLevel : null, win });

  const api = {
    start, stop, toggle,
    holdKey(code) { state.keyCode = code; return api; },
    supported, engine: engineName,
    get lang() { return state.lang; },
    get listening() { return state.listening; },
    get state() { return state.settling ? 'settling' : state.listening ? 'listening' : 'idle'; },
    setLang(l) { state.lang = l; if (rec) rec.lang = l; return api; },
    // Scripted pointer (director mode) or any non-mouse cursor source.
    injectPointer(x, y, t = now()) { pointer.push(x, y, t); return api; },
    pointerNow() { return pointer.current(); },
    pointerAt(t) { return pointer.at(t); },
    // Tests / fakes: feed a Web-Speech-shaped result event straight in.
    feed(ev) { handleResult(ev); },
    text() { return asm.text(); },
    unsupportedMessage,
    destroy() {
      finish(true);
      win?.removeEventListener?.('keydown', onKeyDown); win?.removeEventListener?.('keyup', onKeyUp);
      win?.removeEventListener?.('pointermove', onPointer); win?.removeEventListener?.('pointerdown', onPointer); win?.removeEventListener?.('blur', onBlur);
      levelMeter.destroy();
    },
  };
  return api;
}

// getUserMedia -> AnalyserNode -> onLevel(0..1) per animation frame. Any failure is silent.
export function createLevelMeter({ onLevel, win = g }) {
  let ctx = null, analyser = null, stream = null, raf = 0, buf = null, running = false, failed = false;
  const AC = win?.AudioContext || win?.webkitAudioContext;
  async function ensure() {
    if (ctx || failed) return;
    try {
      stream = await win.navigator.mediaDevices.getUserMedia({ audio: true });
      ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      buf = new Uint8Array(analyser.fftSize);
    } catch { failed = true; }
  }
  function tick() {
    if (!running) return;
    if (analyser) {
      analyser.getByteTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      onLevel(Math.min(1, rms * 4));
    }
    raf = win.requestAnimationFrame(tick);
  }
  return {
    async start() {
      if (!onLevel || !AC || !win?.navigator?.mediaDevices?.getUserMedia || !win.requestAnimationFrame) return;
      running = true;
      await ensure();
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
      if (running && !raf) tick();
    },
    stop() { running = false; if (raf) { win?.cancelAnimationFrame?.(raf); raf = 0; } onLevel?.(0); if (ctx?.state === 'running') ctx.suspend().catch(() => {}); },
    destroy() { this.stop(); stream?.getTracks?.().forEach(t => t.stop()); ctx?.close?.().catch?.(() => {}); ctx = analyser = stream = null; },
  };
}

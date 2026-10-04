import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoice, langFromQuery, UNSUPPORTED_MESSAGE } from '../../web/js/voice/voice.js';
import { createFakeRecognizer } from '../../web/js/voice/fake.js';
import { createDeepgramAdapter, pickEngine, relayUrl } from '../../web/js/voice/deepgram.js';

// A tiny window/document double with an event target and a focusable element.
function fakeWindow() {
  const listeners = {};
  const win = {
    addEventListener: (n, f) => (listeners[n] ||= []).push(f),
    removeEventListener: (n, f) => { listeners[n] = (listeners[n] || []).filter(x => x !== f); },
    fire: (n, ev = {}) => (listeners[n] || []).forEach(f => f({ preventDefault() { ev.prevented = true; }, ...ev })),
    document: { activeElement: null },
    listeners,
  };
  return win;
}

// Manual clock so the 600 ms tail wait is deterministic.
function fakeClock() {
  let t = 10000; const timers = [];
  return {
    now: () => t,
    setTimeout: (f, ms) => { const h = { f, at: t + ms }; timers.push(h); return h; },
    clearTimeout: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
    advance(ms) { const end = t + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const h = timers[0]; if (!h || h.at > end) break; t = h.at; timers.shift(); h.f(); } t = end; },
  };
}

function setup(extra = {}, recOpts = {}) {
  const win = fakeWindow(), clock = fakeClock();
  let rec = null;
  const calls = { partial: [], final: [], error: [], start: 0, states: [] };
  const voice = createVoice({
    lang: 'en-US', win, doc: win.document, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, level: false,
    recognizerFactory: () => (rec = createFakeRecognizer({ setTimeout: clock.setTimeout, ...recOpts })),
    onStart: () => calls.start++, onPartial: (t, m) => calls.partial.push([t, m.deictic]), onFinal: (t, m) => calls.final.push([t, m]),
    onError: (e) => calls.error.push(e), onState: (s) => calls.states.push(s), ...extra,
  });
  return { win, clock, voice, calls, rec: () => rec };
}

test('hold Space: start on keydown, final delivered on keyup with pointer meta', () => {
  const { win, clock, voice, calls, rec } = setup();
  win.fire('pointermove', { clientX: 100, clientY: 200 });
  win.fire('keydown', { code: 'Space' });
  assert.equal(calls.start, 1); assert.equal(voice.listening, true);
  assert.equal(rec().continuous, true); assert.equal(rec().interimResults, true); assert.equal(rec().lang, 'en-US');
  rec().say("let's build", false);
  rec().say("let's build a house in the middle", true);
  assert.deepEqual(calls.partial.map(p => p[0]), ["let's build", "let's build a house in the middle"]);
  win.fire('pointermove', { clientX: 300, clientY: 400 });
  win.fire('keyup', { code: 'Space' });
  assert.equal(calls.final.length, 1, 'no interim pending: delivered at once');
  const [text, meta] = calls.final[0];
  assert.equal(text, "let's build a house in the middle");
  assert.deepEqual(meta.pointerAtStart, { x: 100, y: 200 });
  assert.deepEqual(meta.pointerAtEnd, { x: 300, y: 400 });
  assert.equal(meta.pointerAtThere, null);
  assert.equal(meta.startedAt, 10000); assert.equal(meta.endedAt, 10000);
  assert.equal(voice.listening, false);
  assert.deepEqual(calls.states, ['listening', 'settling', 'idle']);
  clock.advance(1000);
  assert.equal(calls.final.length, 1, 'delivered exactly once');
});

test('released mid-sentence: waits up to 600 ms for the final, then takes it', () => {
  const { win, clock, voice, calls, rec } = setup({}, { endOnStop: false });
  voice.start();
  rec().say('a windmill', true);
  rec().say('over', false);
  voice.stop();
  assert.equal(calls.final.length, 0, 'interim pending: waiting');
  clock.advance(200);
  rec().say('over there', true);     // the late final lands within the window
  assert.equal(calls.final.length, 1);
  assert.equal(calls.final[0][0], 'a windmill over there');
  assert.equal(calls.final[0][1].waitedOut, false);
  clock.advance(1000);
  assert.equal(calls.final.length, 1);
  win.fire('keyup', { code: 'Space' });   // stray keyup: nothing
  assert.equal(calls.final.length, 1);
});

test('released mid-sentence with no final in 600 ms: the latest interim is used', () => {
  const { clock, voice, calls, rec } = setup({}, { endOnStop: false });
  voice.start();
  rec().say('a windmill', true);
  rec().say('over the', false);
  voice.stop();
  clock.advance(599);
  assert.equal(calls.final.length, 0);
  clock.advance(1);
  assert.equal(calls.final.length, 1);
  assert.equal(calls.final[0][0], 'a windmill over the');
  assert.equal(calls.final[0][1].waitedOut, true);
});

test('recogniser onend after stop() delivers what is there without waiting the full tail', () => {
  const { clock, voice, calls, rec } = setup();
  voice.start();
  rec().say('a well', false);
  voice.stop();            // fake rec schedules onend at +0
  clock.advance(0);
  assert.equal(calls.final.length, 1);
  assert.equal(calls.final[0][0], 'a well');
});

test('deictic word captures the cursor from the timeline (350 ms before the interim arrived)', () => {
  const { win, clock, voice, calls, rec } = setup();
  voice.start();
  win.fire('pointermove', { clientX: 10, clientY: 10 });
  clock.advance(500);
  win.fire('pointermove', { clientX: 50, clientY: 60 });      // t = 10500
  clock.advance(300);
  win.fire('pointermove', { clientX: 90, clientY: 90 });      // t = 10800: moved on
  clock.advance(100);                                          // t = 10900, lag lookup = 10550 -> (50,60)
  rec().say('and a windmill there', false);
  assert.equal(calls.partial.at(-1)[1], 'there');
  win.fire('pointermove', { clientX: 999, clientY: 999 });
  rec().say('and a windmill there please', true);
  voice.stop();
  const meta = calls.final[0][1];
  assert.deepEqual(meta.pointerAtThere, { x: 50, y: 60 });
  assert.equal(meta.deictic, 'there');
  assert.deepEqual(meta.pointerAtEnd, { x: 999, y: 999 });
});

test('Space is ignored while typing, with modifiers, and on key repeat; blur releases', () => {
  const { win, voice, calls, rec } = setup();
  win.document.activeElement = { tagName: 'INPUT' };
  win.fire('keydown', { code: 'Space' });
  assert.equal(calls.start, 0);
  win.document.activeElement = { tagName: 'DIV', isContentEditable: true };
  win.fire('keydown', { code: 'Space' });
  assert.equal(calls.start, 0);
  win.document.activeElement = null;
  win.fire('keydown', { code: 'Space', metaKey: true });
  assert.equal(calls.start, 0);
  win.fire('keydown', { code: 'KeyA' });
  assert.equal(calls.start, 0);
  const ev = { code: 'Space' };
  win.fire('keydown', ev);
  assert.equal(calls.start, 1); assert.equal(ev.prevented, true);
  win.fire('keydown', { code: 'Space', repeat: true });
  assert.equal(calls.start, 1);
  rec().say('hello', true);
  win.fire('blur');
  assert.equal(calls.final.length, 1);
  assert.equal(voice.listening, false);
});

test('empty release -> onError empty, not onFinal; toggle works; holdKey rebinds', () => {
  const { win, voice, calls } = setup();
  voice.holdKey('KeyV');
  win.fire('keydown', { code: 'Space' });
  assert.equal(calls.start, 0);
  win.fire('keydown', { code: 'KeyV' });
  assert.equal(calls.start, 1);
  win.fire('keyup', { code: 'KeyV' });
  assert.equal(calls.final.length, 0);
  assert.equal(calls.error[0].code, 'empty');
  voice.toggle(); assert.equal(voice.listening, true);
  voice.toggle(); assert.equal(voice.listening, false);
});

test('continuous recognition ending on silence while held restarts and keeps text', () => {
  const { clock, voice, calls, rec } = setup();
  voice.start();
  const r1 = rec();
  r1.say('a tall', false);
  r1.end();                 // Chrome gave up on silence
  clock.advance(200);
  assert.equal(rec().starts, 2, 'restarted the same recogniser');
  rec().say('lighthouse', true);
  voice.stop();
  assert.equal(calls.final[0][0], 'a tall lighthouse');
});

test('errors: not-allowed is fatal and ends listening; no-speech is swallowed; unsupported engine', () => {
  const { voice, calls, rec } = setup();
  voice.start();
  rec().error('no-speech');
  assert.equal(calls.error.length, 0);
  rec().error('not-allowed');
  assert.equal(calls.error[0].code, 'not-allowed'); assert.equal(calls.error[0].fatal, true);
  assert.equal(voice.listening, false);

  const none = createVoice({ recognizerFactory: null, win: fakeWindow(), level: false, onError: (e) => calls.error.push(e) });
  assert.equal(none.supported, false); assert.equal(none.engine, 'none');
  assert.equal(none.start(), false);
  assert.equal(calls.error.at(-1).code, 'unsupported');
  assert.equal(calls.error.at(-1).message, UNSUPPORTED_MESSAGE);
});

test('setLang, injectPointer, langFromQuery', () => {
  const { voice, calls, rec } = setup();
  voice.setLang('tr-TR'); voice.start();
  assert.equal(rec().lang, 'tr-TR');
  voice.injectPointer(5, 6);
  rec().say('şuraya bir ev', true);
  voice.stop();
  assert.deepEqual(calls.final[0][1].pointerAtThere, { x: 5, y: 6 });
  assert.equal(calls.final[0][1].lang, 'tr-TR');
  assert.equal(langFromQuery('?lang=tr-TR'), 'tr-TR');
  assert.equal(langFromQuery('?x=1&lang=tr'), 'tr-TR');
  assert.equal(langFromQuery('?lang=en_us'), 'en-US');
  assert.equal(langFromQuery(''), 'en-US');
  voice.destroy();
});

test('deepgram adapter maps Results to Web Speech events; pickEngine; relayUrl', () => {
  const evs = [];
  const ad = createDeepgramAdapter(e => evs.push(e));
  ad.message({ type: 'Metadata' });
  ad.message({ type: 'Results', is_final: false, channel: { alternatives: [{ transcript: 'a light' }] } });
  ad.message({ type: 'Results', is_final: false, channel: { alternatives: [{ transcript: 'a lighthouse' }] } });
  ad.message({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: 'a lighthouse on the cliff' }] } });
  ad.message({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: '' }] } });
  ad.message({ type: 'Results', is_final: false, channel: { alternatives: [{ transcript: 'please' }] } });
  assert.deepEqual(evs.map(e => [e.resultIndex, e.results.length, e.results[e.resultIndex].isFinal, e.results[e.resultIndex][0].transcript]), [
    [0, 1, false, 'a light'], [0, 1, false, 'a lighthouse'], [0, 1, true, 'a lighthouse on the cliff'], [1, 2, false, 'please'],
  ]);
  assert.equal(pickEngine({ stt: 'deepgram' }), 'deepgram');
  assert.equal(pickEngine({ stt: 'webspeech' }), 'webspeech');
  assert.equal(pickEngine({ stt: 'webspeech' }, { webSpeechAvailable: false }), 'none');
  assert.equal(relayUrl({ base: 'https://agora.test', lang: 'tr-TR' }), 'wss://agora.test/api/stt?language=tr-TR&interim_results=true&smart_format=true');
});

// ---------- reviewer findings (2026-10-03) ----------

test('network error while held ends the hold at once: one error, no restart loop; heard text is still delivered', () => {
  const { clock, voice, calls, rec } = setup();
  voice.start();
  const r = rec();
  r.error('network'); r.end();                     // Chrome: onerror then onend
  clock.advance(3000);
  assert.equal(r.starts, 1, 'no restart after a network error');
  assert.equal(calls.error.length, 1); assert.equal(calls.error[0].code, 'network'); assert.equal(calls.error[0].fatal, false);
  assert.equal(voice.listening, false); assert.equal(voice.state, 'idle');
  assert.equal(calls.final.length, 0);

  // Something was heard before the service dropped: deliver it, and say why the hold ended.
  const s2 = setup();
  s2.voice.start();
  s2.rec().say('a lighthouse on the cliff', false);
  s2.rec().error('network'); s2.rec().end();
  s2.clock.advance(3000);
  assert.equal(s2.calls.final.length, 1); assert.equal(s2.calls.final[0][0], 'a lighthouse on the cliff');
  assert.equal(s2.calls.error.length, 1); assert.equal(s2.calls.error[0].code, 'network'); assert.equal(s2.calls.error[0].delivered, true);
  assert.equal(s2.rec().starts, 1);
  assert.equal(s2.voice.listening, false);

  // audio-capture (mic unplugged) behaves the same; a later Space hold works again.
  const s3 = setup();
  s3.voice.start(); s3.rec().error('audio-capture'); s3.rec().end(); s3.clock.advance(500);
  assert.equal(s3.calls.error[0].code, 'audio-capture'); assert.equal(s3.voice.listening, false);
  assert.equal(s3.voice.start(), true); s3.rec().say('again', true); s3.voice.stop();
  assert.equal(s3.calls.final[0][0], 'again');
});

test('a recogniser that keeps dying right after start() is capped: restart-loop ends the hold', () => {
  const { clock, voice, calls, rec } = setup();
  voice.start();
  const r = rec();
  for (let i = 0; i < 10; i++) { r.end(); clock.advance(200); }   // dies 200 ms after every start
  assert.ok(r.starts <= 1 + 2 + 1, `restarts are bounded (got ${r.starts})`);
  assert.equal(calls.error.at(-1)?.code, 'restart-loop');
  assert.equal(voice.listening, false);
  // Genuine silence stops (seconds apart) still restart indefinitely.
  const s2 = setup(); s2.voice.start(); const r2 = s2.rec();
  for (let i = 0; i < 6; i++) { s2.clock.advance(4000); r2.end(); s2.clock.advance(200); }
  assert.equal(r2.starts, 7); assert.equal(s2.calls.error.length, 0); assert.equal(s2.voice.listening, true);
});

test('Space pressed again inside the settle window delivers the first utterance, then starts the second', () => {
  const { win, clock, voice, calls, rec } = setup({}, { endOnStop: false });
  win.fire('keydown', { code: 'Space' });
  rec().say('a house in the', false);              // interim only, so release waits up to 600 ms
  win.fire('keyup', { code: 'Space' });
  assert.equal(voice.state, 'settling'); assert.equal(calls.final.length, 0);
  clock.advance(100);
  win.fire('keydown', { code: 'Space' });          // impatient second press
  assert.equal(calls.final.length, 1, 'first utterance delivered at once');
  assert.equal(calls.final[0][0], 'a house in the'); assert.equal(calls.final[0][1].waitedOut, true);
  assert.equal(voice.state, 'listening'); assert.equal(calls.start, 2);
  rec().say('and a windmill there', true);
  win.fire('keyup', { code: 'Space' });
  assert.equal(calls.final.length, 2); assert.equal(calls.final[1][0], 'and a windmill there');
  assert.equal(calls.error.length, 0, 'nothing dropped, nothing errored');
  clock.advance(2000);
  assert.equal(calls.final.length, 2);
});

test('insecure origin (LAN IP over http): unsupported with a message that says so', async () => {
  const { webSpeechFactory, voiceSupport, INSECURE_MESSAGE } = await import('../../web/js/voice/voice.js');
  const lan = { SpeechRecognition: function () {}, isSecureContext: false };
  assert.equal(webSpeechFactory(lan), null);
  assert.deepEqual(voiceSupport(lan), { ok: false, reason: 'insecure', message: INSECURE_MESSAGE });
  assert.equal(voiceSupport({ isSecureContext: true }).reason, 'no-webspeech');
  assert.equal(voiceSupport({ SpeechRecognition: function () {}, isSecureContext: true }).ok, true);
  const errs = [];
  const v = createVoice({ win: { ...fakeWindow(), ...lan }, level: false, recognizerFactory: webSpeechFactory(lan), onError: e => errs.push(e) });
  assert.equal(v.supported, false); v.start();
  assert.equal(errs[0].message, INSECURE_MESSAGE); assert.equal(v.unsupportedMessage, INSECURE_MESSAGE);
});

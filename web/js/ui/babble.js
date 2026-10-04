// Babble (ART_DIRECTION §24, the Ministry call): the minister never speaks human words aloud. It chirps a high, cute
// gibberish, Animal-Crossing style, synthesized live with WebAudio and timed to the text, while the English
// "translation" runs as subtitles. One syllable per ~2.6 letters: a short triangle "blip" gliding a little in pitch,
// through a vowel-ish band-pass formant, with a soft attack and a quick decay; commas and full stops are pauses; a
// question lifts the last syllables. The voice is seeded per speaker so each minister sounds like itself.
//
//   const bb = createBabble({ volume: .16 })
//   const plan = bb.speak(text, { seed, pitch })  -> { duration (s), marks: [{ at (s), char }] }  (the subtitles follow `marks`)
//   bb.stop() · bb.stats -> { context, state, nodes, syllables, utterances } (tests) · bb.unlock() (on a click)

const PUNCT_PAUSE = { ',': .16, ';': .2, ':': .18, '.': .3, '!': .3, '?': .32, '…': .34, '—': .2 };

export function createBabble({ volume = .16 } = {}) {
  let ctx = null, master = null, live = [];
  const stats = { context: false, state: 'none', nodes: 0, syllables: 0, utterances: 0 };
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (_) { return null; }
    master = ctx.createGain(); master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    stats.context = true; stats.nodes += 3;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const rnd = seed => { let s = (seed >>> 0) || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const hashStr = t => { let h = 2166136261; for (const c of String(t)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  function syllable(t, f0, f1, dur, formant, r) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter(), mix = ctx.createGain();
    o.type = 'triangle'; o2.type = 'square';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o2.frequency.setValueAtTime(f0 * 2.002, t); o2.frequency.exponentialRampToValueAtTime(f1 * 2.002, t + dur);
    mix.gain.value = .18;                       // a touch of square on the octave: the "chirp" brightness
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(formant, t); bp.frequency.linearRampToValueAtTime(formant * (0.8 + r() * 0.5), t + dur); bp.Q.value = 2.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); o2.connect(mix); mix.connect(bp); bp.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    stats.nodes += 5; stats.syllables++;
    const rec = { o, o2 }; live.push(rec);
    o.onended = () => { live = live.filter(x => x !== rec); };
  }

  // the plan (timings) is computed even without audio, so the subtitles still run in step
  function speak(text, { seed = null, pitch = 1, rate = 1 } = {}) {
    const s = String(text || '').trim(); if (!s) return { duration: 0, marks: [] };
    const r = rnd(seed != null ? seed : hashStr(s));
    const base = 520 * pitch * (0.92 + r() * 0.16);       // a high, small voice
    const c = ensure(), t0 = c ? c.currentTime + 0.05 : 0;
    let t = 0; const marks = []; let letters = 0;
    const isQ = /\?\s*$/.test(s);
    const chars = [...s];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      marks.push({ at: t, char: ch });
      if (PUNCT_PAUSE[ch] != null) { t += PUNCT_PAUSE[ch] / rate; letters = 0; continue; }
      if (/\s/.test(ch)) { t += 0.025 / rate; continue; }
      if (!/[\p{L}\p{N}]/u.test(ch)) continue;
      letters++;
      if (letters % 3 === 1) {                             // ~ one syllable every three letters
        const dur = (0.07 + r() * 0.05) / rate;
        const tail = isQ && i > chars.length - 8 ? 1.25 : 1;
        const f0 = base * (0.85 + r() * 0.5) * tail, f1 = f0 * (0.85 + r() * 0.4);
        if (c) syllable(t0 + t, f0, f1, dur, 1100 + r() * 1600, r);
        t += dur * 0.78 + 0.03 / rate;
      }
    }
    stats.utterances++; stats.state = c ? c.state : 'none';
    return { duration: t + 0.1, marks };
  }
  function stop() { for (const x of live) { try { x.o.stop(); x.o2.stop(); } catch (_) {} } live = []; }
  return { speak, stop, unlock: () => ensure(), get stats() { return { ...stats, state: ctx ? ctx.state : 'none' }; }, get context() { return ctx; } };
}

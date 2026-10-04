// A fake recogniser with the Web Speech surface, for tests and the voice lab.
// Drive it by hand: rec.say('let's build', false); rec.say("let's build a house", true); rec.end()
// or script it: createFakeRecognizer({ script: [{ at: 300, text: 'a house', final: false }, ...] })
// endOnStop: Chrome fires onend shortly after stop(); set false to control that by hand (rec.end()).
export function createFakeRecognizer({ script = [], endOnStop = true, setTimeout: setT = (f, ms) => globalThis.setTimeout(f, ms) } = {}) {
  const rec = {
    lang: 'en-US', continuous: false, interimResults: false, maxAlternatives: 1,
    started: false, starts: 0, stops: 0, aborts: 0, results: [],
    onstart: null, onresult: null, onend: null, onerror: null,
    start() { rec.started = true; rec.starts++; rec.results = []; rec.onstart?.({}); for (const s of script) setT(() => rec.started && rec.say(s.text, s.final, s.index), s.at); },
    stop() { rec.stops++; if (rec.started) { rec.started = false; if (endOnStop) setT(() => rec.onend?.({}), 0); } },
    abort() { rec.aborts++; const was = rec.started; rec.started = false; if (was) setT(() => rec.onend?.({}), 0); },
    // Emit a result. By default an interim rewrites the last non-final slot; a final settles it.
    say(text, final = false, index = null) {
      let i = index;
      if (i === null) { i = rec.results.length; if (i > 0 && !rec.results[i - 1].isFinal) i -= 1; }
      rec.results[i] = { isFinal: final, 0: { transcript: text }, length: 1 };
      rec.onresult?.({ resultIndex: i, results: rec.results.slice() });
    },
    error(error, message = '') { rec.onerror?.({ error, message }); },
    end() { rec.started = false; rec.onend?.({}); },
  };
  return rec;
}

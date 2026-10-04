// Cursor timeline: remembers where the pointer was over the last few seconds so a word
// spoken a moment ago ("there") can be matched to where the cursor was when it was said.
export function createPointerTimeline({ keepMs = 6000, now = () => Date.now() } = {}) {
  const samples = [];   // { x, y, t } ascending by t
  let last = null;
  const prune = (t) => { while (samples.length > 1 && samples[0].t < t - keepMs) samples.shift(); };
  return {
    push(x, y, t = now()) { last = { x, y, t }; samples.push(last); prune(t); return last; },
    // Latest sample at or before t (the earliest one if t predates everything). null if never moved.
    at(t) {
      if (!samples.length) return null;
      let lo = 0, hi = samples.length - 1;
      if (t >= samples[hi].t) return { x: samples[hi].x, y: samples[hi].y };
      if (t <= samples[lo].t) return { x: samples[lo].x, y: samples[lo].y };
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].t <= t) lo = mid; else hi = mid; }
      return { x: samples[lo].x, y: samples[lo].y };
    },
    current() { return last ? { x: last.x, y: last.y } : null; },
    get size() { return samples.length; },
    clear() { samples.length = 0; last = null; },
  };
}

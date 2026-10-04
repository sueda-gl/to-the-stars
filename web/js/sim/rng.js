// Seeded PRNG (mulberry32) + helpers. Every bit of sim randomness flows through one of these.

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

export function createRng(seed = 7) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;
  const seqs = {};
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),       // inclusive
    chance: p => next() < p,
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle: arr => { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; },
    // a deterministic -1..1 value for a key, independent of the stream (used by willingness jitter)
    jitter: key => (hashString(key) % 2000) / 1000 - 1,
    // per-game id counters ('f1', 'f2', ...): two games in one page never share ids
    seq: prefix => prefix + (seqs[prefix] = (seqs[prefix] || 0) + 1),
    get seed() { return a; }
  };
  return rng;
}

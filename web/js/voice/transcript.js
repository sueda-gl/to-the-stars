// Pure transcript logic (no DOM, no Web Speech): deictic-word detection and the
// final-transcript assembler. Runs in the browser and under node --test.

// Deictic words per language family. Matched as whole words (or phrases), case-insensitive.
// Turkish locative/dative forms: burada/şurada/orada (at here/there), buraya/şuraya/oraya (to here/there).
export const DEICTIC = {
  en: ['right there', 'over there', 'over here', 'this spot', 'that spot', 'right here', 'there', 'here'],
  tr: ['şurada', 'burada', 'orada', 'şuraya', 'buraya', 'oraya', 'şurası', 'burası', 'orası', 'şuraya', 'tam burada', 'tam şurada'],
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cache = new Map();

// Unicode-aware "word boundary": the char before/after must not be a letter.
function patternFor(langKey) {
  if (cache.has(langKey)) return cache.get(langKey);
  const words = [...(DEICTIC[langKey] || []), ...(langKey !== 'en' ? DEICTIC.en : [])]
    .sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${words.join('|')})(?![\\p{L}\\p{N}])`, 'iu');
  cache.set(langKey, re);
  return re;
}

export function langKey(lang = 'en-US') { return String(lang).toLowerCase().split(/[-_]/)[0] || 'en'; }

// Returns { word, index } for the first deictic word in text, or null.
export function findDeictic(text, lang = 'en-US') {
  if (!text) return null;
  const m = patternFor(langKey(lang)).exec(String(text).toLocaleLowerCase(lang));
  return m ? { word: m[1], index: m.index } : null;
}

export function tidy(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

// Joins final segments and the trailing interim into one sentence.
export function mergeTranscript(finals, interim = '') {
  return tidy([...(finals || []), interim].filter(Boolean).join(' '));
}

// Assembles a Web Speech result list into text. Chrome's `event.results` is a growing list;
// results[i] may be rewritten (interim -> interim -> final), so slots are keyed by index.
// When the recogniser restarts (continuous mode ends on silence) the indices reset: call
// rollover() first so finished text is kept in `committed`.
export function createAssembler() {
  const a = {
    committed: [],   // strings from earlier recogniser sessions (finals and settled interims)
    slots: [],       // current session, by result index: { text, final }
    ingest(resultIndex, results) {
      const n = results.length;
      for (let i = resultIndex || 0; i < n; i++) {
        const r = results[i];
        if (!r) continue;
        const alt = r[0] || r.alternatives?.[0] || r;
        a.slots[i] = { text: tidy(alt.transcript ?? alt.text ?? ''), final: Boolean(r.isFinal ?? r.final) };
      }
      return a.text();
    },
    finalSlots() { return a.slots.filter(s => s && s.final && s.text).map(s => s.text); },
    interim() { return tidy(a.slots.filter(s => s && !s.final && s.text).map(s => s.text).join(' ')); },
    // Everything heard so far: committed + finals + interim, in order.
    text() { return tidy([...a.committed, ...a.slots.filter(s => s && s.text).map(s => s.text)].join(' ')); },
    // Only settled text.
    finalText() { return tidy([...a.committed, ...a.finalSlots()].join(' ')); },
    hasPendingInterim() { return a.interim().length > 0; },
    // The recogniser restarted: keep what we have, including an unsettled interim.
    rollover() { const t = tidy(a.slots.filter(s => s && s.text).map(s => s.text).join(' ')); if (t) a.committed.push(t); a.slots = []; },
    reset() { a.committed = []; a.slots = []; },
  };
  return a;
}

// Decides what to deliver after the key is released.
//   - no interim pending  -> the final text now
//   - interim pending     -> null (keep waiting for the last `isFinal`) until waitedOut, then the latest interim counts
export function settleTranscript(assembler, { waitedOut = false } = {}) {
  if (waitedOut) return assembler.text();
  if (assembler.hasPendingInterim()) return null;
  return assembler.finalText();
}

export const TAIL_WAIT_MS = 600;     // how long to wait for a final after release
export const DEICTIC_LAG_MS = 350;   // recognition latency: the cursor was "there" this long before the word arrived

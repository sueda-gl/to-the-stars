// Paper and ink helpers for the game UI: a tiny DOM builder, seeded jitter, deckled sheets,
// wax seals, heraldic shields, envelopes, the pencil scribble and the little resource glyphs. No deps.

export function rng(seed = 1) {           // mulberry32: deckles and seals look the same every run (stable screenshots)
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// h('div.a.b', {attr}, ...children) — strings become text, arrays flatten, {html} sets innerHTML
export function h(tag, attrs, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}

// append, skipping null/false (native append would print "null")
export function add(el, ...kids) { for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k); return el; }

// deckled edge: a clip-path polygon in % + px jitter, so it fits any size without measuring
export function deckle(el, seed = 1, { amp = 2.4, n = 34 } = {}) {
  const r = rng(seed), pts = [];
  const j = () => (r() < 0.12 ? amp * (1 + r() * 0.7) : r() * amp).toFixed(2);
  for (let i = 0; i < n; i++) pts.push(`${(i / n * 100).toFixed(2)}% ${j()}px`);
  for (let i = 0; i < n; i++) pts.push(`calc(100% - ${j()}px) ${(i / n * 100).toFixed(2)}%`);
  for (let i = n; i > 0; i--) pts.push(`${(i / n * 100).toFixed(2)}% calc(100% - ${j()}px)`);
  for (let i = n; i > 0; i--) pts.push(`${j()}px ${(i / n * 100).toFixed(2)}%`);
  el.style.clipPath = `polygon(${pts.join(',')})`;
  return el;
}
// a paper card: wrapper (drop shadow) + deckled sheet; returns { wrap, sheet }
export function paper(cls = '', seed = 1, opts) {
  const sheet = deckle(h('div.ag-sheet' + (opts && opts.slip ? '.ag-sheet--slip' : '')), seed, opts);
  const wrap = h('div.ag-paper' + (cls ? '.' + cls.split(' ').join('.') : ''), null, sheet);
  return { wrap, sheet };
}

// ---------- inks ----------
export const INK = { paper: '#f3ecdc', ink: '#2a2330', red: '#e0503f', rred: '#f15060', yellow: '#ffe800', blue: '#0078bf',
  green: '#00a95c', orange: '#ff6c2f', violet: '#765ba7', teal: '#00838a' };
export const SPECIES = {
  puffer: { name: 'puffer', colour: INK.red, leaning: 'builder' },
  loaf: { name: 'loaf', colour: INK.yellow, leaning: 'baker' },
  drop: { name: 'drop', colour: INK.rred, leaning: 'artist' },
  scoot: { name: 'scoot', colour: INK.blue, leaning: 'courier' },
  flit: { name: 'flit', colour: INK.green, leaning: 'scout' },
  pip: { name: 'pip', colour: INK.orange, leaning: 'farmer' },
  floatie: { name: 'floatie', colour: INK.violet, leaning: 'dreamer' }
};
const NB_HERALDRY = [
  { colour: INK.teal, charge: 'bell', field: INK.yellow },
  { colour: INK.orange, charge: 'sun', field: INK.paper },
  { colour: INK.ink, charge: 'tower', field: INK.paper }
];
// species-led nations (CONCEPT: a Loaf Republic, a Drop Riviera, a Flit Sky-hold...): the leader species' ink + a charge
const SPECIES_HERALDRY = {
  loaf: { colour: INK.yellow, charge: 'loaf', field: INK.ink },
  drop: { colour: INK.rred, charge: 'drop', field: INK.paper },
  flit: { colour: INK.green, charge: 'wing', field: INK.paper },
  puffer: { colour: INK.red, charge: 'tower', field: INK.paper },
  scoot: { colour: INK.blue, charge: 'bell', field: INK.paper },
  pip: { colour: INK.orange, charge: 'sun', field: INK.paper },
  floatie: { colour: INK.violet, charge: 'parasol', field: INK.paper }
};
export function heraldry(id, species) {
  if (species && SPECIES_HERALDRY[species]) return SPECIES_HERALDRY[species];
  const m = /(\d+)$/.exec(String(id));
  return NB_HERALDRY[m ? (Number(m[1]) - 1) % 3 : hash(id) % 3];
}
// sender -> seal look. from = letter.from ({kind,id,name,species?}); species may come from a lookup
export function senderInk(from = {}, species) {
  if (from.kind === 'ministry') return { colour: INK.ink, glyph: '⚖', glyphInk: 'rgba(243,236,220,.8)' };
  if (from.kind === 'neighbour') { const hd = heraldry(from.id, species || from.species); return { colour: hd.colour, glyph: (from.name || '?')[0], glyphInk: hd.colour === INK.ink ? 'rgba(243,236,220,.75)' : 'rgba(255,248,230,.75)', shield: true }; }
  if (from.kind === 'folk') return { colour: INK.red, glyph: 'F', glyphInk: 'rgba(255,245,230,.8)' };
  const sp = SPECIES[species || from.species];
  const colour = from.kind === 'minister' ? INK.red : sp ? sp.colour : INK.ink;
  return { colour, glyph: (from.name || '?')[0], glyphInk: colour === INK.yellow ? 'rgba(42, 35, 48,.72)' : 'rgba(255,246,232,.78)' };
}

// ---------- wax seal: a wobbly blob with a drip, an inner ring and an italic initial ----------
export function sealSVG(colour, glyph = '', size = 40, seed = 3, glyphInk = 'rgba(255,246,232,.78)') {
  const r = rng(seed), n = 16, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = 42 + r() * 5; pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]); }
  let d = '';
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; d += (i ? '' : `M${((pts[n - 1][0] + p[0]) / 2).toFixed(1)} ${((pts[n - 1][1] + p[1]) / 2).toFixed(1)}`) + `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; }
  const da = r() * Math.PI * 2, dx = 50 + Math.cos(da) * 45, dy = 50 + Math.sin(da) * 45;
  const fs = glyph.length > 1 ? 30 : 44;
  return `<svg class="ag-seal" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">` +
    `<path d="${d}Z" fill="${colour}"/><circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${(5 + r() * 4).toFixed(1)}" fill="${colour}"/>` +
    `<circle cx="50" cy="50" r="31" fill="none" stroke="${glyphInk}" stroke-width="2.2" opacity=".55"/>` +
    `<circle cx="50" cy="50" r="27" fill="none" stroke="${glyphInk}" stroke-width="1" stroke-dasharray="1.5 3.2" opacity=".55"/>` +
    `<text x="50" y="${glyph.length > 1 ? 61 : 65}" text-anchor="middle" font-size="${fs}" font-style="italic" fill="${glyphInk}">${esc(glyph)}</text></svg>`;
}

// ---------- heraldic shield (riso: flat fill, charge, a misregistered keyline) ----------
export function shieldSVG(id, w = 30, species) {
  const hd = heraldry(id, species), c = hd.colour, f = hd.field;
  const shape = 'M8 8H92V50C92 76 72 90 50 98C28 90 8 76 8 50Z';
  const charge = {
    bell: `<path d="M50 30c-11 0-15 10-15 22v8l-5 7h40l-5-7v-8c0-12-4-22-15-22z" fill="${f}"/><circle cx="50" cy="73" r="4.5" fill="${f}"/><rect x="47.5" y="22" width="5" height="9" rx="2" fill="${f}"/>`,
    sun: `<circle cx="50" cy="50" r="14" fill="${f}"/>` + Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<line x1="${50 + Math.cos(a) * 19}" y1="${50 + Math.sin(a) * 19}" x2="${50 + Math.cos(a) * 26}" y2="${50 + Math.sin(a) * 26}" stroke="${f}" stroke-width="4" stroke-linecap="round"/>`; }).join(''),
    tower: `<path d="M36 76V40h-4v-12h7v6h6v-6h10v6h6v-6h7v12h-4v36z" fill="${f}"/><path d="M46 76v-12a4 4 0 0 1 8 0v12z" fill="${c}"/>`,
    loaf: `<path d="M24 62c0-14 12-24 26-24s26 10 26 24c0 5-3 8-8 8H32c-5 0-8-3-8-8z" fill="${f}"/><path d="M38 46l-4 10M50 43v11M62 46l4 10" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
    drop: `<path d="M50 24C42 38 34 48 34 60a16 16 0 0 0 32 0c0-12-8-22-16-36z" fill="${f}"/><path d="M43 60a7 7 0 0 0 5 7" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`,
    wing: `<path d="M50 66c-4-14-16-24-30-26 6 12 16 22 30 26zM50 66c4-14 16-24 30-26-6 12-16 22-30 26z" fill="${f}"/><circle cx="50" cy="44" r="7" fill="${f}"/><path d="M50 34v-8M40 26h20" stroke="${f}" stroke-width="4" stroke-linecap="round"/>`,
    parasol: `<path d="M24 50a26 20 0 0 1 52 0z" fill="${f}"/><path d="M50 50v24a5 5 0 0 1-9 2" fill="none" stroke="${f}" stroke-width="4" stroke-linecap="round"/>`
  }[hd.charge];
  return `<svg viewBox="0 0 100 106" width="${w}" height="${w * 1.06}" aria-hidden="true" style="overflow:visible">` +
    `<path d="${shape}" fill="${c}" style="mix-blend-mode:multiply"/>${charge}` +
    `<path d="${shape}" fill="none" stroke="${INK.rred}" stroke-width="3" transform="translate(2.5 -2)" opacity=".7" style="mix-blend-mode:multiply"/></svg>`;
}

export function envelopeSVG() {
  return `<svg class="env" viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true">` +
    `<rect x="1" y="1" width="118" height="78" rx="2.5" fill="#f6efdf" stroke="#2a2330" stroke-opacity=".38"/>` +
    `<path d="M2 77L49 40M118 77L71 40" fill="none" stroke="#2a2330" stroke-opacity=".22"/>` +
    `<path d="M2 2.5L60 47L118 2.5" fill="#efe5cf" stroke="#2a2330" stroke-opacity=".42" stroke-linejoin="round"/></svg>`;
}

// ---------- pencil scribble: a hatching line; drawn length = progress (pathLength=1) ----------
export function scribbleSVG(seed = 5, w = 220) {
  const r = rng(seed); let d = 'M2 9', x = 2;
  while (x < w - 6) { const s = 4 + r() * 4, up = 2 + r() * 3, dn = 12 + r() * 3; d += ` Q${(x + s * .5).toFixed(1)} ${up.toFixed(1)} ${(x + s).toFixed(1)} ${(7 + r() * 2).toFixed(1)} T${(x + s * 1.7).toFixed(1)} ${dn.toFixed(1)}`; x += s * 1.7; }
  return `<svg class="ag-scribble" viewBox="0 0 ${w} 16" preserveAspectRatio="none" aria-hidden="true"><path class="ghost" d="M2 9H${w - 4}" stroke-dasharray="2 4"/>` +
    `<path d="${d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></svg>`;
}

// registration mark (title card corners)
export const REG_SVG = `<svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><circle cx="13" cy="13" r="7" fill="none" stroke="#2a2330" stroke-width="1"/>` +
  `<path d="M13 0V26M0 13H26" stroke="#2a2330" stroke-width="1"/><circle cx="13" cy="13" r="3" fill="none" stroke="#f15060" stroke-width="1" transform="translate(.8 -.6)"/></svg>`;

// tiny line glyphs for the HUD resources
const G = (p) => `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const GLYPH = {
  food: G('<path d="M2.5 11.5c0-4 2.6-6.5 5.5-6.5s5.5 2.5 5.5 6.5z"/><path d="M5.5 7.5l1 2M8 6.5v2.5M10.5 7.5l-1 2"/>'),
  wood: G('<ellipse cx="4.5" cy="9" rx="2" ry="3.2"/><path d="M4.5 5.8h8c1.1 0 2 1.4 2 3.2s-.9 3.2-2 3.2h-8"/><circle cx="4.5" cy="9" r=".7"/>'),
  stone: G('<path d="M2.5 11.8l1.6-5 4-2.3 3.8 1.4 1.8 4.4-2.6 2.2H4.6z"/><path d="M8.1 4.5l-.6 3.7 4.2-.9"/>'),
  coin: G('<circle cx="8" cy="8" r="5.3"/><circle cx="8" cy="8" r="3.2" stroke-dasharray="1 1.4"/>'),
  goods: G('<path d="M3 6.5l5-2.5 5 2.5v5.5l-5 2.5-5-2.5z"/><path d="M3 6.5l5 2.5 5-2.5M8 9v5.5"/>')
};

// ---------- the voice mark: a small fountain-pen-weight mic ----------
export const MIC_SVG = `<svg class="ag-mic-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">` +
  `<rect x="9" y="3.2" width="6" height="11" rx="3"/><path d="M6.2 11.4a5.8 5.8 0 0 0 11.6 0"/><path d="M12 17.2v3.4M9.3 20.6h5.4"/></svg>`;

// ---------- the big envelope (letter reading): three layers so the letter can sit between them ----------
// back (the inside of the envelope), pocket (the front with its V notch, drawn over the letter), flap (opens on rotateX)
export const ENV_BACK_SVG = `<svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">` +
  `<defs><pattern id="ag-tint" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V2.2" stroke="#2a2330" stroke-width=".35" stroke-opacity=".16"/></pattern></defs>` +
  `<rect x=".3" y=".3" width="99.4" height="63.4" rx="1" fill="#e9dec6" stroke="#2a2330" stroke-opacity=".35" stroke-width=".3" vector-effect="non-scaling-stroke"/>` +
  `<rect x=".3" y=".3" width="99.4" height="63.4" rx="1" fill="url(#ag-tint)"/></svg>`;
export const ENV_POCKET_SVG = `<svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">` +
  `<path d="M.3 .6L50 37.5L99.7 .6V63.4a.6 .6 0 0 1-.6.6H.9a.6 .6 0 0 1-.6-.6Z" fill="#f5eedd" stroke="#2a2330" stroke-opacity=".38" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` +
  `<path d="M.8 63.4L43 31.6M99.2 63.4L57 31.6" fill="none" stroke="#2a2330" stroke-opacity=".2" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
export const ENV_FLAP_SVG = `<svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">` +
  `<path d="M.3 .4H99.7L52 38.4a3.2 3.2 0 0 1-4 0Z" fill="#f1e8d3" stroke="#2a2330" stroke-opacity=".42" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;

// a hand-drawn flourish under a signature
export const FLOURISH_SVG = `<svg class="ag-flourish" viewBox="0 0 160 18" aria-hidden="true"><path pathLength="1" d="M3 12c22-5 48-8 76-6 20 1.5 36 4 56 2 9-1 16-4 20-7" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`;

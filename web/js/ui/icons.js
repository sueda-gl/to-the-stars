// AGORA / "Aloud" — the pop-comic UI icon set (ART_DIRECTION §24; ref reference/feedback-1120/icon-aesthetic-pop-comic.png).
// Risograph comic print: hot pink + lemon yellow + cream + coral, a bold dark keyline, halftone-dot shading on the
// shadow side, a slightly MISREGISTERED colour drum (every colour layer sits ~1.3 units down-right of its keyline),
// paper-void speckle in the ink, and little stars/sparkles. §13: green and yellow never meet (only the flit is green,
// and it carries no yellow).
//
//   import { icon, ICON_NAMES, ICON_FILES, iconUrl } from './icons.js';
//   el.innerHTML = icon('mic', 24);            // inline <svg> markup, ids made unique per call
//   img.src = iconUrl('money');                // the standalone file in web/assets/icons/pop/ (or ICON_FILES.money)
//   icon('close', 20, { title: 'Close', cls: 'my-ico' })
//
// Detail by size: under 32 px the stars/sparkles (the "x" layer) are dropped and the keyline gets a touch heavier,
// so everything stays a clean, legible shape at 24 px. The .svg files are the full-detail versions.
// One source of truth: this file. `node scripts/build-icons.mjs` writes the .svg files from it.
// Pure ESM, no DOM: safe to import from Node.

export const PALETTE = {
  ink: '#2a2740',     // the keyline: a deep violet-navy (never the old blue)
  pink: '#ee3d84',    // hot pink
  pinkL: '#f8aecb',   // bubblegum
  mag: '#b3175a',     // the dot colour on pink
  yel: '#ffe23a',     // lemon
  cream: '#fff3dc',
  coral: '#ff6d5a',
  red: '#ee2a2e',     // the "has sent you something" dot
  redD: '#9e0d1f',
  green: '#3caf78',   // flit only (§13: never with yellow)
  greenD: '#16664a',
  lilac: '#cf9be6'
};
const C = PALETTE;

// ---------------------------------------------------------------- shared print defs
const HT = { pink: [C.pink, 1], mag: [C.mag, 1], coral: [C.coral, 1], ink: [C.ink, .5], green: [C.greenD, 1], red: [C.redD, 1], lilac: ['#8d4fb0', 1] };
const htDef = k => `<pattern id="ht-${k}" width="3.1" height="3.1" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">` +
  `<circle cx="1.55" cy="1.55" r="1.08" fill="${HT[k][0]}"${HT[k][1] < 1 ? ` fill-opacity="${HT[k][1]}"` : ''}/></pattern>`;
// paper voids in the ink: a sparse speckle of cream, like a riso drum that ran a little dry
const GRAIN = (() => {
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; let d = '';
  for (let i = 0; i < 9; i++) d += `<circle cx="${(r() * 13).toFixed(2)}" cy="${(r() * 13).toFixed(2)}" r="${(.22 + r() * .32).toFixed(2)}"/>`;
  return `<pattern id="gr" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(9)"><g fill="#fff8ea" fill-opacity=".75">${d}</g></pattern>`;
})();

// ---------------------------------------------------------------- geometry helpers
const f = n => +n.toFixed(2);
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const mirror = pts => pts.map(([x, y]) => [48 - x, y]);
function starPts(cx, cy, R, r = R * .44, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return pts;
}
const star = (cx, cy, R, r) => poly(starPts(cx, cy, R, r));
const sparkle = (cx, cy, R, p = .2) => { const q = R * p; return `M${f(cx)} ${f(cy - R)}Q${f(cx + q)} ${f(cy - q)} ${f(cx + R)} ${f(cy)}Q${f(cx + q)} ${f(cy + q)} ${f(cx)} ${f(cy + R)}Q${f(cx - q)} ${f(cy + q)} ${f(cx - R)} ${f(cy)}Q${f(cx - q)} ${f(cy - q)} ${f(cx)} ${f(cy - R)}Z`; };
// a jagged comic burst: n spikes, seeded unevenness
function burst(cx, cy, R, r, n, seed = 3, rot = -90) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n + (rnd() - .5) * 8) * Math.PI / 180, rr = (i % 2 ? r : R) * (.9 + rnd() * .16); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return poly(pts);
}
// a wax seal: a scalloped blob, smoothed through midpoints
function blob(cx, cy, R, n, amp, seed = 5) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = R + (i % 2 ? -amp : amp) * (.7 + rnd() * .5); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  let d = '';
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (!i) { const l = pts[n - 1]; d += `M${f((l[0] + p[0]) / 2)} ${f((l[1] + p[1]) / 2)}`; } d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`; }
  return d + 'Z';
}

// ---------------------------------------------------------------- the drawing API
// Each shape is printed as: [colour drum, offset by MISREG] then [keyline, on register]. Shapes are interleaved in
// order, so a later shape's colour covers an earlier keyline (a sticker stack, not an x-ray).
const MISREG = ['§MX', '§MY'];   // the colour drum's offset: [2, 1.6] at full size, [1.1, .9] small
const SHADE = 1.45;              // halftone shade depth multiplier
function draw(fn) {
  const main = [], extra = [], defs = new Set(), haloM = [], haloX = [];
  let ci = 0;
  // the sticker edge: every shape and line again, underneath, in paper colour and a little fatter (a die-cut edge, so
  // the ink keyline still reads on a dark panel or over the world)
  const halo = (into, el, kind, w) => (into === main ? haloM : haloX).push(kind === 'line'
    ? `<${el} fill="none" stroke="§P" stroke-width="${w != null ? +w + 3.6 : '§H'}" stroke-linejoin="round" stroke-linecap="round"/>`
    : `<${el} fill="§P" stroke="§P" stroke-width="${w != null ? +w + 3.6 : '§H'}" stroke-linejoin="round"/>`);
  const mk = (into, el, fill, o = {}) => {
    // el: an element WITHOUT its closing "/>", e.g. 'circle cx="24" cy="24" r="10"'
    let c = `<${el} fill="${fill}"/>`;
    if (o.ht || o.grain !== false) {
      const id = `cp${ci++}`; defs.add('gr');
      const sh = f((o.sh ?? 3.4) * SHADE);
      c += `<clipPath id="${id}"><${el}/></clipPath><g clip-path="url(#${id})">`;
      if (o.ht) { defs.add('ht-' + o.ht); c += `<${el} fill="url(#ht-${o.ht})"/><g transform="translate(${-sh} ${-sh * (o.shy ?? 1)})"><${el} fill="${fill}"/></g>`; }
      if (o.grain !== false) c += `<${el} fill="url(#gr)"/>`;
      c += '</g>';
    }
    const off = o.reg ? '' : ` transform="translate(${MISREG[0]} ${MISREG[1]})"`;
    halo(into, el, 'shape', o.line === false ? 0 : o.w);
    into.push(`<g${off}>${c}</g>`);
    if (o.line !== false) into.push(`<${el} fill="none" stroke="${C.ink}" stroke-width="${o.w ? `${o.w}` : '§W'}" stroke-linejoin="round" stroke-linecap="round"/>`);
  };
  const api = {
    // a filled, keylined, misregistered shape (o.ht = halftone shade on the lower right, o.sh = shade depth)
    s: (el, fill, o) => mk(main, el, fill, o),
    // keyline only (o.w: width; default the set's weight)
    k: (el, w) => (halo(main, el, 'line', w), main.push(`<${el} fill="none" stroke="${C.ink}" stroke-width="${w ?? '§W'}" stroke-linejoin="round" stroke-linecap="round"/>`)),
    // solid ink (eyes, notches), on register
    ink: el => main.push(`<${el} fill="${C.ink}"/>`),
    // colour only, misregistered, no keyline (glints, blush, liquid lines)
    c: (el, fill) => main.push(`<g transform="translate(${MISREG[0]} ${MISREG[1]})"><${el} fill="${fill}"/></g>`),
    // a colour stroke along any element (a ring, a band), misregistered, no keyline
    sc: (el, col, w) => main.push(`<g transform="translate(${MISREG[0]} ${MISREG[1]})"><${el} fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/></g>`),
    // a cream/colour stroke (a glint, a highlight), misregistered
    glint: (d, col = C.cream, w = 2.2) => main.push(`<g transform="translate(${MISREG[0]} ${MISREG[1]})"><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/></g>`),
    // the decorative layer (stars, sparkles, motion ticks): dropped below 32 px
    x: {
      s: (el, fill, o = {}) => mk(extra, el, fill, { grain: false, w: 1.7, ...o }),
      star: (cx, cy, R, fill = C.yel) => mk(extra, `path d="${star(cx, cy, R)}"`, fill, { grain: false, w: 1.6 }),
      spark: (cx, cy, R, fill = C.ink) => (halo(extra, `path d="${sparkle(cx, cy, R)}"`, 'shape', 0), extra.push(`<path d="${sparkle(cx, cy, R)}" fill="${fill}"/>`)),
      tick: (d, w = 2) => (halo(extra, `path d="${d}"`, 'line', w), extra.push(`<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${w}" stroke-linecap="round"/>`)),
      dot: (cx, cy, r, fill = C.ink) => (halo(extra, `circle cx="${cx}" cy="${cy}" r="${r}"`, 'shape', 0), extra.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`))
    }
  };
  fn(api);
  return { main: main.join(''), extra: extra.join(''), haloM: haloM.join(''), haloX: haloX.join(''), defs };
}

// ---------------------------------------------------------------- the icons (48 x 48 grid)
const ARROW = [[6.5, 18.2], [22.5, 18.2], [22.5, 9.5], [41.5, 24], [22.5, 38.5], [22.5, 29.8], [6.5, 29.8]];
const BUBBLE = 'M24 7.5C34.2 7.5 42.5 13.4 42.5 21S34.2 34.5 24 34.5C22 34.5 20.1 34.3 18.3 33.8L8.5 40.5L11.2 30.6C7.6 28.2 5.5 24.8 5.5 21C5.5 13.4 13.8 7.5 24 7.5Z';
const ENV_BODY = 'rect x="4.5" y="11" width="39" height="27" rx="3.5"';
const ENV_FLAP = 'path d="M5.5 12.5L24 27.5L42.5 12.5"';
const PIN = 'M24 44.5C24 44.5 9.5 29.6 9.5 19A14.5 14.5 0 0 1 38.5 19C38.5 29.6 24 44.5 24 44.5Z';

const DEFS = {
  // ---------- talking to the folk
  mic: d => {
    d.s('rect x="16.5" y="4.5" width="15" height="24" rx="7.5"', C.pink, { ht: 'mag', sh: 4 });
    d.k('path d="M17.5 14.5h5M17.5 19.5h5"', 2.2);
    d.glint('M20.5 9.5v1.5', C.cream, 2.6);
    d.k('path d="M10.5 21.5a13.5 13.5 0 0 0 27 0M24 35.5V40"');
    d.s('rect x="14.5" y="39.5" width="19" height="5.5" rx="2.75"', C.yel, { ht: 'pink', sh: 2 });
    d.x.spark(40.5, 8.5, 4.5); d.x.spark(7, 11, 3);
  },
  'mic-live': d => {
    d.s('rect x="16.5" y="4.5" width="15" height="24" rx="7.5"', C.coral, { ht: 'mag', sh: 4 });
    d.k('path d="M17.5 14.5h5M17.5 19.5h5"', 2.2);
    d.glint('M20.5 9.5v1.5', C.cream, 2.6);
    d.k('path d="M10.5 21.5a13.5 13.5 0 0 0 27 0M24 35.5V40"');
    d.s('rect x="14.5" y="39.5" width="19" height="5.5" rx="2.75"', C.yel, { ht: 'pink', sh: 2 });
    d.k('path d="M6 10.5a12 12 0 0 0 0 15M42 10.5a12 12 0 0 1 0 15"', 2.4);
    d.x.tick('M2.5 7.5a16 16 0 0 0 0 22M45.5 7.5a16 16 0 0 1 0 22', 1.8);
  },
  'space-key': d => {
    d.s('rect x="2.5" y="12.5" width="43" height="24" rx="6"', C.pink, { ht: 'mag', sh: 3 });
    d.s('rect x="5.5" y="13.5" width="37" height="16" rx="4.5"', C.cream, { ht: 'pink', sh: 2.6 });
    d.k('path d="M14.5 18.5v4.5h19v-4.5"', 2.8);
    d.x.spark(43, 7.5, 4); d.x.spark(5.5, 42.5, 3);
  },
  type: d => {
    // a fat pencil, writing
    d.s(`path d="${poly([[30.5, 5.5], [41.5, 16.5], [37, 21], [26, 10]])}"`, C.pink, { ht: 'mag', sh: 2 });
    d.s(`path d="${poly([[26, 10], [37, 21], [17, 41], [6, 30]])}"`, C.yel, { ht: 'pink', sh: 3 });
    d.k('path d="M11.5 35.5L31.5 15.5"', 2);
    d.s(`path d="${poly([[6, 30], [17, 41], [4.5, 44.5]])}"`, C.cream, { grain: false });
    d.ink(`path d="${poly([[5.6, 39.8], [9.2, 43.4], [4, 45]])}"`);
    d.x.tick('M24 44.5c3.5-2.6 6-2.6 8.5-.2s5 2.4 8 .2', 2.2);
  },
  // ---------- small actions
  close: d => {
    const a = 4, L = 16.5, c = 24;
    const pts = [[c - a, c - L], [c + a, c - L], [c + a, c - a], [c + L, c - a], [c + L, c + a], [c + a, c + a], [c + a, c + L], [c - a, c + L], [c - a, c + a], [c - L, c + a], [c - L, c - a], [c - a, c - a]];
    d.s(`path d="${poly(pts)}" transform="rotate(45 24 24)"`, C.pink, { ht: 'mag', sh: 3 });
  },
  prev: d => d.s(`path d="${poly(mirror(ARROW))}"`, C.yel, { ht: 'pink', sh: 3.6 }),
  next: d => d.s(`path d="${poly(ARROW)}"`, C.yel, { ht: 'pink', sh: 3.6 }),
  'chevron-down': d => d.s(`path d="${poly([[7, 16.5], [14, 9.5], [24, 19.5], [34, 9.5], [41, 16.5], [24, 33.5]])}"`, C.pink, { ht: 'mag', sh: 3 }),
  check: d => {
    d.s(`path d="${poly([[5, 25], [12, 18], [19, 25], [36, 8], [43, 15], [19, 39]])}"`, C.yel, { ht: 'pink', sh: 3.4 });
    d.x.spark(40, 34, 4.5, C.pink);
  },
  ledger: d => {
    d.s('rect x="12.5" y="9" width="27" height="35" rx="2.5"', C.cream, { ht: 'pink', sh: 2.4 });
    d.s('path d="M9.5 41V7.5A3.5 3.5 0 0 1 13 4H37.5V38H13A3.5 3.5 0 0 0 9.5 41.5A3.5 3.5 0 0 0 13 45H39.5"', C.pink, { ht: 'mag', sh: 3 });
    d.s('rect x="9.5" y="4" width="6.5" height="34"', C.mag, { grain: false });
    d.s(`path d="${star(27, 20.5, 7.5, 3.3)}"`, C.yel, { ht: 'coral', sh: 1.6, grain: false });
    d.k('path d="M14 41.5H39.5"', 2);
  },
  point: d => {
    d.s(`path d="${poly([[12, 5.5], [12, 37.5], [19.5, 30.5], [25, 42.5], [31.5, 39.6], [26, 28], [36.5, 27.5]])}"`, C.yel, { ht: 'pink', sh: 3 });
    d.x.tick('M5.5 4.5L8 7M12 1.5v3M2.5 11h3', 2.2);
    d.x.star(38, 9, 5.5, C.pink);
  },
  speech: d => {
    d.s(`path d="${BUBBLE}"`, C.cream, { ht: 'pink', sh: 3.6 });
    d.k('path d="M15 17.5H33M15 24H27"', 2.8);
    d.x.spark(43.5, 39, 4, C.pink);
  },
  thinking: d => {
    d.s('circle cx="10" cy="41.5" r="3"', C.cream, { grain: false });
    d.s('circle cx="15.5" cy="35" r="4.2"', C.cream, { grain: false });
    d.s('path d="M14 29.5A6.5 6.5 0 0 1 9.5 18.5A8 8 0 0 1 21 9.5A8.5 8.5 0 0 1 35.5 11.5A7.5 7.5 0 0 1 40 25A6.5 6.5 0 0 1 31 31A8 8 0 0 1 21 31.5A6.5 6.5 0 0 1 14 29.5Z"', C.cream, { ht: 'pink', sh: 3 });
    d.ink('circle cx="17" cy="20.5" r="2.4"'); d.ink('circle cx="24.5" cy="20.5" r="2.4"'); d.ink('circle cx="32" cy="20.5" r="2.4"');
  },
  // ---------- mail
  envelope: d => {
    d.s(ENV_BODY, C.cream, { ht: 'pink', sh: 3.4 });
    d.k('path d="M6 36.5L19.5 24.5M42 36.5L28.5 24.5"', 2);
    d.s(`path d="M5.5 12.5L24 27.5L42.5 12.5Z"`, C.pinkL, { ht: 'pink', sh: 2 });
    d.s('path d="M24 33C19.5 30 17.5 27.5 17.5 25A3.2 3.2 0 0 1 24 23.6A3.2 3.2 0 0 1 30.5 25C30.5 27.5 28.5 30 24 33Z"', C.red, { ht: 'red', sh: 1, grain: false, w: 2.2 });
    d.x.star(41, 7.5, 5);
  },
  'envelope-open': d => {
    d.s('path d="M4.5 19L24 4.5L43.5 19Z"', C.pink, { ht: 'mag', sh: 2.4 });
    d.s('rect x="10" y="8.5" width="28" height="24" rx="1.5"', C.cream, { grain: false });
    d.k('path d="M15 14.5h18M15 19.5h12"', 2.2);
    d.s('path d="M4.5 19V41A2.5 2.5 0 0 0 7 43.5H41A2.5 2.5 0 0 0 43.5 41V19L24 32Z"', C.pinkL, { ht: 'pink', sh: 3 });
    d.x.spark(43, 5, 4); d.x.star(6, 6.5, 4.5);
  },
  letters: d => {
    d.s('rect x="9.5" y="5" width="35" height="24" rx="3.5" transform="rotate(8 27 17)"', C.pinkL, { ht: 'pink', sh: 2.4 });
    d.k('path d="M11 7.5L27.5 20.5L43.5 9.5" transform="rotate(8 27 17)"', 2.2);
    d.s('rect x="3.5" y="17" width="36" height="25" rx="3.5"', C.cream, { ht: 'pink', sh: 3 });
    d.s('path d="M4.5 18.5L21.5 32L38.5 18.5Z"', C.yel, { ht: 'pink', sh: 2 });
  },
  mailbox: d => {
    d.s('rect x="21.5" y="35" width="6.5" height="10" rx="1"', C.cream, { ht: 'pink', sh: 2 });
    d.s('path d="M9 36.5V21A11 11 0 0 1 20 10H34.5A9 9 0 0 1 43.5 19V36.5Z"', C.pink, { ht: 'mag', sh: 3.4 });
    d.s('path d="M4.5 36.5V21A8 8 0 0 1 20.5 21V36.5Z"', C.pinkL, { ht: 'pink', sh: 2.6 });
    d.s('rect x="7.5" y="22.5" width="10" height="6.5" rx="1"', C.cream, { grain: false });
    d.k('path d="M37 25V4"', 2.6);
    d.s('path d="M37 4.5H45.5V12H37Z"', C.yel, { ht: 'coral', sh: 1.6, grain: false });
    d.x.spark(42.5, 41.5, 4);
  },
  seal: d => {
    d.s(`path d="${blob(24, 23.5, 18.5, 18, 1.5, 4)}"`, C.pink, { ht: 'mag', sh: 3.6 });
    d.s('circle cx="38" cy="38.5" r="4.4"', C.pink, { ht: 'mag', sh: 1.6 });
    d.k('circle cx="24" cy="23.5" r="11.5"', 2);
    d.s(`path d="${star(24, 23.5, 8.2, 3.6)}"`, C.yel, { ht: 'coral', sh: 1.6, grain: false });
  },
  'minister-seal': d => {
    d.s(`path d="${blob(24, 24, 19, 18, 1.5, 11)}"`, C.coral, { ht: 'red', sh: 3.6 });
    d.s('circle cx="9.5" cy="39.5" r="4.2"', C.coral, { ht: 'red', sh: 1.6 });
    d.k('circle cx="24" cy="24" r="12.5"', 2);
    d.s(`path d="${poly([[14.5, 29], [14.5, 17], [19.5, 22], [24, 14.5], [28.5, 22], [33.5, 17], [33.5, 29]])}"`, C.yel, { ht: 'pink', sh: 2, grain: false });
    d.x.star(41, 7.5, 5, C.yel);
  },
  ministry: d => {
    d.k('path d="M24 7V40"', 3.4);
    d.s('rect x="15" y="39" width="18" height="5.5" rx="2.75"', C.pink, { ht: 'mag', sh: 1.6 });
    d.k('path d="M7.5 13H40.5"', 3.4);
    d.k('path d="M10 13L5 27M10 13L15 27M38 13L33 27M38 13L43 27"', 1.8);
    d.s('path d="M3 27H17A7 7 0 0 1 3 27Z"', C.yel, { ht: 'pink', sh: 1.8 });
    d.s('path d="M31 27H45A7 7 0 0 1 31 27Z"', C.yel, { ht: 'pink', sh: 1.8 });
    d.s('circle cx="24" cy="6.5" r="3.4"', C.pink, { grain: false });
  },
  shield: d => {
    const S = 'M7 6H41V24C41 35 33 41.5 24 45C15 41.5 7 35 7 24Z';
    d.s(`path d="${S}"`, C.pink, { ht: 'mag', sh: 3.4 });
    d.s('path d="M7 6H24V45C15 41.5 7 35 7 24Z"', C.cream, { ht: 'pink', sh: 2, line: false });
    d.k(`path d="${S}"`);
    d.k('path d="M24 6V45"', 2);
    d.s(`path d="${star(24, 22.5, 9, 4)}"`, C.yel, { ht: 'coral', sh: 1.6, grain: false });
  },
  // ---------- rewards (§22b)
  money: d => {
    d.s('circle cx="27" cy="26.5" r="17"', C.coral, { ht: 'red', sh: 2 });
    d.s('circle cx="23.5" cy="23" r="17"', C.yel, { ht: 'pink', sh: 3.6 });
    d.k('circle cx="23.5" cy="23" r="11.5"', 2);
    d.s(`path d="${star(23.5, 23, 7.5, 3.3)}"`, C.pink, { ht: 'mag', sh: 1.4, grain: false });
    d.glint('M11.5 17.5A13 13 0 0 1 17 11.5', C.cream, 2.4);
    d.x.spark(42.5, 7.5, 4.5);
  },
  happiness: d => {
    d.k('path d="M24 2.5V8"', 2.4);
    d.s('rect x="16.5" y="7.5" width="15" height="5" rx="1.5"', C.yel, { grain: false });
    d.s('ellipse cx="24" cy="25" rx="16" ry="13.5"', C.coral, { ht: 'red', sh: 3.4 });
    d.k('path d="M16 13.5C12.5 20 12.5 30 16 36.5M32 13.5C35.5 20 35.5 30 32 36.5"', 1.6);
    d.s('rect x="16.5" y="37" width="15" height="5" rx="1.5"', C.yel, { grain: false });
    d.k('path d="M24 42V46"', 2.4);
    d.ink('circle cx="20" cy="23" r="2"'); d.ink('circle cx="28" cy="23" r="2"');
    d.k('path d="M19.5 27.5C21.5 30.5 26.5 30.5 28.5 27.5"', 2.4);
    d.c('circle cx="15.5" cy="28" r="2"', C.pinkL); d.c('circle cx="32.5" cy="28" r="2"', C.pinkL);
    d.x.spark(42, 10, 4.5, C.ink); d.x.spark(6, 38, 3.4, C.ink);
  },
  science: d => {
    const F = 'M19.5 5.5H28.5M20.5 5.5V18L9.5 37.5A3.5 3.5 0 0 0 12.6 43H35.4A3.5 3.5 0 0 0 38.5 37.5L27.5 18V5.5';
    d.s(`path d="M20.5 5.5V18L9.5 37.5A3.5 3.5 0 0 0 12.6 43H35.4A3.5 3.5 0 0 0 38.5 37.5L27.5 18V5.5Z"`, C.cream, { line: false });
    d.s('path d="M14.5 28.5Q19 26.5 24 28.5T33.5 28.5L38.5 37.5A3.5 3.5 0 0 1 35.4 43H12.6A3.5 3.5 0 0 1 9.5 37.5Z"', C.pink, { ht: 'mag', sh: 3, line: false });
    d.k('path d="M14.5 28.5Q19 26.5 24 28.5T33.5 28.5"', 2);
    d.k(`path d="${F}"`);
    d.c('circle cx="20" cy="36" r="2.2"', C.cream); d.c('circle cx="26.5" cy="38.5" r="1.5"', C.cream); d.c('circle cx="25.5" cy="32.5" r="1.2"', C.cream);
    d.glint('M19 22.5L15 29.5', C.pinkL, 2);
    d.x.s('circle cx="31" cy="13" r="2.4"', C.pinkL); d.x.s('circle cx="35.5" cy="6.5" r="1.7"', C.pinkL);
    d.x.star(8.5, 10, 5);
  },
  civ: d => {
    d.s('path d="M15.5 8.5C22 5.5 28 11.5 41.5 7.5L36.5 16L42 24.5C28.5 28.5 22 22.5 15.5 25.5Z"', C.pink, { ht: 'mag', sh: 3 });
    d.s(`path d="${star(26.5, 16.5, 5.4, 2.4)}"`, C.yel, { grain: false });
    d.k('path d="M14 7V43"', 3.4);
    d.s('circle cx="14" cy="5.5" r="3.4"', C.yel, { grain: false });
    d.s('path d="M5 44.5C8 39 20 39 23 44.5Z"', C.yel, { ht: 'pink', sh: 1.8 });
    d.x.tick('M33 35.5L37.5 31L42 35.5M33 42L37.5 37.5L42 42', 2.2);
  },
  'level-up': d => {
    d.s(`path d="${burst(24, 24, 22.5, 15, 11, 5)}"`, C.yel, { ht: 'pink', sh: 3.4 });
    d.s(`path d="${star(24, 25, 11, 4.9)}"`, C.pink, { ht: 'mag', sh: 1.8 });
  },
  // ---------- folk + the world
  'alert-dot': d => {
    d.s('circle cx="24" cy="24" r="15"', C.red, { ht: 'red', sh: 4 });
    d.glint('M15.5 20A9.5 9.5 0 0 1 20 15.5', '#ffd3d3', 3);
  },
  pin: d => {
    d.s(`path d="${PIN}"`, C.pink, { ht: 'mag', sh: 3.6 });
    d.s('circle cx="24" cy="19" r="6.5"', C.cream, { ht: 'pink', sh: 2 });
    d.x.spark(42, 39, 4);
  },
  folk: d => {
    d.s('path d="M7.5 45C7.5 36 15 31 24 31S40.5 36 40.5 45Z"', C.pink, { ht: 'mag', sh: 3 });
    d.s('circle cx="24" cy="19" r="13"', C.cream, { ht: 'pink', sh: 3 });
    d.ink('circle cx="19.5" cy="18.5" r="2"'); d.ink('circle cx="28.5" cy="18.5" r="2"');
    d.k('path d="M20.5 24C22.5 26 25.5 26 27.5 24"', 2.2);
    d.c('circle cx="15.5" cy="23" r="2"', C.pinkL); d.c('circle cx="32.5" cy="23" r="2"', C.pinkL);
  },
  residents: d => {
    d.s('path d="M23 44C23 37 27.5 33.5 33.5 33.5S44.5 37 44.5 44Z"', C.coral, { ht: 'red', sh: 2 });
    d.s('circle cx="33.5" cy="23" r="9.5"', C.yel, { ht: 'pink', sh: 2.4 });
    d.ink('circle cx="30.5" cy="22.5" r="1.6"'); d.ink('circle cx="36.5" cy="22.5" r="1.6"');
    d.s('path d="M3.5 45C3.5 37 9 32.5 16 32.5S28.5 37 28.5 45Z"', C.pink, { ht: 'mag', sh: 2.4 });
    d.s('circle cx="16" cy="20.5" r="10.5"', C.cream, { ht: 'pink', sh: 2.6 });
    d.ink('circle cx="12.5" cy="20" r="1.7"'); d.ink('circle cx="19.5" cy="20" r="1.7"');
    d.k('path d="M13.5 24.5C15 26 17 26 18.5 24.5"', 2);
    d.x.star(40.5, 7.5, 5, C.pink);
  },
  'portrait-ring': d => {
    d.s('path d="M24 2.5A21.5 21.5 0 1 1 23.99 2.5ZM24 8.5A15.5 15.5 0 1 0 24.01 8.5Z" fill-rule="evenodd" clip-rule="evenodd"', C.yel, { ht: 'pink', sh: 2.6 });
    d.x.star(39.5, 8.5, 6, C.pink); d.x.spark(7, 40, 4.5);
  },
  flit: d => {
    // §13: green body, so NO yellow anywhere on it: a pink cap, an ink propeller, cream eyes
    d.k('path d="M12.5 6H35.5"', 3.4);
    d.k('path d="M24 6V12"', 2.6);
    d.s('circle cx="24" cy="27.5" r="16"', C.green, { ht: 'green', sh: 3.6 });
    d.s('path d="M8.6 22.5A16 16 0 0 1 39.4 22.5Z"', C.pink, { ht: 'mag', sh: 2 });
    d.s('circle cx="18.5" cy="30" r="3.6"', C.cream, { grain: false }); d.s('circle cx="29.5" cy="30" r="3.6"', C.cream, { grain: false });
    d.ink('circle cx="19" cy="30.5" r="1.7"'); d.ink('circle cx="30" cy="30.5" r="1.7"');
    d.x.spark(42.5, 41.5, 4, C.pink);
  },
  floatie: d => {
    d.k('path d="M24 21V31"', 2.4);
    d.s('path d="M3.5 21.5A20.5 16 0 0 1 44.5 21.5Z"', C.coral, { ht: 'red', sh: 2.6 });
    d.s('path d="M15.5 21.5A8.5 16 0 0 1 32.5 21.5Z"', C.cream, { ht: 'pink', sh: 1.6 });
    d.s('circle cx="24" cy="36" r="9"', C.lilac, { ht: 'lilac', sh: 2.4 });
    d.ink('circle cx="21" cy="35.5" r="1.6"'); d.ink('circle cx="27" cy="35.5" r="1.6"');
    d.x.star(43, 37, 4.5, C.pink);   // pink, not yellow: it stands next to the (green) flit in the fleet line
  },
  // ---------- onboarding
  step: d => d.s('circle cx="24" cy="24" r="9"', C.cream, { grain: false, w: 3 }),
  'step-current': d => {
    d.s('circle cx="24" cy="24" r="13"', C.pink, { ht: 'mag', sh: 3 });
    d.x.spark(40.5, 9, 5); d.x.spark(8, 38, 3.4);
  },
  'step-done': d => {
    d.s('circle cx="24" cy="24" r="13"', C.yel, { ht: 'pink', sh: 3 });
    d.k('path d="M18 24.5L22.5 29L30.5 19.5"', 3.4);
  },
  planet: d => {
    const R = 'transform="rotate(-18 24 24)"';
    d.k(`path d="M2.5 24.5A21.5 7 0 0 1 45.5 24.5" ${R}`, 7.4);
    d.sc(`path d="M2.5 24.5A21.5 7 0 0 1 45.5 24.5" ${R}`, C.yel, 2.8);
    d.s('circle cx="24" cy="24" r="14.5"', C.pink, { ht: 'mag', sh: 3.8 });
    d.k('path d="M13 18.5C17 18 20.5 20 24.5 19.5"', 2);
    d.k(`path d="M2.5 24.5A21.5 7 0 0 0 45.5 24.5" ${R}`, 7.4);
    d.sc(`path d="M2.5 24.5A21.5 7 0 0 0 45.5 24.5" ${R}`, C.yel, 2.8);
    d.x.star(8.5, 8.5, 5); d.x.spark(41.5, 41.5, 4); d.x.dot(40, 5.5, 1.6);
  },
  build: d => {
    d.s('rect x="10.5" y="23" width="22" height="20" rx="1"', C.cream, { ht: 'pink', sh: 2.6 });
    d.s('rect x="18.5" y="31" width="7" height="12"', C.pink, { grain: false });
    d.s(`path d="${poly([[6.5, 25], [21.5, 10.5], [36.5, 25]])}"`, C.pink, { ht: 'mag', sh: 2.6 });
    d.s(`path d="M39 3.5Q40 11.5 46 12.5Q40 13.5 39 21.5Q38 13.5 32 12.5Q38 11.5 39 3.5Z"`, C.yel, { grain: false, w: 2.2 });
    d.x.spark(42.5, 32, 3.5); d.x.dot(6, 10, 1.6);
  },
  heart: d => {
    d.s('path d="M24 42.5C10 34 4.5 26 4.5 18A10 10 0 0 1 24 13.5A10 10 0 0 1 43.5 18C43.5 26 38 34 24 42.5Z"', C.pink, { ht: 'mag', sh: 3.6 });
    d.glint('M10.5 17A5.5 5.5 0 0 1 15.5 11.5', C.pinkL, 2.6);
    d.x.star(40.5, 6.5, 5); d.x.spark(6.5, 40, 3.6);
  }
};

// the onboarding's six steps, in order (§24): their markers
export const ONBOARDING_STEPS = ['planet', 'residents', 'envelope', 'build', 'minister-seal', 'heart'];
// where each icon goes in the game (for the UI overhaul)
export const ICON_USES = {
  mic: 'voice bar: hold Space to speak', 'mic-live': 'voice bar while listening', 'space-key': '"hold Space" hint / onboarding', type: 'write instead (Enter / click to type)',
  close: 'close / dismiss (×)', prev: 'previous letter', next: 'next letter', 'chevron-down': 'recent letters column toggle', check: 'mark read / done',
  ledger: 'the ledger (Tab)', point: 'pointing hint ("there")', speech: 'talk to the minister / a folk', thinking: 'folk thinking (bubble)',
  envelope: 'a letter (closed)', 'envelope-open': 'a letter being read', letters: 'the envelope stack, top right', mailbox: 'the mailbox (inbox)',
  seal: 'wax seal (generic)', 'minister-seal': 'the minister’s seal', ministry: 'the Ministry (scales)', shield: 'a neighbour nation',
  money: 'reward: Money', happiness: 'reward: Happiness', science: 'reward: Science', civ: 'reward: Civ level', 'level-up': 'civ level-up moment',
  'alert-dot': 'red dot above a folk who has sent you something', pin: 'a place / sender marker', folk: 'a resident', residents: 'onboarding: meet your residents', 'portrait-ring': 'frame round a painted portrait (transparent centre)',
  flit: 'fleet species mark: flit', floatie: 'fleet species mark: floatie',
  step: 'onboarding step: to come', 'step-current': 'onboarding step: now', 'step-done': 'onboarding step: done',
  planet: 'onboarding: welcome to R-99', build: 'onboarding: first build', heart: 'onboarding: be fair, treat them well'
};

export const ICON_NAMES = Object.keys(DEFS);
const BASE = new URL('../../assets/icons/pop/', import.meta.url);
// NAME -> file (relative to web/), and NAME -> absolute URL for <img src>
export const ICON_FILES = Object.fromEntries(ICON_NAMES.map(n => [n, `assets/icons/pop/${n}.svg`]));
export const iconUrl = name => new URL(`${name}.svg`, BASE).href;

const built = {};
const get = name => built[name] || (built[name] = draw(DEFS[name]));
function defsFor(set) {
  let s = '';
  for (const k of set) s += k === 'gr' ? GRAIN : htDef(k.slice(3));
  return s ? `<defs>${s}</defs>` : '';
}
// the raw SVG document, full detail (what the .svg files hold)
// sticker: the paper-coloured die-cut edge under the icon (true = cream, a colour string, or false for none)
export function iconSVG(name, { detail = true, weight = 2.6, standalone = true, sticker = true, misreg } = {}) {
  const a = get(name); if (!a) throw new Error(`icons.js: no icon "${name}"`);
  const edge = sticker ? `<g class="pop-edge">${a.haloM}${detail ? a.haloX : ''}</g>`.replaceAll('§P', sticker === true ? C.cream : sticker) : '';
  const mis = misreg ?? (detail ? [2, 1.6] : [1.1, .9]);
  const body = (edge + a.main + (detail ? a.extra : '')).replaceAll('§H', String(weight + 3.6)).replaceAll('§W', String(weight))
    .replaceAll('§MX', String(mis[0])).replaceAll('§MY', String(mis[1]));
  return `<svg${standalone ? ' xmlns="http://www.w3.org/2000/svg"' : ''} viewBox="0 0 48 48" width="48" height="48">${defsFor(a.defs)}${body}</svg>`;
}

let seq = 0;
// inline markup at a pixel size; ids are made unique so many icons can live in one document
export function icon(name, size = 24, { title = '', cls = '', detail, sticker = true } = {}) {
  if (!DEFS[name]) throw new Error(`icons.js: no icon "${name}"`);
  const small = size < 32;
  const u = `-pi${(seq++).toString(36)}`;
  let svg = iconSVG(name, { detail: detail ?? !small, weight: small ? 3 : 2.6, standalone: false, sticker });
  svg = svg.replace(/id="([^"]+)"/g, `id="$1${u}"`).replace(/url\(#([^)]+)\)/g, `url(#$1${u})`);
  const a11y = title ? ` role="img" aria-label="${title.replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
  return svg.replace('<svg viewBox="0 0 48 48" width="48" height="48">',
    `<svg class="pop-icon${cls ? ' ' + cls : ''}" data-icon="${name}" viewBox="0 0 48 48" width="${size}" height="${size}" overflow="visible"${a11y}>${title ? `<title>${title.replace(/</g, '&lt;')}</title>` : ''}`);
}

// The game's typefaces (Sueda, 2026-10-04: Instrument Serif "looks like any game AI built"; the candidates are the
// specimens in web/fonts.html). Every UI style reads two CSS variables, --ag-font-display (names, subjects, titles,
// signatures) and --ag-font-text (everything else); css/agora.css sets them per set under :root[data-ag-font="A"].
// This module only flips that attribute and loads the webfonts a set needs, on demand (the default loads nothing new).
//   createUI({ font: 'A' })  ·  ui.setFont('C')  ·  ?font=A in the page URL  ·  setFont('now') = Instrument Serif
// Pure DOM, no imports.

export const FONT_SETS = {
  now: { name: 'Instrument Serif', display: 'Instrument Serif', text: 'Instrument Serif', note: 'the current font' },
  A: { name: 'Basteleur + Compagnon', display: 'Basteleur', text: 'Compagnon', note: 'Velvetyne: a moonlit display serif + an editorial typewriter-ish text face' },
  B: { name: 'Boska', display: 'Boska', text: 'Boska', note: 'Fontshare: sharp high-contrast serif, calligraphic italic' },
  C: { name: 'Zodiak', display: 'Zodiak', text: 'Zodiak', note: 'Fontshare: a Didone with bite, theatrical italics' },
  D: { name: 'Gambetta', display: 'Gambetta', text: 'Gambetta', note: 'Fontshare: warm bookish serif, legible small' },
  E: { name: 'Erode', display: 'Erode', text: 'Erode', note: 'Fontshare: rounder, friendlier, storybook warmth' },
  F: { name: 'Young Serif + Compagnon', display: 'Young Serif', text: 'Compagnon', note: 'Plissé’s own display face + Compagnon text' },
  G: { name: 'Basteleur + Sentient', display: 'Basteleur', text: 'Sentient', note: 'Velvetyne display + Fontshare Sentient text' },
  M: { name: 'Montserrat', display: 'Montserrat', text: 'Montserrat', note: 'ART_DIRECTION §24: all game UI (vendored, OFL; css/aloud.css)' }
};
export const FONT_IDS = Object.keys(FONT_SETS);

// where each family comes from (Velvetyne's are vendored: their @font-face rules live in css/agora.css)
const FONTSHARE = { Boska: 'boska@400,500,400i,500i', Zodiak: 'zodiak@400,700,400i', Gambetta: 'gambetta@400,500,400i,500i', Erode: 'erode@400,500,400i,500i', Sentient: 'sentient@400,500,400i' };
const GOOGLE = { 'Instrument Serif': 'Instrument+Serif:ital@0;1', 'Young Serif': 'Young+Serif' };

export const normFont = id => {
  if (id == null || id === '') return null;
  const s = String(id).trim();
  if (/^(now|current|default|instrument)$/i.test(s)) return 'now';
  const k = s.toUpperCase();
  return FONT_SETS[k] ? k : null;
};
// ?font=A in the page's URL (null when absent or unknown)
export const fontFromURL = () => { try { return normFont(new URLSearchParams(location.search).get('font')); } catch (_) { return null; } };

function link(id, href) {
  if (document.getElementById(id)) return;
  const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = href;
  document.head.append(l);
}
function loadFamilies(set) {
  const fams = [...new Set([set.display, set.text])];
  const fs = fams.filter(f => FONTSHARE[f]), g = fams.filter(f => GOOGLE[f]);
  if (fs.length) link('ag-fonts-fs-' + fs.join('-').toLowerCase(), 'https://api.fontshare.com/v2/css?' + fs.map(f => 'f[]=' + FONTSHARE[f]).join('&') + '&display=swap');
  if (g.length) link('ag-fonts-g-' + g.join('-').toLowerCase().replace(/\s+/g, ''), 'https://fonts.googleapis.com/css2?' + g.map(f => 'family=' + GOOGLE[f]).join('&') + '&display=swap');
}

// switch the whole UI to a set at once (the layout re-flows; open cards re-measure on document.fonts.ready)
export function setFont(id) {
  const k = normFont(id) || 'now';
  const set = FONT_SETS[k];
  loadFamilies(set);
  const root = document.documentElement;
  if (k === 'now') delete root.dataset.agFont; else root.dataset.agFont = k;
  return k;
}
export const currentFont = () => document.documentElement.dataset.agFont || 'now';

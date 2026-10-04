// Mock massing sketches (ARCHITECTURE §8): a deterministic handful of primitives per keyword family, in the
// Red arch palette, so the pencil underdrawing exists offline too. The client draws these as keylines at once.
// Same families as mock/codegen.js (pickFamily lives here so both agree).
import { SKETCH_PALETTE as P, normaliseSketch } from '../schemas.js';
import { requestNoun } from '../assets.js';

// Keyword families, most specific first. The first family whose test matches the request wins.
export const FAMILIES = [
  { id: 'lighthouse', test: /light\s*house|beacon|fener|deniz feneri|lamp tower/ },
  { id: 'rocket', test: /rocket|spaceship|space ship|shuttle|launch(er)?|roket|füze|fuze|capsule/ },
  { id: 'duck', test: /duck|ördek|ordek|goose|swan|kuğu|kugu|rubber/ },
  { id: 'dragon', test: /dragon|ejderha|ejder|griffin|wyvern|serpent|beast statue|lion statue|monster/ },
  { id: 'statue', test: /statue|monument|obelisk|memorial|heykel|anıt|anit|column|pillar|totem|idol|bust|figure/ },
  { id: 'boat', test: /boat|ship|sailboat|sail boat|galley|ferry|gondola|canoe|raft|tekne|gemi|kayık|kayik|yelkenli|vessel/ },
  { id: 'tree', test: /tree|oak|pine|cypress|palm|willow|baobab|ağaç|agac|çınar|cinar|sapling/ },
  { id: 'windclock', test: /wind[\s-]*clock|weather[\s-]*clock|clock[\s-]*mill|mill[\s-]*clock/ },
  { id: 'tower', test: /tower|keep|belfry|campanile|kule|minaret|spire|observatory|silo/ },
];
export function pickFamily(request = '', kindHint = '') {
  const t = `${request} ${kindHint}`.toLowerCase();
  for (const f of FAMILIES) if (f.test.test(t)) return f.id;
  return 'generic';
}

// "a giant rubber duck in the lake" -> scale 1.8; "a small boat" -> 0.7; otherwise 1.
export function sizeWord(request = '') {
  const t = String(request).toLowerCase();
  if (/\b(giant|enormous|huge|massive|colossal|gigantic|towering|dev|kocaman|devasa)\b/.test(t)) return 1.8;
  if (/\b(big|large|grand|tall|great|büyük|buyuk)\b/.test(t)) return 1.3;
  if (/\b(tiny|small|little|mini|wee|küçük|kucuk|minik)\b/.test(t)) return 0.7;
  return 1;
}

const box = (x, y, z, w, h, d, color, rot = 0) => ({ shape: 'box', x, y, z, w, h, d, r: 0, rot, color });
const cyl = (x, y, z, r, h, color, rot = 0) => ({ shape: 'cylinder', x, y, z, w: r * 2, h, d: r * 2, r, rot, color });
const cone = (x, y, z, r, h, color, rot = 0) => ({ shape: 'cone', x, y, z, w: r * 2, h, d: r * 2, r, rot, color });
const sph = (x, y, z, r, color) => ({ shape: 'sphere', x, y, z, w: r * 2, h: r * 2, d: r * 2, r, rot: 0, color });
const gable = (x, y, z, w, h, d, color, rot = 0) => ({ shape: 'gable', x, y, z, w, h, d, r: 0, rot, color });
const dome = (x, y, z, r, color) => ({ shape: 'dome', x, y, z, w: r * 2, h: r, d: r * 2, r, rot: 0, color });

// y is each part's centre height (ground y = 0), like the Build API primitives.
const SKETCHES = {
  lighthouse: () => ({ name: 'Lighthouse', category: 'landmark', parts: [
    cyl(0, 0.55, 0, 3.2, 1.1, P.stone),
    cyl(0, 2.35, 0, 1.9, 2.5, P.limestone),
    cyl(0, 7.45, 0, 1.25, 7.5, P.limestone),
    cyl(0, 5.6, 0, 1.42, 1.0, P.red), cyl(0, 8.6, 0, 1.27, 1.0, P.red),
    cyl(0, 11.6, 0, 1.6, 0.8, P.stone),
    cyl(0, 12.75, 0, 0.9, 1.5, P.gold),
    dome(0, 13.95, 0, 1.0, P.red),
    box(-2.75, 2.2, 0.2, 2.8, 2.2, 2.4, P.limestone), gable(-2.75, 3.78, 0.2, 2.8, 0.95, 2.4, P.terracotta),
  ] }),
  tower: () => ({ name: 'Tower', category: 'landmark', parts: [
    box(0, 0.25, 0, 3.2, 0.5, 3.2, P.stone), box(0, 3.75, 0, 2.6, 6.5, 2.6, P.limestone),
    box(0, 7.15, 0, 3.0, 0.3, 3.0, P.ink), box(0, 7.9, 0, 2.8, 1.2, 2.8, P.limestone), gable(0, 9.05, 0, 3.2, 1.1, 3.2, P.red),
  ] }),
  duck: () => ({ name: 'Rubber duck', category: 'prop', parts: [   // floats: y = 0 is the water line
    sph(0, 0.9, 0, 2.7, P.gold),                    // body (front = +z)
    sph(0, 1.25, 1.85, 1.9, P.gold),                // chest
    sph(0, 3.9, 1.85, 1.85, P.gold),                // head
    box(0, 3.3, 3.6, 1.9, 0.6, 2.1, P.terracotta),  // beak
    sph(0, 2.2, -3.1, 1.3, P.gold),                 // tail
  ] }),
  dragon: () => ({ name: 'Dragon statue', category: 'landmark', parts: [
    box(0, 0.225, 0, 5.6, 0.45, 5.6, P.stone), box(0, 0.675, 0, 4.8, 0.45, 4.8, P.stone),
    box(0, 1.65, 0, 3.9, 1.5, 3.9, P.limestone), box(0, 2.54, 0, 4.2, 0.28, 4.2, P.stone),
    box(0, 2.82, 1.35, 0.5, 0.25, 0.4, P.red),                    // (the panel, as a mark)
    cyl(0, 3.3, 0, 1.7, 1.1, P.teal),                             // the serpent coil
    cyl(0.4, 5.5, 0.6, 0.45, 2.9, P.teal),                        // the S neck
    sph(0.12, 7.1, 1.3, 0.65, P.teal), box(0.12, 7.05, 2.25, 0.55, 0.45, 1.3, P.teal),   // head, snout
    box(1.75, 6.2, 0.2, 2.6, 3.2, 0.15, P.teal, -0.45), box(-0.75, 6.2, 0.2, 2.6, 3.2, 0.15, P.teal, 0.45),   // wings
  ] }),
  statue: () => ({ name: 'Statue', category: 'landmark', parts: [
    box(0, 0.2, 0, 2.0, 0.4, 2.0, P.stone), box(0, 0.7, 0, 1.2, 0.6, 1.2, P.stone),
    cyl(0, 2.2, 0, 0.5, 2.4, P.limestone), sph(0, 3.7, 0, 0.5, P.limestone), cone(0, 4.5, 0, 0.3, 0.6, P.red),
  ] }),
  boat: () => ({ name: 'Boat', category: 'prop', parts: [
    box(0, 0.45, 0, 1.7, 0.9, 3.4, P.wood), box(0, 0.45, 1.95, 1.2, 0.9, 1.2, P.wood, Math.PI / 4), box(0, 0.45, -1.85, 1.0, 0.9, 1.0, P.wood, Math.PI / 4),
    box(0, 1.2, -0.9, 1.1, 0.6, 1.0, P.limestone), cyl(0, 2.8, 0.2, 0.07, 3.8, P.ink), box(0, 2.6, 0.4, 1.9, 2.6, 0.12, P.limestone),
  ] }),
  rocket: () => ({ name: 'Rocket', category: 'landmark', parts: [   // the rocket on its launch platform
    cyl(0, 1.85, 0, 6.6, 3.7, P.red),                             // the arcade
    cyl(0, 4.0, 0, 7.2, 0.6, P.limestone),                        // the deck
    box(0, 2.5, 9.3, 2.4, 3.0, 3.8, P.limestone),                 // the stair
    box(4.7, 10.6, -3.6, 2.0, 12.6, 2.0, P.limestone), cone(4.7, 17.9, -3.6, 1.6, 1.9, P.terracotta),   // the gantry
    cyl(0, 6.2, 0, 1.3, 0.9, P.red),                              // skirt
    cyl(0, 10.0, 0, 1.68, 7.0, P.cream),                          // hull
    cone(0, 16.9, 0, 1.55, 6.8, P.red),                           // nose
    box(0, 7.4, -2.3, 0.2, 5.0, 2.2, P.terracotta), box(2.0, 7.4, 1.15, 0.2, 5.0, 2.2, P.terracotta, Math.PI / 3), box(-2.0, 7.4, 1.15, 0.2, 5.0, 2.2, P.terracotta, -Math.PI / 3),   // fins
    sph(0, 11.35, 1.7, 0.4, P.ink),                               // a porthole
  ] }),
  windclock: () => ({ name: 'Wind clock', category: 'landmark', parts: [
    cyl(0, 0.25, 0, 2.9, 0.5, P.stone), cyl(0, 4.05, 0, 2.15, 7.1, P.limestone),
    cone(0, 8.9, 0, 2.35, 2.4, P.terracotta),
    box(0, 8.5, 2.7, 0.5, 8.0, 0.12, P.limestone), box(0, 8.5, 2.7, 8.0, 0.5, 0.12, P.limestone),
    box(0, 3.2, 2.3, 2.5, 2.5, 0.12, P.gold),
  ] }),
  tree: () => ({ name: 'Tree', category: 'nature', parts: [
    cyl(0, 1.9, 0, 0.6, 3.8, P.trunk), sph(0, 5.6, 0, 2.3, P.pine), sph(1.9, 4.7, 0.7, 1.6, P.olive), sph(-1.8, 4.9, -0.5, 1.5, P.olive), sph(0.3, 7.3, 0.2, 1.4, P.pine),
  ] }),
  generic: (request) => ({ name: titleCase(requestNoun(request) || 'Thing'), category: 'building', parts: [
    box(0, 1.4, 0, 3.4, 2.8, 3.0, P.limestone), gable(0, 3.4, 0, 3.8, 1.3, 3.4, P.terracotta), box(0, 0.6, 1.55, 0.7, 1.2, 0.1, P.ink),
  ] }),
};
const titleCase = (s) => String(s).replace(/\b\p{L}/gu, c => c.toUpperCase());

// A sketch for a request: family parts scaled by the size word, named after the request's noun.
export function mockSketch({ request = '', kindHint = '' } = {}) {
  const fam = pickFamily(request, kindHint);
  const s = SKETCHES[fam](request);
  const k = sizeWord(request);
  const noun = requestNoun(request);
  const name = noun ? titleCase(noun) : s.name;
  const parts = s.parts.map(p => ({ ...p, x: p.x * k, y: p.y * k, z: p.z * k, w: p.w * k, h: p.h * k, d: p.d * k, r: p.r * k }));
  return { ...normaliseSketch({ name, category: s.category, parts }, request), family: fam, scale: k };
}

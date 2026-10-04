// The three nations' towns on Sueda's Tower Planet (docs/planet.md "The nations' towns"). New code: her look modules
// and web/js/paint are only called, never edited.
//
//   const towns = createTowns({ planet, geo, adapter, ctx, api, folk, groundY, log });
//   await towns.build();          // imports the prefabs, builds the three towns, merges them, places their folk
//   towns.list / towns.get('n1') / towns.stats() / towns.dispose()
//
// Each town is laid out by hand for its real site (home.js NATION_SITES): the Drop Riviera's coral terraces on the
// headland above its cove, the Loaf Republic's sea-glass hill town climbing a spur to its campanile, the Puffer
// Harbour's yellow-and-grey quays round a pier on the island's sheltered basin. The architecture is the library's
// own prefabs (web/js/buildings/prefabs) and the starter lighthouse (buildings/examples), built through the Build API
// with a DYE: a thin wrapper over the api that turns the prefab's washes, roofs, red walls, stone and shutters into
// the nation's colourway (the prefab code itself is untouched). The built parts are then MERGED per material into a
// handful of meshes per town (about 20 draw calls a town), curved onto the sphere building by building; only the
// moving things (windmill sails) stay live. A few of the nation's own folk (folk.make.drop / loaf / puffer, pip,
// scoot) idle in each town: they stand, look about, and now and then walk to another spot on the square or the quay.
//
// Coordinates: a town is authored in its own LOCAL frame, metres, with the visit camera on the +z side looking toward
// -z (so the fronts of the houses, which face +z, face the visitor, and the painted light from the upper left falls
// the same way on every town). local -> her flat design space: offset R(yaw) (yaw = the camera's flat bearing, her
// cameraLocal convention: 0 = the camera south of the site), then home.js fromPlanet to the game's frame.
import { normalise, internals } from '../buildings/api.js';
import { toPlanet, fromPlanet, FRAME, NATION_SITES } from './home.js';
import { applyColourRule } from '../agents/colour-rule.js';

const PREFAB_BASE = new URL('../buildings/prefabs/', import.meta.url).href;
const EXAMPLE_BASE = new URL('../buildings/examples/', import.meta.url).href;
const ROT = FRAME.rot;
const SLIM = new Set(['windmill', 'campanile', 'tower', '@lighthouse']);

/* ======================= the colourways (ART: drop coral / terracotta, loaf sea-glass teal / white, puffer warm yellow / grey stone) ======================= */
export const TOWN_STYLES = {
  n1: {   // The Drop Riviera: coral and peach washes under terracotta, coral-red arcades, warm limestone, deep sea-teal shutters
    walls: ['#f7987a', '#fbc3a2', '#f07f63', '#f9d6c0', '#f4a98a'], wallLift: 0.34,
    accent: '#d9573f', shutter: '#2f6f86', stone: '#e6d3b3',
    roof: null,                                                           // her terracotta (RAMPS.TERRACOTTA)
    stoneRamp: null,                                                      // RAMPS.LIMESTONE
    accentRamp: ['#6e1f17', '#9c3424', '#c94a33', '#dc6447', '#e9805f']
  },
  n2: {   // The Loaf Republic: white and sea-glass washes, sea-glass teal roofs, domes and arcades, pale stone
    walls: ['#f6f2e8', '#d4eee6', '#f0f5ef', '#bde6db', '#f8f3e6'], wallLift: 0.42,
    accent: '#3a9e92', shutter: '#2b8a7a', stone: '#ebe5d6',
    roof: ['#1d4f4b', '#2a6d66', '#3a8f85', '#56aba0', '#7cc6ba'],
    stoneRamp: ['#9f9a8c', '#c3bdae', '#ddd7c8', '#ebe6d9', '#f6f2e8'],
    accentRamp: ['#1b4a45', '#256a62', '#33887d', '#4ea398', '#73bdb1']
  },
  n3: {   // The Puffer Harbour: warm yellow and cream washes, ochre-gold tiles, grey stone quays and trims, harbour-blue doors and arcades
    walls: ['#f6cd52', '#f4dc9c', '#f1bf3e', '#dcd5c7', '#f7d878'], wallLift: 0.36,
    accent: '#2f62d8', shutter: '#2f62d8', stone: '#b9b3a8',
    roof: ['#6e4614', '#9a661d', '#c68f2b', '#ddb042', '#ebc865'],
    stoneRamp: ['#6e6a63', '#8c877e', '#aaa59b', '#c2bdb2', '#d6d1c6'],
    accentRamp: ['#1d2f6e', '#25408f', '#2f52b0', '#4a6fc8', '#6f8fd8']
  }
};

/* ======================= the layouts (local metres; r = the building's turn, 0 = its front to the visitor) ======================= */
// b: [prefab id, x, z, r, variant, wall index]   x: + right as the visitor sees it, z: + toward the visitor
export const TOWN_LAYOUTS = {
  n1: {
    yaw: 0,   // the visitor stands over the cove, south of the headland
    view: { dist: 40, pitch: 0.82, look: [-2, -2] },
    b: [
      ['fountain', -1, -4, 0, 0, 0], ['market', -1.5, -8.5, 0, 0, 0], ['campanile', 4, -4, 0.25, 0, 2],
      ['house', -7.5, -5, 0.1, 0, 0], ['house', -5.5, 3, 0, 1, 1], ['house', -12.5, -9, -0.1, 2, 2],
      ['house', 0, 5.5, 0, 1, 4], ['house', 5, 4, -0.1, 2, 0],
      ['house', 10, 2.5, 0.1, 0, 1], ['house', 15, 1.5, 0.3, 2, 3], ['house', 9.5, -4.5, 0.4, 0, 4],
      ['house', 8.5, -21, 0.2, 0, 3], ['house', -21.5, 1.5, 0.2, 1, 4],
      ['windmill', -26.5, 10.5, 0.3, 0, 0]
    ],
    trees: [['cypress', -30, 7.5, 6], ['cypress', -15, 6, 5.5], ['pine', 4, -16, 6], ['pine', -12, -2, 5.5], ['olive', 15, -14, 3.4]],
    folk: { species: ['drop', 'drop', 'drop', 'drop', 'drop', 'drop'], spots: [[-4, -5], [-1, -1], [-4, -1], [1, 2], [-3, 2], [-6, -2]] }
  },
  n2: {
    yaw: -Math.PI / 4,   // the visitor stands over the plain to the south-west, the town climbing away up its spur
    view: { dist: 44, pitch: 0.8, look: [-5, -7] },
    b: [
      ['campanile', -6.5, -13, 0.2, 0, 0], ['house', -3, -1.5, 0.1, 0, 0], ['house', 4, -3, -0.2, 1, 1],
      ['house', 6, 3.5, 0.15, 2, 2], ['house', -4.5, 4.5, 0.25, 1, 3], ['house', 1, 3, -0.08, 0, 4],
      ['house', -7.5, -5.5, 0.32, 2, 1], ['house', -3, -9, 0.1, 0, 2], ['house', -11, -9.5, 0.55, 1, 3],
      ['house', -16.5, -8.5, 0.25, 0, 4], ['house', -14.5, -14, 0.3, 2, 0], ['house', -1.5, -14.5, 0.1, 1, 1],
      ['house', -13, -19, 0.25, 0, 2], ['house', 2, -10, -0.1, 2, 3], ['house', 6.5, -7, -0.2, 0, 0],
      ['market', 12, -3.5, -0.15, 0, 1], ['windmill', -20, -24, -0.07, 0, 0]
    ],
    trees: [['cypress', -8, -19, 6], ['cypress', 1.5, -14, 5.5], ['cypress', 9, 6, 5], ['olive', -10, 2, 3.4], ['olive', 12, 8, 3.2]],
    folk: { species: ['loaf', 'loaf', 'loaf', 'loaf', 'loaf', 'loaf'], spots: [[9, 3], [11, 1], [8.5, -0.5], [-2, 2], [3, 0], [-6, -2], [0, -6]] }
  },
  n3: {
    yaw: Math.PI / 2,   // the visitor stands over the open sea to the east, looking into the harbour basin
    view: { dist: 42, pitch: 0.82, look: [9, -1] },
    b: [
      ['pier', 15, 7.6, 0, 0, 0], ['canoe', 11, 6, 0.4, 0, 0], ['canoe', 20, 5, -0.3, 1, 0],
      ['canoe', 12, 10.5, 0.2, 2, 0], ['warehouse', 13, -4, 0, 0, 2], ['stalls', 3.5, -2.5, 0, 0, 0],
      ['house', 3, 3, Math.PI / 2, 0, 0], ['house', 3, 8, Math.PI / 2, 2, 2], ['house', -3.5, 0.5, 0.2, 1, 1],
      ['house', -3, 6, 0.1, 0, 3], ['house', 3, -7, 0.1, 1, 4], ['house', 8, -9.5, 0, 2, 3],
      ['house', 15, -10, 0.1, 1, 0], ['house', 22.5, -12.5, 0.1, 2, 0],
      ['house', -6, -6, 0.2, 1, 1], ['@lighthouse', 25.5, -4, 0, 0, 0]
    ],
    trees: [['pine', -6, -10, 6], ['cypress', 12, -16, 5], ['olive', -8, 1, 3.2]],
    folk: { species: ['puffer', 'puffer', 'pip', 'scoot', 'puffer', 'pip', 'scoot'], spots: [[10, 1], [6, 4], [21, 0], [18.5, 0.5], [7.5, 1.5], [0, 3], [6, 0.5]] }
  }
};

/* ======================= frames ======================= */
// local (x, z) of a town -> her flat design space -> the game frame
export function localToFlat(site, yaw, lx, lz, out = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  out.fx = site.fx + lx * c + lz * s; out.fz = site.fz - lx * s + lz * c;
  return out;
}
export function localToGame(site, yaw, lx, lz, out = {}) { const f = localToFlat(site, yaw, lx, lz, {}); return fromPlanet(f.fx, f.fz, out); }
// a building's turn in the town frame -> its rot in the game frame (adapter.place's rot)
export const gameRot = (yaw, r = 0) => yaw + r + ROT;
// the visit camera, in the game's cameraLocal terms (yaw 0 = camera on the game's +z side), for stages' nationPose
export function visitView(id) {
  const L = TOWN_LAYOUTS[id]; if (!L) return null;
  return { dist: L.view.dist, pitch: L.view.pitch, yaw: L.yaw + ROT, fov: 50 };
}

/* ======================= the dye: the Build API in a nation's colourway ======================= */
const PART_FNS = ['box', 'cylinder', 'cone', 'sphere', 'lathe', 'extrude', 'tube', 'torus', 'gableRoof', 'hipRoof', 'dome', 'archWall', 'archOpening',
  'inkWindow', 'inkDoor', 'window', 'door', 'column', 'columns', 'stairs', 'fence', 'wheel', 'blade', 'sail', 'flag', 'crate', 'barrel', 'pot', 'shrub',
  'pine', 'kitPine', 'cypress', 'bush', 'tree', 'olive', 'oak', 'lemon', 'path', 'road', 'wall', 'patch', 'stripes'];
const hslOf = h => { const o = {}; new THREE.Color(h).getHSL(o); return o; };

export function dyeApi(api, style, k = 0, variant = 0) {
  const R0 = api.ramps, ramps = { ...R0 };
  const set = (names, r) => { if (r) for (const n of names) ramps[n] = r; };
  set(['TERRACOTTA', 'TERRA'], style.roof);
  set(['REDWALL', 'BRICK'], style.accentRamp);
  set(['LIMESTONE', 'STONE'], style.stoneRamp);
  const wallRamp = api.ramp(style.walls[k % style.walls.length]);
  set(['WHITEWASH', 'CREAM', 'WHITE'], wallRamp);
  Object.freeze(ramps);
  const washes = new Map();
  // a hex as the prefab wrote it -> the nation's: pale washes take the town's walls (each distinct wash in one
  // building its own, so a two-tone house stays two-tone), beige limestone its stone, the Red arch red its accent
  function hex(h) {
    if (typeof h !== 'string' || h[0] !== '#') return h;
    const { h: H, s: S, l: L } = hslOf(h);
    const stoney = L > 0.7 && L < 0.87 && S > 0.25 && S < 0.6 && H > 0.08 && H < 0.14;
    if (stoney) return style.stone;
    const pale = L > 0.72 && !(H > 0.2 && H < 0.55 && S > 0.2);       // washes and creams, never a pale green / blue
    const ochreWash = H > 0.07 && H < 0.13 && S > 0.45 && L > 0.5 && L <= 0.72;   // the granary's ochre, the tavern's saffron
    if (pale || ochreWash) { if (!washes.has(h)) washes.set(h, style.walls[(k + washes.size) % style.walls.length]); return washes.get(h); }
    if ((H < 0.035 || H > 0.97) && S > 0.45 && L > 0.3 && L < 0.6) return style.accent;
    return h;
  }
  const str = v => (typeof v === 'string' ? (R0[v.toUpperCase()] ? ramps[v.toUpperCase()] : hex(v)) : v);
  const col = v => (Array.isArray(v) ? (Object.keys(R0).find(n => R0[n] === v) ? ramps[Object.keys(R0).find(n => R0[n] === v)] : v) : str(v));
  const hasColour = o => o && (o.ramp != null || o.color != null || o.colour != null || o.mat != null || o.material != null);
  function opts(name, o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
    const r = { ...o };
    for (const key of ['ramp', 'color', 'colour']) if (r[key] != null) r[key] = col(r[key]);
    if (r.shutters) r.shutters = style.shutter;
    if ((name === 'gableRoof' || name === 'hipRoof') && !hasColour(o)) r.ramp = ramps.TERRACOTTA;
    if (name === 'archWall' && !hasColour(o)) r.ramp = ramps.REDWALL;
    if (name === 'wall' && !hasColour(o)) r.mat = api.lambert(hex('#e3d2b4'), 0.2);
    if ((name === 'inkDoor' || name === 'door' || name === 'inkWindow' || name === 'window' || name === 'archOpening') && o.frame === undefined) r.frame = ramps.LIMESTONE;
    return r;
  }
  const d = { ...api, ramps };
  for (const n of PART_FNS) if (typeof api[n] === 'function') d[n] = o => api[n](opts(n, o));
  // the washes get a little more of their own colour back (lift) so they stay warm in her shade, as the prefab's whitewash does
  d.lambert = (h, lift) => { const m = hex(h); return api.lambert(m, style.walls.includes(m) ? Math.max(lift ?? 0.22, style.wallLift || 0.3) : lift); };
  d.ramp = h => api.ramp(hex(h));
  d.mesh = (geo, m, o) => api.mesh(geo, m && m.isMaterial ? m : col(m), o);
  d.paint = (geo, r, o) => api.paint(geo, col(r), o);
  d.variant = () => variant;
  return Object.freeze(d);
}

/* ======================= merging ======================= */
const _m3 = new THREE.Matrix3();
function mergeBucket(list, withColour) {
  let n = 0;
  const geos = list.map(({ geo, m }) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m);
    n += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), colA = withColour ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
    nrm.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (colA) { if (g.attributes.color && g.attributes.color.itemSize === 3) colA.set(g.attributes.color.array.subarray(0, c * 3), o * 3); else colA.fill(1, o * 3, (o + c) * 3); }
    o += c; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (colA) out.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

/* ======================= the towns ======================= */
export function createTowns({ planet, geo, adapter, ctx, api, folk = null, groundY = null, log = () => {} } = {}) {
  const I = internals(api);
  const gY = groundY || ((x, z) => adapter.groundY(x, z));
  const towns = [];
  const mods = new Map();
  const live = [];          // { obj, mod } animated prefabs kept whole (windmill sails)
  const people = [];        // { a, town, spots, cur, t, kind }
  const freeP = new Set();
  let unhook = null, built = false, T = 0;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  async function loadMod(id) {
    if (mods.has(id)) return mods.get(id);
    let mod = null;
    try {
      if (id[0] === '@') {   // a starter-library asset (buildings/examples/<name>.js: generated-code form, `function build(api)`)
        const code = await (await fetch(EXAMPLE_BASE + id.slice(1) + '.js')).text();
        const fn = new Function('api', "'use strict';" + code + '\nreturn build(api);');
        mod = { build: fn, meta: {} };
      } else mod = await import(PREFAB_BASE + id + '.js');
    } catch (e) { log('towns: no prefab', id, e.message); }
    mods.set(id, mod);
    return mod;
  }

  // the ground under a turned footprint (game coordinates): lowest and highest of 9 samples
  function groundSpan(gx, gz, rot, fp) {
    const hw = fp.w / 2, hd = fp.d / 2, c = Math.cos(rot), s = Math.sin(rot);
    let lo = Infinity, hi = -Infinity;
    for (const [u, v] of [[0, 0], [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, -hd], [0, hd], [-hw, 0], [hw, 0]]) {
      const y = gY(gx + c * u + s * v, gz - s * u + c * v); lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return { lo, hi };
  }

  function buildOne(town, entry, i) {
    const [id, lx, lz, r = 0, variant = 0, k = 0] = entry;
    const mod = mods.get(id); if (!mod) return null;
    const style = TOWN_STYLES[town.id];
    const d = dyeApi(api, style, k, variant);
    api.seed(hash(`${town.id}:${id}:${i}`) || 1);
    I.setVariant(variant);
    let wrap;
    try { wrap = normalise(api, mod.build(d), { name: id, turn: r }); }
    catch (e) { log('towns: build failed', id, e.message); return null; }
    finally { I.setVariant(0); }
    const size = wrap.userData.agora.size, floats = !!wrap.userData.agora.floats;
    const g = localToGame(town.site, town.yaw, lx, lz, {});
    const rot = gameRot(town.yaw, 0);
    // the ground under its footprint (the prefab's own, turned with it: porches, shrubs and sails don't count)
    const mf = (mod.meta && mod.meta.footprint) || { w: Math.min(size.w, 6), d: Math.min(size.d, 6) };
    const fp = { w: Math.min(mf.w, size.w + 0.2), d: Math.min(mf.d, size.d + 0.2) };
    const { lo, hi } = groundSpan(g.x, g.z, rot + r, fp);
    const holder = new THREE.Group();
    holder.add(wrap);
    let base;
    if (floats) base = 0;
    else {
      // built into the slope: the uphill side sinks a little into the hill, the downhill side stands on a stone
      // terrace (a podium in the nation's stone) - the headland's and the hill town's terraces
      const rel = hi - lo, slim = SLIM.has(id);   // a round tower or a slim shaft just stands deeper in its slope
      base = slim ? Math.max(lo + 0.2 * rel, hi - 3.2) : Math.max(lo + 0.45 * rel, hi - 1.6);
      const drop = base - lo;
      if (drop > 0.18) {
        const H = drop + 1.2, pad = 0.4;   // its foot well into the ground, so a steep fall beside it never shows a floating slab
        const podium = api.box({ w: fp.w + pad, h: H, d: fp.d + pad, y: -H / 2 + 0.05, rot: r, mat: api.lambert(style.stone, 0.2) });
        holder.add(podium);
        holder.add(api.box({ w: fp.w + pad + 0.24, h: 0.16, d: fp.d + pad + 0.24, y: 0.0, rot: r, ramp: style.stoneRamp || api.ramps.LIMESTONE, lift: 0.06 }));
      }
    }
    adapter.place(holder, g.x, g.z, { rot, y: base, parent: null });
    holder.updateMatrixWorld(true);
    town.obstacles.push({ x: g.x, z: g.z, r: Math.hypot(fp.w, fp.d) / 2 * 0.85 + 0.45 });   // folk walk round it
    return { id, holder, wrap, mod, base, lo, hi, x: g.x, z: g.z, size, animated: typeof mod.animate === 'function' && id === 'windmill' };
  }

  function buildTree(town, [kind, lx, lz, h]) {
    const d = dyeApi(api, TOWN_STYLES[town.id], 0, 0);
    api.seed(hash(`${town.id}:${kind}:${lx}:${lz}`) || 1);
    let wrap;
    try {
      const g = d.group();
      if (kind === 'cypress') g.add(d.cypress({ h }));
      else if (kind === 'pine') g.add(d.pine({ h }));
      else g.add(d.olive({ h }));
      wrap = normalise(api, g, { name: kind });
    } catch (e) { log('towns: tree failed', kind, e.message); return null; }
    const p = localToGame(town.site, town.yaw, lx, lz, {});
    const holder = new THREE.Group(); holder.add(wrap);
    adapter.place(holder, p.x, p.z, { rot: gameRot(town.yaw, 0), y: gY(p.x, p.z) - 0.15, parent: null });
    holder.updateMatrixWorld(true);
    return { holder };
  }

  // every mesh of the town's buildings -> a few merged meshes in the town root's frame (per material and role)
  function mergeTown(town, items) {
    const root = town.root;
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    let parts = 0;
    for (const it of items) {
      it.holder.updateMatrixWorld(true);
      it.holder.traverse(o => {
        if (!o.isMesh || o.userData.agoraSketch) return;
        const line = !!o.userData.agoraLine;
        if (!line) { let vis = true; for (let p = o; p && p !== it.holder; p = p.parent) if (!p.visible) { vis = false; break; } if (!vis) return; }
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        if (o.isInstancedMesh) {   // instanced leaves: keep the instances, hang them on the root
          const c = o.clone(); c.matrixAutoUpdate = false; c.matrix.copy(m); root.add(c); parts++;
          if (o.userData.agoraColour) ctx.colourOnly.push(c);
          return;
        }
        const role = line ? 'line' : o.userData.agoraColour ? 'colour' : 'solid';
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        const key = (line ? 'proxy' : mat.uuid) + '|' + role + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
        if (!buckets.has(key)) buckets.set(key, { mat, role, cast: o.castShadow, receive: o.receiveShadow, list: [] });
        buckets.get(key).list.push({ geo: o.geometry, m });
        parts++;
      });
    }
    const proxyMat = new THREE.MeshBasicMaterial();
    let draws = 0;
    for (const b of buckets.values()) {
      const geo = mergeBucket(b.list, b.role !== 'line' && !!(b.mat && b.mat.vertexColors));
      const mesh = new THREE.Mesh(geo, b.role === 'line' ? proxyMat : b.mat);
      mesh.castShadow = b.role === 'line' ? false : b.cast; mesh.receiveShadow = b.receive;
      mesh.userData.planetWorld = true; mesh.userData.town = town.id;
      if (b.role === 'line') { mesh.visible = false; mesh.userData.agoraLine = true; ctx.lineOnly.push(mesh); }
      else if (b.role === 'colour') { mesh.userData.agoraColour = true; ctx.colourOnly.push(mesh); draws++; }
      else draws++;
      root.add(mesh);
      town.merged.push(mesh);
    }
    town.parts = parts; town.draws = draws;
  }

  /* ---- the folk of the town ---- */
  function addFolk(town, L) {
    if (!folk || !L.folk) return;
    const spots = L.folk.spots.map(([lx, lz]) => localToGame(town.site, town.yaw, lx, lz, {})).filter(p => clearAt(town, p.x, p.z, 0.4));
    if (!spots.length) return;
    const counts = {};
    L.folk.species.forEach((sp, i) => {
      if (!folk.make[sp]) return;
      counts[sp] = (counts[sp] || 0) + 1;
      let a;
      try { a = folk.make[sp](hash(town.id + sp) % 7 + counts[sp]); } catch (e) { log('towns: folk', sp, e.message); return; }
      a.controlled = true; a.path = []; a.wait = 1e6;
      if (sp === 'pip' || sp === 'puffer') { try { applyColourRule({ a, id: `${town.id}:${sp}:${i}` }, folk); } catch (_) {} }
      const s0 = spots[i % spots.length];
      const jx = ((hash(town.id + i) % 100) / 100 - 0.5) * 1.2, jz = ((hash(i + town.id) % 100) / 100 - 0.5) * 1.2;
      a.pos.set(s0.x + jx, 0, s0.z + jz);
      if (a.from) a.from.copy(a.pos); if (a.to) a.to.copy(a.pos);
      a.root.position.copy(a.pos);
      a.heading = gameRot(town.yaw, 0) + ((hash('h' + i) % 100) / 100 - 0.5) * 1.6;   // mostly toward the visitor
      a.placed = false; a.legsPlaced = false;
      if (a.blob) a.blob.visible = true;
      freeP.add(a.pos); if (a.to) freeP.add(a.to);
      // its spots: the nearest few on the square / quay
      const near = spots.map((p, j) => ({ p, j, d: Math.hypot(p.x - s0.x, p.z - s0.z) })).sort((u, v) => u.d - v.d).slice(0, 4).map(o => o.p);
      people.push({ a, sp, town, spots: near, cur: 0, t: 3 + (hash('t' + i + town.id) % 900) / 100 });
      town.folk.push(a);
    });
  }
  // the nation's folk may stand anywhere on the planet: the plot's bounds (nav.bounds) must not pull them home
  function unbindNav() {
    if (!folk || !folk.nav) return;
    const nav = folk.nav, ob = nav.bounds;
    nav.bounds = p => { if (!freeP.has(p)) ob.call(nav, p); };
  }
  // is a point (with a margin) clear of the town's buildings? does a straight walk between two points stay clear?
  function clearAt(town, x, z, m = 0) { for (const o of town.obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + m) return false; return true; }
  function clearWalk(town, a, b) {
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
    for (let i = 1; i <= n; i++) { const t = i / n; if (!clearAt(town, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.2)) return false; }
    return true;
  }
  function idle(dt) {
    for (const f of people) {
      const a = f.a;
      f.t -= dt;
      if (f.t > 0 || (a.path && a.path.length)) continue;
      // walk to one of its other spots (a short stroll), or just turn and look about
      const go = f.spots.length > 1 && ((hash(f.town.id + T.toFixed(0) + f.sp) % 100) < 65);
      if (go) {
        for (let k = 1; k < f.spots.length; k++) {   // the next spot it can walk to without going through a house
          const j = (f.cur + k + (hash(String(T)) % f.spots.length)) % f.spots.length; if (j === f.cur) continue;
          const p = f.spots[j], o = ((hash('o' + T) % 100) / 100 - 0.5) * 1.2, q = { x: p.x + o, z: p.z - o };
          if (!clearAt(f.town, q.x, q.z, 0.3) || !clearWalk(f.town, a.pos, q)) continue;
          f.cur = j; a.path = [V(q.x, 0, q.z)]; a.wait = 0; break;
        }
      }
      f.t = 6 + (hash(f.sp + T) % 1000) / 100;
    }
  }
  // folk.js walks everyone on y = 0: stand ours on the drawn ground (root, legs and shadow together), each frame
  function lift() {
    for (const f of people) {
      const a = f.a, gy = gY(a.pos.x, a.pos.z) || 0;
      a.root.position.y += gy;
      (a.legs || []).forEach(l => { l.leg.position.y += gy; l.foot.position.y += gy; });
      if (a.blob) { a.blob.position.y += gy; a.blob.visible = true; }
    }
  }

  async function build() {
    if (built) return api_;
    built = true;
    const t0 = performance.now();
    const ids = new Set();
    for (const L of Object.values(TOWN_LAYOUTS)) L.b.forEach(e => ids.add(e[0]));
    await Promise.all([...ids].map(loadMod));
    for (const site of NATION_SITES) {
      const L = TOWN_LAYOUTS[site.id]; if (!L) continue;
      const town = { id: site.id, name: site.name, site, yaw: L.yaw, root: new THREE.Group(), merged: [], folk: [], live: [], skipped: [], info: [], obstacles: [] };
      town.root.name = 'town-' + site.id;
      const c = localToGame(site, L.yaw, 0, 0, {});
      adapter.place(town.root, c.x, c.z, { rot: gameRot(L.yaw, 0), y: gY(c.x, c.z), parent: planet.surface });
      const items = [];
      L.b.forEach((e, i) => {
        const it = buildOne(town, e, i);
        if (!it) { town.skipped.push(e[0]); return; }
        if (it.animated) {   // keep it whole so its sails turn
          const inv = new THREE.Matrix4().copy(town.root.matrixWorld).invert();
          it.holder.applyMatrix4(inv); town.root.add(it.holder); I.register(it.holder);
          it.holder.traverse(o => { o.userData.planetWorld = true; });
          live.push({ obj: it.wrap, mod: it.mod }); town.live.push(it.holder);
        } else items.push(it);
        town.info.push({ id: it.id, x: +it.x.toFixed(1), z: +it.z.toFixed(1), lo: +it.lo.toFixed(2), hi: +it.hi.toFixed(2), base: +it.base.toFixed(2) });
      });
      (L.trees || []).forEach(tr => { const it = buildTree(town, tr); if (it) items.push(it); });
      mergeTown(town, items);   // (the unmerged parts were never drawn: nothing on the GPU to free, the GC takes them)
      // the nation's visit camera frames the town (stages.visitNation reads n.view)
      const n = geo && geo.placeById && geo.placeById(site.id);
      if (n) {
        // aim the visit at the heart of the town (its square, its quay), not the bare site point the search found
        if (!n.site) n.site = { x: n.x, z: n.z, fx: n.fx, fz: n.fz };
        const [ax, az] = L.view.look || [0, 0], f = localToFlat(site, L.yaw, ax, az, {}), g = fromPlanet(f.fx, f.fz, {});
        Object.assign(n, { x: +g.x.toFixed(1), z: +g.z.toFixed(1), fx: f.fx, fz: f.fz, view: visitView(site.id), town: town.root.name });
      }
      addFolk(town, L);
      towns.push(town);
    }
    unbindNav();
    unhook = planet.renderHook({
      beforeRender(dt) {
        const d = Math.min(0.1, dt || 0.016); T += d;
        idle(d); lift();
        for (const l of live) { try { l.mod.animate(l.obj, T); } catch (_) {} }
      }
    });
    buildMs = Math.round(performance.now() - t0);
    log('towns built', stats());
    return api_;
  }
  let buildMs = 0;

  function stats() {
    return { ms: buildMs, towns: towns.map(t => ({ id: t.id, draws: t.draws, parts: t.parts, live: t.live.length, folk: t.folk.length, skipped: t.skipped })) };
  }
  function dispose() {
    if (unhook) unhook();
    for (const t of towns) {
      for (const m of t.merged) { const i = ctx.lineOnly.indexOf(m); if (i >= 0) ctx.lineOnly.splice(i, 1); const j = ctx.colourOnly.indexOf(m); if (j >= 0) ctx.colourOnly.splice(j, 1); m.geometry.dispose(); }
      t.live.forEach(h => I.unregister(h));
      if (t.root.parent) t.root.parent.remove(t.root);
      if (folk) t.folk.forEach(a => { try { folk.remove(a); } catch (_) {} });
    }
    towns.length = 0; people.length = 0; live.length = 0;
  }
  const api_ = { build, stats, dispose, get list() { return towns; }, get: id => towns.find(t => t.id === id) || null, people, layouts: TOWN_LAYOUTS, styles: TOWN_STYLES };
  return api_;
}

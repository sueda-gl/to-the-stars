// The fine ground patch under our home region (docs/game.md "The planet in the game", ART_DIRECTION §12).
// Sueda's sphere is a 420 x 280 lat-long mesh, about 1.9 m per vertex at home: close up (the landing at ~20 m, the
// fleet visits at ~10 m) its triangle interpolation shows as stair-stepped pale stripes. This lays a finer local
// patch (0.6 m cells) over the home region: HER height function (terrain.js H = build.js's heightCore per vertex),
// HER ground material, HER per-vertex attributes computed by her own formulas (build.js lines 79-135: aW / aG / aRS /
// colour from the normal's slope, the height and her noises). At the patch's border its heights blend into her
// drawn sphere over `blend` metres, so there is no seam; under the patch her sphere is sunk by up to `sink` metres
// (it is covered, so nothing of her look changes, and the patch never z-fights). From orbit nothing changes.
//
// It also answers the adapter's "drawn ground" contract (createDrawnGround: alt / altAlong / normal / wat / cover), so
// createPlanetGeography({ drawn }) and createSurfaceAdapter({ drawn }) read the fine heights where the patch is and
// her sphere's elsewhere: folk feet, buildings, the lake, picks and camera all agree with what is drawn.
//
//   const fine = createFineGround(planet, { x0, x1, z0, z1, step, blend, sink });   // region in GAME coords
//   fine.alt(fx, fz) ...  (drawn-ground API)   fine.mesh   fine.region   fine.inside(x, z)
import { RP, mapFlat, H, worldToFlat } from '../planet/terrain.js';
import { fbm, vnoise, smooth } from '../planet/context.js';
import { createDrawnGround } from '../planet/adapter.js';
import { toPlanet, fromPlanet } from '../planet/home.js';

export function createFineGround(planet, { x0 = -92, x1 = 92, z0 = -92, z1 = 92, step = 0.6, blend = 12, sink = 1.2, sinkFrom = 2.5, sinkTo = 10 } = {}) {
  const base = createDrawnGround(planet);
  const region = { x0, x1, z0, z1 };
  // how far inside the region's border a game point is (negative outside)
  const inside = (x, z) => Math.min(x - x0, x1 - x, z - z0, z1 - z);
  const _g = {}, _p = {}, _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();

  // the fine altitude at a planet-flat point: her H (sea at 0), blended into her drawn sphere at the border
  function alt(fx, fz) {
    fromPlanet(fx, fz, _g);
    const d = inside(_g.x, _g.z);
    if (d <= 0) return base.alt(fx, fz);
    const h = Math.max(0, H(fx, fz));
    if (d >= blend) return h;
    const w = smooth(0, blend, d);
    return base.alt(fx, fz) * (1 - w) + h * w;
  }
  function altAlong(v) { worldToFlat(v, _p); return alt(_p.x, _p.z); }
  function normal(fx, fz, out = new THREE.Vector3()) {
    fromPlanet(fx, fz, _g);
    if (inside(_g.x, _g.z) <= 0) return base.normal(fx, fz, out);
    const e = 0.4;
    mapFlat(fx + e, alt(fx + e, fz), fz, _a).sub(mapFlat(fx - e, alt(fx - e, fz), fz, _b));
    mapFlat(fx, alt(fx, fz + e), fz + e, _c).sub(mapFlat(fx, alt(fx, fz - e), fz - e, _d));
    out.crossVectors(_c, _a).normalize();
    mapFlat(fx, 0, fz, _v);
    if (out.dot(_v) < 0) out.negate();
    return out;
  }

  /* ---- the patch mesh: a grid in game coords, every vertex through toPlanet + mapFlat, her attributes ---- */
  const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1, n = nx * nz;
  const pos = new Float32Array(n * 3), hs = new Float32Array(n);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = x0 + i * step, z = z0 + j * step;
    toPlanet(x, z, _p);
    const h = H(_p.fx, _p.fz);                     // her raw height: the sea is negative (aW = depth)
    hs[k] = h;
    mapFlat(_p.fx, alt(_p.fx, _p.fz), _p.fz, _v);
    pos[k * 3] = _v.x; pos[k * 3 + 1] = _v.y; pos[k * 3 + 2] = _v.z;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    // the same winding as the sphere seen from outside (checked against the radial below)
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  {  // winding check: the face normals must point out of the planet
    const nr = g.attributes.normal, k = Math.floor(n / 2);
    _v.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).normalize();
    if (nr.getX(k) * _v.x + nr.getY(k) * _v.y + nr.getZ(k) * _v.z < 0) {
      for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
      g.index.needsUpdate = true; g.computeVertexNormals();
    }
  }
  // her per-vertex paint (build.js 103-115), from the patch's own normals
  const nr = g.attributes.normal;
  const aW = new Float32Array(n), aG = new Float32Array(n), aRS = new Float32Array(n * 2), cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], h = hs[i];
    const len = Math.hypot(x, y, z), dx = x / len, dy = y / len, dz = z / len;
    if (h < 0) { aW[i] = -h; aG[i] = 0; continue; }
    const gt = fbm(dx * 9, dy * 9 + 2, dz * 9, 3), warm = smooth(.55, .75, vnoise(dx * 5, dy * 5 + 7, dz * 5)) * 0.45;
    const slope = nr.getX(i) * dx + nr.getY(i) * dy + nr.getZ(i) * dz;
    const rk = smooth(0.94, 0.70, slope) * smooth(5, 14, h);
    const sn = smooth(31, 46, h + (vnoise(dx * 30, dy * 30, dz * 30) - .5) * 7) * smooth(.40, .86, slope);
    const sd = smooth(1.3, 0.65, h);
    cols[i * 3] = gt; cols[i * 3 + 1] = warm; cols[i * 3 + 2] = sd; aRS[i * 2] = rk; aRS[i * 2 + 1] = sn;
    aW[i] = -1; aG[i] = (1 - rk) * (1 - sn) * (1 - sd);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('aW', new THREE.BufferAttribute(aW, 1));
  g.setAttribute('aG', new THREE.BufferAttribute(aG, 1));
  g.setAttribute('aRS', new THREE.BufferAttribute(aRS, 2));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, planet.world.ground.material);
  mesh.name = 'home-fine-ground'; mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.userData.planetWorld = true;
  planet.surface.add(mesh);

  /* ---- sink her sphere under the patch (covered: invisible; her mesh outside the region is untouched) ---- */
  {
    const P = planet.world.ground.geometry.attributes.position;
    let sunk = 0;
    for (let i = 0; i < P.count; i++) {
      _v.set(P.getX(i), P.getY(i), P.getZ(i));
      worldToFlat(_v, _p); fromPlanet(_p.x, _p.z, _g);
      const d = inside(_g.x, _g.z);
      if (d <= sinkFrom) continue;
      const k = sink * smooth(sinkFrom, sinkTo, d), r = _v.length();
      _v.multiplyScalar((r - k) / r);
      P.setXYZ(i, _v.x, _v.y, _v.z); sunk++;
    }
    P.needsUpdate = true;
    mesh.userData.sunkVertices = sunk;
  }

  return {
    SW: base.SW, SH: base.SH, geometry: base.geometry, base, mesh, region, step, blend, sink, inside,
    alt, altAlong, normal,
    wat: (fx, fz) => base.wat(fx, fz), cover: (fx, fz) => base.cover(fx, fz),
    // the game-coordinate height (the facade's groundY): the fine ground where the patch is
    groundY(x, z) { toPlanet(x, z, _p); return alt(_p.fx, _p.fz); },
    stats() { return { vertices: n, triangles: idx.length / 3, sunk: mesh.userData.sunkVertices, region, step }; }
  };
}

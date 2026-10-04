// The neighbours on the horizon: the three nations stand where the shared layout puts them (geography.js
// places.nations, = the sim's neighbour positions), on their headlands and the island across the bay, fully
// built and coloured. They are built with the globe's own town kit (globe/towns.js, imported read-only), so a
// dive from orbit lands on the same town; if that module is unavailable a plain massing in each nation's
// colourway stands in (teal / white, coral / terracotta, pistachio / lemon towers).

export async function buildNeighbours(ctx, kit, ground, geo, { parent = ctx.scene, scale = 1 } = {}) {
  const group = new THREE.Group(); group.name = 'neighbours'; parent.add(group);
  const C = geo.GEO.C;
  let towns = null;
  try { towns = await import('../globe/towns.js'); } catch (e) { console.warn('world: globe/towns.js unavailable, using plain massing', e); }
  const T = towns && towns.createTownKit ? towns.createTownKit(ctx, kit) : null;
  const out = [];
  for (const n of geo.places.nations) {
    let g = null;
    if (T && towns.buildNation) {
      try { g = towns.buildNation(ctx, kit, T, n.style, n.colours).group; } catch (e) { console.warn('world: buildNation failed for', n.id, e); g = null; }
    }
    if (!g) g = plainTown(ctx, n);
    g.name = 'nation-' + n.id;
    g.position.set(n.x, ground.groundY(n.x, n.z), n.z);
    g.rotation.y = Math.atan2(C.x - n.x, C.z - n.z);   // the town's front (+z) faces our plot
    g.scale.setScalar(scale);
    group.add(g);
    out.push({ id: n.id, name: n.name, group: g, x: n.x, z: n.z, y: g.position.y, colours: n.colours, style: n.style });
  }
  return { group, nations: out };
}

// plain painted massing in a nation's colourway (only if the globe's town kit can't be loaded)
function plainTown(ctx, n) {
  const g = new THREE.Group(), lam = {}, L = h => lam[h] || (lam[h] = new THREE.MeshLambertMaterial({ color: ctx.col(h) }));
  const { wall, accent, stone } = n.colours;
  const box = (w, h, d, c, x, z, y = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(c)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  box(36, 3, 28, stone, 0, 0, -3);
  const spec = n.style === 'skyhold'
    ? [[4.4, 22, 4.4, wall, 0, -2], [3.4, 15, 3.4, accent, -8, 3], [3.4, 17, 3.4, wall, 8, 2], [3, 12, 3, wall, -10, -8], [3, 13, 3, accent, 11, -8]]
    : n.style === 'loaf'
      ? [[6, 4, 10, stone, 0, 0], [6, 3.4, 6, wall, -9, -4], [5, 3.4, 8, stone, 8, -5], [3.4, 11, 3.4, stone, -4, -10], [14, 4.6, 1.2, stone, 0, 9.5]]
      : [[6, 5, 5, wall, -4, 2], [3.6, 14, 3.6, accent, 2, -6], [5, 4.2, 4.5, accent, 6, 3], [5.5, 6, 5, wall, -7, -6], [12, 4.4, 1, accent, -2, 9.6]];
  for (const [w, h, d, c, x, z] of spec) box(w, h, d, c, x, z);
  return g;
}

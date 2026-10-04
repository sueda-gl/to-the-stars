// The folk's walkable world on our plot: the paint engine's nav seam (docs/paint.md) implemented for the map.
// Wander inside the plot, round the lake and the buildings. nav.obstacles is OUR array, rebuilt in place from
// the game's buildings on every site / design / remove event (the folk read it live every frame).

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function distToPoly(x, z, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}

// makeNav(game, world, { margin }) -> nav for createFolk(ctx, backdrop, nav)
export function makeNav(game, world, { margin = 1.2 } = {}) {
  const ctx = world.ctx, { R, V } = ctx, rnd = ctx.rnd;
  const st = game.state, P = st.plot;
  const lakes = () => st.water.filter(w => w.kind === 'lake' && w.poly && w.poly.length > 2).map(w => w.poly);
  const lakeInfo = () => lakes().map(poly => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, cx = 0, cz = 0;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); cx += x; cz += z; }
    return { poly, x0, x1, z0, z1, cx: cx / poly.length, cz: cz / poly.length, r: Math.max(x1 - x0, z1 - z0) / 2 };
  });
  let LAKES = lakeInfo();

  const obstacles = [];
  function rebuildObstacles() {
    obstacles.length = 0;
    // the plot trees that grow round finished buildings: walk round their trunks
    const pt = world.scenery && world.scenery.plot ? world.scenery.plot.trees : [];
    for (const t of pt) obstacles.push([t.x, t.z, 0.55 + 0.25 * (t.s || 1)]);
    for (const b of st.buildings) {
      if (b.status === 'removed') continue;
      const w = b.footprint.w, d = b.footprint.d, c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
      // a rectangle as a few circles along its long side
      const long = Math.max(w, d), short = Math.min(w, d), along = w >= d ? [c, -s] : [s, c];
      const n = Math.max(1, Math.round(long / Math.max(1.5, short)));
      const r = short / 2 + 0.45;
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : (i / (n - 1) - 0.5) * (long - short);
        obstacles.push([b.x + along[0] * o, b.z + along[1] * o, n === 1 ? Math.hypot(w, d) / 2 * 0.82 + 0.3 : r]);
      }
    }
  }
  rebuildObstacles();
  for (const ev of ['building:site', 'building:design', 'building:remove', 'building:done']) game.on(ev, rebuildObstacles);
  // the seaside dressing's trees inside the plot arrive with the trees.js kinds (async): walk round them too
  if (world.ready && world.ready.then) world.ready.then(rebuildObstacles).catch(() => {});

  const blocked = (x, z, pad = 0.8) => {
    if (x < P.x0 + margin || x > P.x1 - margin || z < P.z0 + margin || z > P.z1 - margin) return true;
    for (const L of LAKES) if (x > L.x0 - pad && x < L.x1 + pad && z > L.z0 - pad && z < L.z1 + pad && (pointInPoly(x, z, L.poly) || distToPoly(x, z, L.poly) < pad)) return true;
    for (const [ox, oz, r] of obstacles) if (Math.hypot(x - ox, z - oz) < r + pad * 0.5) return true;
    return false;
  };
  function freePoint(near = null, radius = 8) {
    for (let k = 0; k < 24; k++) {
      const x = near ? near.x + R(-radius, radius) : R(P.x0 + margin + 1, P.x1 - margin - 1);
      const z = near ? near.z + R(-radius, radius) : R(P.z0 + margin + 1, P.z1 - margin - 1);
      if (!blocked(x, z)) return { x, z };
    }
    return { x: st.centre.x + R(-3, 3), z: st.centre.z + R(-3, 3) };
  }
  // straight lines, plus one detour waypoint round the lake when the line would cross it
  function routeTo(from, to) {
    const path = [];
    for (const L of LAKES) {
      let crosses = false;
      for (let i = 1; i < 12; i++) { const t = i / 12, x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t; if (pointInPoly(x, z, L.poly) || distToPoly(x, z, L.poly) < 0.6) { crosses = true; break; } }
      if (!crosses) continue;
      const mx = (from.x + to.x) / 2 - L.cx, mz = (from.z + to.z) / 2 - L.cz;
      let nx = -(to.z - from.z), nz = to.x - from.x; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      const wx = clamp(L.cx + nx * (L.r + 2.4), P.x0 + margin, P.x1 - margin), wz = clamp(L.cz + nz * (L.r + 2.4), P.z0 + margin, P.z1 - margin);
      path.push(V(wx, 0, wz));
    }
    path.push(V(to.x, 0, to.z));
    return path;
  }

  const nav = {
    obstacles,
    // spawn spots round the sim's spawn point (the walkers' make.* picks one and jitters it)
    spots: [[0, 0], [2.6, -1.4], [-2.8, -1.2], [1.6, 2.6], [-2, 2.4], [4.4, 1.2], [-4.4, 1], [0.2, -3.4]].map(([dx, dz]) => [st.spawn.x + dx, st.spawn.z + dz]),
    get closeFocus() { const m = st.meeting && st.meeting.where; return V(m ? m.x : st.centre.x, 1.1, m ? m.z : st.centre.z); },
    pickTarget(a) {
      let t;
      const done = st.buildings.filter(b => b.status === 'done');
      if (ctx.flags.closeUp && rnd() < 0.55) { const f = nav.closeFocus; t = freePoint({ x: f.x, z: f.z + 3 }, 4); }
      else if (done.length && rnd() < 0.45) { const b = done[Math.floor(rnd() * done.length)]; t = freePoint({ x: b.x, z: b.z }, Math.max(b.footprint.w, b.footprint.d) / 2 + 3.5); }
      else if (rnd() < 0.25) t = freePoint(st.centre, 7);
      else t = freePoint(null);
      a.path = routeTo(a.pos, t);
    },
    bounds(p) { p.x = clamp(p.x, P.x0 + 0.6, P.x1 - 0.6); p.z = clamp(p.z, P.z0 + 0.6, P.z1 - 0.6); },
    extraPush(a, push, species) {
      const k = species === 'loaf' ? 2 : 10;
      for (const L of LAKES) {
        const x = a.pos.x, z = a.pos.z;
        if (x < L.x0 - 1.2 || x > L.x1 + 1.2 || z < L.z0 - 1.2 || z > L.z1 + 1.2) continue;
        const inside = pointInPoly(x, z, L.poly), d = distToPoly(x, z, L.poly);
        if (!inside && d > 0.7) continue;
        let dx = x - L.cx, dz = z - L.cz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const s = species === 'loaf' ? k : k * (inside ? 1.4 + d : 0.7 - d);
        push.x += dx * s; push.z += dz * s;
      }
    },
    flyTarget(f) { const t = freePoint(null); f.route = [V(t.x, R(2.4, 6.2), t.z)]; },
    floatTarget(f) { const t = freePoint(null); f.route.push(V(t.x, R(3.2, 6.8), t.z)); },
    flyPush(f, want) {
      if (f.pos.x < P.x0 + 2) want.x += 2; if (f.pos.x > P.x1 - 2) want.x -= 2;
      if (f.pos.z < P.z0 + 2) want.z += 2; if (f.pos.z > P.z1 - 2) want.z -= 2;
    },
    onArrive() {},
    // helpers for the agents bridge
    freePoint, routeTo, blocked, rebuildObstacles,
    refreshWater() { LAKES = lakeInfo(); }
  };
  return nav;
}

// Painting kit: painted-light vertex colours (bake), lumpy blobs, stone, and the foliage system
// (instanced leaf clumps + smooth invisible keyline proxies), verbatim from the Red arch.
// Everything the kit makes lands in kit.parent (default ctx.scene), in the reference's order.

export function createKit(ctx) {
  const { renderer, rnd, R, V, Y, L, col, ramp, colourOnly, lineOnly } = ctx;
  const kit = { parent: null };
  const scene = { add: (...o) => (kit.parent || ctx.scene).add(...o) };   // the reference's scene.add, aimed at kit.parent

  function bake(geo, cols, speck = 0.18, lift = 0) {
    const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
    const cs = cols.map(col);
    for (let i = 0; i < n.count; i++) {
      let v = 0.5 * (n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z) + 0.3 * n.getY(i) + 0.4 + lift + (rnd() - 0.5) * speck;
      const k = ramp(cs, v); c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  }
  const paintMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  function blob(r, pos, sy = 0.55, lump = 0.18, seg = 18, sz = 1) {
    const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.66));
    const p = g.attributes.position, s1 = R(0, 10), s2 = R(0, 10);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + lump * (Math.sin(x * 4 + s1) * Math.sin(y * 5 + s2) * Math.sin(z * 4.5 + s1 * 0.7) + 0.5 * Math.sin(x * 9 + z * 7 + s2));
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.scale(r, r * sy, r * sz); g.translate(pos.x, pos.y, pos.z); g.computeVertexNormals();
    return g;
  }

  // ---------- stone ----------
  function stoneTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#ddc7a7'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const v = 190 + Math.floor(rnd() * 40); g.fillStyle = `rgba(${v + 25},${v + 8},${v - 18},0.16)`; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
    g.strokeStyle = 'rgba(150,120,90,0.12)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  let stoneTex = null;
  const getStoneTex = () => stoneTex || (stoneTex = stoneTexture());   // the reference makes one, just before the slabs
  function slab(x0, x1, z0, z1, y0 = -2.2, y1 = 0) {
    const w = x1 - x0, d = z1 - z0, t = getStoneTex().clone(); t.needsUpdate = true; t.repeat.set(w / 6, d / 6);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, y1 - y0, d), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); return m;
  }

  // ================= foliage system =================
  // Everything leafy is thousands of small instanced clumps with baked colour,
  // plus a smooth invisible proxy per mass so keylines describe shapes, not leaves.
  const leaves = [];
  let proxyMat = null;   // made on first use: the reference makes it after the wall, and material ids set draw order
  function proxy(geo) { const m = new THREE.Mesh(geo, proxyMat || (proxyMat = new THREE.MeshBasicMaterial())); m.visible = false; scene.add(m); lineOnly.push(m); return m; }
  function leaf(pos, s, c, rotY = R(0, 6.28), sy = 0.6) { leaves.push({ pos, s, c, rotY, sy }); }

  const PINE = ['#202a0f', '#4a5a1c', '#7f8f30', '#b7b452', '#e2d978'].map(col);
  const UNDER = ['#10160a', '#202a10', '#3a4818'];
  const TRUNK = ['#120e0b', '#33271e', '#6a5444'];

  function chain(group, pts, r0, r1) {
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1], dir = b.clone().sub(a), len = dir.length(); dir.normalize();
      const rA = r0 + (r1 - r0) * (i / n), rB = r0 + (r1 - r0) * ((i + 1) / n);
      const g = new THREE.CylinderGeometry(rB, rA, len, 12, 4, true);
      const p = g.attributes.position;   // a little bark irregularity
      for (let k = 0; k < p.count; k++) { const w = 1 + 0.08 * Math.sin(p.getY(k) * 6 + k); p.setX(k, p.getX(k) * w); p.setZ(k, p.getZ(k) * w); }
      g.translate(0, len / 2, 0);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir)));
      g.translate(a.x, a.y, a.z); g.computeVertexNormals();
      const m = new THREE.Mesh(bake(g, TRUNK, 0.08), paintMat); m.castShadow = true; group.add(m);
      const j = new THREE.SphereGeometry(rB, 10, 8); j.translate(b.x, b.y, b.z);
      const jm = new THREE.Mesh(bake(j, TRUNK, 0.08), paintMat); jm.castShadow = true; group.add(jm);
    }
  }

  // umbrella pine crown: overlapping flat pads, each a dense sunlit top over a dark underside
  function crown(c, rad, nPads = 6) {
    const pads = [{ x: c.x, y: c.y + rad * 0.1, z: c.z, r: rad * 0.6 }];
    for (let i = 0; i < nPads; i++) {
      const a = i / nPads * Math.PI * 2 + R(-0.35, 0.35), d = rad * R(0.42, 0.68);
      pads.push({ x: c.x + Math.cos(a) * d, y: c.y + R(-0.16, 0.08) * rad, z: c.z + Math.sin(a) * d * 0.7, r: rad * R(0.36, 0.52) });
    }
    pads.forEach(p => {
      const under = new THREE.Mesh(bake(blob(p.r * 0.96, V(p.x, p.y, p.z), 0.2, 0.12, 20, 0.78), UNDER, 0.2), paintMat);
      under.castShadow = true; scene.add(under);
      const count = Math.max(70, Math.min(480, Math.round(170 * p.r * p.r)));
      for (let i = 0; i < count; i++) {
        const a = R(0, Math.PI * 2), rr = p.r * Math.sqrt(rnd()), u = rr / p.r, dome = 1 - u * u;
        const pos = V(p.x + Math.cos(a) * rr, p.y + p.r * (0.06 + 0.2 * dome) - Math.pow(rnd(), 2.2) * p.r * 0.2, p.z + Math.sin(a) * rr * 0.78);
        const n = V(Math.cos(a) * u * 0.9, 0.45 + 0.55 * dome, Math.sin(a) * u * 0.9).normalize();
        const v = 0.62 * n.dot(L) + 0.38 + 0.25 * dome + (rnd() - 0.5) * 0.35;
        leaf(pos, p.r * R(0.075, 0.13), ramp(PINE, v));
      }
      const pg = new THREE.SphereGeometry(1, 28, 14); pg.scale(p.r * 1.0, p.r * 0.26, p.r * 0.8); pg.translate(p.x, p.y + p.r * 0.02, p.z);
      proxy(pg);
    });
  }
  function pine(trunkPts, r0, r1, crowns) {
    const g = new THREE.Group();
    chain(g, trunkPts, r0, r1);
    crowns.forEach(cr => { if (cr.branch) chain(g, cr.branch, cr.br0, cr.br1); crown(cr.c, cr.r, cr.n); });
    scene.add(g);
  }

  // cypresses: a dark spindle core wrapped in vertical flame-like clumps
  const CYP = ['#0e150a', '#1f2b13', '#34441f', '#5b6a33', '#8e9550'].map(col);
  function cypress(x, z, h, w) {
    const prof = t => (t < 0.1 ? 0.7 + 0.3 * (t / 0.1) : Math.pow(Math.max(0, 1 - (t - 0.1) / 0.9), 0.8));
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(Math.max(0.001, w * prof(t)), t * h)); }
    const core = new THREE.LatheGeometry(pts, 20); core.translate(x, 0, z);
    const cm = new THREE.Mesh(bake(core, ['#0b1108', '#1a2410', '#2c3a1a'], 0.1), paintMat); cm.castShadow = true; scene.add(cm);
    const pp = pts.map(p => new THREE.Vector2(p.x * 1.12 + 0.05, p.y)); const pg = new THREE.LatheGeometry(pp, 24); pg.translate(x, 0, z); proxy(pg);
    const count = Math.round(h * w * 120);
    for (let i = 0; i < count; i++) {
      const t = Math.pow(rnd(), 0.9), a = R(0, Math.PI * 2), r = w * prof(t) * R(0.85, 1.12);
      const n = V(Math.cos(a), 0.2, Math.sin(a)).normalize();
      const v = 0.6 * n.dot(L) + 0.42 + (rnd() - 0.5) * 0.4;
      leaf(V(x + Math.cos(a) * r, t * h, z + Math.sin(a) * r), R(0.14, 0.24), ramp(CYP, v), a, 1.9);
    }
  }

  // flowering shrubs (oleander / bougainvillea): leafy domes with clustered blossoms
  const LEAF = ['#16220f', '#2e4219', '#4f6a2c', '#86a04c'].map(col);
  const PINK = ['#5a1530', '#a83863', '#e0779a', '#f6b6c6'].map(col);
  const RED = ['#4e1210', '#a62c26', '#e0603f', '#f4a07c'].map(col);
  function bush(cx, cz, spread, lobes, flowers, height = 1.4, bloom = 0.5) {
    for (let l = 0; l < lobes; l++) {
      const c = V(cx + R(-spread, spread), 0, cz + R(-spread, spread) * 0.6), r = R(0.7, 1.15), h = height * R(0.75, 1.1);
      const pg = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); pg.scale(r * 1.05, h * 1.05, r * 1.05); pg.translate(c.x, 0, c.z); proxy(pg);
      const ug = blob(r * 0.9, V(c.x, h * 0.35, c.z), h / r * 0.7, 0.1, 14);
      const um = new THREE.Mesh(bake(ug, ['#0d150a', '#1c2a12', '#2e4019'], 0.1), paintMat); um.castShadow = true; scene.add(um);
      const count = Math.round(140 * r * r);
      const ph = R(0, 10);
      for (let i = 0; i < count; i++) {
        const th = R(0, Math.PI * 2), phi = Math.acos(R(0.05, 1));
        const n = V(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        const rr = R(0.9, 1.05);
        const pos = V(c.x + n.x * r * rr, n.y * h * rr, c.z + n.z * r * rr);
        const isF = Math.sin(pos.x * 3.1 + ph) * Math.sin(pos.y * 3.7) * Math.sin(pos.z * 2.9 + ph) + R(-0.25, 0.25) > 0.45 - bloom;
        const v = 0.6 * n.dot(L) + 0.45 + (rnd() - 0.5) * 0.35;
        leaf(pos, isF ? R(0.1, 0.16) : R(0.12, 0.2), ramp(isF ? flowers : LEAF, v + (isF ? 0.1 : 0)));
      }
    }
  }

  // build one instanced mesh for every clump
  let leafGeo = null;
  function finishLeaves() {   // callable repeatedly: one InstancedMesh per batch of queued leaves
    if (!leafGeo) {
      leafGeo = new THREE.IcosahedronGeometry(1, 0);
      const n = leafGeo.attributes.normal, c = new Float32Array(n.count * 3);
      for (let i = 0; i < n.count; i++) { const s = 0.78 + 0.32 * Math.max(0, n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = s; }
      leafGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), leaves.length);
    {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
      leaves.forEach((l, i) => {
        e.set(R(-0.3, 0.3), l.rotY, R(-0.3, 0.3)); q.setFromEuler(e); s.set(l.s, l.s * l.sy, l.s);
        m.compose(l.pos, q, s); leafMesh.setMatrixAt(i, m); leafMesh.setColorAt(i, l.c);
      });
      leafMesh.castShadow = true; scene.add(leafMesh); colourOnly.push(leafMesh);
    }
    leaves.length = 0;   // the queue is spent; later leaves go in a new mesh
    return leafMesh;
  }

  return Object.assign(kit, {
    bake, paintMat, blob, proxy, leaf, chain, crown, pine, cypress, bush, finishLeaves,
    stoneTexture, getStoneTex, slab, leaves,
    PALETTES: { PINE, UNDER, TRUNK, CYP, LEAF, PINK, RED }
  });
}

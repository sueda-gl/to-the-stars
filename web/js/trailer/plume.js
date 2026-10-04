// The painted gouache rocket plume, in the Red arch grammar: few big billowing puffs with three hard clay tones
// (lit cream / peach, a lilac shade, a deep), the young ones glowing from inside (cream core, orange shade); one
// smooth keyline proxy per big puff so the pencil describes masses, not lumps; a nested flame at the nozzle; an
// orange bloom pooled on the sea. Every puff is a pure function of t (born, travels, grows, shrinks away), so the
// plume can be scrubbed to any instant.
//
//   const plume = createPlume(ctx, { keyDir, seaY, pad: {x, z, deckY, pitR}, rocketAt: t -> {x, y, z} (nozzle),
//                                    tIgnite, tLift, tEnd, seed, nozzles, width })
//   nozzles: [{ x, z, s }] — a cluster of engines round the nozzle point (offsets in metres, s = the flame's size);
//            one flame per engine, all tilting with the craft. Default: one engine at the nozzle.
//   width:   the cluster's half-width (m): exhaust puffs are born spread over it.
//   plume.update(t)      // places every live puff, the flame and the sea glow
//   plume.flame          // the group hung at the nozzle (moved by update)
//   plume.heat(t)        // 0..1 engine intensity (for lighting the folk / the glow)
import { clamp, lerp, smooth, span } from './shot.js';

const VERT = `attribute vec3 aCol; attribute float aHeat;
  varying vec3 vN; varying vec3 vObj; varying vec3 vC; varying float vHeat; varying float vY;
  void main(){
    vec4 p = vec4(position, 1.0); vec3 nn = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; nn = mat3(instanceMatrix) * nn;
    #endif
    vObj = position; vC = aCol; vHeat = aHeat;
    vN = normalize(mat3(modelMatrix) * nn);
    vec4 w = modelMatrix * p; vY = w.y;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FRAG = `uniform vec3 uLight; uniform float uGlow, uSeaY;
  varying vec3 vN; varying vec3 vObj; varying vec3 vC; varying float vHeat; varying float vY;
  void main(){
    vec3 n = normalize(vN);
    float ndl = dot(n, uLight);
    float wob = (sin(vObj.y * 7.0 + vObj.x * 5.0) + sin(vObj.x * 6.0 - vObj.z * 7.0 + vObj.y * 3.0)) * 0.07;
    vec3 lit = vC, shade = vC * vec3(0.86, 0.79, 0.86), deep = vC * vec3(0.70, 0.62, 0.74);
    // young puffs glow from inside: cream core, orange shadows
    vec3 hl = vec3(1.0, 0.95, 0.78), hs = vec3(0.98, 0.66, 0.33), hd = vec3(0.90, 0.40, 0.20);
    lit = mix(lit, hl, vHeat); shade = mix(shade, hs, vHeat); deep = mix(deep, hd, vHeat);
    // the fire under them warms the bellies near the water / the pad
    float belly = smoothstep(0.1, -0.7, n.y) * uGlow * smoothstep(uSeaY + 14.0, uSeaY + 1.0, vY);
    shade = mix(shade, vec3(0.97, 0.62, 0.36), belly * 0.65); deep = mix(deep, vec3(0.88, 0.45, 0.28), belly * 0.65);
    vec3 c = ndl > 0.06 + wob ? lit : ndl > -0.36 + wob ? shade : deep;
    gl_FragColor = vec4(c, 1.0);
  }`;

export function createPlume(ctx, o) {
  const { V, colourOnly, lineOnly, folkHidden, mulberry32 } = ctx;
  const { keyDir, seaY, pad, rocketAt, tIgnite, tLift, tEnd, seed = 2026, scale = 1, nozzles = [{ x: 0, z: 0, s: 1 }], width = 0 } = o;
  const rnd = mulberry32(seed);
  const R = (a, b) => a + (b - a) * rnd();
  const group = new THREE.Group(); group.name = 'plume'; ctx.scene.add(group);

  // ---- one cauliflower billow: a main mass and a few lobes, gently lumpy (its own rng: never the paint stream).
  // The proxies share it, so the pencil draws the billow's outline and the creases between its lobes, like a
  // painter outlines a cumulus, and every puff occludes the lines of whatever is behind it.
  function cloudGeo(amp, s0) {
    const LOBES = [[0, 0, 0, 1], [0.72, 0.22, 0.12, 0.66], [-0.7, 0.18, -0.08, 0.62], [0.12, 0.6, -0.25, 0.68], [-0.18, -0.08, 0.72, 0.6], [0.3, -0.18, -0.66, 0.55], [-0.35, 0.5, 0.42, 0.5]];
    const P = [], I = []; let base = 0;
    LOBES.forEach(([x, y, z, r], li) => {
      const g = new THREE.SphereGeometry(r, 20, 14), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
        const k = 1 + amp * (Math.sin(px * 4.1 + s0 + li) * Math.sin(py * 4.7 + s0 * 0.7) * Math.sin(pz * 3.9 + s0 * 1.3 + li));
        P.push(x + px * k, (y + py * k) * 0.9, z + pz * k);
      }
      g.index.array.forEach(ix => I.push(ix + base)); base += p.count; g.dispose();
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
  const geo = cloudGeo(0.08, 1.7);
  const proxyGeo = cloudGeo(0.0, 1.7);

  // ---- the puff schedule ----
  const PEACH = ['#f6ead6', '#f4dcc0', '#f2cba8', '#f0e2cf', '#eed5bf', '#f5e6d0'].map(h => new THREE.Color(h));
  const STEAM = ['#efe6d8', '#e9e0d6', '#f3ece0', '#e6dcd4', '#ece2d2'].map(h => new THREE.Color(h));
  const puffs = [];
  const add = p => { p.col = p.col || PEACH[Math.floor(rnd() * PEACH.length)]; p.rot = [R(0, 6.28), R(0, 6.28), R(0, 6.28)]; puffs.push(p); };
  const S = scale;
  // A) the first breath at ignition: puffs burst out round the rocket's feet over the deck
  for (let tb = tIgnite + 0.05; tb < tLift + 1.2; tb += (tb < tIgnite + 1 ? 1 / 30 : 1 / 16)) {
    const a = R(0, Math.PI * 2);
    add({ kind: 'deck', tb, life: R(3.6, 5.2), a, r0: R(0.6, 1.6) * S, v0: R(3.5, 6) * S, k: R(0.9, 1.3), rise: R(0.5, 1.2) * S,
      s0: R(0.35, 0.6) * S, s1: (tb < tIgnite + 1 ? R(1.4, 2.3) : R(0.9, 1.7)) * S, heat0: tb < tIgnite + 0.9 ? 1 : R(0.6, 0.9), y0: R(0.2, 1.0) * S, cool: tb < tIgnite + 1 ? 0.9 : 1.3 });
  }
  // B) the flame trench: steam rolls out of the eight arcade arches and over the water
  for (let tb = tIgnite + 0.35; tb < tLift + 3.6; tb += 1 / 30) {
    const arch = Math.floor(R(0, 8)), a = arch * Math.PI / 4 + Math.PI / 8 + R(-0.2, 0.2);
    add({ kind: 'trench', tb, life: R(5.5, 7.5), a, r0: 6.0 * S, v0: R(6, 9.5) * S, k: R(0.42, 0.62), rise: R(0.2, 0.5) * S,
      s0: R(0.4, 0.7) * S, s1: R(1.4, 2.4) * S, heat0: tb < tIgnite + 1.2 ? R(0.6, 0.9) : R(0.15, 0.4), cool: 1.6, y0: R(0.4, 1.3) * S, col: STEAM[Math.floor(rnd() * STEAM.length)] });
  }
  // C) the exhaust: born at the nozzle wherever the rocket is, shot down, slowed, left hanging as the trail
  for (let tb = tIgnite + 0.6; tb < tEnd; tb += (tb < tLift ? 1 / 10 : 1 / 26)) {
    add({ kind: 'exhaust', tb, life: R(7, 10), a: R(0, Math.PI * 2), spread: R(0.1, 0.8) * S + R(0, width), v0: R(12, 18) * S, k: R(2.4, 3.4),
      drift: R(0.3, 0.8) * S, rise: R(0.15, 0.45) * S, s0: R(0.45, 0.75) * S, s1: R(1.9, 2.8) * S, heat0: R(0.85, 1), grow: R(0.35, 0.6) * S, off: R(2.6, 3.6) * S });
  }
  // birth positions of exhaust puffs depend on where the nozzle was: cache them
  puffs.forEach(p => { if (p.kind === 'exhaust') p.n0 = rocketAt(p.tb); });
  const N = puffs.length;

  const mat = new THREE.ShaderMaterial({ uniforms: { uLight: { value: keyDir }, uGlow: { value: 0 }, uSeaY: { value: seaY } }, vertexShader: VERT, fragmentShader: FRAG });
  const aCol = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), aHeat = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  geo.setAttribute('aCol', aCol); geo.setAttribute('aHeat', aHeat);
  const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; mesh.count = 0; group.add(mesh); colourOnly.push(mesh); folkHidden.push(mesh);
  const proxies = new THREE.InstancedMesh(proxyGeo, new THREE.MeshBasicMaterial(), N); proxies.frustumCulled = false; proxies.count = 0; proxies.visible = false;
  group.add(proxies); lineOnly.push(proxies);

  // ---- the flame at the nozzle: three nested painted tongues ----
  const flame = new THREE.Group(); group.add(flame);
  const tongue = (r, len, hex) => {
    const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(new THREE.Vector2(r * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.02)), 0.7) * (1 - u * 0.35), -len * u)); }
    const g = new THREE.LatheGeometry(pts, 20); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hex }));
  };
  // one jet per engine: three nested tongues each
  const jets = nozzles.map(n => {
    const j = new THREE.Group(); j.position.set(n.x || 0, 0, n.z || 0);
    const outer = tongue(1.05 * S, 5.6 * S, '#ef7f3a'), mid = tongue(0.78 * S, 4.2 * S, '#f8b552'), core = tongue(0.48 * S, 2.6 * S, '#fff0c4');
    j.add(outer, mid, core); [mid, core].forEach(m => colourOnly.push(m)); folkHidden.push(outer, mid, core);
    flame.add(j); return { j, core, s: n.s || 1 };
  });
  flame.visible = false;

  // ---- an orange bloom on the sea round the pad ----
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uK: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uK; varying vec2 vP;
      void main(){ float r = length(vP); float a = smoothstep(1.0, 0.25, r) * uK; a = floor(a * 4.0 + 0.5) / 4.0;
        if (a < 0.02) discard; gl_FragColor = vec4(mix(vec3(0.93,0.52,0.30), vec3(1.0,0.82,0.55), smoothstep(0.6,0.1,r)), a * 0.55); }`
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), glowMat);
  glow.rotation.x = -Math.PI / 2; glow.position.set(pad.x, seaY + 0.03, pad.z); glow.scale.setScalar(22 * S); glow.renderOrder = 2;
  const glowHolder = new THREE.Group(); glowHolder.add(glow); group.add(glowHolder); colourOnly.push(glow); folkHidden.push(glow);

  // ---- per frame ----
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = V(0, 0, 0), sc = V(1, 1, 1), c = new THREE.Color();
  const heat = t => t < tIgnite ? 0 : t < tIgnite + 0.4 ? smooth((t - tIgnite) / 0.4) * 0.7 : t < tLift ? lerp(0.7, 1, span(t, tIgnite + 0.4, tLift)) : 1;
  const deckTop = pad.deckY;
  function place(p, t, out) {
    const age = t - p.tb;
    if (age < 0 || age > p.life) return 0;
    const u = age / p.life;
    let size = lerp(p.s0, p.s1, 1 - Math.exp(-age * 1.4)) * (u > 0.72 ? Math.sqrt(Math.max(0, 1 - (u - 0.72) / 0.28)) : 1);
    if (age < 0.12) size *= age / 0.12;
    let h = p.heat0 * Math.exp(-age * (p.cool || 2.6));
    if (p.kind === 'deck') {
      const d = p.r0 + p.v0 / p.k * (1 - Math.exp(-p.k * age));
      out.set(pad.x + Math.cos(p.a) * d, deckTop + p.y0 + p.rise * age + size * 0.4, pad.z + Math.sin(p.a) * d);
    } else if (p.kind === 'trench') {
      const d = p.r0 + p.v0 / p.k * (1 - Math.exp(-p.k * age));
      out.set(pad.x + Math.cos(p.a) * d, seaY + p.y0 + p.rise * age * (1 + age * 0.15) + size * 0.25, pad.z + Math.sin(p.a) * d);
    } else {
      const n0 = p.n0, down = p.v0 / p.k * (1 - Math.exp(-p.k * age));
      const th = n0.th || 0, dn = down + (p.tb > tLift + 0.6 ? p.off : 0);   // airborne: born under the flame
      let y = n0.y - dn * Math.cos(th), rad = p.spread * (1 + age * 0.9);
      const floor = deckTop + size * 0.55;
      if (y < floor) { const over = floor - y; y = floor + over * 0.12; rad += over * 1.25; }
      y += p.rise * age;
      size *= 1 + p.grow * age * 0.35;
      out.set(n0.x - dn * Math.sin(th) + Math.cos(p.a) * rad + p.drift * age, y, n0.z + Math.sin(p.a) * rad);
      h = p.heat0 * Math.exp(-age * 3.2);
    }
    p._h = h;
    return size;
  }
  function update(t) {
    const H = heat(t);
    mat.uniforms.uGlow.value = H;
    let n = 0, np = 0;
    for (let i = 0; i < N; i++) {
      const p = puffs[i], s = place(p, t, pos);
      if (s <= 0.01) continue;
      e.set(p.rot[0] + (t - p.tb) * 0.25, p.rot[1], p.rot[2]); q.setFromEuler(e); sc.setScalar(s);
      m4.compose(pos, q, sc);
      mesh.setMatrixAt(n, m4);
      c.copy(p.col); aCol.setXYZ(n, c.r, c.g, c.b); aHeat.setX(n, clamp(p._h, 0, 1));
      n++;
      // the pencil sees the billows (and they hide the lines of whatever is behind them)
      proxies.setMatrixAt(np++, m4);
    }
    mesh.count = n; proxies.count = np;
    mesh.instanceMatrix.needsUpdate = true; proxies.instanceMatrix.needsUpdate = true; aCol.needsUpdate = true; aHeat.needsUpdate = true;
    // flame
    const on = t >= tIgnite + 0.15;
    flame.visible = on;
    if (on) {
      const nz = rocketAt(t), k = smooth(span(t, tIgnite + 0.15, tIgnite + 0.9)), lift = span(t, tLift, tLift + 2.5);
      flame.position.set(nz.x, nz.y, nz.z); flame.rotation.z = o.tiltAt ? -o.tiltAt(t) : 0;
      const fl = 1 + 0.12 * Math.sin(t * 37) + 0.08 * Math.sin(t * 23.3 + 1.2);
      jets.forEach((J, ji) => {
        const f2 = 1 + 0.06 * Math.sin(t * 31 + ji * 2.1);
        J.j.scale.set((0.75 + 0.25 * k) * (1 + 0.05 * Math.sin(t * 29 + ji)) * J.s, k * fl * f2 * lerp(0.55, 1.35, lift) * J.s, (0.75 + 0.25 * k) * J.s);
        J.core.scale.y = 1 + 0.15 * Math.sin(t * 41 + 2 + ji);
      });
    }
    glowMat.uniforms.uK.value = H * (0.75 + 0.1 * Math.sin(t * 9)) * (1 - 0.6 * span(t, tLift + 3, tLift + 7));
    glowHolder.visible = H > 0.01;
  }
  return { group, update, flame, heat, puffs, mesh };
}

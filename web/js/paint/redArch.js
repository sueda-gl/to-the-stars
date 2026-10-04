// The Red arch scene, verbatim: terrace slabs, pool (Reflector + PoolShader + flat keyline stand-in),
// the red wall and its arch, pines, cypresses, flowering shrubs, gulls. In the game it is the Assembly.
// Also the reference's walkable world (OBST, SPOTS, route, CLOSE_FOCUS) and referenceNav(), the default nav.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the reference camera's base and aim
export const camBase = V(-0.4, 4.0, 22), lookBase = V(0, 7.2, -20);
export const PW = 3.6, poolFar = -11.6, terraceEdge = -14;

// walkable world: obstacles (x, z, radius), places they like to gather
export const OBST = [[-7.2,-8.8,1.9],[-5.9,-10.8,1.2],[-9.3,-5.8,1.6],[7.8,-8.5,1.7],[9.0,-5.0,1.6],[9.7,2.6,1.9],[-9.9,2.6,1.6],
  [-8.4,-7,0.5],[7.6,-4.2,0.6],[-4.6,-11,0.35],[4.2,-12.4,0.35],[-10.6,4.5,1.4],[10.9,4.0,1.3]];
// (people.forEach(p => OBST.push(...)) — the reference has no people left, so OBST is just the list above)
export const SPOTS = [[-2.4,-12.9],[2.3,-12.9],[-5.2,-11.2],[6.0,-11.6],[-5.6,-3.2],[5.6,-1.8],[-4.6,-6.4],[4.9,-8.2],[-6.4,6.5],[6.6,8.5],[-6.6,10.5],[6.0,10.8]];
export const CLOSE_FOCUS = V(6.1, 1.1, 9.6);   // the up-close stage on the right front terrace
export function route(p, t) {
  const path = [], sF = p.x < 0 ? -1 : 1, sT = t.x < 0 ? -1 : 1, fF = p.z > 0.9, fT = t.z > 0.9;
  if (fF && (!fT || sT !== sF)) path.push(V(sF * 6.3, 0, 0.9));        // through the arch
  if (sT !== sF) { path.push(V(sF * 4.4, 0, -12.9)); path.push(V(sT * 4.4, 0, -12.9)); }  // round the far end of the pool
  if (fT && (!fF || sT !== sF)) path.push(V(sT * 6.3, 0, 0.9));
  path.push(t);
  return path;
}

// The default behaviour seam: reproduces the reference's wandering exactly (same rnd calls, same order).
export function referenceNav(ctx) {
  const { rnd, R } = ctx;
  const nav = { obstacles: OBST, spots: SPOTS, closeFocus: CLOSE_FOCUS };
  nav.pickTarget = function pickTarget(c) {
    if (ctx.flags.closeUp && rnd() < 0.55) {   // in close-up, most of them wander over to be looked at
      c.path = route(c.pos, V(R(4.9, 9.0), 0, nav.closeFocus.z + R(-2.8, 2.6)));
      return;
    }
    const sp = SPOTS[Math.floor(rnd() * SPOTS.length)];
    c.path = route(c.pos, V(sp[0] + R(-1.1, 1.1), 0, sp[1] + R(-0.7, 0.7)));
  };
  nav.bounds = p => { p.z = Math.max(-13.6, Math.min(16, p.z)); p.x = Math.max(-13, Math.min(13, p.x)); };
  nav.extraPush = (a, push, species) => {
    if (species === 'loaf') { if (a.pos.z > -12.2 && Math.abs(a.pos.x) < PW + 0.8) push.x += Math.sign(a.pos.x || 1) * 2; return; }
    if (a.pos.z > -12.2 && a.pos.z < 26 && Math.abs(a.pos.x) < PW + 0.6) push.x += Math.sign(a.pos.x || 1) * (PW + 0.6 - Math.abs(a.pos.x)) * 10;
    if (a.pos.z > -0.4 && a.pos.z < 2.2 && Math.abs(a.pos.x) > 8.0) push.x -= Math.sign(a.pos.x) * (Math.abs(a.pos.x) - 8.0) * 10;
  };
  nav.flyTarget = function flitTarget(f) {
    const p = V(R(-10, 10), R(2.4, 6.2), R(-12, 13));
    f.route = [];
    // the wall: only cross it through the arch
    if ((f.pos.z > 0.9) !== (p.z > 0.9)) f.route.push(V(THREE.MathUtils.clamp(f.pos.x, -5, 5), Math.min(f.pos.y, 7), 0.9));
    f.route.push(p);
  };
  nav.floatTarget = f => {
    const p = V(R(-10, 10), R(3.2, 6.8), R(-12, 13));
    if ((f.pos.z > 0.9) !== (p.z > 0.9)) f.route.push(V(THREE.MathUtils.clamp(f.pos.x, -4.5, 4.5), Math.min(f.pos.y, 7), 0.9));
    f.route.push(p);
  };
  nav.flyPush = (f, want, species) => {
    if (species === 'floatie') { if (f.pos.z > -0.6 && f.pos.z < 2.4) { if (Math.abs(f.pos.x) > 6) want.x -= Math.sign(f.pos.x) * 2; if (f.pos.y > 8) want.y -= 2; } return; }
    if (f.pos.z > -0.6 && f.pos.z < 2.4) { if (Math.abs(f.pos.x) > 6.5) want.x -= Math.sign(f.pos.x) * 3; if (f.pos.y > 8) want.y -= 3; }
  };
  nav.onArrive = () => {};
  return nav;
}

export function buildRedArch(ctx, kit, { origin = V(0, 0, 0), scale = 1 } = {}) {
  const { R, colourOnly, lineOnly } = ctx;
  const { slab, pine, cypress, bush } = kit;
  const { LEAF, PINK, RED } = kit.PALETTES;
  const group = new THREE.Group(); group.position.copy(origin); group.scale.setScalar(scale); ctx.scene.add(group);
  const scene = group;   // the reference's scene.add, aimed at the arch's group (identity by default)
  const prevParent = kit.parent; kit.parent = group;

  // ---------- terrace + pool ----------
  kit.getStoneTex();   // const stoneTex = stoneTexture();
  slab(-40, -PW, terraceEdge, 30); slab(PW, 40, terraceEdge, 30);
  slab(-PW, PW, terraceEdge, poolFar); slab(-PW, PW, 26, 30);
  const lining = new THREE.Mesh(new THREE.BoxGeometry(PW * 2, 0.1, 26 - poolFar), new THREE.MeshBasicMaterial({ color: 0x0d2a33 }));
  lining.position.set(0, -2.1, (26 + poolFar) / 2); scene.add(lining);

  const PoolShader = {
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 } },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vP;
      void main(){ vUv = textureMatrix*vec4(position,1.0); vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; varying vec4 vUv; varying vec3 vP;
      void main(){
        vec2 d = vec2(sin(vP.y*2.6+uTime*1.1)+0.5*sin(vP.x*4.0-uTime*0.7), sin(vP.y*1.9-uTime*0.8))*0.0012;
        vec4 uv = vUv; uv.xy += d*uv.w;
        vec3 base = texture2DProj(tDiffuse, uv).rgb;
        float near = smoothstep(-14.0, 14.0, vP.y);   // darker water toward the viewer
        vec3 deep = vec3(0.05,0.2,0.26);
        vec3 c = mix(base*color, deep, 0.18 + 0.32*near);
        gl_FragColor = vec4(c,1.0);
      }`
  };
  const pool = new THREE.Reflector(new THREE.PlaneGeometry(PW * 2, 26 - poolFar), {
    clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0xbfd8dc, shader: PoolShader
  });
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, -0.16, (26 + poolFar) / 2);
  scene.add(pool); colourOnly.push(pool); ctx.folkHidden.push(pool); ctx.reflectors.push(pool);
  // flat stand-in for the water so keylines see a surface, not the pit underneath
  { const wp = new THREE.Mesh(new THREE.PlaneGeometry(PW * 2, 26 - poolFar)); wp.rotation.x = -Math.PI / 2; wp.position.copy(pool.position); wp.visible = false; scene.add(wp); lineOnly.push(wp); }

  // ---------- wall ----------
  const archR = 8.6, archSpring = 4.8, wallDepth = 1.8;
  const ws = new THREE.Shape();
  ws.moveTo(-60, -2.2); ws.lineTo(-archR, -2.2); ws.lineTo(-archR, archSpring);
  ws.absarc(0, archSpring, archR, Math.PI, 0, true);
  ws.lineTo(archR, -2.2); ws.lineTo(60, -2.2); ws.lineTo(60, 40); ws.lineTo(-60, 40); ws.lineTo(-60, -2.2);
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(ws, { depth: wallDepth, bevelEnabled: false, curveSegments: 96 }), new THREE.MeshLambertMaterial({ color: 0xc23a2c }));
  wall.receiveShadow = true; scene.add(wall);

  // ---------- pines, cypresses, shrubs ----------
  pine([V(-8.4, 0, -7), V(-8.1, 2.5, -7.1), V(-7.2, 4.8, -7.2), V(-6.2, 6.6, -7.3)], 0.42, 0.22, [
    { c: V(-5.2, 7.7, -7.4), r: 3.8, n: 7 },
    { c: V(-9.0, 7.1, -7.6), r: 2.3, n: 5, branch: [V(-7.4, 5.0, -7.2), V(-8.4, 6.1, -7.5), V(-8.8, 6.8, -7.6)], br0: 0.2, br1: 0.11 },
    { c: V(-2.4, 7.1, -7.0), r: 2.0, n: 5, branch: [V(-6.4, 6.4, -7.3), V(-4.4, 6.8, -7.2), V(-2.6, 6.9, -7.0)], br0: 0.18, br1: 0.1 }
  ]);
  pine([V(-4.6, 0, -11), V(-4.4, 1.6, -11), V(-3.6, 3.0, -11.1), V(-2.6, 3.8, -11.2)], 0.2, 0.1, [{ c: V(-2.3, 4.2, -11.2), r: 1.9, n: 5 }]);
  pine([V(7.6, 0, -4.2), V(7.0, 2.6, -4.6), V(5.6, 5.0, -5.4), V(5.0, 7.4, -6.0), V(5.4, 9.6, -6.3)], 0.5, 0.22, [
    { c: V(5.6, 10.7, -6.4), r: 3.9, n: 7 },
    { c: V(2.5, 7.7, -6.4), r: 2.7, n: 6, branch: [V(5.4, 5.6, -5.6), V(4.0, 6.6, -6.1), V(2.8, 7.3, -6.4)], br0: 0.22, br1: 0.12 },
    { c: V(7.8, 8.1, -5.6), r: 2.2, n: 5, branch: [V(5.2, 7.0, -6.0), V(6.6, 7.4, -5.8), V(7.6, 7.9, -5.6)], br0: 0.18, br1: 0.1 }
  ]);
  pine([V(4.2, 0, -12.4), V(4.6, 2.2, -12.6), V(5.2, 4.4, -12.8)], 0.22, 0.12, [{ c: V(5.4, 5.0, -12.8), r: 2.2, n: 5 }]);
  cypress(-10.6, 4.5, 12.5, 1.15);
  cypress(10.9, 4.0, 11.5, 1.05);
  bush(-7.2, -8.8, 1.4, 4, PINK, 1.7, 0.55);
  bush(-5.9, -10.8, 0.8, 2, PINK, 1.1, 0.5);
  bush(-9.3, -5.8, 1.0, 3, PINK, 1.5, 0.25);
  bush(7.8, -8.5, 1.2, 3, RED, 1.5, 0.5);
  bush(9.0, -5.0, 1.1, 3, PINK, 1.7, 0.45);
  bush(9.7, 2.6, 1.4, 4, RED, 1.5, 0.6);
  bush(-9.9, 2.6, 1.1, 3, LEAF, 1.2, 0);
  kit.finishLeaves();

  // ---------- people: lathe silhouettes in coats and dresses ----------
  const people = [];
  const figureMat = new THREE.MeshLambertMaterial({ color: 0x2a2520 });
  const PROFILES = {
    coat:  [[0,0],[0.07,0],[0.085,0.06],[0.095,0.5],[0.12,0.78],[0.2,0.86],[0.205,0.92],[0.18,1.08],[0.2,1.3],[0.22,1.4],[0.17,1.47],[0.06,1.52],[0.058,1.56],[0.1,1.6],[0.115,1.67],[0.1,1.74],[0.05,1.78],[0,1.79]],
    dress: [[0,0],[0.06,0],[0.07,0.08],[0.08,0.5],[0.25,0.62],[0.21,0.78],[0.15,1.02],[0.17,1.25],[0.19,1.36],[0.14,1.43],[0.05,1.47],[0.05,1.5],[0.095,1.54],[0.11,1.61],[0.095,1.68],[0.05,1.72],[0,1.73]],
    suit:  [[0,0],[0.08,0],[0.1,0.05],[0.11,0.5],[0.15,0.85],[0.19,0.92],[0.18,1.08],[0.2,1.3],[0.23,1.42],[0.17,1.48],[0.06,1.53],[0.06,1.57],[0.1,1.61],[0.115,1.68],[0.1,1.75],[0.05,1.79],[0,1.8]]
  };
  const profGeo = {};
  Object.entries(PROFILES).forEach(([k, pts]) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 16); g.scale(1, 1, 0.66); profGeo[k] = g; });
  function person(x, z, rotY = 0, s = 1, kind = 'coat') {
    const m = new THREE.Mesh(profGeo[kind], figureMat);
    m.position.set(x, 0, z); m.rotation.y = rotY; m.scale.setScalar(s * 1.05);
    m.castShadow = true; m.userData.phase = R(0, 6.28);
    scene.add(m); people.push(m);
  }
  // (the human silhouettes are gone; the terrace belongs to the creatures now)

  // ---------- gulls ----------
  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x23262b, side: THREE.DoubleSide });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.02); wingShape.quadraticCurveTo(0.35, 0.2, 0.55, 0.12); wingShape.quadraticCurveTo(0.8, 0.04, 1.05, -0.12);
  wingShape.quadraticCurveTo(0.78, -0.02, 0.55, 0.05); wingShape.quadraticCurveTo(0.32, 0.1, 0, -0.04);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 8);
  function bird(x, y, z, s) {
    const g = new THREE.Group(), lw = new THREE.Mesh(wingGeo, birdMat), rw = new THREE.Mesh(wingGeo, birdMat);
    rw.scale.x = -1; g.add(lw, rw); g.position.set(x, y, z); g.scale.setScalar(s);
    g.userData = { lw, rw, phase: R(0, 6.28), speed: R(0.35, 0.6), x0: x, y0: y };
    scene.add(g); birds.push(g); colourOnly.push(g);
  }
  bird(-6.5, 15.5, -30, 1.6); bird(-1.2, 13.6, -30, 1.4); bird(-6.0, 12.8, -28, 1.3); bird(3.6, 12.0, -30, 1.4); bird(-9.0, 12.2, -32, 1.2);
  kit.parent = prevParent;

  function update(t) {
    pool.material.uniforms.uTime.value = t;
      birds.forEach(b => {
        const u = b.userData, f = Math.sin(t * 4 * u.speed * 2 + u.phase);
        u.lw.rotation.y = 0; u.lw.rotation.z = f * 0.35; u.rw.rotation.z = -f * 0.35;
        b.position.x = u.x0 + Math.sin(t * 0.06 * u.speed + u.phase) * 5;
        b.position.y = u.y0 + Math.sin(t * 0.4 + u.phase) * 0.4;
      });
      people.forEach(p => { p.rotation.z = Math.sin(t * 0.6 + p.userData.phase) * 0.01; });
  }
  return { group, pool, wall, lining, birds, people, person, PW, OBST, SPOTS, CLOSE_FOCUS, route, update };
}

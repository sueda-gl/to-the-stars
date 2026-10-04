// The folk: all seven species of the Red arch, verbatim — geometry, clay cel materials, wardrobes, the
// shared leg rig and every update function. puffers (builders), loaves (bakers), drops, scoots (couriers),
// flits (fliers), pips (walkers) and floaties (parasol drifters).
// The ONLY changes from the reference are structural (a factory, lazy per-species setup in the reference's
// order) and the nav seam: where they walk is decided by `nav` (default referenceNav = the reference exactly).
import { referenceNav } from './redArch.js';

export const FACE_LAYER = 5, MASK_LAYER = 6;

export function createFolk(ctx, backdrop, nav = referenceNav(ctx)) {
  const { rnd, R, V, Y, col, scene, camera, colourOnly, flags } = ctx;
  const { KEY_DIR } = backdrop;
  // ---------- little lemon folk that wander the terrace ----------
  const LEMON = [[0,0.05],[0.025,0.055],[0.04,0.08],[0.11,0.13],[0.19,0.21],[0.235,0.3],[0.25,0.38],[0.24,0.46],[0.2,0.55],[0.13,0.63],[0.06,0.68],[0.035,0.71],[0.02,0.735],[0,0.74]].map(p => new THREE.Vector2(p[0], p[1]));
  function lemonGeo(hex) {
    const g = new THREE.LatheGeometry(LEMON, 26); g.scale(1, 1, 0.92); g.computeVertexNormals();
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    const peel = col(hex), tip = col('#b7b12a'), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), tipK = Math.max(THREE.MathUtils.smoothstep(0.1, 0.05, y), THREE.MathUtils.smoothstep(0.67, 0.73, y));
      tmp.copy(peel).lerp(tip, tipK).multiplyScalar(0.94 + rnd() * 0.1);   // dimpled peel
      c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  }
  const lemonGeos = ['#f4cb22', '#f7d43a', '#efbf1c', '#f9dc4c'].map(lemonGeo);
  // Cel shading: three hard tones, warm hue-shifted shadows, a wobbly "painted" terminator
  function celMat(lit, shade, deep) {
    return new THREE.ShaderMaterial({
      uniforms: { uLight: { value: KEY_DIR }, uLit: { value: col(lit) }, uShade: { value: col(shade) }, uDeep: { value: col(deep) } },
      vertexShader: `varying vec3 vN; varying vec3 vObj;
        void main(){ vN = normalize(mat3(modelMatrix) * normal); vObj = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uLight, uLit, uShade, uDeep; varying vec3 vN; varying vec3 vObj;
        void main(){
          vec3 n = normalize(vN);
          float ndl = dot(n, uLight);
          float wob = (sin(vObj.y*38.0 + vObj.x*22.0) + sin(vObj.x*29.0 - vObj.z*31.0 + vObj.y*9.0)) * 0.045;
          float wob2 = wob * 0.6; wob = wob2;
          vec3 c = ndl > -0.02 + wob ? uLit : ndl > -0.42 + wob ? uShade : uDeep;
          float spec = dot(n, normalize(uLight + vec3(0.0, 0.4, 0.9)));
          c = mix(c, vec3(1.0, 0.97, 0.84), step(0.985 + wob * 0.15, spec) * 0.8);   // one hard painted highlight
          gl_FragColor = vec4(c, 1.0);
        }`
    });
  }
  const peelMats = [
    celMat('#f6cf3a', '#e09a3c', '#b0623e'), celMat('#f8d84e', '#e6a646', '#b86e46'),
    celMat('#f2c42a', '#d98f34', '#a65a38'), celMat('#fadf62', '#eab052', '#bd784c')
  ];
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x5c8f2c, side: THREE.DoubleSide });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x4a3a1c });
  // ---- puffer folk: soft matte clay pufferfish that swim through the air ----
  const PUFF_R = 0.34, HIP = 0.13;   // stands on little legs now
  const legGeoP = new THREE.CylinderGeometry(0.034, 0.03, 1, 8); legGeoP.translate(0, 0.5, 0);   // ankle at 0, hip at 1
  const footGeoP = new THREE.SphereGeometry(0.05, 12, 8); footGeoP.scale(1, 0.7, 1.2); footGeoP.translate(0, 0, 0.012);   // round nub feet
  // stubby arms: a rounded limb with a ball hand, so they can carry and build
  const armGeoP = new THREE.CylinderGeometry(0.03, 0.034, 0.14, 8); armGeoP.translate(0, -0.07, 0);
  const handGeoP = new THREE.SphereGeometry(0.042, 12, 8); handGeoP.translate(0, -0.15, 0);
  const CLAY_VERT = `varying vec3 vN; varying vec3 vW; varying vec3 vObj;
    void main(){
      vec4 p = vec4(position, 1.0); vec3 nn = normal;
      #ifdef USE_INSTANCING
        p = instanceMatrix * p; nn = mat3(instanceMatrix) * nn;
      #endif
      vObj = position;
      vec4 w = modelMatrix * p; vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * nn);
      gl_Position = projectionMatrix * modelViewMatrix * p;
    }`;
  const CLAY_FRAG = `uniform vec3 uLight, uBase, uShade, uRim, uStripeCol; uniform float uRibs, uStripeF, uStripeMode, uClipY, uClipZ;
    varying vec3 vN; varying vec3 vW; varying vec3 vObj;
    void main(){
      float hem = 0.007 * sin(atan(vObj.x, vObj.z) * 9.0) + 0.005 * sin(vObj.x * 40.0);
      if (vObj.y > uClipY + hem || vObj.z > uClipZ + hem) discard;
      vec3 n = normalize(vN);
      float ndl = dot(n, uLight);
      float wob = (sin(vObj.y * 38.0 + vObj.x * 24.0) + sin(vObj.x * 31.0 - vObj.z * 27.0 + vObj.y * 9.0)) * 0.035;
      float band = ndl > 0.02 + wob ? 0.0 : ndl > -0.42 + wob ? 1.0 : 2.0;
      vec3 c = band < 0.5 ? uBase : band < 1.5 ? uShade : uRim;   // lit / shadow / deep shadow, no gradients
      if (uStripeF > 0.0 && sin((uStripeMode > 0.5 ? vObj.y : atan(vObj.y, vObj.x)) * uStripeF) > 0.0) c = uStripeCol * (band < 0.5 ? 1.0 : band < 1.5 ? 0.78 : 0.56);
      if (uRibs > 0.0) { float a = atan(vObj.y, vObj.x); c = mix(c, uShade, step(0.82, abs(sin(a * uRibs))) * 0.6); }
      gl_FragColor = vec4(c, 1.0);
    }`;
  function clayMat(base, shade, rim = '#c98a5c', ribs = 0) {
    return new THREE.ShaderMaterial({
      uniforms: { uLight: { value: KEY_DIR }, uBase: { value: col(base) }, uShade: { value: col(shade) }, uRim: { value: col(rim) }, uRibs: { value: ribs }, uStripeCol: { value: col('#ffffff') }, uStripeF: { value: 0 }, uStripeMode: { value: 0 }, uClipY: { value: 1e3 }, uClipZ: { value: 1e3 } },
      vertexShader: CLAY_VERT, fragmentShader: CLAY_FRAG
    });
  }
  const PUFF_COLS = [['#ffd23f', '#f3a12e', '#c4613c'], ['#ffda55', '#f5ab36', '#c96a42'], ['#ffc933', '#ee9628', '#bc5838'], ['#ffdc62', '#f6b03e', '#cc7046']];
  const bodyMats = PUFF_COLS.map(([b, sh, dp]) => clayMat(b, sh, dp));
  const bumpMats = PUFF_COLS.map(([b, sh, dp]) => clayMat(new THREE.Color(b).offsetHSL(-0.004, 0.04, -0.03).getStyle(), sh, dp));
  const finMats = PUFF_COLS.map(([b, sh, dp]) => clayMat(new THREE.Color(b).offsetHSL(-0.003, 0.03, -0.015).getStyle(), sh, dp, 7));
  const legMatP = clayMat('#f2b23a', '#d98a2c', '#a85a34'), footMatP = clayMat('#e89a30', '#c87428', '#984a30');
  const puffGeo = new THREE.SphereGeometry(PUFF_R, 48, 32); puffGeo.scale(1, 0.97, 0.98);
  const bumpGeo = new THREE.SphereGeometry(0.024, 10, 8);
  // bump layout: an even scatter over the sphere, keeping the face clear
  const BUMPS = [];
  for (let i = 0, n = 84; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    const d = V(Math.cos(th) * r, y, Math.sin(th) * r);
    if (d.z > 0.35 && Math.abs(d.x) < 0.62 && d.y > -0.5 && d.y < 0.32) continue;
    BUMPS.push(d);
  }
  function fanGeo(rad, spread) {
    const sh = new THREE.Shape(), N = 40, scal = 3;
    sh.moveTo(0, 0);
    for (let i = 0; i <= N; i++) {
      const a = -spread / 2 + spread * i / N, rr = rad * (0.95 + 0.05 * Math.abs(Math.cos(i / N * Math.PI * scal))) * (0.82 + 0.18 * Math.sin(Math.PI * i / N));
      sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.016, bevelSegments: 4, curveSegments: 6 });
    g.translate(0, 0, -0.008); g.computeVertexNormals();
    return g;
  }
  const pectGeo = fanGeo(0.16, 1.15), dorsalGeo = fanGeo(0.17, 1.1), tailGeo = fanGeo(0.19, 1.3);
  const beadGeo = new THREE.SphereGeometry(0.034, 14, 10); beadGeo.scale(1, 1.1, 0.4);
  const dotBlushGeo = new THREE.SphereGeometry(0.028, 12, 8); dotBlushGeo.scale(1.15, 0.85, 0.3);
  const dotBlushMat = new THREE.MeshBasicMaterial({ color: 0xf06f78, opacity: 0.5 });
  const glintGeo3 = new THREE.SphereGeometry(0.011, 8, 6); glintGeo3.scale(1, 1, 0.3);
  const beadMat = new THREE.MeshBasicMaterial({ color: 0x1a1214, opacity: 0.5 });
  const glintMat3 = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const smileGeo3 = new THREE.TorusGeometry(0.036, 0.0085, 8, 18, Math.PI); smileGeo3.rotateZ(Math.PI);
  const happyGeo3 = new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI);
  const EYE_X = 0.13, EYE_Y = -0.005;
  const surfZ = (x, y) => Math.sqrt(Math.max(0, PUFF_R * PUFF_R - x * x - y * y)) * 0.98;
  const MOODS = {
    calm:    { sy: 1.0, puff: 1.0 },
    content: { sy: 1.0, puff: 1.0 },
    curious: { sy: 1.08, puff: 1.0 },
    sleepy:  { sy: 0.42, puff: 0.97 },
    happy:   { sy: 1.0, puff: 1.16 }
  };
  const IDLE_MOODS = ['calm', 'calm', 'calm', 'content', 'content', 'sleepy', 'curious'];

  // ================= wardrobe =================
  // Cloth uses the same three-tone paint as the bodies: a lit tone, a warmer/darker shadow, a deep tone leaning violet.
  const clothCache = {};
  function cloth(hex, stripeHex = null, stripes = 0) {
    const key = hex + (stripeHex || '') + stripes;
    if (clothCache[key]) return clothCache[key];
    const b = col(hex), sh = b.clone().offsetHSL(0.012, 0.04, -0.15), dp = b.clone().offsetHSL(-0.04, -0.02, -0.3);
    const m = clayMat('#' + b.getHexString(), '#' + sh.getHexString(), '#' + dp.getHexString());
    if (stripeHex) { m.uniforms.uStripeCol.value = col(stripeHex); m.uniforms.uStripeF.value = stripes; }
    return (clothCache[key] = m);
  }
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  function tones(hex) {
    const b = col(hex), sh = b.clone().offsetHSL(0.012, 0.04, -0.15), dp = b.clone().offsetHSL(-0.04, -0.02, -0.3);
    return ['#' + b.getHexString(), '#' + sh.getHexString(), '#' + dp.getHexString()];
  }
  function garment(parent, geo, hex, o = {}) {
    const m = clayMat(...tones(hex));
    m.uniforms.uClipY.value = o.clipY ?? 1e3; m.uniforms.uClipZ.value = o.clipZ ?? 1e3;
    if (o.stripe) { m.uniforms.uStripeCol.value = col(o.stripe); m.uniforms.uStripeF.value = o.stripeF || 60; m.uniforms.uStripeMode.value = 1; }
    const mesh = new THREE.Mesh(geo, m);
    const k = o.inflate || 1.04; mesh.scale.set(k * (o.sx || 1), k * (o.sy || 1), k * (o.sz || 1));
    if (o.y) mesh.position.y = o.y;
    mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function strapCurve(x, r, a0, a1) {   // a strap running over the body in the y–z plane at side offset x
    const pts = []; for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; pts.push(V(x, r * Math.sin(a), r * Math.cos(a))); }
    return new THREE.CatmullRomCurve3(pts);
  }
  const wear = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m;
  };
  // shared shapes
  const domeGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const discGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
  const ringGeo = (r, t = 0.16) => new THREE.TorusGeometry(r, r * t, 8, 40);

  // yellow folk: builders. hard hats or knit beanies, sometimes a leather tool belt with a pouch
  function dressFolk(puff) {
    const R0 = PUFF_R, hat = rnd();
    if (hat < 0.5) {
      const m = cloth(pick(['#2f62d8', '#f4f1e8', '#e2483a', '#2f9e6a']));
      const g = new THREE.Group(); g.position.set(0, R0 * 0.78, -0.01); g.rotation.set(-0.12, 0, R(-0.12, 0.12)); puff.add(g);
      const dome = wear(g, domeGeo, m, 0, 0, 0); dome.scale.set(0.21, 0.17, 0.22);
      const brim = wear(g, discGeo, m, 0, 0.005, 0.03); brim.scale.set(0.27, 0.018, 0.3);
      wear(g, new THREE.BoxGeometry(0.035, 0.03, 0.3), m, 0, 0.165, 0.0, 0.0).scale.set(1, 1, 1);   // ridge along the top
    } else if (hat < 0.8) {
      const knit = pick([['#d8433f', '#f4ead6'], ['#1f3f78', '#e7d7b8'], ['#2b8a7a', '#f3c64a'], ['#7a3d8c', '#f0a0a8']]);
      const g = new THREE.Group(); g.position.set(0, R0 * 0.72, -0.02); g.rotation.set(-0.15, 0, R(-0.15, 0.15)); puff.add(g);
      const dome = wear(g, domeGeo, cloth(knit[0]), 0, 0, 0); dome.scale.set(0.23, 0.2, 0.235);
      const band = wear(g, ringGeo(0.225), cloth(knit[1], knit[0], 14), 0, 0.01, 0, Math.PI / 2); band.scale.set(1, 1, 1.6);
      const pom = wear(g, new THREE.SphereGeometry(0.05, 10, 8), cloth(knit[1]), 0, 0.2, 0);
    }
    if (rnd() < 0.6) {
      // overalls
      const oh = pick(['#3f6fb8', '#2f4f86', '#c98a2e', '#4f7a52', '#b8543a']);
      garment(puff, puffGeo, oh, { clipY: -0.1, inflate: 1.035 });
      [-1, 1].forEach(sd => {
        const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve(sd * 0.215, Math.sqrt(R0 * R0 - 0.215 * 0.215) * 1.04, -0.42, Math.PI + 0.42), 32, 0.017, 6), cloth(oh));
        strap.castShadow = true; puff.add(strap);
        wear(puff, new THREE.SphereGeometry(0.018, 8, 6), cloth('#e9d9a8'), sd * 0.215, -0.1, Math.sqrt(R0 * R0 - 0.215 * 0.215 - 0.01) * 1.05);   // brass button
      });
      wear(puff, new THREE.BoxGeometry(0.09, 0.06, 0.02), cloth('#' + col(oh).offsetHSL(0, 0, -0.08).getHexString()), 0, -0.17, R0 * 0.93, -0.5);   // bib pocket
    } else {
      // a work sweater with a ribbed hem, and the tool belt
      const sh = pick(['#e2483a', '#f4ead6', '#2b8a7a', '#7a3d8c', '#1f3f78']);
      garment(puff, puffGeo, sh, { clipY: -0.08, inflate: 1.035 });
      const belt = wear(puff, ringGeo(R0 * 0.87, 0.085), cloth('#8a5230'), 0, -R0 * 0.6, 0, Math.PI / 2); belt.scale.set(1, 1, 1.5);
      const pouch = wear(puff, new THREE.BoxGeometry(0.08, 0.07, 0.05), cloth('#6e3f22'), R0 * 0.62, -R0 * 0.66, R0 * 0.56, 0, 0.8, 0);
      wear(puff, new THREE.BoxGeometry(0.02, 0.06, 0.02), cloth('#b8c0c8'), R0 * 0.61, -R0 * 0.52, R0 * 0.59, 0, 0.8, 0.2);   // a little tool handle
    }
  }
  // loaves: bakers. tall white toques or flat caps, little aprons below the face
  function dressLoaf(body) {
    garment(body, loafGeo, pick(['#f6f1e6', '#eae4f6', '#dbe8f4', '#f3d9c4']), { clipY: 0.165, inflate: 1.035 });   // smock
    const top = LOAF.h * 2, front = LOAF.d * 1.035 + 0.004, r = rnd();
    if (r < 0.6) {
      const m = cloth('#f6f1e6');
      const band = wear(body, discGeo, m, 0, top + 0.03, 0); band.scale.set(0.13, 0.07, 0.13);
      [[0, 0.13, 0, 0.11], [-0.07, 0.11, 0.02, 0.08], [0.07, 0.11, 0.02, 0.08], [0, 0.12, -0.06, 0.08], [0, 0.17, 0, 0.08]].forEach(([x, y, z, rr]) => wear(body, new THREE.SphereGeometry(rr, 12, 8), m, x, top + y, z));
    } else if (r < 0.85) {
      const m = cloth(pick(['#5a4636', '#3d4a6b', '#7a5a3a']));
      const capT = wear(body, domeGeo, m, 0, top - 0.01, -0.01); capT.scale.set(0.2, 0.08, 0.2);
      const peak = wear(body, discGeo, m, 0, top - 0.005, 0.12, 0.12); peak.scale.set(0.13, 0.015, 0.1);
    }
    if (rnd() < 0.75) {
      const ah = pick(['#f3e9d4', '#e07a4f', '#f2c14e', '#e9e2f6']), am = cloth(ah);
      const apron = wear(body, new THREE.BoxGeometry(0.3, 0.14, 0.016), am, 0, 0.09, front + 0.006); apron.rotation.x = -0.05;
      wear(body, new THREE.BoxGeometry(0.12, 0.05, 0.012), cloth('#' + col(ah).offsetHSL(0, 0, -0.1).getHexString()), 0, 0.075, front + 0.016);   // pocket
      [-1, 1].forEach(sd => wear(body, new THREE.BoxGeometry(0.012, 0.025, 0.2), am, sd * (LOAF.w * 1.035 + 0.006), 0.15, front * 0.5));        // ties around the sides
    }
  }
  // drops: Mediterranean flair. berets on the knob, Breton-striped scarves at the neck
  function dressDrop(body) {
    const top = pick([['#f4efe4', '#1f3f78'], ['#f4efe4', '#c8333b'], ['#1f3f78', '#f4efe4'], ['#f2c14e', null], ['#3c7a4a', null]]);
    garment(body, dropGeo, top[0], { clipY: 0.135, inflate: 1.04, stripe: top[1], stripeF: 95 });
    if (rnd() < 0.6) {
      const m = cloth(pick(['#1e2a4a', '#2a2a2e', '#5b6b2f', '#7a2335']));
      const g = new THREE.Group(); g.position.set(0, 0.6, 0); g.rotation.set(0.1, 0, R(0.2, 0.4) * (rnd() < 0.5 ? -1 : 1)); body.add(g);
      const b = wear(g, new THREE.SphereGeometry(1, 20, 12), m, 0, 0.02, 0); b.scale.set(0.12, 0.04, 0.12);
      wear(g, new THREE.CylinderGeometry(0.008, 0.012, 0.035, 6), m, 0, 0.065, 0);
    }
    if (rnd() < 0.7) {
      const sc = pick([['#f4efe4', '#1f3f78'], ['#f4efe4', '#c8333b'], ['#1f3f78', '#f4efe4']]);
      const ring = wear(body, ringGeo(0.165), cloth(sc[0], sc[1], 18), 0, 0.4, 0.005, Math.PI / 2 - 0.08); ring.scale.set(1, 1, 1.5);
      const tail = wear(body, new THREE.BoxGeometry(0.05, 0.13, 0.025), cloth(sc[0]), 0.1, 0.33, 0.15, 0.3, 0.5, 0.35);
    }
  }
  // scoots: couriers. a satchel on the back, sometimes a neck scarf
  function dressScoot(body) {
    const jk = pick(['#2e5b8a', '#c8543a', '#3c7a4a', '#d99a2b', '#3a3550']);
    garment(body, scootGeo, jk, { clipZ: 0.06, inflate: 1.045 });
    if (rnd() < 0.8) {
      const bh = pick(['#d99a2b', '#3c7a4a', '#c8543a', '#2e5b8a']), m = cloth(bh);
      wear(body, new THREE.BoxGeometry(0.2, 0.11, 0.14), m, 0, 0.39, -0.08, 0.15);
      wear(body, new THREE.BoxGeometry(0.21, 0.03, 0.15), cloth('#' + col(bh).offsetHSL(0, 0, -0.1).getHexString()), 0, 0.455, -0.075, 0.15);   // flap
      [-1, 1].forEach(sd => { const st = wear(body, ringGeo(0.19), cloth('#5a3a24'), sd * 0.09, 0.22, 0.02, 0, Math.PI / 2, 0); st.scale.set(1, 1.05, 0.5); });
    }
    if (rnd() < 0.45) {
      const ring = wear(body, ringGeo(0.195, 0.12), cloth(pick(['#f2c14e', '#e85a71', '#3fb6a8'])), 0, 0.2, 0.04); ring.scale.set(1.04, 1.0, 1.6);
    }
  }
  const creatures = [];
  const blobTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(60,40,48,0.42)'); gr.addColorStop(0.6, 'rgba(60,40,48,0.26)'); gr.addColorStop(1, 'rgba(60,40,48,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const blobGeo = new THREE.CircleGeometry(PUFF_R * 1.05, 24); blobGeo.rotateX(-Math.PI / 2);
  function makeCreature(i) {
    const v = i % PUFF_COLS.length;
    const root = new THREE.Group(), body = new THREE.Group(), puff = new THREE.Group();
    body.position.y = HIP + PUFF_R * 0.95; body.add(puff); root.add(body);
    const ball = new THREE.Mesh(puffGeo, bodyMats[v]); ball.castShadow = true; puff.add(ball);
    // face
    const eyes = [-1, 1].map(sd => {
      const x = sd * EYE_X, g = new THREE.Group();
      g.position.set(x, EYE_Y, surfZ(x, EYE_Y) - 0.006); g.rotation.y = sd * 0.45;
      g.add(new THREE.Mesh(beadGeo, beadMat)); puff.add(g); return g;
    });
    const arcs = [-1, 1].map(sd => {
      const x = sd * EYE_X, m = new THREE.Mesh(happyGeo3, beadMat);
      m.position.set(x, EYE_Y - 0.012, surfZ(x, EYE_Y) + 0.002); m.rotation.y = sd * 0.45; m.visible = false; puff.add(m); return m;
    });
    const smile = new THREE.Mesh(smileGeo3, beadMat); smile.visible = false;   // this face has no mouth
    const blush = [-1, 1].map(sd => {
      const x = sd * (EYE_X + 0.055), y = EYE_Y - 0.035, m = new THREE.Mesh(dotBlushGeo, dotBlushMat);
      m.position.set(x, y, surfZ(x, y) + 0.002); m.rotation.y = sd * 0.6; puff.add(m); return m;
    });
    // arms
    const arms = [-1, 1].map(sd => {
      const sh = new THREE.Group(); sh.position.set(sd * (PUFF_R * 0.9), -0.02, 0.02); sh.rotation.z = sd * 0.3;
      const a = new THREE.Mesh(armGeoP, bodyMats[v]), h = new THREE.Mesh(handGeoP, bodyMats[v]);
      a.castShadow = h.castShadow = true; sh.add(a, h); puff.add(sh); return sh;
    });
    // the body is painted with the rest of the world; only the face is laid on top so it stays readable
    // legs live in world space so feet can stay planted on the ground while the body moves over them
    const legs = [-1, 1].map(sd => {
      const leg = new THREE.Mesh(legGeoP, legMatP), foot = new THREE.Mesh(footGeoP, footMatP);
      leg.castShadow = foot.castShadow = true;
      [leg, foot].forEach(m => { m.layers.enable(FACE_LAYER); scene.add(m); colourOnly.push(m); });
      return { sd, leg, foot, pos: V(), from: V(), to: V(), t: 1, dur: 0.18, lift: 0 };
    });
    dressFolk(puff);
    const faceParts = new Set([...eyes.flatMap(g => g.children), ...arcs, smile, ...blush]);
    root.traverse(o => { if (!o.isMesh) return; if (!faceParts.has(o)) o.layers.enable(MASK_LAYER); o.layers.enable(FACE_LAYER); });   // where the pencil lines must stop
    const sc = R(1.6, 2.0); root.scale.setScalar(sc);
    const sp = nav.spots[Math.floor(rnd() * nav.spots.length)];
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE_LAYER); blob.visible = false; scene.add(blob);
    const c = { root, body, puff, eyes, arcs, smile, arms, legs, blob, dip: 0, sway: 0, stride: 0, placed: false,
      pos: V(sp[0] + R(-1.5, 1.5), 0, sp[1] + R(-0.8, 0.8)), vel: V(0, 0, 0),
      heading: R(0, 6.28), speed: R(0.9, 1.4) / Math.sqrt(sc), phase: R(0, 6.28), wait: R(0, 6), hop: 0, path: [], fidget: R(0, 6.28),
      blink: 0, nextBlink: R(1, 5), mood: 'calm', moodT: R(2, 6), tilt: 0, puffK: 1, sy: 1,
      lookViewer: rnd() < 0.12, lookSwap: R(4, 14) };
    root.position.copy(c.pos);
    scene.add(root); creatures.push(c); colourOnly.push(root);   // no keylines around them
    return c;
  }


  // ================= shared leg rig =================
  // Legs live in world space: each foot stays planted where it lands; a foot steps when the body has
  // moved far enough past it. The leg is a stretched cylinder from the hip (inside the body) to the ankle.
  const allLimbs = [];
  function makeLegSet(specs, legMat, footMat, thick = 1, footScale = 1) {
    return specs.map(([sd, fz]) => {
      const leg = new THREE.Mesh(legGeoP, legMat), foot = new THREE.Mesh(footGeoP, footMat);
      leg.castShadow = foot.castShadow = true;
      [leg, foot].forEach(m => { m.layers.enable(FACE_LAYER); scene.add(m); colourOnly.push(m); allLimbs.push(m); });
      return { sd, fz, leg, foot, pos: V(), from: V(), to: V(), home: V(), t: 1, dur: 0.18, lift: 0, thick, footScale };
    });
  }
  function stepLegs(a, legs, dt, o) {
    const sc = a.sc, h = a.heading, sp = a.vel.length();
    const side = V(Math.cos(h), 0, -Math.sin(h)), fwd = V(Math.sin(h), 0, Math.cos(h));
    legs.forEach(f => {
      f.home.copy(a.pos).addScaledVector(side, f.sd * o.spread * sc).addScaledVector(fwd, f.fz * sc).addScaledVector(a.vel, 0.14);
      if (!a.legsPlaced) { f.pos.copy(f.home); f.t = 1; }
    });
    a.legsPlaced = true;
    if (legs.filter(f => f.t < 1).length < (o.maxSwing || 1)) {
      let best = null, bd = 0;
      legs.forEach(f => { if (f.t < 1) return; const d = Math.hypot(f.pos.x - f.home.x, f.pos.z - f.home.z); if (d > bd) { bd = d; best = f; } });
      if (best && bd > (sp > 0.1 ? 0.045 : 0.03) * sc) {
        best.from.copy(best.pos); best.to.copy(best.home).addScaledVector(a.vel, 0.1);
        best.t = 0; best.dur = THREE.MathUtils.clamp(o.dur - sp * 0.05, 0.1, o.dur);
      }
    }
    let landed = false, swinging = null;
    legs.forEach(f => {
      if (f.t < 1) {
        f.t = Math.min(1, f.t + dt / f.dur);
        const e = f.t * f.t * (3 - 2 * f.t);
        f.pos.lerpVectors(f.from, f.to, e);
        f.lift = Math.sin(Math.PI * f.t) * o.lift * sc; swinging = f;
        if (f.t >= 1) { f.lift = 0; landed = true; }
      }
    });
    return { landed, swinging };
  }
  function poseLegs(a, legs, hipLocal, ankleY = null) {
    a.root.updateMatrixWorld(true);
    legs.forEach(f => {
      const hip = a.root.localToWorld(hipLocal(f));
      const ankle = V(f.pos.x, (ankleY === null ? f.lift : ankleY(f)) + 0.03 * a.sc, f.pos.z);
      const dir = hip.clone().sub(ankle), len = Math.max(0.01, dir.length());
      f.leg.position.copy(ankle);
      f.leg.quaternion.setFromUnitVectors(Y, dir.divideScalar(len));
      f.leg.scale.set(a.sc * f.thick, len, a.sc * f.thick);
      f.foot.position.copy(ankle); f.foot.rotation.set(0, a.heading, 0); f.foot.scale.setScalar(a.sc * f.footScale);
    });
  }

  // ================= second species: "loaves" =================
  // Soft rounded little loaves in sea-glass teal with two ear nubs, close-set oval eyes and a tiny mouth.
  // They don't walk: they get around in springy hops (crouch, launch, land, settle).
  let LOAF, loafGeo, LOAF_COLS, loafMats, earGeo, loafEyeGeo, loafEyeMat, loafMouthGeo, loafOGeo, loafMouthMat;
  function initLoaves() {
    if (loafGeo) return;
    LOAF = { w: 0.25, h: 0.23, d: 0.22, r: 0.13 };
    loafGeo = (() => {
      const g = new THREE.BoxGeometry(LOAF.w * 2, LOAF.h * 2, LOAF.d * 2, 10, 10, 10);
      const p = g.attributes.position, n = g.attributes.normal, inner = V(LOAF.w - LOAF.r, LOAF.h - LOAF.r, LOAF.d - LOAF.r);
      const v = V(0, 0, 0), cl = V(0, 0, 0);
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i));
        cl.set(THREE.MathUtils.clamp(v.x, -inner.x, inner.x), THREE.MathUtils.clamp(v.y, -inner.y, inner.y), THREE.MathUtils.clamp(v.z, -inner.z, inner.z));
        const dir = v.clone().sub(cl).normalize();
        v.copy(cl).addScaledVector(dir, LOAF.r);
        p.setXYZ(i, v.x, v.y + LOAF.h, v.z); n.setXYZ(i, dir.x, dir.y, dir.z);   // pivot at the bottom so squash comes from the ground
      }
      return g;
    })();
    LOAF_COLS = [['#4cc7b8', '#2a9497', '#1d5a7c'], ['#5fd0c0', '#33a09e', '#22628a'], ['#41bdb0', '#25898e', '#1a5274'], ['#6ad6c3', '#3aa8a0', '#266a8c']];
    loafMats = LOAF_COLS.map(([b, sh, dp]) => clayMat(b, sh, dp));
    earGeo = new THREE.SphereGeometry(0.06, 12, 8); earGeo.scale(1, 0.85, 0.8);
    loafEyeGeo = new THREE.SphereGeometry(0.026, 12, 8); loafEyeGeo.scale(0.8, 1.25, 0.35);
    loafEyeMat = new THREE.MeshBasicMaterial({ color: 0x14202c, opacity: 0.5 });
    loafMouthGeo = new THREE.TorusGeometry(0.018, 0.006, 6, 12, Math.PI); loafMouthGeo.rotateZ(Math.PI);
    loafOGeo = new THREE.SphereGeometry(0.017, 10, 8); loafOGeo.scale(1, 1.2, 0.3);
    loafMouthMat = new THREE.MeshBasicMaterial({ color: 0x1e2232, opacity: 0.5 });
  }
  const hoppers = [];
  function makeHopper(i) {
    initLoaves();
    const v = i % LOAF_COLS.length, root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const loaf = new THREE.Mesh(loafGeo, loafMats[v]); loaf.castShadow = true; body.add(loaf);
    const front = LOAF.d + 0.004;
    [-1, 1].forEach(sd => { const e = new THREE.Mesh(earGeo, loafMats[v]); e.position.set(sd * 0.15, LOAF.h * 2 - 0.01, -0.02); e.castShadow = true; body.add(e); });
    const eyes = [-1, 1].map(sd => { const e = new THREE.Mesh(loafEyeGeo, loafEyeMat); e.position.set(sd * 0.055, LOAF.h * 1.08, front); body.add(e); return e; });
    const smile = new THREE.Mesh(loafMouthGeo, loafMouthMat); smile.position.set(0, LOAF.h * 0.82, front); body.add(smile);
    const oMouth = new THREE.Mesh(loafOGeo, loafMouthMat); oMouth.position.set(0, LOAF.h * 0.8, front); oMouth.visible = false; body.add(oMouth);
    dressLoaf(body);
    root.traverse(o => { if (o.isMesh) o.layers.enable(FACE_LAYER); });
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE_LAYER); blob.visible = false; scene.add(blob);
    const sc = R(1.4, 1.75); root.scale.setScalar(sc);
    const legs = makeLegSet([[-1, 0], [1, 0]], clayMat('#2a9497', '#1d6f7c', '#164a66'), clayMat('#1d5a7c', '#164a66', '#10344c'), 1.0, 0.95);
    const sp = nav.spots[Math.floor(rnd() * nav.spots.length)];
    const h = { root, body, eyes, smile, oMouth, blob, sc, legs, vel: V(0, 0, 0), LH: 0.085,
      pos: V(sp[0] + R(-1.5, 1.5), 0, sp[1] + R(-0.8, 0.8)), heading: R(0, 6.28), path: [], wait: R(0, 5),
      state: 'rest', st: R(0, 0.5), from: V(), to: V(), air: 0.4, hopH: 0.3, squash: 1, sqV: 0,
      blink: 0, nextBlink: R(1, 5), lookViewer: rnd() < 0.15, lookSwap: R(4, 12), fidget: R(0, 6.28) };
    root.position.copy(h.pos);
    scene.add(root); hoppers.push(h); colourOnly.push(root);
    return h;
  }

  // ================= third species: "drops" =================
  // Coral gumdrop-shaped folk with a little knob on top, sleepy dash eyes, rosy cheeks and nub arms.
  // They waddle like a weeble: rocking side to side and twisting forward on their round bottoms.
  let DROP, dropGeo, dropR, DROP_COLS, dropMats, dashGeo, dropInk, cheekGeo3, cheekMat3, tinySmile, nubGeo;
  function initDrops() {
    if (dropGeo) return;
    DROP = [[0,0],[0.12,0.005],[0.2,0.03],[0.245,0.09],[0.255,0.16],[0.24,0.25],[0.205,0.34],[0.16,0.42],[0.11,0.49],[0.07,0.545],[0.045,0.58],[0.04,0.61],[0.052,0.635],[0.042,0.66],[0,0.67]].map(p => new THREE.Vector2(p[0], p[1]));
    dropGeo = new THREE.LatheGeometry(DROP, 36); dropGeo.computeVertexNormals();
    dropR = y => { for (let i = 1; i < DROP.length; i++) if (DROP[i].y >= y) { const a = DROP[i - 1], b = DROP[i]; return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y); } return 0; };
    DROP_COLS = [['#ff8f78', '#e65d6c', '#a23a64'], ['#ff9c82', '#ea6a72', '#a8436a'], ['#fb7f6e', '#de4f64', '#96325e'], ['#ffa88e', '#ee7678', '#b04c70']];
    dropMats = DROP_COLS.map(([b, sh, dp]) => clayMat(b, sh, dp));
    dashGeo = new THREE.SphereGeometry(0.026, 12, 8); dashGeo.scale(1.3, 0.42, 0.3);
    dropInk = new THREE.MeshBasicMaterial({ color: 0x34182a, opacity: 0.5 });
    cheekGeo3 = new THREE.SphereGeometry(0.03, 12, 8); cheekGeo3.scale(1.2, 0.75, 0.3);
    cheekMat3 = new THREE.MeshBasicMaterial({ color: 0xd8405a, opacity: 0.5 });
    tinySmile = new THREE.TorusGeometry(0.014, 0.005, 6, 12, Math.PI); tinySmile.rotateZ(Math.PI);
    nubGeo = new THREE.SphereGeometry(0.045, 10, 8); nubGeo.scale(0.75, 1.1, 0.8);
  }
  const drops = [];
  function onDrop(parent, mesh, x, y, lift = 0.003) {
    const r = dropR(y), z = Math.sqrt(Math.max(0, r * r - x * x));
    mesh.position.set(x, y, z + lift); mesh.rotation.y = Math.atan2(x, z); parent.add(mesh); return mesh;
  }
  function makeDrop(i) {
    initDrops();
    const v = i % DROP_COLS.length, root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const shell = new THREE.Mesh(dropGeo, dropMats[v]); shell.castShadow = true; body.add(shell);
    const eyes = [-1, 1].map(sd => onDrop(body, new THREE.Mesh(dashGeo, dropInk), sd * 0.072, 0.235));
    [-1, 1].forEach(sd => onDrop(body, new THREE.Mesh(cheekGeo3, cheekMat3), sd * 0.135, 0.19, 0.002));
    onDrop(body, new THREE.Mesh(tinySmile, dropInk), 0, 0.185);
    const arms = [-1, 1].map(sd => { const a = new THREE.Group(); a.position.set(sd * 0.24, 0.16, 0.02); const m = new THREE.Mesh(nubGeo, dropMats[v]); m.position.y = -0.03; m.castShadow = true; a.add(m); body.add(a); return a; });
    dressDrop(body);
    root.traverse(o => { if (o.isMesh) o.layers.enable(FACE_LAYER); });
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE_LAYER); blob.visible = false; scene.add(blob);
    const sc = R(1.45, 1.8); root.scale.setScalar(sc);
    const legs = makeLegSet([[-1, 0], [1, 0]], clayMat('#e65d6c', '#c44660', '#8e2f58'), clayMat('#a23a64', '#842f58', '#5e2448'), 0.95, 0.9);
    const sp = nav.spots[Math.floor(rnd() * nav.spots.length)];
    const d = { root, body, eyes, arms, blob, sc, legs, LH: 0.1, pos: V(sp[0] + R(-1.5, 1.5), 0, sp[1] + R(-0.8, 0.8)), vel: V(0, 0, 0),
      heading: R(0, 6.28), speed: R(0.55, 0.85), path: [], wait: R(0, 5), phase: R(0, 6.28), rockAmp: 0,
      blink: 0, nextBlink: R(1, 5), wide: 0, lookViewer: rnd() < 0.15, lookSwap: R(4, 12), fidget: R(0, 6.28) };
    root.position.copy(d.pos);
    scene.add(root); drops.push(d); colourOnly.push(root);
    return d;
  }

  // ================= fourth species: "scoots" =================
  // Chubby lavender beans with two little feelers, glossy bead eyes and a tiny smile.
  // They travel like an inchworm: stretch forward, then gather up behind.
  let scootGeo, SCOOT_COLS, scootMats, feelerStalk, feelerTip, scootEyeGeo, scootShineGeo, scootInk, scootShine, scootSmile;
  function initScoots() {
    if (SCOOT_COLS) return;
    scootGeo = (() => {
      const g = new THREE.SphereGeometry(1, 36, 22); g.scale(0.2, 0.19, 0.34);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i), y = p.getY(i);
        p.setY(i, y + 0.19 + 0.06 * THREE.MathUtils.smoothstep(z, -0.05, 0.3) * (y > -0.1 ? 1 : 0.3));   // head end sits a little higher
      }
      g.computeVertexNormals(); return g;
    })();
    SCOOT_COLS = [['#b49af2', '#8668d6', '#4f3f9a'], ['#c3a6f6', '#9474dc', '#5a48a2'], ['#a68cec', '#7a5cce', '#46368e'], ['#ccb2f8', '#9f80e2', '#6250aa']];
    scootMats = SCOOT_COLS.map(([b, sh, dp]) => clayMat(b, sh, dp));
    feelerStalk = new THREE.CylinderGeometry(0.012, 0.016, 0.09, 6); feelerStalk.translate(0, 0.045, 0);
    feelerTip = new THREE.SphereGeometry(0.026, 10, 8); feelerTip.translate(0, 0.095, 0);
    scootEyeGeo = new THREE.SphereGeometry(0.03, 12, 10); scootEyeGeo.scale(1, 1.1, 0.45);
    scootShineGeo = new THREE.SphereGeometry(0.009, 6, 4); scootShineGeo.scale(1, 1, 0.3);
    scootInk = new THREE.MeshBasicMaterial({ color: 0x1c1430, opacity: 0.5 });
    scootShine = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5 });
    scootSmile = new THREE.TorusGeometry(0.016, 0.0055, 6, 12, Math.PI); scootSmile.rotateZ(Math.PI);
  }
  const scoots = [];
  function makeScoot(i) {
    initScoots();
    const v = i % SCOOT_COLS.length, root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const bean = new THREE.Mesh(scootGeo, scootMats[v]); bean.castShadow = true; body.add(bean);
    const eyes = [-1, 1].map(sd => {
      const g = new THREE.Group(); g.position.set(sd * 0.075, 0.29, 0.29); g.rotation.set(-0.25, sd * 0.35, 0);
      const sh = new THREE.Mesh(scootShineGeo, scootShine); sh.position.set(0.01, 0.012, 0.014);
      g.add(new THREE.Mesh(scootEyeGeo, scootInk), sh); body.add(g); return g;
    });
    const sm = new THREE.Mesh(scootSmile, scootInk); sm.position.set(0, 0.235, 0.335); sm.rotation.x = -0.4; body.add(sm);
    const feelers = [-1, 1].map(sd => {
      const g = new THREE.Group(); g.position.set(sd * 0.07, 0.37, 0.14); g.rotation.set(0.35, 0, -sd * 0.3);
      const st = new THREE.Mesh(feelerStalk, scootMats[v]), tp = new THREE.Mesh(feelerTip, scootMats[v]);
      g.add(st, tp); body.add(g); return g;
    });
    dressScoot(body);
    root.traverse(o => { if (o.isMesh) o.layers.enable(FACE_LAYER); });
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE_LAYER); blob.visible = false; scene.add(blob);
    const sc = R(1.5, 1.85); root.scale.setScalar(sc);
    const legs = makeLegSet([[-1, 0.13], [1, 0.13], [-1, -0.13], [1, -0.13]], clayMat('#8668d6', '#6a52b8', '#4f3f9a'), clayMat('#4f3f9a', '#3e3180', '#2c2460'), 0.8, 0.75);
    const sp = nav.spots[Math.floor(rnd() * nav.spots.length)];
    const d = { root, body, eyes, feelers, blob, sc, legs, LH: 0.08, pos: V(sp[0] + R(-1.5, 1.5), 0, sp[1] + R(-0.8, 0.8)), vel: V(0, 0, 0),
      heading: R(0, 6.28), speed: R(0.5, 0.75), path: [], wait: R(0, 5), phase: R(0, 6.28), amp: 0, feelLag: 0,
      blink: 0, nextBlink: R(1, 5), lookViewer: rnd() < 0.15, lookSwap: R(4, 12), fidget: R(0, 6.28) };
    root.position.copy(d.pos);
    scene.add(root); scoots.push(d); colourOnly.push(root);
    return d;
  }

  // ================= fifth species: "flits" =================
  // Small pistachio-green round folk that fly with a little propeller cap, legs dangling and kicking.
  let FLIT_COLS, flitMats, flitGeo, flitEye, flitMouth, flitInk, flitMouthMat, bladeGeo;
  function initFlits() {
    if (flitMats) return;
    FLIT_COLS = [['#a8dc6e', '#6fb35a', '#3f7a58'], ['#b6e27a', '#7dbb62', '#47805c'], ['#9ad466', '#64a852', '#376f52'], ['#8fd6a0', '#56ad78', '#2f6e5c'], ['#c4e07a', '#8db556', '#56794a'], ['#7fca8a', '#4f9e68', '#2c6352']];
    flitMats = FLIT_COLS.map(([b, sh, dp]) => clayMat(b, sh, dp));
    flitGeo = new THREE.SphereGeometry(0.24, 28, 20); flitGeo.scale(1, 0.94, 0.96);
    flitEye = new THREE.SphereGeometry(0.026, 10, 8); flitEye.scale(1, 1.15, 0.4);
    flitMouth = new THREE.SphereGeometry(0.02, 10, 6); flitMouth.scale(1.2, 0.9, 0.3);
    flitInk = new THREE.MeshBasicMaterial({ color: 0x1b2a1c, opacity: 0.5 });
    flitMouthMat = new THREE.MeshBasicMaterial({ color: 0x7a2e36, opacity: 0.5 });
    bladeGeo = new THREE.BoxGeometry(0.34, 0.012, 0.055);
  }
  const flits = [];
  function makeFlit(i) {
    initFlits();
    const v = i % FLIT_COLS.length, root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const ball = new THREE.Mesh(flitGeo, flitMats[v]); ball.castShadow = true; body.add(ball);
    const zf = y => Math.sqrt(Math.max(0, 0.24 * 0.24 - y * y)) * 0.96;
    const eyes = [-1, 1].map(sd => { const e = new THREE.Mesh(flitEye, flitInk); e.position.set(sd * 0.07, 0.02, zf(0.02) - 0.005); e.rotation.y = sd * 0.3; body.add(e); return e; });
    const mouth = new THREE.Mesh(flitMouth, flitMouthMat); mouth.position.set(0, -0.045, zf(-0.045) - 0.002); body.add(mouth);
    // propeller cap: a striped dome, a little stem, two spinning blades
    const capCols = pick([['#e2483a', '#f4ead6'], ['#2f62d8', '#f2c14e'], ['#f2c14e', '#e2483a'], ['#7a3d8c', '#f4ead6']]);
    const cap = new THREE.Mesh(domeGeo, cloth(capCols[0])); cap.scale.set(0.16, 0.1, 0.16); cap.position.y = 0.19; body.add(cap);
    const brim = new THREE.Mesh(discGeo, cloth(capCols[1])); brim.scale.set(0.12, 0.012, 0.12); brim.position.set(0, 0.2, 0.09); brim.rotation.x = 0.25; body.add(brim);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6), cloth('#d8d0c0')); stem.position.y = 0.32; body.add(stem);
    const prop = new THREE.Group(); prop.position.y = 0.36; body.add(prop);
    prop.add(new THREE.Mesh(bladeGeo, cloth(capCols[1])));
    if (rnd() < 0.6) { const scarf = new THREE.Mesh(ringGeo(0.2, 0.12), cloth(pick(['#f4ead6', '#e85a71', '#2f62d8']))); scarf.rotation.x = Math.PI / 2; scarf.position.y = -0.1; scarf.scale.set(1, 1, 1.4); body.add(scarf); }
    root.traverse(o => { if (o.isMesh) { o.layers.enable(FACE_LAYER); o.castShadow = true; } });
    const legs = makeLegSet([[-1, 0], [1, 0]], clayMat('#6fb35a', '#4f8f4c', '#3f7a58'), clayMat('#3f7a58', '#2f5e48', '#244a3c'), 0.8, 0.8);
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE_LAYER); blob.visible = false; scene.add(blob);
    const sc = rnd() < 0.3 ? R(0.85, 1.1) : R(1.25, 1.6); root.scale.setScalar(sc);   // a few little ones
    const f = { root, body, eyes, mouth, prop, legs, blob, sc,
      pos: V(R(-9, 9), R(2.5, 5.5), R(-11, 12)), vel: V(R(-1, 1), 0, R(-1, 1)), heading: 0, goal: null, route: [], hover: 0,
      speed: R(1.3, 1.9), phase: R(0, 6.28), blink: 0, nextBlink: R(1, 5), fidget: R(0, 6.28), bank: 0 };
    root.position.copy(f.pos);
    scene.add(root); flits.push(f); colourOnly.push(root);
    return f;
  }

  // ================= green walkers: "pips" =================
  // The flits' cousins who stay on the ground: same round green body and face, little legs and nub arms,
  // knit caps or bare heads, a happy bounce in the step.
  const pips = [];
  function makePip(i) {
    initDrops(); initFlits();
    const v = (i + 2) % FLIT_COLS.length, root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const ball = new THREE.Mesh(flitGeo, flitMats[v]); ball.castShadow = true; body.add(ball);
    const zf = y => Math.sqrt(Math.max(0, 0.24 * 0.24 - y * y)) * 0.96;
    const eyes = [-1, 1].map(sd => { const e = new THREE.Mesh(flitEye, flitInk); e.position.set(sd * 0.07, 0.01, zf(0.01) - 0.005); e.rotation.y = sd * 0.3; body.add(e); return e; });
    const mouth = new THREE.Mesh(flitMouth, flitMouthMat); mouth.position.set(0, -0.05, zf(-0.05) - 0.002); body.add(mouth);
    [-1, 1].forEach(sd => { const b = new THREE.Mesh(dotBlushGeo, dotBlushMat); b.position.set(sd * 0.12, -0.03, zf(-0.03) - 0.004); b.rotation.y = sd * 0.5; body.add(b); });
    const arms = [-1, 1].map(sd => { const a = new THREE.Group(); a.position.set(sd * 0.225, -0.04, 0.02); const m = new THREE.Mesh(nubGeo, flitMats[v]); m.position.y = -0.03; m.castShadow = true; a.add(m); body.add(a); return a; });
    const hat = rnd();
    if (hat < 0.45) {
      const knit = pick([['#f2c14e', '#e2483a'], ['#e85a71', '#f4ead6'], ['#2f62d8', '#f4ead6'], ['#f4ead6', '#3f7a58']]);
      const g = new THREE.Group(); g.position.set(0, 0.15, -0.01); g.rotation.set(-0.15, 0, R(-0.15, 0.15)); body.add(g);
      const dome = new THREE.Mesh(domeGeo, cloth(knit[0])); dome.scale.set(0.17, 0.15, 0.175); g.add(dome);
      const band = new THREE.Mesh(ringGeo(0.168), cloth(knit[1], knit[0], 14)); band.rotation.x = Math.PI / 2; band.scale.set(1, 1, 1.6); g.add(band);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), cloth(knit[1])); pom.position.y = 0.15; g.add(pom);
    } else if (hat < 0.7) {
      const sun = new THREE.Group(); sun.position.set(0, 0.17, 0); sun.rotation.set(-0.12, 0, R(-0.1, 0.1)); body.add(sun);   // straw sun hat
      const crown = new THREE.Mesh(domeGeo, cloth('#e9c77a')); crown.scale.set(0.14, 0.1, 0.14); sun.add(crown);
      const brim = new THREE.Mesh(discGeo, cloth('#e2bd6c')); brim.scale.set(0.27, 0.012, 0.27); sun.add(brim);
      const rib = new THREE.Mesh(ringGeo(0.141, 0.12), cloth(pick(['#e2483a', '#2f62d8', '#e85a71']))); rib.rotation.x = Math.PI / 2; rib.position.y = 0.02; rib.scale.set(1, 1, 1.6); sun.add(rib);
    }
    if (rnd() < 0.5) { const scarf = new THREE.Mesh(ringGeo(0.205, 0.12), cloth(pick(['#f4ead6', '#e85a71', '#f2c14e']))); scarf.rotation.x = Math.PI / 2; scarf.position.y = -0.11; scarf.scale.set(1, 1, 1.4); body.add(scarf); }
    root.traverse(o => { if (o.isMesh) o.layers.enable(FACE_LAYER); });
    const sc = rnd() < 0.3 ? R(1.0, 1.25) : R(1.35, 1.7); root.scale.setScalar(sc);
    const legs = makeLegSet([[-1, 0], [1, 0]], clayMat('#6fb35a', '#4f8f4c', '#3f7a58'), clayMat('#3f7a58', '#2f5e48', '#244a3c'), 0.85, 0.85);
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE_LAYER); blob.visible = false; scene.add(blob);
    const sp = nav.spots[Math.floor(rnd() * nav.spots.length)];
    const d = { root, body, eyes, arms, blob, sc, legs, LH: 0.09, pos: V(sp[0] + R(-1.5, 1.5), 0, sp[1] + R(-0.8, 0.8)), vel: V(0, 0, 0),
      heading: R(0, 6.28), speed: R(0.7, 1.05), path: [], wait: R(0, 5), hop: 0,
      blink: 0, nextBlink: R(1, 5), lookViewer: rnd() < 0.15, lookSwap: R(4, 12), fidget: R(0, 6.28) };
    root.position.copy(d.pos);
    scene.add(root); pips.push(d); colourOnly.push(root);
    return d;
  }

  // ================= second fliers: "floaties" =================
  // Little marshmallow-white folk in striped bathing suits who drift around hanging from beach parasols.
  // Slow and dreamy: they swing under the parasol like a pendulum, the canopy turns lazily, legs dangle.
  let floatBodyGeo, floatMat, canopyGeo, handleGeo;
  function initFloaties() {
    if (floatMat) return; initDrops(); initFlits();
    floatBodyGeo = new THREE.SphereGeometry(0.22, 26, 18); floatBodyGeo.scale(1, 1.05, 0.95);
    floatMat = clayMat('#f8f1e4', '#e6cfc4', '#b89aa8');
    canopyGeo = (() => { const g = new THREE.ConeGeometry(0.5, 0.16, 16, 1, false); g.rotateX(Math.PI / 2); return g; })();   // axis along local z so the stripe shader bands go round it
    handleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6); handleGeo.translate(0, -0.31, 0);
  }
  const floaties = [];
  function makeFloatie(i) {
    initFloaties();
    const root = new THREE.Group(), swing = new THREE.Group(), body = new THREE.Group();
    root.add(swing);
    // parasol
    const pc = pick([['#e2483a', '#f6efe2'], ['#2f62d8', '#f6efe2'], ['#f2c14e', '#f6efe2'], ['#2b8a7a', '#f2c14e'], ['#e85a71', '#f6efe2']]);
    const canopy = new THREE.Group(); root.add(canopy);
    const cone = new THREE.Mesh(canopyGeo, cloth(pc[0], pc[1], 8)); cone.rotation.x = -Math.PI / 2; cone.castShadow = true; canopy.add(cone);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), cloth(pc[0])); tip.position.y = 0.09; canopy.add(tip);
    const handle = new THREE.Mesh(handleGeo, cloth('#8a5a3a')); handle.position.y = 0.0; swing.add(handle);
    // the little one hanging on
    body.position.y = -0.82; swing.add(body);
    const ball = new THREE.Mesh(floatBodyGeo, floatMat); ball.castShadow = true; body.add(ball);
    garment(body, floatBodyGeo, pick(['#2f62d8', '#e2483a', '#2b8a7a', '#e85a71']), { clipY: -0.04, inflate: 1.04, stripe: '#f6efe2', stripeF: 120 });
    const zf = y => Math.sqrt(Math.max(0, 0.22 * 0.22 - y * y)) * 0.95;
    const eyes = [-1, 1].map(sd => { const e = new THREE.Mesh(flitEye, flitInk); e.scale.setScalar(0.9); e.position.set(sd * 0.065, 0.03, zf(0.03) - 0.004); e.rotation.y = sd * 0.3; body.add(e); return e; });
    [-1, 1].forEach(sd => { const b = new THREE.Mesh(dotBlushGeo, dotBlushMat); b.scale.setScalar(0.85); b.position.set(sd * 0.115, -0.005, zf(-0.005) - 0.004); b.rotation.y = sd * 0.5; body.add(b); });
    const sm = new THREE.Mesh(tinySmile, flitInk); sm.position.set(0, -0.015, zf(-0.015) + 0.002); body.add(sm);
    // one arm up holding the handle, one free to wave
    const armUp = new THREE.Group(); armUp.position.set(0.05, 0.17, 0.02); body.add(armUp);
    const up = new THREE.Mesh(nubGeo, floatMat); up.scale.set(0.8, 1.6, 0.8); up.position.y = 0.05; armUp.add(up);
    const wave = new THREE.Group(); wave.position.set(-0.2, 0.0, 0.02); body.add(wave);
    const wm = new THREE.Mesh(nubGeo, floatMat); wm.position.y = -0.03; wave.add(wm);
    root.traverse(o => { if (o.isMesh) o.layers.enable(FACE_LAYER); });
    const legs = makeLegSet([[-1, 0], [1, 0]], clayMat('#e6cfc4', '#cdb1aa', '#a88a98'), clayMat('#b89aa8', '#9a7e8e', '#7a6276'), 0.75, 0.75);
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE_LAYER); blob.visible = false; scene.add(blob);
    const sc = R(1.15, 1.45); root.scale.setScalar(sc);
    const f = { root, swing, canopy, body, eyes, wave, legs, blob, sc,
      pos: V(R(-9, 9), R(3.2, 6.5), R(-11, 12)), vel: V(0, 0, 0), heading: R(0, 6.28), route: [], hover: 0,
      speed: R(0.45, 0.75), swingV: V(0, 0, 0), swingA: V(0, 0, 0), lastVel: V(0, 0, 0),
      blink: 0, nextBlink: R(1, 5), fidget: R(0, 6.28), waveT: R(3, 8) };
    root.position.copy(f.pos);
    scene.add(root); floaties.push(f); colourOnly.push(root);
    return f;
  }
  function updateFloaties(dt, t) {
    floaties.forEach(f => {
      if (f.driven) return;   // seam: the game is walking / landing / launching this floatie itself this frame
      if (f.hover > 0) f.hover -= dt;
      if (!f.route.length) {
        if (f.controlled) f.route.push(f.pos.clone());   // held by the game: hang here until it sets a route
        else { nav.floatTarget(f); if (rnd() < 0.4) f.hover = R(2, 5); }
      }
      const to = f.route[0].clone().sub(f.pos), d = to.length();
      if (d < 0.8) f.route.shift();
      // a breeze-like drift: slow, a bit wandering
      const want = f.hover > 0 ? V(Math.sin(t * 0.3 + f.fidget) * 0.12, Math.sin(t * 0.5 + f.fidget) * 0.08, 0) : to.normalize().multiplyScalar(f.speed);
      want.x += Math.sin(t * 0.21 + f.fidget * 3) * 0.15;
      [...flits, ...floaties].forEach(o => { if (o === f) return; const dv = f.pos.clone().sub(o.pos), dd = dv.length(); if (dd < 1.8 && dd > 1e-4) want.addScaledVector(dv, (1.8 - dd) * 1.2 / dd); });
      nav.flyPush(f, want, 'floatie');   // reference: keep clear of the wall either side of the arch
      f.vel.lerp(want, 1 - Math.pow(0.4, dt));
      f.pos.addScaledVector(f.vel, dt);
      f.pos.y = Math.max(2.6, Math.min(8.2, f.pos.y));
      const hsp = Math.hypot(f.vel.x, f.vel.z);
      const wantH = hsp > 0.12 ? Math.atan2(f.vel.x, f.vel.z) : Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z);
      f.heading += wrapAngle(wantH - f.heading) * Math.min(1, dt * 1.2);
      // pendulum: the hanging body lags behind changes in velocity, then swings back
      const acc = f.vel.clone().sub(f.lastVel).divideScalar(Math.max(dt, 1e-3)); f.lastVel.copy(f.vel);
      const cosH = Math.cos(f.heading), sinH = Math.sin(f.heading);
      const accFwd = acc.x * sinH + acc.z * cosH, accSide = acc.x * cosH - acc.z * sinH;
      f.swingV.x += (-f.swingA.x * 9 - accFwd * 0.35 + Math.sin(t * 0.9 + f.fidget) * 0.25) * dt;   // pitch
      f.swingV.z += (-f.swingA.z * 9 + accSide * 0.35 + Math.sin(t * 0.7 + f.fidget * 2) * 0.2) * dt; // roll
      f.swingV.multiplyScalar(Math.pow(0.35, dt));
      f.swingA.addScaledVector(f.swingV, dt);
      f.swingA.x = THREE.MathUtils.clamp(f.swingA.x, -0.4, 0.4); f.swingA.z = THREE.MathUtils.clamp(f.swingA.z, -0.4, 0.4);
      const bob = Math.sin(t * 0.8 + f.fidget) * 0.12;
      f.root.position.set(f.pos.x, f.pos.y + bob, f.pos.z);
      f.root.rotation.set(0, f.heading, 0);
      f.swing.rotation.set(f.swingA.x + 0.1 * Math.min(1, hsp / f.speed), 0, f.swingA.z);
      f.canopy.rotation.set(-f.swingA.x * 0.35, f.canopy.rotation.y + dt * (0.5 + hsp * 0.6), -f.swingA.z * 0.35);
      f.body.rotation.set(0, Math.sin(t * 0.6 + f.fidget) * 0.25, 0);
      // the free arm waves now and then
      f.waveT -= dt; if (f.waveT < -1.6) f.waveT = R(4, 10);
      f.wave.rotation.z = f.waveT < 0 ? -(1.9 + Math.sin(t * 12) * 0.35) : -0.3;
      // legs dangle and paddle slowly
      f.root.updateMatrixWorld(true);
      f.legs.forEach(l => {
        const hip = f.body.localToWorld(V(l.sd * 0.07, -0.16, 0));
        const kick = Math.sin(t * 3 + f.fidget + l.sd * 1.6) * 0.03 * f.sc;
        const ankle = hip.clone().add(V(Math.sin(f.heading) * kick, -0.13 * f.sc, Math.cos(f.heading) * kick));
        const dir = hip.clone().sub(ankle), len = Math.max(0.01, dir.length());
        l.leg.position.copy(ankle); l.leg.quaternion.setFromUnitVectors(Y, dir.divideScalar(len)); l.leg.scale.set(f.sc * l.thick, len, f.sc * l.thick);
        l.foot.position.copy(ankle); l.foot.rotation.set(0, f.heading, 0); l.foot.scale.setScalar(f.sc * l.footScale);
        l.pos.copy(ankle);
      });
      f.blob.position.set(f.pos.x, 0.015, f.pos.z); f.blob.scale.setScalar(f.sc * 0.7 / (1 + f.pos.y * 0.25));
      f.nextBlink -= dt;
      if (f.nextBlink <= 0) { f.blink = 0.13; f.nextBlink = R(2.5, 6); }
      f.blink = Math.max(0, f.blink - dt);
      f.eyes.forEach(e => e.scale.y = f.blink > 0 ? 0.11 : 0.9);
    });
  }
  function updatePips(dt, t) {
    pips.forEach(d => {
      const push = V(0, 0, 0);
      let moving = false;
      if (d.wait > 0) {
        d.wait -= dt;
        if (d.wait <= 0 && !d.controlled) nav.pickTarget(d);
        if (d.hop <= 0 && rnd() < dt * 0.06) d.hop = 0.4;
        d.lookSwap -= dt;
        if (d.lookSwap <= 0) { d.lookViewer = !d.lookViewer && rnd() < 0.5; d.lookSwap = d.lookViewer ? R(1.5, 3) : R(5, 14); }
        const want = (d.lookViewer || flags.closeUp) ? Math.atan2(camera.position.x - d.pos.x, camera.position.z - d.pos.z) : Math.PI;
        d.heading += wrapAngle(want - d.heading) * Math.min(1, dt * 2);
      } else if (d.path.length) {
        const g = d.path[0], dx = g.x - d.pos.x, dz = g.z - d.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 0.45) { d.path.shift(); if (!d.path.length) { d.wait = R(4, 12); d.hop = 0.4; nav.onArrive(d); } }
        else { push.x += dx / dd * d.speed; push.z += dz / dd * d.speed; moving = true; }
      }
      [...creatures, ...hoppers, ...drops, ...scoots, ...pips].forEach(o => {
        if (o === d) return;
        const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z, dd = dx * dx + dz * dz;
        if (dd < 1.5 && dd > 1e-5) { const k = (1.22 - Math.sqrt(dd)) * 2.5; push.x += dx * k; push.z += dz * k; }
      });
      nav.obstacles.forEach(o => { const dx = d.pos.x - o[0], dz = d.pos.z - o[1], dd = Math.hypot(dx, dz), r = o[2] + 0.5; if (dd < r && dd > 1e-4) { const k = (r - dd) * 6 / dd; push.x += dx * k; push.z += dz * k; } });
      nav.extraPush(d, push, 'pip');   // reference: the pool channel and the arch wall
      if (moving) {
        const turn = wrapAngle(Math.atan2(push.x, push.z) - d.heading);
        d.heading += turn * Math.min(1, dt * 4.5);
        const spd = Math.min(Math.hypot(push.x, push.z), d.speed) * Math.max(0.2, Math.cos(turn));
        push.set(Math.sin(d.heading) * spd, 0, Math.cos(d.heading) * spd);
      } else { push.multiplyScalar(0.5); if (push.length() < 0.1) push.set(0, 0, 0); }
      d.vel.lerp(push, 1 - Math.pow(0.02, dt));
      d.pos.addScaledVector(d.vel, dt);
      nav.bounds(d.pos);
      const sp = d.vel.length(), w = Math.min(1, sp / 0.5);
      d.hop = Math.max(0, d.hop - dt);
      const hk = d.hop > 0 ? 1 - d.hop / 0.4 : 0, hopY = d.hop > 0 ? Math.sin(hk * Math.PI) * 0.22 : 0;
      d.root.position.set(d.pos.x, hopY, d.pos.z);
      d.root.rotation.y = d.heading;
      let stp = { landed: false, swinging: null };
      if (d.hop > 0) d.legs.forEach(f => { f.home.copy(d.pos); f.pos.set(d.pos.x + Math.cos(d.heading) * f.sd * 0.09 * d.sc, 0, d.pos.z - Math.sin(d.heading) * f.sd * 0.09 * d.sc); f.t = 1; });
      else stp = stepLegs(d, d.legs, dt, { spread: 0.09, lift: 0.055, dur: 0.17 });
      if (stp.landed) d.dip = 1;
      d.dip = Math.max(0, (d.dip || 0) - dt * 7);
      d.sway = (d.sway || 0) + ((stp.swinging ? -stp.swinging.sd : 0) - (d.sway || 0)) * Math.min(1, dt * 10);
      const rise = stp.swinging ? Math.sin(Math.PI * stp.swinging.t) : 0;
      let st = 1 - 0.07 * Math.sin(d.dip * Math.PI) + 0.035 * rise + Math.sin(t * 2.1 + d.fidget) * 0.02 * (1 - w);
      if (d.hop > 0) st *= hk < 0.15 ? 0.84 : hk > 0.85 ? 0.9 : 1.08;
      d.body.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
      d.body.position.set(0, d.LH + 0.226 - 0.02 * Math.sin(d.dip * Math.PI) + 0.025 * rise, 0);
      d.body.rotation.set(0.1 * w, 0, -d.sway * 0.07 * Math.max(w, 0.4) + (1 - w) * Math.sin(t * 0.9 + d.fidget) * 0.04);
      poseLegs(d, d.legs, f => V(f.sd * 0.09, d.body.position.y - 0.17, 0), d.hop > 0 ? (() => hopY) : null);
      d.stride = (d.stride || 0) + (stp.swinging ? dt / stp.swinging.dur * Math.PI : 0);
      const cheer = d.hop > 0 ? 1 : 0;
      d.arms.forEach((a, j) => { const sd = j === 0 ? -1 : 1; a.rotation.x = sd * Math.sin(d.stride) * 0.6 * w; const zT = sd * (0.3 + cheer * 1.8) + Math.sin(t * 1.4 + j) * 0.04; a.rotation.z += (zT - a.rotation.z) * Math.min(1, dt * 12); });
      d.blob.position.set(d.pos.x, 0.015, d.pos.z); d.blob.scale.setScalar(d.sc * 0.72 * (1 - Math.min(0.45, hopY)));
      d.nextBlink -= dt;
      if (d.nextBlink <= 0) { d.blink = 0.12; d.nextBlink = rnd() < 0.2 ? 0.26 : R(2, 6); }
      d.blink = Math.max(0, d.blink - dt);
      d.eyes.forEach(e => e.scale.y = d.blink > 0 ? 0.12 : 1);
    });
  }

  function updateFlits(dt, t) {
    flits.forEach(f => {
      if (f.driven) return;   // seam: the game is walking / landing / launching this flit itself this frame
      if (f.hover > 0) f.hover -= dt;
      if (!f.route.length) { if (f.controlled) f.route.push(f.pos.clone()); else { nav.flyTarget(f); if (rnd() < 0.35) f.hover = R(1, 3); } }
      const g = f.route[0];
      const to = g.clone().sub(f.pos), d = to.length();
      if (d < 0.6) f.route.shift();
      const want = f.hover > 0 ? V(0, 0, 0) : to.normalize().multiplyScalar(f.speed);
      [...flits, ...floaties].forEach(o => { if (o === f) return; const dv = f.pos.clone().sub(o.pos), dd = dv.length(); if (dd < 1.4 && dd > 1e-4) want.addScaledVector(dv, (1.4 - dd) * 2 / dd); });
      nav.flyPush(f, want, 'flit');   // reference: keep clear of the wall either side of the arch
      f.vel.lerp(want, 1 - Math.pow(0.15, dt));
      f.pos.addScaledVector(f.vel, dt);
      f.pos.y = Math.max(1.6, Math.min(8, f.pos.y));
      const hsp = Math.hypot(f.vel.x, f.vel.z);
      let wantH = hsp > 0.2 ? Math.atan2(f.vel.x, f.vel.z) : Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z);
      const turn = wrapAngle(wantH - f.heading);
      f.heading += turn * Math.min(1, dt * 3);
      f.bank += (THREE.MathUtils.clamp(-turn * 1.2, -0.5, 0.5) - f.bank) * Math.min(1, dt * 4);
      const bob = Math.sin(t * 2.4 + f.fidget) * 0.08;
      f.root.position.set(f.pos.x, f.pos.y + bob, f.pos.z);
      f.root.rotation.set(0, f.heading, 0);
      f.body.rotation.set(0.25 * Math.min(1, hsp / f.speed), 0, f.bank);
      f.prop.rotation.y += dt * 38;
      // legs dangle under the hips and kick a little
      const fw = V(Math.sin(f.heading), 0, Math.cos(f.heading)), sd3 = V(Math.cos(f.heading), 0, -Math.sin(f.heading));
      f.legs.forEach(l => {
        const kick = Math.sin(t * 7 + f.fidget + l.sd * 1.6) * 0.035 * f.sc;
        l.pos.copy(f.pos).addScaledVector(sd3, l.sd * 0.08 * f.sc).addScaledVector(fw, kick - 0.03 * f.sc * Math.min(1, hsp));
      });
      poseLegs(f, f.legs, l => V(l.sd * 0.08, -0.17, 0), l => f.pos.y + bob - 0.33 * f.sc);
      f.blob.position.set(f.pos.x, 0.015, f.pos.z); f.blob.scale.setScalar(f.sc * 0.75 / (1 + f.pos.y * 0.25));
      f.nextBlink -= dt;
      if (f.nextBlink <= 0) { f.blink = 0.12; f.nextBlink = R(2, 6); }
      f.blink = Math.max(0, f.blink - dt);
      f.eyes.forEach(e => e.scale.y = f.blink > 0 ? 0.12 : 1);
    });
  }

  function updateScoots(dt, t) {
    scoots.forEach(d => {
      const push = V(0, 0, 0);
      let moving = false;
      if (d.wait > 0) {
        d.wait -= dt;
        if (d.wait <= 0 && !d.controlled) nav.pickTarget(d);
        d.lookSwap -= dt;
        if (d.lookSwap <= 0) { d.lookViewer = !d.lookViewer && rnd() < 0.5; d.lookSwap = d.lookViewer ? R(1.5, 3) : R(5, 14); }
        const want = (d.lookViewer || flags.closeUp) ? Math.atan2(camera.position.x - d.pos.x, camera.position.z - d.pos.z) : Math.PI;
        d.heading += wrapAngle(want - d.heading) * Math.min(1, dt * 1.5);
      } else if (d.path.length) {
        const g = d.path[0], dx = g.x - d.pos.x, dz = g.z - d.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 0.45) { d.path.shift(); if (!d.path.length) { d.wait = R(4, 13); nav.onArrive(d); } }
        else { push.x += dx / dd * d.speed; push.z += dz / dd * d.speed; moving = true; }
      }
      const others = [...creatures, ...hoppers, ...drops, ...scoots, ...pips];
      others.forEach(o => {
        if (o === d) return;
        const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z, dd = dx * dx + dz * dz;
        if (dd < 1.7 && dd > 1e-5) { const k = (1.3 - Math.sqrt(dd)) * 2.5; push.x += dx * k; push.z += dz * k; }
      });
      nav.obstacles.forEach(o => { const dx = d.pos.x - o[0], dz = d.pos.z - o[1], dd = Math.hypot(dx, dz), r = o[2] + 0.5; if (dd < r && dd > 1e-4) { const k = (r - dd) * 6 / dd; push.x += dx * k; push.z += dz * k; } });
      nav.extraPush(d, push, 'scoot');   // reference: the pool channel and the arch wall
      if (moving) {
        const turn = wrapAngle(Math.atan2(push.x, push.z) - d.heading);
        d.heading += turn * Math.min(1, dt * 3.5);
        const spd = Math.min(Math.hypot(push.x, push.z), d.speed) * Math.max(0.2, Math.cos(turn));
        push.set(Math.sin(d.heading) * spd, 0, Math.cos(d.heading) * spd);
      } else { push.multiplyScalar(0.5); if (push.length() < 0.1) push.set(0, 0, 0); }
      d.vel.lerp(push, 1 - Math.pow(0.02, dt));
      const sp = d.vel.length(), w = Math.min(1, sp / 0.4);
      // four short legs: up to two feet in the air at once, a quick tippy-tap gait
      d.pos.addScaledVector(d.vel, dt);
      nav.bounds(d.pos);
      d.root.position.set(d.pos.x, 0, d.pos.z);
      d.root.rotation.y = d.heading;
      const stp = stepLegs(d, d.legs, dt, { spread: 0.11, lift: 0.045, dur: 0.15, maxSwing: 2 });
      if (stp.landed) d.dip = 1;
      d.dip = Math.max(0, (d.dip || 0) - dt * 8);
      const breathe = Math.sin(t * 1.8 + d.fidget) * 0.02 * (1 - w);
      d.body.scale.set(1, 1 - 0.04 * Math.sin(d.dip * Math.PI) + breathe, 1 + 0.02 * Math.sin(d.dip * Math.PI));
      d.body.position.set(0, d.LH - 0.012 * Math.sin(d.dip * Math.PI) + Math.sin(t * 14) * 0.004 * w, 0);
      d.body.rotation.set(-0.03 * w, 0, (1 - w) * Math.sin(t * 0.7 + d.fidget) * 0.03 + Math.sin(t * 12) * 0.015 * w);
      poseLegs(d, d.legs, f => V(f.sd * 0.11, d.body.position.y + 0.06, f.fz));
      d.feelLag += ((-0.3 * w + (stp.landed ? -0.2 : 0)) - d.feelLag) * Math.min(1, dt * 6);
      d.feelers.forEach((f, j) => { f.rotation.x = 0.35 + d.feelLag + Math.sin(t * 2.3 + j * 1.7 + d.fidget) * 0.1; });
      d.blob.position.set(d.pos.x, 0.015, d.pos.z); d.blob.scale.setScalar(d.sc * 0.8);
      d.nextBlink -= dt;
      if (d.nextBlink <= 0) { d.blink = 0.13; d.nextBlink = rnd() < 0.2 ? 0.26 : R(2, 6); }
      d.blink = Math.max(0, d.blink - dt);
      d.eyes.forEach(e => e.scale.y = d.blink > 0 ? 0.12 : 1);
    });
  }

  function updateDrops(dt, t) {
    drops.forEach(d => {
      const push = V(0, 0, 0);
      let moving = false;
      if (d.wait > 0) {
        d.wait -= dt;
        if (d.wait <= 0 && !d.controlled) nav.pickTarget(d);
        d.lookSwap -= dt;
        if (d.lookSwap <= 0) { d.lookViewer = !d.lookViewer && rnd() < 0.5; d.lookSwap = d.lookViewer ? R(1.5, 3) : R(5, 14); }
        const want = (d.lookViewer || flags.closeUp) ? Math.atan2(camera.position.x - d.pos.x, camera.position.z - d.pos.z) : Math.PI;
        d.heading += wrapAngle(want - d.heading) * Math.min(1, dt * 1.5);
      } else if (d.path.length) {
        const g = d.path[0], dx = g.x - d.pos.x, dz = g.z - d.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 0.45) { d.path.shift(); if (!d.path.length) { d.wait = R(4, 13); nav.onArrive(d); } }
        else { push.x += dx / dd * d.speed; push.z += dz / dd * d.speed; moving = true; }
      }
      // personal space (all three species), obstacles, the pool
      const others = [...creatures, ...hoppers, ...drops, ...scoots, ...pips];
      others.forEach(o => {
        if (o === d) return;
        const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z, dd = dx * dx + dz * dz;
        if (dd < 1.7 && dd > 1e-5) { const k = (1.3 - Math.sqrt(dd)) * 2.5; push.x += dx * k; push.z += dz * k; }
      });
      nav.obstacles.forEach(o => { const dx = d.pos.x - o[0], dz = d.pos.z - o[1], dd = Math.hypot(dx, dz), r = o[2] + 0.5; if (dd < r && dd > 1e-4) { const k = (r - dd) * 6 / dd; push.x += dx * k; push.z += dz * k; } });
      nav.extraPush(d, push, 'drop');   // reference: the pool channel and the arch wall
      if (moving) {
        const turn = wrapAngle(Math.atan2(push.x, push.z) - d.heading);
        d.heading += turn * Math.min(1, dt * 4);
        const spd = Math.min(Math.hypot(push.x, push.z), d.speed) * Math.max(0.2, Math.cos(turn));
        push.set(Math.sin(d.heading) * spd, 0, Math.cos(d.heading) * spd);
      } else { push.multiplyScalar(0.5); if (push.length() < 0.1) push.set(0, 0, 0); }
      d.vel.lerp(push, 1 - Math.pow(0.02, dt));
      const sp = d.vel.length(), w = Math.min(1, sp / 0.45);   // (drops)
      // walk on two little legs: planted feet, body rides the steps
      d.pos.addScaledVector(d.vel, dt);
      nav.bounds(d.pos);
      d.root.position.set(d.pos.x, 0, d.pos.z);
      d.root.rotation.y = d.heading;
      const stp = stepLegs(d, d.legs, dt, { spread: 0.1, lift: 0.06, dur: 0.2 });
      if (stp.landed) d.dip = 1;
      d.dip = Math.max(0, (d.dip || 0) - dt * 7);
      d.sway = (d.sway || 0) + ((stp.swinging ? -stp.swinging.sd : 0) - (d.sway || 0)) * Math.min(1, dt * 10);
      const rise = stp.swinging ? Math.sin(Math.PI * stp.swinging.t) : 0;
      const st = 1 - 0.06 * Math.sin(d.dip * Math.PI) + 0.03 * rise + Math.sin(t * 1.9 + d.fidget) * 0.015 * (1 - w);
      d.body.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
      d.body.position.set(0, d.LH - 0.02 * Math.sin(d.dip * Math.PI) + 0.018 * rise, 0);
      d.body.rotation.set(0.08 * w, 0, -d.sway * 0.06 * Math.max(w, 0.4) + (1 - w) * Math.sin(t * 0.8 + d.fidget) * 0.03);
      poseLegs(d, d.legs, f => V(f.sd * 0.09, d.body.position.y + 0.05, 0));
      d.stride = (d.stride || 0) + (stp.swinging ? dt / stp.swinging.dur * Math.PI : 0);
      d.arms.forEach((a, j) => { const sd = j === 0 ? -1 : 1; a.rotation.x = sd * Math.sin(d.stride) * 0.5 * w; a.rotation.z = sd * 0.25 + Math.sin(t * 1.3 + j) * 0.04; });
      d.blob.position.set(d.pos.x, 0.015, d.pos.z); d.blob.scale.setScalar(d.sc * 0.75);
      // eyes: relaxed dashes; blink thinner; they pop open into round dots when surprised (a close bump)
      d.nextBlink -= dt;
      if (d.nextBlink <= 0) { d.blink = 0.14; d.nextBlink = rnd() < 0.2 ? 0.3 : R(2.5, 6.5); }
      d.blink = Math.max(0, d.blink - dt);
      if (!moving && d.wait > 0 && rnd() < dt * 0.05) d.wide = 1.2;            // the odd startled look
      others.forEach(o => { if (o !== d && Math.hypot(d.pos.x - o.pos.x, d.pos.z - o.pos.z) < 0.55) d.wide = 0.8; });
      d.wide = Math.max(0, d.wide - dt);
      const eyeY = d.blink > 0 ? 0.35 : d.wide > 0 ? 2.6 : 1;
      d.eyes.forEach(e => { e.scale.y += (eyeY - e.scale.y) * Math.min(1, dt * 18); e.scale.x = d.wide > 0 ? 0.8 : 1; });
    });
  }

  function updateHoppers(dt, t) {
    hoppers.forEach(h => {
      const sc = h.sc;
      // decide where the next hop should go: toward the path, nudged away from neighbours and obstacles
      const goal = h.wait <= 0 && h.path.length ? h.path[0] : null;
      if (h.wait > 0) {
        h.wait -= dt;
        if (h.wait <= 0 && !h.controlled) nav.pickTarget(h);
        h.lookSwap -= dt;
        if (h.lookSwap <= 0) { h.lookViewer = !h.lookViewer && rnd() < 0.5; h.lookSwap = h.lookViewer ? R(1.5, 3) : R(5, 14); }
      } else if (goal && Math.hypot(goal.x - h.pos.x, goal.z - h.pos.z) < 0.45) {
        h.path.shift(); if (!h.path.length) { h.wait = R(3, 12); nav.onArrive(h); }
      }
      h.st += dt;
      if (h.state === 'rest') {
        // turn on the spot toward where it wants to go (or toward you / the sun when idle)
        let want;
        if (h.wait <= 0 && h.path.length) want = Math.atan2(h.path[0].x - h.pos.x, h.path[0].z - h.pos.z);
        else want = (h.lookViewer || flags.closeUp) ? Math.atan2(camera.position.x - h.pos.x, camera.position.z - h.pos.z) : Math.PI;
        h.heading += wrapAngle(want - h.heading) * Math.min(1, dt * 6);
        const pause = h.wait > 0 ? R(1.5, 4) : 0.12;
        if (h.st > (h.pauseFor ?? pause)) {
          if (h.wait <= 0 && h.path.length) { h.state = 'crouch'; h.st = 0; }
          else if (rnd() < dt * 0.4) { h.state = 'crouch'; h.st = 0; h.inPlace = true; }   // the odd happy hop on the spot
        }
      } else if (h.state === 'crouch' && h.st > 0.11) {
        const goalP = h.path[0];
        const dir = V(Math.sin(h.heading), 0, Math.cos(h.heading));
        if (goalP && !h.inPlace) {
          dir.set(goalP.x - h.pos.x, 0, goalP.z - h.pos.z).normalize();
          // personal space and obstacles
          [...creatures, ...hoppers, ...drops, ...scoots, ...pips].forEach(o => {
            if (o === h) return;
            const dx = h.pos.x - o.pos.x, dz = h.pos.z - o.pos.z, dd = Math.hypot(dx, dz);
            if (dd < 1.3 && dd > 1e-4) { dir.x += dx / dd * (1.3 - dd) * 1.5; dir.z += dz / dd * (1.3 - dd) * 1.5; }
          });
          nav.obstacles.forEach(o => { const dx = h.pos.x - o[0], dz = h.pos.z - o[1], dd = Math.hypot(dx, dz), r = o[2] + 0.5; if (dd < r && dd > 1e-4) { dir.x += dx / dd * 2; dir.z += dz / dd * 2; } });
          nav.extraPush(h, dir, 'loaf');   // reference: hop clear of the pool
          dir.normalize();
          h.heading = Math.atan2(dir.x, dir.z);
        }
        const len = h.inPlace ? 0 : Math.min(R(0.55, 0.8) * Math.sqrt(sc), goalP ? Math.hypot(goalP.x - h.pos.x, goalP.z - h.pos.z) + 0.1 : 0.6);
        h.from.copy(h.pos); h.to.copy(h.pos).addScaledVector(dir, len);
        nav.bounds(h.to);
        h.air = h.inPlace ? 0.42 : 0.34 + len * 0.12; h.hopH = (h.inPlace ? 0.42 : 0.26 + len * 0.18) * sc;
        h.state = 'air'; h.st = 0; h.sqV = 3.5;
      } else if (h.state === 'air') {
        const u = Math.min(1, h.st / h.air);
        h.pos.lerpVectors(h.from, h.to, u);
        if (u >= 1) { h.state = 'land'; h.st = 0; h.squash = 0.72; h.inPlace = false; }
      } else if (h.state === 'land' && h.st > 0.12) {
        h.state = 'rest'; h.st = 0; h.pauseFor = h.wait > 0 ? R(1.5, 4) : R(0.05, 0.22);
      }
      // squash & stretch spring: crouch squashes, launch stretches, landing squashes, then it settles
      let target = 1;
      if (h.state === 'crouch') target = 0.76;
      if (h.state === 'air') { const u = h.st / h.air; target = 1.16 - 0.22 * Math.sin(Math.PI * u); }
      h.sqV += (target - h.squash) * 260 * dt; h.sqV *= Math.pow(0.0015, dt); h.squash += h.sqV * dt;
      const sq = Math.max(0.6, h.squash);
      h.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      const y = h.state === 'air' ? Math.sin(Math.PI * Math.min(1, h.st / h.air)) * h.hopH : 0;
      h.root.position.set(h.pos.x, y, h.pos.z);
      h.root.rotation.y = h.heading;
      // stand on two short legs: legs bend in the crouch, dangle in the air, feet land under the hips
      const bodyLift = h.LH * (h.state === 'crouch' ? 0.45 : h.state === 'land' ? 0.6 : 1);
      h.lift = (h.lift ?? h.LH) + (bodyLift - (h.lift ?? h.LH)) * Math.min(1, dt * 20);
      h.body.position.y = h.lift;
      const hs = Math.sin(h.heading), hc = Math.cos(h.heading);
      h.legs.forEach(f => {
        f.home.set(h.pos.x + hc * f.sd * 0.12 * sc, 0, h.pos.z - hs * f.sd * 0.12 * sc);
        if (h.state !== 'air') f.pos.copy(f.home);
      });
      h.legs.forEach(f => { if (h.state === 'air') f.pos.copy(f.home); });
      poseLegs(h, h.legs, f => V(f.sd * 0.12, h.lift + 0.05, 0),
        f => h.state === 'air' ? Math.max(0, y + (h.lift - h.LH * 0.95 + Math.sin(t * 9 + f.sd) * 0.012) * sc) : 0);
      h.body.rotation.x = h.state === 'air' ? 0.18 * Math.cos(Math.PI * h.st / h.air) : 0;   // tips forward on the way down
      h.body.rotation.z = h.state === 'rest' ? Math.sin(t * 1.1 + h.fidget) * 0.03 : 0;
      h.blob.position.set(h.pos.x, 0.015, h.pos.z); h.blob.scale.setScalar(sc * 0.85 * (1 - Math.min(0.5, y * 0.8)));
      // face: blink, an "o" mouth mid-air
      h.nextBlink -= dt;
      if (h.nextBlink <= 0) { h.blink = 0.13; h.nextBlink = rnd() < 0.2 ? 0.26 : R(2, 6); }
      h.blink = Math.max(0, h.blink - dt);
      h.eyes.forEach(e => e.scale.y = h.blink > 0 ? 0.12 : 1);
      const airborne = h.state === 'air';
      h.smile.visible = !airborne; h.oMouth.visible = airborne;
    });
  }

  // occasional happy bounce while waiting
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const tmpV = V(0, 0, 0), push = V(0, 0, 0);
  function updateCreatures(dt, t) {
    creatures.forEach(c => {
      let moving = false;
      push.set(0, 0, 0);
      if (c.wait > 0) {
        c.wait -= dt;
        if (c.wait <= 0 && !c.controlled) nav.pickTarget(c);
        c.vel.multiplyScalar(Math.pow(0.02, dt));
        if (c.hop <= 0 && rnd() < dt * 0.05) c.hop = 0.45;
        // idle: drift to face the sun, with the odd glance around
        c.lookSwap -= dt;
        if (c.lookSwap <= 0) { c.lookViewer = !c.lookViewer && rnd() < 0.5; c.lookSwap = c.lookViewer ? R(1.5, 3) : R(6, 16); }
        const toViewer = Math.atan2(camera.position.x - c.pos.x, camera.position.z - c.pos.z);
        const look = ((c.lookViewer || flags.closeUp) ? toViewer : Math.PI) + Math.sin(t * 0.3 + c.fidget) * 0.25;
        c.heading += wrapAngle(look - c.heading) * Math.min(1, dt * 2);
      } else if (c.path.length) {   // (a held agent with no path just stands)
        const goal = c.path[0];
        tmpV.set(goal.x - c.pos.x, 0, goal.z - c.pos.z);
        const d = tmpV.length();
        if (d < 0.4) { c.path.shift(); if (!c.path.length) { c.wait = R(4, 14); c.hop = 0.45; nav.onArrive(c); } }
        else push.addScaledVector(tmpV, c.speed * (c.path.length === 1 ? Math.min(1, 0.35 + d / 1.2) : 1) / d);
        moving = true;
      }
      // keep a little personal space (from both species)
      [...hoppers, ...drops, ...scoots, ...pips].forEach(o => {
        const dx = c.pos.x - o.pos.x, dz = c.pos.z - o.pos.z, dd = dx * dx + dz * dz;
        if (dd < 1.8 && dd > 1e-5) { const k = (1.35 - Math.sqrt(dd)) * 3; push.x += dx * k; push.z += dz * k; }
      });
      creatures.forEach(o => {
        if (o === c) return;
        const dx = c.pos.x - o.pos.x, dz = c.pos.z - o.pos.z, dd = dx * dx + dz * dz;
        if (dd < 2.1 && dd > 1e-5) { const k = (1.45 - Math.sqrt(dd)) * 3; push.x += dx * k; push.z += dz * k; }
      });
      nav.obstacles.forEach(o => {
        const dx = c.pos.x - o[0], dz = c.pos.z - o[1], dd = Math.hypot(dx, dz), r = o[2] + 0.55;
        if (dd < r && dd > 1e-4) { const k = (r - dd) * 6 / dd; push.x += dx * k; push.z += dz * k; }
      });
      nav.extraPush(c, push, 'puffer');   // reference: the pool channel and the arch wall
      // ---- locomotion: they always walk the way they face (no sliding sideways) ----
      if (moving) {
        const dl = Math.hypot(push.x, push.z), want = Math.atan2(push.x, push.z);
        const turn = wrapAngle(want - c.heading);
        c.heading += turn * Math.min(1, dt * 5);
        const spd = Math.min(dl, c.speed) * Math.max(0.2, Math.cos(turn));   // ease off while turning sharply
        tmpV.set(Math.sin(c.heading) * spd, 0, Math.cos(c.heading) * spd);
        c.vel.lerp(tmpV, 1 - Math.pow(0.02, dt));
      } else {
        tmpV.set(push.x * 0.5, 0, push.z * 0.5);                             // standing: just shuffle out of the way
        if (tmpV.length() < 0.12) tmpV.set(0, 0, 0);
        c.vel.lerp(tmpV, 1 - Math.pow(0.01, dt));
      }
      c.pos.addScaledVector(c.vel, dt);
      nav.bounds(c.pos);
      const sp = c.vel.length(), w = Math.min(1, sp / 0.6), sc = c.root.scale.x;

      c.hop = Math.max(0, c.hop - dt);
      const hk = c.hop > 0 ? 1 - c.hop / 0.45 : 0;
      const hopY = c.hop > 0 ? Math.sin(hk * Math.PI) * 0.26 : 0;
      c.root.position.set(c.pos.x, hopY, c.pos.z);
      c.root.rotation.y = c.heading;
      c.blob.position.set(c.pos.x, 0.015, c.pos.z); c.blob.scale.setScalar(sc * (1 - Math.min(0.45, hopY)));

      // ---- feet: planted on the ground, one steps at a time toward a spot under the hip ----
      const side = V(Math.cos(c.heading), 0, -Math.sin(c.heading));
      c.legs.forEach(f => {
        f.home = f.home || V();
        f.home.copy(c.pos).addScaledVector(side, f.sd * 0.12 * sc).addScaledVector(c.vel, 0.14);
        if (!c.placed) { f.pos.copy(f.home); f.t = 1; }
      });
      c.placed = true;
      if (c.hop > 0) {
        c.legs.forEach(f => { f.pos.copy(f.home); f.t = 1; f.lift = 0; });   // feet tucked under during a hop
      } else {
        if (c.legs.every(f => f.t >= 1)) {
          let best = null, bd = 0;
          c.legs.forEach(f => { const d = Math.hypot(f.pos.x - f.home.x, f.pos.z - f.home.z); if (d > bd) { bd = d; best = f; } });
          if (best && bd > (sp > 0.1 ? 0.045 : 0.03) * sc) {
            best.from.copy(best.pos); best.to.copy(best.home).addScaledVector(c.vel, 0.1);
            best.t = 0; best.dur = THREE.MathUtils.clamp(0.19 - sp * 0.05, 0.11, 0.19);
          }
        }
        c.legs.forEach(f => {
          if (f.t < 1) {
            f.t = Math.min(1, f.t + dt / f.dur);
            const e = f.t * f.t * (3 - 2 * f.t);
            f.pos.lerpVectors(f.from, f.to, e);
            f.lift = Math.sin(Math.PI * f.t) * 0.065 * sc;
            if (f.t >= 1) { c.dip = 1; f.lift = 0; }     // foot lands: body dips a little
          }
        });
      }
      const swinging = c.legs.find(f => f.t < 1);
      c.dip = Math.max(0, c.dip - dt * 7);
      c.sway += ((swinging ? -swinging.sd : 0) - c.sway) * Math.min(1, dt * 10);   // lean over the supporting foot
      c.stride += (swinging ? 1 : 0) * dt / (swinging ? swinging.dur : 1) * Math.PI;

      // ---- body: rides on top of the steps ----
      const breathe = Math.sin(t * 2.2 + c.fidget) * 0.02 * (1 - w);
      const rise = swinging ? Math.sin(Math.PI * swinging.t) : 0;
      let st = 1 - 0.07 * Math.sin(c.dip * Math.PI) + 0.03 * rise + breathe;
      if (c.hop > 0) st *= hk < 0.15 ? 0.84 : hk > 0.85 ? 0.9 : 1.08;   // crouch, stretch, land
      c.body.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
      c.body.position.y = HIP + PUFF_R * 0.95 - 0.025 * Math.sin(c.dip * Math.PI) + 0.022 * rise;
      c.body.rotation.x = 0.12 * w;
      c.body.rotation.z = -c.sway * 0.07 * Math.max(w, 0.4) + (1 - w) * Math.sin(t * 0.9 + c.fidget) * 0.03 + c.tilt;

      // ---- legs: stretch from the hip (inside the body's underside) to each planted foot ----
      c.root.updateMatrixWorld(true);
      c.legs.forEach(f => {
        const hip = c.root.localToWorld(V(f.sd * 0.1, c.body.position.y - PUFF_R * 0.95 * st + 0.06, 0));
        const ankle = V(f.pos.x, f.lift + (c.hop > 0 ? hopY : 0) + 0.03 * sc, f.pos.z);
        const dir = hip.clone().sub(ankle), len = Math.max(0.01, dir.length());
        f.leg.position.copy(ankle);
        f.leg.quaternion.setFromUnitVectors(Y, dir.divideScalar(len));
        f.leg.scale.set(sc, len, sc);
        f.foot.position.copy(ankle);
        f.foot.rotation.set(0, c.heading, 0);
        f.foot.scale.setScalar(sc);
      });

      // arms swing against the stepping foot; up in a little cheer on hops, a slow idle sway otherwise
      const cheer = c.hop > 0 ? 1 : 0;
      c.arms.forEach((a, j) => {
        const sd = j === 0 ? -1 : 1;
        a.rotation.x = sd * Math.sin(c.stride) * 0.6 * w;
        const zT = sd * (0.3 + cheer * 2.1 + (1 - w) * 0.06 * Math.sin(t * 1.6 + c.fidget + j));
        a.rotation.z += (zT - a.rotation.z) * Math.min(1, dt * 12);
      });
      // ---- expression ----
      c.nextBlink -= dt;
      if (c.nextBlink <= 0) { c.blink = 0.13; c.nextBlink = rnd() < 0.2 ? 0.26 : R(2, 6); }   // sometimes a double blink
      c.blink = Math.max(0, c.blink - dt);
      c.moodT -= dt;
      if (c.moodT <= 0) { c.mood = IDLE_MOODS[Math.floor(rnd() * IDLE_MOODS.length)]; c.moodT = R(2.5, 7); }
      let moodName = moving && sp > 0.2 ? 'calm' : c.mood;
      if (!moving && c.lookViewer) moodName = 'content';
      if (c.hop > 0) moodName = 'happy';
      const M = MOODS[moodName], k = Math.min(1, dt * 10);
      c.sy += (M.sy - c.sy) * k;
      c.puffK += (M.puff - c.puffK) * Math.min(1, dt * (M.puff > c.puffK ? 14 : 4));   // puff up fast, deflate slowly
      c.puff.scale.setScalar(c.puffK);
      const closedHappy = moodName === 'happy' || moodName === 'content';
      const tiltT = moodName === 'curious' ? 0.2 * Math.sign(Math.sin(c.fidget * 7) || 1) : moodName === 'content' ? 0.1 * Math.sign(Math.cos(c.fidget * 5) || 1) : 0;
      c.tilt += (tiltT - c.tilt) * Math.min(1, dt * 5);
      c.arcs.forEach(a => a.visible = closedHappy);
      c.smile.scale.setScalar(closedHappy ? 1.2 : 1);
      c.eyes.forEach(e => { e.visible = !closedHappy; e.scale.y = c.blink > 0 ? 0.1 : c.sy; });
    });
    updateHoppers(dt, t);
    updateDrops(dt, t);
    updateScoots(dt, t);
    updateFlits(dt, t);
    updatePips(dt, t);
    updateFloaties(dt, t);
  }

  // the Up close button: flags.closeUp drives pickTarget and the gaze; most puffers drop what they're doing
  function setCloseUp(on) {
    flags.closeUp = on;
    if (on) creatures.forEach(c => { if (c.controlled) return; if (c.wait > 0 || rnd() < 0.5) { c.wait = R(0.1, 2.5); c.path = []; } });
  }
  // take one folk out of the world (root, ground shadow, legs) and out of every list
  function remove(a) {
    [creatures, hoppers, drops, scoots, flits, pips, floaties].forEach(l => { const i = l.indexOf(a); if (i >= 0) l.splice(i, 1); });
    const detach = o => {
      if (!o) return; if (o.parent) o.parent.remove(o);
      let i = colourOnly.indexOf(o); if (i >= 0) colourOnly.splice(i, 1);
      i = allLimbs.indexOf(o); if (i >= 0) allLimbs.splice(i, 1);
    };
    detach(a.root); detach(a.blob); (a.legs || []).forEach(l => { detach(l.leg); detach(l.foot); });
  }

  return {
    creatures, hoppers, drops, scoots, flits, pips, floaties, allLimbs, nav,
    make: { puffer: makeCreature, loaf: makeHopper, drop: makeDrop, scoot: makeScoot, flit: makeFlit, pip: makePip, floatie: makeFloatie },
    update: updateCreatures, setCloseUp, remove,
    stepLegs, poseLegs,   // the shared leg rig, for a game that walks a flier itself (f.driven)
    MOODS, IDLE_MOODS, wrapAngle, FACE_LAYER, MASK_LAYER,
    clayMat, celMat, cloth, tones, garment, wear
  };
}

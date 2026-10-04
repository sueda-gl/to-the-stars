// The lake inside our plot (game.state.water's lake): the reference pool's Reflector + PoolShader, verbatim
// shader, cut to the lake's outline, lying on the paper; plus a flat keyline stand-in like the reference's, and a
// thin invisible lip so the pencil pass draws the lake's outline (the reference got its outline from the slabs).

// PoolShader: copied verbatim from web/js/paint/redArch.js (the reference pool)
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

export const LAKE_Y = 0.03;   // the water lies a hair above the paper

// ---------- the sea ----------
// The reference sea shader (web/js/paint/backdrop.js seaMat: its ripple normals, distance colours, horizon haze
// and sun-disc glint, copied, never imported), laid on a plane that covers the whole map and runs past the far
// plane, with what the map needs from above:
//   - colour by depth (the ground's signed coast field, baked into a texture): pale teal shallows on every coast,
//     island and the river, deepening to ultramarine-teal in the bay (mb 1, mb 5);
//   - a crinkled paper surface (mb 1): big faceted cells with soft creases, each facet catching the key light a
//     little differently, so the water reads as painted paper rather than glass;
//   - the reference's haze toward the horizon only at grazing angles (the eye preset), never from above.
export const SEA_LOOK = { waterShallow: '#93cfc3', waterDeep: '#1d4f93' };
export function buildSea(ctx, { depth, sunDir, keyDir, y = -0.9, size = 4200, parent = ctx.scene } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uShallow: { value: ctx.col(SEA_LOOK.waterShallow) }, uDeepC: { value: ctx.col(SEA_LOOK.waterDeep) }, uHaze: { value: 0.18 }, uHazeCol: { value: ctx.col('#d9dccf') },
      uTime: { value: 0 }, uSun: { value: sunDir }, uCam: { value: ctx.camera.position },
      uCos: { value: Math.cos(Math.atan(30 / 380)) },             // the reference sun disc's angular radius
      uDepth: { value: depth.texture }, uBox: { value: depth.box }, uK: { value: new THREE.Vector2(depth.k0, depth.k1) },
      uKey: { value: keyDir.clone().normalize() }, uCrinkle: { value: 1 }
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime, uCos, uCrinkle, uHaze; uniform vec3 uSun, uCam, uKey, uShallow, uDeepC, uHazeCol; uniform sampler2D uDepth; uniform vec4 uBox; uniform vec2 uK;
      varying vec3 vW;
      float h1(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      vec2 h2(vec2 p){ return vec2(h1(p), h1(p + 17.17)); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(h1(i),h1(i+vec2(1.0,0.0)),u.x), mix(h1(i+vec2(0.0,1.0)),h1(i+vec2(1.0,1.0)),u.x), u.y); }
      // crumpled paper: voronoi facets (each tilted its own way) and the creases between them
      vec3 crinkle(vec2 p, out float crease){
        vec2 g = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; vec2 best = vec2(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j)), r = o + h2(g + o) * 0.9 - f; float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; best = g + o; } else if (d < d2) d2 = d;
        }
        crease = 1.0 - smoothstep(0.0, 0.07, sqrt(d2) - sqrt(d1));
        vec2 t = h2(best + 3.7) - 0.5;
        return normalize(vec3(t.x * 0.55, 1.0, t.y * 0.55));
      }
      void main(){
        vec3 V = normalize(vW - uCam); float dist = length(vW.xz - uCam.xz); vec2 p = vW.xz; float t = uTime;
        // the reference sea's ripple normal and reflection
        vec3 n = normalize(vec3(0.02*sin(p.x*0.35+t*0.6)+0.012*sin(p.x*1.3-p.y*0.4+t), 1.0, 0.035*sin(p.y*0.45+t*0.8)+0.02*sin(p.y*1.7+p.x*0.3-t*1.2)));
        vec3 Rf = reflect(V, n);
        // depth from the coast field (decoded), with a little wobble so the shelves are painted, not plotted
        vec2 uv = (p - uBox.xy) / uBox.zw;
        float e = texture2D(uDepth, uv).r * (uK.x + uK.y) - uK.x;
        float dep0 = sign(e) * e * e;
        if (uv.x < 0.002 || uv.y < 0.002 || uv.x > 0.998 || uv.y > 0.998) dep0 = 30.0;   // past the map: open sea
        if (dep0 < -0.2) discard;          // land (and the lake): the ground is drawn there, never z-fights with the sea
        // the landform's TRUE depth: a pale teal shelf round every coast and island (sand under a metre of water),
        // the bay's teal, ultramarine out in the deep (mb 1, mb 5); a little wobble so the bands are painted
        float dep = dep0 + (vn(p * 0.09) - 0.5) * 0.7 * smoothstep(0.6, 3.0, dep0) + (vn(p * 0.025 + 3.0) - 0.5) * 1.2 * smoothstep(4.0, 12.0, dep0);
        vec3 mid = mix(uShallow, uDeepC, 0.42) * vec3(0.92, 1.0, 1.04);
        vec3 c = mix(uShallow * vec3(1.06, 1.05, 1.0), uShallow, smoothstep(0.15, 1.1, dep));
        c = mix(c, mid, smoothstep(1.0, 4.5, dep));
        c = mix(c, uDeepC, smoothstep(4.0, 17.0, dep));
        c = mix(c, uDeepC * vec3(0.82, 0.86, 0.94), smoothstep(17.0, 45.0, dep));
        // crinkled paper, two scales, lit by the key light
        float cr1, cr2;
        vec3 f1 = crinkle(p / 34.0 + 3.1, cr1), f2 = crinkle(p / 12.0 - 7.3, cr2);
        float lit = dot(normalize(f1 + f2 * 0.6), uKey) - dot(vec3(0.0, 1.0, 0.0), uKey);
        c *= 1.0 + uCrinkle * (lit * 0.36 + cr1 * 0.07 - cr2 * 0.04);
        // the reference's horizon haze, only when looking along the water (the eye preset), never from above
        float graze = 1.0 - smoothstep(0.18, 0.5, -V.y);
        c = mix(c, vec3(0.30,0.52,0.66), smoothstep(110.0,240.0,dist) * graze * 0.6);
        c = mix(c, vec3(0.80,0.76,0.68), smoothstep(260.0,520.0,dist) * graze);
        c = mix(c, uHazeCol, uHaze * smoothstep(140.0, 560.0, length(vW - uCam)) * 0.8 * (1.0 - graze));
        // the reference's sun-disc glint
        float s = dot(Rf, uSun);
        c = mix(c, vec3(0.92,0.45,0.32), smoothstep(uCos-0.004, uCos+0.0008, s)*0.42);
        gl_FragColor = vec4(c,1.0);
      }`
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(depth.box.x + depth.box.z / 2, y, depth.box.y + depth.box.w / 2);
  sea.name = 'sea'; sea.frustumCulled = false;
  parent.add(sea); ctx.colourOnly.push(sea); ctx.folkHidden.push(sea);
  const look = { ...SEA_LOOK };
  function setLook(p = {}) {
    if (p.waterShallow) { look.waterShallow = p.waterShallow; mat.uniforms.uShallow.value = ctx.col(p.waterShallow); }
    if (p.waterDeep) { look.waterDeep = p.waterDeep; mat.uniforms.uDeepC.value = ctx.col(p.waterDeep); }
    if (p.haze != null) mat.uniforms.uHaze.value = +p.haze;
  }
  return { mesh: sea, material: mat, update(t) { mat.uniforms.uTime.value = t; }, setLook, getLook: () => ({ ...look }) };
}

function centroid(poly) { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; }
// offset a closed polygon outward by d (miter-limited; the sim's lakes are gentle blobs)
function offsetPoly(poly, d) {
  const n = poly.length, out = [];
  let area = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const p = poly[(i - 1 + n) % n], c = poly[i], q = poly[(i + 1) % n];
    const e1 = [c[0] - p[0], c[1] - p[1]], e2 = [q[0] - c[0], q[1] - c[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [e1[1] / l1 * s, -e1[0] / l1 * s], n2 = [e2[1] / l2 * s, -e2[0] / l2 * s];
    let m = [n1[0] + n2[0], n1[1] + n2[1]]; const ml = Math.hypot(...m) || 1; m = [m[0] / ml, m[1] / ml];
    const k = Math.min(2, 1 / Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]));
    out.push([c[0] + m[0] * d * k, c[1] + m[1] * d * k]);
  }
  return out;
}

export function buildLake(ctx, poly, { parent = ctx.scene, hideInReflection = () => [] } = {}) {
  const group = new THREE.Group(); group.name = 'lake'; parent.add(group);
  const [cx, cz] = centroid(poly);
  // a shape in the plane's local XY: local (x, y) -> world (x, -z) after the -90 deg turn about X
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz))));
  const geo = new THREE.ShapeGeometry(shape, 24);
  const pool = new THREE.Reflector(geo, { clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0xbfd8dc, shader: PoolShader });
  pool.rotation.x = -Math.PI / 2; pool.position.set(cx, LAKE_Y, cz);
  group.add(pool); ctx.colourOnly.push(pool); ctx.folkHidden.push(pool); ctx.reflectors.push(pool);
  // the mirror re-renders the whole scene; from the leader's height it only ever shows sky and the shore, so the
  // woods (thousands of instanced trees) stay out of it
  const ob = pool.onBeforeRender;
  pool.onBeforeRender = function (...a) {
    const hide = hideInReflection().filter(o => o.visible); hide.forEach(o => { o.visible = false; });
    try { return ob.apply(this, a); } finally { hide.forEach(o => { o.visible = true; }); }
  };
  // flat stand-in for the water so keylines see a surface (as the reference does)
  const wp = new THREE.Mesh(geo); wp.rotation.x = -Math.PI / 2; wp.position.copy(pool.position); wp.visible = false; group.add(wp); ctx.lineOnly.push(wp);
  // the pencil outline: a thin lip ring a few cm proud of the paper, only in the keyline world
  const outer = offsetPoly(poly, 0.22);
  const ring = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz))));
  ring.holes.push(new THREE.Path(poly.map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz))).reverse()));
  const lipGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.16, bevelEnabled: false, curveSegments: 4 });
  const lip = new THREE.Mesh(lipGeo, new THREE.MeshBasicMaterial()); lip.rotation.x = -Math.PI / 2; lip.position.set(cx, -0.02, cz);
  lip.visible = false; group.add(lip); ctx.lineOnly.push(lip);
  return {
    group, pool, standIn: wp, lip, centre: { x: cx, z: cz }, poly,
    update(t) { pool.material.uniforms.uTime.value = t; },
    dispose() {
      for (const [list, o] of [[ctx.colourOnly, pool], [ctx.folkHidden, pool], [ctx.reflectors, pool], [ctx.lineOnly, wp], [ctx.lineOnly, lip]]) { const i = list.indexOf(o); if (i >= 0) list.splice(i, 1); }
      parent.remove(group); pool.dispose && pool.dispose();
    }
  };
}

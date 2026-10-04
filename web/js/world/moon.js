// The sky moon: the shadelings' world, hanging in Earth's sky from the first frame so the goal is visible.
// Authored in the Red arch grammar, as an ADDITION to the backdrop (no paint module is touched): one flat
// ShaderMaterial disc like the reference sun, no lights, no tone mapping. Soft banded gouache tones in cool
// cream / lilac / periwinkle so it reads against the peach-to-teal sky, a warm sunset rim on the side that
// faces the sun, flat-colour maria and craters, an optional faint ring. It is pushed to ctx.colourOnly (no
// keylines, like the sun) and ctx.folkHidden (out of the folk depth pass, like the sun).
//
//   import { createSkyMoon } from './js/world/moon.js';
//   const moon = createSkyMoon(ctx, { position: V(-150, 120, -330), radius: 22 });   // -> THREE.Group
//   moon.visible = false;                      // hide via the group (the painter re-shows colourOnly members)
//   moon.userData.setRing(true) / setLight(x, y, z) / setGlow(0..1)
//
// The disc always faces the camera (screen-aligned, set in onBeforeRender) so it stays a clean circle from
// the descent to the street. Keep it inside the sky dome (600) and the camera far plane.

export const MOON_DEFAULT = { position: [-138, 97, -323], radius: 24 };   // high left of the sun, seen from a coast camera at (0, 5.5, 19)

export function createSkyMoon(ctx, {
  position = null, radius = MOON_DEFAULT.radius,
  ring = false,                 // a faint tilted ring (reads "planet"); off = a moon
  light = [0.62, -0.42, 0.66],  // disc-space light (x right, y up, z to camera): the low sun is below-right of it
  renderOrder = -9              // just after the sky dome (-10)
} = {}) {
  const { scene, colourOnly, folkHidden } = ctx;
  const pos = position ? position.clone() : new THREE.Vector3(...MOON_DEFAULT.position);
  const EXT = 1.9;   // plane half-size in moon radii (room for the ring)

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    extensions: { derivatives: true },
    uniforms: {
      uLight: { value: new THREE.Vector3(...light).normalize() },
      uRing: { value: ring ? 1 : 0 },
      uGlow: { value: 0 }
    },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy / ${radius.toFixed(3)}; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uLight; uniform float uRing, uGlow; varying vec2 vP;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
      // a flat colour shape with a crisp, hand-cut (slightly wavering) edge
      float cut(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
      void main(){
        vec2 p = vP;
        float r = length(p);
        float aa = fwidth(r) * 1.1;
        // hand-cut silhouette: the disc edge wavers a touch, like a paper circle cut by eye
        float edge = 1.0 + (vn(vec2(atan(p.y, p.x) * 2.5, 3.0)) - 0.5) * 0.018;
        float disc = cut(r - edge, aa);

        // ---- the ball: soft banded gouache, lit from the sun's side ----
        vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
        float lam = dot(n, uLight);
        lam += (vn(p * 3.1 + 7.0) - 0.5) * 0.16 + (vn(p * 8.0 + 2.0) - 0.5) * 0.05;   // the terminator is painted, not computed
        vec3 deep  = vec3(0.50, 0.53, 0.75);   // periwinkle shadow (stays off the teal sky)
        vec3 peri  = vec3(0.64, 0.64, 0.82);
        vec3 lilac = vec3(0.82, 0.76, 0.88);
        vec3 cream = vec3(0.96, 0.92, 0.84);
        float la = 0.015;
        vec3 c = deep;
        c = mix(c, peri,  smoothstep(-0.16 - la, -0.16 + la, lam));
        c = mix(c, lilac, smoothstep(0.20 - la, 0.20 + la, lam));
        c = mix(c, cream, smoothstep(0.52 - la, 0.52 + la, lam));

        // maria: two big flat lakes of cooler tone
        float mare = vn(p * 1.7 + vec2(4.1, 1.3)) * 0.7 + vn(p * 4.3) * 0.3;
        c = mix(c, c * vec3(0.86, 0.9, 1.0) + vec3(0.0, 0.02, 0.03), cut(0.58 - mare, 0.012) * 0.75);

        // craters: flat darker floors, a lighter lip on the side facing the light
        vec2 L2 = normalize(uLight.xy);
        vec3 crat[7];
        crat[0] = vec3(-0.36, 0.30, 0.22); crat[1] = vec3(0.30, -0.16, 0.17); crat[2] = vec3(0.08, 0.56, 0.12);
        crat[3] = vec3(-0.10, -0.52, 0.18); crat[4] = vec3(0.56, 0.30, 0.11); crat[5] = vec3(-0.64, -0.14, 0.09);
        crat[6] = vec3(0.20, 0.14, 0.08);
        for (int i = 0; i < 7; i++) {
          vec2 q = (p - crat[i].xy) / crat[i].z;
          float d = length(q) - 1.0 + (vn(q * 2.0 + float(i) * 3.7) - 0.5) * 0.25;
          float fl = cut(d, aa / crat[i].z * 1.5);
          float lip = cut(length(q + L2 * 0.32) - 0.86, aa / crat[i].z * 1.5);
          c = mix(c, c * 0.8 + vec3(0.0, 0.0, 0.05), fl * (1.0 - lip) * 0.95);
          c = mix(c, c * 0.93, fl * lip * 0.6);
        }

        // warm sunset rim on the sun's side: the moon catches the same sundown as the arch
        float side = dot(normalize(p + 1e-5), L2);
        float rim = cut(0.84 - r + (vn(p * 6.0) - 0.5) * 0.04, 0.01) * smoothstep(0.25, 0.75, side);
        c = mix(c, vec3(0.99, 0.80, 0.63), rim * 0.9);

        // ---- optional ring: a flat tilted band, behind the disc on top, in front of it below ----
        vec4 o = vec4(c, disc);
        if (uRing > 0.5) {
          float ca = cos(-0.32), sa = sin(-0.32);
          vec2 q = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
          float e = length(vec2(q.x, q.y / 0.24));
          float ae = fwidth(e) * 1.1;
          float band = cut(e - 1.78, ae) * (1.0 - cut(e - 1.34, ae));
          float gap = cut(abs(e - 1.56) - 0.035, ae);
          vec3 rc = mix(vec3(0.90, 0.85, 0.93), vec3(0.97, 0.88, 0.80), smoothstep(-1.0, 1.0, q.x));
          rc = mix(rc, rc * 0.88, gap);
          float front = step(q.y, 0.0);
          float a = band * (front + (1.0 - front) * (1.0 - disc)) * 0.92;
          o.rgb = mix(o.rgb, rc, a);
          o.a = max(o.a, a);
        }
        // a pale, flat halo of sky lifted toward cream (no bloom: one soft painted ring of light)
        float halo = cut(r - 1.32 - (vn(p * 3.0) - 0.5) * 0.06, aa) * uGlow * 0.32;
        float A = o.a + halo * (1.0 - o.a);
        o.rgb = (o.rgb * o.a + vec3(0.95, 0.89, 0.84) * halo * (1.0 - o.a)) / max(A, 1e-4);
        o.a = A;
        if (o.a < 0.003) discard;
        gl_FragColor = o;
      }`
  });

  const group = new THREE.Group();
  group.name = 'skyMoon';
  group.position.copy(pos);
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(radius * EXT * 2, radius * EXT * 2), mat);
  disc.renderOrder = renderOrder;
  disc.frustumCulled = false;
  // face the camera squarely every draw (a clean circle from any viewpoint)
  const pq = new THREE.Quaternion();
  disc.onBeforeRender = (r, s, camera) => {
    group.updateWorldMatrix(true, false);
    group.getWorldQuaternion(pq);
    disc.quaternion.copy(pq.invert().multiply(camera.quaternion));
    disc.updateMatrixWorld(true);
  };
  group.add(disc);
  scene.add(group);
  colourOnly.push(disc);
  if (folkHidden) folkHidden.push(disc);

  group.userData = {
    disc, material: mat, radius,
    setRing(on) { mat.uniforms.uRing.value = on ? 1 : 0; },
    setLight(x, y, z) { mat.uniforms.uLight.value.set(x, y, z).normalize(); },
    setGlow(k) { mat.uniforms.uGlow.value = k; },
    dispose() {
      scene.remove(group); disc.geometry.dispose(); mat.dispose();
      for (const list of [colourOnly, folkHidden]) { const i = list ? list.indexOf(disc) : -1; if (i >= 0) list.splice(i, 1); }
    }
  };
  return group;
}

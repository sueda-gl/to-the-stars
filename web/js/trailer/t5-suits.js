// ALOUD trailer, t5 first contact: the crew's astronaut gear (Sueda, 2026-10-04: "they should come out of the rocket with
// their astronaut suits and take them off").
//
// ADDITIVE, like web/js/agents/identity.js: the Red arch folk stay verbatim (folk.make.* builds them; nothing of theirs is
// moved or recoloured here). We only hang extra clay pieces on them in the craft's language (rocket.js: pearl
// #eeeae2 / #fbf8f2, glass #8fc3cf, cyan strips #5fd0e4):
//   - a glass bubble helmet (the t3 cabin's helmet: same radius / centre / collar per species), a pearl collar ring with a
//     glowing cyan line. The helmet is its own group in the WORLD, so it can be lifted off, set on the grass or tucked
//     under an arm; while worn it follows the body every frame (wear()).
//   - a pearl life-support pack on the back with a cyan status strip; on floaties two little thrusters under it whose
//     cyan flame carries them down from the hatch while the parasol is still furled.
//   - flits also wear a pearl suit over the lower body (folk.garment, clipped), a cyan line at its top, pearl sleeves.
// The glass is a fresnel bubble (pale glass tint at the rim, a crisp sun highlight), transparent, after the bodies:
// her gouache paints it as a pale rim and one bright dab, which is how a painter would do glass.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const SUIT = { pearl: '#eeeae2', pearlLit: '#fbf8f2', glass: '#8fc3cf', cyan: '#5fd0e4' };
// per species: helmet radius, centre and collar height in the body's frame (t3-cabin.js makeFlit / makeFloatie)
export const HELM = { flit: { r: 0.3, cy: 0.04, collarY: -0.195 }, floatie: { r: 0.28, cy: 0.03, collarY: -0.12 } };

export function createSuits({ folk, scene, KEY_DIR }) {
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uKey: { value: KEY_DIR }, uTint: { value: new THREE.Color(SUIT.glass) }, uRim: { value: new THREE.Color('#e4f6fa') }, uGold: { value: 0 }, uGoldC: { value: new THREE.Color('#ffc98a') } },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vN, vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uKey, uTint, uRim, uGoldC; uniform float uGold; varying vec3 vN, vW;
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW), l = normalize(uKey);
        float f = 1.0 - max(dot(n, v), 0.0);
        float sun = pow(max(dot(reflect(-l, n), v), 0.0), 40.0);                                   // the sun's dab
        float win = smoothstep(0.955, 0.975, dot(n, normalize(v + vec3(-0.45, 0.55, 0.0))));        // a soft second glint, upper left
        float a = 0.05 + 0.5 * pow(f, 2.4);
        vec3 c = mix(uTint, mix(uRim, uGoldC, uGold), smoothstep(0.35, 1.0, f));
        float hi = clamp(sun * 1.6 + win * 0.75, 0.0, 1.0);
        c = mix(c, vec3(1.3, 1.28, 1.24), hi);
        gl_FragColor = vec4(c, clamp(max(a, hi * 0.95), 0.0, 0.95));
      }`
  });
  const pearl = () => folk.cloth(SUIT.pearl);
  const glow = (hex, k = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  const cyanMat = glow(SUIT.cyan, 1.7), cyanHot = glow('#dcfbff', 1.6);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bff4ff').multiplyScalar(2.2), transparent: true, opacity: 0.85, depthWrite: false });
  const flameGeo = (() => { const g = new THREE.SphereGeometry(1, 12, 10); g.scale(0.032, 0.075, 0.032); g.translate(0, -0.06, 0); return g; })();   // a short teardrop of cyan-white
  const haloTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(220,250,255,1)'); gr.addColorStop(0.3, 'rgba(95,208,228,0.55)'); gr.addColorStop(1, 'rgba(95,208,228,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  const jetHaloMat = new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color('#9fe9f5'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const packGeo = (() => { const g = new THREE.SphereGeometry(1, 20, 14); g.scale(0.15, 0.19, 0.075); return g; })();
  const sphere = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

  // dress one crew member (c.kind 'flit' | 'floatie', c.a = the folk record) -> c.gear
  function dress(c) {
    const a = c.a, body = a.body, H = HELM[c.kind];
    const gear = { H, meshes: [] };
    // ---- the helmet: glass + collar + cyan line, its own world group ----
    const helm = new THREE.Group(); helm.name = 'helmet'; scene.add(helm);
    const th = Math.acos(Math.max(-1, Math.min(1, (H.collarY - H.cy) / H.r)));
    const glass = new THREE.Mesh(new THREE.SphereGeometry(H.r, 40, 28, 0, Math.PI * 2, 0, th), glassMat);
    glass.renderOrder = 10; glass.castShadow = false; helm.add(glass);
    const cr = Math.sqrt(Math.max(0, H.r * H.r - (H.collarY - H.cy) ** 2));
    const collar = new THREE.Mesh(new THREE.TorusGeometry(cr + 0.006, 0.028, 12, 44), pearl());
    collar.rotation.x = Math.PI / 2; collar.scale.z = 0.85; collar.position.y = H.collarY - H.cy; collar.castShadow = true; helm.add(collar);
    const led = new THREE.Mesh(new THREE.TorusGeometry(cr + 0.01, 0.0065, 6, 44), cyanMat);
    led.rotation.x = Math.PI / 2; led.position.y = H.collarY - H.cy + 0.024; helm.add(led);
    // a tiny cyan status lamp on the collar's front
    const lamp = new THREE.Mesh(sphere(0.012), cyanHot); lamp.position.set(0, H.collarY - H.cy + 0.004, cr + 0.03); helm.add(lamp);
    gear.helm = helm; gear.glass = glass;
    // ---- the pack, on the back ----
    const pack = new THREE.Group(); pack.position.set(0, c.kind === 'flit' ? -0.02 : -0.01, -(c.kind === 'flit' ? 0.235 : 0.215)); body.add(pack);
    const shell = new THREE.Mesh(packGeo, pearl()); shell.castShadow = true; pack.add(shell);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.13, 0.012), cyanMat); strip.position.set(-0.045, 0.01, -0.07); pack.add(strip);
    [0.06, 0.025].forEach((y, k) => { const l = new THREE.Mesh(sphere(0.011), k ? cyanMat : cyanHot); l.position.set(0.05, y, -0.066); pack.add(l); });
    gear.pack = pack;
    if (c.kind === 'floatie') {   // two little thrusters under the pack; their flame carries the floatie down from the hatch
      gear.jets = [-1, 1].map(sd => {
        const n = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.04, 10), folk.cloth('#cfd3d8')); n.position.set(sd * 0.06, -0.2, -0.02); pack.add(n);
        const fl = new THREE.Group(); fl.position.set(sd * 0.06, -0.22, -0.02); pack.add(fl); fl.visible = false;
        fl.add(new THREE.Mesh(flameGeo, flameMat));
        const halo = new THREE.Sprite(jetHaloMat); halo.position.y = -0.07; halo.scale.setScalar(0.2); fl.add(halo);
        return fl;
      });
    }
    if (c.kind === 'flit') {
      // the pearl suit over the lower body, a cyan line round its top, pearl sleeves on the nub arms
      const suitTop = -0.06;
      gear.suit = folk.garment(body, body.children[0].geometry, SUIT.pearl, { clipY: suitTop, inflate: 1.07 });
      const rr = Math.sqrt(0.24 * 0.24 - suitTop * suitTop) * 1.07;
      const line = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.002, 0.006, 6, 48), cyanMat);
      line.rotation.x = Math.PI / 2; line.position.y = suitTop - 0.008; body.add(line);
      if (a.arms) a.arms.forEach(g => g.children.forEach(m => { if (m.isMesh) m.material = pearl(); }));
    }
    c.gear = gear;
    return gear;
  }

  // the helmet on the head: follow the body exactly
  const _q = new THREE.Quaternion(), _s = V3(), _p = V3();
  function headFrame(c, out = {}) {
    const body = c.a.body; body.updateMatrixWorld(true);
    out.pos = body.localToWorld(V3(0, c.gear.H.cy, 0));
    out.quat = body.getWorldQuaternion(new THREE.Quaternion());
    out.scale = body.getWorldScale(V3()).x;
    return out;
  }
  function wear(c) {
    const f = headFrame(c), h = c.gear.helm;
    h.position.copy(f.pos); h.quaternion.copy(f.quat); h.scale.setScalar(f.scale);
  }
  return { dress, wear, headFrame, glassMat, flameMat };
}

// Painted dusk space, authored in the Red arch's sky grammar: the reference sky's own stops
// (peach 0.97,0.74,0.52 -> cream 0.90,0.80,0.64 -> teal 0.52,0.69,0.76 -> deep blue 0.25,0.47,0.64), laid out
// by the angle above the nearest planet's limb. From the ground that limb IS the horizon, so the same shader
// gives the reference sky at street level; from orbit it becomes a soft peach atmosphere ring fading through
// teal into deep-blue space. The sun is the reference disc (its two reds, its warm glow near the horizon),
// composed relative to the camera so it always sits just above the limb: sundown from everywhere.

export function createSpace(ctx) {
  const { scene, colourOnly, folkHidden } = ctx;
  const U = {
    uE: { value: new THREE.Vector3() }, uER: { value: 170 }, uEO: { value: 0 },
    uM: { value: new THREE.Vector3(0, 0, -1e5) }, uMR: { value: 54 }, uMO: { value: 1 },
    uSun: { value: new THREE.Vector3(0, 0, -1) }, uStars: { value: 1 }, uMoonSky: { value: 0 }
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: U,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uE, uM, uSun; uniform float uER, uMR, uEO, uMO, uStars, uMoonSky; varying vec3 vDir;
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      // elevation above a body's limb (radians), stretched when seen from orbit so space goes deep blue
      float limb(vec3 d, vec3 c, float r, float orbitness){
        vec3 tc = c - cameraPosition; float dc = length(tc);
        float a = asin(min(1.0, r / dc)), ang = acos(clamp(dot(d, tc / dc), -1.0, 1.0));
        return (ang - a) * mix(1.0, 3.4, orbitness);
      }
      void main(){
        vec3 d = normalize(vDir);
        float e = min(limb(d, uE, uER, uEO), limb(d, uM, uMR, uMO) * mix(1.0, 2.6, uMO));
        e = max(e, 0.0);
        vec3 c = mix(vec3(0.97, 0.74, 0.52), vec3(0.90, 0.80, 0.64), smoothstep(0.0, 0.05, e));
        c = mix(c, vec3(0.52, 0.69, 0.76), smoothstep(0.04, 0.22, e));
        c = mix(c, vec3(0.25, 0.47, 0.64), smoothstep(0.2, 0.62, e));
        // deeper still, far from any limb: the dusk's own blue, a touch of violet (never black)
        c = mix(c, vec3(0.16, 0.29, 0.52), smoothstep(0.7, 1.4, e) * 0.9);
        // from orbit (Sueda: 'dark around the globe like real space', as in the Tower Planet reference #05060d):
        // past a thin painted atmosphere the sky falls to deep night; from the ground (orbitness 0) nothing changes
        float orbit = max(uEO, uMO * (1.0 - uMoonSky));
        // Sueda: no halo round the planet, and the space dark blue — from orbit the whole sky is deep night-blue
        c = mix(c, vec3(0.045, 0.075, 0.2), orbit);
        float s = max(dot(d, uSun), 0.0);
        c += vec3(0.2, 0.06, 0.0) * pow(s, 40.0) * smoothstep(0.2, 0.0, e);
        c += vec3(0.16, 0.07, 0.02) * pow(s, 6.0) * smoothstep(0.5, 0.0, e) * 0.6;   // the warm side of the sky
        // on the Moon's meadow the sky turns to the Alpine lounge's (lounge.html: #2e3a60 night-blue over a pale
        // lilac-cream horizon), so the landing cross-fades into the lounge's opening view
        float em = max(limb(d, uM, uMR, uMO), 0.0);
        vec3 ms = mix(vec3(0.86, 0.82, 0.84), vec3(0.56, 0.58, 0.72), smoothstep(0.0, 0.07, em));
        ms = mix(ms, vec3(0.20, 0.25, 0.42), smoothstep(0.05, 0.42, em));
        c = mix(c, ms, uMoonSky);
        // riso-dot stars: sparse cream dots, only out in the deep blue
        vec3 cell = floor(d * 140.0);
        vec3 f = fract(d * 140.0) - 0.5;
        float st = step(0.9965, h3(cell)) * smoothstep(0.32, 0.22, length(f));
        // more, brighter stars once the sky is night (big enough to survive the brush)
        vec3 cell2 = floor(d * 90.0); vec3 f2 = fract(d * 90.0) - 0.5;
        st = max(st, step(0.992, h3(cell2 + 11.0)) * smoothstep(0.34, 0.18, length(f2)) * orbit);
        c = mix(c, vec3(0.96, 0.91, 0.80), st * max(max(smoothstep(0.55, 0.9, e), smoothstep(0.2, 0.5, e) * orbit), uMoonSky * smoothstep(0.3, 0.6, em)) * uStars * (0.55 + 0.45 * h3(cell + 3.0)));
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); colourOnly.push(sky); folkHidden.push(sky);

  // the reference sun: a disc, red at the foot to orange at the top
  const SUN_ANG = Math.atan(30 / 380), SUN_D = 8000, sunR = SUN_D * Math.tan(SUN_ANG);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(sunR, 96), new THREE.ShaderMaterial({
    depthWrite: false,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vP; void main(){ float t = vP.y / ${sunR.toFixed(1)} * 0.5 + 0.5; gl_FragColor = vec4(mix(vec3(0.86, 0.24, 0.14), vec3(0.95, 0.38, 0.2), t), 1.0); }`
  }));
  sun.renderOrder = -9; sun.frustumCulled = false; scene.add(sun); colourOnly.push(sun); folkHidden.push(sun);

  const tmp = new THREE.Vector3(), a = new THREE.Vector3(), sv = new THREE.Vector3();
  // the sun just above a body's limb, ahead-left of the view: sundown wherever the camera is
  function sunFor(camera, centre, R, alt, out, side = -0.42) {
    const e = a.copy(centre).sub(camera.position); const dc = e.length(); e.divideScalar(dc);
    const aE = Math.asin(Math.min(1, R / dc));
    const m = camera.matrixWorld.elements;
    const right = tmp.set(m[0], m[1], m[2]), up = new THREE.Vector3(m[4], m[5], m[6]), fwd = new THREE.Vector3(-m[8], -m[9], -m[10]);
    sv.copy(up).multiplyScalar(0.8).addScaledVector(right, side).addScaledVector(fwd, 0.62);
    sv.addScaledVector(e, -e.dot(sv)).normalize();
    const surf = 1 - THREE.MathUtils.smoothstep(alt, 30, 260);
    const ang = aE + THREE.MathUtils.lerp(-0.42, 0.82, surf) * SUN_ANG;
    return out.copy(e).multiplyScalar(Math.cos(ang)).addScaledVector(sv, Math.sin(ang)).normalize();
  }
  function update(camera, sunDir) {
    sky.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, SUN_D);
    sun.up.copy(camera.up); sun.lookAt(camera.position);
    U.uSun.value.copy(sunDir);
  }
  return { sky, sun, U, update, sunFor, SUN_ANG };
}

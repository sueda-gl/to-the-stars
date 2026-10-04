// Backdrop: the Red arch's sky, sun, far ridges, sea, foam and lights, verbatim.

export function createBackdrop(ctx, { camBase }) {
  const { scene, camera, colourOnly, mulberry32, V } = ctx;
  // ---------- sky ----------
  const sunDist = 380, sunRadius = 30, sunElev = Math.atan(sunRadius / sunDist) * 0.82;
  const sunDir = V(0, Math.sin(sunElev), -Math.cos(sunElev)).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { uSun: { value: sunDir } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = mix(vec3(0.97,0.74,0.52), vec3(0.90,0.80,0.64), smoothstep(0.0,0.05,h));
        c = mix(c, vec3(0.52,0.69,0.76), smoothstep(0.04,0.22,h));
        c = mix(c, vec3(0.25,0.47,0.64), smoothstep(0.2,0.62,h));
        float s = max(dot(normalize(vDir), uSun), 0.0);
        c += vec3(0.2,0.06,0.0) * pow(s, 40.0) * smoothstep(0.2, 0.0, h);
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  sky.renderOrder = -10; scene.add(sky); colourOnly.push(sky);

  const sunPos = camBase.clone().add(sunDir.clone().multiplyScalar(sunDist));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(sunRadius, 96), new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vP; void main(){ float t = vP.y/${sunRadius.toFixed(1)}*0.5+0.5; gl_FragColor = vec4(mix(vec3(0.86,0.24,0.14), vec3(0.95,0.38,0.2), t),1.0); }`
  }));
  sun.position.copy(sunPos); sun.lookAt(camBase); scene.add(sun); colourOnly.push(sun);

  function ridge(x0, x1, z, hMin, hMax, color, seed) {
    const r2 = mulberry32(seed), s = new THREE.Shape();
    s.moveTo(x0, -1);
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, x = x0 + (x1 - x0) * t, env = Math.sin(Math.PI * t) ** 0.6;
      s.lineTo(x, -0.8 + env * (hMin + (hMax - hMin) * (0.5 + 0.5 * Math.sin(t * 9 + seed) * Math.cos(t * 4.3)) + r2() * 0.4));
    }
    s.lineTo(x1, -1);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color }));
    m.position.z = z; scene.add(m); colourOnly.push(m);
  }
  ridge(-190, -36, -300, 2.5, 6.5, 0x9db1bb, 3);
  ridge(34, 150, -320, 1.5, 4.0, 0xb4c1c3, 11);

  // ---------- sea ----------
  const cosSun = Math.cos(Math.atan(sunRadius / sunDist));
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: sunDir }, uCam: { value: camera.position }, uCos: { value: cosSun } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime, uCos; uniform vec3 uSun, uCam; varying vec3 vW;
      void main(){
        vec3 V = normalize(vW - uCam); float dist = length(vW.xz - uCam.xz); vec2 p = vW.xz; float t = uTime;
        vec3 n = normalize(vec3(0.02*sin(p.x*0.35+t*0.6)+0.012*sin(p.x*1.3-p.y*0.4+t), 1.0, 0.035*sin(p.y*0.45+t*0.8)+0.02*sin(p.y*1.7+p.x*0.3-t*1.2)));
        vec3 Rf = reflect(V, n);
        vec3 c = mix(vec3(0.36,0.72,0.78), vec3(0.17,0.47,0.66), smoothstep(30.0,70.0,dist));
        c = mix(c, vec3(0.30,0.52,0.66), smoothstep(110.0,240.0,dist));
        c = mix(c, vec3(0.80,0.76,0.68), smoothstep(260.0,520.0,dist));
        float s = dot(Rf, uSun);
        c = mix(c, vec3(0.92,0.45,0.32), smoothstep(uCos-0.004, uCos+0.0008, s)*0.42);
        gl_FragColor = vec4(c,1.0);
      }`
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 1200), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.9, -600); scene.add(sea); colourOnly.push(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(80, 0.5), new THREE.MeshBasicMaterial({ color: 0xe6eee8, transparent: true, opacity: 0.75 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, -0.88, -14.4); scene.add(foam); colourOnly.push(foam);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xb8cfd8, 0xc89a6a, 0.62); hemi.layers.enable(5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe0bc, 0.85);
  key.position.set(-28, 22, 14); key.target.position.set(0, 0, -6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  key.shadow.bias = -0.0008; key.shadow.radius = 3;
  key.layers.enable(5);
  scene.add(key, key.target);
  const KEY_DIR = key.position.clone().sub(key.target.position).normalize();
  ctx.folkHidden.push(sky, sea, foam, sun);
  return { sky, sun, sunPos, sea, seaMat, foam, hemi, key, KEY_DIR, sunDir, update(t) { seaMat.uniforms.uTime.value = t; } };
}

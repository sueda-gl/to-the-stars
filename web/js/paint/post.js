// The Red arch post stack, verbatim: gouache (warped generalised Kuwahara), keylines from the smooth
// proxy world, riso separation (3-drum solve + line drum), print (screens, misregistration, paper),
// the folk's own gouache pass, and the held-frame loop. Editions: 0 Riso, 1 Gouache, 2 Raw 3D.

export function createPainter(ctx, folk, { framing = null } = {}) {
  const { renderer, scene, camera, col, colourOnly, lineOnly } = ctx;
  const { creatures, hoppers, drops, scoots, flits, pips, floaties, allLimbs, FACE_LAYER } = folk;
  const subs = [], emit = (...a) => subs.forEach(f => f(...a));
  // ================= post-processing =================
  const GLSL_NOISE = `
    float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y); }
    float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
  `;
  const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  // 1. gouache: warped generalised Kuwahara, flattens the CG into brush-shaped patches
  // gouache for the creatures: alpha-aware brush patches on the bodies, a wobbly brushed silhouette,
  // pigment gathering toward the edges, and the faces kept legible on top (face pixels carry alpha 0.5)
  const folkPaintMat = new THREE.ShaderMaterial({
    uniforms: { tFolk: { value: null }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 3 }, uWarp: { value: 2.5 } },
    vertexShader: FS_VERT,
    fragmentShader: GLSL_NOISE + `
      uniform sampler2D tFolk; uniform vec2 uRes; uniform float uRadius, uWarp; varying vec2 vUv;
      void main(){
        vec2 px = 1.0 / uRes;
        vec2 warp = (vec2(fbm(vUv * uRes / 12.0), fbm(vUv * uRes / 12.0 + 5.3)) - 0.5) * uWarp * px;
        vec4 cw = texture2D(tFolk, vUv + warp);
        if (cw.a < 0.9) {                       // face (0.5), soft shadow (<0.45) or nothing: pass through
          if (cw.a > 0.45) { gl_FragColor = vec4(cw.rgb, 0.5); return; }
          gl_FragColor = cw; return;
        }
        vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
        vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
        float n0 = 0.0, n1 = 0.0, n2 = 0.0, n3 = 0.0;
        for (int j = -5; j <= 5; j++) for (int i = -5; i <= 5; i++) {
          if (abs(float(i)) > uRadius || abs(float(j)) > uRadius) continue;
          vec4 q = texture2D(tFolk, vUv + warp + vec2(float(i), float(j)) * px);
          if (q.a < 0.9) continue;              // only body paint mixes with body paint
          vec3 c = q.rgb, c2 = c * c;
          if (i <= 0 && j <= 0) { m0 += c; s0 += c2; n0 += 1.0; }
          if (i >= 0 && j <= 0) { m1 += c; s1 += c2; n1 += 1.0; }
          if (i <= 0 && j >= 0) { m2 += c; s2 += c2; n2 += 1.0; }
          if (i >= 0 && j >= 0) { m3 += c; s3 += c2; n3 += 1.0; }
        }
        float best = 1e9; vec3 col = cw.rgb;
        if (n0 > 0.0) { vec3 mu = m0 / n0, va = abs(s0 / n0 - mu * mu); float e = va.r + va.g + va.b; if (e < best) { best = e; col = mu; } }
        if (n1 > 0.0) { vec3 mu = m1 / n1, va = abs(s1 / n1 - mu * mu); float e = va.r + va.g + va.b; if (e < best) { best = e; col = mu; } }
        if (n2 > 0.0) { vec3 mu = m2 / n2, va = abs(s2 / n2 - mu * mu); float e = va.r + va.g + va.b; if (e < best) { best = e; col = mu; } }
        if (n3 > 0.0) { vec3 mu = m3 / n3, va = abs(s3 / n3 - mu * mu); float e = va.r + va.g + va.b; if (e < best) { best = e; col = mu; } }
        // pigment gathers toward the edge of each painted shape (soft, not a line)
        float cov = 0.0;
        for (int k = 0; k < 8; k++) { float an = float(k) * 0.785398; cov += step(0.4, texture2D(tFolk, vUv + warp + vec2(cos(an), sin(an)) * px * 4.0).a); }
        cov /= 8.0;
        col *= mix(1.0, 0.84, smoothstep(0.95, 0.5, cov));
        // brush streaks and a little extra colour
        col *= 0.95 + 0.1 * fbm(vec2(vUv.x * uRes.x / 3.0, vUv.y * uRes.y / 14.0));
        float l = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(vec3(l), col, 1.12);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const kuwaharaMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 4 }, uWarp: { value: 3 } },
    vertexShader: FS_VERT,
    fragmentShader: GLSL_NOISE + `
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uRadius, uWarp; varying vec2 vUv;
      void main(){
        vec2 px = 1.0/uRes;
        vec2 warp = (vec2(fbm(vUv*uRes/22.0), fbm(vUv*uRes/22.0 + 9.7)) - 0.5) * uWarp * px;
        vec2 uv = vUv + warp;
        vec3 m0=vec3(0.0), m1=vec3(0.0), m2=vec3(0.0), m3=vec3(0.0);
        vec3 s0=vec3(0.0), s1=vec3(0.0), s2=vec3(0.0), s3=vec3(0.0);
        float n0=0.0, n1=0.0, n2=0.0, n3=0.0;
        for (int j=-8; j<=8; j++) for (int i=-8; i<=8; i++) {
          if (abs(float(i)) > uRadius || abs(float(j)) > uRadius) continue;
          vec3 c = texture2D(tDiffuse, uv + vec2(float(i), float(j))*px).rgb, c2 = c*c;
          if (i<=0 && j<=0) { m0+=c; s0+=c2; n0+=1.0; }
          if (i>=0 && j<=0) { m1+=c; s1+=c2; n1+=1.0; }
          if (i<=0 && j>=0) { m2+=c; s2+=c2; n2+=1.0; }
          if (i>=0 && j>=0) { m3+=c; s3+=c2; n3+=1.0; }
        }
        m0/=n0; m1/=n1; m2/=n2; m3/=n3;
        vec3 v0=abs(s0/n0-m0*m0), v1=abs(s1/n1-m1*m1), v2=abs(s2/n2-m2*m2), v3=abs(s3/n3-m3*m3);
        float e0=v0.r+v0.g+v0.b, e1=v1.r+v1.g+v1.b, e2=v2.r+v2.g+v2.b, e3=v3.r+v3.g+v3.b;
        // soft blend weighted by inverse variance — less blocky than picking one quadrant
        float w0=1.0/(1.0+pow(e0*900.0,2.0)), w1=1.0/(1.0+pow(e1*900.0,2.0)), w2=1.0/(1.0+pow(e2*900.0,2.0)), w3=1.0/(1.0+pow(e3*900.0,2.0));
        vec3 c = (m0*w0+m1*w1+m2*w2+m3*w3)/(w0+w1+w2+w3);
        // gentle warm grade, lifted blacks like gouache on paper
        c = pow(c, vec3(0.96));
        c = mix(c, c*vec3(1.04,1.0,0.94), 0.6);
        c = max(c, vec3(0.06,0.05,0.06));
        gl_FragColor = vec4(c, 1.0);
      }`
  });

  // 2. edges from depth + normals of the smooth proxy world
  const edgeMat = new THREE.ShaderMaterial({
    uniforms: { tNormal: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, cameraNear: { value: camera.near }, cameraFar: { value: camera.far } },
    vertexShader: FS_VERT,
    fragmentShader: `
      uniform sampler2D tNormal, tDepth; uniform vec2 uRes; uniform float cameraNear, cameraFar; varying vec2 vUv;
      float lin(float d){ float z = d*2.0-1.0; return (2.0*cameraNear*cameraFar)/(cameraFar+cameraNear-z*(cameraFar-cameraNear)); }
      void main(){
        vec2 px = 1.0/uRes;
        float d0 = lin(texture2D(tDepth, vUv).x); vec3 n0 = texture2D(tNormal, vUv).xyz*2.0-1.0;
        float e = 0.0;
        for (int k=0; k<8; k++) {
          vec2 o = k==0?vec2(1,0):k==1?vec2(-1,0):k==2?vec2(0,1):k==3?vec2(0,-1):k==4?vec2(1,1):k==5?vec2(-1,1):k==6?vec2(1,-1):vec2(-1,-1);
          float d = lin(texture2D(tDepth, vUv+o*px).x); vec3 n = texture2D(tNormal, vUv+o*px).xyz*2.0-1.0;
          e = max(e, smoothstep(0.035, 0.07, (d-d0)/d0));                  // only the nearer side draws
          e = max(e, smoothstep(0.45, 0.75, 1.0-dot(n,n0)) * step(d0, d*1.002) * 0.85);
        }
        gl_FragColor = vec4(e, 0.0, 0.0, 1.0);
      }`
  });

  // 3. separation into three riso drums + a keyline/dark plate with variable weight
  const INKS = {
    paper: col('#f3ecdc'), red: col('#f15060'), yellow: col('#ffe800'), blue: col('#0078bf'), line: col('#3d5588')
  };
  const soft = c => c.clone().lerp(col('#ffffff'), 0.06);
  const sepMat = new THREE.ShaderMaterial({
    uniforms: {
      tPaint: { value: null }, tEdge: { value: null }, uRes: { value: new THREE.Vector2() }, uSolve: { value: 1 },
      uPaper: { value: INKS.paper }, uInk1: { value: soft(INKS.red) }, uInk2: { value: soft(INKS.yellow) }, uInk3: { value: soft(INKS.blue) },
      uLineMax: { value: 3.4 }, uScale: { value: 1 }
    },
    vertexShader: FS_VERT,
    fragmentShader: GLSL_NOISE + `
      uniform sampler2D tPaint, tEdge; uniform vec2 uRes; uniform float uSolve, uLineMax, uScale;
      uniform vec3 uPaper, uInk1, uInk2, uInk3; varying vec2 vUv;
      vec3 printOf(vec3 a){ return uPaper*(1.0-a.x*(1.0-uInk1))*(1.0-a.y*(1.0-uInk2))*(1.0-a.z*(1.0-uInk3)); }
      float errOf(vec3 a, vec3 t){ vec3 d = printOf(a)-t; return dot(d*d, vec3(0.35,0.45,0.2)) + 0.0015*(a.x+a.y+a.z); }
      void main(){
        vec2 px = 1.0/uRes;
        vec2 q = vUv*uRes/uScale;
        // keyline: unequal weight (mostly fine, sometimes heavy), with lost edges
        float wN = vnoise(q/70.0 + 3.1);
        float w = mix(0.7, uLineMax, pow(wN, 2.2)) * uScale;
        float line = 0.0;
        for (int j=-5; j<=5; j++) for (int i=-5; i<=5; i++) {
          float d = length(vec2(float(i), float(j)));
          if (d > w + 0.5) continue;
          float e = texture2D(tEdge, vUv + vec2(float(i), float(j))*px).r;
          line = max(line, e * smoothstep(w + 0.5, w - 0.5, d));
        }
        line *= smoothstep(0.18, 0.42, vnoise(q/45.0 + 17.0));   // lost edges
        line *= 0.75 + 0.25*vnoise(q/9.0);                        // pressure
        vec3 t = pow(texture2D(tPaint, vUv).rgb, vec3(1.12));
        vec3 best = vec3(0.0);
        float dark = 0.0;
        if (uSolve > 0.5) {
          float be = 1e9;
          for (int i=0;i<5;i++) for (int j=0;j<5;j++) for (int k=0;k<5;k++) {
            vec3 a = vec3(float(i),float(j),float(k))*0.25; float e = errOf(a,t); if (e<be){ be=e; best=a; }
          }
          float st = 0.125;
          for (int r=0;r<3;r++) {
            vec3 c0 = best;
            for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++) for (int k=-1;k<=1;k++) {
              vec3 a = clamp(c0 + vec3(float(i),float(j),float(k))*st, 0.0, 1.0); float e = errOf(a,t); if (e<be){ be=e; best=a; }
            }
            st *= 0.5;
          }
          best = mix(best, floor(best*4.0+0.5)/4.0, 0.4);   // poster levels
          float lum = dot(t, vec3(0.3,0.59,0.11));
          dark = smoothstep(0.13, 0.05, lum) * 0.92;            // figures, trunks, deep shade go to the line drum
        }
        gl_FragColor = vec4(best, max(line, dark));
      }`
  });

  // 4. print: screens, misregistration, ink density, paper
  const printMat = new THREE.ShaderMaterial({
    uniforms: {
      tSep: { value: null }, tPaint: { value: null }, uMode: { value: 0 }, uRes: { value: new THREE.Vector2() }, uDpr: { value: 1 }, uMargin: { value: 0 },
      uPaper: { value: INKS.paper }, uInk1: { value: soft(INKS.red) }, uInk2: { value: soft(INKS.yellow) }, uInk3: { value: soft(INKS.blue) }, uInkL: { value: INKS.line },
      uOff1: { value: new THREE.Vector2(2.6, -1.1) }, uOff2: { value: new THREE.Vector2(-1.7, 1.9) }, uOff3: { value: new THREE.Vector2(0, 0) }, uOffL: { value: new THREE.Vector2(1.1, 1.5) }, uLines: { value: 1 }, tEyes: { value: null }, tMask: { value: null },
      uSat: { value: 1.06 }, uTooth: { value: 0.1 }, uPool: { value: 0.06 }, uWarm: { value: 0 }, uLineStr: { value: 0.55 }
    },
    vertexShader: FS_VERT,
    fragmentShader: GLSL_NOISE + `
      uniform sampler2D tSep, tPaint; uniform float uMode, uDpr, uMargin; uniform vec2 uRes;
      uniform vec3 uPaper, uInk1, uInk2, uInk3, uInkL; uniform vec2 uOff1, uOff2, uOff3, uOffL; uniform float uLines, uSat, uTooth, uPool, uWarm, uLineStr; uniform sampler2D tEyes, tMask;
      float inside(vec2 uv){ return step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0); }
      float screenAt(vec2 frag, float cov, float ang, float cell, float seed){
        float c = cos(ang), s = sin(ang);
        vec2 p = mat2(c,-s,s,c)*frag/cell;
        vec2 f = fract(p) - 0.5;
        float am = min(1.0, 3.14159*dot(f,f));          // round dots, area tracks coverage linearly
        float th = mix(am, hash(floor(frag) + seed), 0.24);
        return smoothstep(th - 0.06, th + 0.06, cov);
      }
      float mark(vec2 frag, vec2 c, float r){
        vec2 d = frag - c; float w = 0.7*uDpr;
        float ring = smoothstep(w, 0.0, abs(length(d) - r*0.62));
        float cross = max(smoothstep(w, 0.0, abs(d.x))*step(abs(d.y), r), smoothstep(w, 0.0, abs(d.y))*step(abs(d.x), r));
        return max(ring, cross);
      }
      void main(){
        vec2 frag = gl_FragCoord.xy;
        float fib = fbm(frag/(2.2*uDpr));
        vec3 paper = uPaper * (0.95 + 0.05*fib) * (1.0 - 0.035*fbm(frag/(55.0*uDpr)));
        if (uMode > 0.5) {
          // gouache edition: full bleed, softened keylines like a pencil underdrawing
          vec2 uv = frag/uRes;
          vec2 wob = (vec2(vnoise(frag/(16.0*uDpr)), vnoise(frag/(16.0*uDpr)+7.0)) - 0.5) * 1.6*uDpr/uRes;
          vec3 c = texture2D(tPaint, uv + wob).rgb;
          float l = smoothstep(0.3, 0.65, texture2D(tSep, uv + wob).a) * uLines * (1.0 - step(0.45, texture2D(tMask, uv + wob).a));
          c = mix(c, c*vec3(0.32,0.28,0.36), l*uLineStr);
          float lum = dot(c, vec3(0.3,0.59,0.11));
          c = mix(vec3(lum), c, uSat);
          c *= (1.0 - uTooth) + uTooth*fib;                                    // brush/paper tooth
          c *= 1.0 - uPool*smoothstep(0.55, 0.75, fbm(frag/(9.0*uDpr)));
          c *= uWarm >= 0.0 ? mix(vec3(1.0), vec3(1.07,1.0,0.86), uWarm) : mix(vec3(1.0), vec3(0.9,0.98,1.1), -uWarm);
          // the folk: painted in their own gouache pass; paper tooth shows through
          vec4 ey = texture2D(tEyes, uv);
          float body = step(0.9, ey.a), face = step(0.45, ey.a) * (1.0 - body);
          vec3 fc = ey.rgb * ((1.0 - uTooth) + uTooth * fib) * (1.0 - uPool * 0.6 * smoothstep(0.55, 0.75, fbm(frag / (9.0 * uDpr) + 3.0)));
          c = mix(c, fc, body + face);
          c = mix(c, ey.rgb, ey.a * (1.0 - step(0.45, ey.a)));       // soft painted shadow
          gl_FragColor = vec4(c, 1.0);
          return;
        }
        vec2 size = uRes - 2.0*uMargin;
        vec2 base = (frag - uMargin)/size;
        float cell = 2.4*uDpr + 1.4;
        vec3 c = paper;
        float mr = uMargin*0.26;
        vec4 ey = texture2D(tEyes, base) * inside(base);
        float fA = step(0.45, ey.a) * (1.0 - step(0.9, ey.a));   // face pixels only
        float eyeW = fA * smoothstep(0.82, 0.92, min(ey.r, min(ey.g, ey.b)));
        float eyeD = fA * smoothstep(0.42, 0.3, max(ey.r, max(ey.g, ey.b)));
        vec2 mk1 = vec2(uMargin*0.5, uRes.y*0.5), mk2 = vec2(uRes.x - uMargin*0.5, uRes.y*0.5);
        // drum 1..3
        for (int k=0; k<3; k++) {
          vec2 off = (k==0?uOff1:k==1?uOff2:uOff3)*uDpr;
          vec3 ink = k==0?uInk1:k==1?uInk2:uInk3;
          float ang = k==0?0.26:k==1?1.31:0.79;
          vec2 uv = base + off/size;
          vec4 s = texture2D(tSep, uv);
          float cov = (k==0?s.r:k==1?s.g:s.b) * inside(uv);
          float a = screenAt(frag, cov, ang, cell, float(k)*31.7);
          float fk = float(k);
          a *= 0.84 + 0.16*vnoise(frag/(70.0*uDpr) + fk*13.1);          // uneven drum density
          a *= 1.0 - 0.85*step(0.993, hash(floor(frag/1.5) + fk*7.3)); // specks of missing ink
          vec2 fm = frag - off;
          a = max(a, (mark(fm, mk1, mr) + mark(fm, mk2, mr)) * 0.95);
          a *= 1.0 - eyeW;
          c *= 1.0 - a*(1.0-ink);
        }
        // line / dark drum
        vec2 offL = uOffL*uDpr; vec2 uvL = base + offL/size;
        float l = smoothstep(0.28, 0.6, texture2D(tSep, uvL).a) * inside(uvL) * (1.0 - step(0.45, texture2D(tMask, uvL).a) * 0.9);
        l *= 0.88 + 0.12*vnoise(frag/(30.0*uDpr) + 51.0);
        l *= 1.0 - 0.7*step(0.99, hash(floor(frag/1.3) + 77.0));
        l = max(l, (mark(frag-offL, mk1, mr) + mark(frag-offL, mk2, mr)) * 0.9);
        l = max(l * (1.0 - eyeW), eyeD);
        c *= 1.0 - l*(1.0-uInkL);
        c *= 0.97 + 0.03*hash(floor(frag) + 3.0);
        gl_FragColor = vec4(c, 1.0);
      }`
  });

  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsScene = new THREE.Scene();
  const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), printMat);
  fsQuad.frustumCulled = false; fsScene.add(fsQuad);
  function pass(mat, target) { fsQuad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }

  const normalMat = new THREE.MeshNormalMaterial();
  const maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const depthOnlyMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  let rtEyes, rtMask, rtFolkPaint, resScale = 1;
  let rtScene, rtNormal, rtPaint, rtEdge, rtSep, iw = 1, ih = 1, internalScale = 1;
  function makeTargets() {
    [rtScene, rtNormal, rtPaint, rtEdge, rtSep, rtEyes, rtMask, rtFolkPaint].forEach(t => t && t.dispose());
    const W = renderer.domElement.width, H = renderer.domElement.height;
    internalScale = Math.min(1, 1500 / Math.max(W, H));
    iw = Math.round(W * internalScale); ih = Math.round(H * internalScale);
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    rtScene = new THREE.WebGLRenderTarget(iw, ih, opts);
    rtNormal = new THREE.WebGLRenderTarget(iw, ih, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    rtNormal.depthTexture = new THREE.DepthTexture(iw, ih); rtNormal.depthTexture.type = THREE.UnsignedIntType;
    rtPaint = new THREE.WebGLRenderTarget(iw, ih, opts);
    rtEdge = new THREE.WebGLRenderTarget(iw, ih, opts);
    rtSep = new THREE.WebGLRenderTarget(iw, ih, opts);
    rtEyes = new THREE.WebGLRenderTarget(iw, ih, opts);
    rtFolkPaint = new THREE.WebGLRenderTarget(iw, ih, opts);
    folkPaintMat.uniforms.uRes.value.set(iw, ih);
    const res = new THREE.Vector2(iw, ih), sc = Math.max(iw, ih) / 1000;
    kuwaharaMat.uniforms.uRes.value.copy(res); resScale = sc;
    edgeMat.uniforms.uRes.value.copy(res);
    sepMat.uniforms.uRes.value.copy(res); sepMat.uniforms.uScale.value = Math.max(0.7, sc);
    printMat.uniforms.uRes.value.set(W, H); printMat.uniforms.uDpr.value = renderer.getPixelRatio();
    printMat.uniforms.uMargin.value = Math.round(Math.min(W, H) * 0.032);
    ctx.reflectors.forEach(r => r.getRenderTarget().setSize(iw, ih));
  }

  // ================= framing / interaction =================
  // framing(camera, w, h) replaces the reference's fov / camZ rule when given
  let camZ = 22, mode = 0;
  function resize(w = innerWidth, h = innerHeight) {
    const a = w / h;
    if (framing) framing(camera, w, h); else {
    camera.aspect = a;
    const baseHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) * 1.3);
    camera.fov = a < 1.3 ? Math.min(66, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(baseHalf) / a))) : 50;
    camZ = a < 1 ? 22 - 7 * (1 - a) : 22;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    makeTargets();
    dirty = true;
  }
  let dirty = true;

  // ---------- gouache settings ----------
  const G_DEFAULT = { brush: 4, wobble: 3, saturation: 1.06, warmth: 0, tooth: 0.1, pooling: 0.06, lines: true, lineWeight: 3.4, lineStrength: 0.55 };
  const G = Object.assign({}, G_DEFAULT);
  const CONTROLS = [
    ['brush', 'Brush size', 1, 8, 1], ['wobble', 'Brush wobble', 0, 8, 0.5], ['saturation', 'Saturation', 0.5, 1.6, 0.02],
    ['warmth', 'Warmth', -1, 1, 0.05], ['tooth', 'Paper tooth', 0, 0.35, 0.01], ['pooling', 'Pigment pooling', 0, 0.25, 0.01],
    ['lineWeight', 'Line weight', 0.5, 6, 0.1], ['lineStrength', 'Line strength', 0, 1, 0.05]
  ];
  function applyG() {
    const u = printMat.uniforms;
    u.uSat.value = G.saturation; u.uWarm.value = G.warmth; u.uTooth.value = G.tooth; u.uPool.value = G.pooling;
    u.uLines.value = G.lines ? 1 : 0; u.uLineStr.value = G.lineStrength;
    dirty = true; emit('g');
  }
  function setMode(m) { mode = m; dirty = true; emit('mode', m); }

  // ================= render =================
  // the slow part: paint the world (held frames)
  function renderWorld() {
    const gouache = mode === 1;
    renderer.shadowMap.needsUpdate = true;
    // in Gouache the creatures are drawn live on top every frame, so the painted world is rendered without them
    const limbVis = v => { creatures.forEach(c => { c.root.visible = v; c.legs.forEach(l => { l.leg.visible = v; l.foot.visible = v; }); }); hoppers.forEach(h => h.root.visible = v); drops.forEach(d => d.root.visible = v); scoots.forEach(d => d.root.visible = v); flits.forEach(d => d.root.visible = v); pips.forEach(d => d.root.visible = v); floaties.forEach(d => d.root.visible = v); allLimbs.forEach(m => m.visible = v); };
    if (gouache) limbVis(false);
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    if (gouache) limbVis(true);

    // keyline world: hide colour-only things, reveal smooth proxies
    colourOnly.forEach(o => o.visible = false); lineOnly.forEach(o => o.visible = true);
    scene.overrideMaterial = normalMat;
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setClearColor(0x8080ff, 1);
    renderer.setRenderTarget(rtNormal); renderer.clear(); renderer.render(scene, camera);
    renderer.setClearColor(cc, ca);
    scene.overrideMaterial = null;
    colourOnly.forEach(o => o.visible = true); lineOnly.forEach(o => o.visible = false);

    kuwaharaMat.uniforms.uRadius.value = Math.max(1, Math.min(8, Math.round((gouache ? G.brush : 4) * resScale)));
    kuwaharaMat.uniforms.uWarp.value = gouache ? G.wobble : 3;
    sepMat.uniforms.uLineMax.value = gouache ? G.lineWeight : 3.4;
    kuwaharaMat.uniforms.tDiffuse.value = rtScene.texture; pass(kuwaharaMat, rtPaint);
    edgeMat.uniforms.tNormal.value = rtNormal.texture; edgeMat.uniforms.tDepth.value = rtNormal.depthTexture; pass(edgeMat, rtEdge);
    sepMat.uniforms.tPaint.value = rtPaint.texture; sepMat.uniforms.tEdge.value = rtEdge.texture; sepMat.uniforms.uSolve.value = mode === 0 ? 1 : 0;
    pass(sepMat, rtSep);
  }
  // the fast part: the creatures (cheap, every frame in Gouache)
  function renderFolk() {
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    ctx.folkHidden.forEach(o => o.visible = false);
    creatures.forEach(c => c.blob.visible = mode === 1); hoppers.forEach(h => h.blob.visible = mode === 1); drops.forEach(d => d.blob.visible = mode === 1); scoots.forEach(d => d.blob.visible = mode === 1); flits.forEach(d => d.blob.visible = mode === 1); pips.forEach(d => d.blob.visible = mode === 1); floaties.forEach(d => d.blob.visible = mode === 1);
    renderer.setRenderTarget(rtEyes); renderer.setClearColor(0x000000, 0); renderer.clear();
    // depth of the world only (the creatures sort themselves out in the next pass; their garments are cut shells)
    const folkVis = v => { creatures.forEach(c => { c.root.visible = v; c.legs.forEach(l => { l.leg.visible = v; l.foot.visible = v; }); }); [...hoppers, ...drops, ...scoots, ...flits, ...pips, ...floaties].forEach(h => h.root.visible = v); allLimbs.forEach(m => m.visible = v); };
    folkVis(false);
    scene.overrideMaterial = depthOnlyMat; renderer.render(scene, camera); scene.overrideMaterial = null;
    folkVis(true);
    camera.layers.set(FACE_LAYER); renderer.autoClear = false; renderer.render(scene, camera); renderer.autoClear = true; camera.layers.set(0);
    renderer.setClearColor(cc, ca);
    ctx.folkHidden.forEach(o => o.visible = true);
    if (mode === 1) {
      folkPaintMat.uniforms.tFolk.value = rtEyes.texture;
      folkPaintMat.uniforms.uRadius.value = Math.max(2, Math.min(5, Math.round(G.brush * 0.75 * resScale)));
      folkPaintMat.uniforms.uWarp.value = 1.5 + G.wobble * 0.5;
      pass(folkPaintMat, rtFolkPaint);
    }
    creatures.forEach(c => c.blob.visible = false); hoppers.forEach(h => h.blob.visible = false); drops.forEach(d => d.blob.visible = false); scoots.forEach(d => d.blob.visible = false); flits.forEach(d => d.blob.visible = false); pips.forEach(d => d.blob.visible = false); floaties.forEach(d => d.blob.visible = false);
  }
  function composite() {
    const u = printMat.uniforms;
    u.tSep.value = rtSep.texture; u.tPaint.value = rtPaint.texture; u.tEyes.value = mode === 1 ? rtFolkPaint.texture : rtEyes.texture; u.tMask.value = rtEyes.texture; u.uMode.value = mode;
    pass(printMat, null);
  }
  function renderPainted() { renderWorld(); renderFolk(); composite(); }

  // ================= frame =================
  // The reference frame() body minus the camera rig and the creature update (the caller owns those):
  // held frames (12 fps Riso, 24 fps Gouache), Raw renders every frame, the folk every frame in Gouache.
  // beforeDraw(t) runs only when the world is repainted: place the camera, tick sea / pool / birds there.
  let held = 0;
  const HOLD = 1 / 12;   // print editions run on held frames
  function frame(dt, t, beforeDraw) {
    held += dt;
    const hold = mode === 1 ? 1 / 24 : HOLD;   // Gouache repaints the world at 24fps; Riso keeps its 12fps print feel
    let drew = false;
    if (mode === 2 || held >= hold || dirty) {
      held = held % hold;
      if (beforeDraw) beforeDraw(t);
      if (mode === 2) { renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(null); renderer.render(scene, camera); }
      else if (mode === 1) renderWorld();
      else renderPainted();
      dirty = false; drew = true;
    }
    if (mode === 1) { renderFolk(); composite(); }   // creatures move at full frame rate
    return drew;
  }

  return {
    ctx, folk, setMode, get mode() { return mode; }, G, G_DEFAULT, CONTROLS, applyG, resize, makeTargets,
    markDirty() { dirty = true; }, get dirty() { return dirty; }, get camZ() { return camZ; }, get resScale() { return resScale; },
    renderWorld, renderFolk, composite, renderPainted, frame, pass, INKS,
    materials: { kuwaharaMat, edgeMat, sepMat, printMat, folkPaintMat, normalMat, depthOnlyMat },
    get internalSize() { return { iw, ih }; },
    subscribe(fn) { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); }
  };
}

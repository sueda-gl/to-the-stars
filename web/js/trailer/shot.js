// Shared trailer plumbing: a fixed clock for frame-perfect capture, camera keyframe helpers and the
// deterministic pose writers for our two fliers (flits, floaties) standing, hopping and hovering.
// Nothing here touches ctx.rnd: every motion is a pure function of the shot time t.
//
//   window.__shot = { duration, marks, ready, seek(t) -> Promise, play(), stop(), done, t }
//   ?t=3.5   render that instant once and stop (stills)       ?play=1 / default: play in real time (loops with ?loop=1)

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
export const smoother = u => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
export const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
export const easeOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
export const easeIn = u => Math.pow(clamp(u, 0, 1), 2.2);
export const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const hash1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// the fixed clock: render(t) draws one deterministic frame; play() runs the timeline in real time
export function mountShot({ duration, marks = {}, render, ready = Promise.resolve() }) {
  const q = new URLSearchParams(location.search);
  let raf = 0, t0 = 0, cur = 0;
  const shot = {
    duration, marks, ready, done: false,
    get t() { return cur; },
    async seek(t) { await ready; cur = clamp(+t || 0, 0, duration); render(cur); return cur; },
    play() {
      cancelAnimationFrame(raf); shot.done = false;
      ready.then(() => {
        t0 = performance.now();
        const tick = now => {
          cur = Math.min(duration, (now - t0) / 1000);
          render(cur);
          if (cur >= duration) {
            if (q.has('loop')) { t0 = now; raf = requestAnimationFrame(tick); return; }
            shot.done = true; window.__directorDone = true; return;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    },
    stop() { cancelAnimationFrame(raf); }
  };
  window.__shot = shot;
  ready.then(() => {
    if (q.has('t')) { shot.seek(+q.get('t')); shot.done = true; }
    else if (!q.has('hold')) shot.play();
  });
  return shot;
}

// camera keyframes: [{ t, pos:[x,y,z], look:[x,y,z], fov }]; eased (smoother) between neighbours,
// positions through a centripetal Catmull-Rom so a crane moves in one continuous arc
export function cameraTrack(keys) {
  const P = keys.map(k => new THREE.Vector3(...k.pos)), Lk = keys.map(k => new THREE.Vector3(...k.look));
  const cr = (pts, i, u, out) => {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(pts.length - 1, i + 1)], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    for (const ax of ['x', 'y', 'z'])
      out[ax] = 0.5 * ((2 * p1[ax]) + (-p0[ax] + p2[ax]) * u + (2 * p0[ax] - 5 * p1[ax] + 4 * p2[ax] - p3[ax]) * u2 + (-p0[ax] + 3 * p1[ax] - 3 * p2[ax] + p3[ax]) * u3);
    return out;
  };
  return function at(t, outPos, outLook) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1] || a;
    const u = b === a ? 0 : (b.ease || smoother)(span(t, a.t, b.t));
    if (b.linearPath) { outPos.lerpVectors(P[i], P[i + 1], u); outLook.lerpVectors(Lk[i], Lk[i + 1], u); }
    else { cr(P, i, u, outPos); cr(Lk, i, u, outLook); }
    return lerp(a.fov, b.fov, u);
  };
}

// ---------------------------------------------------------------------------------------------------------
// Poses for our fliers, written the way agents/fliers.js writes a driven flier (the reference grammar), but as a
// pure function of the pose: no state carried between frames, so any t can be rendered in any order.
const STAND = { flit: 0.34, floatie: 0.32 }, HANG = 0.82, TILT = -0.3, BALL = { flit: 0.226, floatie: 0.23 };
export function createPoser(ctx, folk) {
  const V = ctx.V;
  const side = new THREE.Vector3();
  // P: { x, z, heading, y? (air: root height), hop (m), squash (1 = none), pitch (+ = nod down, - = look up), bank,
  //      prop (rotor angle), blink (bool), air (bool), wave (0..1, floatie), t }
  function flit(a, P) {
    const sc = a.sc, st = P.squash || 1, inv = 1 / Math.sqrt(st);
    const air = !!P.air, ry = air ? P.y : STAND.flit * sc + (P.hop || 0);
    a.driven = true;
    a.pos.set(P.x, ry, P.z); a.heading = P.heading;
    a.root.position.set(P.x, ry, P.z); a.root.rotation.set(0, P.heading, 0);
    a.prop.rotation.y = P.prop || 0;
    a.body.position.set(0, -BALL.flit * (1 - st), 0);
    a.body.rotation.set(P.pitch || 0, 0, P.bank || 0);
    a.body.scale.set(inv, st, inv);
    side.set(Math.cos(P.heading), 0, -Math.sin(P.heading));
    const hip = l => V(l.sd * 0.08, a.body.position.y - 0.17, 0);
    const up = air || (P.hop || 0) > 0.015;
    a.legs.forEach(l => { l.pos.set(P.x + side.x * l.sd * 0.08 * sc, 0, P.z + side.z * l.sd * 0.08 * sc); l.lift = 0; l.t = 1; });
    if (!up) folk.poseLegs(a, a.legs, hip);
    else {
      const kick = l => Math.sin((P.t || 0) * 7 + a.fidget + l.sd * 1.6) * 0.03 * sc;
      const fw = V(Math.sin(P.heading), 0, Math.cos(P.heading));
      a.legs.forEach(l => { l.pos.x += fw.x * kick(l); l.pos.z += fw.z * kick(l); });
      folk.poseLegs(a, a.legs, hip, () => ry - 0.33 * sc);
    }
    a.legsPlaced = true;
    a.blob.position.set(P.x, 0.015, P.z); a.blob.scale.setScalar(sc * 0.75 / (1 + Math.max(0, ry - STAND.flit * sc) * 0.6));
    a.eyes.forEach(e => e.scale.y = P.blink ? 0.12 : 1);
  }
  function floatie(a, P) {
    const sc = a.sc, st = P.squash || 1, inv = 1 / Math.sqrt(st), air = !!P.air;
    const tilt = air ? lerp(TILT, 0, clamp(P.airK ?? 1, 0, 1)) : TILT;
    const t = P.t || 0;
    a.driven = true;
    const ryGround = (STAND.floatie + HANG * Math.cos(TILT)) * sc;
    const ry = air ? P.y : ryGround + (P.hop || 0);
    const off = Math.sin(tilt) * HANG * sc;
    a.heading = P.heading;
    a.pos.set(P.x, ry, P.z);
    a.root.position.set(P.x + Math.sin(P.heading) * off, ry, P.z + Math.cos(P.heading) * off);
    a.root.rotation.set(0, P.heading, 0);
    const swx = (P.swx || 0) + Math.sin(t * 0.8 + a.fidget) * 0.025, swz = P.swz || 0;
    const sw = tilt + swx;
    a.swing.rotation.set(sw, 0, swz);
    a.canopy.rotation.set(sw * 0.9, P.spin || 0, swz * 0.9);
    a.body.position.set(0, -HANG - BALL.floatie * (1 - st), 0);
    a.body.rotation.set(-tilt + (P.pitch || 0), Math.sin(t * 0.6 + a.fidget) * 0.08, -swz);
    a.body.scale.set(inv, st, inv);
    const w = clamp(P.wave || 0, 0, 1);
    a.wave.rotation.set(0, 0, -0.35 - w * (1.6 + Math.sin(t * 12 + a.fidget) * 0.32));
    a.root.updateMatrixWorld(true);
    const hipL = l => a.root.worldToLocal(a.body.localToWorld(V(l.sd * 0.07, -0.16, 0)));
    side.set(Math.cos(P.heading), 0, -Math.sin(P.heading));
    const up = air || (P.hop || 0) > 0.015;
    if (!up) {
      a.legs.forEach(l => { l.pos.set(P.x + side.x * l.sd * 0.07 * sc, 0, P.z + side.z * l.sd * 0.07 * sc); l.lift = 0; l.t = 1; });
      folk.poseLegs(a, a.legs, hipL);
    } else {
      const hs = [];
      a.legs.forEach(l => {
        const h = a.root.localToWorld(hipL(l)); hs.push(h.y);
        const kick = Math.sin(t * 3 + a.fidget + l.sd * 1.6) * 0.03 * sc;
        l.pos.set(h.x + Math.sin(P.heading) * kick, 0, h.z + Math.cos(P.heading) * kick); l.lift = 0; l.t = 1;
      });
      let i = 0; folk.poseLegs(a, a.legs, hipL, () => Math.max(0, hs[i++] - 0.16 * sc));
    }
    a.legsPlaced = true;
    a.blob.position.set(P.x, 0.015, P.z); a.blob.scale.setScalar(sc * 0.7 / (1 + Math.max(0, ry - ryGround) * 0.5));
    a.eyes.forEach(e => e.scale.y = P.blink ? 0.11 : 0.9);
  }
  // a blink now and then, from t alone
  const blinkAt = (t, seed) => { const per = 3.1 + hash1(seed) * 2.8, ph = hash1(seed + 9) * per; return ((t + ph) % per) < 0.13; };
  return { flit, floatie, blinkAt, STAND, HANG, TILT };
}

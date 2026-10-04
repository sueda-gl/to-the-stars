// Our people walk AND fly (ART_DIRECTION §7). Flits and floaties are the Red arch's fliers: folk.js flies them
// (route, cruise, bob, pendulum, dangling legs). This module adds the other half of their lives. While a flier is
// on the ground, landing, taking off or gliding down from the sky, `a.driven = true` (the one behaviour seam in
// folk.js: its update skips that flier) and this module writes the creature itself, in the reference grammar:
//   - flits land with the propeller winding down, plant their feet on the shared leg rig (folk.stepLegs /
//     poseLegs, like pips) and walk with a body that dips on every footfall; they take off with a crouch, a little
//     hop and the propeller spinning back up, legs left dangling;
//   - floaties drift down under the parasol, and on the ground they hold it over their head tilted back as a
//     sunshade, waddle on their little legs with the free arm swinging, and float back up as the parasol rights itself.
// Walk or fly is decided per trip (go): short hops walk; long trips, water crossings and anything that should not
// land (gifts, departures) fly. Units: m.ry is the ROOT height above the ground (flit root = body centre, floatie
// root = the canopy); the bridge's pose pass adds the relief (groundY) on top, as it does for every folk.
//
//   const fm = createFlierMotion(ctx, folk, { props, groundY, isWater, grounded })
//   fm.init(rec, 'air' | 'ground')        fm.placeAir(rec, x, y, z)       fm.placeGround(rec, x, z)
//   fm.go(rec, x, z, { fly: 'auto'|true|false, land = true, y, via, speed, walkMax })
//   fm.stand(rec) · fm.hold(rec, on) · fm.arrived(rec, r) · fm.glide(rec, from, to) · fm.down(rec) · fm.step(rec, dt, t)

const STAND = { flit: 0.34, floatie: 0.32 };    // x sc: flit root (= body centre) / floatie body centre above the feet
const HANG = 0.82;                               // floatie: the body hangs this far under the canopy (body-local units)
const MIN_AIR = { flit: 1.6, floatie: 2.6 };     // folk.js clamps fliers at these heights
export const CRUISE = { flit: 2.7, floatie: 3.4 };
const AIR_SPEED = { flit: 3.3, floatie: 2.3 };
const WALK_SPEED = { flit: 1.45, floatie: 1.15 };
const PROP = 38;                                 // the reference propeller spin, rad/s
const TILT = -0.3;                               // floatie on the ground: the parasol leans back over the shoulder
export const WALK_MAX = 9;                       // farther than this (or across water) a trip is flown
const BALL = { flit: 0.226, floatie: 0.23 };     // body radius (local): squash about the feet, not the middle

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = u => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;

export function createFlierMotion(ctx, folk, opts = {}) {
  const { V, camera } = ctx;
  const { props = null, groundY = () => 0, isWater = () => false, grounded = () => [] } = opts;
  const nav = folk.nav, wrap = folk.wrapAngle;
  const tmpA = V(0, 0, 0), tmpB = V(0, 0, 0);

  const groundRy = (sp, sc, tilt = TILT) => sp === 'flit' ? STAND.flit * sc : (STAND.floatie + HANG * Math.cos(tilt)) * sc;
  const bob = (rec, t) => rec.species === 'flit' ? Math.sin(t * 2.4 + rec.a.fidget) * 0.08 : Math.sin(t * 0.8 + rec.a.fidget) * 0.12;

  function init(rec, mode = 'air') {
    const a = rec.a, sp = rec.species;
    rec.mv = { mode, t: 0, path: [], speed: WALK_SPEED[sp], prop: mode === 'air' ? PROP : 0, dip: 0, sway: 0, stride: 0,
      touch: 9, queued: null, landAt: null, want: null, frozen: false, x: a.pos.x, z: a.pos.z, ry: a.pos.y,
      tilt: mode === 'air' ? 0 : TILT, spin: a.canopy ? a.canopy.rotation.y : 0, lookT: 1 + Math.random() * 3, lookCam: false,
      idleH: a.heading, blink: 0, nb: 1 + Math.random() * 4, stuck: 0, crouch: 0 };
    a.driven = mode !== 'air';
    if (mode === 'ground') { rec.mv.ry = groundRy(sp, a.sc); a.legsPlaced = false; }
    return rec.mv;
  }
  function placeAir(rec, x, y, z) {
    const a = rec.a; init(rec, 'air');
    a.pos.set(x, y, z); a.root.position.copy(a.pos); a.vel.set(0, 0, 0); a.route = [];
    Object.assign(rec.mv, { x, z, ry: y });
  }
  function placeGround(rec, x, z) {
    const a = rec.a; init(rec, 'ground');
    Object.assign(rec.mv, { x, z }); a.pos.set(x, rec.mv.ry, z); a.vel.set(0, 0, 0); a.route = [];
  }
  const down = rec => !!(rec.mv && rec.mv.mode === 'ground');

  // ---- where to come down: never in the lake or the sea ----
  function dry(x, z) {
    try {
      if (!isWater(x, z)) return { x, z };
      for (const r of [1, 2, 3, 4.5, 6, 8, 11]) for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!isWater(px, pz)) return { x: px, z: pz };
      }
    } catch (e) { /* no geography: anywhere is fine */ }
    return { x, z };
  }
  function wet(p, x, z) {
    try {
      const d = Math.hypot(x - p.x, z - p.z), n = Math.ceil(d / 1.2);
      for (let i = 1; i < n; i++) { const u = i / n; if (isWater(lerp(p.x, x, u), lerp(p.z, z, u))) return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  // =============== trips ===============
  function go(rec, x, z, opt = {}) {
    const a = rec.a, m = rec.mv; if (!a || !m) return;
    const sp = rec.species;
    const o = { fly: 'auto', land: true, y: CRUISE[sp], via: null, speed: null, walkMax: WALK_MAX, ...opt };
    if (o.y == null) o.y = CRUISE[sp];
    if (o.land) { const d = dry(x, z); x = d.x; z = d.z; }
    m.want = { x, z, o };
    rec.goal = o.land ? V(x, 0, z) : V(x, o.y, z);
    if (m.mode === 'lift' || m.mode === 'land' || m.mode === 'glide') { m.queued = { x, z, o }; return; }
    const dist = Math.hypot(x - m.x, z - m.z);
    const fly = o.fly === true || !o.land || (o.fly === 'auto' && (dist > o.walkMax || wet(a.pos, x, z)));
    if (m.mode === 'ground') {
      if (!fly) { m.path = (o.via || []).map(p => V(p.x, 0, p.z)).concat([V(x, 0, z)]); m.speed = o.speed && o.speed < 2.2 ? o.speed : WALK_SPEED[sp]; m.best = Infinity; m.stall = 0; return; }
      m.path = []; m.queued = { x, z, o: { ...o, fly: true } }; startLift(rec); return;
    }
    // in the air already: fly there (and land if asked)
    a.route = (o.via || []).map(p => V(p.x, p.y ?? o.y, p.z)).concat([V(x, o.y, z)]);
    a.speed = o.speed || AIR_SPEED[sp]; m.cruise = a.speed; m.stuck = 0;
    m.landAt = o.land ? { x, z } : null;
  }
  // stop where you are (on the ground); a flier in the air comes down right here
  function stand(rec) {
    const a = rec.a, m = rec.mv; if (!a || !m) return;
    m.want = null;
    if (m.mode === 'ground') { m.path = []; rec.goal = null; }
    else if (m.mode === 'air') { const d = dry(a.pos.x, a.pos.z); m.landAt = d; a.route = [V(d.x, a.pos.y, d.z)]; m.stuck = 0; rec.goal = V(d.x, 0, d.z); }
    else if (m.mode === 'lift') m.queued = null;
  }
  // freeze in place (listening): feet stay planted / the flier hovers; release carries on with the same trip
  function hold(rec, on) {
    const a = rec.a, m = rec.mv; if (!a || !m || m.frozen === !!on) return;
    m.frozen = !!on;
    if (m.mode === 'air') {
      if (on) { m.savedRoute = a.route.slice(); a.route = [a.pos.clone()]; }
      else if (m.savedRoute) { a.route = m.savedRoute; m.savedRoute = null; }
    }
  }
  function arrived(rec, r = 0.75) {
    const a = rec.a, m = rec.mv; if (!a || !m) return true;
    const landing = m.want ? m.want.o.land : true;
    if (landing) return m.mode === 'ground' && !m.path.length && !m.queued;
    return m.mode === 'air' && (!rec.goal || a.pos.distanceTo(rec.goal) < r + 0.3);
  }

  // =============== per frame ===============
  function step(rec, dt, t) {
    const m = rec.mv; if (!m || !rec.a) return;
    m.t += dt;
    if (m.mode === 'air') air(rec, dt, t);
    else if (m.mode === 'ground') ground(rec, dt, t);
    else if (m.mode === 'land') landing(rec, dt, t);
    else if (m.mode === 'lift') lifting(rec, dt, t);
    else if (m.mode === 'glide') gliding(rec, dt, t);
  }

  // ---- in the air: folk.js flies it; we only decide when to come down ----
  function air(rec, dt, t) {
    const a = rec.a, m = rec.mv;
    a.driven = false;
    a.body.scale.set(1, 1, 1); a.body.position.set(0, rec.species === 'flit' ? 0 : -HANG, 0);   // undo the ground pose
    if (rec.species === 'floatie') m.spin = a.canopy.rotation.y;
    m.prop = PROP; m.x = a.pos.x; m.z = a.pos.z; m.ry = a.root.position.y;
    if (m.landAt && !m.frozen) {
      const dh = Math.hypot(a.pos.x - m.landAt.x, a.pos.z - m.landAt.z), hsp = Math.hypot(a.vel.x, a.vel.z);
      if (dh < 3.5) a.speed = clamp(dh * 0.9, 0.9, m.cruise || AIR_SPEED[rec.species]);
      m.stuck = dh < 2.2 && hsp < 0.5 ? m.stuck + dt : 0;          // jostled by the others: come down anyway
      if (dh < 0.9 || m.stuck > 0.6) startLand(rec, dt, t);
    }
  }

  // ---- coming down: legs reach for the paper, the propeller winds down / the parasol leans back ----
  function startLand(rec, dt, t) {
    const a = rec.a, m = rec.mv, sp = rec.species;
    a.driven = true; m.mode = 'land'; m.t = 0;
    m.x0 = a.pos.x; m.z0 = a.pos.z; m.ry0 = a.root.position.y;
    m.lx = m.landAt.x; m.lz = m.landAt.z; m.landAt = null;
    m.T = sp === 'flit' ? 0.5 + 0.17 * m.ry0 : 0.9 + 0.3 * m.ry0;
    if (sp === 'floatie') m.spin = a.canopy.rotation.y;
    landing(rec, 0, t);
  }
  function landing(rec, dt, t) {
    const a = rec.a, m = rec.mv, sp = rec.species, sc = a.sc;
    const u = Math.min(1, m.t / m.T);
    const eh = 1 - Math.pow(1 - u, 2.2);                                     // drift over the spot early
    // both leave the cruise / glide with no vertical kick and settle softly (floaties used 1-(1-u)^1.8: a 3 cm drop
    // in the first frame of every landing)
    const ev = ease(u);
    const x = lerp(m.x0, m.lx, eh), z = lerp(m.z0, m.lz, eh);
    if (dt > 0) a.vel.set((x - m.x) / dt, 0, (z - m.z) / dt);
    m.x = x; m.z = z;
    if (sp === 'floatie') m.tilt = TILT * ease(clamp((u - 0.45) / 0.55, 0, 1));
    m.ry = lerp(m.ry0, groundRy(sp, sc, m.tilt), ev);
    m.prop = PROP * (1 - 0.75 * u);
    if (sp === 'floatie') m.spin += dt * 0.5;
    turnTo(rec, dt, 2.5);
    write(rec, dt, t, 'dangle', sp === 'flit' ? { pitch: -0.18 * Math.sin(u * Math.PI) } : { swx: 0.08 * Math.sin(u * Math.PI * 2) });
    if (u >= 1) touchdown(rec, t);
  }
  function touchdown(rec, t) {
    const a = rec.a, m = rec.mv, sc = a.sc;
    m.mode = 'ground'; m.t = 0; m.touch = 0; m.dip = 1; m.path = []; m.stuck = 0;
    a.vel.set(0, 0, 0); a.legsPlaced = false; m.ry = groundRy(rec.species, sc);
    if (props) props.puff(m.x, m.z, { n: 7, r: 0.2 * sc, size: 0.06 * sc, speed: 1.1, up: 0.45, life: 0.55, y: 0.04 + (groundY(m.x, m.z) || 0) });
    if (m.queued) { const q = m.queued; m.queued = null; go(rec, q.x, q.z, q.o); }
    ground(rec, 0, t);
  }

  // ---- taking off: crouch, a little hop, then up under the propeller / the parasol rights itself ----
  const CROUCH = 0.16;
  function startLift(rec) {
    const a = rec.a, m = rec.mv, sp = rec.species;
    a.driven = true; m.mode = 'lift'; m.t = 0;
    m.ry0 = m.ry; m.Y1 = MIN_AIR[sp] + 0.35; m.T = sp === 'flit' ? 0.75 : 1.15; m.tilt0 = m.tilt;
  }
  function lifting(rec, dt, t) {
    const a = rec.a, m = rec.mv, sp = rec.species, sc = a.sc;
    m.prop += (PROP - m.prop) * Math.min(1, dt * 7);
    if (m.t < CROUCH) {
      m.crouch = ease(m.t / CROUCH);
      // a walker that takes off slows to a stop over the crouch (it used to stop dead from 1.2 m/s in one frame)
      a.vel.y = 0; a.vel.multiplyScalar(Math.pow(0.0005, dt)); m.x += a.vel.x * dt; m.z += a.vel.z * dt;
      folk.stepLegs(a, a.legs, dt, { spread: 0.08, lift: 0.05, dur: 0.17 });
      write(rec, dt, t, 'plant', { st: 1 - 0.16 * m.crouch, by: -0.03 * m.crouch });
      return;
    }
    m.crouch = 0;
    const u = Math.min(1, (m.t - CROUCH) / m.T);
    const rise = sp === 'flit' ? 1 - Math.pow(1 - u, 2.4) : ease(u);
    if (sp === 'floatie') m.tilt = m.tilt0 * (1 - ease(Math.min(1, u * 1.8)));
    const base = groundRy(sp, sc, m.tilt);
    m.ry = lerp(base, m.Y1, rise) + bob(rec, t) * u;
    if (sp === 'floatie') m.spin += dt * (0.5 + u);
    write(rec, dt, t, 'dangle', sp === 'flit' ? { st: 1 + 0.12 * Math.sin(Math.min(1, u * 2) * Math.PI) } : { st: 1 + 0.06 * Math.sin(Math.min(1, u * 2) * Math.PI), swx: -0.1 * Math.sin(u * Math.PI) });
    if (u >= 1) {
      m.mode = 'air'; a.driven = false; m.t = 0;
      a.pos.set(m.x, m.Y1, m.z); a.vel.set(0, 0, 0); a.route = [];
      if (sp === 'flit') a.bank = 0;
      else { a.swingA.set(0, 0, 0); a.swingV.set(0, 0, 0); a.lastVel.set(0, 0, 0); }
      a.body.scale.set(1, 1, 1); a.body.position.set(0, sp === 'flit' ? 0 : -HANG, 0); a.body.rotation.set(0, 0, 0);
      if (m.queued) { const q = m.queued; m.queued = null; go(rec, q.x, q.z, q.o); }
      else stand(rec);
    }
  }

  // ---- arriving from the sky (Act 1): a long gentle glide down to just above the spot, then a landing ----
  function glide(rec, from, to, { speed = null } = {}) {
    const a = rec.a, sp = rec.species, m = init(rec, 'glide');
    a.driven = true;
    const lt = dry(to.x, to.z);
    m.p0 = from.clone(); m.p2 = V(lt.x, MIN_AIR[sp] + 0.8, lt.z);
    m.p1 = V(lerp(m.p0.x, m.p2.x, 0.6), m.p2.y + (m.p0.y - m.p2.y) * 0.22, lerp(m.p0.z, m.p2.z, 0.6));
    const len = m.p0.distanceTo(m.p1) + m.p1.distanceTo(m.p2);
    m.T = len / (speed || (sp === 'flit' ? 5 : 3.9)); m.t = 0; m.prop = PROP; m.tilt = 0;
    m.x = from.x; m.z = from.z; m.ry = from.y; m.glideTo = lt;
    rec.goal = V(lt.x, 0, lt.z); m.want = { x: lt.x, z: lt.z, o: { land: true } };
    const d = m.p1.clone().sub(m.p0); a.heading = Math.atan2(d.x, d.z);
    gliding(rec, 0, 0);
  }
  function gliding(rec, dt, t) {
    const a = rec.a, m = rec.mv, sp = rec.species;
    const u = Math.min(1, m.t / m.T), s = 1 - Math.pow(1 - u, 1.6), k = 1 - s;
    tmpA.copy(m.p0).multiplyScalar(k * k).addScaledVector(m.p1, 2 * k * s).addScaledVector(m.p2, s * s);
    // a lazy side-to-side drift, like a leaf (fades out over the spot)
    const side = Math.sin(u * Math.PI * 2 + a.fidget) * 0.9 * (1 - u);
    tmpA.x += Math.cos(a.heading) * side; tmpA.z -= Math.sin(a.heading) * side;
    if (dt > 0) a.vel.set((tmpA.x - m.x) / dt, (tmpA.y - m.ry) / dt, (tmpA.z - m.z) / dt);
    m.x = tmpA.x; m.z = tmpA.z; m.ry = tmpA.y + bob(rec, t) * u;
    const hsp = Math.hypot(a.vel.x, a.vel.z);
    const turn = turnTo(rec, dt, 2.2);
    if (sp === 'floatie') m.spin += dt * (0.5 + hsp * 0.6);
    write(rec, dt, t, 'dangle', sp === 'flit'
      ? { pitch: 0.25 * Math.min(1, hsp / 3), bank: clamp(-turn * 1.2, -0.5, 0.5) }
      : { swx: 0.1 * Math.min(1, hsp / 2) + Math.sin(t * 0.9 + a.fidget) * 0.06, swz: Math.sin(t * 0.7 + a.fidget * 2) * 0.06 });
    if (u >= 1) { a.pos.set(m.x, m.ry, m.z); m.landAt = m.glideTo; startLand(rec, dt, t); }
  }

  // ---- on the ground: walk the path like a pip; feet planted, body bobbing, propeller still ----
  // Calm by construction (ART_DIRECTION §15 "no buzzing"). The old walker steered toward path + crowd push summed,
  // so near a spot the two cancelled and the heading flipped every few frames (a floatie's canopy, offset by the
  // heading, zig-zagged 4-5 cm at ~8 Hz), and the sim's fleet slots (1.6 m apart) sat inside the crowd radius (1.7 m),
  // so a folk walking back to its slot could never arrive. Now: the heading follows the PATH only, rate-limited;
  // the crowd is a gentle sidestep that never turns anyone; standing folk only make room for a real overlap; a folk
  // held off its spot by the crowd stops where it is (no hunting).
  const SEP = { base: 0.95, canopy: 0.25 };       // crowd radius: 0.95 m, + 0.25 per parasol (floatie pair 1.45 < 1.6)
  const TURN_MAX = 4.2;                            // rad/s: the fastest a walker turns
  // turning eases in and out (a critically damped turn rate), so a walk never starts or stops with a heading kink
  function turnAt(m, a, rate, dt) { m.hv = (m.hv || 0) + (rate - (m.hv || 0)) * Math.min(1, dt * 20); a.heading += m.hv * dt; }
  function ground(rec, dt, t) {
    const a = rec.a, m = rec.mv, sp = rec.species, sc = a.sc;
    a.driven = true;
    m.touch += dt;
    const want = tmpA.set(0, 0, 0); let moving = false;
    if (rec.faceOn) m.hv = rec.hv || 0;   // the bridge held the heading last frame: carry on from its turn rate
    if (m.path.length && !m.frozen) {
      if (m.path.length > 1 && Math.hypot(m.path[0].x - m.x, m.path[0].z - m.z) < 0.5) m.path.shift();
      const g = m.path[0], dx = g.x - m.x, dz = g.z - m.z, dd = Math.hypot(dx, dz), last = m.path.length === 1;
      // progress watch: the crowd holding the spot would otherwise keep a folk hunting round it for ever
      if (dd < (m.best ?? Infinity) - 0.04) { m.best = dd; m.stall = 0; } else m.stall = (m.stall || 0) + dt;
      if (last && (dd < 0.3 || (dd < 1.3 && m.stall > 0.7) || m.stall > 4)) { m.path.shift(); m.best = Infinity; m.stall = 0; }
      else if (dd > 1e-4) {
        // ease into the last spot instead of overshooting it
        const s = m.speed * (last ? clamp(dd / 0.8, 0.3, 1) : 1);
        want.set(dx / dd * s, 0, dz / dd * s); moving = true;
      }
    }
    // the crowd: walkers of every species and our other grounded folk (a floatie's parasol needs room)
    const sep = tmpB.set(0, 0, 0);
    const near = o => {
      if (o === a || !o.pos) return;
      const R0 = SEP.base + (sp === 'floatie' ? SEP.canopy : 0) + (o.canopy ? SEP.canopy : 0);
      const dx = m.x - o.pos.x, dz = m.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 >= R0 * R0 || d2 < 1e-6) return;
      const d = Math.sqrt(d2), over = R0 - d;
      // a walker sidesteps; someone standing only shuffles aside for a real overlap (squares never jostle)
      const k = moving ? 1.4 * over / d : over > 0.2 ? (over - 0.2) * 2 / d : 0;
      sep.x += dx * k; sep.z += dz * k;
    };
    [folk.creatures, folk.hoppers, folk.drops, folk.scoots, folk.pips].forEach(l => l.forEach(near));
    grounded().forEach(near);
    nav.obstacles.forEach(o => { const dx = m.x - o[0], dz = m.z - o[1], dd = Math.hypot(dx, dz), r = o[2] + 0.5; if (dd < r && dd > 1e-4) { const k = (r - dd) * 3 / dd; sep.x += dx * k; sep.z += dz * k; } });
    const sl = Math.hypot(sep.x, sep.z), cap = moving ? 0.8 : 0.5;
    if (sl > cap) sep.multiplyScalar(cap / sl);
    if (moving) {
      // turn toward where the path goes (never toward the crowd's push), at most TURN_MAX rad/s, then walk off
      const turn = wrap(Math.atan2(want.x, want.z) - a.heading);
      turnAt(m, a, clamp(turn * 5, -TURN_MAX, TURN_MAX), dt);
      const spd = Math.hypot(want.x, want.z) * Math.max(0.15, Math.cos(turn));
      want.set(Math.sin(a.heading) * spd + sep.x, 0, Math.cos(a.heading) * spd + sep.z);
    } else {
      want.copy(sep); if (want.length() < 0.06) want.set(0, 0, 0);
      // idle gaze: now and then at you, otherwise somewhere of their own (not while the bridge holds a facing)
      if (!rec.faceOn) {
        m.lookT -= dt;
        if (m.lookT <= 0) { m.lookCam = !m.lookCam && Math.random() < 0.6; m.lookT = m.lookCam ? 1.5 + Math.random() * 2.5 : 4 + Math.random() * 8; m.idleH = a.heading + (Math.random() - 0.5) * 2.2; }
        const gaze = m.lookCam ? Math.atan2(camera.position.x - m.x, camera.position.z - m.z) : m.idleH;
        turnAt(m, a, clamp(wrap(gaze - a.heading) * 2, -2, 2), dt);
      } else m.hv = 0;
    }
    const push = want;
    a.vel.y = 0;
    a.vel.lerp(push, 1 - Math.pow(0.02, dt));
    m.x += a.vel.x * dt; m.z += a.vel.z * dt;
    a.pos.set(m.x, m.ry, m.z); nav.bounds(a.pos); m.x = a.pos.x; m.z = a.pos.z;
    m.ry = groundRy(sp, sc);
    // idle life: a flit gives its propeller a little twirl now and then; a floatie waves its free hand
    m.idle = moving ? 0 : (m.idle || 0) + dt;
    if (m.idle > 3 && Math.random() < dt / 9) { if (sp === 'flit') m.twirl = 0.9; else m.waveT = 1.6; }
    m.twirl = Math.max(0, (m.twirl || 0) - dt); m.waveT = Math.max(0, (m.waveT || 0) - dt);
    if (m.twirl > 0) m.prop = Math.max(m.prop, 16 * Math.sin(m.twirl / 0.9 * Math.PI));
    else { m.prop *= Math.pow(0.1, dt); if (m.prop < 0.5) m.prop = 0; }      // the propeller spins down and stops
    if (sp === 'floatie') { m.spin += dt * (0.12 + a.vel.length() * 0.25); m.tilt = TILT; }
    const stp = folk.stepLegs(a, a.legs, dt, { spread: sp === 'flit' ? 0.08 : 0.07, lift: 0.05, dur: sp === 'flit' ? 0.16 : 0.2 });
    if (stp.landed) m.dip = 1;
    m.dip = Math.max(0, m.dip - dt * 7);
    const w = Math.min(1, a.vel.length() / 0.5);
    m.sway += ((stp.swinging ? -stp.swinging.sd : 0) - m.sway) * Math.min(1, dt * 10);
    const rise = stp.swinging ? Math.sin(Math.PI * stp.swinging.t) : 0;
    m.stride += stp.swinging ? dt / stp.swinging.dur * Math.PI : 0;
    m.w = w;
    // touchdown: a squash that springs back (eased in over ~4 frames: it used to snap 30 % flat in one)
    const tk = m.touch, land = tk < 0.8 ? 0.22 * ease(Math.min(1, tk / 0.07)) * Math.exp(-tk * 6) * Math.cos(Math.max(0, tk - 0.07) * 11) : 0;
    const st = (1 - 0.07 * Math.sin(m.dip * Math.PI) + 0.035 * rise + Math.sin(t * 2.1 + a.fidget) * 0.02 * (1 - w)) * (1 - land);
    const by = -0.02 * Math.sin(m.dip * Math.PI) + 0.025 * rise;
    if (sp === 'flit') write(rec, dt, t, 'plant', { st, by, pitch: 0.1 * w, bank: -m.sway * 0.07 * Math.max(w, 0.4) + (1 - w) * Math.sin(t * 0.9 + a.fidget) * 0.04 });
    else write(rec, dt, t, 'plant', { st, by, roll: -m.sway * 0.06 * Math.max(w, 0.4), swz: m.sway * 0.04 * w, swx: Math.sin(t * 0.8 + a.fidget) * 0.025 });
  }

  function turnTo(rec, dt, rate) {
    const a = rec.a, hsp = Math.hypot(a.vel.x, a.vel.z);
    if (hsp < 0.3 || dt <= 0) return 0;
    const turn = wrap(Math.atan2(a.vel.x, a.vel.z) - a.heading);
    a.heading += turn * Math.min(1, dt * rate);
    return turn;
  }

  // =============== the pose writer (everything folk.js writes for a flier, when it doesn't) ===============
  function write(rec, dt, t, legs, k = {}) {
    const a = rec.a, m = rec.mv, sc = a.sc, flit = rec.species === 'flit';
    const st = k.st || 1, inv = 1 / Math.sqrt(st);
    a.pos.set(m.x, m.ry, m.z);
    a.root.rotation.set(0, a.heading, 0);
    if (flit) {
      a.root.position.set(m.x, m.ry, m.z);
      a.prop.rotation.y += dt * m.prop;
      a.body.position.set(0, (k.by || 0) - BALL.flit * (1 - st), 0);
      a.body.rotation.set(k.pitch || 0, 0, k.bank || 0);
      a.body.scale.set(inv, st, inv);
    } else {
      const sw = m.tilt + (k.swx || 0), sz = k.swz || 0;
      // keep the BODY over (m.x, m.z): the canopy (root) sits behind it when the parasol leans back
      const off = Math.sin(m.tilt) * HANG * sc;
      a.root.position.set(m.x + Math.sin(a.heading) * off, m.ry, m.z + Math.cos(a.heading) * off);
      a.swing.rotation.set(sw, 0, sz);
      a.canopy.rotation.set(sw * 0.9, m.spin, sz * 0.9);
      a.body.position.set(0, -HANG + (k.by || 0) - BALL.floatie * (1 - st), 0);
      a.body.rotation.set(-m.tilt, Math.sin(t * 0.6 + a.fidget) * 0.25 * (legs === 'plant' ? 0.3 : 1), (k.roll || 0) - sz);
      a.body.scale.set(inv, st, inv);
      // the free arm hangs and swings with the steps (or paddles in the air)
      const hello = legs === 'plant' && m.waveT > 0 ? Math.sin(Math.min(1, m.waveT / 1.6) * Math.PI) : 0;
      a.wave.rotation.set(legs === 'plant' ? Math.sin(m.stride) * 0.55 * (m.w || 0) : 0, 0, (legs === 'plant' ? -0.35 : -0.3) - hello * (1.6 + Math.sin(t * 12) * 0.3));
    }
    // legs
    a.root.updateMatrixWorld(true);
    const hip = flit
      ? (l => V(l.sd * 0.08, a.body.position.y - 0.17, 0))
      : (l => a.root.worldToLocal(a.body.localToWorld(V(l.sd * 0.07, -0.16, 0))));
    if (legs === 'plant') folk.poseLegs(a, a.legs, hip);
    else {
      // dangling under the hips and kicking a little; feet never go through the paper
      const fw = tmpB.set(Math.sin(a.heading), 0, Math.cos(a.heading)), hs = [];
      a.legs.forEach(l => {
        const h = a.root.localToWorld(hip(l)); hs.push(h.y);
        const kick = Math.sin(t * (flit ? 7 : 3) + a.fidget + l.sd * 1.6) * (flit ? 0.035 : 0.03) * sc;
        l.pos.set(h.x + fw.x * kick, 0, h.z + fw.z * kick); l.t = 1; l.lift = 0;
      });
      let i = 0;
      folk.poseLegs(a, a.legs, hip, () => Math.max(0, hs[i++] - 0.16 * sc));
    }
    // blinks (off the paint stream)
    m.nb -= dt; if (m.nb <= 0) { m.blink = 0.12; m.nb = 2 + Math.random() * 4; }
    m.blink = Math.max(0, m.blink - dt);
    a.eyes.forEach(e => e.scale.y = m.blink > 0 ? (flit ? 0.12 : 0.11) : (flit ? 1 : 0.9));
  }

  // the bridge turned a driven floatie after write() (a facing): put the canopy back behind the body for the new
  // heading, so the body turns on the spot instead of swinging round the parasol's tip
  function seat(rec) {
    const a = rec.a, m = rec.mv; if (!a || !m || rec.species !== 'floatie' || !a.driven) return;
    const off = Math.sin(m.tilt) * HANG * a.sc;
    a.root.position.x = m.x + Math.sin(a.heading) * off; a.root.position.z = m.z + Math.cos(a.heading) * off;
  }

  return { init, placeAir, placeGround, go, stand, hold, arrived, glide, step, down, dry, seat, CRUISE, WALK_MAX, MIN_AIR };
}

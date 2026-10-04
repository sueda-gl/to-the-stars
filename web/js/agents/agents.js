// The agents bridge: sim agent <-> painted creature.
// Our people are ONLY the two fliers (ART_DIRECTION §7): every sim settler becomes a flit or a floatie, and they
// both walk AND fly (fliers.js): they arrive from the sky in a staggered flock and land, walk to haul / hammer /
// queue with a letter, and fly to travel, celebrate and leave. The other five species are the neighbours' peoples:
// envoys walk in from the plot edge toward their nation (drops from the Drop Riviera, loaves from the Loaf Republic,
// puffers / pips / scoots from the third nation), hand over the letter and walk back.
// Every pose is applied AFTER folk.update() each frame, as an override of what the reference motion just wrote;
// the only behaviour change in folk.js is the `a.driven` seam that lets fliers.js walk / land / launch a flier.
// §25: the townsfolk companies (loaves + twinkles, glims, moths: species-extra.js) are walkers of ours; a sim agent with
// townsfolk: true keeps its own species and is dressed in its species' uniform (identity.js).
// ART_DIRECTION §11 lives in four helpers: identity.js (who is who: gear + clothes by trade), fleets.js (squares, the
// roll-call, the minister's ceremony), work.js (visible work: sites, workplaces, the camp, post rounds) and
// bubbles.js (paper speech bubbles). docs/agents.md has the lot.
//
//   const agents = createAgents(ctx, folk, game, world?, { onDelivered })
//   loop: folk.update(dt, t); agents.update(dt, t); painter.frame(dt, t, ...)
import { createProps } from './props.js';
import { createFlierMotion } from './fliers.js';
import { createIdentity } from './identity.js';
import { createBubbles } from './bubbles.js';
import { createWork } from './work.js';
import { createFleets } from './fleets.js';
import { createPortraits } from './portraits.js';
import { createPins } from './pins.js';
import { applyColourRule } from './colour-rule.js';
import { extendFolk, TOWNSFOLK, EXTRA_SPECIES, CARRY, HAND, HEAD } from './species-extra.js';   // the townsfolk: loaves + twinkles, glims, moths
import { places, isWater, heightAt } from '../globe/geography.js';
export { createAgentNav } from './nav.js';

const FLIERS = new Set(['flit', 'floatie']);
const OURS = ['flit', 'floatie'];                // our people (ART_DIRECTION §7)
const SPECIES = ['puffer', 'loaf', 'drop', 'scoot', 'flit', 'pip', 'floatie', ...EXTRA_SPECIES];
// the neighbours' peoples: who walks in with a nation's letter
const THIRD = ['puffer', 'pip', 'scoot'];
const NATION_FOLK = { drop: ['drop'], loaf: ['loaf'] };
// walking speeds for game-held walkers (the reference strolls at ~1 u/s; the sim walks at 3 u/s)
const SPEED = { puffer: 1.75, drop: 1.4, pip: 1.6, scoot: 1.9, twinkle: 1.5, glim: 1.5, moth: 1.9 };
const COURIER = { scoot: 2.6, flit: 3.4, puffer: 2.2, drop: 1.9, pip: 2.0, floatie: 2.2, twinkle: 2.0, glim: 2.0, moth: 2.6 };
// how far each kind of trip may be walked before our folk fly it instead
const WALK_MAX = { haul: 18, work: 18, walk: 9, gather: 9, strike: 9, idle: 9, deliver: 9 };
const BODY_HALF = { puffer: 0.33, pip: 0.23 };   // centred bodies: squash about the feet, not the middle
const SPAWN_GAP = 0.25;                          // 12 settlers land over ~3 s
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = u => u * u * (3 - 2 * u);

export function createAgents(ctx, folk, game, world = null, opts = {}) {
  const { V, camera, renderer, scene } = ctx;
  extendFolk(ctx, folk);   // folk.make.twinkle / glim / moth + their update (species-extra.js)
  const props = createProps(ctx, folk);
  const nav = folk.nav;
  const S = game.state;
  const recs = new Map();            // sim agent id -> rec
  const temps = new Set();           // envoys and stand-in gift carriers (no sim agent)
  const byRoot = new Map();          // folk root -> rec
  const freeP = new Set();           // position vectors nav.bounds must not clamp (walking off the plot)
  const freeF = new Set();           // fliers nav.flyPush must not steer back in
  const spawnQ = [];
  const away = new THREE.Group(); away.visible = false; away.name = 'agents-away'; scene.add(away);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmp = V(0, 0, 0), q = new THREE.Quaternion();
  const unsub = [];
  const colourIx = {}; SPECIES.forEach(s => colourIx[s] = 0);
  let T = 0, overlayFrame = 0, spawnClock = SPAWN_GAP, obstacleClock = 0, envoyCount = 0, giftCount = 0, listenOn = false, flockN = 0;
  const groundedNow = [];            // folk records of our fliers standing on the ground (fliers.js crowding)
  const api = {};
  // the ground under a folk: folk.js walks everyone on y = 0, so the bridge lifts root, legs and shadow onto the
  // world's relief every frame. Hook order: opts.groundY(x, z) > world.groundY(x, z) > geography heightAt (dry: >= 0).
  const groundY = opts.groundY || (world && world.groundY && world.groundY.bind(world)) || ((x, z) => Math.max(0, heightAt(x, z)));
  const waterAt = (world && world.isWater) ? ((x, z) => world.isWater(x, z)) : ((x, z) => isWater(x, z));
  // our fliers' other half: walking, landing, taking off, gliding down from the sky
  const fm = createFlierMotion(ctx, folk, { props, groundY, isWater: waterAt, grounded: () => groundedNow });
  // who is who (accessories by folk and by trade), speech bubbles, visible work, fleets and the minister's ceremony
  const idn = createIdentity(ctx, folk, props);
  // DOM overlays (bubbles, letter tags, the card's anchor, picking) go through the screen's real lens: on Sueda's Tower
  // Planet (world.planet + world.adapter) her post bends the frame with a fisheye (uFish .38), so a plain
  // camera.project is off by up to ~60 px at the edges. adapter.toScreen(x, y, z) maps a flat-space point onto the
  // sphere and through her lens (planet.toScreen); flat worlds (the agents lab) keep the plain projection.
  const lensWorld = world && world.adapter && typeof world.adapter.toScreen === 'function' && world.planet ? world : null;
  const projectFlat = lensWorld ? (v => { const s = lensWorld.adapter.toScreen(v.x, v.y, v.z); return s ? { x: s.x, y: s.y, behind: !!s.behind } : null; }) : null;
  const lensUniforms = () => { try { const u = lensWorld.planet.post.post.uniforms; return u && u.uOut && u.uFish ? u : null; } catch (_) { return null; } };
  // client px -> NDC for a ray from the (flat) camera: through her lens when there is one (her post's fish())
  function ndcAt(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    let x = (clientX - r.left) / r.width, y = 1 - (clientY - r.top) / r.height;
    const u = lensWorld && lensUniforms();
    if (u) { const o = u.uOut.value, a = o.x / o.y, F = u.uFish.value; let px = (x - 0.5) * a, py = y - 0.5; const k = 1 / (1 + F * (px * px + py * py)); x = px * k / a + 0.5; y = py * k + 0.5; }
    return { x: x * 2 - 1, y: y * 2 - 1 };
  }
  // world point (flat space) -> client px
  function toClient(v) {
    if (projectFlat) { const s = projectFlat(v); return s && !s.behind ? s : null; }
    v.project(camera); if (v.z > 1) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  const bubbles = createBubbles(ctx, { parent: opts.overlay || (typeof document !== 'undefined' ? document.body : null), project: projectFlat });
  // ART_DIRECTION §14: painted portraits, and letters living in the world as envelopes over their senders
  const portraits = createPortraits(ctx, folk, { get: id => api.get(id) });
  const pins = createPins(ctx, { parent: opts.overlay || (typeof document !== 'undefined' ? document.body : null),
    anchor: (t, v) => pinAnchor(t, v), portrait: (id, o) => portraits.get(id, o), rev: id => portraits.rev(id), project: projectFlat,
    isMinister: id => id != null && (id === ministerId || S.minister === id),
    radiusOf: id => { const r = api.get(id); return r && r.a ? (r.species === 'floatie' ? 0.52 : r.species === 'flit' ? 0.27 : 0.32) * (r.sc || 1) : 0; },
    // every live folk's head and feet, so a letter tag never lands on one
    bodies: () => bodies() });
  // every live folk's body as world boxes { id, top, bottom, r } (a floatie: the wide canopy and the narrow body under
  // it): the letter tags keep off them, and the click / hover pick (below) is done on them, through her lens
  function bodies() {
    const out = [];
    for (const r of [...recs.values(), ...temps]) {
      if (r.state !== 'live' || !r.a) continue; const h = headOf(r, V(0, 0, 0)); if (!h) continue;
      const p = r.a.pos, sc = r.sc || 1, foot = { x: p.x, y: (groundY(p.x, p.z) || 0) + (fm.down(r) || !isFlier(r) ? 0 : p.y - 0.6 * sc), z: p.z };
      if (r.species === 'floatie') {   // the canopy, then the body hanging under it
        const c = V(0, 0, 0); r.a.root.getWorldPosition(c);
        out.push({ id: r.id, top: h, bottom: { x: c.x, y: c.y - 0.12 * sc, z: c.z }, r: 0.52 * sc });
        r.a.body.getWorldPosition(c); out.push({ id: r.id, top: { x: c.x, y: c.y + 0.25 * sc, z: c.z }, bottom: foot, r: 0.26 * sc });
      } else out.push({ id: r.id, top: h, bottom: foot, r: 0.3 * sc });
    }
    return out;
  }
  // with her planet the overlays are placed in her afterFinish hook (after the folk pass put the folk back in flat space)
  const herPlanet = lensWorld && typeof lensWorld.planet.renderHook === 'function' ? lensWorld.planet : null;
  let overlayDue = 0;
  if (herPlanet) unsub.push(herPlanet.renderHook({ afterFinish: () => { if (!overlayDue) return; const d = overlayDue; overlayDue = 0; try { placeOverlay(d); } catch (e) { console.error('[agents] overlay', e); } } }));
  const B = {
    S, recs, temps, props, fm, V, camera, scene, groundY, isFlier: r => FLIERS.has(r.species),
    walkTo: (...a) => walkTo(...a), stand: r => stand(r), arrived: (r, k) => arrived(r, k), hop: (r, h) => hop(r, h),
    flush: r => flush(r), frontPoint: (x, y) => frontPoint(x, y), dry: (x, z) => fm.dry(x, z), down: r => fm.down(r),
    now: () => T, kitOf: t => idn.kitOf(t), setMinister: id => setMinister(id), endRole: (r, s) => work.endRole(r, s)
  };
  const work = createWork(B);
  const fleets = createFleets(B);

  // ---- the nav seam: leaving folk walk off the plot, envoys fly in from outside it ----
  const ob = nav.bounds, ofp = nav.flyPush;
  nav.bounds = p => { if (!freeP.has(p)) ob.call(nav, p); };
  nav.flyPush = (f, want, sp) => { if (!freeF.has(f)) ofp.call(nav, f, want, sp); };

  // =============== creatures ===============
  function makeFolk(species) {
    const a = folk.make[species](colourIx[species]++);
    a.controlled = true;
    // §13: no green and yellow on one creature (our fliers get it in idn.dress; this is the neighbours' pips / puffers)
    if (!FLIERS.has(species)) applyColourRule({ a, id: species + ':' + colourIx[species] }, folk);
    if (FLIERS.has(species)) { a.route = []; }
    else { a.path = []; a.wait = 1e6; if (SPEED[species]) a.speed = SPEED[species]; }
    // legs and the ground shadow sit at the origin until the creature's first update: keep them out of sight
    (a.legs || []).forEach(l => { l.leg.position.set(0, -100, 0); l.foot.position.set(0, -100, 0); });
    if (a.blob) a.blob.position.set(0, -100, 0);
    return a;
  }
  function newRec(id, species, sim, temp = false) {
    return { id, species, sim, temp, a: null, state: 'queued', task: null, pending: null, lock: null,
      pose: null, carry: null, goal: null, face: null, hd: 0, faceOn: false, x: {}, sc: 1,
      angry: 0, stompT: Math.random() * 1.2, bumpT: 1, bumpH: 0, shake: 0, impacts: 0, lastP: 0, seed: Math.random(),
      land: 0, flow: null, anim: null, letterIds: [], listening: false, saved: null, top: null };
  }
  function attach(rec, a) {
    rec.a = a; rec.sc = a.sc || a.root.scale.x; rec.hd = a.heading;
    byRoot.set(a.root, rec);
    if (a.species === undefined) a.species = rec.species;
  }
  function place(rec, x, z, y = null) {
    const a = rec.a;
    if (FLIERS.has(rec.species)) { if (y != null && y > 0.5) fm.placeAir(rec, x, y, z); else fm.placeGround(rec, x, z); a.placed = false; a.legsPlaced = false; return; }
    a.pos.set(x, y ?? 0, z);
    a.root.position.copy(a.pos);
    if (a.from) { a.from.copy(a.pos); a.to.copy(a.pos); }
    a.placed = false; a.legsPlaced = false;
  }
  const isFlier = rec => FLIERS.has(rec.species);
  // let a walker past the plot's bounds (a loaf's hop target is clamped too)
  const unbound = a => { freeP.add(a.pos); if (a.to) freeP.add(a.to); };
  const rebound = a => { freeP.delete(a.pos); if (a.to) freeP.delete(a.to); };
  const flat = (p, x, z) => Math.hypot(p.x - x, p.z - z);

  // ---- movement ----
  function walkTo(rec, x, z, { speed = null, y = null, via = null, fly = null, land = true, walkMax = null } = {}) {
    const a = rec.a; if (!a) return;
    if (isFlier(rec)) {
      // our folk decide for themselves: a short hop is walked, a long trip (or one across water) is flown
      fm.go(rec, x, z, { y, via, speed, fly: fly ?? 'auto', land, walkMax: walkMax ?? fm.WALK_MAX });
    } else {
      a.path = (via || []).map(p => V(p.x, 0, p.z)).concat([V(x, 0, z)]); a.wait = 0;
      if (speed && rec.species !== 'loaf') a.speed = speed; else if (SPEED[rec.species]) a.speed = SPEED[rec.species];
      rec.goal = V(x, 0, z);
    }
  }
  function stand(rec) {
    const a = rec.a; if (!a) return;
    if (isFlier(rec)) { fm.stand(rec); return; }
    a.path = []; a.wait = 1e6;
    rec.goal = null;
  }
  function arrived(rec, r = 0.75) {
    const a = rec.a; if (!a) return true;
    if (isFlier(rec)) return fm.arrived(rec, r);
    if (!rec.goal) return true;
    return !a.path.length || flat(a.pos, rec.goal.x, rec.goal.z) < r * 0.6;
  }
  // a ground point in the lower middle of the view (where couriers and envoys come to show their letter)
  function frontPoint(ndcX = 0, ndcY = -0.08) {
    const p = S.plot;
    ray.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = ray.ray.intersectPlane(plane, tmp) ? tmp.clone() : V(camera.position.x, 0, camera.position.z - 8);
    // never right under the lens: at least 5 units out along the view
    const fwd = V(0, 0, 0); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const cam = V(camera.position.x, 0, camera.position.z);
    if (hit.clone().sub(cam).dot(fwd) < 5) hit.copy(cam).addScaledVector(fwd, 5);
    hit.x = clamp(hit.x, p.x0 + 1.5, p.x1 - 1.5); hit.z = clamp(hit.z, p.z0 + 1.5, p.z1 - 1.5);
    return hit;
  }
  api.frontPoint = frontPoint;
  // a clear patch of paper near p: not on top of a folk, nor where another courier / envoy is headed
  function freeSpot(p, self = null, clear = 1.7) {
    const P = S.plot, taken = [];
    [...recs.values(), ...temps].forEach(r => { if (r !== self && r.a && r.state === 'live' && (!isFlier(r) || fm.down(r))) taken.push(r.a.pos); });
    [...recs.values(), ...temps].forEach(r => { if (r !== self && r.flow && r.flow.target) taken.push(r.flow.target); });
    for (const rad of [0, 1.8, 3.2, 4.6]) for (let k = 0; k < (rad ? 10 : 1); k++) {
      const a = k / 10 * Math.PI * 2 + rad, q = V(clamp(p.x + Math.cos(a) * rad, P.x0 + 1.5, P.x1 - 1.5), 0, clamp(p.z + Math.sin(a) * rad, P.z0 + 1.5, P.z1 - 1.5));
      if (taken.every(t => Math.hypot(t.x - q.x, t.z - q.z) >= clear)) return q;
    }
    return p;
  }
  // where a line from the plot centre toward (tx, tz) leaves the plot, plus the unit direction
  function edgeExit(tx, tz) {
    const c = S.centre || { x: 0, z: 2 }, p = S.plot;
    let dx = tx - c.x, dz = tz - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const tX = dx > 1e-6 ? (p.x1 - c.x) / dx : dx < -1e-6 ? (p.x0 - c.x) / dx : Infinity;
    const tZ = dz > 1e-6 ? (p.z1 - c.z) / dz : dz < -1e-6 ? (p.z0 - c.z) / dz : Infinity;
    const t = Math.min(tX, tZ);
    return { x: c.x + dx * t, z: c.z + dz * t, dx, dz };
  }
  function nation(id) {
    const n = places.nations.find(x => x.id === id) || (S.neighbours || []).find(x => x.id === id);
    return n ? { id: n.id, x: n.x, z: n.z, species: n.species || n.leaderSpecies, name: n.name } : { id, x: 0, z: -130, species: 'flit', name: id };
  }
  api.edgeExit = edgeExit;

  // =============== spawning ===============
  // every settler is one of ours: a sim flit / floatie keeps its kind, anyone else becomes whichever of the two
  // we have fewer of (so 12 settlers land as 6 flits + 6 floaties). The sim keeps its own species for skills.
  function ourSpecies(agent) {
    if (OURS.includes(agent.species)) return agent.species;
    if (agent.townsfolk && TOWNSFOLK.includes(agent.species)) return agent.species;   // the townsfolk keep their own kind
    const n = { flit: 0, floatie: 0 }; recs.forEach(r => { if (r.state !== 'gone' && n[r.species] !== undefined) n[r.species]++; });
    return n.floatie < n.flit ? 'floatie' : 'flit';
  }
  function onSpawn({ agent }) {
    if (!agent || recs.has(agent.id)) return;
    const rec = newRec(agent.id, ourSpecies(agent), agent);
    recs.set(agent.id, rec); spawnQ.push(rec);
    fleets.adopt(rec);   // formed into fleets before landing: this one glides straight into its square
  }
  function release(rec) {
    const ag = rec.sim, a = makeFolk(rec.species);
    attach(rec, a); rec.state = 'live'; rec.lock = 'spawn';
    idn.dress(rec); if (S.minister === rec.id) idn.setMinister(rec, true);
    // formed into fleets before landing: glide straight into the square
    const x = rec.fleet ? rec.fleet.x : ag ? ag.x : 0, z = rec.fleet ? rec.fleet.z : ag ? ag.z : 9;
    if (isFlier(rec)) {
      // arrive from the sky (Act 1): a loose flock glides in from high beyond the view, each one down to its spot
      const fwd = V(0, 0, 0); camera.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      const side = V(-fwd.z, 0, fwd.x), k = flockN++;
      const from = V(x, 0, z).addScaledVector(fwd, 12 + (k % 3) * 1.5 + Math.random() * 2).addScaledVector(side, -4 + (k % 5) * 1.6 + Math.random() * 1.2);
      from.y = 9 + (k % 4) * 0.6 + Math.random();
      fm.glide(rec, from, { x, z });
      rec.anim = { kind: 'flyin', t: 0 };
    } else {
      place(rec, x, z);
      rec.anim = { kind: 'drop', t: 0, T: 0.5, h0: 3.2, landed: false };
      stand(rec);
    }
  }
  function endSpawn(rec) {
    rec.anim = null; rec.lock = null;
    if (isFlier(rec) && !fm.down(rec)) stand(rec);
    flush(rec);
  }

  // =============== tasks ===============
  function flush(rec) { if (rec.pending && !rec.lock && !rec.listening) { const t = rec.pending; rec.pending = null; applyTask(rec, t); } }
  function onTask({ agentId, task }) {
    const rec = recs.get(agentId); if (!rec || !task) return;
    // a gift run (deliver + carrying 'gift', then 'journey' while away) is drawn by gift:send, which follows at once
    if (task.kind === 'deliver' && task.carrying === 'gift') return;
    if (task.kind === 'journey') {
      if (rec.state === 'away' || rec.lock === 'gift') return;
      if (rec.state === 'live' && rec.a) giftOut(task.neighbourId || rec.neighbourId || 'n1', { carrierId: rec.id, gift: task.gift || '' });
      return;
    }
    if (task.kind === 'deliver') { rec.letterIds = [...new Set([...rec.letterIds, ...(task.letterIds || [])])]; }
    if (rec.state === 'away') { rec.pending = task; comeBack(rec); return; }
    if (rec.state !== 'live' || rec.lock || rec.listening) {
      // a courier run or a departure is never queued behind something trivial
      if (rec.lock === 'deliver' && task.kind === 'deliver') return;
      rec.pending = task; return;
    }
    applyTask(rec, task);
  }
  function applyTask(rec, task) {
    const a = rec.a; if (!a) return;
    // a build / production task becomes a visible work loop (work.js); the sim's idle strolls don't break one
    if (work.intercept(rec, task)) { rec.task = task; rec.building = null; return; }
    rec.task = task; rec.pose = null; rec.face = null; rec.building = null; rec.tool = null;
    const to = task.to;
    // the camp's finds: a basket of food from the shore, driftwood or stones from the edges
    const campLoad = task.camp && task.carrying ? (task.carrying === 'bread' ? 'basket' : (rec.seed > 0.5 ? 'log' : 'stone')) : null;
    setCarry(rec, campLoad || (task.carrying === 'letter' ? null : task.carrying));
    switch (task.kind) {
      case 'walk': case 'haul': case 'gather':
        if (to) walkTo(rec, to.x, to.z, { walkMax: WALK_MAX[task.kind] }); else stand(rec);
        if (task.kind === 'gather') rec.pose = 'meeting';
        break;
      case 'work': {
        const b = (S.buildings || []).find(x => x.id === task.buildingId);
        rec.building = b || null; rec.pose = 'work';
        if (b) rec.face = { x: b.x, z: b.z };
        if (!rec.goal || arrived(rec)) stand(rec);        // else: finish walking to the site spot, then hammer
        break;
      }
      case 'deliver': startCourier(rec); break;
      case 'meeting': stand(rec); rec.pose = 'meeting'; break;
      case 'strike':
        if (to) walkTo(rec, to.x, to.z, { walkMax: WALK_MAX.strike }); else stand(rec);
        rec.pose = 'strike'; break;
      case 'leave': startLeave(rec, to); break;
      case 'idle': default:
        if (rec.goal && !arrived(rec) && !task.resting) { /* let the stroll finish */ } else stand(rec);
        rec.pose = task.resting ? 'rest' : null;
        if (task.resting && to) walkTo(rec, to.x, to.z, { walkMax: WALK_MAX.idle });
    }
  }

  // =============== carrying ===============
  // the sim carries 'crate' | 'bread' | 'letter' | 'gift'; we draw crates, baskets, trays of loaves, planks, stones, logs, sacks
  const CARRY_AS = { bread: 'loaves', food: 'basket', fruit: 'basket', gift: 'crate', goods: 'crate', wood: 'log', stone: 'stone' };
  function setCarry(rec, what) { rec.carry = what ? (CARRY_AS[what] || what) : null; }

  // =============== courier: walk toward the camera, hold the letter up, hand it to the tray ===============
  function startCourier(rec) {
    rec.lock = 'deliver'; rec.pose = null; rec.carry = 'letter';
    const aim = frontPoint((recsLockedCount('deliver') - 1) * 0.12), p = freeSpot(aim, rec);
    walkTo(rec, p.x, p.z, { speed: COURIER[rec.species] || 2.2, walkMax: WALK_MAX.deliver });
    rec.flow = { kind: 'deliver', phase: 'go', t: 0, refresh: 0, target: p, aim };
  }
  function recsLockedCount(kind) { let n = 0; recs.forEach(r => { if (r.lock === kind) n++; }); return n; }
  function screenOf(obj) {
    obj.getWorldPosition(tmp);
    return toClient(tmp) || { x: NaN, y: NaN };
  }
  function deliver(rec, payload) {
    const env = rec.x.letter;
    const msg = { ...payload, screen: env ? screenOf(env) : null };
    try { if (api.onDelivered) api.onDelivered(msg); } catch (e) { console.error('[agents] onDelivered', e); }
    if (opts.emit !== false && game.emit) game.emit('agents:delivered', msg);
  }
  // one step of a present-the-letter sequence shared by couriers and envoys: go -> land -> present -> stow
  function stepPresent(rec, f, dt, onDone) {
    f.t += dt;
    const a = rec.a;
    if (f.phase === 'go') {
      f.refresh += dt;
      if (f.refresh > 1 && f.kind === 'deliver') {     // the camera may have moved: re-aim at the lower middle of the view
        f.refresh = 0; const raw = frontPoint();
        if (!f.aim || raw.distanceTo(f.aim) > 3) { f.aim = raw; const p = freeSpot(raw, rec); f.target = p; walkTo(rec, p.x, p.z, { speed: COURIER[rec.species] || 2.2, walkMax: WALK_MAX.deliver }); }
      }
      // fliers are done when they have landed (or walked up); walkers when they are there
      if (arrived(rec, 0.9) || f.t > 40) { stand(rec); f.phase = rec.group && rec.group.members.length > 1 ? 'wait' : 'present'; f.t = 0; }
    } else if (f.phase === 'wait') {
      // an election: everyone lands first, then the three letters go up together
      rec.face = 'camera';
      const all = rec.group.members.every(m => !m.flow || m.flow.kind !== 'envoy' || ['wait', 'present', 'stow', 'done', 'out'].includes(m.flow.phase));
      if (all || f.t > 8) { f.phase = 'present'; f.t = 0; }
    } else if (f.phase === 'present') {
      rec.pose = 'present'; rec.face = 'camera';
      if (f.t > 0.15 && !f.hopped) { f.hopped = true; hop(rec, 0.16); }
      if (!f.announced) {   // the folk nearby turn to look at the letter-bearer
        f.announced = true;
        recs.forEach(r => { if (r !== rec && r.a && r.state === 'live' && !r.lock && flat(r.a.pos, a.pos.x, a.pos.z) < 7) { r.lookAt = { x: a.pos.x, z: a.pos.z }; r.lookUntil = T + 2.6; } });
      }
      if (f.t >= 1.8) { onDone(); f.phase = 'stow'; f.t = 0; }
    } else if (f.phase === 'stow') {
      rec.pose = 'present'; f.stow = Math.min(1, f.t / 0.3);
      if (f.t >= 0.3) { rec.carry = null; rec.pose = null; f.stow = 0; if (!f.happy) { f.happy = true; hop(rec, 0.2); } f.phase = 'done'; }
    }
  }
  function stepCourier(rec, dt) {
    const f = rec.flow;
    stepPresent(rec, f, dt, () => deliver(rec, { kind: 'courier', agentId: rec.id, letterIds: rec.letterIds.slice() }));
    if (f.phase === 'done') { rec.flow = null; rec.lock = null; rec.letterIds = []; rec.face = null; stand(rec); flush(rec); }
  }

  // =============== envoys: one of the nation's own people walks a letter in from the plot edge ===============
  // drops for the Drop Riviera (n1), loaves for the Loaf Republic (n2), puffers / pips / scoots for the third nation
  function envoySpecies(n) {
    const list = NATION_FOLK[n.species] || (n.id === 'n1' ? ['drop'] : n.id === 'n2' ? ['loaf'] : THIRD);
    return list[envoyCount % list.length];
  }
  function envoyIn(neighbourId, { letterId = null, species = null, primary = true, dir = null, slot = null } = {}) {
    const n = nation(neighbourId);
    const sp = species && !FLIERS.has(species) ? species : envoySpecies(n);
    const rec = newRec('envoy:' + (++envoyCount), sp, null, true);
    const a = makeFolk(sp); attach(rec, a); temps.add(rec);
    rec.state = 'live'; rec.lock = 'envoy'; rec.carry = 'letter'; rec.neighbourId = n.id; rec.letterIds = letterId ? [letterId] : [];
    rec.primary = primary;
    const land = freeSpot(frontPoint(slot != null ? slot * 0.2 : ((envoyCount % 3) - 1) * 0.16, 0.02), rec, 2);
    // in from beyond the edge facing the nation (from just inside it when that side is sea: no boats needed)
    const ex = edgeExit(n.x, n.z);
    let sx = ex.x + ex.dx * 4, sz = ex.z + ex.dz * 4, popped = false;
    if (waterAt(sx, sz) || waterAt(ex.x + ex.dx * 1.5, ex.z + ex.dz * 1.5)) { sx = ex.x - ex.dx * 1.5; sz = ex.z - ex.dz * 1.5; popped = true; }
    const d = Math.hypot(sx - land.x, sz - land.z), MAXD = sp === 'loaf' ? 10 : 22;   // loaves hop at their own ~1 u/s
    if (d > MAXD) { sx = land.x + (sx - land.x) / d * MAXD; sz = land.z + (sz - land.z) / d * MAXD; popped = true; }
    rec.home = V(sx, 0, sz);
    place(rec, sx, sz); unbound(a);
    a.heading = Math.atan2(land.x - sx, land.z - sz); a.root.rotation.y = a.heading;
    if (popped) { rec.anim = { kind: 'pop', t: 0 }; props.puff(sx, sz, { n: 8, y: 0.05 + (groundY(sx, sz) || 0) }); }
    const speed = clamp(Math.min(d, MAXD) / 8.5, COURIER[sp] || 2, 2.6);
    walkTo(rec, land.x, land.z, { speed });
    rec.flow = { kind: 'envoy', phase: 'go', t: 0, refresh: 0, target: land };
    return rec;
  }
  function stepEnvoy(rec, dt) {
    const f = rec.flow;
    stepPresent(rec, f, dt, () => {
      if (rec.group && rec.group.landed) return;          // an election: the first envoy to arrive hands it over
      if (rec.group) rec.group.landed = true;
      const id = rec.letterIds[0] || null;
      // the sim waits for the visual hand-over (envoy:send listeners exist): the letter enters the tray now
      const landed = id && typeof game.deliverLetter === 'function' ? game.deliverLetter(id) : false;
      deliver(rec, { kind: 'envoy', agentId: null, neighbourId: rec.neighbourId, letterId: id, letterIds: rec.letterIds.slice(), landed });
    });
    // done: walk back the way they came, and a poof at the edge
    if (f.phase === 'done') {
      rec.face = null; rec.pose = null;
      walkTo(rec, rec.home.x, rec.home.z, { speed: (COURIER[rec.species] || 2) * 1.05 });
      rec.flow = { kind: 'leave', phase: 'go', t: 0 };
    }
  }
  // envoy:send {neighbourId, letterId, votes?, all?}: the election letter comes with one envoy per voting nation;
  // the first to land hands the letter over (game.deliverLetter), the others present theirs alongside
  function onEnvoy({ neighbourId, letterId, votes, all }) {
    const from = all && Array.isArray(votes) && votes.length ? votes : [neighbourId];
    const group = { landed: false, members: [] };
    from.forEach((id, i) => { const e = envoyIn(id, { letterId, slot: from.length > 1 ? i - (from.length - 1) / 2 : null }); e.group = group; e.primary = from.length === 1 || i === 0; group.members.push(e); });
  }

  // =============== gifts: one of ours flies the gift out past the plot edge toward the nation ===============
  function giftOut(neighbourId, { carrierId = null, gift = '' } = {}) {
    const n = nation(neighbourId), ex = edgeExit(n.x, n.z);
    const overWater = (() => { try { return isWater(ex.x + ex.dx * 5, ex.z + ex.dz * 5); } catch (e) { return false; } })();
    const what = /bread|food|fruit|apple|lemon|fish|cake|wine|basket|oil|cheese|loaf|loaves/i.test(gift || '') ? 'basket' : 'crate';
    let rec = carrierId ? recs.get(carrierId) : null;
    if (rec && (rec.state !== 'live' || !rec.a || (rec.lock && rec.lock !== 'spawn'))) rec = null;
    if (rec && rec.lock === 'spawn') { rec.anim = null; rec.lock = null; }
    if (!rec) {
      // nobody free: a stand-in of ours pops up at the stockpile with the goods (a flit when it is across water)
      const sp = overWater ? 'flit' : (giftCount % 2 ? 'floatie' : 'flit');
      rec = newRec('gift:' + (++giftCount), sp, null, true);
      const a = makeFolk(sp); attach(rec, a); temps.add(rec); rec.state = 'live'; idn.dress(rec);
      const s = S.stockpile || { x: -9, z: 13 };
      place(rec, s.x + 1, s.z); rec.anim = { kind: 'pop', t: 0 }; props.puff(s.x + 1, s.z, { n: 8, y: 0.05 + (groundY(s.x + 1, s.z) || 0) });
    } else giftCount++;
    rec.lock = 'gift'; rec.pose = null; rec.carry = what; rec.neighbourId = n.id;
    const out = overWater && !isFlier(rec) ? 1.5 : 8;   // a walker stops at the shore (and takes the boat)
    if (isFlier(rec)) { freeF.add(rec.a); walkTo(rec, ex.x + ex.dx * out * 2, ex.z + ex.dz * out * 2, { speed: 3, y: 4.5, via: [{ x: ex.x, z: ex.z, y: 3.5 }], fly: true, land: false }); }
    else { unbound(rec.a); walkTo(rec, ex.x + ex.dx * out, ex.z + ex.dz * out, { speed: (COURIER[rec.species] || 2) * 1.1, via: [{ x: ex.x, z: ex.z }] }); }
    rec.flow = { kind: 'gift', phase: 'go', t: 0 };
    return rec;
  }
  function onGift({ neighbourId, gift, carrierId }) { giftOut(neighbourId, { carrierId, gift }); }

  // =============== leaving ===============
  function startLeave(rec, to) {
    const n = to || { x: 0, z: -130 }, ex = edgeExit(n.x, n.z);
    rec.lock = 'leave'; rec.pose = 'sulk'; rec.carry = null;
    if (isFlier(rec)) { freeF.add(rec.a); walkTo(rec, ex.x + ex.dx * 12, ex.z + ex.dz * 12, { speed: 2.4, y: 5, fly: true, land: false }); }
    else { unbound(rec.a); walkTo(rec, ex.x + ex.dx * 6, ex.z + ex.dz * 6, { speed: (SPEED[rec.species] || 1.4) * 0.8, via: [{ x: ex.x, z: ex.z }] }); }
    rec.flow = { kind: 'leave', phase: 'go', t: 0 };
  }
  // shared by gifts and leavers: walk out, then a poof (squash, shrink, a burst of paper dust)
  function stepOut(rec, dt) {
    const f = rec.flow; f.t += dt;
    if (f.phase === 'go') { if (arrived(rec, 1) || f.t > 60) { f.phase = 'poof'; f.t = 0; stand(rec); } }
    else if (f.phase === 'poof') {
      if (!f.puffed && f.t > 0.18) { f.puffed = true; const p = rec.a.pos, gy = groundY(p.x, p.z) || 0; props.puff(p.x, p.z, { n: 12, r: 0.25, size: 0.17, speed: 2, y: gy + (isFlier(rec) && !fm.down(rec) ? p.y - 0.6 : 0.05) }); }
      if (f.t >= 0.45) {
        rec.flow = null;
        if (rec.temp || f.kind === 'leave') despawn(rec); else goAway(rec);
      }
    }
  }
  function goAway(rec) {
    const a = rec.a; rec.state = 'away'; rec.lock = null; rec.carry = null; rec.pose = null; rec.anim = null;
    rebound(a); freeF.delete(a);
    if (rec.pending) rec.returnAt = T + 2.5;   // the sim already has the next job for them: back in a moment
    [a.root, a.blob, ...(a.legs || []).flatMap(l => [l.leg, l.foot])].forEach(o => o && away.add(o));
    stand(rec);
  }
  function comeBack(rec) {
    const a = rec.a; if (!a) return;
    [a.root, a.blob, ...(a.legs || []).flatMap(l => [l.leg, l.foot])].forEach(o => o && scene.add(o));
    const n = nation(rec.neighbourId), ex = edgeExit(n.x, n.z);
    const x = ex.x - ex.dx * 2, z = ex.z - ex.dz * 2;
    place(rec, x, z, isFlier(rec) ? 3 : null); rec.a.root.scale.setScalar(rec.sc);
    rec.state = 'live'; rec.lock = 'spawn'; rec.anim = { kind: 'pop', t: 0 };
    props.puff(x, z, { n: 8, y: (groundY(x, z) || 0) + (isFlier(rec) ? 2.4 : 0.05) });
  }

  // =============== despawn (temps and leavers): out of the folk lists, unique GPU data freed ===============
  function despawn(rec) {
    const a = rec.a; if (!a) return;
    const own = new Set(), keepG = new Set(Object.values(props.G)), keepM = new Set(Object.values(props.M).flat());
    idn.keep(keepG, keepM); work.endRole(rec, false); bubbles.hide(rec.id);
    if (rec.halo) { scene.remove(rec.halo); rec.halo = null; }
    const collect = (o, set) => o && o.traverse(m => { if (m.isMesh) set.add(m); });
    collect(a.root, own); (a.legs || []).forEach(l => { own.add(l.leg); own.add(l.foot); }); if (a.blob) own.add(a.blob);
    folk.remove(a);
    // whatever is still used by another creature stays (species geometry, cached cloth, the leg rig)
    const others = new Set();
    [folk.creatures, folk.hoppers, folk.drops, folk.scoots, folk.flits, folk.pips, folk.floaties, ...(folk.extra ? Object.values(folk.extra.lists) : [])].forEach(list => list.forEach(o => {
      collect(o.root, others); (o.legs || []).forEach(l => { others.add(l.leg); others.add(l.foot); }); if (o.blob) others.add(o.blob);
    }));
    others.forEach(m => { keepG.add(m.geometry); [].concat(m.material).forEach(mt => keepM.add(mt)); });
    own.forEach(m => {
      if (m.geometry && !keepG.has(m.geometry)) { m.geometry.dispose(); keepG.add(m.geometry); }
      [].concat(m.material).forEach(mt => { if (mt && !keepM.has(mt)) { mt.dispose(); keepM.add(mt); } });
    });
    byRoot.delete(a.root); rebound(a); freeF.delete(a);
    rec.state = 'gone'; rec.a = null; rec.flow = null; rec.lock = null;
    temps.delete(rec);
    if (!rec.temp) recs.delete(rec.id);
  }

  // =============== listening: the folk stop and turn toward you ===============
  function crowdListen(on, { radius = 22, center = null } = {}) {
    listenOn = !!on;
    const c = center || frontPoint(0, 0);
    recs.forEach(rec => {
      if (rec.state !== 'live' || !rec.a) return;
      if (on) {
        if (rec.lock || rec.pose === 'strike' || rec.listening) return;
        const d = flat(rec.a.pos, c.x, c.z); if (radius && d > radius) return;
        rec.listening = true; rec.listenAt = T + 0.05 + d * 0.035; rec.listenHop = false;
        if (isFlier(rec)) { fm.hold(rec, true); return; }   // feet stay planted (or a hover), the trip waits
        rec.saved = { goal: rec.goal ? rec.goal.clone() : null, path: rec.a.path ? rec.a.path.slice() : null, route: rec.a.route ? rec.a.route.slice() : null };
        stand(rec); rec.goal = rec.saved.goal; if (!isFlier(rec)) rec.a.path = [];
      } else if (rec.listening) {
        rec.listening = false; rec.face = rec.task && rec.task.kind === 'work' && rec.building ? { x: rec.building.x, z: rec.building.z } : null;
        if (isFlier(rec)) { fm.hold(rec, false); if (rec.pending) flush(rec); return; }
        const s = rec.saved; rec.saved = null;
        if (rec.pending) flush(rec);
        else if (s && s.goal) walkTo(rec, s.goal.x, s.goal.z, isFlier(rec) ? { y: s.goal.y } : {});
        else stand(rec);
        if (!isFlier(rec)) { rec.a.lookSwap = 2 + Math.random() * 6; rec.a.lookViewer = false; }
      }
    });
    return listenOn;
  }
  function onAgentListen({ agentId }) { const r = recs.get(agentId); if (r && r.state === 'live') { r.attendT = 3.5; hop(r, 0.12); } }
  function onCrowdListen({ answering = [] }) { answering.forEach((id, i) => { const r = recs.get(id); if (r && r.state === 'live') { r.attendT = 4; r.hopAt = T + 0.3 + i * 0.35; } }); }
  function onMood({ agentId, delta }) {
    const r = recs.get(agentId); if (!r || r.state !== 'live') return;
    if (delta >= 8 && isFlier(r)) celebrate(r); else if (delta >= 4) hop(r, 0.2); else if (delta <= -4) { r.huffT = 1.6; r.stompT = 0; }
  }

  // =============== celebrating: a little loop-the-loop flight and back down on the same spot ===============
  // building:done (folk nearby), a big mood lift, or now and then when a happy folk has nothing to do
  function celebrate(rec, delay = 0) {
    if (!rec || rec.state !== 'live' || !rec.a || !isFlier(rec) || rec.lock || rec.listening || rec.pose === 'strike' || rec.role || rec.fleet) return false;
    if (delay > 0) { rec.joyAt = T + delay; return true; }
    const a = rec.a, m = rec.mv, x = m.x, z = m.z, r = 1.6 + Math.random() * 0.8, ph = Math.random() * Math.PI * 2, y = fm.CRUISE[rec.species] + 0.3;
    const via = [0, 1, 2, 3].map(i => ({ x: x + Math.cos(ph + i * 1.7) * r, z: z + Math.sin(ph + i * 1.7) * r, y: y + (i % 2) * 0.5 }));
    rec.lock = 'joy'; rec.joyFrom = { goal: rec.goal ? rec.goal.clone() : null, task: rec.task };
    walkTo(rec, x, z, { fly: true, via });
    rec.flow = { kind: 'joy', phase: 'go', t: 0 };
    hop(rec, 0.12);
    return true;
  }
  function stepJoy(rec, dt) {
    const f = rec.flow; f.t += dt;
    if ((f.t > 1 && arrived(rec)) || f.t > 25) {
      rec.flow = null; rec.lock = null; rec.hopAt = T + 0.3; rec.hopH = 0.16;   // after the touchdown squash
      const j = rec.joyFrom; rec.joyFrom = null;
      if (rec.pending) flush(rec);
      else if (j && j.goal && j.goal.y === 0) walkTo(rec, j.goal.x, j.goal.z);
    }
  }
  function onBuildingDone({ building: b }) {
    if (!b) return;
    work.release(b.id);   // the crew and helpers put their tools down (then most of them celebrate)
    let i = 0;
    recs.forEach(r => { if (r.a && r.state === 'live' && flat(r.a.pos, b.x, b.z) < 14 && Math.random() < 0.75) celebrate(r, 0.2 + (i++) * 0.35); });
  }
  function onRefuse({ agentId }) { const r = recs.get(agentId); if (r && r.state === 'live') { r.shake = 1; r.huffT = 1.4; } }

  // a hop: the reference's own for puffers / pips / loaves, a bump for the rest
  function hop(rec, h = 0.18) {
    const a = rec.a; if (!a) return;
    if (rec.species === 'puffer') a.hop = 0.45;
    else if (rec.species === 'pip') a.hop = 0.4;
    else if (rec.species === 'loaf') { if (a.state === 'rest') { a.state = 'crouch'; a.st = 0; a.inPlace = true; } }
    else { rec.bumpT = 0; rec.bumpH = h; }
  }

  // =============== obstacles: buildings push walkers aside (only on our own nav) ===============
  function syncObstacles() {
    if (!nav.__agoraAgents) return;
    // fields, gardens, plazas, roads and walls-in-progress are walked on (and worked inside): not obstacles
    const list = (S.buildings || []).filter(b => b.status !== 'removed' && b.footprint && b.category !== 'nature' && !(b.shape && (b.shape.poly || b.shape.pts)) && !/field|garden|plaza|road|farm/.test(String(b.kind)))
      .map(b => [b.x, b.z, Math.max(b.footprint.w, b.footprint.d) * 0.5 * 0.78]);
    nav.obstacles.length = 0; list.forEach(o => nav.obstacles.push(o)); api.extraObstacles.forEach(o => nav.obstacles.push(o));
  }

  // =============== per-frame ===============
  function update(dt, t) {
    T += dt; overlayFrame++;   // the pick's screen-box cache is per frame
    // staggered spawns
    spawnClock += dt;
    while (spawnQ.length && spawnClock >= SPAWN_GAP) { spawnClock -= SPAWN_GAP; release(spawnQ.shift()); }
    if (!spawnQ.length) spawnClock = Math.min(spawnClock, SPAWN_GAP);
    obstacleClock -= dt; if (obstacleClock <= 0) { obstacleClock = 0.5; syncObstacles(); }
    const all = [...recs.values(), ...temps];
    groundedNow.length = 0;
    for (const r of all) if (r.state === 'live' && r.a && r.mv && r.mv.mode === 'ground') groundedNow.push(r.a);
    for (const rec of all) {
      if (rec.state === 'away' && rec.returnAt && T >= rec.returnAt) { rec.returnAt = 0; comeBack(rec); }
      if (rec.state !== 'live' || !rec.a) continue;
      step(rec, dt, t);
      if (rec.a) pose(rec, dt, t);
      if (rec.a) halo(rec, dt);
    }
    work.update(dt);
    fleets.update(dt);
    props.updateDust(dt);
    portraits.update();
    // the tags and bubbles: with her planet they are placed right AFTER her frame (her camera is placed inside
    // planet.frame, and the flat camera synced there), so they sit on this frame's folk, not last frame's
    if (herPlanet) overlayDue = Math.max(overlayDue, dt || 1e-3); else placeOverlay(dt);
  }
  function placeOverlay(dt) {
    pins.update(dt);
    bubbles.update(dt, pins.rects());
  }
  // the highlight: a cream paper ring with an ink thread on the ground under the folk (live folk pass only)
  function halo(rec, dt) {
    const k = rec.hiK || 0;
    if (k < 0.01) { if (rec.halo) rec.halo.visible = false; return; }
    if (!rec.halo) { rec.halo = props.liveOnly(props.halo()); scene.add(rec.halo); }
    const p = rec.a.pos, gy = groundY(p.x, p.z) || 0, s = rec.sc * (0.92 + 0.08 * ease(k)) * (1 + 0.03 * Math.sin(T * 3.1));
    rec.halo.visible = true; rec.halo.position.set(p.x, gy + 0.04, p.z); rec.halo.scale.set(s, s, s);
  }

  function step(rec, dt, t) {
    const a = rec.a, an = rec.anim;
    if (an) {
      an.t += dt;
      if (an.kind === 'drop' && an.t >= an.T && !an.landed) { an.landed = true; rec.attendT = 2.2 + Math.random(); props.puff(a.pos.x, a.pos.z, { n: 11, r: 0.22 * rec.sc, size: 0.075 * rec.sc, y: 0.05 + (groundY(a.pos.x, a.pos.z) || 0) }); }
      if (an.kind === 'drop' && an.t > an.T + 0.75) endSpawn(rec);
      // the hello-hop waits for the touchdown squash to settle (on top of it, it read as a twitch)
      if (an.kind === 'flyin' && fm.down(rec) && !an.landed) { an.landed = true; an.tl = an.t; rec.attendT = 2.2 + Math.random(); rec.hopAt = T + 0.32; rec.hopH = 0.1; }
      if (an.kind === 'flyin' && ((an.landed && an.t > an.tl + 0.7) || an.t > 16)) endSpawn(rec);
      if (an.kind === 'pop' && an.t > 0.5) {
        rec.anim = null;
        if (rec.lock === 'spawn') { rec.lock = null; if (isFlier(rec) && rec.mv.mode === 'air' && !rec.mv.want && !rec.pending) stand(rec); flush(rec); }
      }
    }
    if (rec.fleet) fleets.step(rec, dt);
    if (rec.role) work.step(rec, dt);
    rec.hiK = (rec.hiK || 0) + ((rec.hi ? 1 : 0) - (rec.hiK || 0)) * Math.min(1, dt * 6);
    rec.waveT = Math.max(0, (rec.waveT || 0) - dt);
    if (isFlier(rec) && rec.mv && rec.hiK > 0.05 && fm.down(rec)) rec.mv.prop = Math.max(rec.mv.prop, 22 * rec.hiK);   // the propeller spins up under the lift
    if (isFlier(rec)) {
      // a happy folk with nothing to do takes a little flight now and then
      if (rec.joyAt && T >= rec.joyAt) { rec.joyAt = 0; celebrate(rec); }
      const idle = !rec.lock && !rec.listening && !rec.flow && !rec.role && !rec.fleet && fm.down(rec) && !rec.mv.path.length && (!rec.task || (rec.task.kind === 'idle' && !rec.task.resting) || work.isStroll(rec.task));
      rec.idleT = idle ? (rec.idleT || 0) + dt : 0;
      if (idle && rec.idleT > 8 && rec.sim && rec.sim.mood >= 62 && Math.random() < dt / 30) { rec.idleT = 0; celebrate(rec); }
    }
    if (rec.flow) {
      const k = rec.flow.kind;
      if (k === 'deliver') stepCourier(rec, dt);
      else if (k === 'envoy') stepEnvoy(rec, dt);
      else if (k === 'gift' || k === 'leave') stepOut(rec, dt);
      else if (k === 'joy') stepJoy(rec, dt);
      if (!rec.a) return;
    }
    if (isFlier(rec)) fm.step(rec, dt, t);
    idn.step(rec, dt, t);
    // stood still with nothing to do: keep the idle life (gaze, blinks, the odd hop) going
    if (!isFlier(rec) && !a.path.length && a.wait <= 0) a.wait = 1e6;
    if (rec.hopAt && T >= rec.hopAt) { rec.hopAt = 0; hop(rec, rec.hopH || 0.18); rec.hopH = 0; }
    if (rec.listening && !rec.listenHop && T >= rec.listenAt) { rec.listenHop = true; hop(rec, 0.12); }
    rec.attendT = Math.max(0, (rec.attendT || 0) - dt);
    rec.huffT = Math.max(0, (rec.huffT || 0) - dt);
    rec.shake = Math.max(0, rec.shake - dt);
    rec.bumpT += dt;
  }

  // =============== poses: overrides on top of what folk.update just wrote ===============
  const hidden = rec => { for (const k in rec.x) rec.x[k].visible = false; };
  function ensure(rec, key, make, parent) {
    let o = rec.x[key];
    if (!o) { o = make(); rec.x[key] = o; }
    if (o.parent !== parent) parent.add(o);
    o.visible = true; return o;
  }
  // body top in body-local units (for loaves: where a crate or a letter sits on the hat)
  function bodyTop(rec) {
    if (rec.top != null) return rec.top;
    const a = rec.a, b = new THREE.Box3(), inv = new THREE.Matrix4();
    a.root.updateMatrixWorld(true); inv.copy(a.body.matrixWorld).invert();
    a.body.traverse(o => { if (!o.isMesh || !o.geometry) return; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv); b.union(bb); });
    return (rec.top = isFinite(b.max.y) ? b.max.y : 0.5);
  }
  const ARMED = new Set(['puffer', 'drop', 'pip', ...EXTRA_SPECIES]);
  // which arm group holds things (index 1 = the right arm, sd = +1)
  const arm = (rec, j) => rec.a.arms ? rec.a.arms[j] : null;
  function addedArms(rec) {   // scoots and flits get two nub arms when they need hands
    const a = rec.a;
    const mat = a.body.children.find(o => o.isMesh).material;
    const mk = (sd) => { const g = props.nubArm(mat); g.position.set(sd * (rec.species === 'flit' ? 0.215 : 0.17), rec.species === 'flit' ? -0.06 : 0.22, rec.species === 'flit' ? 0.06 : 0.22); return g; };
    return [ensure(rec, 'armL', () => mk(-1), a.body), ensure(rec, 'armR', () => mk(1), a.body)];
  }
  function billboard(o) {   // turn a held letter to face the lens
    o.parent.updateMatrixWorld(true);
    o.parent.getWorldQuaternion(q); q.invert().multiply(camera.quaternion); o.quaternion.copy(q);
  }

  function pose(rec, dt, t) {
    const a = rec.a, sp = rec.species, sd = j => (j === 0 ? -1 : 1);
    hidden(rec);
    if (sp === 'floatie' && !a.driven) { a.wave.rotation.x = 0; a.wave.rotation.y = 0; }
    const onGround = !isFlier(rec) || fm.down(rec);
    let dy = 0, sy = 1, sxz = 1, faceT = null;
    const sim = rec.sim;
    // with hysteresis: a folk easing into its spot hovered round the threshold, so 'moving' (and with it the facing,
    // the work pose, the stomp) flickered on and off every few frames
    const spd = isFlier(rec) ? Math.hypot(a.vel.x, a.vel.z) : a.vel.length();
    const moving = rec.moving = rec.moving ? spd > (isFlier(rec) ? 0.12 : 0.1) : spd > (isFlier(rec) ? 0.25 : 0.2);
    // a walker with somewhere to go faces its path: holding a work facing while it set off made it shuffle sideways
    // at 0.15 m/s (too slow to count as moving, so the facing never let go)
    const walking = moving || !!(isFlier(rec) && rec.mv && rec.mv.mode === 'ground' && rec.mv.path.length && !rec.mv.frozen);

    // ---- spawn: drop from the sky with stretch, land with squash ----
    const an = rec.anim;
    if (an && an.kind === 'drop') {
      if (an.t < an.T) { const u = an.t / an.T; dy += an.h0 * (1 - u * u); sy *= 1 + 0.32 * u; }
      else { const k = an.t - an.T; sy *= 1 - 0.42 * Math.exp(-k * 6) * Math.cos(k * 15); }
    }
    let shrink = 1;
    if (an && an.kind === 'pop') { const u = Math.min(1, an.t / 0.45); shrink = Math.max(0.01, 1 + 0.25 * Math.sin(u * Math.PI) - (1 - ease(u))); sy *= 1 + 0.15 * Math.sin(u * Math.PI * 2); }
    if (rec.flow && rec.flow.phase === 'poof') { const u = Math.min(1, rec.flow.t / 0.45); sy *= u < 0.35 ? 1 - u * 0.8 : 1 + (u - 0.35) * 0.6; shrink = u < 0.35 ? 1 : Math.max(0.01, 1 - (u - 0.35) / 0.65); }

    // ---- mood: angry while striking or huffing, low-mood folk sulk ----
    const striking = rec.pose === 'strike';
    const low = sim && typeof sim.mood === 'number' && sim.mood < 30;
    const angryT = striking ? 1 : rec.huffT > 0 ? 0.8 : low && !moving ? 0.5 : 0;
    rec.angry += (angryT - rec.angry) * Math.min(1, dt * 6);
    // stomp: a short hop + squash + a puff of dust, every ~1.1 s while angry and standing
    if ((striking || rec.huffT > 0 || (low && !moving)) && !moving && onGround && !rec.lock) {
      rec.stompT -= dt;
      if (rec.stompT <= 0) {
        rec.stompT = striking ? 1.1 : rec.huffT > 0 ? 0.55 : 2.4;
        if (sp === 'loaf') hop(rec); else { rec.bumpT = 0; rec.bumpH = 0.09; }
        rec.stompDust = 0.18;
      }
    }
    if (rec.stompDust > 0) { rec.stompDust -= dt; if (rec.stompDust <= 0) { const f = V(Math.sin(a.heading), 0, Math.cos(a.heading)); props.puff(a.pos.x + f.x * 0.1, a.pos.z + f.z * 0.1, { n: 5, r: 0.2 * rec.sc, size: 0.07 * rec.sc, speed: 0.9, up: 0.3, life: 0.5 }); } }
    // bump: a little hop for species whose own hop we don't drive
    if (rec.bumpT < 0.32) { const u = rec.bumpT / 0.32; dy += Math.sin(u * Math.PI) * rec.bumpH * rec.sc; if (u > 0.85) sy *= 0.9; }

    // ---- working: hammer rhythm (arm up slow, down fast), a hop every other strike, dust at the site ----
    const act = rec.pose;
    const hoeing = act === 'hoe';
    const working = (act === 'work' || hoeing) && !moving && arrived(rec) && !rec.listening;
    let swing = 0;
    if (working) {
      // hammer / axe / pick: up slow, down fast (~1.9 Hz); the hoe: a slower, bigger arc down to the ground
      const ph = (T * (hoeing ? 1.15 : 1.9) + rec.seed) % 1;
      swing = ph < 0.6 ? ease(ph / 0.6) : ph < 0.72 ? 1 - ease((ph - 0.6) / 0.12) : 0;   // 1 = raised
      if (rec.lastP < 0.72 && ph >= 0.72) {
        rec.impacts++; sy *= 0.94;
        if (rec.impacts % 2 === 0 && (ARMED.has(sp) || isFlier(rec))) { rec.bumpT = 0; rec.bumpH = 0.05; }
        // dust where the blow lands: big enough to read from the overhead camera
        const f = V(Math.sin(a.heading), 0, Math.cos(a.heading)), reach = (hoeing ? 0.75 : 0.55) * rec.sc, gy0 = groundY(a.pos.x, a.pos.z) || 0;
        props.puff(a.pos.x + f.x * reach, a.pos.z + f.z * reach, { n: hoeing ? 5 : rec.impacts % 2 ? 7 : 4, r: 0.16, size: (hoeing ? 0.08 : 0.095) * rec.sc, speed: 0.8, up: hoeing ? 0.35 : 0.6, life: 0.55, y: gy0 + 0.04 });
        if (sp === 'loaf' && rec.impacts % 2 === 0) hop(rec);
      }
      rec.lastP = ph;
      if (rec.face && typeof rec.face === 'object') faceT = Math.atan2(rec.face.x - a.pos.x, rec.face.z - a.pos.z);
    }
    // the other work poses face their work too (a site, a bench, the lifter below)
    if (faceT === null && !walking && rec.face && typeof rec.face === 'object') faceT = Math.atan2(rec.face.x - a.pos.x, rec.face.z - a.pos.z);

    // ---- facing ----
    const listening = rec.listening || rec.attendT > 0 || rec.pose === 'meeting' || rec.pose === 'present' || striking;
    if (listening && !walking) faceT = Math.atan2(camera.position.x - a.pos.x, camera.position.z - a.pos.z);
    if (rec.face === 'camera') faceT = Math.atan2(camera.position.x - a.pos.x, camera.position.z - a.pos.z);
    if (faceT === null && !walking && rec.lookUntil > T && rec.lookAt) faceT = Math.atan2(rec.lookAt.x - a.pos.x, rec.lookAt.z - a.pos.z);
    // talking to you (a bubble): turn to the lens; a ceremony: everyone turns to look at the new minister
    if (rec.talkUntil > T && !walking && !working) faceT = Math.atan2(camera.position.x - a.pos.x, camera.position.z - a.pos.z);
    if (rec.faceAt && rec.faceUntil > T && !walking) faceT = Math.atan2(rec.faceAt.x - a.pos.x, rec.faceAt.z - a.pos.z);
    if (faceT !== null) {
      if (!rec.faceOn) { rec.faceOn = true; rec.hd = a.heading; rec.hv = rec.mv ? rec.mv.hv || 0 : 0; }
      // the turn rate eases in and out (critically damped), so a turn to face something never starts with a kink
      rec.hv = (rec.hv || 0) + (clamp(wrap(faceT - rec.hd) * 5, -4.5, 4.5) - (rec.hv || 0)) * Math.min(1, dt * 20);
      rec.hd += rec.hv * dt;
      a.heading = rec.hd; a.root.rotation.y = rec.hd;
      if (isFlier(rec)) fm.seat(rec);
      if (!isFlier(rec) && a.lookViewer !== undefined) { a.lookViewer = true; a.lookSwap = Math.max(a.lookSwap, 0.5); }
    } else rec.faceOn = false;

    // ---- carrying and props ----
    const carry = rec.carry, present = rec.pose === 'present', stow = rec.flow && rec.flow.stow ? rec.flow.stow : 0;
    const armX = [null, null], armZ = [null, null];   // per-arm rotation overrides (x pitch, z roll)
    let envParent = null, envPos = null, envBill = false, envScale = 1;
    const held = carry && carry !== 'letter' && props.make[carry] && carry !== 'envelope';
    if (held) {
      const mk = props.make[carry], hang = carry === 'basket' || carry === 'loaves';
      let par = a.body, p = [0, 0, 0], s = 1;
      if (sp === 'puffer') { par = a.puff; p = [0, -0.12, 0.37]; s = 1.05; armX[0] = armX[1] = -1.15; armZ[0] = 0.2; armZ[1] = -0.2; }
      else if (sp === 'drop') { p = [0, 0.09, 0.3]; s = 0.85; armX[0] = armX[1] = -1.3; armZ[0] = 0.25; armZ[1] = -0.25; }
      else if (sp === 'pip') { p = [0, -0.1, 0.27]; s = 0.85; armX[0] = armX[1] = -1.25; armZ[0] = 0.2; armZ[1] = -0.2; }
      else if (sp === 'loaf') { p = [0, bodyTop(rec) + (carry === 'crate' ? 0.035 : 0.03), -0.01]; s = 0.95; }   // sunk into the puffy hat
      else if (sp === 'scoot') { p = [0, 0.56, -0.1]; s = 0.95; }
      else if (CARRY[sp]) { const c = CARRY[sp]; p = c.p; s = c.s; armX[0] = armX[1] = c.armX; armZ[0] = c.armZ; armZ[1] = -c.armZ; if (sp === 'moth') par = a.shell; }
      else if (sp === 'flit') {
        const [l, r] = addedArms(rec);
        if (onGround) { l.rotation.set(-1.3, 0, 0.42); r.rotation.set(-1.3, 0, -0.42); p = [0, -0.06, 0.27]; s = 0.72; }   // hugged to the tummy
        else { l.rotation.set(-0.35, 0, 0.15); r.rotation.set(-0.35, 0, -0.15); p = [0, -0.3, 0.08]; s = 0.75; }          // dangling below in flight
      } else if (sp === 'floatie') {
        // the free arm does the carrying: a basket hangs from the hand, a crate is hugged to the front
        if (hang) { par = a.wave; p = [0, -0.17, 0.02]; s = 0.62; a.wave.rotation.set(-0.25, 0, -0.12); }
        else { p = [-0.02, -0.11, 0.24]; s = 0.62; a.wave.rotation.set(-1.15, 0, 0.55); }
      }
      // held up: over the head for the hand-up, out in front at the market stall
      if ((act === 'lift' || act === 'sell') && onGround && isFlier(rec)) {
        const hi = act === 'lift';
        if (sp === 'flit') { const [l, r] = addedArms(rec); l.rotation.set(hi ? -2.95 : -2.0, 0, 0.32); r.rotation.set(hi ? -2.95 : -2.0, 0, -0.32); par = a.body; p = hi ? [0, 0.5, 0.02] : [0, 0.2, 0.3]; s = 0.8; }
        else { par = a.wave; a.wave.rotation.set(hi ? 0 : -0.9, 0, hi ? -2.75 : -1.6); p = [0, hi ? -0.2 : -0.17, 0.02]; s = 0.66; }
      }
      const c = ensure(rec, carry, mk, par); c.position.set(...p); c.scale.setScalar(s); c.rotation.set(0, 0, 0);
    }
    if (carry === 'letter') {
      const up = present && stow < 1;
      if (ARMED.has(sp)) {
        const ar = arm(rec, 1);
        envParent = ar; envPos = sp === 'puffer' ? [0, -0.2, 0.03] : HAND[sp] != null ? [0, HAND[sp] - 0.04, 0.03] : [0, -0.1, 0.03]; envScale = sp === 'puffer' ? 0.95 : 0.8;
        if (up) { armX[1] = 0; armZ[1] = 2.5 + Math.sin(T * 7) * 0.12; envBill = true; }
        else { armX[1] = -1.2; armZ[1] = -0.15; envBill = true; }
      } else if (sp === 'loaf') { envParent = a.body; envPos = [0, bodyTop(rec) + 0.12 + (up ? 0.1 + Math.abs(Math.sin(T * 5)) * 0.06 : 0), 0.02]; envBill = true; }
      else if (sp === 'scoot') {
        envParent = a.body; envBill = true;
        if (up) { a.body.rotation.x = -0.42; envPos = [0, 0.52 + Math.sin(T * 6) * 0.02, 0.27]; a.feelers.forEach(f => f.rotation.x = 1.05); }
        else { envPos = [0, 0.3, 0.43]; envScale = 0.75; a.feelers.forEach(f => f.rotation.x = 0.9); }
      } else if (sp === 'flit') {
        const [l, r] = addedArms(rec); envParent = a.body; envBill = true;
        if (up) { l.rotation.set(-2.5, 0, 0.35); r.rotation.set(-2.5, 0, -0.35); envPos = [0, 0.3 + Math.sin(T * 6) * 0.02, 0.24]; }
        else if (onGround) { l.rotation.set(-1.25, 0, 0.4); r.rotation.set(-1.25, 0, -0.4); envPos = [0, -0.02, 0.28]; envScale = 0.85; }
        else { l.rotation.set(-0.5, 0, 0.3); r.rotation.set(-0.5, 0, -0.3); envPos = [0, -0.25, 0.14]; envScale = 0.85; }
      } else if (sp === 'floatie') {
        envParent = a.wave; envPos = [0, up ? -0.2 : -0.12, 0.03]; envBill = true; envScale = up ? 1 : 0.85;
        a.wave.rotation.z = up ? -2.55 + Math.sin(T * 7) * 0.12 : -1.25;
      }
    }
    if (envParent) {
      const e = ensure(rec, 'letter', props.envelope, envParent);
      // held up to show you: bigger, so it reads from the leader's height
      const showK = present ? 1.45 : 1;
      e.position.set(...envPos); e.scale.setScalar(envScale * showK * (1 - ease(stow)) + 1e-3);
      e.rotation.set(0, 0, 0); if (envBill) e.userData.bill = true; else e.userData.bill = false;
    }

    // ---- hammering: the right arm (or a nub) swings a mallet, the other steadies the work ----
    if (working && carry !== 'letter') {
      const up = -2.6, down = -0.75, x = down + (up - down) * swing;
      const tk = rec.tool && props.make[rec.tool] ? rec.tool : (hoeing ? 'hoe' : 'mallet'), tmk = props.make[tk], key = 'tool:' + tk;
      const lean = hoeing ? 0.26 : 0.12, big = tk === 'mallet' ? 1.6 : 1.3;   // tools a size up: they must read from above
      if (ARMED.has(sp)) {
        armX[1] = x; armZ[1] = -0.1; if (armX[0] === null) { armX[0] = -0.85; armZ[0] = 0.25; }
        const m = ensure(rec, key, tmk, arm(rec, 1));
        m.position.set(0, sp === 'puffer' ? -0.14 : HAND[sp] != null ? HAND[sp] : -0.06, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(sp === 'puffer' ? 1.35 : 1.05);
      } else if (sp === 'flit') {
        const [l, r] = addedArms(rec);
        if (hoeing) { const xx = -0.35 + (-2.75 + 0.35) * swing; r.rotation.set(xx, 0, -0.15); l.rotation.set(xx + 0.2, 0, 0.15); }   // two hands on the hoe
        else { r.rotation.set(x, 0, -0.1); l.rotation.set(-0.8, 0, 0.3); }
        const m = ensure(rec, key, tmk, r); m.position.set(0, -0.06, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(big);
        a.body.rotation.x += lean * (1 - swing);   // leans into each blow
      } else if (sp === 'floatie') {
        a.wave.rotation.set((hoeing ? -0.35 + (-2.6 + 0.35) * swing : x) * 0.9, 0, -0.35);
        const m = ensure(rec, key, tmk, a.wave); m.position.set(0, -0.06, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(big * 0.92);
        a.body.rotation.x += lean * 0.8 * (1 - swing);
      } else if (sp === 'scoot') {
        // no arms: a mallet in the mouth, nodding down onto the work
        a.body.rotation.x = 0.1 + (1 - swing) * 0.28 - swing * 0.18;
        const m = ensure(rec, key, tmk, a.body); m.position.set(0, 0.3, 0.4); m.rotation.set(-1.4 + swing * 0.5, 0, 0); m.scale.setScalar(0.8);
      }
    }

    // ---- striking: puffed up, a placard aloft (or planted), angry eyes, stomping ----
    if (striking && !moving) {
      if (ARMED.has(sp)) {
        // the sign goes up and down with the stomps; the stick stays upright whatever the arm does
        const lift = Math.sin(T * 3 + rec.seed * 6) * 0.12;
        armX[1] = 0; armZ[1] = 2.25 + lift; armX[0] = 0.25; armZ[0] = -1.05;   // sign up, fist on hip
        const pl = ensure(rec, 'placard', props.placard, arm(rec, 1));
        pl.position.set(0, sp === 'puffer' ? -0.15 : HAND[sp] != null ? HAND[sp] - 0.01 : -0.07, 0); pl.rotation.set(0, 0, -armZ[1] + 0.08); pl.scale.setScalar(sp === 'puffer' ? 0.7 : 0.62);
      } else if (isFlier(rec)) {
        // the flit raises it in a nub; the floatie in its free arm (the other one keeps the parasol up)
        const lift = Math.sin(T * 3 + rec.seed * 6) * 0.12;
        const holder = sp === 'flit' ? addedArms(rec)[1] : a.wave, zr = (sp === 'flit' ? 2.25 : -2.25) + (sp === 'flit' ? lift : -lift);
        holder.rotation.set(0, 0, zr);
        if (sp === 'flit') addedArms(rec)[0].rotation.set(0.3, 0, 1.0);
        const pl = ensure(rec, 'placard', props.placard, holder);
        pl.position.set(0, -0.06, 0); pl.rotation.set(0, 0, -zr + (sp === 'flit' ? 0.08 : -0.08)); pl.scale.setScalar(0.62);
      } else {
        const pl = ensure(rec, 'placard', props.placard, a.root);
        pl.position.set(0.34, 0, 0.05); pl.rotation.set(0, 0, -0.08); pl.scale.setScalar(1);
      }
    }
    if (rec.pose === 'sulk' && ARMED.has(sp) && moving) { armZ[0] = -0.05; armZ[1] = 0.05; }   // arms hang on the way out
    // on their feet, our folk swing their free arms with the steps, and throw them up when they hop
    const cheer = rec.bumpT < 0.32 && rec.bumpH >= 0.1 ? Math.sin(rec.bumpT / 0.32 * Math.PI) : 0;
    if (sp === 'flit' && onGround && !(rec.x.armL && rec.x.armL.visible)) {
      const [l, r] = addedArms(rec), m = rec.mv, sw = Math.sin(m.stride) * 0.6 * (m.w || 0);
      l.rotation.set(-sw, 0, 0.3 + cheer * 1.9 + Math.sin(T * 1.4) * 0.04); r.rotation.set(sw, 0, -0.3 - cheer * 1.9 - Math.sin(T * 1.4 + 1) * 0.04);
    }
    if (sp === 'floatie' && a.driven && cheer > 0 && !carry && !working && !striking) a.wave.rotation.set(0, 0, -0.35 - cheer * 1.8 + Math.sin(T * 14) * 0.2 * cheer);
    // a wave hello (fleet introductions): a flit's right nub goes up and waves
    if (sp === 'flit' && onGround && rec.waveT > 0 && !carry && !working) {
      const [, r] = addedArms(rec), u = Math.min(1, rec.waveT / 1.3), up = Math.sin(u * Math.PI);
      r.rotation.set(0, 0, -0.3 - up * 2.3 + Math.sin(T * 14) * 0.35 * up);
    }
    if (sp === 'floatie' && onGround && rec.waveT > 0 && !carry && !working) { const u = Math.min(1, rec.waveT / 1.3), up = Math.sin(u * Math.PI); a.wave.rotation.set(0, 0, -0.35 - up * 1.9 + Math.sin(T * 13) * 0.3 * up); }
    if (isFlier(rec) && !moving) {
      if (act === 'stoop' && onGround) {   // picking up / setting down
        sy *= 0.86; a.body.rotation.x += 0.32;
        if (sp === 'flit') { const [l, r] = addedArms(rec); l.rotation.set(-0.7, 0, 0.25); r.rotation.set(-0.7, 0, -0.25); }
        else if (!carry) a.wave.rotation.set(-0.8, 0, -0.2);
      } else if (act === 'knead' && onGround) {   // a baker at the board: hands press down in turn, a little flour flies
        const ph = T * 6.2 + rec.seed * 5, k1 = Math.max(0, Math.sin(ph)), k2 = Math.max(0, Math.sin(ph + Math.PI));
        if (sp === 'flit') { const [l, r] = addedArms(rec); l.rotation.set(-1.05 - 0.55 * k1, 0, 0.32); r.rotation.set(-1.05 - 0.55 * k2, 0, -0.32); }
        else a.wave.rotation.set(-1.1 - 0.6 * k1, 0, -0.45);
        sy *= 1 - 0.035 * (k1 + k2); a.body.rotation.x += 0.18;
        if (Math.random() < dt * 1.6) { const f = V(Math.sin(a.heading), 0, Math.cos(a.heading)); props.puff(a.pos.x + f.x * 0.45 * rec.sc, a.pos.z + f.z * 0.45 * rec.sc, { n: 3, r: 0.08, size: 0.05 * rec.sc, speed: 0.4, up: 0.5, life: 0.5, y: (groundY(a.pos.x, a.pos.z) || 0) + 0.25 * rec.sc }); }
      } else if (act === 'reach' && !onGround) {   // hovering over the scaffold, hands down for the plank
        if (sp === 'flit') { const [l, r] = addedArms(rec); l.rotation.set(-0.55, 0, 0.22); r.rotation.set(-0.55, 0, -0.22); }
        else a.wave.rotation.set(-0.5, 0, -0.25);
      } else if (act === 'sell' && onGround) {
        a.root.rotation.y += Math.sin(T * 1.3 + rec.seed * 4) * 0.4;   // showing the goods to either side
      }
    }
    // the chosen one bows from the air (ceremony)
    if (rec.bow) a.body.rotation.x += (sp === 'flit' ? 0.7 : 0.55) * rec.bow;
    // talking: a tiny wiggle while the bubble is up
    if (rec.speakUntil > T) sy *= 1 + 0.022 * Math.sin(T * 8 + rec.seed * 3);   // was 2.7 Hz: read as a buzz
    // highlighted (the minister choice): a soft hover lift, and the propeller spins up (step) / the parasol carries it
    if (rec.hiK > 0.01) dy += rec.hiK * (isFlier(rec) ? 0.26 + 0.05 * Math.sin(T * 2.6 + rec.seed * 6) : 0.12);

    // ---- apply arm overrides ----
    if (a.arms) for (let j = 0; j < 2; j++) {
      // armZ is the literal roll: + swings a hanging arm toward +x (so inward for the left arm, outward for the right)
      const g = a.arms[j];
      if (armX[j] !== null) g.rotation.x = armX[j];
      if (armZ[j] !== null) g.rotation.z = armZ[j];
    }

    // ---- puffed body (angry), squash, shrink ----
    const puffK = 1 + 0.16 * rec.angry;
    if (sp === 'puffer') { a.puff.scale.multiplyScalar(puffK); }
    else { sxz *= 1 + 0.12 * rec.angry; sy *= 1 + 0.05 * rec.angry; }
    if (rec.pose === 'rest' && !moving) sy *= 0.93;
    if (sp === 'puffer' && rec.pose === 'rest' && !moving) { a.mood = 'sleepy'; a.moodT = Math.max(a.moodT, 1); }
    sxz *= 1 / Math.sqrt(sy);
    if (isFlier(rec)) {
      // fliers.js (or the air reset) wrote the base scale this frame: squash about the feet when standing
      a.body.scale.x *= sxz; a.body.scale.y *= sy; a.body.scale.z *= sxz;
      if (onGround) a.body.position.y -= (sp === 'flit' ? 0.226 : 0.23) * (1 - sy);
    } else {
      a.body.scale.x *= sxz; a.body.scale.y *= sy; a.body.scale.z *= sxz;
      if (BODY_HALF[sp]) a.body.position.y -= BODY_HALF[sp] * (1 - sy) * (sp === 'puffer' ? puffK : 1);
    }
    // refusal: a head shake
    if (rec.shake > 0) { const k = rec.shake; const r = Math.sin(T * 22) * 0.35 * k; if (sp === 'puffer' || sp === 'loaf') a.body.rotation.y = r; else a.body.rotation.y += r; }
    else if (sp === 'puffer' || sp === 'loaf') a.body.rotation.y = 0;

    // ---- eyes: angry slant, sleepy lids, wide when listening ----
    const ang = rec.angry;
    (a.eyes || []).forEach((e, j) => {
      e.rotation.z = sd(j) * 0.42 * ang;
      if (sp === 'drop') { if (ang > 0.3) { e.scale.y = 0.75; e.scale.x = 1.15; } else if (rec.pose === 'rest' && !moving) e.scale.y = 0.35; }
      else {
        if (ang > 0.05) e.scale.y *= 1 - 0.45 * ang;
        if (rec.pose === 'rest' && !moving) e.scale.y *= 0.3;
        if ((rec.listening || rec.attendT > 0) && ang < 0.1) e.scale.y *= 1.12;
      }
      if (sp === 'puffer' && ang > 0.3) e.visible = true;
    });
    if (sp === 'puffer' && ang > 0.3) a.arcs.forEach(x => x.visible = false);
    // listening puffers keep their eyes open on you (the reference's 'content' face closes them)
    if (sp === 'puffer' && ang <= 0.3 && (rec.listening || rec.attendT > 0) && !a.hop) { a.arcs.forEach(x => x.visible = false); a.eyes.forEach(e => { e.visible = true; e.scale.y = a.blink > 0 ? 0.1 : 1.08; }); }
    if (sp === 'drop' && (rec.listening || rec.attendT > 0) && ang < 0.1) a.wide = Math.max(a.wide, 0.2);

    // ---- vertical offset: root, legs and ground shadow move together (plus the relief under them) ----
    const gy = groundY(a.pos.x, a.pos.z) || 0;
    if (a.blob && !isFlier(rec) && dy > 0) a.blob.scale.multiplyScalar(1 / (1 + dy * 0.35));
    dy += gy;
    if (dy !== 0) {
      a.root.position.y += dy;
      (a.legs || []).forEach(l => { l.leg.position.y += dy; l.foot.position.y += dy; });
    }
    if (a.blob && gy) a.blob.position.y += gy;
    if (shrink !== 1) {
      a.root.scale.setScalar(rec.sc * shrink);
      (a.legs || []).forEach(l => { l.leg.scale.multiplyScalar(shrink); l.foot.scale.multiplyScalar(shrink); });
      if (a.blob) a.blob.scale.multiplyScalar(shrink);
    } else if (a.root.scale.x !== rec.sc) a.root.scale.setScalar(rec.sc);

    // letters always turn to face the lens, so the envelope reads on stage
    if (rec.x.letter && rec.x.letter.visible && rec.x.letter.userData.bill) billboard(rec.x.letter);
  }

  // =============== picking (ART_DIRECTION §20: reliable, through her lens, cheap) ===============
  // No raycast: the folk are picked on their SCREEN boxes. Every live folk's body (bodies(): head -> foot, a floatie's
  // canopy and the body under it, each with a radius) is projected through her lens once a frame (cached), and a
  // click picks the folk whose box is under it (or within `radiusPx` of its outline), the nearest to the camera when
  // boxes overlap. The old raycast missed floaties (their canopy is a thin lathe seen from above) and its fallback
  // point (root + 0.6 m) sat in the sky over a floatie, so a click on a body close up found nobody.
  let boxCache = null, boxFrame = -1, boxCamFov = 0;
  const _bt = V(0, 0, 0), _bb = V(0, 0, 0);
  function screenBoxes() {
    const f = overlayFrame;
    if (boxCache && boxFrame === f && boxCamFov === camera.fov) return boxCache;
    const out = [], th = Math.tan(THREE.MathUtils.degToRad((camera.fov || 40) / 2)), r = renderer.domElement.getBoundingClientRect(), cp = camera.position;
    for (const b of bodies()) {
      const h = toClient(_bt.set(b.top.x, b.top.y, b.top.z)); if (!h) continue;
      const hx = h.x, hy = h.y;
      const ft = toClient(_bb.set(b.bottom.x, b.bottom.y, b.bottom.z)); if (!ft) continue;
      if (Math.abs(hx - r.width / 2) > r.width * 2 || Math.abs(hy - r.height / 2) > r.height * 2) continue;   // her lens inverted past the frame: not on screen
      const d = cp.distanceTo(_bt.set(b.top.x, b.top.y, b.top.z));
      const half = Math.max(4, (b.r || 0.3) * (r.height / 2) / (Math.max(0.1, d) * th));
      out.push({ id: b.id, x0: hx, y0: hy, x1: ft.x, y1: ft.y, half, depth: d });
    }
    boxCache = out; boxFrame = f; boxCamFov = camera.fov;
    return out;
  }
  // the signed distance from a point to a box's outline (a capsule round the head -> foot segment): <= 0 inside
  function boxDist(b, x, y) {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, l2 = dx * dx + dy * dy;
    const t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((x - b.x0) * dx + (y - b.y0) * dy) / l2)) : 0;
    return Math.hypot(x - (b.x0 + dx * t), y - (b.y0 + dy * t)) - b.half;
  }
  // radiusPx: how far past the body's outline a click still counts (forgiving); the nearest-to-camera box wins ties
  function pickAgent(clientX, clientY, { radiusPx = 10 } = {}) {
    let best = null, bd = radiusPx, bdepth = Infinity;
    for (const b of screenBoxes()) {
      const d = boxDist(b, clientX, clientY);
      if (d > radiusPx) continue;
      const inside = d <= 0;
      // inside one box: the nearest body to the camera wins; outside all: the closest outline
      if (inside ? (bd > 0 || b.depth < bdepth) : (bd > 0 && d < bd)) { best = b.id; bd = inside ? 0 : d; bdepth = b.depth; }
    }
    return best;
  }
  // the screen box of a folk (the body's head / foot in client px and its half width), for tests and the UI
  function screenBoxOf(id) {
    const bs = screenBoxes().filter(b => b.id === id); if (!bs.length) return null;
    const b = bs[bs.length - 1];   // a floatie: the body under the canopy (the last pushed)
    return { top: { x: b.x0, y: b.y0 }, bottom: { x: b.x1, y: b.y1 }, half: b.half, depth: b.depth, boxes: bs.length };
  }

  // =============== wiring ===============
  const on = (ev, fn) => { game.on(ev, fn); unsub.push(() => game.off && game.off(ev, fn)); };
  on('agent:spawn', onSpawn);
  on('agent:task', onTask);
  on('agent:mood', onMood);
  on('agent:refuse', onRefuse);
  on('agent:listen', onAgentListen);
  on('crowd:listen', onCrowdListen);
  on('letter:sent', ({ letterId, courierId }) => { const r = recs.get(courierId); if (r && letterId && !r.letterIds.includes(letterId)) r.letterIds.push(letterId); });
  // letters that rode along in a busy courier's bag only show up when the sim lands them
  on('letter:new', ({ letter, courierId }) => { const r = courierId && recs.get(courierId); if (r && r.lock === 'deliver' && letter && !r.letterIds.includes(letter.id)) r.letterIds.push(letter.id); });
  on('envoy:send', onEnvoy);
  on('building:done', onBuildingDone);
  on('gift:send', onGift);
  on('agent:leave', ({ agentId, to }) => { const r = recs.get(agentId); if (r && r.state === 'live' && r.lock !== 'leave') { const n = nation(to); r.pending = null; r.lock = null; r.flow = null; startLeave(r, { x: n.x, z: n.z }); } });

  // =============== the minister's seal, speech bubbles, where a folk is ===============
  let ministerId = null;
  function setMinister(id) {
    if (ministerId != null && ministerId !== id) { const o = api.get(ministerId); if (o) idn.setMinister(o, false); }
    ministerId = id ?? null;
    const r = id != null ? api.get(id) : null; if (r) idn.setMinister(r, true);
  }
  on('minister:set', ({ agentId }) => setMinister(agentId));
  // the sim's arrival script (sim/fleets.js): squares, the roll-call, the ceremony, back to work; and what folk say
  on('fleet:form', ({ fleets: list }) => { if (Array.isArray(list) && list.length) fleets.form(list); });
  on('fleet:introduce', ({ fleetId }) => { if (fleetId) fleets.introduce(fleetId); });
  on('fleet:release', () => fleets.release());
  on('ceremony:start', ({ agentId }) => { if (agentId != null) fleets.ceremony(agentId); });
  // §24: a player's talk and the ceremony always show; idle / mind / chat lines only while fewer than two bubbles are up
  on('agent:say', ({ agentId, text, ttl, kind }) => { if (agentId != null && text) bubble(agentId, text, { ...(ttl ? { ms: ttl * 1000 } : {}), force: kind === 'talk' || kind === 'ceremony' }); });
  // the head of a folk in world space (bubbles, the card, the camera)
  function headOf(rec, v = V(0, 0, 0)) {
    const a = rec && rec.a; if (!a || rec.state !== 'live') return null;
    a.root.getWorldPosition(v);
    v.y += rec.species === 'flit' ? 0.56 * rec.sc : rec.species === 'floatie' ? 0.24 * rec.sc : (HEAD[rec.species] || 0.85) * rec.sc;
    return v;
  }
  function bubble(id, text, o = {}) {
    const rec = api.get(id); if (!rec || !rec.a) return null;
    const tone = o.tone || 'say', str = String(text ?? '');
    const ms = o.ms ?? (tone === 'think' && !str ? 0 : Math.max(2600, Math.min(7000, 1400 + Math.min(90, str.length) * 70)));
    const h = bubbles.show(id, str, { ...o, ms, tone, anchor: v => headOf(rec, v) });
    rec.talkUntil = T + (ms ? ms / 1000 : 30);
    rec.speakUntil = tone === 'think' ? 0 : T + Math.min(3.2, 0.9 + Math.min(90, str.length) * 0.03);
    if (tone !== 'think' && fm.down(rec) && !rec.lock && !rec.flow) hop(rec, 0.1);
    return h;
  }
  // where a letter pin floats: above a folk's head (or a parasol), or over a point ({x, z, y?: absolute, h?: above ground})
  function pinAnchor(t, v) {
    if (t && typeof t === 'object') return v.set(+t.x, t.y != null ? +t.y : (groundY(+t.x, +t.z) || 0) + (t.h != null ? +t.h : 2.2), +t.z);
    const rec = api.get(t), p = headOf(rec, v); if (!p) return null;
    p.y -= 0.04 * (rec.sc || 1); return p;   // just over the rotor / the parasol's tip
  }
  // who a letter floats over: a folk (agent / minister), the road to a neighbour's nation, the plot centre for the
  // Ministry; null for the Moon's shadelings (no pins off the map)
  function senderTarget(from) {
    if (!from) return null;
    if ((from.kind === 'agent' || from.kind === 'minister') && from.id != null && recs.has(from.id)) return from.id;
    if (from.kind === 'neighbour' && from.id && from.id !== 'all') { const n = nation(from.id), ex = edgeExit(n.x, n.z); return { x: ex.x - ex.dx * 1.5, z: ex.z - ex.dz * 1.5, h: 1.7 }; }
    if (from.kind === 'ministry' || from.kind === 'minister' || (from.kind === 'neighbour' && from.id === 'all')) { const c = S.centre || { x: 0, z: 2 }; return { x: c.x, z: c.z, h: 2.6 }; }
    return null;
  }
  // a sim letter as a tiny tag over its sender (§15): name, the gist (meta.gist > subject > the body's first line, at
  // most 40 characters) and the letter's own options as 2-3 quick replies (onReply gets the option's `says`)
  function pinLetter(letter, { onClick = null, onOpen = null, onReply = null, target, gist = null, replies = null } = {}) {
    if (!letter || letter.id == null) return null;
    const t = target !== undefined ? target : senderTarget(letter.from);
    if (t == null) return null;
    const from = letter.from || {};
    const initial = from.kind === 'ministry' ? 'M' : from.kind === 'neighbour' ? String(from.name || from.id || '?').trim()[0] : '';
    const firstLine = String(letter.body || '').split(/\n+/).map(x => x.trim()).find(x => x && !/^(dear|hello|hi|to)\b/i.test(x)) || '';
    const g = gist || (letter.meta && letter.meta.gist) || letter.subject || firstLine.split(/(?<=[.!?])\s/)[0];
    return pins.pin(t, { letterId: letter.id, from: from.name || '', subject: letter.subject || '', gist: g, replies: replies || (letter.resolved ? [] : letter.options || []),
      unread: !letter.read, onOpen: onOpen || onClick, onReply, onClick, initial, minister: from.kind === 'minister' });
  }
  function clearBubble(id) { const r = api.get(id); if (r) { r.talkUntil = 0; r.speakUntil = 0; } return bubbles.hide(id); }

  function dispose() {
    unsub.splice(0).forEach(f => f());
    work.dispose(); bubbles.dispose(); pins.dispose(); portraits.dispose(); [...recs.values()].forEach(r => { if (r.halo) { scene.remove(r.halo); r.halo = null; } });
    [...temps].forEach(despawn);
    nav.bounds = ob; nav.flyPush = ofp;
    props.disposeAll(); scene.remove(away);
  }

  Object.assign(api, {
    update, pickAgent, screenBoxOf, crowdListen, envoyIn, giftOut, dispose, props, fm,
    // the painted species of a sim agent (always 'flit' or 'floatie' for our people; the sim keeps its own)
    speciesOf(id) { const r = recs.get(id); return r ? r.species : null; },
    // a little celebratory flight (lab / director); delay in seconds
    celebrate(id, delay = 0) { return celebrate(api.get(id), delay); },
    // lab: send one of ours to (x, z), walking or flying ({ fly: true|false|'auto' })
    // (explicit commands from the lab / director end any visible-work role first)
    fly(id, x, z, o = {}) { const r = api.get(id); if (r && isFlier(r)) { work.endRole(r, false); walkTo(r, x, z, { fly: true, ...o }); } },
    get(id) { return recs.get(id) || [...temps].find(r => r.id === id) || null; },
    get recs() { return recs; }, get temps() { return temps; },
    get listening() { return listenOn; },
    // the folk record (a.root, a.pos ...) for a sim agent id
    creature(id) { const r = recs.get(id); return r && r.a; },
    // debug / lab: put an agent into a pose without the sim ('work' | 'strike' | 'rest' | 'meeting' | null), carry 'crate'|'basket'|'letter'|null
    debugPose(id, poseName, carry = undefined, faceAt = null) {
      const r = api.get(id); if (!r || !r.a) return false;
      work.endRole(r, false); r.pose = poseName; if (carry !== undefined) r.carry = carry; r.face = faceAt; return true;
    },
    walkTo(id, x, z, o) { const r = api.get(id); if (r) { work.endRole(r, false); walkTo(r, x, z, o); } },
    startLeave(id, to) { const r = api.get(id); if (r) startLeave(r, to); },
    deliverTest(id) { const r = api.get(id); if (!r || !r.a) return false; work.endRole(r, false); r.letterIds = r.letterIds.length ? r.letterIds : ['test']; startCourier(r); return true; },
    hop(id) { const r = api.get(id); if (r) hop(r); },
    // ---- who is who (identity.js): the UI card's words for a folk's gear and clothes ----
    identity(id) { return idn.describe(api.get(id)); },
    // ---- fleets (fleets.js): squares by trade, the roll-call, the minister's election ----
    formFleets(list, o) { return fleets.form(list || fleets.byTrade(), o); },
    fleetsByTrade() { return fleets.byTrade(); },
    fleetCaption(f) { return fleets.caption(typeof f === 'string' ? (fleets.fleets.get(f) || { id: f, members: [] }) : f); },
    fleetInfo(id) { return fleets.info(id); },
    fleetsReady(id) { return fleets.ready(id); },
    introduceFleet(id, o) { return fleets.introduce(id, o); },
    releaseFleets(ids) { fleets.release(ids); },
    highlight(id, on = true) { const r = api.get(id); if (!r || !r.a) return false; r.hi = !!on; return true; },
    ceremony(id, o) { return fleets.ceremony(id, o); },
    setMinister,
    // ---- speech bubbles (bubbles.js): short plain sentences over a folk's head; tone 'think' with no text = "· · ·" ----
    bubble, clearBubble, bubbles: () => bubbles.list(), placeBubbles: () => bubbles.update(),
    headOf(id) { const v = headOf(api.get(id)); return v ? { x: v.x, y: v.y, z: v.z } : null; },
    screenOf(id) { const r = api.get(id), v = r && headOf(r); if (!v) return null; return toClient(v); },   // through the lens (the card, the talk)
    // ---- visible work (work.js) ----
    act(id, style, o) { const r = api.get(id); return r && isFlier(r) ? work.act(r, style, o) : false; },   // 'hammer'|'hoe'|'bake'|'chop'|'pick'|'sell'|'lift'|'think'
    stopAct(id) { const r = api.get(id); if (r) work.endRole(r); },
    workStats() { return work.stats(); },
    roleOf(id) { const r = api.get(id); return r && r.role ? { kind: r.role.kind, sub: r.role.sub || r.role.style || null, phase: r.role.phase, buildingId: r.role.bid ?? null } : null; },
    // ---- portraits + letters in the world (portraits.js, pins.js; ART_DIRECTION §14) ----
    portrait(id, o) { return portraits.get(id, o); },              // -> Promise<dataURL | null>, { size = 96, bg = 'paper'|'none', ring = true }
    portraitNow(id, o) { return portraits.now(id, o); },           // -> dataURL | null (sync; null until the folk has landed)
    portraitRev(id) { return portraits.rev(id); },                 // changes when the folk's look changes
    letterPin(target, o) { return pins.pin(target, o); },           // o: { letterId, unread, onOpen, onReply, onClick, from, subject, gist, replies, portrait, initial }
    pinReply(letterId, i = 0) { return pins.reply(letterId, i); },    // answer by the i-th quick reply (tests / voice)
    pinLetter(letter, o) { return pinLetter(letter, o); },         // a sim letter: target from letter.from; o: { onOpen, onReply, onClick, target, gist, replies }
    senderTarget(from) { return senderTarget(from); },             // letter.from -> agentId | { x, z, h } | null          // target: agentId | { x, z, y?, h? }; o: { letterId, unread, onClick, from, subject, portrait, initial }
    unpin(letterId) { return pins.unpin(letterId); },
    unpinAll() { pins.clear(); },
    setPinUnread(letterId, on) { return pins.setUnread(letterId, on); },
    pinFor(agentId) { return pins.pinFor(agentId); },              // -> { letterId, letterIds, unread, count, open() } | null
    pins() { return pins.list(); },
    pinRect(letterId) { return pins.rect(letterId); },             // screen rect of the tag
    pinAnchor(letterId) { return pins.anchorOf(letterId); },       // world point (for the camera glide)
    placePins() { pins.update(); bubbles.update(0, pins.rects()); }, // snap the tags into place (before a still)
    pinStacks() { return pins.stacks(); },                         // the knots folded into stacks: [{ id, count, text, members, rect, opacity }]
    expandStack(which) { return pins.expand(which); },             // fan a stack out (its id, or a member's agent id), as a click does
    collapseStacks() { return pins.collapse(); },                  // fold it back (Esc / a click elsewhere do this too)
    showPins(on = true) { pins.setVisible(on); },                  // false on the globe / the Moon / full-screen scenes
    colourRule(id) { const r = api.get(id); return r && r.idn ? r.idn.colourRule : null; },
    work, fleetsApi: fleets, idn,
    onDelivered: opts.onDelivered || null,
    extraObstacles: []      // [x, z, r] the walkers keep clear of besides the buildings (lab props, scenery)
  });
  return api;
}

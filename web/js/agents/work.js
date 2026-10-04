// Visible work (ART_DIRECTION §11 "Jobs and economy", "Visible building"): what our folk are SEEN doing.
// The sim decides who works where (crews, production jobs); this module turns that into a loop you can read from the
// close overhead camera, decoupled from the sim's abstract 3 u/s timing:
//   - a building site: the sim's crew AND idle folk nearby ("helpers") stream materials from the stockpile to the
//     site (crates, planks, stones; sacks of seed for fields and gardens), drop them on growing piles at the edge,
//     hammer with dust puffs, pass planks up to a flit hovering over the scaffold, and flap / drift round it;
//   - a finished workplace: farmers hoe their rows, bakers knead and carry trays of loaves to the rack, woodcutters
//     chop and stack logs, quarry folk swing picks and carry stones, traders hold their goods up at the stall,
//     dockers shift crates, everyone else hammers at a bench;
//   - idle couriers / scouts do post rounds: an envelope flown to a house or a neighbour, held up, handed over.
// A role is NOT a lock: a real sim task (rest, a meeting, a letter, a strike, a new job) ends it at once; the sim's
// idle strolling is ignored while a folk has a role. Piles are drawn in the live folk pass only (props.liveOnly).
//
//   const work = createWork(B)       // B: the bridge kit (agents.js)
//   work.intercept(rec, task) -> bool   // inside applyTask: a build / job task becomes (or keeps) a role
//   work.step(rec, dt) · work.update(dt) (recruit helpers, keep sites) · work.endRole(rec) · work.release(buildingId)
//   work.act(rec, style, { x, z, ms, face })   // make a folk visibly do something somewhere (entrepreneurs, the lab)

const FARM = new Set(['field', 'farm', 'orchard', 'vineyard', 'garden', 'grove', 'forest', 'meadow', 'pasture']);
const BAKE = new Set(['bakery', 'tavern', 'tea_house', 'teahouse', 'cafe', 'kitchen']);
const CHOP = new Set(['woodcutter', 'sawmill', 'lumber']);
const QUARRY = new Set(['quarry', 'mine']);
const SELL = new Set(['market', 'shop', 'stall']);
const DOCK = new Set(['dock', 'harbour', 'pier', 'boat_workshop', 'boatyard']);
// how many helpers a site draws on top of the sim's crew, by category
const WANT = { building: 4, landmark: 6, prop: 2, nature: 3 };
const POST_TRADES = new Set(['scout', 'courier']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frac = x => x - Math.floor(x);

export function styleOf(b, trade = '') {
  const k = String((b && b.kind) || '').replace(/^pending:/, '').toLowerCase(), cat = b && b.category;
  if (FARM.has(k) || cat === 'nature') return 'hoe';
  if (BAKE.has(k) || /bak|bread|tea|cafe|kitchen|pastr/.test(k)) return 'bake';
  if (CHOP.has(k) || /wood|lumber|saw/.test(k)) return 'chop';
  if (QUARRY.has(k) || /quarr|mine|stone/.test(k)) return 'pick';
  if (SELL.has(k) || /market|shop|stall|trade/.test(k)) return 'sell';
  if (DOCK.has(k) || /dock|pier|boat|harbo/.test(k)) return 'dock';
  if (/farmer/.test(trade)) return 'hoe';
  if (/baker/.test(trade)) return 'bake';
  return 'hammer';
}

export function createWork(B) {
  const { S, recs, props, V, isFlier, walkTo, stand, arrived, groundY, scene } = B;
  const sites = new Map();   // building id -> { b, pile: [meshes], helpers: Set, crew: Set, k, anchors }
  const jobs = new Map();    // building id -> { pile: [meshes], k }
  let clock = 0, postClock = 2;
  const api = { enabled: true, helpers: true, post: true };

  // ---------------- geometry of a site ----------------
  const bOf = id => (S.buildings || []).find(x => x.id === id) || null;
  const centreOf = b => (b.floating && b.workSpot) ? b.workSpot : (b.shape && b.shape.centroid) ? { x: b.shape.centroid.x, z: b.shape.centroid.z } : { x: b.x, z: b.z };
  const radiusOf = b => { const f = b.footprint || { w: 4, d: 4 }; return b.floating ? 1.2 : Math.max(f.w, f.d) / 2; };
  const stock = () => S.stockpile || { x: -9, z: 13 };
  function inPoly(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a.z > z) !== (b.z > z)) && (x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x)) c = !c; } return c; }
  function along(pts, u) {   // a point at fraction u along a polyline, plus its direction
    let L = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); seg.push(d); L += d; }
    let s = u * L;
    for (let i = 0; i < seg.length; i++) { if (s <= seg[i] || i === seg.length - 1) { const t = seg[i] ? clamp(s / seg[i], 0, 1) : 0, a = pts[i], b = pts[i + 1]; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / (seg[i] || 1), dz: (b.z - a.z) / (seg[i] || 1) }; } s -= seg[i]; }
    return { x: pts[0].x, z: pts[0].z, dx: 1, dz: 0 };
  }
  // a working spot: k spreads folk round the site (an outline: inside it; a stroke: beside it; a point: round it)
  function spot(b, k, { toward = null, inside = false } = {}) {
    const c = centreOf(b), sh = b.shape;
    if (sh && sh.pts && sh.pts.length > 1) {
      const p = along(sh.pts, 0.08 + 0.84 * frac(k * 0.618 + 0.13)), side = (k % 2 ? 1 : -1) * ((sh.width || 1) / 2 + 0.75);
      return B.dry(p.x - p.dz * side, p.z + p.dx * side);
    }
    if (sh && sh.poly && sh.poly.length > 2 && (inside || b.category === 'nature')) {
      const bb = sh.bbox || { x0: c.x - 3, x1: c.x + 3, z0: c.z - 3, z1: c.z + 3 };
      for (let i = 0; i < 12; i++) { const x = bb.x0 + (bb.x1 - bb.x0) * frac(0.5 + (k + i) * 0.618), z = bb.z0 + (bb.z1 - bb.z0) * frac(0.5 + (k + i) * 0.382); if (inPoly(sh.poly, x, z)) return { x, z }; }
      return { x: c.x, z: c.z };
    }
    if (inside && !b.floating) {
      const f = b.footprint || { w: 4, d: 4 }, u = frac(k * 0.618 + 0.2) - 0.5, v = frac(k * 0.382 + 0.4) - 0.5;
      return { x: c.x + u * f.w * 0.75, z: c.z + v * f.d * 0.75 };
    }
    const R = radiusOf(b) + 0.85;
    let a = k * 2.399963 + (b.id ? String(b.id).length : 0);
    if (toward) { const base = Math.atan2(toward.z - c.z, toward.x - c.x); a = base + ((k % 5) - 2) * 0.36; }
    return B.dry(c.x + Math.cos(a) * R, c.z + Math.sin(a) * R);
  }

  // ---------------- piles (live folk pass only) ----------------
  function addPile(store, what, at, cap = 10) {
    const mk = props.make[what] || props.crate, o = props.liveOnly(mk());
    const n = store.pile.length, gy = groundY(at.x, at.z) || 0;
    const ring = n % 4, lev = Math.floor(n / 4) % 3;
    const ang = (store.k0 || 0) + ring * 1.57;
    o.position.set(at.x + Math.cos(ang) * 0.32, gy + 0.06 + lev * 0.11, at.z + Math.sin(ang) * 0.32);
    o.rotation.y = ang + (what === 'plank' || what === 'log' ? 0.2 : 0.7);
    o.scale.setScalar(1.15);
    scene.add(o); store.pile.push(o);
    while (store.pile.length > cap) { const old = store.pile.shift(); scene.remove(old); }
    return o;
  }
  function clearPile(store, poof = true) {
    store.pile.forEach(o => { if (poof) props.puff(o.position.x, o.position.z, { n: 3, r: 0.1, size: 0.07, speed: 0.6, up: 0.4, life: 0.4, y: o.position.y }); scene.remove(o); });
    store.pile.length = 0;
  }
  function siteOf(b) {
    let s = sites.get(b.id);
    if (!s) { s = { b, pile: [], helpers: new Set(), crew: new Set(), k: 0, k0: Math.random() * 6 }; sites.set(b.id, s); }
    s.b = b; return s;
  }
  function jobOf(b) { let j = jobs.get(b.id); if (!j) { j = { b, pile: [], k: 0, k0: Math.random() * 6 }; jobs.set(b.id, j); } j.b = b; return j; }
  const matsFor = b => {
    const k = String(b.kind || ''), cat = b.category;
    if (cat === 'nature' || FARM.has(k)) return ['sack', 'sack', 'basket'];
    if (/wall|road|tower|temple|fountain|statue|bridge|quarry|well|plaza/.test(k) || cat === 'landmark') return ['stone', 'stone', 'plank', 'crate'];
    if (/fence/.test(k)) return ['plank', 'plank', 'log'];
    return ['plank', 'crate', 'stone', 'plank'];
  };
  const buildStyle = b => (b.category === 'nature' || FARM.has(String(b.kind))) ? 'hoe' : 'hammer';
  const toolOf = style => style === 'chop' ? 'axe' : style === 'pick' ? 'pick' : style === 'hoe' ? 'hoe' : 'mallet';

  // ---------------- roles ----------------
  // the sim's background chatter: strolls, standing about, the camp's foraging / gathering trips (jobs.js)
  const isCamp = t => !!(t && (t.camp || t.phase === 'camp'));
  const isStroll = t => (t.kind === 'walk' && !t.buildingId && !t.carrying && !t.fleetId) || (t.kind === 'idle' && !t.resting && !t.formation && !t.inspect);
  function intercept(rec, task) {
    if (!api.enabled || !isFlier(rec) || rec.temp) return false;
    // the minister walking over to look at a site is not a builder
    if (rec.sim && rec.sim.task && rec.sim.task.phase === 'inspect') { if (rec.role) endRole(rec, false); return false; }
    const helper = rec.role && rec.role.kind === 'build' && !rec.role.crew;
    // the camp (no building yet): foragers at the shore, gatherers at the edges, as a visible loop; a folk helping on a
    // site keeps helping (its camp output stays abstract in the sim)
    if (isCamp(task)) {
      if (helper) return true;
      if (task.kind === 'gather' || task.kind === 'work') {
        if (rec.role && rec.role.kind === 'camp') { if (task.spot) rec.role.at = task.spot; return true; }
        endRole(rec, false); startCamp(rec, task); return true;
      }
    }
    const b = task.buildingId != null ? bOf(task.buildingId) : null;
    const building = b && b.status !== 'done' && b.status !== 'removed';
    if (building && (task.kind === 'walk' || task.kind === 'work' || (task.kind === 'haul' && (task.carrying || 'crate') === 'crate'))) {
      if (rec.role && rec.role.kind === 'build' && rec.role.bid === b.id) { if (!rec.role.crew) { rec.role.crew = true; siteOf(b).helpers.delete(rec); siteOf(b).crew.add(rec); } return true; }
      endRole(rec, false); startBuild(rec, b, { crew: true }); return true;
    }
    if (b && b.status === 'done' && (task.kind === 'work' || task.kind === 'walk')) {
      if (rec.role && rec.role.kind === 'job' && rec.role.bid === b.id) return true;
      endRole(rec, false); startJob(rec, b); return true;
    }
    if (rec.role && isStroll(task)) return true;
    if (rec.role) endRole(rec, false);
    return false;
  }
  function setRole(rec, role) {
    rec.role = role; rec.pose = null; rec.carry = null; rec.tool = null; rec.face = null;
  }
  function endRole(rec, standStill = true) {
    const r = rec.role; if (!r) return;
    rec.role = null; rec.carry = null; rec.pose = null; rec.tool = null; rec.face = null; rec.hover = false;
    if (r.mate && r.mate.role && r.mate.role.mate === rec) r.mate.role.mate = null;
    const s = r.bid != null && sites.get(r.bid); if (s) { s.helpers.delete(rec); s.crew.delete(rec); }
    if (standStill && rec.a) stand(rec);
  }
  function go(rec, p, o = {}) { walkTo(rec, p.x, p.z, { walkMax: 22, ...o }); }

  // a site: crew and helpers share one loop, by sub-role
  function startBuild(rec, b, { crew = false, sub = null } = {}) {
    const s = siteOf(b), k = s.k++;
    (crew ? s.crew : s.helpers).add(rec);
    const mats = matsFor(b);
    sub = sub || (crew ? 'crew' : 'haul');
    setRole(rec, { kind: 'build', bid: b.id, crew, sub, phase: 'start', t: 0, k, mat: mats[k % mats.length], style: buildStyle(b), mate: null, n: 0 });
  }
  function startJob(rec, b, o = {}) {
    const j = jobOf(b), k = j.k++;
    setRole(rec, { kind: 'job', bid: b.id, style: o.style || styleOf(b, rec.sim && rec.sim.trade), phase: 'start', t: 0, k, n: 0 });
  }
  function startCamp(rec, task) {
    const at = task.to || task.spot || { x: rec.a.pos.x, z: rec.a.pos.z };
    setRole(rec, { kind: 'camp', style: task.role === 'forager' ? 'forage' : 'gather', at: { x: at.x, z: at.z }, phase: 'start', t: 0, k: (rec.idn && rec.idn.L.h) % 13 || 0, n: 0 });
  }
  function act(rec, style, { x, z, ms = 0, face = null } = {}) {
    if (!rec || !rec.a) return false;
    endRole(rec, false);
    setRole(rec, { kind: 'act', style, phase: 'start', t: 0, k: 0, n: 0, at: { x, z }, until: ms ? B.now() + ms / 1000 : Infinity, faceAt: face });
    return true;
  }

  // ---------------- per folk ----------------
  function step(rec, dt) {
    const r = rec.role; if (!r || !rec.a || rec.lock || rec.listening) return;
    r.t += dt;
    if (r.kind === 'build') return stepBuild(rec, r, dt);
    if (r.kind === 'job') return stepJob(rec, r, dt);
    if (r.kind === 'post') return stepPost(rec, r, dt);
    if (r.kind === 'act') return stepAct(rec, r, dt);
    if (r.kind === 'camp') return stepCamp(rec, r, dt);
  }
  const phase = (r, p) => { r.phase = p; r.t = 0; };
  function faceTo(rec, p) { rec.face = { x: p.x, z: p.z }; }

  function stepBuild(rec, r, dt) {
    const b = bOf(r.bid);
    if (!b || b.status === 'done' || b.status === 'removed') { endRole(rec); return; }
    const s = siteOf(b), c = centreOf(b), st = stock();
    const needCrates = b.cratesNeeded ? b.cratesDelivered < b.cratesNeeded : false;
    switch (r.phase) {
      case 'start': {
        // crew: haul while the site still wants materials (every other trip), else hammer; helpers by sub-role
        if (r.sub === 'catch' && isFlier(rec) && rec.species === 'flit') { phase(r, 'up'); break; }
        if (r.sub === 'hover') { phase(r, 'orbit'); r.a = r.k * 1.3; break; }
        if (r.sub === 'lift') { r.spot = spot(b, r.k + 3, { toward: st }); go(rec, r.spot, { fly: 'auto' }); phase(r, 'toLift'); break; }
        if (r.sub === 'hammer' || (r.crew && (!needCrates || r.n % 3 !== 2))) { r.spot = spot(b, r.k + Math.floor(r.n / 3) * 3, { inside: r.style === 'hoe' }); go(rec, r.spot); phase(r, 'toWork'); break; }
        r.from = { x: st.x + Math.cos(r.k * 2.1) * 1.1, z: st.z + Math.sin(r.k * 2.1) * 0.9 };
        go(rec, r.from, { walkMax: 6 }); phase(r, 'toStock'); break;
      }
      case 'toStock': if (arrived(rec) || r.t > 30) { phase(r, 'pick'); rec.pose = 'stoop'; faceTo(rec, st); } break;
      case 'pick':
        if (r.t > 0.5) { rec.pose = null; rec.carry = r.mat; r.spot = spot(b, r.k + r.n, { toward: st, inside: r.style === 'hoe' }); go(rec, r.spot, { walkMax: 6 }); phase(r, 'toSite'); }
        break;
      case 'toSite': if (arrived(rec) || r.t > 30) { phase(r, 'drop'); rec.pose = 'stoop'; faceTo(rec, c); } break;
      case 'drop':
        if (r.t > 0.4) {
          rec.pose = null;
          const p = rec.a.pos, f = V(c.x - p.x, 0, c.z - p.z).normalize();
          addPile(s, rec.carry || r.mat, { x: p.x + f.x * 0.55, z: p.z + f.z * 0.55 });
          props.puff(p.x + f.x * 0.55, p.z + f.z * 0.55, { n: 5, r: 0.15, size: 0.08, speed: 0.8, up: 0.4, life: 0.5, y: (groundY(p.x, p.z) || 0) + 0.05 });
          rec.carry = null; r.n++;
          if (r.crew || r.sub === 'hammer') { r.spot = spot(b, r.k + r.n * 3, { inside: r.style === 'hoe' }); go(rec, r.spot); phase(r, 'toWork'); }
          else phase(r, 'start');
        }
        break;
      case 'toWork':
        if (arrived(rec) || r.t > 30) { phase(r, 'work'); r.dur = (r.crew ? 5.5 : 3.5) + (r.k % 3) * 0.7; }
        break;
      case 'work':
        rec.pose = r.style === 'hoe' ? 'hoe' : 'work'; rec.tool = toolOf(r.style); faceTo(rec, c);
        if (r.t > r.dur) { rec.pose = null; rec.tool = null; r.n++; phase(r, 'start'); }
        break;
      // ---- the hand-up: a folk on the ground lifts a plank over its head to a flit hovering above ----
      case 'toLift': if (arrived(rec) || r.t > 30) { phase(r, 'stoop'); } break;
      case 'stoop': rec.pose = 'stoop'; faceTo(rec, c); if (r.t > 0.5) { rec.pose = 'lift'; rec.carry = 'plank'; phase(r, 'hold'); } break;
      case 'hold':
        rec.pose = 'lift'; faceTo(rec, c);
        if ((r.mate && r.mate.role && r.mate.role.phase === 'wait' && r.t > 0.6) || r.t > 3.5) {
          if (r.mate && r.mate.role && r.mate.role.phase === 'wait') { r.mate.carry = 'plank'; phase(r.mate.role, 'place'); }
          rec.carry = null; rec.pose = null; phase(r, 'rest');
        }
        break;
      case 'rest': if (r.t > 0.7) phase(r, 'stoop'); break;
      case 'up': {   // the catcher: hover just over the lifter (or over the site edge if it has none yet)
        const m = r.mate && r.mate.role ? r.mate.role.spot : null, p = m || spot(b, r.k, { toward: st });
        const tx = p.x + (c.x - p.x) * 0.12, tz = p.z + (c.z - p.z) * 0.12;
        walkTo(rec, tx, tz, { fly: true, land: false, y: 1.95 });
        phase(r, 'upGo'); r.tx = tx; r.tz = tz; break;
      }
      case 'upGo': if (arrived(rec, 0.6) || r.t > 12) { phase(r, 'wait'); } break;
      case 'wait': rec.pose = 'reach'; faceTo(rec, r.mate && r.mate.a ? r.mate.a.pos : c); if (!r.mate && r.t > 2) { r.sub = 'hover'; phase(r, 'orbit'); } break;
      case 'place':
        if (r.t < 0.05) walkTo(rec, c.x + Math.cos(r.k) * 0.6, c.z + Math.sin(r.k) * 0.6, { fly: true, land: false, y: 2.3 });
        rec.pose = null;
        if ((r.t > 0.3 && arrived(rec, 0.7)) || r.t > 6) {
          const p = rec.a.pos; props.puff(p.x, p.z, { n: 6, r: 0.18, size: 0.09, speed: 0.9, up: 0.2, life: 0.55, y: Math.max(0.3, p.y - 0.7) });
          rec.carry = null; r.n++; phase(r, 'up');
        }
        break;
      // ---- helpers flapping round the scaffold ----
      case 'orbit': {
        const R = radiusOf(b) + 0.4, y = rec.species === 'flit' ? 2.1 + (r.k % 3) * 0.35 : 3.0 + (r.k % 2) * 0.4;
        r.a = (r.a || 0) + 1.15;
        walkTo(rec, c.x + Math.cos(r.a) * R, c.z + Math.sin(r.a) * R, { fly: true, land: false, y });
        phase(r, 'orbitGo'); break;
      }
      case 'orbitGo': if (arrived(rec, 0.7) || r.t > 8) phase(r, 'peer'); break;
      case 'peer': rec.pose = 'reach'; faceTo(rec, c); if (r.t > 0.9 + (r.k % 3) * 0.3) { rec.pose = null; phase(r, 'orbit'); } break;
    }
  }

  // a finished workplace: production you can see
  function stepJob(rec, r, dt) {
    const b = bOf(r.bid);
    if (!b || b.status === 'removed') { endRole(rec); return; }
    const j = jobOf(b), c = centreOf(b), front = () => spot(b, r.k * 2 + 1, { toward: S.centre || c });
    switch (r.phase) {
      case 'start':
        if (r.style === 'hoe') { r.spot = spot(b, r.k * 5 + r.n, { inside: true }); go(rec, r.spot); phase(r, 'toWork'); break; }
        r.spot = r.style === 'sell' ? spot(b, r.k * 2 + (r.n % 3), { toward: S.centre || c }) : front();
        go(rec, r.spot); phase(r, 'toWork'); break;
      case 'toWork': if (arrived(rec) || r.t > 30) { phase(r, 'work'); r.dur = r.style === 'hoe' ? 3.2 : r.style === 'sell' ? 4.5 : 3.4; } break;
      case 'work': {
        const tool = toolOf(r.style);
        rec.pose = r.style === 'hoe' ? 'hoe' : r.style === 'bake' ? 'knead' : r.style === 'sell' ? 'sell' : r.style === 'dock' ? 'stoop' : 'work';
        rec.tool = rec.pose === 'work' || rec.pose === 'hoe' ? tool : null;
        if (r.style === 'sell') rec.carry = 'basket';
        if (r.style === 'hoe') faceTo(rec, { x: rec.a.pos.x + Math.cos(r.k) * 3, z: rec.a.pos.z + Math.sin(r.k) * 3 }); else faceTo(rec, c);
        if (r.t > r.dur || (r.style === 'dock' && r.t > 0.5)) {
          rec.pose = null; rec.tool = null; r.n++;
          const goods = { bake: 'loaves', chop: 'log', pick: 'stone', dock: 'crate', hammer: r.n % 2 ? 'crate' : null }[r.style];
          if (goods) { rec.carry = goods; r.goods = goods; r.spot2 = spot(b, r.k * 2 + 7 + (r.n % 2), { toward: stock() }); go(rec, r.spot2); phase(r, 'carry'); }
          else if (r.style === 'sell') { rec.carry = null; phase(r, 'start'); }
          else {   // a farmer moves on along the row
            const p = rec.a.pos, d = 1.3, a = r.k * 0.9;
            let nx = p.x + Math.cos(a) * d * (r.n % 6 < 3 ? 1 : -1), nz = p.z + Math.sin(a) * d * (r.n % 6 < 3 ? 1 : -1);
            const inside = spot(b, r.k * 5 + r.n, { inside: true });
            if (b.shape && b.shape.poly && !inPoly(b.shape.poly, nx, nz)) { nx = inside.x; nz = inside.z; }
            r.spot = { x: nx, z: nz }; go(rec, r.spot); phase(r, 'toWork');
          }
        }
        break;
      }
      case 'carry': if (arrived(rec) || r.t > 20) { phase(r, 'set'); rec.pose = 'stoop'; } break;
      case 'set':
        if (r.t > 0.4) {
          rec.pose = null; const p = rec.a.pos;
          addPile(j, r.goods, { x: p.x + Math.sin(rec.a.heading) * 0.5, z: p.z + Math.cos(rec.a.heading) * 0.5 }, 6);
          rec.carry = null; phase(r, 'start');
        }
        break;
    }
  }

  // post rounds: an idle courier flies an envelope to a house (or a neighbour) and hands it over
  function stepPost(rec, r, dt) {
    switch (r.phase) {
      case 'start': {
        const done = (S.buildings || []).filter(b => b.status === 'done');
        const folk = [...recs.values()].filter(o => o !== rec && o.a && o.state === 'live' && B.down(o));
        let to = null;
        if (done.length && (r.n % 2 === 0 || !folk.length)) to = spot(done[(r.k + r.n) % done.length], r.n + 2, { toward: S.centre });
        else if (folk.length) { const o = folk[(r.k * 7 + r.n * 3) % folk.length].a.pos; to = { x: o.x + 0.9, z: o.z + 0.6 }; }
        if (!to) { endRole(rec); return; }
        rec.carry = 'letter'; walkTo(rec, to.x, to.z, { fly: true }); phase(r, 'fly'); break;
      }
      case 'fly': if (arrived(rec) || r.t > 25) { phase(r, 'hand'); rec.pose = 'present'; } break;
      case 'hand':
        rec.pose = 'present';
        if (r.t > 1.4) { rec.pose = null; rec.carry = null; B.hop(rec, 0.18); r.n++; phase(r, 'pause'); }
        break;
      case 'pause': if (r.t > 2.5) { if (r.n >= 3) endRole(rec); else phase(r, 'start'); } break;
    }
  }
  // the camp: a forager stoops for shellfish and herbs along the shore, a gatherer chops driftwood and picks up stones
  function stepCamp(rec, r) {
    switch (r.phase) {
      case 'start': go(rec, { x: r.at.x + Math.cos(r.n * 1.9 + r.k) * 0.5 * (r.n % 3), z: r.at.z + Math.sin(r.n * 1.9 + r.k) * 0.5 * (r.n % 3) }, { walkMax: 10 }); phase(r, 'toWork'); break;
      case 'toWork': if (arrived(rec) || r.t > 30) { phase(r, 'work'); r.dur = r.style === 'forage' ? 0.75 : (r.n % 2 ? 1.0 : 2.6); } break;
      case 'work':
        if (r.style === 'forage') { rec.pose = 'stoop'; rec.tool = null; if (rec.species === 'floatie') rec.carry = 'basket'; }
        else if (r.n % 2) { rec.pose = 'stoop'; rec.tool = null; }
        else { rec.pose = 'work'; rec.tool = 'axe'; }
        if (r.t > r.dur) {
          if (rec.pose === 'stoop') { const p = rec.a.pos; props.puff(p.x + Math.sin(rec.a.heading) * 0.4, p.z + Math.cos(rec.a.heading) * 0.4, { n: 3, r: 0.1, size: 0.05, speed: 0.5, up: 0.3, life: 0.4, y: (groundY(p.x, p.z) || 0) + 0.04 }); }
          rec.pose = null; rec.tool = null; r.n++; phase(r, r.style === 'forage' && r.n % 2 ? 'look' : 'start');
        }
        break;
      case 'look': if (r.t > 0.45) phase(r, 'start'); break;
    }
  }
  function stepAct(rec, r) {
    if (B.now() > r.until) { endRole(rec); return; }
    switch (r.phase) {
      case 'start': if (r.at && r.at.x != null) go(rec, r.at); phase(r, 'toWork'); break;
      case 'toWork': if (arrived(rec) || r.t > 30) phase(r, 'work'); break;
      case 'work': {
        const s = r.style;
        rec.pose = s === 'hoe' ? 'hoe' : s === 'bake' || s === 'knead' ? 'knead' : s === 'sell' ? 'sell' : s === 'lift' ? 'lift' : s === 'think' ? 'meeting' : 'work';
        rec.tool = rec.pose === 'work' || rec.pose === 'hoe' ? toolOf(s) : null;
        if (s === 'sell') rec.carry = 'basket'; if (s === 'lift') rec.carry = 'plank';
        if (r.faceAt) faceTo(rec, r.faceAt); else if (rec.pose === 'meeting') rec.face = 'camera';
        break;
      }
    }
  }

  // ---------------- the crowd: helpers for sites, post rounds for idle couriers ----------------
  function free(rec) {
    const sim = rec.sim;
    if (rec.state !== 'live' || !rec.a || rec.temp || !isFlier(rec) || rec.lock || rec.flow || rec.listening || rec.role || rec.fleet || rec.pose === 'strike' || rec.talkUntil > B.now()) return false;
    if (!sim || ['striking', 'resting', 'left', 'delivering', 'meeting'].includes(sim.status) || sim.jobId || sim.id === S.minister) return false;
    const t = sim.task;
    if (t && (t.kind === 'stand' || t.phase === 'formation' || t.phase === 'inspect' || t.fleetId)) return false;
    return !t || t.kind === 'idle' || isCamp(t) || (t.kind === 'walk' && (t.phase === 'wander' || t.phase === 'back'));
  }
  // free folk can be on a role already only when it is the camp's (they leave it to help a site)
  const freeOrCamp = rec => (rec.role && rec.role.kind === 'camp') ? (() => { const r = rec.role; rec.role = null; const ok = free(rec); rec.role = r; return ok; })() : free(rec);
  const campCost = rec => (rec.role && rec.role.kind === 'camp') || isCamp(rec.sim && rec.sim.task) ? 6 : 0;
  function update(dt) {
    if (!api.enabled) return;
    clock -= dt; postClock -= dt;
    // sites that ended: release everyone, piles poof away (building:done also calls release)
    for (const [id, s] of sites) { const b = bOf(id); if (!b || b.status === 'done' || b.status === 'removed') release(id); }
    for (const [id, j] of jobs) { const b = bOf(id); if (!b || b.status === 'removed') { clearPile(j, false); jobs.delete(id); } }
    if (clock > 0) return;
    clock = 0.8;
    if (api.helpers) {
      const active = (S.buildings || []).filter(b => b.status !== 'done' && b.status !== 'removed' && b.status !== 'awaiting_design' && !b.removed);
      for (const b of active) {
        const s = siteOf(b), want = WANT[b.category] || WANT.building;
        const busy = [...s.helpers].filter(r => r.role && r.role.bid === b.id).length;
        if (busy >= want) continue;
        const c = centreOf(b);
        const cands = [...recs.values()].filter(freeOrCamp).sort((p, q) => (Math.hypot(p.a.pos.x - c.x, p.a.pos.z - c.z) + campCost(p)) - (Math.hypot(q.a.pos.x - c.x, q.a.pos.z - c.z) + campCost(q)));
        const taken = new Set();
        for (let q = 0; q < Math.min(3, want - busy); q++) {
          // the mix of a busy site: a hauler, then a hand-up pair (a flit catches), a flapper round the scaffold, more haulers
          const n = s.helpers.size, plan = ['haul', 'lift', 'catch', 'haul', 'hover', 'haul', 'hammer', 'hover'];
          let sub = plan[n % plan.length];
          if (buildStyle(b) === 'hoe' && (sub === 'lift' || sub === 'catch')) sub = 'haul';
          const pool = cands.filter(r => !taken.has(r));
          // flits are the quick haulers and the catchers; floaties lift and drift round the scaffold
          const prefer = sp => pool.find(r => r.species === sp) || pool[0];
          let rec = sub === 'catch' ? pool.find(r => r.species === 'flit') : sub === 'lift' || sub === 'hover' ? prefer('floatie') : prefer('flit');
          if (!rec && sub === 'catch') { sub = 'hover'; rec = pool[0]; }
          if (!rec) break;
          taken.add(rec);
          if (rec.role) endRole(rec, false);
          startBuild(rec, b, { crew: false, sub });
          if (sub === 'catch' || sub === 'lift') {   // pair them up
            const other = [...s.helpers].find(o => o !== rec && o.role && !o.role.mate && o.role.sub === (sub === 'catch' ? 'lift' : 'catch'));
            if (other) { rec.role.mate = other; other.role.mate = rec; }
          }
        }
      }
    }
    if (api.post && postClock <= 0) {
      postClock = 6;
      for (const rec of recs.values()) {
        if (!freeOrCamp(rec) || !POST_TRADES.has(String(rec.sim && rec.sim.trade)) || rec.id === S.minister) continue;
        if (rec.role ? Math.random() > 0.35 : (rec.idleT || 0) < 4) continue;
        if (rec.role) endRole(rec, false);
        setRole(rec, { kind: 'post', phase: 'start', t: 0, k: (rec.idn && rec.idn.L.h) % 97 || 0, n: 0 });
      }
    }
  }
  function release(buildingId) {
    const s = sites.get(buildingId); if (!s) return;
    [...s.crew, ...s.helpers].forEach(r => { if (r.role && r.role.bid === buildingId) endRole(r); });
    clearPile(s); sites.delete(buildingId);
  }
  function dispose() { for (const s of sites.values()) clearPile(s, false); for (const j of jobs.values()) clearPile(j, false); sites.clear(); jobs.clear(); }
  function stats() {
    const out = {};
    for (const r of recs.values()) { if (!r.role) continue; const k = r.role.kind + ':' + (r.role.sub || r.role.style || ''); out[k] = (out[k] || 0) + 1; }
    return out;
  }
  return Object.assign(api, { intercept, step, update, endRole, release, act, startBuild, startJob, startCamp, sites, jobs, stats, styleOf, isStroll, isCamp });
}

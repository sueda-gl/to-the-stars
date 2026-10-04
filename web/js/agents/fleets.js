// Arrival in fleets, introductions, the minister's election (ART_DIRECTION §11):
//   - formFleets: our folk fly / walk into neat SQUARE formations (one per fleet, e.g. by trade), facing the camera,
//     and stand there (lock 'fleet': sim tasks wait) until releaseFleets(). Called before the settlers land, they
//     glide straight into their squares.
//   - introduceFleet: a calm roll-call: each member in turn steps forward toward you, hops and waves (a flit
//     twirls its propeller, a floatie waves its free hand), and steps back.
//   - ceremony: the chosen folk floats up, bows (deep, then small), floats back down to its place; everyone else
//     cheer-hops and turns to look at it. It wears the minister's red seal from then on. Confetti-free.
// The camera is the game's: fleetInfo(id) gives each square's centre and radius to frame it.
//   const fl = createFleets(B)
//   fl.form(fleets, opts) -> layout · fl.introduce(id, opts) -> Promise · fl.ceremony(agentId) -> Promise
//   fl.release(ids?) · fl.info(id) · fl.ready(id?) · fl.byTrade() · fl.caption(fleet) · fl.step(rec, dt) · fl.update(dt)

const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
const num = n => WORD[n] || String(n);
const ease = u => u * u * (3 - 2 * u);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// fleets by trade: the kits of identity.js, grouped as ART_DIRECTION §11 lists them
const GROUPS = [
  { id: 'builders', name: 'The Builders', kits: ['builder', 'crafter'] },
  { id: 'farmers', name: 'The Farmers', kits: ['farmer'] },
  { id: 'bakers', name: 'The Bakers', kits: ['baker'] },
  { id: 'couriers', name: 'The Scouts & Couriers', kits: ['courier', 'trader'] },
  { id: 'envoys', name: 'The Diplomats & Scholars', kits: ['diplomat', 'scholar', 'none'] }
];

export function createFleets(B) {
  const { S, recs, V, camera, isFlier, walkTo, arrived, hop } = B;
  const fleets = new Map();
  const planned = new Map();   // agent id -> slot, for settlers not spawned yet
  const intros = new Map();   // fleet id -> a running roll-call (the sim's run back to back, they may overlap)
  let cer = null;
  function adopt(rec) { const p = planned.get(rec.id); if (p && fleets.has(p.id)) { rec.fleet = p; planned.delete(rec.id); } }

  function axes() {
    const fwd = V(0, 0, 0); camera.getWorldDirection(fwd); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    return { fwd, right: V(-fwd.z, 0, fwd.x) };
  }
  // from the sim's settlers, so it works before they have landed (or even spawned)
  function byTrade() {
    const live = (S.agents || []).filter(a => a.status !== 'left' && (!recs.get(a.id) || (recs.get(a.id).state !== 'gone' && !recs.get(a.id).temp)));
    const out = GROUPS.map(g => ({ id: g.id, name: g.name, kits: g.kits, members: [] }));
    live.forEach(a => {
      const kit = B.kitOf(a.trade);
      (out.find(g => g.kits.includes(kit)) || out[out.length - 1]).members.push(a.id);
    });
    return out.filter(g => g.members.length).map(({ id, name, members }) => ({ id, name, members }));
  }
  function caption(f) {
    const sp = id => { const r = recs.get(id); if (r) return r.species; const a = (S.agents || []).find(x => x.id === id); return a && a.species; };
    const ms = (f.members || []).map(sp).filter(Boolean);
    // every kind in the square, in order of appearance ("nine twinkles", "four flits, two floaties")
    const PL = { flit: 'flits', floatie: 'floaties', loaf: 'loaves', twinkle: 'twinkles', glim: 'glims', moth: 'moths' };
    const n = new Map(); ms.forEach(s => n.set(s, (n.get(s) || 0) + 1));
    const parts = [...n].map(([s, c]) => `${num(c)} ${c === 1 ? s : PL[s] || s + 's'}`);
    return `${f.name || f.id} · ${parts.join(', ') || 'nobody yet'}`;
  }

  // ---------------- forming up ----------------
  // the sim's own squares (fleet:form carries slots [{ agentId, x, z }]): take them as they are
  function formGiven(list) {
    const { fwd, right } = axes();
    return list.map(f => {
      const slots = new Map();
      const pts = f.slots.map(s => ({ id: s.agentId, x: s.x, z: s.z }));
      const cx = f.centre ? f.centre.x : pts.reduce((a, p) => a + p.x / pts.length, 0), cz = f.centre ? f.centre.z : pts.reduce((a, p) => a + p.z / pts.length, 0);
      // rows and columns as the camera sees them (front row = nearest the lens), for the roll-call order
      pts.forEach(p => { const dx = p.x - cx, dz = p.z - cz; slots.set(p.id, { x: p.x, z: p.z, row: Math.round((dx * fwd.x + dz * fwd.z) / 1.6), col: Math.round((dx * right.x + dz * right.z) / 1.6) }); });
      const radius = Math.max(0, ...pts.map(p => Math.hypot(p.x - cx, p.z - cz))) + 1.2;
      const fleet = { id: f.id, name: f.name || f.id, members: (f.members || pts.map(p => p.id)).slice(), slots, centre: { x: cx, y: B.groundY(cx, cz) || 0, z: cz }, radius };
      return place(fleet, f.caption);
    });
  }
  function place(fleet, cap = null) {
    fleets.set(fleet.id, fleet);
    fleet.members.forEach(id => {
      const sl = fleet.slots.get(id); if (!sl) return;
      const plan = { id: fleet.id, x: sl.x, z: sl.z, going: false, ready: false };
      const rec = recs.get(id);
      if (!rec) { planned.set(id, plan); return; }   // not spawned yet: it takes its slot when it does (adopt)
      if (B.endRole) B.endRole(rec, false);
      if (rec.fleet && rec.fleet.id === fleet.id && rec.fleet.going && Math.hypot(rec.fleet.x - sl.x, rec.fleet.z - sl.z) < 0.2) return;
      rec.fleet = plan;
    });
    return { id: fleet.id, name: fleet.name, caption: cap || caption(fleet), centre: { ...fleet.centre }, radius: fleet.radius, members: fleet.members.map(id => ({ id, ...fleet.slots.get(id) })) };
  }
  function form(list, { centre = null, spacing = 1.9, gap = 3.2, perRow = 3 } = {}) {
    if (list.length && list.every(f => Array.isArray(f.slots) && f.slots.length)) return formGiven(list);
    const { fwd, right } = axes();
    const c = centre || S.centre || B.frontPoint(0, 0);
    const shapes = list.map(f => { const n = f.members.length, cols = Math.max(1, Math.ceil(Math.sqrt(n))), rows = Math.max(1, Math.ceil(n / cols)); return { f, n, cols, rows, w: (cols - 1) * spacing, d: (rows - 1) * spacing }; });
    const nRows = Math.ceil(shapes.length / perRow);
    const rowDepth = r => Math.max(0, ...shapes.slice(r * perRow, r * perRow + perRow).map(s => s.d));
    const depths = [...Array(nRows)].map((_, r) => rowDepth(r));
    const totalD = depths.reduce((a, d) => a + d, 0) + gap * (nRows - 1);
    const out = [];
    let z = -totalD / 2;
    for (let r = 0; r < nRows; r++) {
      const row = shapes.slice(r * perRow, r * perRow + perRow);
      const totalW = row.reduce((a, s) => a + s.w, 0) + gap * (row.length - 1);
      let x = -totalW / 2;
      const zc = z + depths[r] / 2;
      for (const s of row) {
        const fc = V(c.x, 0, c.z).addScaledVector(right, x + s.w / 2).addScaledVector(fwd, zc);
        const slots = new Map();
        s.f.members.forEach((id, i) => {
          const col = i % s.cols, rw = Math.floor(i / s.cols), inRow = Math.min(s.cols, s.n - rw * s.cols);
          const p = fc.clone().addScaledVector(right, (col - (inRow - 1) / 2) * spacing).addScaledVector(fwd, (rw - (s.rows - 1) / 2) * spacing);
          const d = B.dry(p.x, p.z); slots.set(id, { x: d.x, z: d.z, row: rw, col });
        });
        const fleet = { id: s.f.id, name: s.f.name || s.f.id, members: s.f.members.slice(), slots, centre: { x: fc.x, y: 0, z: fc.z }, radius: Math.hypot(s.w, s.d) / 2 + 1.2 };
        fleet.centre.y = B.groundY(fc.x, fc.z) || 0;
        out.push(place(fleet));
        x += s.w + gap;
      }
      z += depths[r] + gap;
    }
    return out;
  }
  function step(rec, dt) {
    const f = rec.fleet; if (!f || rec.state !== 'live' || !rec.a) return;
    if (!f.going) {
      if ((rec.lock && rec.lock !== 'fleet') || rec.flow || rec.anim) return;   // landing, a letter run...: join after
      rec.lock = 'fleet'; rec.pose = null; rec.carry = null; rec.tool = null; rec.face = null;
      walkTo(rec, f.x, f.z, { walkMax: 5 }); f.going = true; f.t = 0; return;
    }
    f.t += dt;
    if (!f.ready && (arrived(rec, 0.5) || f.t > 40)) { f.ready = true; rec.face = 'camera'; B.stand(rec); }
  }
  function ready(id = null) {
    const list = id ? [fleets.get(id)].filter(Boolean) : [...fleets.values()];
    const gone = m => { const a = (S.agents || []).find(x => x.id === m); return !a || a.status === 'left'; };
    return list.length > 0 && list.every(f => f.members.every(m => { const r = recs.get(m); return r ? (r.state !== 'live' && r.state !== 'queued') || (r.fleet && r.fleet.ready) : gone(m); }));
  }
  function info(id) {
    const f = fleets.get(id); if (!f) return null;
    return { id: f.id, name: f.name, caption: caption(f), centre: { ...f.centre }, radius: f.radius, members: f.members.slice(), ready: ready(id) };
  }
  function release(ids = null) {
    const list = ids ? [].concat(ids).map(i => fleets.get(i)).filter(Boolean) : [...fleets.values()];
    list.forEach(f => {
      f.members.forEach(id => {
        const rec = recs.get(id); if (!rec) return;
        rec.fleet = null; if (rec.lock === 'fleet') rec.lock = null;
        rec.face = null; B.flush(rec);
      });
      f.members.forEach(id => planned.delete(id));
      fleets.delete(f.id);
    });
    for (const [id, I] of intros) if (!fleets.has(id)) { I.resolve(false); intros.delete(id); }
  }

  // ---------------- introductions ----------------
  function introduce(id, { each = 0.62, forward = 0.8 } = {}) {
    const f = fleets.get(id);
    if (!f) return Promise.resolve(false);
    if (intros.has(id)) intros.get(id).resolve(false);
    // front row first, left to right as you see it
    const list = f.members.map(m => recs.get(m)).filter(r => r && r.a)
      .sort((a, b) => { const sa = f.slots.get(a.id), sb = f.slots.get(b.id); return (sa.row - sb.row) || (sa.col - sb.col); });
    return new Promise(resolve => {
      intros.set(id, { id, t: 0, each, forward, resolve, list: list.map((rec, i) => ({ rec, at: 0.3 + i * each, phase: 'wait', t: 0 })) });
    });
  }
  function stepIntros(dt) { for (const I of [...intros.values()]) stepIntro(I, dt); }
  function stepIntro(I, dt) {
    I.t += dt;
    let done = true;
    for (const m of I.list) {
      const rec = m.rec, sl = rec.fleet;
      if (!rec.a || rec.state !== 'live') continue;
      m.t += dt;
      if (m.phase === 'wait') { done = false; if (I.t >= m.at) { m.phase = 'fwd'; m.t = 0;
        const p = sl || { x: rec.a.pos.x, z: rec.a.pos.z }, cam = camera.position, d = Math.hypot(cam.x - p.x, cam.z - p.z) || 1;
        walkTo(rec, p.x + (cam.x - p.x) / d * I.forward, p.z + (cam.z - p.z) / d * I.forward, { fly: false, walkMax: 3, speed: 1.1 }); } }
      else if (m.phase === 'fwd') { done = false; if (arrived(rec, 0.4) || m.t > 1.6) { m.phase = 'wave'; m.t = 0; wave(rec); } }
      else if (m.phase === 'wave') { done = false; rec.face = 'camera'; if (m.t > 1.25) { m.phase = 'back'; m.t = 0; rec.face = null; if (sl) walkTo(rec, sl.x, sl.z, { fly: false, walkMax: 3, speed: 1.1 }); } }
      else if (m.phase === 'back') { if (!(arrived(rec, 0.4) || m.t > 1.8)) done = false; else if (m.phase !== 'home') { m.phase = 'home'; rec.face = 'camera'; } }
    }
    if (done) { intros.delete(I.id); I.resolve(true); }
  }
  function wave(rec) {
    hop(rec, 0.2);
    rec.waveT = 1.3;
    if (rec.mv) { if (rec.species === 'flit') rec.mv.twirl = 0.9; else rec.mv.waveT = 1.6; }
  }

  // ---------------- the minister's ceremony ----------------
  function ceremony(agentId, { cheer = true } = {}) {
    const rec = recs.get(agentId);
    if (!rec || !rec.a || rec.state !== 'live') return Promise.resolve(false);
    if (cer) finishCeremony();
    const p = rec.fleet ? { x: rec.fleet.x, z: rec.fleet.z } : { x: rec.a.pos.x, z: rec.a.pos.z };
    B.setMinister(agentId);
    const prev = rec.lock === 'fleet' ? 'fleet' : null;
    rec.lock = 'ceremony'; rec.pose = null; rec.carry = null; rec.tool = null; rec.hi = true;   // the paper ring marks the chosen one
    const y = rec.species === 'flit' ? 2.05 : 3.15;
    if (isFlier(rec)) walkTo(rec, p.x, p.z, { fly: true, land: false, y });
    const others = [...recs.values()].filter(r => r !== rec && r.state === 'live' && r.a && !r.temp)
      .sort((a, b) => Math.hypot(a.a.pos.x - p.x, a.a.pos.z - p.z) - Math.hypot(b.a.pos.x - p.x, b.a.pos.z - p.z));
    return new Promise(resolve => {
      cer = { rec, p, t: 0, prev, resolve, down: false, others: cheer ? others.map((r, i) => ({ r, at: [0.9, 1.45, 2.0].map(t => t + i * 0.07), k: 0 })) : [] };
      cer.others.forEach(o => { o.r.faceAt = p; o.r.faceUntil = B.now() + 6.5; });
    });
  }
  function bowCurve(t) {
    if (t < 1.7) return 0;
    if (t < 2.3) return ease((t - 1.7) / 0.6);
    if (t < 2.9) return 1 - ease((t - 2.3) / 0.6);
    if (t < 3.3) return 0.5 * ease((t - 2.9) / 0.4);
    if (t < 3.7) return 0.5 * (1 - ease((t - 3.3) / 0.4));
    return 0;
  }
  function stepCeremony(dt) {
    const C = cer; if (!C) return;
    C.t += dt;
    const rec = C.rec;
    if (!rec.a || rec.state !== 'live') { finishCeremony(); return; }
    rec.bow = bowCurve(C.t);
    rec.face = 'camera';
    C.others.forEach(o => {
      while (o.k < o.at.length && C.t >= o.at[o.k]) {
        o.k++; hop(o.r, 0.24);
        if (o.r.mv && o.r.species === 'floatie' && o.k === 1) o.r.mv.waveT = 1.6;
        if (o.r.species === 'flit') o.r.cheerT = 0.5;
      }
    });
    if (!C.down && C.t > 4.4) { C.down = true; walkTo(rec, C.p.x, C.p.z, { fly: true }); }
    if (C.down && ((C.t > 5 && arrived(rec, 0.5)) || C.t > 14)) finishCeremony();
  }
  function finishCeremony() {
    const C = cer; if (!C) return;
    cer = null;
    const rec = C.rec;
    rec.bow = 0; rec.hi = false;
    // back to its square, unless the squares broke up meanwhile (the sim releases them when its ceremony ends)
    const still = C.prev === 'fleet' && rec.fleet;
    if (rec.lock === 'ceremony') rec.lock = still ? 'fleet' : null;
    rec.face = still ? 'camera' : null;
    if (!rec.lock) B.flush(rec);
    hop(rec, 0.16);
    C.resolve(true);
  }
  function update(dt) { stepIntros(dt); stepCeremony(dt); }
  return { form, step, adopt, update, release, introduce, ceremony, info, ready, byTrade, caption, fleets, get intros() { return intros; }, get busy() { return !!(intros.size || cer); } };
}

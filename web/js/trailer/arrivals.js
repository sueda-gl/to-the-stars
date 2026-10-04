// t1 reception: the townsfolk arrive in SQUARES OF NINE (Sueda, 2026-10-04: "square batches of 3x3 in the first scene
// with distinctive accessories"). Five companies, one species each, every member in its species' uniform
// (agents/species-extra.js via identity.js): loaves hop, twinkles waddle on their points, glims march on plum legs,
// moths glide; and (Sueda: "some plain umbrella types too as in the beginning") a square of her plain floaties, the
// reference's own parasols and bathing suits with no uniform, drifting in low under their parasols. The moths (the
// flappy ones) stand next to the loaves (the blue ones). They come through the arch in two columns (one up each side of the pool), wheel in along the far
// terrace and halt in a row of squares in front of the sea, in step, then face the pad. At ignition they startle;
// after lift-off they cheer in waves, row by row (front, middle, back), the way an organised town would.
// Pure functions of the shot time t (shot.js fixed clock): any t renders the same frame.
//
//   const arr = createArrivals(ctx, folk, identity, { T, PAD, poser })   // after the twelve fliers (keeps their rnd)
//   arr.pose(t, rocketY)                                                  // every frame, after the camera is placed
import { extendFolk, strideOf, hopGait } from '../agents/species-extra.js';
import { clamp, lerp, smooth, smoother, span, hash1 } from './shot.js';
import { applyColourRule } from '../agents/colour-rule.js';

// left to right as the camera sees them; lane = which side of the pool the column comes up; gap = spacing in the
// square (twinkle arms and floatie parasols need more); plain = her reference folk exactly, no uniform
export const COMPANIES = [
  { sp: 'twinkle', lane: -1, gap: 0.86, w: 0.88, arrive: 8.2, name: 'The Twinkles', trade: 'scholar' },
  { sp: 'glim', lane: -1, gap: 0.8, w: 0.6, arrive: 7.75, name: 'The Glims', trade: 'crafter' },
  { sp: 'loaf', lane: -1, gap: 0.8, w: 0.66, arrive: 7.3, name: 'The Loaves', trade: 'baker' },
  { sp: 'moth', lane: 1, gap: 0.82, w: 0.85, arrive: 7.4, name: 'The Moths', trade: 'courier' },
  { sp: 'floatie', lane: 1, gap: 0.96, w: 0.92, arrive: 7.75, name: 'The Floaties', trade: 'none', plain: true, sc: 0.76 }
];
// the row: centred where the hold camera looks (x ~ .6), `SEP` between squares
const ROW_C = 0.5, SEP = 0.16;
{ const ws = COMPANIES.map(c => 2 * c.gap + c.w), tot = ws.reduce((a, w) => a + w, 0) + SEP * (ws.length - 1); let x = ROW_C - tot / 2;
  COMPANIES.forEach((c, i) => { c.cx = +(x + ws[i] / 2).toFixed(3); x += ws[i] + SEP; }); }
const NAMES = {
  twinkle: ['Stella', 'Lumi', 'Pico', 'Astra', 'Nova', 'Sprig', 'Tinsel', 'Dot', 'Comet'],
  loaf: ['Brioche', 'Crumb', 'Panko', 'Rye', 'Bap', 'Focaccia', 'Bun', 'Pita', 'Scone'],
  glim: ['Wick', 'Ember', 'Paper', 'Glow', 'Lantie', 'Flick', 'Tallow', 'Shade', 'Spark'],
  moth: ['Dusk', 'Velvet', 'Puff', 'Powder', 'Luna', 'Flutter', 'Mote', 'Silk', 'Wisp'],
  floatie: ['Brezza', 'Ombra', 'Mare', 'Sabbia', 'Onda', 'Riva', 'Perla', 'Conchiglia', 'Spuma']
};
const ZC = -12.85, LANE_X = 5.15, SPEED = 1.45, DECEL = 1.1;

export function createArrivals(ctx, folk, identity, { T, PAD, poser }) {
  const { V } = ctx;
  const extra = extendFolk(ctx, folk);
  // each company's route: up its side terrace (x = lane * 5.15), round onto the far terrace, along to its place
  const companies = COMPANIES.map((c, k) => {
    const pts = [[c.lane * LANE_X, 9], [c.lane * LANE_X, ZC], [c.cx, ZC]];
    const segs = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az); segs.push({ ax, az, bx, bz, l, L0: L }); L += l; }
    // in motion from the first frame at SPEED, a soft halt over the last DECEL units, arriving at c.arrive
    const t1 = c.arrive - 2 * DECEL / SPEED, s0 = L - DECEL - SPEED * t1;
    const members = [];
    for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
      const i = r * 3 + col, a = folk.make[c.sp](k * 9 + i);
      a.controlled = true; a.driven = true; if (a.path) a.path = []; a.wait = 1e6;
      a.sc *= c.sc || 0.88; a.root.scale.setScalar(a.sc);   // a touch smaller than the fliers: nine to a square on the far terrace
      const rec = { a, species: c.sp, id: `t1-${c.sp}-${i}`, sim: { id: `t1-${c.sp}-${i}`, name: NAMES[c.sp][i], trade: c.trade }, i, r, col };
      if (c.plain) applyColourRule(rec, folk);   // her floaties as they are (only §13: no yellow next to a teal parasol)
      else try { identity.dress(rec); } catch (e) { console.warn('[t1 arrivals] dress', c.sp, e); }
      members.push(rec);
    }
    return { ...c, k, segs, L, t1, s0, members };
  });
  const at = (C, s) => {   // point + direction along the route at distance s
    s = clamp(s, 0, C.L);
    const g = C.segs.find(g => s <= g.L0 + g.l + 1e-6) || C.segs[C.segs.length - 1], u = (s - g.L0) / g.l;
    return { x: lerp(g.ax, g.bx, u), z: lerp(g.az, g.bz, u), dx: (g.bx - g.ax) / g.l, dz: (g.bz - g.az) / g.l };
  };
  const dist = (C, t) => t <= C.t1 ? C.s0 + SPEED * t : C.L - DECEL * Math.pow(1 - span(t, C.t1, C.arrive), 2);

  function pose(t, rocketY = 0) {
    for (const C of companies) {
      const s = dist(C, t), p = at(C, s);
      // heading: the march direction, eased through the corner (average of a little behind and ahead)
      const b = at(C, s - 0.55), f = at(C, s + 0.55);
      const march = Math.atan2(b.dx + f.dx, b.dz + f.dz);
      const halted = smooth(span(t, C.arrive - 0.15, C.arrive + 0.7));
      const toPad = Math.atan2(PAD.x - C.cx, PAD.z - ZC);
      const moving = 1 - smooth(span(t, C.arrive - 0.6, C.arrive));
      C.members.forEach(rec => {
        const a = rec.a, i = C.k * 9 + rec.i, ph = hash1(i * 5.1) * 6.28;
        const GAP = C.gap, x = p.x + (rec.col - 1) * GAP, z = p.z + (rec.r - 1) * GAP;   // a rigid square, rows along x
        let heading = lerp(march, toPad, halted) + (hash1(i * 2.3) - 0.5) * 0.12 * halted;
        heading += 0.18 * Math.sin(t * 0.33 + ph) * halted * (1 - span(t, T.ignite, T.ignite + 0.4));
        // ignition: a startle; lift-off: look up; then the cheers roll back through the rows
        const st0 = T.ignite + 0.1 + rec.r * 0.06 + hash1(i * 3.1) * 0.12, startle = t > st0 ? Math.exp(-(t - st0) * 5) * Math.sin(Math.min(Math.PI, (t - st0) * 9)) : 0;
        const lookUp = smooth(span(t, T.lift + 0.3 + rec.r * 0.12, T.lift + 1.6)) * clamp(0.18 + rocketY * 0.012, 0, 0.42);
        const wave0 = T.lift + 1.3 + (2 - rec.r) * 0.22 + C.k * 0.08;           // front row first
        const beat = (t - wave0) * 1.7, cheerOn = t > wave0 && t < T.end ? 1 : 0;
        const hp = cheerOn ? Math.max(0, Math.sin(beat * Math.PI * 2)) : 0;
        const cheer = cheerOn ? smooth(span(t, wave0, wave0 + 0.3)) : 0;
        const blink = poser.blinkAt(t, i * 1.3 + 40);
        if (C.sp === 'floatie') {
          // they FLY in (Sueda: "the flying ones with the umbrellas should be flying in the reception too"): the square
          // comes over the terrace high under its parasols, sinks onto its place and keeps floating there, feet off
          // the ground, bobbing out of step; after lift-off they bounce up in the air and wave
          const ryG = (poser.STAND.floatie + poser.HANG) * a.sc;
          const sink = smooth(span(t, C.arrive - 1.9, C.arrive + 0.3));
          const y = ryG + lerp(2.5 + 0.15 * rec.r, 0.55 + 0.1 * (rec.r + rec.col % 2), sink) + Math.sin(t * 0.9 + ph) * (0.07 + 0.05 * sink)
            + (cheerOn ? hp * 0.3 * a.sc : 0) + Math.max(0, startle) * 0.2;
          poser.floatie(a, { x, z, heading, y, air: true, airK: 1, spin: t * (0.35 - 0.15 * sink) + ph,
            swx: 0.14 * moving + 0.04 * Math.sin(t * 0.8 + ph) + startle * 0.1, swz: 0.05 * Math.sin(t * 0.7 + ph), pitch: -lookUp,
            wave: cheerOn && rec.i % 2 === 0 ? cheer : 0, blink, t });
        } else if (C.sp === 'loaf') {
          const g = hopGait(s, 0.52 * a.sc, a.sc), q = at(C, g.along);
          const lx = q.x + (rec.col - 1) * GAP, lz = q.z + (rec.r - 1) * GAP;
          const marching = s < C.L - 0.02, hopUp = cheerOn ? hp * 0.18 * a.sc : 0;
          extra.pose.loaf(a, { x: marching ? lx : x, z: marching ? lz : z, heading, hop: (marching ? g.hop : 0) + hopUp + Math.max(0, startle) * 0.1 * a.sc,
            squash: marching ? g.squash : 1 - (cheerOn ? Math.max(0, -Math.sin(beat * Math.PI * 2)) * 0.12 : 0), lift: marching ? g.lift : 1, air: (marching && g.air) || hopUp > 0.02,
            tip: marching ? g.tip : -lookUp * 0.6, blink, t });
        } else {
          const hop = (C.sp === 'moth' ? 0 : hp * 0.2 * a.sc) + Math.max(0, startle) * 0.1 * a.sc;
          extra.pose[C.sp](a, { x, z, heading, stride: strideOf(C.sp, s, a.sc) + (C.sp === 'moth' ? 0 : 0), w: moving, hop, squash: 1 - (cheerOn && C.sp !== 'moth' ? Math.max(0, -Math.sin(beat * Math.PI * 2)) * 0.1 : 0),
            cheer, wave: cheerOn && (rec.i % 3 === 1) ? cheer : 0, pitch: -lookUp, blink, t, lift: C.sp === 'moth' ? hp * 0.25 + cheer * 0.15 : 0 });
        }
        if (rec.idn) identity.step(rec, 1 / 30, t);
      });
    }
  }
  return { companies, pose, all: () => companies.flatMap(c => c.members) };
}

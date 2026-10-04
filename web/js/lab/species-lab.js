// Species lab: every kind of folk side by side on her Red arch far terrace, dressed by identity.js, in her Gouache.
// The new townsfolk (agents/species-extra.js: twinkle, glim, moth) + the loaves next to the reference folk for scale.
import { createRenderer, createContext } from '../paint/context.js';
import { createKit } from '../paint/kit.js';
import { createBackdrop } from '../paint/backdrop.js';
import { buildRedArch, referenceNav, camBase } from '../paint/redArch.js';
import { createFolk } from '../paint/folk.js';
import { createPainter } from '../paint/post.js';
import { createIdentity } from '../agents/identity.js';
import { extendFolk, strideOf, hopGait } from '../agents/species-extra.js';
import { mountShot, createPoser, hash1 } from '../trailer/shot.js';

const q = new URLSearchParams(location.search);
const renderer = createRenderer();
if (q.has('dpr')) renderer.setPixelRatio(+q.get('dpr'));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.3, 1400);
camera.position.copy(camBase);
const ctx = createContext({ renderer, scene, camera, seed: 11 });
const { V } = ctx;
const kit = createKit(ctx);
const backdrop = createBackdrop(ctx, { camBase });
const arch = buildRedArch(ctx, kit);
const folk = createFolk(ctx, backdrop, referenceNav(ctx));
const extra = extendFolk(ctx, folk);
const identity = createIdentity(ctx, folk, null);
const poser = createPoser(ctx, folk);
ctx.flags.closeUp = true;

const TRADES = ['builder', 'courier', 'farmer', 'baker', 'scholar', 'diplomat', 'trader', 'crafter'];
const focus = q.get('focus'), march = q.has('march');
const Z0 = -12.4;
let cast;
if (focus) cast = [0, 1, 2].map(i => ({ sp: focus, x: (i - 1) * 1.15, z: Z0, trade: TRADES[i * 2] }));
else {
  const front = ['loaf', 'twinkle', 'glim', 'moth'], back = ['flit', 'puffer', 'drop', 'floatie', 'scoot', 'pip'];
  cast = [...front.map((sp, i) => ({ sp, x: (i - 1.5) * 1.5, z: Z0 + 0.5, trade: TRADES[i % TRADES.length] })),
          ...back.map((sp, i) => ({ sp, x: (i - 2.5) * 1.45, z: Z0 - 0.9, ref: !['flit', 'floatie'].includes(sp), trade: TRADES[(i + 3) % TRADES.length] }))];
}
const counts = {};
const crowd = cast.map((c, i) => {
  const a = folk.make[c.sp](counts[c.sp] = (counts[c.sp] || 0) + 1);
  a.controlled = true; a.driven = true; a.path = []; a.wait = 1e6;
  if (a.pos) a.pos.set(c.x, 0, c.z);
  const r = { a, species: c.sp, id: 'lab-' + i, sim: { id: 'lab-' + i, name: 'Lab ' + i, trade: c.trade || 'builder' }, c, i };
  if (!c.ref) try { identity.dress(r); } catch (e) { console.warn('[lab] dress', c.sp, e); }
  return r;
});

const painter = createPainter(ctx, folk, { framing: (cam, w, h) => { cam.aspect = w / h; } });
painter.setMode(1);
const FIXED = q.has('w') && q.has('h');
const size = () => FIXED ? [+q.get('w'), +q.get('h')] : [innerWidth, innerHeight];
painter.resize(...size());
if (!FIXED) addEventListener('resize', () => { painter.resize(...size()); window.__shot && window.__shot.seek(window.__shot.t); });

function placeCamera() {
  if (q.has('top')) { camera.position.set(0, 46, -5.5); camera.up.set(0, 0, -1); camera.lookAt(0, 0, -5.5); camera.fov = 34; }
  else if (focus) { camera.position.set(0.2, 1.25, Z0 + 4.2); camera.lookAt(0, 0.62, Z0); camera.fov = 30; }
  else { camera.position.set(0, 3.1, Z0 + 8.4); camera.lookAt(0, 0.5, Z0 - 0.3); camera.fov = 34; }
  camera.updateProjectionMatrix();
}
function render(t) {
  placeCamera();
  folk.update(1 / 30, t);   // the reference folk (back row) keep their own idle life
  crowd.forEach(r => {
    const a = r.a, c = r.c, ph = hash1(r.i * 7.3) * 6.28, blink = poser.blinkAt(t, r.i * 1.7);
    const heading = Math.atan2(camera.position.x - c.x, camera.position.z - c.z) * 0.85;
    const d = march ? t * 0.9 : 0, w = march ? 1 : 0;
    if (r.species === 'flit') poser.flit(a, { x: c.x, z: c.z, heading, prop: t * 6, blink, t, pitch: 0.04 * Math.sin(t + ph) });
    else if (r.species === 'floatie') poser.floatie(a, { x: c.x, z: c.z, heading, spin: t * 0.2 + ph, blink, t, wave: march ? 0 : Math.max(0, Math.sin(t * 0.7 + ph)) });
    else if (r.species === 'loaf') { const g = hopGait(march ? d : 0, 0.55 * a.sc, a.sc); extra.pose.loaf(a, { x: c.x, z: c.z, heading, hop: g.hop, squash: g.squash, lift: g.lift, air: g.air, tip: g.tip, blink, t }); }
    else if (extra.pose[r.species]) extra.pose[r.species](a, { x: c.x, z: c.z, heading, stride: strideOf(r.species, d, a.sc), w, blink, t, wave: march ? 0 : Math.max(0, Math.sin(t * 0.6 + ph)) * (r.i % 2) });
    if (r.idn) identity.step(r, 1 / 30, t);
  });
  backdrop.update(t); arch.update(t);
  painter.renderPainted();
}
window.__lab = { ctx, folk, extra, crowd, camera, painter, renderer };
mountShot({ duration: 12, render, ready: Promise.resolve() });

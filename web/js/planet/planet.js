// The Tower Planet as one object: createPlanet() builds Sueda's world from the verbatim modules, in her order
// (context -> materials -> post -> colours -> views -> build -> resize -> loop), and exposes the API the game
// uses. Hand-written facade; the look lives in context / terrain / materials / build / post / views (generated
// by tests/planet/extract.py). See docs/planet.md.
import { createContext } from './context.js';
import * as terrain from './terrain.js';
import { createMaterials, createColours, COLOUR_KEYS, DEFAULT_COLOURS } from './materials.js';
import { build } from './build.js';
import { createPost } from './post.js';
import { createViews } from './views.js';

export { terrain, COLOUR_KEYS, DEFAULT_COLOURS };

export function createPlanet({ canvas = null, renderer = null, autoStart = true, input = true, autoResize = true,
  fail, onFirstFrame = null } = {}) {
  const listeners = new Map();
  const emit = (type, v) => { for (const fn of [...(listeners.get(type) || [])]) fn(v); };
  const on = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type).delete(fn);
  };

  const ctx = createContext({ canvas, renderer, fail });
  if (!ctx) return null;
  Object.assign(ctx, createMaterials(ctx));
  const P = createPost(ctx);
  const colours = createColours(ctx, (k, hex) => emit('colour', { k, hex }));
  const views = createViews(ctx, P, { input, emit });

  ctx.world = build(ctx);
  views.setWorld(ctx.world);
  views.resize(); views.markStarted();
  if (autoResize) addEventListener('resize', views.resize);

  // where the game hangs its things (after her objects, so her draw order is untouched)
  const surface = new THREE.Group(); surface.name = 'planet-surface';
  ctx.scene.add(surface);

  /* ---- the loop (her rAF chain: the first frame primes the clock, every frame queues the next) ---- */
  let running = false, raf = 0, primed = false, firstDone = false, readyResolve;
  const ready = new Promise(r => { readyResolve = r; });
  function firstFrame() {
    if (firstDone) return;
    firstDone = true;
    if (onFirstFrame) onFirstFrame();
    readyResolve();
  }
  function tick(now) { views.frame(now); if (running) raf = requestAnimationFrame(tick); }
  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(t => { views.prime(t); primed = true; tick(t); firstFrame(); });
  }
  function stop() { running = false; cancelAnimationFrame(raf); }
  // for a host that owns the loop (autoStart: false): call frame(now) once per animation frame
  function frame(now = performance.now()) {
    if (!primed) { views.prime(now); primed = true; }
    views.frame(now);
    firstFrame();
  }
  function renderHook({ beforeRender, beforeFinish, afterFinish } = {}) {
    const added = [];
    for (const [k, fn] of [['beforeRender', beforeRender], ['beforeFinish', beforeFinish], ['afterFinish', afterFinish]]) {
      if (fn) { views.hooks[k].push(fn); added.push([k, fn]); }
    }
    return () => { for (const [k, fn] of added) { const a = views.hooks[k], i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } };
  }
  function setColours(map = {}) { for (const [k, hex] of Object.entries(map)) if (colours.UNI[k]) colours.setColour(k, hex); }
  function dispose() {
    stop();
    if (autoResize) removeEventListener('resize', views.resize);
    listeners.clear();
  }

  const planet = {
    THREE, ctx, terrain, scene: ctx.scene, camera: ctx.camera, renderer: ctx.renderer, world: ctx.world, surface,
    post: P, uniforms: { uTime: ctx.uTime, SUN: ctx.SUN, BG: ctx.BG, DAYLIGHT: ctx.DAYLIGHT, PALU: ctx.PALU },
    colourUniforms: colours.UNI, COLOUR_KEYS, DEFAULT_COLOURS,
    ready, start, stop, frame, resize: views.resize, dispose,
    get running() { return running; },
    on, renderHook, onFrame: fn => renderHook({ beforeRender: fn }),
    // paint style: her Grain (0) <-> Red-arch Gouache (1); auto = by altitude, as in her descent
    setBlend: v => views.setBlend(v), autoBlend: on => views.autoBlend(on),
    setDaylight: v => views.setDaylight(v), autoDaylight: on => views.autoDaylight(on),
    get blend() { return P.post.uniforms.uBlend.value; }, get daylight() { return ctx.DAYLIGHT.value; },
    // cameras
    orbit: () => views.orbit(), walk: () => views.walk(), setWalking: v => views.setWalking(v),
    descendTo: o => views.descendTo(o), cameraLocal: o => views.cameraLocal(o), cameraFree: o => views.cameraFree(o),
    orbitSpin: on => views.orbitSpin(on), setOrbit: o => views.setOrbit(o),
    get mode() { return views.mode; }, get walking() { return views.walking; },
    get styleSelected() { return views.styleSelected; }, get altitude() { return views.altitude; },
    state: () => views.state(),
    pick: (x, y) => views.pick(x, y), toScreen: v => views.toScreen(v),
    // colours (her DEFAULT_COLOURS keys)
    setColour: (k, hex) => colours.setColour(k, hex), setColours, getColours: () => colours.getColours(),
    // the surface API (flat design space <-> the sphere)
    heightAtFlat: terrain.heightAtFlat, groundAtFlat: terrain.groundAtFlat, isWaterFlat: terrain.isWaterFlat,
    onCragFlat: terrain.onCragFlat, normalAtFlat: terrain.normalAtFlat, upAtFlat: terrain.upAtFlat,
    flatToWorld: terrain.flatToWorld, surfaceToWorld: terrain.surfaceToWorld, worldToFlat: terrain.worldToFlat,
    frameAt: terrain.frameAt, placeOnSurface: terrain.placeOnSurface, wrapFlatGeometry: terrain.wrapFlatGeometry,
    raycastSurface: terrain.raycastSurface
  };
  if (autoStart) start();
  return planet;
}

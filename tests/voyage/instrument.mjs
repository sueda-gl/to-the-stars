// Writes tests/voyage/out/lounge-instrumented.html: the lounge with ONE added line that exposes its closure
// (seed, camera, controls, shadelings) on window.__lounge, so tests can check the driver's model against the
// real scene. Test-only. web/worlds/lounge.html itself is never touched (sha256-checked in run.mjs).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const src = readFileSync(here + '../../web/worlds/lounge.html', 'utf8');
const anchor = '  const seed = { active: false, pos: new THREE.Vector2(), t: 0, y: 0, vy: 0 };\n';
if (!src.includes(anchor)) throw new Error('anchor not found');
const out = src.replace(anchor, anchor + '  window.__lounge = { seed, camera, controls, shadelings, get mix() { return mix; } };\n');
mkdirSync(here + 'out', { recursive: true });
writeFileSync(here + 'out/lounge-instrumented.html', out);
console.log('wrote out/lounge-instrumented.html');

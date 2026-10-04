import { createGame } from '../../web/js/sim/state.js';
const g = createGame({ seed: 7 }); const snapshot = g.snapshot();
const t = Date.now();
const r = await fetch('http://localhost:8870/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: 'build a factory here', pointer: { x: 4, z: 6 }, scene: 'earth', snapshot }) });
const j = await r.json(); console.log('CMD', Date.now() - t, 'ms', JSON.stringify(j).slice(0, 600));
const a = j.actions?.[0]; console.log('apply ->', JSON.stringify(g.apply(a)).slice(0, 400));
console.log('building:', JSON.stringify(g.state.buildings.at(-1)).slice(0, 300));

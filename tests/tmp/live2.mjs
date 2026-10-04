import { createGame } from '../../web/js/sim/state.js';
const g = createGame({ seed: 7 }); const snapshot = g.snapshot();
const post = async (p, body) => { const t = Date.now(); const r = await fetch('http://localhost:8870' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return [((Date.now() - t) / 1000).toFixed(1) + 's', await r.json()]; };
for (const u of ["let's build a house in the middle", "put a giant rubber duck in the lake", "who here is good at baking?", "make three small houses near the windmill and a well", "build a dragon statue there", "send our neighbours a basket of bread", "let's go to the moon", "ortaya bir çeşme yap"]) {
  const [t, j] = await post('/api/command', { transcript: u, pointer: { x: 4, z: 6 }, scene: 'earth', snapshot });
  console.log(t, j.meta?.mind, '|', u, '=>', JSON.stringify(j.actions).slice(0, 220), j.meta?.liveError ? 'ERR ' + JSON.stringify(j.meta.liveError).slice(0, 200) : '');
}
const [ts, sk] = await post('/api/sketch', { request: 'a stone lighthouse on the cliff', snapshot }); console.log('SKETCH', ts, sk.meta?.mind || '', (sk.parts || sk.sketch?.parts || []).length, 'parts');

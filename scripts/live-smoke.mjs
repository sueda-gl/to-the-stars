#!/usr/bin/env node
// Exercises every endpoint against the LIVE models when a credential exists; skips cleanly otherwise.
// Usage: node scripts/live-smoke.mjs            (boots its own server on a random port)
//        node scripts/live-smoke.mjs http://localhost:8870   (uses a running server)
import { loadConfig } from '../server/config.js';

const config = loadConfig();
if (config.mock) {
  console.log(`live-smoke: skipped (${config.mockReason}). Set ANTHROPIC_API_KEY in .env, or AGORA_MOCK=0 with an ant auth profile.`);
  process.exit(0);
}

let base = process.argv[2], app = null;
if (!base) {
  const { createServer } = await import('../server/index.js');
  app = await createServer({ mock: false, mockReason: 'live-smoke', liveFallbackToMock: false, logLevel: 'info' });
  base = `http://127.0.0.1:${await app.listen(0)}`;
}
const post = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r; };
const snapshot = {
  day: 3, stage: 'camp', resources: { food: 2, wood: 30, stone: 20, coin: 10 },
  buildings: [{ id: 'b1', kind: 'windmill', name: 'Old mill', x: 4, z: 2, status: 'done' }],
  agents: [
    { id: 'a1', name: 'Olla', species: 'loaf', trade: 'baker', known: {}, mood: 'content', status: 'idle', traits: ['proud'], skills: { baking: 4, building: 2 } },
    { id: 'a2', name: 'Pim', species: 'puffer', trade: 'builder', known: {}, mood: 'tired', status: 'idle', traits: ['timid'], skills: { building: 8 } },
    { id: 'a3', name: 'Bruno', species: 'puffer', trade: 'builder', known: {}, mood: 'content', status: 'idle', traits: ['loyal'] },
  ],
  letters: [{ id: 'l1', subject: "We're hungry", from: { kind: 'agent', id: 'a1', name: 'Olla' }, resolved: false }],
  neighbours: [{ id: 'n1', name: 'Sorrento-on-the-Rock', leaderName: 'Donna Perla', leaderSpecies: 'drop', temperament: 'proud', attitude: 50 }, { id: 'n2', name: 'Little Lantern', leaderName: 'Baker Odo', leaderSpecies: 'loaf', temperament: 'warm', attitude: 62 }, { id: 'n3', name: 'Grey Harbour', leaderName: 'Harbourmaster Brusco', leaderSpecies: 'puffer', temperament: 'gruff', attitude: 40 }],
  minister: 'a1', unlocked: ['house', 'hut', 'well', 'farm', 'windmill', 'woodcutter', 'grove', 'road', 'garden'],
};

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failures++; };

try {
  const h = await (await fetch(base + '/api/health')).json();
  check('health', h.ok && h.mock === false, JSON.stringify(h.models));

  for (const transcript of ["Let's build a house in the middle", 'A windmill there', "Who's good at baking?", 'Make Olla our minister', 'Build a lighthouse on the cliff', 'yes, and build a bakery near the windmill', 'ortaya iki ev yapalım',
    'put a giant rubber duck there, in the lake', 'a dragon statue in the square', 'send the neighbours a basket of bread', 'show me the neighbours', "let's go to the moon", 'build a rocket']) {
    const t0 = Date.now();
    const j = await (await post('/api/command', { transcript, scene: 'earth', pointer: { x: 3, z: -2 }, selected: null, snapshot })).json();
    check(`command "${transcript}"`, j.meta?.mind === 'live' && j.actions?.length > 0, `${Date.now() - t0}ms ${JSON.stringify(j.actions)} say=${j.say?.text || ''} cacheRead=${j.meta?.usage?.cacheRead}`);
  }
  for (const transcript of ['offer them a seed', 'wait for the evening', 'we come in peace', "let's go home"]) {
    const t0 = Date.now();
    const j = await (await post('/api/command', { transcript, scene: 'moon', pointer: null, selected: null, snapshot })).json();
    check(`moon command "${transcript}"`, j.meta?.mind === 'live' && j.actions?.[0]?.type === 'moon', `${Date.now() - t0}ms ${JSON.stringify(j.actions)}`);
  }

  for (const request of ['a giant rubber duck in the lake', 'a dragon statue']) {
    const t0 = Date.now();
    const s = await (await post('/api/sketch', { request, snapshot })).json();
    check(`sketch "${request}"`, s.meta?.mind === 'live' && s.parts?.length >= 3, `${Date.now() - t0}ms ${s.name} ${s.category} ${s.parts?.length} parts ${JSON.stringify(s.footprint)} h=${s.height}`);
  }

  const s = await (await post('/api/society', { snapshot, recent: [], wants: ['report'] })).json();
  check('society', s.meta?.mind === 'live' && Array.isArray(s.letters), `${s.meta?.ms}ms letters=${s.letters?.length} ${s.letters?.map(l => `[${l.from.name}: ${l.subject} / ${l.options.map(o => o.says).join(' | ')}]`).join(' ')}`);

  for (const purpose of ['refusal', 'skill_answer', 'report', 'reply', 'election', 'envoy', 'gift_thanks', 'shadeling_contact', 'shadeling_seed', 'shadeling_golden', 'shadeling_farewell']) {
    const l = await (await post('/api/letter', { purpose, agent: snapshot.agents[purpose === 'skill_answer' ? 1 : 0], context: { skill: 'building', why: 'I have not slept since the crates came', text: 'well done', decision: 'yes', buildingName: 'bakery', neighbour: 'n1', kind: 'trade', give: { food: 6 }, get: { goods: 8 }, gift: 'a basket of bread' }, snapshot })).json();
    check(`letter ${purpose}`, l.meta?.mind === 'live' && l.subject && l.body, `${l.meta?.ms}ms [${l.from?.name}] "${l.subject}" ${l.body?.split(' ').length}w | ${l.options?.map(o => o.says).join(' / ')}`);
    if (purpose.startsWith('shadeling')) console.log(l.body.split('\n').map(x => '      ' + x).join('\n'));
  }

  for (const request of ['a lighthouse on the cliff', 'a giant rubber duck in the lake']) {
    const t0 = Date.now();
    const r = await post('/api/codegen', { request, kindHint: '', snapshot });
    const text = await r.text();
    const events = [...text.matchAll(/^event: (\w+)\ndata: (.*)$/gm)].map(m => [m[1], JSON.parse(m[2])]);
    const done = events.find(e => e[0] === 'done');
    // a cache hit is correct behaviour (the archive remembers); delete server/data/assets/<id>.json to force a live plan
    check(`codegen "${request}"`, done && ['live', 'cache'].includes(done[1].meta?.mind) && /function build\(api\)/.test(done[1].asset?.code), `${Date.now() - t0}ms mind=${done?.[1].meta?.mind} speed=${done?.[1].meta?.speed} stages=${events.filter(e => e[0] === 'status').map(e => e[1].stage).join('>')} ${done ? `${done[1].asset.name} [${done[1].asset.meta.category}] ${done[1].asset.code.length} chars` : events.find(e => e[0] === 'error')?.[1]?.message}`);
  }
  const a = await (await fetch(base + '/api/assets')).json();
  check('assets', Array.isArray(a) && a.length >= 1, `${a.length} cached`);
} catch (err) {
  console.error('live-smoke crashed:', err); failures++;
} finally {
  if (app) await app.close();
}
console.log(failures ? `live-smoke: ${failures} failure(s)` : 'live-smoke: all good');
process.exit(failures ? 1 : 0);

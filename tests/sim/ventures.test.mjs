// ART_DIRECTION §11: entrepreneurs propose their own ventures (bubble + letter with yes / no), build them near home,
// keep them, and they earn; sometimes a small one is simply started.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';
import { VENTURE } from '../../web/js/sim/ventures.js';

const ambitious = g => g.state.agents.find(a => a.traits.includes('ambitious') && a.name !== 'Olla') || g.state.agents.find(a => a.traits.includes('ambitious'));

test('an ambitious folk proposes a venture by bubble and letter; yes -> they place and build it near home with the crew behind them; done -> theirs, and it earns', () => {
  const g = game();
  g.spawnAll({ fleets: false });
  const house = finish(g, 'house');
  const a = ambitious(g) || g.state.agents[0];
  a.traits = ['ambitious']; a.homeId = house.id; a.mood = 80;
  run(g, VENTURE.firstAfter + 1, 0.5);
  let v = g.state.ventures.find(x => x.agentId === a.id);
  if (!v) { run(g, VENTURE.every[1] + VENTURE.retryAfter * 3, 0.5); v = g.state.ventures.find(x => x.agentId === a.id); }
  assert.ok(v, 'a proposal came (' + JSON.stringify(g.state.ventures) + ')');
  if (v.status === 'started') return;   // the rare self-start: covered below
  assert.equal(v.status, 'proposed');
  assert.ok(g.find('agent:say', p => p.agentId === a.id && p.kind === 'venture' && /May I/.test(p.text)), 'the bubble');
  assert.ok(g.find('venture:propose', p => p.ventureId === v.id));
  const l = g.state.letters.find(x => x.id === v.letterId);
  assert.ok(l && l.kind === 'venture' && l.from.id === a.id, 'the letter');
  assert.deepEqual(l.options.map(o => o.says), ['yes', 'no']);
  run(g, 15, 0.5);
  assert.ok(l.delivered, 'carried to the tray');
  const r = g.apply({ type: 'reply_letter', letterId: l.id, decision: 'yes' });
  assert.equal(r.ok, true);
  assert.equal(r.effects[0].type, 'venture'); assert.equal(r.effects[0].status, 'building');
  const b = g.state.buildings.find(x => x.id === v.buildingId);
  assert.ok(b, 'a site'); assert.equal(b.name, v.title); assert.equal(b.venture.ownerId, a.id);
  assert.ok(Math.hypot(b.x - house.x, b.z - house.z) < 14, `near home (${Math.hypot(b.x - house.x, b.z - house.z).toFixed(1)} m)`);
  assert.ok(b.workers.includes(a.id), 'the owner builds it');
  assert.ok(g.find('venture:start', p => p.ventureId === v.id && p.buildingId === b.id));
  assert.ok(g.find('agent:say', p => p.agentId === a.id && /start today/.test(p.text)));
  run(g, 3, 0.1);
  assert.ok(b.workers.length >= 2, `helpers came (${b.workers.length})`);
  if (b.status === 'awaiting_design') { assert.ok(g.find('building:needsDesign', p => p.building.id === b.id), 'through codegen like any creation'); g.designArrived(b.id, { id: 'tea_house', name: 'Tea House', meta: { footprint: { w: 4, d: 4 }, workers: 1, buildSeconds: 30 } }); }
  run(g, 120, 0.1);
  assert.equal(b.status, 'done');
  assert.equal(v.status, 'done');
  g.tick(0.5);
  assert.equal(a.jobId, b.id, 'the owner keeps it');
  assert.match(a.job, /^keeper of the /);
  const e = g.catalog.get(b.kind);
  assert.ok(Object.keys(e.perDay).length, 'it earns something');
  run(g, 5, 0.1);
  assert.ok(g.state.rates[b.id], 'and produces');
  assert.ok(g.find('venture:done', p => p.ventureId === v.id));
  assert.ok(g.find('agent:say', p => p.agentId === a.id && /open/i.test(p.text)));
});

test('no -> declined, a sad word, and they do not ask again for a while', () => {
  const g = game();
  const a = g.state.agents[2];
  const v = g.proposeVenture(a.id, { title: 'Flower Stall', request: 'a flower stall', small: true }, { ask: true });
  assert.equal(v.status, 'proposed');
  const l = g.state.letters.find(x => x.id === v.letterId);
  const m0 = a.mood;
  g.apply({ type: 'reply_letter', letterId: l.id, decision: 'no' });
  assert.equal(v.status, 'declined');
  assert.ok(a.mood < m0);
  assert.ok(g.find('agent:say', p => p.agentId === a.id && /next spring/.test(p.text)));
  assert.ok(g.find('venture:decline', p => p.ventureId === v.id));
  assert.equal(g.state.buildings.length, 0);
});

test('rarely a small one is simply started: a note, not a question, and the site appears at once', () => {
  const g = game();
  const a = g.state.agents[4];
  const v = g.proposeVenture(a.id, { title: 'Bun Cart', request: 'a bun cart', small: true }, { ask: false });
  assert.equal(v.status, 'building');
  const l = g.state.letters.find(x => x.id === v.letterId);
  assert.ok(l && l.meta.started === true && l.options.length === 0, 'an informing letter');
  assert.ok(g.find('agent:say', p => p.agentId === a.id && /Come by/.test(p.text)));
  const b = g.state.buildings.find(x => x.id === v.buildingId);
  assert.ok(b && b.venture.ownerId === a.id && b.workers.includes(a.id));
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) < 12, 'near where they stand');
});

test('a catalogue noun becomes that prefab; proposals are rate-limited and never come while the squares stand', () => {
  const g = game();
  const a = g.state.agents[1];
  const v = g.proposeVenture(a.id, { title: 'Olive Press', request: 'an olive press' }, { ask: false });
  const b = g.state.buildings.find(x => x.id === v.buildingId);
  assert.ok(b.kind, 'resolved in the catalogue (' + b.kind + ')');
  assert.notEqual(b.status, 'awaiting_design');
  const h = game();
  h.spawnAll();   // the fleets stand and wait
  for (const x of h.state.agents) { x.traits = ['ambitious']; x.mood = 85; }
  h.state.nextVentureAt = 1;
  run(h, 60, 0.5);
  assert.equal(h.state.ventures.length, 0, 'nobody pitches during the formation');
  assert.ok(h.state.fleetHold);
  h.releaseFleets();
  run(h, VENTURE.every[1] + 10, 0.5);
  assert.ok(h.state.ventures.length >= 1 && h.state.ventures.filter(v => v.status === 'proposed').length <= VENTURE.maxOpen, JSON.stringify(h.state.ventures));
});

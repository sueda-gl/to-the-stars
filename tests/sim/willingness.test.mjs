import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';
import { willing, makeFolk } from '../../web/js/sim/society.js';
import { createRng } from '../../web/js/sim/rng.js';

test('willing() is deterministic and refuses the tired, the furious and the disloyal', () => {
  const rng = createRng(3);
  const a = makeFolk(rng, { species: 'puffer', name: 'Pim' });
  a.mood = 70; a.energy = 90; a.loyalty = 60; a.traits = ['loyal']; a.skills.building = 8;
  const t = { kind: 'build', skill: 'building', buildingId: 'b1', day: 1 };
  const w1 = willing(a, t, rng), w2 = willing(a, t, rng);
  assert.equal(w1.yes, true);
  assert.deepEqual(w1, w2, 'same inputs, same answer');
  a.energy = 5;
  const tired = willing(a, t, rng);
  assert.equal(tired.yes, false);
  assert.match(tired.why, /tired/);
  a.energy = 90; a.mood = 10; a.loyalty = 10;
  assert.equal(willing(a, t, rng).yes, false);
  // a stubborn folk refuses work outside their craft
  a.mood = 60; a.loyalty = 55; a.traits = ['stubborn']; a.skills.baking = 1;
  const bake = willing(a, { kind: 'work', skill: 'baking', buildingId: 'b2', day: 1 }, rng);
  assert.equal(bake.yes, false);
  assert.match(bake.why, /craft/);
});

test('assign to a tired folk yields agent:refuse and an in-character letter', () => {
  const g = game();
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  const b = g.state.buildings[0];
  const victim = g.state.agents.find(a => !b.workers.includes(a.id) && a.trade !== 'builder');
  victim.energy = 4; victim.mood = 35;
  const r = g.apply({ type: 'assign', agentIds: [victim.id], to: b.id });
  assert.equal(r.ok, false);
  assert.ok(g.find('agent:refuse', p => p.agentId === victim.id), 'agent:refuse emitted');
  const letter = g.state.letters.find(l => l.kind === 'refusal' && l.from.id === victim.id);
  assert.ok(letter, 'refusal letter written');
  assert.match(letter.body, /tired/);
  assert.ok(letter.options.length >= 2);
  // the player insists: the reply forces the assignment and costs mood
  run(g, 5, 0.1);
  const mood = victim.mood;
  const rr = g.apply({ type: 'reply_letter', letterId: letter.id, decision: 'no', text: 'I insist' });
  assert.equal(rr.ok, true);
  assert.ok(victim.mood < mood);
  assert.equal(victim.jobId, b.id);
});

test('assigning a willing folk replaces a refuser', () => {
  const g = game();
  g.apply({ type: 'build', kind: 'bakery', at: { mode: 'auto' } });
  const b = g.state.buildings[0];
  const other = g.state.agents.find(a => !b.workers.includes(a.id) && a.id !== g.state.minister);
  other.energy = 95; other.mood = 85; other.loyalty = 80; other.traits = ['loyal'];
  const r = g.apply({ type: 'assign', agentIds: [other.id], to: b.id });
  assert.equal(r.ok, true, r.reason);
  assert.ok(b.workers.includes(other.id));
});

test('strikes happen at low mood and loyalty, and end when mood recovers', () => {
  const g = game();
  const a = g.state.agents[3];
  a.mood = 15; a.loyalty = 20;
  run(g, 2, 0.1);
  assert.equal(a.status, 'striking');
  assert.ok(g.state.letters.some(l => l.kind === 'strike' && l.from.id === a.id));
  assert.equal(willing(a, { kind: 'build', skill: 'building' }, g.rng).yes, false);
  a.mood = 60;
  run(g, 1, 0.1);
  assert.notEqual(a.status, 'striking');
});

test('a folk at rock-bottom mood with no loyalty left leaves for a neighbour', () => {
  const g = game();
  const a = g.state.agents[5];
  const keepLow = () => { a.mood = 2; a.loyalty = 5; };
  g.on('day', keepLow);
  keepLow();
  g.tick(900);                                       // BAL.noLeaveBefore: nobody leaves in the first 15 minutes, whatever their heart says
  assert.notEqual(a.status, 'left', 'still here at 15 min');
  for (let i = 0; i < 130; i++) { keepLow(); g.tick(1); }
  assert.ok(g.find('agent:leave', p => p.agentId === a.id), 'agent:leave emitted');
  assert.ok(g.state.letters.some(l => l.kind === 'leaving' && l.from.id === a.id));
  assert.equal(a.status, 'left');
  assert.ok(!g.snapshot().agents.some(x => x.id === a.id), 'gone from the snapshot');
});

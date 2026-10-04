import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';

// mid-game: ~14 buildings, ~18 folk, letters in the tray, a minister, a generated asset
export function midGame() {
  const g = game();
  g.state.resources = { food: 300, wood: 200, stone: 200, coin: 60, goods: 20 };
  for (const k of ['house', 'house', 'house', 'farm', 'windmill', 'well', 'woodcutter', 'quarry', 'bakery']) finish(g, k);
  g.tick(0.1);
  g.state.stage = 'village';
  for (const k of ['granary', 'market', 'workshop', 'garden', 'tavern']) finish(g, k);
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  g.apply({ type: 'ask_crowd', question: 'who is good at farming?' });
  g.apply({ type: 'ask_crowd', question: 'who can build?' });
  g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'near', ref: 'edge' } });
  g.apply({ type: 'build', kind: 'house', at: { mode: 'auto' } });
  for (const a of g.state.agents) a.mood = 85;
  run(g, 60 * 7, 0.5);
  return g;
}

test('snapshot is compact (≤ ~2.5k tokens) and carries what the LLM needs', () => {
  const g = midGame();
  const snap = g.snapshot();
  const json = JSON.stringify(snap);
  const tokens = Math.ceil(json.length / 3.5);
  console.log(`snapshot: ${json.length} chars ≈ ${tokens} tokens; ${snap.buildings.length} buildings, ${snap.agents.length} agents, ${snap.unread.length} unread`);
  assert.ok(json.length <= 8750, `snapshot too long: ${json.length} chars`);
  assert.ok(snap.buildings.length >= 14 && snap.agents.length >= 12);
  assert.equal(snap.minister, g.state.minister);
  for (const b of snap.buildings) { assert.ok(b.id && b.kind && b.name && Number.isFinite(b.x) && Number.isFinite(b.z) && b.status); }
  for (const a of snap.agents) { assert.ok(a.id && a.name && a.species && a.trade && a.mood && a.status); assert.ok(!('skills' in a), 'hidden skills stay hidden'); }
  assert.ok(snap.agents.some(a => a.known), 'learned skills are shown');
  assert.ok(Array.isArray(snap.unread) && snap.unread.length > 0);
  assert.ok(snap.unread.every(u => u.subject && u.from));
  assert.equal(snap.neighbours.length, 3);
  assert.ok(snap.unlocked.includes('tavern'));
  assert.ok(snap.res.food >= 0);
  // JSON-safe (no cycles, no functions)
  assert.deepEqual(JSON.parse(json), snap);
});

test('letters are plain JSON and events carry plain payloads', () => {
  const g = midGame();
  for (const l of g.state.letters) JSON.stringify(l);
  for (const { p } of g.events_) JSON.stringify(p);
  assert.ok(g.events_.length > 100);
});

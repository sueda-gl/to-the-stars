// ART_DIRECTION §20: the sovereign picks an institution's members herself (found_institution with members as an array
// of agent ids / names): taken as given, no auto-pick, the first one leads; folk who left or already serve are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './helpers.mjs';

const town = () => { const g = game(); g.spawnAll({ fleets: false }); g.apply({ type: 'appoint_minister', agentId: 'Olla' }); return g; };
const free = g => g.state.agents.filter(a => a.status !== 'left' && a.id !== g.state.minister && !a.role);

test('explicit members: exactly the chosen folk, in order, the first one leads; chosen is flagged', () => {
  const g = town();
  const [a, b, c] = free(g);
  const r = g.apply({ type: 'found_institution', kind: 'police patrol', members: [c.id, a.id, b.id] });
  assert.ok(r.ok, r.reason);
  const inst = g.state.institutions[0];
  assert.deepEqual(inst.members, [c.id, a.id, b.id], 'the three she clicked, in click order');
  assert.equal(inst.leader, c.id, 'the first chosen leads');
  assert.equal(inst.chosen, true);
  assert.equal(inst.kind, 'patrol');
  for (const x of [a, b, c]) assert.equal(x.role && x.role.institutionId, inst.id);
  assert.equal(c.role.leader, true);
  const eff = r.effects.find(e => e.type === 'institution');
  assert.deepEqual(eff.members, [c.id, a.id, b.id]); assert.equal(eff.chosen, true);
});

test('explicit members by name, a named leader among them, the minister allowed when she picks him', () => {
  const g = town();
  const [a, b] = free(g);
  const r = g.apply({ type: 'found_institution', kind: 'night watch', members: [a.name, b.name, 'Olla'], leader: b.id });
  assert.ok(r.ok, r.reason);
  const inst = g.state.institutions[0];
  assert.deepEqual(inst.members, [a.id, b.id, g.state.minister], 'by name, the minister included when she picks him');
  assert.equal(inst.leader, b.id, 'the named leader, one of the chosen');
});

test('folk already serving or gone are skipped and reported; nobody valid -> a refusal with the reason', () => {
  const g = town();
  const [a, b, c] = free(g);
  assert.ok(g.apply({ type: 'found_institution', kind: 'court', members: [a.id] }).ok);
  const r = g.apply({ type: 'found_institution', kind: 'school', members: [a.id, b.id] });
  assert.ok(r.ok);
  assert.deepEqual(g.state.institutions[1].members, [b.id], 'the judge is not also the teacher');
  const eff = r.effects.find(e => e.type === 'institution');
  assert.equal(eff.skipped.length, 1); assert.equal(eff.skipped[0].id, a.id); assert.match(eff.skipped[0].why, /Court/);
  const r2 = g.apply({ type: 'found_institution', kind: 'guild', members: [a.id, 'nobody-such'] });
  assert.equal(r2.ok, false); assert.match(r2.reason, /cannot join/);
  assert.equal(g.state.institutions.length, 2);
  c.status = 'left';
  const r3 = g.apply({ type: 'found_institution', kind: 'festival committee', members: [c.id] });
  assert.equal(r3.ok, false);
});

test('a number (or nothing) still auto-picks: the old path is untouched', () => {
  const g = town();
  const r = g.apply({ type: 'found_institution', kind: 'police patrol', members: 3 });
  assert.ok(r.ok);
  assert.equal(g.state.institutions[0].members.length, 3);
  assert.equal(g.state.institutions[0].chosen, false);
  assert.ok(!g.state.institutions[0].members.includes(g.state.minister), 'never the minister when the sim picks');
});

// ART_DIRECTION §15 on the server: found_institution + resolve_conflict in the command schema, the mock parser on the
// minister's quick replies and free phrasings, the normaliser, the conflict letter purpose, and the round trip into the sim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogue } from '../../server/catalogue.js';
import { parseIntent } from '../../server/mock/intent.js';
import { ACTION_SCHEMA, COMMAND_SCHEMA, ACTION_TYPES, normaliseActions } from '../../server/schemas.js';
import { letterFor, LETTER_PURPOSES } from '../../server/mock/letters.js';
import { createGame } from '../../web/js/sim/index.js';

const catalogue = await loadCatalogue();
const snapshot = {
  day: 4, stage: 'hamlet', res: { food: 2, wood: 30, stone: 20, coin: 10 },
  buildings: [{ id: 'b1', kind: 'windmill', name: 'Old mill', x: 4, z: 2, status: 'done' }],
  agents: [{ id: 'a1', name: 'Olla', species: 'flit', trade: 'diplomat', status: 'idle', traits: ['proud'] }, { id: 'a2', name: 'Pim', species: 'floatie', trade: 'builder', status: 'idle' }, { id: 'a3', name: 'Momo', species: 'flit', trade: 'baker', status: 'idle' }],
  unread: [{ id: 'l9', subject: 'A theft at the crates', from: 'Olla', kind: 'conflict', options: ['Talk to them', 'Punish the thief', 'Start a police patrol'] }],
  neighbours: [{ id: 'n1', name: 'Sorrento-on-the-Rock', attitude: 30 }], minister: 'a1',
  conflicts: [{ id: 'c1', kind: 'theft', parties: ['a3', 'a2'], severity: 1, status: 'open', summary: 'Pim says Momo took bread from the crates.' }, { id: 'c2', kind: 'quarrel', parties: ['a2', 'a3'], severity: 1, status: 'open', summary: 'Pim and Momo are quarrelling.' }],
};
const parse = (transcript, extra = {}) => parseIntent({ transcript, pointer: null, snapshot, catalogue, ...extra });
const first = (t, extra) => parse(t, extra).actions[0];

test('the schema lists the two actions, with no new union-typed parameters', () => {
  assert.ok(ACTION_TYPES.includes('found_institution') && ACTION_TYPES.includes('resolve_conflict'));
  assert.ok(ACTION_SCHEMA.properties.conflictId && ACTION_SCHEMA.properties.how);
  const unions = (s) => { let n = 0; const w = (x) => { if (!x || typeof x !== 'object') return; if (x.anyOf || Array.isArray(x.type)) n++; if (x.properties) Object.values(x.properties).forEach(w); if (x.items) w(x.items); if (x.anyOf) x.anyOf.forEach(w); }; w(s); return n; };
  assert.equal(unions(COMMAND_SCHEMA), 3);
});

test('mock parser: institutions from the quick replies and free phrasings', () => {
  assert.deepEqual(first('start a police patrol'), { type: 'found_institution', kind: 'police patrol' });
  assert.deepEqual(first('start a police patrol team'), { type: 'found_institution', kind: 'police patrol' });
  assert.deepEqual(first('set up a night watch'), { type: 'found_institution', kind: 'night watch' });
  assert.deepEqual(first('make a court'), { type: 'found_institution', kind: 'court' });
  assert.deepEqual(first('set up a court'), { type: 'found_institution', kind: 'court' });
  assert.deepEqual(first('open a school'), { type: 'found_institution', kind: 'school' });
  assert.deepEqual(first("a builders' guild"), { type: 'found_institution', kind: 'builder guild' });
  assert.deepEqual(first('form a festival committee'), { type: 'found_institution', kind: 'festival committee' });
  assert.deepEqual(first('start a council'), { type: 'found_institution', kind: 'council' });
  assert.deepEqual(first('guard the crates'), { type: 'found_institution', kind: 'police patrol' });
  assert.deepEqual(first('a police patrol team of 3 led by Olla'), { type: 'found_institution', kind: 'police patrol', members: 3, leader: 'a1' });
  assert.deepEqual(first('we need guards with a watchtower'), { type: 'found_institution', kind: 'police patrol', request: 'a watchtower' });
  assert.deepEqual(first('build a watchtower'), { type: 'build', kind: 'watchtower', at: { mode: 'auto' } });   // a building stays a building
  assert.deepEqual(first('call a meeting'), { type: 'call_meeting' });
  const r = parse('start a police patrol');
  assert.equal(r.say.from, 'ministry'); assert.match(r.say.text, /founded/);
});

test('mock parser: answers to a conflict, aimed at the right one', () => {
  assert.deepEqual(first('talk to them'), { type: 'resolve_conflict', how: 'talk' });
  assert.deepEqual(first('punish the thief'), { type: 'resolve_conflict', conflictId: 'c1', how: 'punish' });
  assert.deepEqual(first('punish them both'), { type: 'resolve_conflict', how: 'punish' });
  assert.deepEqual(first('compensate them'), { type: 'resolve_conflict', how: 'compensate' });
  assert.deepEqual(first('ignore the quarrel'), { type: 'resolve_conflict', conflictId: 'c2', how: 'ignore' });
  assert.deepEqual(first('talk to Momo'), { type: 'resolve_conflict', conflictId: 'c1', how: 'talk' });
  assert.deepEqual(first('ignore it'), { type: 'reply_letter', letterId: 'l9', decision: 'no', text: 'ignore it' });   // the letter's own no = ignore
  assert.deepEqual(first('tell Momo thank you'), { type: 'message_agent', agentId: 'a3', text: 'thank you' });
  const both = parse('punish the thief and start a police patrol').actions;
  assert.deepEqual(both.map(a => a.type), ['resolve_conflict', 'found_institution']);
  assert.equal(first('talk to them', { snapshot: { ...snapshot, conflicts: [] } }).type, 'resolve_conflict', 'without conflicts in the snapshot the sim still takes the newest open one');
  assert.match(parse('punish the thief').say.text, /punished/);
});

test('normaliser: unknown conflict ids are dropped, how is kept as free text, members and leader are checked', () => {
  const r = normaliseActions([
    { type: 'resolve_conflict', conflictId: 'c7', how: 'lock him up' },
    { type: 'found_institution', kind: 'Police Patrol', count: 9, agentId: 'a2', request: '' },
    { type: 'found_institution', kind: '', name: '' },
    { type: 'resolve_conflict', conflictId: 'c2', how: 'talk' },
  ], snapshot, catalogue);
  assert.equal(r.dropped.length, 1);
  assert.deepEqual(r.actions, [{ type: 'resolve_conflict', how: 'lock him up' }, { type: 'found_institution', kind: 'police patrol', members: 6, leader: 'a2' }, { type: 'resolve_conflict', conflictId: 'c2', how: 'talk' }]);
});

test('the conflict letter purpose: the minister in their own voice, executable options', () => {
  assert.ok(LETTER_PURPOSES.includes('conflict'));
  const l = letterFor({ purpose: 'conflict', agent: snapshot.agents[0], context: { conflict: snapshot.conflicts[0], institutions: [] }, snapshot });
  assert.equal(l.kind, 'conflict'); assert.equal(l.from.kind, 'minister'); assert.equal(l.from.id, 'a1');
  assert.match(l.body, /took bread/); assert.match(l.body, /punish it/);   // proud
  for (const o of l.options) { const a = parse(o.says).actions[0]; assert.notEqual(a.type, 'noop', o.says); }
  const none = letterFor({ purpose: 'conflict', agent: {}, context: { conflict: { kind: 'noise', summary: 'Pim cannot sleep.', severity: 2 } }, snapshot: { ...snapshot, minister: null, agents: [] } });
  assert.equal(none.from.kind, 'ministry'); assert.match(none.body, /night watch/);
});

test('round trip: the sim writes the letter, the server parses its quick replies, the sim applies them', () => {
  const g = createGame({ seed: 7 });
  g.spawnAll({ fleets: false });
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  g.state.resources.food = 0;
  const c = g.startConflict('theft');
  const letter = g.state.letters.find(l => l.id === c.letterId);
  for (let i = 0; i < 40; i++) g.tick(0.5);
  const snap = g.snapshot();
  assert.ok(snap.conflicts.some(x => x.id === c.id) && snap.unread.some(u => u.id === letter.id && u.kind === 'conflict'));
  for (const o of letter.options) {
    const a = parseIntent({ transcript: o.says, snapshot: snap, catalogue, pointer: null }).actions[0];
    assert.notEqual(a.type, 'noop', o.says);
    if (o.says === 'start a police patrol') { const r = g.apply(a); assert.equal(r.ok, true); assert.equal(g.state.institutions[0].kind, 'patrol'); }
    if (o.says === 'punish the thief') { assert.equal(a.type, 'resolve_conflict'); assert.equal(a.conflictId, c.id); const r = g.apply(a); assert.equal(r.ok, true); assert.equal(c.how, 'punish'); }
    if (o.says === 'build a granary') assert.equal(a.kind, 'granary');
  }
  const snap2 = g.snapshot();
  assert.ok(snap2.institutions.length === 1 && snap2.agents.some(a => a.role === 'patrol'));
});

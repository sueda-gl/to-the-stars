import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogue } from '../../server/catalogue.js';
import { parseIntent, findAgent, matchKind, detectSkill } from '../../server/mock/intent.js';

const catalogue = await loadCatalogue();
const snapshot = {
  day: 2, stage: 'camp', resources: { food: 3, wood: 30, stone: 20, coin: 10 },
  buildings: [
    { id: 'b1', kind: 'windmill', name: 'Old mill', x: 4, z: 2, status: 'done' },
    { id: 'b2', kind: 'bakery', name: 'Crust & Co', x: 6, z: 2, status: 'site' },
  ],
  agents: [
    { id: 'a1', name: 'Olla', species: 'loaf', trade: 'baker', status: 'idle', traits: ['proud'] },
    { id: 'a2', name: 'Pim', species: 'puffer', trade: 'builder', status: 'idle' },
    { id: 'a3', name: 'Bruno', species: 'puffer', trade: 'builder', status: 'working' },
  ],
  letters: [{ id: 'l1', subject: 'We are hungry', resolved: false }],
  neighbours: [{ id: 'n1', name: 'Ashfolk', attitude: 30 }],
  minister: null,
};
const pointer = { x: 3, z: -2 };
const parse = (transcript, extra = {}) => parseIntent({ transcript, pointer, snapshot, catalogue, ...extra });
const first = (t, extra) => parse(t, extra).actions[0];

test('demo 3: "Let\'s build a house in the middle" -> build house center', () => {
  assert.deepEqual(first("Let's build a house in the middle"), { type: 'build', kind: 'house', at: { mode: 'center' } });
});

test('demo 4: "A windmill there" -> pointer (auto without a pointer)', () => {
  assert.deepEqual(first('A windmill there'), { type: 'build', kind: 'windmill', at: { mode: 'pointer' } });
  assert.deepEqual(first('A windmill there', { pointer: null }).at, { mode: 'auto' });
});

test('demo 5: "Who\'s good at baking?" -> ask_crowd baking; "Make Olla our minister" -> appoint', () => {
  const a = first("Who's good at baking?");
  assert.equal(a.type, 'ask_crowd'); assert.equal(a.skill, 'baking');
  assert.deepEqual(first('Make Olla our minister'), { type: 'appoint_minister', agentId: 'a1' });
  assert.deepEqual(first('appoint Ola as minister'), { type: 'appoint_minister', agentId: 'a1' }); // misheard name
  assert.deepEqual(first('make him the minister', { selected: 'a2' }), { type: 'appoint_minister', agentId: 'a2' });
});

test('demo 6: "Build a lighthouse on the cliff" -> kind null + request + edge', () => {
  const a = first('Build a lighthouse on the cliff');
  assert.equal(a.type, 'build'); assert.equal(a.kind, null);
  assert.equal(a.request, 'a lighthouse on the cliff'); assert.equal(a.name, 'Lighthouse');
  assert.deepEqual(a.at, { mode: 'near', ref: 'edge' });
  const r = parse('Build a lighthouse on the cliff');
  assert.equal(r.say.from, 'ministry'); assert.match(r.say.text, /never built/);
});

test('demo 7: "build a bakery near the windmill" -> near b1; refusal -> "assign Pim to the bakery"', () => {
  assert.deepEqual(first('build a bakery near the windmill'), { type: 'build', kind: 'bakery', at: { mode: 'near', ref: 'b1' } });
  assert.deepEqual(first('assign Pim to the bakery'), { type: 'assign', agentIds: ['a2'], to: 'b2' });
  assert.deepEqual(first('let Olla rest'), { type: 'assign', agentIds: ['a1'], to: 'rest' });
  assert.deepEqual(first('send Pim and Bruno to the mill'), { type: 'assign', agentIds: ['a2', 'a3'], to: 'b1' });
});

test('demo 8: "Call a meeting" -> call_meeting', () => {
  assert.deepEqual(first('Call a meeting'), { type: 'call_meeting' });
  assert.deepEqual(first('toplantı çağır'), { type: 'call_meeting' });
});

test('yes / no answer the latest unresolved letter; combined with an instruction', () => {
  assert.deepEqual(first('yes'), { type: 'reply_letter', letterId: 'l1', decision: 'yes', text: 'yes' });
  assert.equal(first('not now').decision, 'no');
  assert.equal(first('hayır').decision, 'no');
  const r = parse('yes, build a bakery near the windmill').actions;
  assert.equal(r.length, 2); assert.equal(r[0].type, 'reply_letter'); assert.equal(r[1].kind, 'bakery'); assert.equal(r[1].at.ref, 'b1');
  const none = parse('yes', { snapshot: { ...snapshot, letters: [] } }).actions[0];
  assert.equal(none.type, 'noop');
});

test('counts, plurals and numbers', () => {
  assert.equal(first('build three huts').count, 3);
  assert.equal(first('2 houses by the water').count, 2);
  assert.deepEqual(first('2 houses by the water').at, { mode: 'near', ref: 'water' });
  assert.equal(first('a couple of farms').count, 2);
  assert.equal(first('üç ev yap').count, 3);
  assert.equal(first('plant some trees there').kind, 'grove');
  assert.equal(first('put a shop near the mill').kind, 'market');
});

test('multi-intent splits', () => {
  const r = parse('build three huts by the water and a garden there').actions;
  assert.equal(r.length, 2); assert.equal(r[0].kind, 'hut'); assert.equal(r[0].count, 3); assert.equal(r[1].kind, 'garden'); assert.equal(r[1].at.mode, 'pointer');
  const r2 = parse('call a meeting and make Pim our minister').actions;
  assert.deepEqual(r2.map(a => a.type), ['call_meeting', 'appoint_minister']);
});

test('demolish, trade, name, message', () => {
  assert.deepEqual(first('demolish the mill'), { type: 'demolish', buildingId: 'b1' });
  assert.deepEqual(first('tear down the old mill'), { type: 'demolish', buildingId: 'b1' });
  assert.deepEqual(first('trade 10 wood for 5 food with the Ashfolk'), { type: 'trade', neighbourId: 'n1', give: { wood: 10 }, get: { food: 5 } });
  assert.equal(first('trade with someone').type, 'noop');
  assert.deepEqual(first('call our settlement Sundown Bay'), { type: 'name_settlement', name: 'Sundown Bay' });
  assert.deepEqual(first('tell Pim thank you'), { type: 'message_agent', agentId: 'a2', text: 'thank you' });
});

test('Turkish and mixed', () => {
  assert.deepEqual(first('ortaya bir ev yapalım'), { type: 'build', kind: 'house', at: { mode: 'center' } });
  assert.deepEqual(first('oraya bir yel değirmeni'), { type: 'build', kind: 'windmill', at: { mode: 'pointer' } });
  assert.equal(first('kim ekmek yapmakta iyi').type, 'ask_crowd');
  assert.equal(first('kim ekmek yapmakta iyi').skill, 'baking');
  assert.deepEqual(first("Olla'yı bakan yap"), { type: 'appoint_minister', agentId: 'a1' });
});

test('unknown things and empty input become noop with a minister note', () => {
  const r = parse('blah blah');
  assert.equal(r.actions[0].type, 'noop'); assert.equal(r.say.from, 'minister');
  assert.equal(parse('').actions[0].type, 'noop');
  assert.equal(first('assign Pim to the temple').type, 'noop'); // no temple yet
});

test('helpers', () => {
  assert.equal(findAgent('bruno', snapshot.agents)?.id, 'a3');
  assert.equal(findAgent('nobody here', snapshot.agents), null);
  assert.equal(matchKind('a little cottage', catalogue)?.id, 'house');
  assert.equal(detectSkill('who can grow things'), 'farming');
});

test('"yes, go ahead" answers the letter once (audit round 1)', () => {
  for (const t of ['yes, go ahead', 'ok ok sure', 'yes', 'no, not now']) {
    const r = parse(t).actions.filter(a => a.type === 'reply_letter');
    assert.equal(r.length, 1, t); assert.equal(r[0].letterId, 'l1');
    assert.equal(r[0].decision, t.startsWith('no') ? 'no' : 'yes');
  }
  assert.equal(parse('yes, go ahead').actions.length, 1);
});

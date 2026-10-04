// Phase 3: every director beat (web/js/director.js DEFAULT_BEATS), every UI chip (web/js/ui/ui.js DEFAULT_CHIPS /
// MORE_CHIPS), the §9 actions, generalised creation, the sim's own snapshot shape and the moon scene, all through the mock parser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCatalogue } from '../../server/catalogue.js';
import { parseIntent, findNeighbour, nounOf } from '../../server/mock/intent.js';

const catalogue = await loadCatalogue();
// The shape game.snapshot() really sends: res (not resources), unread / recent (not letters), from as a name.
const snapshot = {
  day: 2, stage: 'camp', res: { food: 3, wood: 30, stone: 20, coin: 10 },
  buildings: [{ id: 'b1', kind: 'windmill', name: 'Old mill', x: 4, z: 2, status: 'done' }, { id: 'b2', kind: 'bakery', name: 'Crust & Co', x: 6, z: 2, status: 'site' }],
  agents: [{ id: 'a1', name: 'Olla', species: 'loaf', trade: 'baker', status: 'idle' }, { id: 'a2', name: 'Pim', species: 'puffer', trade: 'builder', status: 'idle' }],
  unread: [{ id: 'l1', from: 'Grey Harbour', kind: 'neighbour_trade', subject: 'A trade', options: ['Accept the trade', 'Decline'] }, { id: 'l2', from: 'Olla', kind: 'complaint', subject: 'We are hungry' }],
  neighbours: [{ id: 'n1', name: 'Sorrento-on-the-Rock', leaderName: 'Donna Perla', attitude: 50 }, { id: 'n2', name: 'Little Lantern', leaderName: 'Baker Odo', attitude: 62 }, { id: 'n3', name: 'Grey Harbour', leaderName: 'Harbourmaster Brusco', attitude: 40 }],
  minister: null,
};
const pointer = { x: 3, z: -2 };
const parse = (transcript, extra = {}) => parseIntent({ transcript, pointer, snapshot, catalogue, ...extra });
const first = (t, extra) => parse(t, extra).actions[0];

// Read the real beats and chips from the files so this test fails the day they change.
const directorSrc = fs.readFileSync(new URL('../../web/js/director.js', import.meta.url), 'utf8');
const uiSrc = fs.readFileSync(new URL('../../web/js/ui/ui.js', import.meta.url), 'utf8');
const beatSays = [...directorSrc.matchAll(/say: (?:"([^"]+)"|'([^']+)')/g)].map(m => m[1] || m[2]);
const chipLine = (name) => { const m = uiSrc.match(new RegExp(`export const ${name} = \\[(.*?)\\];`)); return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]); };
const hero = uiSrc.match(/label: '([^']+)', hero: true/)[1];
const chips = [...chipLine('DEFAULT_CHIPS'), ...chipLine('MORE_CHIPS')].filter(c => c !== hero);

test('every director beat utterance maps to a real action (no noop)', () => {
  assert.ok(beatSays.length >= 8, `found ${beatSays.length} beats`);
  const expect = {
    "Let's build a house in the middle.": { type: 'build', kind: 'house', at: { mode: 'center' } },
    'and a windmill there': { type: 'build', kind: 'windmill', at: { mode: 'pointer' } },
    'who here is good at baking?': { type: 'ask_crowd', skill: 'baking' },
    'build a lighthouse on the cliff': { type: 'build', kind: null, name: 'Lighthouse', at: { mode: 'near', ref: 'edge' } },
    'put a giant rubber duck there, in the lake': { type: 'build', kind: null, name: 'Giant Rubber Duck', at: { mode: 'pointer' } },
    'send the neighbours a basket of bread': { type: 'send_gift', neighbourId: 'n3', gift: 'a basket of bread', give: { food: 3 } },   // n3 wrote the latest letter
    'show me the neighbours': { type: 'show', target: 'globe' },
    'call a meeting': { type: 'call_meeting' },
  };
  for (const say of beatSays) {
    const a = first(say);
    assert.notEqual(a.type, 'noop', say);
    if (expect[say]) for (const [k, v] of Object.entries(expect[say])) assert.deepEqual(a[k], v, `${say} .${k}`);
  }
  // the dynamic minister beat
  assert.deepEqual(first('make Olla our minister'), { type: 'appoint_minister', agentId: 'a1' });
  // the duck without a pointer lands in the lake
  assert.deepEqual(first('put a giant rubber duck there, in the lake', { pointer: null }).at, { mode: 'near', ref: 'water' });
});

test('every UI chip maps to a real action', () => {
  assert.equal(chips.length, 9); // 4 string chips + 5 more (the hero chip is checked below)
  const expect = {
    'A rubber duck in the lake': { type: 'build', kind: null, name: 'Rubber Duck', at: { mode: 'near', ref: 'water' } },
    'A dragon statue in the square': { type: 'build', kind: null, name: 'Dragon Statue', at: { mode: 'center' } },
    'Build a house in the middle': { type: 'build', kind: 'house', at: { mode: 'center' } },
    'A windmill there': { type: 'build', kind: 'windmill', at: { mode: 'pointer' } },
    'Who here is good at baking?': { type: 'ask_crowd', skill: 'baking' },
    'Send bread to our neighbours': { type: 'send_gift', neighbourId: 'n3', give: { food: 3 } },
    'Show me the neighbours': { type: 'show', target: 'globe' },
    'Call a meeting': { type: 'call_meeting' },
    'Let’s go to the moon': { type: 'go_moon' },
  };
  for (const c of chips) {
    const a = first(c);
    assert.notEqual(a.type, 'noop', c);
    assert.ok(expect[c], `no expectation for chip "${c}"`);
    for (const [k, v] of Object.entries(expect[c])) assert.deepEqual(a[k], v, `${c} .${k}`);
  }
  assert.deepEqual(first(hero), { type: 'build', kind: null, request: 'a giant lighthouse on the cliff', name: 'Giant Lighthouse', at: { mode: 'near', ref: 'edge' } });
});

test('generalised creation: any noun phrase is a build; kinds resolve from the noun only; unusual modifiers go to the Ministry', () => {
  assert.deepEqual(first('build a rocket'), { type: 'build', kind: null, request: 'a rocket', name: 'Rocket', at: { mode: 'auto' } });
  assert.deepEqual(first('a boat on the lake'), { type: 'build', kind: null, request: 'a boat on the lake', name: 'Boat', at: { mode: 'near', ref: 'water' } });
  assert.equal(first('a giant tree').kind, null); assert.equal(first('a clock tower').kind, null); assert.equal(first('a glass house').kind, null);
  assert.equal(first('a little cottage').kind, 'house'); assert.equal(first('an old windmill').kind, 'windmill'); assert.equal(first('plant some trees there').kind, 'grove');
  assert.deepEqual(first('two boats by the dock'), { type: 'build', kind: null, request: 'two boats by the dock', name: 'Boat', at: { mode: 'auto' }, count: 2 });
  const teapot = first('a teapot the size of a house in the middle');
  assert.equal(teapot.kind, null); assert.deepEqual(teapot.at, { mode: 'center' });
  assert.equal(first('a statue of our minister').kind, null);
  assert.equal(first('a bakery near the windmill').kind, 'bakery'); // the tail never steals the kind
  assert.equal(first('a lighthouse near the house').kind, null);
  assert.equal(nounOf('put a giant rubber duck there, in the lake'), 'giant rubber duck');
  assert.equal(nounOf('build a lighthouse on the cliff please'), 'lighthouse');
  assert.equal(first('blah blah').type, 'noop'); // no article, no verb, no kind: still a noop
  assert.match(parse('a rocket').say.text, /never built/);
});

test('§9 diplomacy: gifts, visits, the globe, home, letter phrases from the sim', () => {
  assert.deepEqual(first('send a gift to Little Lantern'), { type: 'send_gift', neighbourId: 'n2', gift: 'a gift' });
  assert.deepEqual(first('send Sorrento a basket of bread'), { type: 'send_gift', neighbourId: 'n1', gift: 'a basket of bread', give: { food: 3 } });
  assert.deepEqual(first('give them some wood'), { type: 'send_gift', neighbourId: 'n3', gift: 'some wood', give: { wood: 3 } });
  assert.deepEqual(first('send Grey Harbour 10 stone').give, { stone: 10 });
  assert.deepEqual(first('komşulara ekmek gönder'), { type: 'send_gift', neighbourId: 'n3', gift: 'some bread', give: { food: 3 } });
  // "them" = the nation most recently in a letter; with no neighbour letters, the friendliest
  const noLetters = { ...snapshot, unread: [] };
  assert.equal(first('send them a basket of bread', { snapshot: noLetters }).neighbourId, 'n2');
  assert.deepEqual(first('show me Grey Harbour'), { type: 'visit_neighbour', neighbourId: 'n3' });
  assert.deepEqual(first('visit the Lantern'), { type: 'visit_neighbour', neighbourId: 'n2' });
  assert.deepEqual(first('fly to Sorrento'), { type: 'visit_neighbour', neighbourId: 'n1' });
  assert.deepEqual(first('show me the world'), { type: 'show', target: 'globe' });
  assert.deepEqual(first('komşuları göster'), { type: 'show', target: 'globe' });
  assert.deepEqual(first('come back home'), { type: 'show', target: 'home' });
  assert.deepEqual(first('take us back down'), { type: 'show', target: 'home' });
  // the sim's own letter options
  assert.deepEqual(first('accept the trade with Grey Harbour'), { type: 'reply_letter', letterId: 'l1', decision: 'yes', text: 'accept the trade with grey harbour' });
  assert.equal(parse('accept the trade with Grey Harbour').actions.length, 1);
  assert.equal(first('ally with Sorrento').decision, 'yes'); assert.equal(first('apologise to Grey Harbour').decision, 'yes');
  for (const t of ['ignore it', 'not yet', 'decline', 'dismiss it']) assert.equal(first(t).decision, 'no', t);
  // a nation's envy letter that asks for a gift is answered, not doubled
  const envy = { ...snapshot, unread: [{ id: 'l9', from: 'Grey Harbour', subject: 'We see your lights', options: ['Send a gift (3 goods or 3 coin)', 'Ignore them'] }] };
  assert.deepEqual(first('send a gift to Grey Harbour', { snapshot: envy }), { type: 'reply_letter', letterId: 'l9', decision: 'yes', text: 'send a gift to grey harbour' });
  assert.equal(findNeighbour('the lantern folk', snapshot.neighbours)?.id, 'n2');
  assert.equal(findNeighbour('brusco', snapshot.neighbours)?.id, 'n3');
});

test('the moon: go_moon on earth; the six shadeling verbs on the moon (incl. Turkish); earth builds are refused there', () => {
  for (const t of ["let's go to the moon", 'to the moon', 'fly me to the moon', 'launch', 'aya gidelim', 'visit the shadelings', 'the moon']) assert.deepEqual(first(t), { type: 'go_moon' }, t);
  assert.match(parse("let's go to the moon").say.text, /nations/);
  const moon = { scene: 'moon' };
  const cases = {
    'offer them a seed': 'seed', 'drop a seed': 'seed', 'tohum ver': 'seed',
    'wait for the evening': 'golden_hour', 'golden hour': 'golden_hour', 'akşamı bekleyelim': 'golden_hour', 'wait': 'golden_hour',
    'bring back the day': 'daylight', 'daylight please': 'daylight', 'gündüz olsun': 'daylight',
    'we come in peace': 'greet', 'hello there': 'greet', 'merhaba': 'greet', 'barış içinde geldik': 'greet',
    'give them a gift': 'gift', 'offer a present': 'gift', 'hediye ver': 'gift',
    "let's go home": 'go_home', 'back to earth': 'go_home', 'eve dönelim': 'go_home', "let's go back home": 'go_home',
  };
  for (const [t, d] of Object.entries(cases)) { const a = first(t, moon); assert.equal(a.type, 'moon', t); assert.equal(a.do, d, t); assert.equal(a.text, t.toLowerCase()); }
  assert.equal(first('build a house', moon).type, 'noop'); assert.equal(first("let's go to the moon", moon).type, 'noop');
  assert.equal(parse('offer them a seed', moon).say.text, 'A seed, offered.');
});

test('the sim snapshot shape works: yes answers the latest unread letter, res feeds nothing wrong', () => {
  assert.deepEqual(first('yes'), { type: 'reply_letter', letterId: 'l2', decision: 'yes', text: 'yes' });
  assert.deepEqual(first('no', { snapshot: { ...snapshot, unread: [], recent: [{ id: 'l5', from: 'Pim', subject: 'x' }] } }).letterId, 'l5');
  const r = parse('yes, build a bakery near the windmill').actions;
  assert.equal(r.length, 2); assert.equal(r[1].at.ref, 'b1');
});

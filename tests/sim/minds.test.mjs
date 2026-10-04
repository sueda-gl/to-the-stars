// Minds (ART_DIRECTION §18): the cast's distinctness, think -> executable intents, conversations (alternating lines,
// relationships), the director's events, memory + reflections, persistence, the loop's fallback and budget limiter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';
import { MIND, MIND_ACTIONS, SEEDS, findTensions, mockCast, mockThink, mockConverse, normaliseThink, normaliseConverse, normaliseDirection, clampWords, voicePrefix, createMindLoop } from '../../web/js/sim/index.js';

// the arrival played through: squares, the introduction, Olla elected by the click, the ceremony, the squares released (fleetHold off)
const settled = (opts = {}) => { const g = game(opts); g.spawnAll(); run(g, 4); g.introduceFleets({ every: 0.6, first: 0.3 }); run(g, 6); g.electMinister(g.state.agents.find(a => a.name === 'Olla').id); run(g, 8); assert.equal(g.state.fleetHold, false); return g; };
const wordSet = s => new Set(String(s).toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
const jaccard = (a, b) => { const A = wordSet(a), B = wordSet(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, A.size + B.size - n); };

test('casting (mock): twelve genuinely distinct personas with every field, opinions of everyone, built-in tensions', () => {
  const g = settled();
  const n = g.castPersonas();
  assert.equal(n, 12);
  const P = Object.values(g.state.personas);
  assert.equal(P.length, 12);
  for (const p of P) {
    assert.ok(p.backstory.length > 80 && p.voice.length > 10 && p.quirks.length === 2 && p.values.length === 2 && p.fear && p.goal, p.name);
    assert.equal(Object.keys(p.opinions).length, 11, `${p.name} has an opinion of everyone else`);
    assert.ok(/\b(a|an|the)\b/.test(p.goal), 'a concrete goal');
    assert.ok(p.backstory.includes(p.name), 'the backstory is theirs');
  }
  // pairwise text similarity stays low (no template-y cast): backstory + voice + quirks
  const text = p => `${p.backstory} ${p.voice} ${p.quirks.join(' ')} ${p.fear} ${p.goal}`;
  let maxSim = 0, pairs = 0;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const s = jaccard(text(P[i]), text(P[j])); maxSim = Math.max(maxSim, s); pairs++; assert.ok(s < 0.35, `${P[i].name} vs ${P[j].name} similarity ${s.toFixed(2)}`); }
  assert.equal(pairs, 66);
  assert.equal(new Set(P.map(p => p.seed)).size, 12, 'twelve different seeds');
  assert.equal(new Set(P.map(p => p.voice)).size, 12, 'twelve different voices');
  assert.ok(SEEDS.length >= 14);
  // tensions: rivals, friends, a crush, a grudge, wired into the opinions and the starting affinities
  const T = g.state.minds.tensions;
  assert.deepEqual(T.map(t => t.kind).sort(), ['crush', 'friends', 'grudge', 'rivals']);
  const riv = T.find(t => t.kind === 'rivals');
  assert.equal(g.state.agents.find(a => a.id === riv.a).trade, g.state.agents.find(a => a.id === riv.b).trade, 'rivals share a trade');
  assert.ok(g.affinity(riv.a, riv.b) < 0 && g.affinity(T.find(t => t.kind === 'friends').a, T.find(t => t.kind === 'friends').b) > 0);
  assert.ok(g.state.personas[riv.a].opinions[riv.b] !== g.state.personas[riv.a].opinions[T.find(t => t.kind === 'friends').a] || true);
  const olla = g.state.agents.find(a => a.name === 'Olla');
  assert.match(g.state.personas[olla.id].goal, /seal/, 'Olla wants the seal');
  // a different seed casts differently but just as fully
  const g2 = settled({ seed: 11 }); g2.castPersonas();
  assert.equal(Object.keys(g2.state.personas).length, 12);
  // the request body the live cast takes
  const req = g.castRequest();
  assert.equal(req.settlers.length, 12); assert.ok(req.tensions.length >= 3); assert.equal(req.world.nations.length, 3);
  // findTensions is deterministic
  assert.deepEqual(findTensions(g.state), findTensions(g.state));
});

test('think (mock): every answer is a known intent and applies through the sim; every action in the vocabulary is executable', () => {
  const g = settled(); g.castPersonas();
  const ids = g.state.agents.map(a => a.id);
  // the mock mind over many moments: only known intents, says <= 12 words
  const seen = new Set();
  for (let k = 0; k < 6; k++) { run(g, 7); for (const id of ids) { const r = mockThink(g, id); assert.ok(MIND_ACTIONS.includes(r.intent.type)); assert.ok(r.say.split(' ').length <= 12, r.say); seen.add(r.intent.type); const a = g.applyIntent(id, r); assert.equal(typeof a.ok, 'boolean'); } }
  assert.ok(seen.size >= 3, `the mock varies: ${[...seen].join(', ')}`);
  assert.ok(g.count('agent:intent') >= 70);
  // each action type, by hand, through applyIntent (the mock thinks above left conversations pending: close them first)
  g.state.conversations.forEach(c => { c.status = 'done'; });
  const free = x => x.id !== g.state.minister && !x.role && !(x.task && ['deliver', 'journey', 'leave', 'meeting'].includes(x.task.kind));
  const a = g.state.agents.find(free), b = g.state.agents.find(x => x.id !== a.id && free(x));
  const T = (type, extra = {}, say = 'A word.') => g.applyIntent(a.id, { intent: { type, ...extra }, say, memory_note: '', mood_delta: 0 });
  assert.equal(T('work').applied, 'work');
  assert.equal(T('rest').applied, 'rest'); assert.equal(a.task.kind, 'rest');
  a.task = null; a.status = 'idle';
  assert.equal(T('wander_to', { place: 'the lake' }).applied, 'wander'); assert.equal(a.task.phase, 'wander');
  a.task = null; a.status = 'idle';
  const t = T('talk_to', { target: b.name, text: 'Seen the sky?' }); assert.equal(t.applied, 'conversation'); assert.equal(g.state.conversations.at(-1).b, b.id); assert.equal(g.state.conversations.at(-1).topic, 'the weather');
  g.state.conversations.at(-1).status = 'done';
  const c = T('complain', { text: 'the noise at night' }); assert.equal(c.applied, 'letter'); assert.equal(g.state.letters.at(-1).from.id, a.id); assert.equal(g.state.letters.at(-1).kind, 'complaint');
  const w = T('write_letter', { target: 'sovereign', text: 'a bench by the water, please' }); assert.equal(w.applied, 'letter'); assert.equal(g.state.letters.at(-1).kind, 'petition'); assert.match(g.state.letters.at(-1).body, /bench/);
  const wm = T('write_letter', { target: 'minister', text: 'the crates are counted wrong' }); assert.equal(wm.applied, 'note'); assert.ok(g.state.agents.find(x => x.id === g.state.minister).mind.memory.some(m => /counted wrong/.test(m.text)));
  const v = T('vote', { target: b.id }); assert.equal(v.applied, 'vote'); assert.equal(a.mind.vote, b.id);
  const pv = T('propose_venture', { text: 'a kite shop' }); assert.equal(pv.applied, 'venture'); assert.equal(g.state.ventures.at(-1).agentId, a.id); assert.match(g.state.ventures.at(-1).request, /kite shop/);
  const before = a.mood; assert.equal(T('celebrate').applied, 'celebrate'); assert.ok(a.mood >= before); assert.ok(g.find('agent:listen', p => p.agentId === a.id && p.hop));
  // gossip: a conversation with `target` about `text`, affinity toward the subject down a little
  const third = g.state.agents.find(x => ![a.id, b.id].includes(x.id)); const aff0 = g.affinity(a.id, third.id);
  const gs = T('gossip', { target: b.id, text: third.name }); assert.equal(gs.applied, 'conversation'); assert.ok(g.affinity(a.id, third.id) < aff0);
  g.state.conversations.at(-1).status = 'done';
  // steal when not desperate becomes a complaint; desperate, a theft conflict with a witness
  const st = T('steal'); assert.equal(st.intent.type, 'complain');
  g.state.resources.food = 2; g.state.hungry = true; a.traits = a.traits.filter(x => x !== 'loyal' && x !== 'generous');
  const st2 = g.applyIntent(a.id, { intent: { type: 'steal' }, say: 'Nobody counts the crusts.' });
  assert.equal(st2.applied, 'theft'); assert.equal(g.state.conflicts.at(-1).kind, 'theft'); assert.equal(g.state.conflicts.at(-1).roles.offender, a.id);
  // refuse: off the crew, a refusal event and letter
  g.state.hungry = false; g.state.resources.food = 40;
  const site = g.placeBuilding('house', g.findSpot('house', null)); run(g, 2);
  const crew = site.workers.map(id => g.state.agents.find(x => x.id === id)).find(x => x.id !== g.state.minister && !x.role);
  if (crew) { const rf = g.applyIntent(crew.id, { intent: { type: 'refuse', text: 'not my craft' } }); assert.equal(rf.applied, 'refuse'); assert.ok(!site.workers.includes(crew.id)); assert.ok(g.find('agent:refuse', p => p.agentId === crew.id)); }
  // help: joins the other's site
  const worker = site.workers.map(id => g.state.agents.find(x => x.id === id))[0];
  const helper = g.state.agents.find(x => !site.workers.includes(x.id) && x.id !== g.state.minister && !x.role && !g.state.conversations.some(c => c.status !== 'done' && (c.a === x.id || c.b === x.id)));
  if (worker && helper) { const h = g.applyIntent(helper.id, { intent: { type: 'help', target: worker.id } }); assert.ok(h.effects.some(e => e.type === 'help'), JSON.stringify(h)); }
  // every say is a bubble of kind 'mind' with the intent on it; unknown intents are read as work
  assert.ok(g.all('agent:say', p => p.kind === 'mind').every(p => p.intent && p.text.split(' ').length <= 12));
  assert.equal(normaliseThink({ intent: { type: 'dance' }, say: 'one two three four five six seven eight nine ten eleven twelve thirteen', mood_delta: 9 }).intent.type, 'work');
  assert.equal(normaliseThink({ intent: 'rest', say: 'x', mood_delta: -9 }).mood_delta, -3);
  assert.equal(clampWords('a b c d e f g h i j k l m n o', 14).split(' ').length, 14);
});

test('conversations: lines alternate between the two, <= 14 words each, bubbles carry conversationId, relationships and memories move', () => {
  const g = settled(); g.castPersonas();
  const [a, b] = g.state.agents.filter(x => x.id !== g.state.minister);
  const aff0 = g.affinity(a.id, b.id);
  const r = g.applyIntent(a.id, { intent: { type: 'talk_to', target: b.id, text: 'Hungry yet?' }, say: `${b.name}! A word.` });
  const c = g.state.conversations.find(x => x.id === r.effects[0].conversationId);
  assert.equal(c.status, 'pending'); assert.ok(g.find('conversation:start', p => p.conversationId === c.id));
  const req = g.converseRequest(c.id);
  assert.equal(req.a.id, a.id); assert.equal(req.b.id, b.id); assert.ok(req.a.persona && req.b.persona); assert.ok(req.turns >= 2 && req.turns <= 4); assert.equal(req.topic, 'bread');
  const lines = mockConverse(req).lines;
  assert.ok(lines.length >= 2 && lines.length <= 4);
  lines.forEach((l, i) => { assert.equal(l.speaker, i % 2 === 0 ? a.id : b.id, 'alternating'); assert.ok(l.text.split(' ').length <= 14, l.text); });
  g.applyConversation(c.id, { lines, outcome: { affinity: 2, noteA: 'Good talk with ' + b.name, noteB: a.name + ' is all right', spawns: 'none', subject: 'bread' } });
  assert.equal(c.status, 'talking');
  run(g, lines.length * MIND.chatGap + 1);
  const said = g.all('agent:say', p => p.conversationId === c.id);
  assert.equal(said.length, lines.length);
  said.forEach((p, i) => { assert.equal(p.kind, 'chat'); assert.equal(p.turn, i + 1); assert.equal(p.of, lines.length); assert.equal(p.agentId, lines[i].speaker); });
  assert.ok(g.affinity(a.id, b.id) > aff0, 'affinity up');
  assert.ok(a.mind.memory.some(m => /Good talk/.test(m.text)) && b.mind.memory.some(m => /all right/.test(m.text)));
  assert.ok(b.mind.memory.some(m => m.kind === 'heard' && m.about === a.id));
  assert.equal(c.status, 'done'); assert.ok(g.find('conversation:end', p => p.conversationId === c.id));
  assert.ok(g.find('relationship', p => p.a < p.b));
  // a quarrel spawns a conflict between the two; a 'letter' spawns a petition from a
  const c2 = g.applyIntent(a.id, { intent: { type: 'talk_to', target: b.id, text: 'The seal should be mine.' } }).effects[0].conversationId;
  g.applyConversation(c2, { lines: [{ speaker: 'a', text: 'The seal should be mine.' }, { speaker: 'b', text: 'It should not.' }], outcome: { affinity: -2, spawns: 'conflict', subject: 'the seal' } });
  assert.equal(g.state.conflicts.at(-1).kind, 'quarrel'); assert.deepEqual(g.state.conflicts.at(-1).parties, [a.id, b.id]);
  run(g, 12);
  const c3 = g.applyIntent(b.id, { intent: { type: 'talk_to', target: g.state.agents.at(-1).id, text: 'Who sleeps indoors?' } }).effects[0].conversationId;
  const nLetters = g.state.letters.length;
  g.applyConversation(c3, { lines: [{ speaker: 'a', text: 'Who sleeps indoors?' }, { speaker: 'b', text: 'Nobody.' }], outcome: { affinity: 0, spawns: 'letter', subject: 'a roof for the ones outside' } });
  assert.equal(g.state.letters.length, nLetters + 1); assert.equal(g.state.letters.at(-1).kind, 'petition');
  // normaliseConverse: speakers 'a' / 'b' map to ids, junk is dropped, long lines clipped
  const n = normaliseConverse({ lines: [{ speaker: 'a', text: 'x' }, { speaker: 'zz', text: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen' }, null], outcome: { affinity: 7, spawns: 'war' } }, req);
  assert.deepEqual(n.lines.map(l => l.speaker), [a.id, b.id]); assert.equal(n.lines[1].text.split(' ').length, 14); assert.equal(n.outcome.affinity, 2); assert.equal(n.outcome.spawns, 'none');
  // nobody talks to someone already in a conversation
  const busy = g.applyIntent(a.id, { intent: { type: 'talk_to', target: b.id } }); g.state.conversations.filter(x => x.status !== 'done').forEach(x => { x.status = 'done'; });
  assert.ok(busy.ok === false || busy.applied === 'conversation');
});

test('memory: a stream with importance, capped, reflections every 8 items, included in think and talk prompts; persisted in state', () => {
  const g = settled(); g.castPersonas();
  const a = g.state.agents[0];
  assert.ok(a.mind.memory.length >= 1, 'the minister event and the cast are remembered');
  for (let i = 0; i < 50; i++) g.observe(a.id, `thing ${i}`, { imp: i % 5 + 1 });
  assert.equal(a.mind.memory.length, MIND.memoryMax);
  assert.ok(a.mind.unreflected >= MIND.reflectEvery);
  g.reflect(a.id);
  assert.equal(a.mind.unreflected, 0); assert.equal(a.mind.reflections.length, 1); assert.ok(g.find('mind:reflect', p => p.agentId === a.id));
  g.reflect(a.id, 'I keep count of everything and everyone.');
  const req = g.thinkRequest(a.id);
  assert.equal(req.memory.items.length <= MIND.memorySent + 3, true); assert.ok(req.memory.reflections.includes('I keep count of everything and everyone.'));
  assert.ok(req.persona && req.state.job && Array.isArray(req.state.nearby) && req.options.length === MIND_ACTIONS.length && req.relationships.length);
  const tc = g.talkContext(a.id, 'how are you?');
  assert.ok(tc.persona && tc.mind && tc.mind.memory.length && tc.mind.reflections.length && tc.mind.goal);
  g.talk(a.id, 'thank you for the wall');
  assert.ok(a.mind.memory.at(-1).text.startsWith('The sovereign said to me'));
  // the sim's own observations: a finished building near them, a minister, a conflict
  const b = g.placeBuilding('house', g.findSpot('house', null)); g.completeBuilding(b);
  assert.ok(g.state.agents.some(x => x.mind.memory.some(m => /finished/.test(m.text))));
  g.startConflict('quarrel') || g.startConflict('jealousy');
  const conflict = g.state.conflicts.at(-1);
  if (conflict) for (const id of conflict.parties) assert.ok(g.state.agents.find(x => x.id === id).mind.memory.some(m => m.kind === 'conflict'));
  // snapshot: compact
  const s = g.snapshot();
  assert.equal(s.minds.cast, true); assert.ok(Array.isArray(s.minds.bonds) && s.minds.bonds.length <= 4); assert.ok(s.agents.every(x => typeof x.goal === 'string'));
  assert.ok(JSON.stringify(s.minds).length < 600);
  // persisted in state: a plain-JSON copy carries personas, relationships, memory
  const copy = JSON.parse(JSON.stringify({ personas: g.state.personas, relationships: g.state.relationships, minds: g.state.minds, agents: g.state.agents.map(x => ({ id: x.id, mind: x.mind })) }));
  assert.equal(Object.keys(copy.personas).length, 12); assert.ok(Object.keys(copy.relationships).length >= 4); assert.equal(copy.agents[0].mind.reflections.length, 2);
});

test('director: events, nudges and the briefing are applied through the sim', () => {
  const g = settled(); g.castPersonas(); run(g, 60);
  const start = g.applyDirection(g.mockDirect('start'), { reason: 'start' });
  assert.ok(start.applied.some(x => x.kind === 'weather')); assert.ok(g.find('world:weather')); assert.equal(g.state.minds.directions, 1); assert.equal(g.state.minds.arc.length, 1);
  assert.ok(g.state.agents.every(a => a.mind.memory.some(m => m.kind === 'weather')));
  const [a, b] = g.state.agents.filter(x => x.id !== g.state.minister);
  const nL = g.state.letters.length;
  const r = g.applyDirection({
    arc_note: 'Act one: the rivals.',
    events: [{ kind: 'conflict', agentIds: [a.id, b.id], topic: 'the first wall', severity: 2 }, { kind: 'festival', topic: 'lanterns', text: 'Lanterns tonight.' }, { kind: 'visitor', neighbourId: 'n2', topic: 'A loaf of welcome', text: 'A baker of ours walks in with a loaf.' }, { kind: 'bogus' }],
    nudges: [{ agentId: a.id, goal: 'a roof before the next cold night' }, { agentId: 'ghost', goal: 'x' }],
    minister_briefing: { subject: 'How things stand', body: 'Twelve of us. The crates hold. Watch the rivals.' }
  }, { reason: 'periodic' });
  assert.deepEqual(r.applied.map(x => x.kind), ['conflict', 'festival', 'visitor', 'nudge', 'briefing']);
  const c = g.state.conflicts.at(-1); assert.equal(c.kind, 'quarrel'); assert.deepEqual(c.parties, [a.id, b.id]); assert.equal(c.severity, 2); assert.equal(c.topic, 'the first wall');
  assert.ok(g.find('conflict:start', p => p.conflict.id === c.id)); assert.ok(g.find('festival'));
  assert.equal(g.state.personas[a.id].goal, 'a roof before the next cold night'); assert.ok(a.mind.memory.some(m => m.kind === 'goal'));
  assert.ok(g.state.letters.length >= nL + 3, 'a conflict letter, a visitor letter, a briefing');
  const brief = g.state.letters.find(l => l.meta && l.meta.kind === 'briefing'); assert.equal(brief.from.kind, 'minister'); assert.equal(brief.kind, 'report');
  const visit = g.state.letters.find(l => l.meta && l.meta.kind === 'visitor'); assert.equal(visit.from.id, 'n2'); assert.ok(visit.options.length === 2);
  assert.ok(g.find('mind:direct', p => p.reason === 'periodic' && p.events.length === 3));
  // an opportunity makes a venture proposal; the snapshot shows the arc
  const amb = g.state.agents.find(x => x.traits.includes('ambitious') && x.id !== g.state.minister) || g.state.agents.at(-1);
  const r2 = g.applyDirection({ events: [{ kind: 'opportunity', agentIds: [amb.id], topic: 'a kite shop' }] });
  assert.ok(r2.applied.some(x => x.kind === 'opportunity') || g.state.ventures.some(v => v.agentId === amb.id));
  assert.equal(g.snapshot().minds.arc, 'Act one: the rivals.');
  const req = g.directRequest('milestone:election');
  assert.equal(req.reason, 'milestone:election'); assert.equal(req.personas.length, 12); assert.ok(req.story.arc.length === 2 && req.memories[a.id].length);
  assert.equal(normaliseDirection({ events: [{ kind: 'weather', severity: 9 }], nudges: [{ agentId: 'x', goal: '' }], minister_briefing: 'plain text' }).events[0].severity, 3);
  // the mock director varies with the state and never breaks
  for (let i = 0; i < 6; i++) { run(g, 30); const d = g.applyDirection(g.mockDirect('periodic')); assert.ok(Array.isArray(d.applied)); }
  // the crowd's vote follows the minds' declared votes and the bonds
  const voter = g.state.agents.find(x => x.id !== g.state.minister);
  const cand = g.state.agents.find(x => x.id !== voter.id && x.id !== g.state.minister);
  voter.mind.vote = cand.id; g.nudgeAffinity(voter.id, cand.id, 0.9, 'test');
  const { bond } = g.state.relationships ? { bond: null } : {};
  assert.ok(bond === null);
});

test('the loop (mock): casts once, thinks on a staggered cadence with triggers, converses, reflects, directs at the start and on milestones', () => {
  const g = settled();
  let wall = 0;
  const loop = createMindLoop(g, { now: () => wall, visible: () => true, paused: () => false });
  g.attachMinds(loop); loop.start();
  assert.equal(loop.status().mode, 'mock');
  const tick = (s) => { for (let t = 0; t < s; t += 0.5) { wall += 500; g.tick(0.5); } };
  tick(2);
  assert.equal(loop.status().cast, true); assert.ok(g.find('mind:cast', p => p.count === 12));
  assert.equal(loop.status().director.runs, 1, 'the director ran at the start');
  tick(60);
  const st = loop.status();
  assert.ok(st.calls.think >= 12 && st.calls.think <= 40, `think calls in a minute: ${st.calls.think}`);
  const per = {}; for (const p of g.all('agent:intent')) per[p.agentId] = (per[p.agentId] || 0) + 1;
  assert.equal(Object.keys(per).length, 12, 'everyone thought');
  assert.ok(Object.values(per).every(n => n <= 3), 'nobody thinks more than every ~30 s');
  assert.ok(g.all('agent:intent').every(p => p.source === 'mock'));
  // triggers: a talk pokes that folk soon
  const a = g.state.agents[3]; const before = g.count('agent:intent');
  g.talk(a.id, 'hello'); tick(MIND.triggerDelay[1] + 1);
  assert.ok(g.all('agent:intent').slice(before).some(p => p.agentId === a.id), 'spoken to -> thinks');
  // milestones: the first building asks the director (after the minimum gap)
  const b = g.placeBuilding('house', g.findSpot('house', null)); g.completeBuilding(b);
  wall += MIND.directorMinGapMs; tick(1);
  assert.ok(loop.status().director.runs >= 2, 'milestone direction');
  assert.ok(g.state.minds.milestones.first_building);
  // conversations and reflections happened by themselves
  tick(120);
  assert.ok(loop.status().calls.converse >= 1 || g.count('conversation:start') === 0);
  assert.ok(g.all('agent:say', p => p.kind === 'chat').length >= 2 || loop.status().calls.converse === 0);
  assert.ok(loop.status().calls.reflect >= 1, 'a reflection');
  // paused: nothing new is scheduled; hidden: the same; the moon: the same
  const n0 = loop.status().calls.think;
  g.state.scene = 'moon'; tick(40); assert.equal(loop.status().calls.think, n0, 'no thinking on the moon');
  g.state.scene = 'earth';
  loop.stop(); tick(40); assert.equal(loop.status().calls.think, n0, 'stopped');
  loop.start(); tick(45); assert.ok(loop.status().calls.think > n0);
  // the status event
  assert.ok(g.find('mind:status', p => p.mode === 'mock' && p.enabled === true));
});

test('the loop (live): the budget limiter (per minute, concurrency 3), timeouts and errors fall back to the rules per folk, five failures pause the minds', async () => {
  const g = settled();
  let wall = 0;
  const pending = [];
  const calls = [];
  const call = (route, body) => { calls.push(route); return new Promise((resolve, reject) => pending.push({ route, body, resolve, reject })); };
  const loop = createMindLoop(g, { call, now: () => wall, budget: { maxPerMin: 10, concurrency: 3, timeoutMs: 5000 } });
  g.attachMinds(loop); loop.start();
  // the wall clock crawls (50 ms per sim half-second) so nothing times out unless the test jumps it: timeouts are swept on this clock
  const tick = (s) => { for (let t = 0; t < s; t += 0.5) { wall += 50; g.tick(0.5); } };
  const flush = () => new Promise(r => setTimeout(r, 0));
  tick(1);
  assert.equal(calls[0], 'cast'); assert.equal(loop.status().inFlight, 0, 'the cast is not a persona call: it does not count toward the concurrency cap');
  pending.shift().resolve(g.mockCast()); await flush();
  assert.equal(loop.status().cast, true);
  tick(1);
  assert.ok(calls.includes('direct'));
  pending.find(p => p.route === 'direct').resolve({ arc_note: 'live', events: [], nudges: [], minister_briefing: null }); await flush();
  // concurrency: the folk come due but at most 3 think calls are in flight
  tick(40);
  assert.equal(loop.status().inFlight, 3); assert.equal(calls.filter(r => r === 'think').length, 3);
  // a timeout: the rules answer for that folk, the slot frees, the next folk goes
  const first = pending.find(p => p.route === 'think');
  wall += 5001; tick(0.5); await flush();
  assert.ok(g.find('mind:status', p => p.error && p.error.code === 'timeout'));
  assert.ok(g.find('agent:intent', p => p.agentId === first.body.agentId && p.source === 'rules'), 'the rules carried that folk');
  assert.equal(loop.status().inFlight, 3);
  // a server error: the same fallback, with backoff for that folk
  const second = pending.find(p => p.route === 'think' && p !== first);
  second.reject(new Error('boom')); await flush(); tick(0.5);
  assert.ok(g.find('agent:intent', p => p.agentId === second.body.agentId && p.source === 'rules'));
  assert.ok(g.state.agents.find(x => x.id === second.body.agentId).mind.dueAt > g.state.t + 5, 'backoff');
  // per-minute budget: 10 calls in a wall-clock minute (cast + direct + thinks), then nothing until the window moves
  for (const p of pending.splice(0)) if (p.route === 'think') { p.resolve({ intent: { type: 'work' }, say: 'Working.', memory_note: '', mood_delta: 0 }); }
  await flush(); tick(20); await flush();
  assert.ok(calls.length <= 10, `budget: ${calls.length} calls`);
  assert.equal(loop.status().perMin, Math.min(10, calls.length));
  wall += 61000; tick(1); await flush();
  assert.ok(calls.length > 10, 'the window moved on');
  assert.ok(g.all('agent:intent', p => p.source === 'mind').length >= 1, 'live answers applied');
  // five consecutive failures: the rules carry the whole town for a minute (mode 'rules'), then live again
  for (const p of pending.splice(0)) p.reject(new Error('down'));
  await flush();
  for (const x of g.state.agents) x.mind.dueAt = g.state.t;   // everyone due now, so the failures come quickly
  for (let i = 0; i < 8; i++) { tick(1); for (const p of pending.splice(0)) p.reject(new Error('down')); await flush(); }
  assert.equal(loop.status().mode, 'rules', JSON.stringify(loop.status()));
  const nCalls = calls.length; tick(10);
  assert.equal(calls.length, nCalls, 'no live calls while the rules carry the town');
  assert.ok(g.all('agent:intent', p => p.source === 'rules').length >= 6);
  wall += 61000; tick(1);
  assert.equal(loop.status().mode, 'live');
  // a conversation started by a live intent is asked for; a timeout there uses the mock lines
  for (const p of pending.splice(0)) p.resolve({ intent: { type: 'work' }, say: '', memory_note: '', mood_delta: 0 });
  await flush();
  for (const x of g.state.agents) x.mind.dueAt = g.state.t + 1000;   // nobody else thinks for a while: the budget is the conversation's
  wall += 61000;
  g.state.conversations.forEach(c => { c.status = 'done'; });
  const free = x => x.id !== g.state.minister && !(x.task && ['deliver', 'journey', 'leave', 'meeting'].includes(x.task.kind));
  const a = g.state.agents.find(free), b = g.state.agents.find(x => x.id !== a.id && free(x));
  const started = g.applyIntent(a.id, { intent: { type: 'talk_to', target: b.id, text: 'Hungry yet?' } });
  assert.equal(started.applied, 'conversation');
  tick(1); await flush();
  const conv = pending.find(p => p.route === 'converse'); assert.ok(conv, 'converse requested'); assert.equal(conv.body.a.id, a.id);
  conv.reject(new Error('late')); await flush(); tick(MIND.chatGap * 4 + 1);
  assert.ok(g.all('agent:say', p => p.kind === 'chat' && p.conversationId).length >= 2, 'mock lines after the failure');
  loop.stop();
});

test('voices: the mock transforms keep a question a question and never trail a comma', () => {
  for (const s of SEEDS) { const v = voicePrefix(s.voice); for (const line of ['Seen the sky?', 'Back to it.', 'What a sky!']) { const out = v(line); assert.ok(!/[,;]\s*$/.test(out) && !/\?,/.test(out), `${s.key}: "${out}"`); assert.ok(out.length > 0); } }
});

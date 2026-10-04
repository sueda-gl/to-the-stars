// ART_DIRECTION §11: folk answer in simple, short, plain sentences (bubbles); a small memory of talks; spontaneous lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';
import { mockTalk, talkIntent, buildNoun, trimReply, SAY } from '../../web/js/sim/talk.js';

const short = s => { const marks = (s.match(/[.!?]+/g) || []).length; return marks <= 3 && s.length <= 170 && !/\n/.test(s); };   // two sentences (a two-word question may ride with the next)

test('trimReply: at most two short sentences, plain', () => {
  assert.equal(trimReply('One. Two. Three.'), 'One. Two.');
  assert.equal(trimReply('  Hello   there!  '), 'Hello there!');
  assert.ok(trimReply('a'.repeat(400) + '. b.').length <= 170);
  assert.equal(trimReply(''), '');
});

test('intents and the build noun', () => {
  assert.equal(talkIntent('hello there'), 'greeting');
  assert.equal(talkIntent('how are you?'), 'howAreYou');
  assert.equal(talkIntent('what do you do?'), 'whatDo');
  assert.equal(talkIntent('what do you want?'), 'want');
  assert.equal(talkIntent('what do you think of the minister?'), 'minister');
  assert.equal(talkIntent('do you like the neighbours?'), 'neighbours');
  assert.equal(talkIntent('could we build a well?'), 'build');
  assert.equal(talkIntent('thank you'), 'thanks');
  assert.equal(talkIntent(''), 'empty');
  assert.equal(buildNoun('could you build a well'), 'well');
  assert.equal(buildNoun('we need a tea house here'), 'tea house');
  assert.equal(buildNoun('what should we build?'), null);
});

test('mockTalk: a short, plain, in-character reply for every intent; builds become actions', () => {
  const agent = { id: 'f1', name: 'Pim', species: 'flit', trade: 'builder', traits: ['proud'], mood: 72, skills: { building: 8, baking: 2 }, job: 'gatherer at the camp', fleet: 'The Builders' };
  const qs = ['hello', 'how are you?', 'who are you?', 'what do you do?', 'what are you good at?', 'what do you want?', 'do you like this town?', 'what about the minister?', 'the neighbours?', 'are you hungry?', 'do you have a house?', 'which fleet are you in?', 'thank you', 'go and rest', 'could you build a well?', 'bye', 'yes', 'no', 'blah blah'];
  for (const q of qs) {
    const r = mockTalk({ agent, text: q, history: [], snapshot: { agents: [agent] } });
    assert.ok(r.reply && short(r.reply), `${q} -> "${r.reply}"`);
    assert.ok(Math.abs(r.mood) <= 5);
  }
  assert.match(mockTalk({ agent, text: 'what are you good at?' }).reply, /best here|Ten out of ten/);
  assert.match(mockTalk({ agent: { ...agent, traits: ['timid'] }, text: 'what are you good at?' }).reply, /Others are better/);
  const b = mockTalk({ agent, text: 'could you build a well?' });
  assert.deepEqual(b.action, { type: 'build', request: 'a well', say: 'build a well' });
  assert.equal(mockTalk({ agent, text: 'how are you?', snapshot: { hungry: true } }).reply.includes('ungry'), true);
  assert.equal(mockTalk({ agent, text: 'hello' }).reply, mockTalk({ agent, text: 'hello' }).reply, 'deterministic');
  assert.match(mockTalk({ agent: { ...agent, isMinister: true }, text: 'minister?' }).reply, /seal/);
});

test('game.talk: the offline mind answers, the bubble is said, the mood nudges, the exchange is remembered; a server reply is taken as is (trimmed); actions apply', () => {
  const g = game();
  const a = g.state.agents[0];
  const r = g.talk(a.id, 'how are you?');
  assert.equal(r.ok, true); assert.ok(short(r.reply));
  assert.ok(g.find('agent:say', p => p.agentId === a.id && p.text === r.reply && p.kind === 'talk' && p.ttl > 0));
  assert.ok(g.find('agent:listen', p => p.agentId === a.id));
  assert.equal(a.memory.talks.length, 1); assert.equal(a.memory.talks[0].you, 'how are you?');
  const ctx = g.talkContext(a.id, 'and your job?');
  assert.equal(ctx.agentId, a.id); assert.equal(ctx.agent.name, a.name); assert.ok(ctx.agent.job && ctx.agent.traits && ctx.agent.skills);
  assert.equal(ctx.history.length, 1); assert.equal(ctx.text, 'and your job?'); assert.ok(ctx.snapshot.agents);
  const r2 = g.talk(a.id, 'well done', { reply: 'That is kind. I will haul twice as fast. And a third sentence that is dropped.', mood: 9, action: null });
  assert.equal(r2.reply, 'That is kind. I will haul twice as fast.'); assert.equal(r2.mood, 5, 'clamped');
  for (let i = 0; i < 10; i++) g.talk(a.id, 'hi');
  assert.equal(a.memory.talks.length, 6, 'a small memory');
  const r3 = g.talk(a.id, 'could you build a well?');
  assert.ok(r3.action && r3.applied && r3.applied.ok, JSON.stringify(r3));
  const well = g.state.buildings.find(b => b.kind === 'well');
  assert.ok(well && well.workers.includes(a.id), 'they start it themselves');
  const r4 = g.talk(a.id, 'rest now', { reply: 'Gladly.', mood: 0, action: { type: 'rest' } });
  assert.equal(r4.applied.ok, true); assert.equal(a.status, 'resting');
  assert.equal(g.talk('nobody', 'hi').ok, false);
});

test('spontaneous one-liners: a few a minute, in context, none while the squares stand', () => {
  const g = game();
  g.spawnAll();
  run(g, 60, 0.5);
  assert.equal(g.count('agent:say'), 0, 'quiet during the formation / intro / election');
  g.releaseFleets();
  g.state.election = null;
  const n0 = g.count('agent:say');
  run(g, 120, 0.5);
  const n = g.count('agent:say') - n0;
  assert.ok(n >= 3 && n <= 10, `${n} lines in two minutes`);
  for (const p of g.all('agent:say')) assert.ok(p.text && short(p.text) && p.ttl === SAY.ttl || p.kind !== 'idle', JSON.stringify(p));
  g.state.resources.food = 0; g.state.acc.food = 0;
  run(g, 60, 0.5);
  assert.ok(g.all('agent:say').slice(-3).some(p => /stomach|bread|crates/i.test(p.text)), 'hunger shows in the lines');
});

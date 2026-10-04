import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';
import { crowdAnswers, makeFolk } from '../../web/js/sim/society.js';
import { createRng } from '../../web/js/sim/rng.js';

test('starvation produces complaint letters, mood falls', () => {
  const g = game();
  g.state.resources.food = 0;
  const mood0 = g.state.mood;
  run(g, 20, 0.1);
  const hunger = g.state.letters.filter(l => l.kind === 'complaint' && l.meta.reason === 'hunger');
  assert.ok(hunger.length >= 1, 'hunger complaint written');
  assert.match(hunger[0].body, /hungry|crumbs|bare|eat/i);
  assert.ok(hunger[0].options.some(o => /farm|bakery/i.test(o.label)));
  assert.ok(g.state.hungry);
  run(g, 60, 0.5);
  assert.ok(g.state.mood < mood0 - 5, `mood fell (${mood0} -> ${g.state.mood})`);
  assert.ok(g.count('agent:mood') > 0);
  // the letter lands via a courier or the fallback, and shows up unread in the snapshot
  assert.ok(hunger[0].delivered);
  assert.ok(g.snapshot().unread.some(u => u.id === hunger[0].id));
});

test('homeless and overwork complaints', () => {
  const g = game();
  g.state.resources.food = 200;
  run(g, 60 * 2 + 5, 0.5);
  assert.ok(g.state.letters.some(l => l.kind === 'complaint' && l.meta.reason === 'homeless'), 'homeless complaint by day 3');
  g.apply({ type: 'build', kind: 'quarry', at: { mode: 'auto' } });
  const b = g.state.buildings.at(-1);
  const w = g.state.agents.find(a => b.workers.includes(a.id));
  run(g, 8, 0.1);
  w.flags.exhausted = 1; w.energy = 5; w.status = 'working';
  g.tick(0.1);
  assert.ok(g.state.letters.some(l => l.kind === 'complaint' && l.meta.reason === 'overwork' && l.from.id === w.id), 'overwork complaint');
});

test('ask_crowd: 1-3 folk answer by letter, proud over-claim, timid under-claim', () => {
  const rng = createRng(11);
  const proud = makeFolk(rng, { species: 'loaf', name: 'Pepe' }); proud.traits = ['proud']; proud.skills.baking = 4;
  const timid = makeFolk(rng, { species: 'loaf', name: 'Ferro' }); timid.traits = ['timid']; timid.skills.baking = 9;
  const honest = makeFolk(rng, { species: 'pip', name: 'Mimmo' }); honest.traits = ['loyal']; honest.skills.baking = 7;
  const dud = makeFolk(rng, { species: 'flit', name: 'Alba' }); dud.traits = ['lazy']; dud.skills.baking = 0;
  const ans = crowdAnswers([proud, timid, honest, dud], 'baking', rng, 3);
  assert.ok(ans.length >= 1 && ans.length <= 3);
  const p = ans.find(x => x.agent === proud), t = ans.find(x => x.agent === timid);
  assert.ok(p && p.claimed > 4, 'proud over-claims');
  if (t) assert.ok(t.claimed < 9, 'timid under-claims');
  assert.ok(!ans.some(x => x.agent === dud), 'the lazy dud stays quiet');

  const g = game();
  const r = g.apply({ type: 'ask_crowd', question: "who's good at baking?" });
  assert.equal(r.ok, true);
  assert.equal(r.effects[0].skill, 'baking');
  const letters = g.state.letters.filter(l => l.kind === 'skill_answer');
  assert.ok(letters.length >= 1 && letters.length <= 3, `${letters.length} answers`);
  for (const l of letters) {
    assert.match(l.body, /baking/);
    const a = g.state.agents.find(x => x.id === l.from.id);
    assert.equal(a.known.baking, true, 'skill is now known on the card');
    assert.equal(typeof a.claims.baking, 'number');
  }
  run(g, 15, 0.1);
  assert.ok(letters.every(l => l.delivered), 'answers delivered within seconds');
  assert.ok(g.find('agent:task', p => p.task.kind === 'deliver' && p.task.carrying === 'letter'), 'a courier carried them');
});

test('message_agent, appoint_minister and call_meeting', () => {
  const g = game();
  const r1 = g.apply({ type: 'message_agent', agentId: 'Olla', text: 'How are you feeling?' });
  assert.equal(r1.ok, true);
  assert.ok(g.state.letters.some(l => l.kind === 'reply' && l.from.name === 'Olla'));
  const r2 = g.apply({ type: 'appoint_minister', agentId: 'olla' });
  assert.equal(r2.ok, true);
  const olla = g.state.agents.find(a => a.name === 'Olla');
  assert.equal(g.state.minister, olla.id);
  assert.ok(g.find('minister:set', p => p.agentId === olla.id));
  assert.ok(g.state.letters.some(l => l.kind === 'report' && l.from.kind === 'minister'));
  const r3 = g.apply({ type: 'call_meeting' });
  assert.equal(r3.ok, true);
  assert.ok(g.find('meeting:start'));
  run(g, 5, 0.1);
  assert.ok(g.state.agents.filter(a => a.status === 'meeting' || (a.task && a.task.kind === 'gather')).length >= 10, 'folk gather');
  const report = g.state.letters.find(l => l.kind === 'report' && /Minutes/.test(l.subject));
  assert.ok(report, 'minister wrote the minutes');
  assert.match(report.body, /Residents/);   // §24: plain report wording
  run(g, 25, 0.1);
  assert.ok(g.find('meeting:end'));
  assert.ok(g.state.agents.every(a => a.status !== 'meeting'));
});

test('neighbours write, trades move resources, replies apply consequences', () => {
  const g = game();
  run(g, 200, 0.5);
  const greet = g.state.letters.filter(l => l.kind === 'neighbour_greeting');
  assert.equal(greet.length, 3, 'all three neighbours said hello');
  const n = g.state.neighbours[1];
  g.state.resources.wood = 20;
  const r = g.apply({ type: 'trade', neighbourId: n.id, give: { wood: 5 }, get: { food: 8 } });
  assert.equal(r.ok, true);
  assert.equal(g.state.resources.wood, 15);
  // a petition answered yes starts the building and lifts mood
  const { petition } = await_letters(g);
  const a = g.state.agents.find(x => x.id === petition.from.id);
  const mood = a.mood;
  g.state.resources.coin = 20; g.state.resources.stone = 30; g.state.resources.wood = 30;
  const rr = g.apply({ type: 'reply_letter', letterId: petition.id, decision: 'yes', text: 'yes let us' });
  assert.equal(rr.ok, true);
  assert.ok(petition.resolved);
  assert.ok(a.mood > mood);
  if (petition.meta.wish) assert.ok(g.state.buildings.some(b => b.kind === petition.meta.wish), 'wished building placed');
});

function await_letters(g) {
  let petition = g.state.letters.find(l => l.kind === 'petition' || l.kind === 'idea');
  let guard = 0;
  while (!petition && guard++ < 20) { run(g, 60, 0.5); petition = g.state.letters.find(l => l.kind === 'petition' || l.kind === 'idea'); }
  assert.ok(petition, 'society wrote a petition or idea');
  return { petition };
}

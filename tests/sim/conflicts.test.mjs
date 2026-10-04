// ART_DIRECTION §15: conflicts emerge from the state, the minister brings them with quick replies, the sovereign answers
// with words or with institutions (a police patrol, a night watch, a court, a school, a guild, a festival committee...).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';
import { CONFLICT, INSTITUTION_SPECS, institutionKind, normaliseHow, patrolRoute } from '../../web/js/sim/conflicts.js';
import { BAL } from '../../web/js/sim/society.js';

const hungryTown = (opts = {}) => {
  const g = game(opts);
  g.spawnAll({ fleets: false });
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  g.state.resources.food = 0;
  return g;
};
const minister = g => g.state.agents.find(a => a.id === g.state.minister);

test('conflicts emerge from the state: nothing before ~3 min, then a theft at the crates in a hungry town; the minister writes with quick replies; the events carry the contract', () => {
  const g = hungryTown();
  run(g, CONFLICT.firstAfter - 5, 0.5);
  assert.equal(g.state.conflicts.length, 0, 'quiet at first');
  run(g, 20, 0.5);
  assert.ok(g.state.conflicts.length >= 1, 'a conflict came');
  const c = g.state.conflicts[0];
  assert.equal(c.kind, 'theft', 'an unfed town steals first: ' + c.summary);
  assert.ok(c.id && Array.isArray(c.parties) && c.parties.length === 2 && Number.isFinite(c.place.x) && Number.isFinite(c.place.z));
  assert.ok(c.severity >= 1 && c.severity <= 3 && c.status === 'open' && typeof c.summary === 'string' && c.summary.length < 120 && Number.isFinite(c.since));
  assert.ok(c.roles.offender && c.roles.complainant, 'a thief and a witness');
  assert.ok(Math.hypot(c.place.x - g.state.stockpile.x, c.place.z - g.state.stockpile.z) < 4, 'at the stockpile');
  const ev = g.find('conflict:start', p => p.conflict.id === c.id);
  assert.ok(ev && ev.p.conflict.summary === c.summary);
  assert.ok(g.find('agent:say', p => p.kind === 'conflict' && p.agentId === c.roles.complainant), 'the witness says so in a bubble');
  const l = g.state.letters.find(x => x.id === c.letterId);
  assert.ok(l && l.kind === 'conflict' && l.from.kind === 'minister' && l.from.id === g.state.minister, 'the minister brings it');
  assert.deepEqual(l.options.map(o => o.says), ['talk to them', 'punish the thief', 'start a police patrol', 'build a granary', 'ignore it']);
  assert.equal(l.meta.quick, 3);
  assert.equal(l.meta.conflictId, c.id);
  assert.deepEqual(l.effects.yes, [{ type: 'conflict', conflictId: c.id, how: 'talk' }]);
  assert.match(l.body, /took bread from the crates/);
  const snap = g.snapshot();
  assert.ok(snap.conflicts && snap.conflicts[0].id === c.id && snap.conflicts[0].summary === c.summary && snap.conflicts[0].status === 'open');
  assert.ok(JSON.stringify(snap.conflicts).length < 600, 'compact');
});

test("the minister's advice follows their traits; without a minister the Ministry writes; every kind has its own replies", () => {
  const g = hungryTown();
  const m = minister(g);
  const bodies = {};
  for (const traits of [['proud'], ['timid'], ['generous'], ['ambitious'], ['stubborn'], ['gossip'], ['lazy'], ['loyal']]) {
    m.traits = traits;
    const c = g.startConflict('theft');
    assert.ok(c, 'a theft draft for ' + traits);
    bodies[traits[0]] = g.state.letters.find(x => x.id === c.letterId).body;
    g.resolveConflict(c.id, 'talk'); c.status = 'resolved';   // over at once, so the parties are free for the next draft
  }
  assert.match(bodies.proud, /punish it/); assert.match(bodies.timid, /quiet word/); assert.match(bodies.generous, /Feed them/); assert.match(bodies.ambitious, /Give me a patrol/);
  assert.match(bodies.stubborn, /said before/); assert.match(bodies.gossip, /not the first time/); assert.match(bodies.lazy, /wait/); assert.match(bodies.loyal, /carry it out/);
  assert.equal(new Set(Object.values(bodies)).size, 8, 'eight different advice lines');
  // the kinds and their quick replies
  const h = hungryTown();
  const seen = {};
  for (const kind of ['quarrel', 'noise', 'land', 'neglect', 'envoy', 'jealousy']) {
    if (kind === 'noise') { const w = finish(h, 'workshop'); const house = finish(h, 'house', { x: w.x + 6, z: w.z }); h.tick(0.1); const a = h.state.agents.find(x => x.homeId === house.id); assert.ok(a, 'someone lives by the workshop'); }
    if (kind === 'neglect') { const b = finish(h, 'farm'); h.tick(0.1); const w = h.state.agents.find(x => x.jobId === b.id); if (w) w.traits = ['lazy']; }
    if (kind === 'envoy') h.state.neighbours[0].attitude = 20;
    if (kind === 'land' || kind === 'jealousy') for (const a of h.state.agents.slice(0, 4)) if (a.id !== h.state.minister) a.traits = ['ambitious'];
    const c = h.startConflict(kind);
    assert.ok(c, `a ${kind} draft`); assert.equal(c.kind, kind);
    const l = h.state.letters.find(x => x.id === c.letterId);
    seen[kind] = l.options.map(o => o.says);
    assert.ok(l.options.length >= 3 && l.options.at(-1).says === 'ignore it', kind);
    h.resolveConflict(c.id, 'talk'); c.status = 'resolved';
  }
  assert.ok(seen.quarrel.includes('set up a court') && seen.noise.includes('start a night watch') && seen.neglect.includes('open a school') && seen.envoy[0] === 'compensate them' && seen.jealousy.includes('start a council'));
  // no minister: the Ministry brings it
  const n = game(); n.spawnAll({ fleets: false }); n.state.resources.food = 0;
  const c = n.startConflict('theft');
  const l = n.state.letters.find(x => x.id === c.letterId);
  assert.equal(l.from.kind, 'ministry'); assert.match(l.body, /Ministry suggests/);
});

test('resolve paths: talk / punish / compensate / ignore / free text; handled -> resolved after a while; the minister walks to the place; the letter is answered', () => {
  const g = hungryTown();
  const c = g.startConflict('theft');
  const thief = g.state.agents.find(a => a.id === c.roles.offender), witness = g.state.agents.find(a => a.id === c.roles.complainant);
  const m0 = thief.mood, w0 = witness.mood, l0 = thief.loyalty;
  const r = g.apply({ type: 'resolve_conflict', conflictId: c.id, how: 'punish' });
  assert.equal(r.ok, true); assert.equal(r.effects[0].type, 'conflict'); assert.equal(r.effects[0].how, 'punish'); assert.equal(c.status, 'handled');
  assert.ok(thief.mood < m0 && thief.loyalty < l0 && witness.mood > w0, 'the thief suffers, the witness is content');
  assert.ok(g.find('conflict:handle', p => p.conflictId === c.id && p.how === 'punish' && p.by === 'sovereign' && p.agentId === g.state.minister), 'the minister goes to see to it');
  assert.ok(g.find('agent:task', p => p.agentId === g.state.minister && p.task.kind === 'walk' && p.task.duty === 'settle' && p.task.conflictId === c.id));
  assert.ok(g.state.letters.find(x => x.id === c.letterId).resolved, 'the letter is answered');
  assert.ok(g.find('letter:resolved', p => p.letterId === c.letterId));
  run(g, CONFLICT.settleSeconds + 1, 0.5);
  assert.equal(c.status, 'resolved');
  assert.ok(g.find('conflict:resolve', p => p.conflictId === c.id && p.how === 'punish'));
  // talk: everyone a little happier; compensate: food leaves the crates, the victim is glad; free text maps to a path
  g.state.resources.food = 10;
  const c2 = g.startConflict('quarrel'); assert.ok(c2);
  const [a, b] = c2.parties.map(id => g.state.agents.find(x => x.id === id));
  const am = a.mood, bm = b.mood;
  g.apply({ type: 'resolve_conflict', how: 'have a word with both of them' });   // no id: the newest open one; free text -> talk
  assert.equal(c2.how, 'talk'); assert.ok(a.mood > am && b.mood > bm);
  const c3 = g.startConflict('theft'); assert.ok(c3);
  const f0 = g.state.resources.food, v = g.state.agents.find(x => x.id === c3.roles.complainant), vm = v.mood;
  g.apply({ type: 'resolve_conflict', conflictId: c3.id, how: 'give them some bread to make up for it' });
  assert.equal(c3.how, 'compensate'); assert.equal(g.state.resources.food, f0 - 3); assert.ok(v.mood > vm);
  assert.equal(normaliseHow('lock him up'), 'punish'); assert.equal(normaliseHow('let it be'), 'ignore'); assert.equal(normaliseHow('hear them out'), 'talk');
  // ignore: stays open, the victim sulks, it escalates sooner
  const c4 = g.startConflict('theft'); assert.ok(c4);
  const sev0 = c4.severity;
  const v4 = g.state.agents.find(x => x.id === c4.roles.complainant), v4m = v4.mood;
  const r4 = g.apply({ type: 'reply_letter', letterId: c4.letterId, decision: 'no' });
  assert.equal(r4.ok, true); assert.equal(c4.status, 'open'); assert.equal(c4.ignored, true); assert.ok(v4.mood < v4m);
  assert.ok(g.find('conflict:handle', p => p.conflictId === c4.id && p.how === 'ignore'));
  run(g, CONFLICT.ignoredEscalateAfter + 2, 0.5);
  assert.equal(c4.status, 'escalated'); assert.equal(c4.severity, sev0 + 1);
  // the letter's yes = talk
  const c5 = g.startConflict('theft'); assert.ok(c5);
  g.apply({ type: 'reply_letter', letterId: c5.letterId, decision: 'yes' });
  assert.equal(c5.status, 'handled'); assert.equal(c5.how, 'talk');
  assert.equal(g.apply({ type: 'resolve_conflict', conflictId: 'nope' }).ok, true, 'an unknown id falls back to the newest open one');
});

test('an unanswered conflict escalates: severity up, mood and loyalty down (floored like hunger); ignored, a strike at full severity, and after a long time the aggrieved folk leaves', () => {
  const g = hungryTown();
  const c = g.startConflict('theft');
  const victim = g.state.agents.find(a => a.id === c.roles.complainant);
  const m0 = victim.mood, l0 = victim.loyalty;
  run(g, CONFLICT.escalateAfter + 2, 0.5);
  assert.equal(c.severity, 2); assert.equal(c.status, 'escalated');
  assert.ok(victim.mood < m0 && victim.loyalty < l0);
  assert.ok(victim.mood >= BAL.hungerFloor - 0.01, 'floored: silence sours, it does not break');
  const e = g.find('conflict:escalate', p => p.conflictId === c.id);
  assert.ok(e && e.p.severity === 2 && e.p.consequence === 'mood' && e.p.summary === c.summary);
  g.resolveConflict(c.id, 'ignore');   // "ignore it": the strike is on the sovereign's head
  victim.mood = 40;
  run(g, CONFLICT.ignoredEscalateAfter + 2, 0.5);
  assert.equal(c.severity, 3);
  assert.ok(g.find('conflict:escalate', p => p.conflictId === c.id && p.severity === 3 && p.consequence === 'strike'), 'a strike');
  assert.ok(g.find('agent:task', p => p.agentId === victim.id && p.task.kind === 'strike'));
  // ... and, long after, they leave (the 15-minute grace of the demo lifted for the test)
  const keep = BAL.noLeaveBefore; BAL.noLeaveBefore = 0;
  try {
    for (let i = 0; i < 20; i++) { run(g, (CONFLICT.leaveAfter + 5) / 20, 0.5); victim.mood = 40; }
    assert.equal(c.status, 'resolved'); assert.equal(c.how, 'left');
    assert.ok(g.find('conflict:escalate', p => p.conflictId === c.id && p.consequence === 'left' && p.agentId === victim.id));
    assert.ok(g.find('agent:leave', p => p.agentId === victim.id));
  } finally { BAL.noLeaveBefore = keep; }
  // the rate: noticeable, not spam (never more than maxOpen at once; a few a minute at most when unhappy)
  const h = hungryTown();
  h.on('conflict:start', p => h.resolveConflict(p.conflict.id, 'talk'));
  run(h, 900, 0.5);
  const n = h.count('conflict:start');
  assert.ok(n >= 4 && n <= 14, `${n} conflicts in 15 hungry minutes`);
  const q = game(); q.spawnAll({ fleets: false }); q.apply({ type: 'appoint_minister', agentId: 'Olla' }); q.state.resources.food = 300; for (const a of q.state.agents) { a.mood = 85; a.loyalty = 80; }
  q.on('conflict:start', p => q.resolveConflict(p.conflict.id, 'talk'));
  run(q, 900, 0.5);
  assert.ok(q.count('conflict:start') < n, `a content town quarrels less (${q.count('conflict:start')} < ${n})`);
});

test('founding a police patrol: fitting folk get the role, a uniform tag and a route round the crates; theft drops sharply over simulated days; members are not drafted to sites or the camp', () => {
  const g = hungryTown();
  const r = g.apply({ type: 'found_institution', kind: 'police patrol' });
  assert.equal(r.ok, true);
  const eff = r.effects[0];
  assert.equal(eff.type, 'institution'); assert.equal(eff.kind, 'patrol'); assert.equal(eff.name, 'Police Patrol'); assert.equal(eff.members.length, 2); assert.equal(eff.badge, 'blue armband');
  const inst = g.state.institutions[0];
  assert.equal(inst.status, 'active'); assert.ok(inst.members.includes(inst.leader)); assert.ok(!inst.members.includes(g.state.minister));
  for (const id of inst.members) { const a = g.state.agents.find(x => x.id === id); assert.deepEqual({ ...a.role, leader: undefined }, { institutionId: inst.id, kind: 'patrol', title: 'constable', badge: 'blue armband', leader: undefined }); assert.ok(!a.traits.includes('lazy'), 'a lazy folk is not picked when others fit'); }
  assert.ok(g.find('institution:found', p => p.institution.id === inst.id && p.institution.members.length === 2));
  assert.equal(g.all('institution:assign', p => p.institutionId === inst.id).length, 2);
  const asg = g.find('institution:assign');
  assert.deepEqual(asg.p.uniform, { institution: 'patrol', badge: 'blue armband', title: 'constable', leader: asg.p.agentId === inst.leader });
  assert.ok(g.state.letters.some(l => l.kind === 'ministry' && l.meta.kind === 'institution' && /blue armband/.test(l.body)), 'the Ministry records it');
  run(g, 12, 0.5);
  const pat = g.find('institution:patrol', p => p.institutionId === inst.id);
  assert.ok(pat && pat.p.route.length >= 3 && pat.p.route.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)), 'a route');
  assert.ok(pat.p.route.some(p => Math.hypot(p.x - g.state.stockpile.x, p.z - g.state.stockpile.z) < 4), 'round the stockpile');
  assert.ok(g.find('agent:task', p => inst.members.includes(p.agentId) && p.task.kind === 'walk' && p.task.duty === 'patrol' && p.task.institutionId === inst.id));
  g.tick(0.5);
  for (const id of inst.members) { const a = g.state.agents.find(x => x.id === id); assert.equal(a.job, 'constable of the Police Patrol'); }
  const snap = g.snapshot();
  assert.deepEqual(snap.institutions, [{ id: inst.id, kind: 'patrol', name: 'Police Patrol', members: inst.members.slice(), leader: inst.leader, badge: 'blue armband' }]);
  assert.ok(snap.agents.filter(a => a.role === 'patrol').length === 2);
  // a site never takes a constable, nor does the camp
  g.state.resources.wood = 50; g.state.resources.stone = 50;
  g.apply({ type: 'build', kind: 'house', at: { mode: 'auto' } });
  run(g, 30, 0.5);
  for (const b of g.state.buildings) for (const id of b.workers) assert.ok(!inst.members.includes(id), 'no constable on the crew');
  assert.ok(!g.find('agent:task', p => inst.members.includes(p.agentId) && p.task.camp), 'no constable at the camp');
  assert.ok(!(g.state.rates.camp && g.state.rates.camp.wood > 0 && g.state.agents.filter(a => !a.jobId && !a.role && a.id !== g.state.minister).length === 0));
  // theft over simulated days: the same hungry town with and without the patrol (every conflict answered, so the stream never caps)
  const thefts = (withPatrol) => {
    const h = hungryTown();
    if (withPatrol) h.apply({ type: 'found_institution', kind: 'police patrol' });
    h.on('conflict:start', p => h.resolveConflict(p.conflict.id, 'talk'));
    h.on('day', () => { h.state.resources.food = 0; });
    run(h, 60 * 30, 0.5);
    return { thefts: h.all('conflict:start', p => p.conflict.kind === 'theft').length, all: h.count('conflict:start') };
  };
  const without = thefts(false), withP = thefts(true);
  assert.ok(without.thefts >= 4, `thefts without a patrol over 30 days: ${without.thefts} of ${without.all}`);
  assert.ok(withP.thefts <= Math.max(1, Math.floor(without.thefts * 0.4)), `thefts with a patrol: ${withP.thefts} of ${withP.all} (without: ${without.thefts})`);
});

test('a patrol settles noise and theft on the spot; a court holds sessions in the square and settles quarrels with a fairness lift; a festival lifts everyone; a school teaches; a guild, a free-text society', () => {
  const g = hungryTown();
  const c = g.startConflict('theft'); assert.ok(c);
  g.apply({ type: 'found_institution', kind: 'start a police patrol team', members: 3 });
  const inst = g.state.institutions[0];
  assert.equal(inst.members.length, 3);
  run(g, 40, 0.5);
  assert.equal(c.status === 'handled' || c.status === 'resolved', true, 'the patrol settled the theft: ' + c.status);
  assert.equal(c.by, 'institution');
  const act = g.find('institution:act', p => p.kind === 'settle' && p.conflictId === c.id);
  assert.ok(act && inst.members.includes(act.p.agentId) && act.p.institutionId === inst.id);
  assert.ok(g.find('conflict:handle', p => p.conflictId === c.id && p.by === 'institution' && p.institutionId === inst.id));
  // a court
  g.state.resources.food = 50;
  const q = g.startConflict('quarrel'); assert.ok(q);
  const r = g.apply({ type: 'found_institution', kind: 'court', leader: 'Olla' });   // Olla is minister: not allowed, the best diplomat left is picked
  assert.equal(r.ok, true);
  const court = g.state.institutions.find(i => i.kind === 'court');
  assert.equal(court.members.length, 1); assert.notEqual(court.leader, g.state.minister);
  const judge = g.state.agents.find(a => a.id === court.leader);
  assert.equal(judge.role.title, 'judge');
  const others = g.state.agents.filter(a => !q.parties.includes(a.id) && a.id !== court.leader && a.status !== 'left').map(a => [a, a.mood]);
  run(g, 45, 0.5);
  const sess = g.find('institution:act', p => p.kind === 'session' && p.institutionId === court.id);
  assert.ok(sess && sess.p.conflictIds.includes(q.id) && sess.p.agentIds.includes(court.leader) && q.parties.every(id => sess.p.agentIds.includes(id)), 'the parties are summoned');
  assert.ok(Math.hypot(sess.p.where.x - g.state.centre.x, sess.p.where.z - g.state.centre.z) < 4, 'in the square');
  assert.ok(g.find('agent:task', p => q.parties.includes(p.agentId) && p.task.duty === 'session' && p.task.conflictId === q.id));
  run(g, INSTITUTION_SPECS.court.schedule.seconds + 2, 0.5);
  assert.ok(q.status === 'handled' || q.status === 'resolved', 'judged: ' + q.status); assert.equal(q.how, 'court');
  assert.ok(g.find('institution:act', p => p.kind === 'verdict' && p.conflictId === q.id && p.agentId === court.leader));
  assert.ok(g.find('institution:act', p => p.kind === 'session_end' && p.institutionId === court.id));
  assert.ok(others.filter(([a, m]) => a.mood >= m).length > others.length / 2, 'a fair hearing lifts the rest a little');
  // a festival committee
  const f = g.apply({ type: 'found_institution', kind: 'festival committee' });
  assert.equal(f.ok, true);
  const fest = g.state.institutions.find(i => i.kind === 'festival');
  for (const a of g.state.agents) a.mood = 50;
  fest.nextSessionAt = g.state.t + 1;
  run(g, 1 + INSTITUTION_SPECS.festival.schedule.seconds + 2, 0.5);
  assert.ok(g.find('institution:act', p => p.kind === 'festival' && p.institutionId === fest.id));
  assert.ok(g.state.agents.filter(a => a.status !== 'left').every(a => a.mood > 52), 'everyone lifted');
  // a school teaches whoever is free
  const s = g.apply({ type: 'found_institution', kind: 'open a school' });
  assert.equal(s.ok, true);
  const school = g.state.institutions.find(i => i.kind === 'school');
  const pupilsBefore = JSON.stringify(g.state.agents.map(a => a.skills));
  school.nextSessionAt = g.state.t + 1;
  run(g, 1 + INSTITUTION_SPECS.school.schedule.seconds + 2, 0.5);
  const lesson = g.find('institution:act', p => p.kind === 'lesson' && p.institutionId === school.id);
  assert.ok(lesson && lesson.p.agentIds.length >= 1);
  if (lesson.p.agentIds.length > 1) assert.notEqual(JSON.stringify(g.state.agents.map(a => a.skills)), pupilsBefore, 'a pupil learned a little');
  // a guild of a trade, and anything else by name
  const gd = g.apply({ type: 'found_institution', kind: "the bakers' guild" });
  assert.equal(gd.ok, true);
  const guild = g.state.institutions.find(i => i.kind === 'guild');
  assert.equal(guild.name, "Bakers' Guild");
  const choir = g.apply({ type: 'found_institution', kind: 'a lantern choir', members: 2 });
  assert.equal(choir.ok, true); assert.equal(choir.effects[0].kind, 'generic'); assert.equal(choir.effects[0].name, 'A Lantern Choir'.replace('A ', ''));
  assert.equal(institutionKind('police'), 'patrol'); assert.equal(institutionKind('night watch'), 'watch'); assert.equal(institutionKind('a court of law'), 'court'); assert.equal(institutionKind('fire brigade'), 'generic');
  // too many institutions: nobody left -> a plain refusal, never a crash
  let last = null;
  for (let i = 0; i < 6; i++) last = g.apply({ type: 'found_institution', kind: 'guard team', members: 6 });
  assert.equal(last.ok, false); assert.match(last.reason, /Nobody is free/);
  assert.ok(g.snapshot().institutions.length >= 5);
});

test('a night watch walks the edges only at night; a watchtower request also raises a site; talk knows the post and the dispute; the summary lists them', () => {
  const g = hungryTown();
  g.state.resources.wood = 60; g.state.resources.stone = 60;
  const r = g.apply({ type: 'found_institution', kind: 'night watch', request: 'a watchtower' });
  assert.equal(r.ok, true);
  const inst = g.state.institutions[0];
  assert.ok(r.effects.some(e => e.type === 'institution_site' && e.buildingId === inst.buildingId), 'a site for it');
  const b = g.state.buildings.find(x => x.id === inst.buildingId);
  assert.ok(b && b.institution && b.institution.id === inst.id);
  assert.ok(patrolRoute(g, inst).length >= 6, 'the edges on the route');
  g.state.dayAcc = 0;
  run(g, 10, 0.5);
  assert.ok(!g.find('institution:patrol', p => p.institutionId === inst.id), 'no patrol by day');
  g.state.dayAcc = 45;
  run(g, 8, 0.5);
  assert.ok(g.find('institution:patrol', p => p.institutionId === inst.id && p.night === true), 'the round after dark');
  // talk
  const w = g.state.agents.find(a => a.id === inst.leader);
  const ctx = g.talkContext(w.id, 'how is your post?');
  assert.equal(ctx.agent.role.kind, 'watch'); assert.equal(ctx.agent.role.name, 'Night Watch');
  assert.match(g.talk(w.id, 'how is your post?').reply, /lantern|edges/i);
  const c = g.startConflict('theft'); assert.ok(c);
  const t = g.talk(c.roles.complainant, 'what about the thief?');
  assert.match(t.reply, /saw it/);
  assert.equal(g.talkContext(c.roles.offender, '').agent.conflict.side, 'offender');
  const s = g.summary();
  assert.ok(s.conflicts.length === 1 && s.institutions.includes('Night Watch'));
});

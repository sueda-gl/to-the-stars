// Rewards (ART_DIRECTION §22b): every creation gives money / happiness / science / civ, reward:gain carries the
// cause (buildingId, x, z) and the effect (gains, totals), milestones and level-ups come as reward:milestone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';
const first = (g, e, pred) => g.all(e, pred)[0];   // helpers' find returns the {e, p} wrapper; this gives the payload
import { AREAS, REWARD, REWARD_TABLE, INSTITUTION_REWARDS, classifyWords, gainsFor } from '../../web/js/sim/rewards.js';
import { BASE_ENTRIES } from '../../web/js/sim/catalog.js';
import { MANIFEST } from '../../web/js/buildings/prefabs/manifest.js';
import { BUILTIN_CATALOGUE } from '../../server/catalogue.js';
import { INSTITUTION_SPECS } from '../../web/js/sim/conflicts.js';

test('the tally starts at zero with exactly the four areas', () => {
  const g = game();
  assert.deepEqual(AREAS, ['money', 'happiness', 'science', 'civ']);
  assert.deepEqual(g.state.areas, { money: 0, happiness: 0, science: 0, civ: 0 });
  assert.deepEqual(Object.keys(g.rewards.totals()).filter(k => AREAS.includes(k)), AREAS);
  assert.equal(g.snapshot().areas.money, 0);
  assert.equal(g.summary().areas.civ, 0);
});

test('every catalogue id, every starter-library prefab, every fill / line kind and every institution has a reward', () => {
  const missing = [];
  for (const e of BASE_ENTRIES) if (!REWARD_TABLE[e.id]) missing.push('sim:' + e.id);
  for (const m of MANIFEST) if (!REWARD_TABLE[m.id]) missing.push('manifest:' + m.id);
  for (const e of BUILTIN_CATALOGUE) if (!REWARD_TABLE[e.id]) missing.push('server:' + e.id);
  for (const k of ['field', 'forest', 'garden', 'plaza', 'vineyard', 'orchard', 'road', 'wall', 'fence', 'river']) if (!REWARD_TABLE[k]) missing.push('fill:' + k);
  for (const k of Object.keys(INSTITUTION_SPECS)) if (!INSTITUTION_REWARDS[k]) missing.push('institution:' + k);
  assert.deepEqual(missing, []);
  for (const [id, r] of Object.entries(REWARD_TABLE)) {
    assert.ok(Object.keys(r).length >= 1, `${id} gives nothing`);
    for (const [k, v] of Object.entries(r)) { assert.ok(['money', 'happiness', 'science'].includes(k), `${id}: ${k}`); assert.ok(v > 0 && v <= REWARD.maxPerArea, `${id}: ${k} ${v}`); }
  }
});

test('§22b: the named examples land in the right areas', () => {
  const money = ['market', 'workshop', 'smithy', 'quarry', 'windmill', 'dock', 'farm', 'field', 'cow-pasture', 'stalls'];
  const happy = ['house', 'hut', 'plaza', 'garden', 'fountain', 'tavern', 'temple', 'statue', 'piazza', 'amphitheatre'];
  const science = ['school', 'library', 'observatory', 'windmill', 'aqueduct', 'crane'];
  for (const id of money) assert.ok(REWARD_TABLE[id].money > 0, `${id} gives money`);
  for (const id of happy) assert.ok(REWARD_TABLE[id].happiness > 0, `${id} gives happiness`);
  for (const id of science) assert.ok(REWARD_TABLE[id].science > 0, `${id} gives science`);
  assert.ok(REWARD_TABLE.library.science >= REWARD_TABLE.library.happiness, 'a library is science first');
  assert.ok(REWARD_TABLE.market.money >= 3 && !REWARD_TABLE.market.science, 'a market is money');
  assert.ok(INSTITUTION_REWARDS.festival.happiness >= 3, 'a festival is happiness');
});

test('a finished house emits reward:gain with the cause, the gains and the totals; civ comes from the value', () => {
  const g = game();
  const r = g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  assert.equal(r.ok, true);
  assert.equal(g.count('reward:gain'), 0, 'nothing before it is finished');
  run(g, 160, 0.1);
  const b = g.state.buildings[0];
  assert.equal(b.status, 'done');
  const gain = first(g, 'reward:gain', p => p.buildingId === b.id);
  assert.ok(gain, 'reward:gain fired');
  assert.equal(gain.source, 'building');
  assert.equal(gain.kind, 'house');
  assert.equal(gain.x, b.x); assert.equal(gain.z, b.z);
  assert.deepEqual(gain.gains, { happiness: 3, civ: Math.round(g.catalog.get('house').value * REWARD.civFromValue) });
  assert.equal(gain.totals.happiness, 3);
  assert.equal(gain.totals.civ, gain.gains.civ);
  assert.equal(gain.totals.level, 'camp');
  assert.ok(gain.totals.levelProgress >= 0 && gain.totals.levelProgress <= 1);
  assert.equal(gain.totals.levelNext, 'hamlet');
  assert.deepEqual(g.state.areas, { money: 0, happiness: 3, science: 0, civ: gain.gains.civ });
  assert.equal(g.count('reward:gain'), 1, 'awarded once');
  g.completeBuilding(b);
  assert.equal(g.count('reward:gain'), 1, 'completing twice never pays twice');
  // the gain precedes a level-up on the same completion: a hamlet's reward:milestone (civ) comes after its reward:gain
  const order = g.events_.filter(x => x.e === 'reward:gain' || x.e === 'reward:milestone' || x.e === 'building:done').map(x => x.e);
  assert.equal(order[0], 'building:done'); assert.equal(order[1], 'reward:gain');
});

test('fills and lines pay too, and a bigger drawn outline pays a little more', () => {
  const g = game();
  g.state.resources.coin = 50;
  const small = finish(g, 'field');
  const gs = first(g, 'reward:gain', p => p.buildingId === small.id);
  assert.ok(gs && gs.shape === 'area' && gs.gains.money === REWARD_TABLE.field.money, `rect field: ${JSON.stringify(gs && gs.gains)}`);
  // a drawn 20x20 outline (400 m²)
  const poly = [[-28, 10], [-8, 10], [-8, 28], [-28, 28]];
  const spot = g.findSpot('field', { mode: 'mark', mark: { kind: 'area', poly } }) || g.markSpot('field', { kind: 'area', poly });
  const big = g.placeBuilding('field', spot);
  assert.ok(big.shape && big.shape.poly && big.shape.areaM2 > 300, `outline ${JSON.stringify(big.shape && big.shape.areaM2)}`);
  g.completeBuilding(big);
  const gb = first(g, 'reward:gain', p => p.buildingId === big.id);
  assert.ok(gb.gains.money > gs.gains.money && gb.gains.money <= REWARD_TABLE.field.money + REWARD.areaBonusMax, `big field money ${gb.gains.money}`);
  const road = finish(g, 'road');
  const gr = first(g, 'reward:gain', p => p.buildingId === road.id);
  assert.ok(gr && gr.shape === 'line' && gr.gains.money >= 1, 'a road pays money');
});

test('generated things are classified by meaning: a lighthouse gives science (and a little happiness), a rubber duck happiness; the first of a kind adds science', () => {
  const g = game();
  assert.ok(classifyWords('lighthouse', 'landmark').science >= 2, 'lighthouse -> science');
  assert.ok(classifyWords('lighthouse', 'landmark').happiness >= 1, 'a landmark lifts the heart');
  const duck = classifyWords('rubber duck', 'prop');
  assert.ok(duck.happiness >= 2 && !duck.money, `duck ${JSON.stringify(duck)}`);
  assert.ok(classifyWords('tannery', 'building').money >= 2, 'tannery -> money');
  assert.ok(classifyWords('something nobody can name', 'building').money >= 1, 'unknown building -> its category base');
  // through the game: an awaiting-design site gets its design, finishes, and pays with the novelty bonus
  g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'auto' } });
  const b = g.state.buildings[0];
  assert.equal(b.status, 'awaiting_design');
  g.designArrived(b.id, { id: 'lighthouse', name: 'Lighthouse', aliases: ['beacon'], meta: { category: 'landmark', footprint: { w: 3, d: 3 } } });
  g.completeBuilding(b);
  const gain = first(g, 'reward:gain', p => p.buildingId === b.id);
  assert.ok(gain && gain.generated && gain.novel, 'generated + novel');
  assert.ok(gain.gains.science >= 3 && gain.gains.happiness >= 1, `lighthouse gains ${JSON.stringify(gain.gains)}`);
  assert.equal(gain.gains.civ, Math.round(g.catalog.get('lighthouse').value * REWARD.civFromValue));
  // a second lighthouse is no longer novel
  g.apply({ type: 'build', kind: 'lighthouse', at: { mode: 'auto' } });
  const b2 = g.state.buildings[1];
  g.completeBuilding(b2);
  const gain2 = first(g, 'reward:gain', p => p.buildingId === b2.id);
  assert.ok(gain2 && !gain2.novel && gain2.gains.science === gain.gains.science - REWARD.novelScience);
  // the codegen meta's own areas win over the words
  g.apply({ type: 'build', kind: null, request: 'a strange contraption', at: { mode: 'auto' } });
  const b3 = g.state.buildings[2];
  g.designArrived(b3.id, { id: 'contraption', name: 'Contraption', aliases: [], meta: { category: 'prop', areas: { money: 1, science: 4, happiness: 0 } } });
  g.completeBuilding(b3);
  const gain3 = first(g, 'reward:gain', p => p.buildingId === b3.id);
  assert.deepEqual(gain3.gains, { money: 1, science: 4 + REWARD.novelScience, civ: gain3.gains.civ });
  // the preview answers for kinds and for free text
  assert.deepEqual(g.rewards.preview('house'), { happiness: 3, civ: 3 });
  assert.ok(g.rewards.preview('a dragon statue').happiness >= 2);
});

test('milestones at 10 / 25 / 50 / 100 come once, with a short line; a level-up is a civ milestone after the gain', () => {
  const g = game();
  g.state.resources = { food: 300, wood: 300, stone: 300, coin: 10, goods: 0 };   // (coin and goods count toward prosperity: keep them low so the stages come one by one)
  for (const kind of ['house', 'hut', 'garden', 'fountain', 'tavern']) finish(g, kind);   // happiness 3+2+3+3+3 = 14
  assert.equal(g.state.areas.happiness, 14);
  const ms = g.all('reward:milestone', p => p.area === 'happiness');
  assert.equal(ms.length, 1, `one happiness milestone: ${JSON.stringify(ms.map(m => m.at))}`);
  assert.equal(ms[0].at, 10);
  assert.match(ms[0].text, /^Happiness 10: /);
  assert.ok(first(g, 'reward:gain', p => p.milestone && p.milestone.area === 'happiness' && p.milestone.at === 10), 'the gain that crossed it carries the milestone');
  assert.deepEqual(g.state.rewards.passed.happiness, [10]);
  for (const kind of ['temple', 'temple', 'temple']) finish(g, kind);   // +12 -> 26: crosses 25 once
  assert.deepEqual(g.state.rewards.passed.happiness, [10, 25]);
  assert.equal(g.all('reward:milestone', p => p.area === 'happiness').length, 2);
  // the level-ups
  const lv = g.all('reward:milestone', p => p.area === 'civ');
  assert.ok(lv.length >= 1, 'a level-up happened');
  assert.equal(lv[0].levelUp.from, 'camp'); assert.equal(lv[0].levelUp.to, 'hamlet');
  assert.match(lv[0].text, /^Civ: a hamlet/);
  assert.equal(lv[0].totals.level, 'hamlet');
  const seq = g.events_.map(x => x.e);
  const iGain = seq.indexOf('reward:gain'), iLevel = seq.findIndex((e, i) => e === 'reward:milestone' && g.events_[i].p.area === 'civ');
  assert.ok(iGain < iLevel, 'the first gain comes before the first level-up');
});

test('an institution pays as a creation, placed at its leader', () => {
  const g = game();
  g.state.story.elected = true;
  const r = g.apply({ type: 'found_institution', kind: 'police patrol' });
  assert.equal(r.ok, true, r.reason);
  const inst = g.state.institutions[0];
  const gain = first(g, 'reward:gain', p => p.source === 'institution' && p.institutionId === inst.id);
  assert.ok(gain, 'reward:gain for the institution');
  assert.equal(gain.buildingId, null);
  assert.equal(gain.agentId, inst.leader);
  assert.deepEqual(gain.gains, { ...INSTITUTION_REWARDS.patrol, civ: REWARD.institutionCiv });
  assert.equal(g.state.areas.happiness, INSTITUTION_REWARDS.patrol.happiness);
});

test('the areas feed the prosperity headline, never enough to skip a stage', () => {
  const g = game();
  const p0 = g.state.prosperity;
  g.state.areas.money = 10; g.state.areas.happiness = 10; g.state.areas.science = 10;
  g.tick(0.1);
  assert.equal(g.state.prosperity, Math.round(p0 + 30 * g.ECO.areasWeight));
  // the biggest single creation (a generated landmark, value 30) with its whole reward stays under the smallest stage gap
  const g2 = game();
  const big = gainsFor(g2, { kind: null, name: 'Great Lighthouse', request: 'a great lighthouse', category: 'landmark', generated: true }, { novel: true });
  const extra = (big.money || 0) + (big.happiness || 0) + (big.science || 0);
  assert.ok(30 + extra * g2.ECO.areasWeight < 34, `one creation adds at most ${30 + extra * g2.ECO.areasWeight} prosperity`);
});

test('every event payload is plain JSON and the snapshot carries the areas', () => {
  const g = game();
  finish(g, 'market');
  for (const p of g.all('reward:gain').concat(g.all('reward:milestone'))) assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
  const s = g.snapshot();
  assert.equal(s.areas.money, REWARD_TABLE.market.money);
  assert.ok(g.rewards.totals().prosperity === g.state.prosperity);
});

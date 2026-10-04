// Headless scripted demo: the three-act story (CONCEPT.md STORY ARC + demo script) as actions, with a readable log.
// Act 1 builds (incl. generated things), Act 2 the nations (gift, envoy letters, election), Act 3 the moon and home.
// Run: node tests/sim/play.mjs [seed]
import { createGame } from '../../web/js/sim/index.js';

const seed = Number(process.argv[2]) || 7;
const g = createGame({ seed, name: 'Agora' });
const S = g.state;
const T = () => `[d${S.day} ${String(Math.floor(S.t)).padStart(3)}s ${S.scene === 'moon' ? 'moon ' : ''}]`;
const say = (...a) => console.log(T(), ...a);
const name = id => (S.agents.find(a => a.id === id) || { name: id }).name;
const nation = id => (S.neighbours.find(n => n.id === id) || { name: id }).name;

// what the UI would show
g.on('building:site', ({ building: b }) => say(`  site: ${b.name} [${b.category}${b.floating ? ', on the water' : ''}] at (${b.x}, ${b.z}) crew ${b.workers.map(name).join(', ') || '(none yet)'}`));
g.on('building:done', ({ building: b }) => say(`  DONE: ${b.name}${b.generated ? ' (generated asset)' : ''}`));
g.on('building:needsDesign', ({ building: b, request, noun, category }) => say(`  needs design: "${request}" -> ${b.name} (${b.id}, ${category} "${noun}")`));
g.on('letter:new', ({ letter: l, courierId }) => say(`  letter from ${l.from.name} [${l.kind}] "${l.subject}"${courierId ? ' (via ' + name(courierId) + ')' : l.envoy ? ' (by envoy)' : ''}`));
g.on('envoy:send', p => say(`  envoy from ${nation(p.neighbourId)} takes off with ${p.letterId}${p.all ? ' (all three nations)' : ''}, enters at (${p.enter.x}, ${p.enter.z})`));
g.on('gift:send', p => say(`  gift: ${name(p.carrierId)} carries "${p.gift}" to the edge at (${p.to.x}, ${p.to.z}) toward ${nation(p.neighbourId)}; ${p.travel} s away`));
g.on('gift:arrive', p => say(`  gift arrived at ${nation(p.neighbourId)} (carried by ${name(p.carrierId)})`));
g.on('neighbour:visit', p => say(`  camera flies to ${p.name} (${p.title}) at (${p.x}, ${p.z})`));
g.on('election', p => say(`  ELECTION: votes from ${p.votes.map(nation).join(', ')}`));
g.on('voyage:start', () => say('  VOYAGE: lift-off'));
g.on('voyage:home', p => say(`  VOYAGE: home (seeds left on the moon: ${p.seeds})`));
g.on('moon:do', p => say(`  moon: ${p.do}${p.text ? ' "' + p.text + '"' : ''}`));
g.on('show', p => say(`  camera: show ${p.target}`));
g.on('agent:refuse', p => say(`  ${name(p.agentId)} refuses ${p.task.label || p.task.kind}: ${p.why}`));
g.on('minister:set', p => say(`  minister seal -> ${name(p.agentId)}`));
g.on('stage', p => say(`  STAGE -> ${p.stage}`));
g.on('meeting:start', p => say(`  meeting at (${p.where.x.toFixed(1)}, ${p.where.z.toFixed(1)})${p.assembly ? ' under the Red arch' : ' in the town centre'}`));
g.on('meeting:end', () => say('  meeting ends'));
g.on('agent:leave', p => say(`  ${name(p.agentId)} LEAVES`));
g.on('agent:spawn', ({ agent }) => say(`  newcomer: ${agent.name} the ${agent.species}`));
g.on('toast', p => say(`  toast: ${p.text}`));
let hauls = 0; g.on('agent:task', p => { if (p.task.carrying === 'crate') hauls++; });

// stand-in for the visual layer: an envoy flies for 4 s, then lands the letter (game.deliverLetter)
const flights = [];
g.on('envoy:send', p => flights.push({ at: S.t + 4, id: p.letterId }));
const run = s => { for (let i = 0; i < s * 10; i++) { g.tick(0.1); for (let j = flights.length - 1; j >= 0; j--) if (S.t >= flights[j].at) { g.deliverLetter(flights[j].id); flights.splice(j, 1); } } };
const act = (label, action) => { say(`> ${label}`); const r = g.apply(action); say(`  ${r.ok ? 'ok' : 'NO: ' + r.reason}`, r.effects.length ? JSON.stringify(r.effects[0]) : ''); return r; };
const res = () => `food ${S.resources.food} wood ${S.resources.wood} stone ${S.resources.stone} coin ${S.resources.coin} goods ${S.resources.goods} | mood ${Math.round(S.mood)} prosperity ${S.prosperity} (${S.stage})`;
const design = (b, asset) => { say(`  (codegen returns for ${b.name}: ${asset.id})`); g.designArrived(b.id, asset); };

console.log(`AGORA headless demo, seed ${seed}`);
console.log('folk:', S.agents.map(a => `${a.name} (${a.species}, ${a.trade}, ${a.traits.join('/')})`).join('; '));
console.log('lake centre ~', JSON.stringify(g.waterCentre('lake')), '| nations:', S.neighbours.map(n => `${n.name} = ${n.title} (${n.temperament}, at ${n.x},${n.z})`).join(', '));
say(res());

// ================= THE ARRIVAL: fleets, introductions, the minister (ART_DIRECTION §11) =================
console.log('\n===== Arrival: fleets and the minister =====');
g.on('fleet:form', p => say(`  fleets: ${p.fleets.map(f => `${f.name} [${f.members.map(name).join(', ')}] at (${f.centre.x}, ${f.centre.z})`).join('; ')}`));
g.on('fleet:introduce', p => say(`  introducing ${p.caption}`));
g.on('election:ask', p => say(`  ASK: ${p.text} (${p.candidates.length} candidates)`));
g.on('ceremony:start', p => say(`  ceremony for ${p.name}, ${p.seconds} s`));
g.on('fleet:release', p => say(`  the squares break: ${p.released} go to work`));
g.on('agent:say', p => say(`  ${name(p.agentId)} says: "${p.text}" [${p.kind}]`));
g.on('venture:propose', p => say(`  ${name(p.agentId)} proposes a ${p.title.toLowerCase()} (letter ${p.letterId})`));
g.on('venture:start', p => say(`  ${name(p.agentId)} starts the ${p.title} at (${p.x}, ${p.z})${p.generated ? ' (design pending)' : ''}`));
g.on('venture:done', p => say(`  ${name(p.agentId)}'s ${p.title} is open`));
g.spawnAll();
run(4);
say(`> introduce the fleets: ${g.introduceFleets({ every: 1.2, first: 0.4 }).join(' → ')}`);
run(8);
say('> click: the first builder is minister');
const firstBuilder = S.agents.find(a => a.trade === 'builder');
say('  ', JSON.stringify(g.electMinister(firstBuilder.id).effects[0]));
run(6);
say(`  jobs: ${S.agents.map(a => `${a.name} = ${a.job}`).join('; ')}`);
say(`> talk to ${S.agents[1].name}: "how are you?" -> "${g.talk(S.agents[1].id, 'how are you?').reply}"`);

// ================= ACT 1: BUILD (Earth) =================
console.log('\n===== ACT 1: Build =====');
act('"Let\'s build a house in the middle."', { type: 'build', kind: 'house', at: { mode: 'center' } });
run(40);
act('"A windmill there" (cursor at 12,-4)', { type: 'build', kind: 'windmill', at: { mode: 'pointer', x: 12, z: -4 } });
run(15);
act('"Who\'s good at baking?"', { type: 'ask_crowd', question: "Who's good at baking?" });
run(10);
for (const l of S.letters.filter(l => l.kind === 'skill_answer')) say(`    ${l.from.name} (${l.meta.tone}, claims ${l.meta.claimed}/10, really ${S.agents.find(a => a.id === l.from.id).skills.baking})`);
act('"Make Olla our minister."', { type: 'appoint_minister', agentId: 'Olla' });
run(5);
act('"Build a lighthouse on the cliff." (LLM: kind null, request only)', { type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'auto' } });
const lh = S.buildings.find(b => b.noun === 'lighthouse');
run(20);
design(lh, { id: 'lighthouse', name: 'Lighthouse', aliases: ['light house', 'beacon'], meta: { footprint: { w: 4, d: 4 }, cost: { stone: 9, wood: 5, coin: 2 }, workers: 2, skill: 'building', buildSeconds: 50, perDay: { coin: 1 } } });
act('"Put a giant rubber duck there, in the lake."', { type: 'build', kind: null, request: 'put a giant rubber duck there, in the lake', at: { mode: 'pointer', x: g.waterCentre('lake').x + 1, z: g.waterCentre('lake').z } });
const duck = S.buildings.find(b => b.noun && /duck/.test(b.noun));
run(6);
design(duck, { id: 'giant_rubber_duck', name: 'Giant Rubber Duck', meta: { footprint: { w: 3, d: 3 }, cost: {}, workers: 1, buildSeconds: 10, category: 'prop', water: true } });
run(20);
act('"A dragon statue in the square."', { type: 'build', kind: null, request: 'a dragon statue in the square', at: { mode: 'auto' } });
const dragon = S.buildings.find(b => b.noun && /dragon/.test(b.noun));
run(20);
design(dragon, { id: 'dragon_statue', name: 'Dragon Statue', meta: { footprint: { w: 3, d: 3 }, cost: { stone: 6 }, workers: 2, buildSeconds: 40 } });
act('"Another one over there." (cursor at -12, 18)', { type: 'build', kind: null, request: 'another one over there', at: { mode: 'pointer', x: -12, z: 18 } });
run(45);
say(res());
const suggest = S.letters.find(l => l.meta && l.meta.kind === 'suggest');
if (suggest) { say(`  minister's suggestion: "${suggest.subject}" -> ${suggest.options.map(o => o.label).join(' / ')}`); act('reply: "yes, a farm by the lake"', { type: 'reply_letter', letterId: suggest.id, decision: 'yes' }); }
act('"Build a bakery near the windmill."', { type: 'build', kind: 'bakery', at: { mode: 'near', ref: 'windmill' } });
run(60);
say(res());

// ================= ACT 2: EARTH'S NATIONS =================
console.log('\n===== ACT 2: The nations =====');
const greetings = S.letters.filter(l => l.kind === 'neighbour_greeting');
say(`  greetings so far: ${greetings.map(l => l.from.name).join(', ') || 'none yet'}`);
act('"Send the Loaf Republic a basket of bread."', { type: 'send_gift', neighbourId: 'loaf republic', gift: 'a basket of bread', give: { food: 4 } });
run(14);
act('"Show me the neighbours."', { type: 'visit_neighbour', neighbourId: 'the neighbours' });
act('"Show me the globe."', { type: 'show', target: 'globe' });
run(30);
const thanks = S.letters.find(l => l.kind === 'neighbour_thanks');
if (thanks) say(`  thank-you letter: "${thanks.subject}" — ${thanks.body.split('\n')[2].slice(0, 110)}...`);
const offer = S.letters.find(l => l.kind === 'neighbour_trade' && !l.resolved);
if (offer) act(`reply to ${offer.from.name}'s trade offer: yes`, { type: 'reply_letter', letterId: offer.id, decision: 'yes' });
act('"Call a meeting."', { type: 'call_meeting' });
run(25);
say(res());
act('"Let\'s go to the moon."', { type: 'go_moon' });
run(3.5);
const election = S.letters.find(l => l.kind === 'election');
if (election) say(`  election letter: "${election.subject}" from ${election.from.name}\n    ` + election.body.split('\n').slice(2, 4).join('\n    '));
run(3);
say(`  elected: ${S.story.elected}, scene: ${S.scene}`);

// ================= ACT 3: THE MOON =================
console.log('\n===== ACT 3: The moon =====');
run(10);
act('"We come in peace."', { type: 'moon', do: 'greet', text: 'we come in peace' });
run(3);
act('"Offer them a seed."', { type: 'moon', do: 'seed' });
run(7);
act('"Wait for the evening."', { type: 'moon', do: 'golden_hour' });
run(5);
for (const l of S.letters.filter(l => l.kind === 'shadeling')) say(`    shadelings [${l.meta.kind}]: ${l.body.split('\n')[2].slice(0, 100)}...`);
act('"Let\'s go home."', { type: 'moon', do: 'go_home' });
run(12);
say(res());

const snap = JSON.stringify(g.snapshot());
console.log(`\nsnapshot: ${snap.length} chars (≈ ${Math.ceil(snap.length / 3.5)} tokens); crate hauls: ${hauls}; letters: ${S.letters.length}; buildings: ${S.buildings.map(b => `${b.name}:${b.status}`).join(', ')}`);
console.log('creations in snapshot:', JSON.stringify(g.snapshot().creations));
console.log('folk now:', S.agents.map(a => `${a.name} ${a.status} m${Math.round(a.mood)} e${Math.round(a.energy)}${a.homeId ? ' housed' : ''}`).join('; '));
console.log(`nations: ${S.neighbours.map(n => `${n.name} attitude ${Math.round(n.attitude)}${n.allied ? ' (ally)' : ''} gifts ${n.gifts || 0}`).join('; ')} | elected ${S.story.elected}, returned ${S.story.returned}, seeds on the moon ${S.moon.seeds}`);

// Story arc (ARCHITECTURE §9): gifts that physically travel, the election by the three nations, the voyage to the
// moon, the shadelings' letters, and the way home. Pure data in state.story / state.moon; events out.

import { setTask, TASK } from './tasks.js';
import { edgeToward, NB } from './neighbours.js';
import { stageIndex } from './catalog.js';
import { pickCourier } from './society.js';
import * as L from './letters.js';

export const STORY = {
  electionDelay: 2.5,        // seconds after "go to the moon" (unelected) until the election letter is sent
  electionLetterCap: 3,      // the election letter lands within this many seconds even when envoys are flown visually
  passiveElectionAfter: 360, // seconds; from then on a town that outshines the nations gets the letter on its own ("go to the moon" asks for it any time)
  passiveCheckEvery: 10,
  arrivalSeconds: 9,         // voyage:start -> the shadelings' first letter (the visual voyage takes ~8 s); setScene('moon') shortens it
  giftAttitude: 12,          // attitude gained when a gift arrives (+ up to 10 for the goods in it)
  travelMin: 6, travelMax: 20,
  homecomingAfter: 10,
  seedLetterAfter: 6, goldenLetterAfter: 3.5, replyAfter: 2, farewellAfter: 1
};

const alive = a => a.status !== 'left';

// ---- gifts ----
export function sendGift(game, { neighbour: n, gift, give }) {
  const { state } = game;
  const paid = {};
  for (const [k, v] of Object.entries(give || {})) { const pay = Math.min(state.resources[k] || 0, v); if (pay > 0) { paid[k] = pay; state.resources[k] -= pay; } }
  if (Object.keys(paid).length) game.emit('resources', { resources: { ...state.resources } });
  const exit = edgeToward(state, n);
  const travel = +Math.max(STORY.travelMin, Math.min(STORY.travelMax, exit.distance / TASK.courierSpeed)).toFixed(1);
  const can = a => alive(a) && a.status !== 'striking' && a.status !== 'resting' && a.status !== 'meeting' && a.id !== state.minister && !(a.task && (['deliver', 'journey', 'leave'].includes(a.task.kind) || (a.task.kind === 'gather' && a.task.phase !== 'camp')));
  const courier = pickCourier(state.agents, can, { x: exit.x, z: exit.z });   // the scout by trade unless someone is much nearer the edge (every one of ours flies)
  state.lastNeighbour = n.id;
  n.lastGift = gift;
  const to = { x: exit.x, z: exit.z };
  if (courier) {
    courier.resume = courier.task && (courier.task.kind === 'walk' || courier.task.kind === 'haul') ? courier.task : null;
    setTask(game, courier, { kind: 'deliver', to, carrying: 'gift', phase: 'gift', gift, neighbourId: n.id, travel, exit: to, give: paid });
  } else state.journeys.push({ at: state.t + travel + 4, neighbourId: n.id, gift, carrierId: null, give: paid });
  game.emit('gift:send', { neighbourId: n.id, gift, carrierId: courier ? courier.id : null, to, dir: exit.dir, travel, give: paid });
  game.emit('toast', { text: `${courier ? courier.name + ' carries' : 'Sending'} ${gift} to ${n.name}` });
  game.log(`Gift for ${n.name}: ${gift}${courier ? ' (carried by ' + courier.name + ')' : ''}.`);
  return { paid, courierId: courier ? courier.id : null, travel, exit: to };
}

export function giftArrive(game, { neighbourId, gift, carrierId, give }) {
  const { state, rng } = game;
  const n = state.neighbours.find(x => x.id === neighbourId);
  if (!n) return;
  const worth = Object.values(give || {}).reduce((s, v) => s + v, 0);
  n.attitude = Math.min(100, n.attitude + STORY.giftAttitude + Math.min(10, Math.round(worth / 3)));
  n.gifts = (n.gifts || 0) + 1;
  const carrier = carrierId ? state.agents.find(a => a.id === carrierId) : null;
  game.emit('gift:arrive', { neighbourId: n.id, gift, carrierId: carrierId || null });
  game.log(`${gift} arrived at ${n.name}; attitude ${Math.round(n.attitude)}.`);
  game.sendLetter(L.neighbourLetter(rng, { neighbour: n, kind: 'thanks', day: state.day, settlement: state.name, our: state.resources, give: { gift, carrier: carrier ? `${carrier.name} the ${carrier.species}` : 'courier' }, get: {} }));
  if (n.attitude >= NB.allianceAttitude && !n.allied) { n.nextKind = 'alliance'; n.nextLetterAt = Math.min(n.nextLetterAt, state.t + 40); }
}

// ---- election ----
export function startElection(game, { reason = null, thenVoyage = false } = {}) {
  const { state } = game, story = state.story;
  if (story.elected) { if (thenVoyage) startVoyage(game); return 'elected'; }
  story.voyagePending = story.voyagePending || !!thenVoyage;
  if (story.electionAt != null || story.electionLetterId) return 'pending';
  story.electionAt = state.t + STORY.electionDelay;
  story.electionReason = reason;
  return 'called';
}

function sendElectionLetter(game) {
  const { state, rng } = game, story = state.story;
  story.electionAt = null;
  const letter = L.electionLetter(rng, { neighbours: state.neighbours, day: state.day, settlement: state.name, reason: story.electionReason });
  letter.meta.urgent = true;   // lands within STORY.electionLetterCap even when the visual layer flies the envoys
  game.sendLetter(letter);
  story.electionLetterId = letter.id;
  game.log('The three nations have written together.');
}

export function elect(game) {
  const { state } = game, story = state.story;
  if (story.elected) return;
  story.elected = true;
  game.emit('election', { votes: state.neighbours.map(n => n.id) });
  game.emit('toast', { text: 'Elected Earth\'s envoy' });
  game.log('Elected Earth\'s envoy by all three nations.');
  if (story.voyagePending) { story.voyagePending = false; startVoyage(game); }
}

// ---- the voyage ----
export function startVoyage(game) {
  const { state } = game, story = state.story;
  if (state.scene === 'moon') return false;
  state.scene = 'moon';
  story.departedAt = state.t;
  story.voyages = (story.voyages || 0) + 1;
  game.emit('voyage:start', { elected: story.elected, voyages: story.voyages });
  game.emit('toast', { text: 'To the moon' });
  game.log('Voyage: lift-off for the moon.');
  if (!state.moon.contacted) schedule(game, STORY.arrivalSeconds, { what: 'first_contact' });
  return true;
}

export function setScene(game, scene) {
  const { state } = game;
  if (scene !== 'earth' && scene !== 'moon') return state.scene;
  state.scene = scene;
  if (scene === 'moon' && !state.moon.contacted) {
    state.scheduled = state.scheduled.filter(s => s.what !== 'first_contact');
    schedule(game, 1.5, { what: 'first_contact' });
  }
  return state.scene;
}

// moon { do }: 'seed' | 'golden_hour' | 'daylight' | 'greet' | 'gift' | 'go_home'
export function moonDo(game, what, text = '') {
  const { state } = game, m = state.moon;
  game.emit('moon:do', { do: what, text: text || null });
  game.log(`Moon: ${what}${text ? ' "' + text + '"' : ''}.`);
  switch (what) {
    case 'seed': m.seeds++; schedule(game, STORY.seedLetterAfter, { what: 'shadeling', kind: 'seed', first: m.seeds === 1 }); return { type: 'moon', do: what, seeds: m.seeds };
    case 'golden_hour': { const first = !m.golden && !m.goldenOnce; m.golden = true; m.goldenOnce = true; if (first) schedule(game, STORY.goldenLetterAfter, { what: 'shadeling', kind: 'golden_hour' }); return { type: 'moon', do: what, golden: true }; }
    case 'daylight': { const was = m.golden; m.golden = false; if (was) schedule(game, STORY.replyAfter, { what: 'shadeling', kind: 'daylight' }); return { type: 'moon', do: what, golden: false }; }
    case 'greet': m.greeted++; schedule(game, STORY.replyAfter, { what: 'shadeling', kind: 'greet', text, first: m.greeted === 1 }); return { type: 'moon', do: what };
    case 'gift': m.gifts++; schedule(game, STORY.replyAfter, { what: 'shadeling', kind: 'gift', text }); return { type: 'moon', do: what };
    case 'go_home': return goHome(game);
    default: return { type: 'moon', do: what };
  }
}

export function goHome(game) {
  const { state, rng } = game, m = state.moon, story = state.story;
  state.scheduled = state.scheduled.filter(s => s.what !== 'first_contact');
  game.sendLetter(L.shadelingLetter(rng, { kind: 'farewell', day: state.day, seeds: m.seeds, golden: m.golden, settlement: state.name }), { delay: STORY.farewellAfter });
  state.scene = 'earth';
  story.returned = true;
  story.returnedAt = state.t;
  for (const n of state.neighbours) n.attitude = Math.min(100, n.attitude + 6);
  game.emit('voyage:home', { seeds: m.seeds, golden: m.golden });
  game.emit('toast', { text: 'Homeward' });
  game.log('Voyage: home.');
  schedule(game, STORY.homecomingAfter, { what: 'homecoming' });
  return { type: 'moon', do: 'go_home', seeds: m.seeds };
}

// ---- scheduled beats and journeys (ticked from state.js) ----
export function schedule(game, delay, item) { game.state.scheduled.push({ at: +(game.state.t + delay).toFixed(2), ...item }); }

export function tickStory(game) {
  const { state, rng } = game, story = state.story, m = state.moon;
  if (story.electionAt != null && state.t >= story.electionAt) sendElectionLetter(game);
  // outshine the nations (or reach town) and the letter comes on its own
  if (!story.elected && story.electionAt == null && !story.electionLetterId && state.t >= STORY.passiveElectionAfter && state.t >= (story.nextElectionCheckAt || 0)) {
    story.nextElectionCheckAt = state.t + STORY.passiveCheckEvery;
    const top = Math.max(...state.neighbours.map(n => n.prosperity));
    if (stageIndex(state.stage) >= stageIndex('town') && state.prosperity >= top) startElection(game, { reason: 'Your plot by the sea is a town now, and a brighter one than any of ours.' });
  }
  for (let i = state.journeys.length - 1; i >= 0; i--) if (state.t >= state.journeys[i].at) { const j = state.journeys.splice(i, 1)[0]; giftArrive(game, j); }
  if (!state.scheduled.length) return;
  const due = state.scheduled.filter(s => state.t >= s.at);
  if (!due.length) return;
  state.scheduled = state.scheduled.filter(s => state.t < s.at);
  for (const s of due) {
    if (s.what === 'first_contact') { if (m.contacted) continue; m.contacted = true; game.sendLetter(L.shadelingLetter(rng, { kind: 'first_contact', day: state.day, settlement: state.name }), { delay: 0.5 }); }
    else if (s.what === 'shadeling') game.sendLetter(L.shadelingLetter(rng, { kind: s.kind, day: state.day, text: s.text, seeds: m.seeds, golden: m.golden, first: s.first !== false, settlement: state.name }), { delay: 0.5 });
    else if (s.what === 'homecoming') game.sendLetter(L.ministryNotice(rng, { kind: 'homecoming', day: state.day, settlement: state.name, name: 'envoy', reason: m.seeds ? `A seed of ours is growing on the moon${m.golden ? ', under lanterns' : ''}.` : null }));
  }
}

// a letter landed in the tray (from tasks.landLetter)
export function onLetterLanded(game, letter) {
  const { state } = game;
  if (letter.kind === 'election') elect(game);
  if (letter.from && letter.from.kind === 'neighbour' && state.neighbours.some(n => n.id === letter.from.id)) state.lastNeighbour = letter.from.id;
}

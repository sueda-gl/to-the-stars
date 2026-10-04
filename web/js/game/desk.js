// The desk: letters, society, the meeting. The sim decides WHO writes WHEN and the templated words (works offline); when
// the live mind is on, the same letter is rewritten in character by /api/letter while the courier walks it over, so the
// envelope that lands carries the live text (the template stays as the fallback, never a blank). Every ~90 s the
// society mind looks at the state and writes 0-2 letters of its own. The meeting opens the minister's report up close.

import * as L from '../sim/letters.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const PURPOSE = { refusal: 'refusal', skill_answer: 'skill_answer', report: 'report', reply: 'reply', neighbour_greeting: 'envoy', neighbour_trade: 'envoy', neighbour_envy: 'envoy',
  neighbour_alliance: 'envoy', neighbour_complaint: 'envoy', neighbour_thanks: 'gift_thanks', election: 'election' };
const SHADELING = { first_contact: 'shadeling_contact', seed: 'shadeling_seed', golden_hour: 'shadeling_golden', farewell: 'shadeling_farewell' };

export function createDesk({ game, net, ui, world, folk, stages = null, commands = null, live = () => false, societyEvery = 90000, log = () => {} } = {}) {
  const pending = new Map();      // letter id -> Promise<{subject, body, options}|null>
  const shade = new Map();        // shadeling meta.kind -> Promise
  let societyT = null, societyBusy = false, paused = false, lastSociety = performance.now();
  const stats = { prefetched: 0, applied: 0, society: 0, societyLetters: 0 };
  const agentOf = id => game.state.agents.find(a => a.id === id) || null;
  const snapshot = () => Object.assign(game.snapshot(), { scene: game.state.scene });

  // ---------- live rewrite, started when the sim queues the letter ----------
  function prefetch(letter) {
    if (!live() || !letter || pending.has(letter.id)) return;
    if (letter.meta && letter.meta.director) return;   // ART_DIRECTION §18: the director's minister briefing is already written in character
    const purpose = PURPOSE[letter.kind] || (letter.kind === 'shadeling' ? SHADELING[(letter.meta || {}).kind] : null);
    if (!purpose) return;
    const agent = letter.from && letter.from.kind !== 'neighbour' ? agentOf(letter.from.id) : null;
    const m = letter.meta || {};
    const context = { subject: letter.subject, kind: m.kind || letter.kind, task: m.task, why: m.why, question: m.question, text: m.text, occasion: m.occasion,
      neighbour: letter.from && letter.from.kind === 'neighbour' ? letter.from.id : undefined, gift: m.gift, give: m.give, get: m.get, votes: m.votes, summary: letter.kind === 'report' ? game.summary() : undefined };
    const p = net.letter({ purpose, agent: agent ? { id: agent.id, name: agent.name, species: agent.species, trade: agent.trade, traits: agent.traits, mood: agent.mood, skills: agent.known } : null, context, snapshot: snapshot() })
      .then(r => (r && r.body ? r : null)).catch(e => { log('letter', e.message); return null; });
    pending.set(letter.id, p); stats.prefetched++;
  }
  const findLetter = id => game.state.letters.find(l => l.id === id);
  game.on('letter:sent', ({ letterId }) => prefetch(findLetter(letterId)));
  game.on('envoy:send', ({ letterId }) => prefetch(findLetter(letterId)));
  game.on('moon:do', ({ do: d }) => { if (!live()) return; const k = { seed: 'seed', golden_hour: 'golden_hour', go_home: 'farewell' }[d]; if (!k || shade.has(k)) return;
    shade.set(k, net.letter({ purpose: SHADELING[k], context: { kind: k }, snapshot: snapshot() }).then(r => (r && r.body ? r : null)).catch(() => null)); });

  function merge(letter, r) {
    const out = { ...letter, subject: r.subject || letter.subject, body: r.body || letter.body };
    if (Array.isArray(r.options) && r.options.length && (!letter.options || !letter.options.length)) out.options = r.options.filter(o => o && o.says).map(o => ({ label: o.label || o.says, says: o.says }));
    return out;
  }
  async function onNew({ letter }) {
    let Lt = letter;
    let p = pending.get(letter.id) || (letter.kind === 'shadeling' ? shade.get((letter.meta || {}).kind) : null);
    if (p) {
      const r = await Promise.race([p, sleep(2500).then(() => null)]);
      pending.delete(letter.id); if (letter.kind === 'shadeling') shade.delete((letter.meta || {}).kind);
      if (r) { Lt = merge(letter, r); stats.applied++; }
    }
    try { ui.letters.addLetter(Lt, { silent: false }); } catch (e) { console.error('[desk] addLetter', e); }
    if (letter.kind === 'election') try { ui.hud.set({ honour: 'Earth’s envoy, by election' }); } catch (_) {}
  }
  game.on('letter:new', e => { onNew(e).catch(err => console.error('[desk]', err)); });
  game.on('letter:resolved', ({ letterId, decision }) => { try { ui.letters.markResolved(letterId, { choice: decision }); } catch (_) {} });

  // ---------- society: the live mind writes letters on its own ----------
  async function society() {
    if (societyBusy || paused || !live() || (stages && stages.scene !== 'world')) return;
    const alive = game.state.agents.filter(a => a.status !== 'left');
    if (alive.length < 2) return;
    societyBusy = true; lastSociety = performance.now();
    try {
      const recent = game.state.letters.slice(-6).map(l => ({ id: l.id, subject: l.subject, from: l.from, kind: l.kind, resolved: l.resolved }));
      const r = await net.society({ snapshot: snapshot(), recent }); stats.society++;
      for (const d of (r && r.letters) || []) {
        if (!d || !d.body) continue;
        const from = d.from && d.from.id ? d.from : (() => { const a = alive[Math.floor(Math.random() * alive.length)]; return { kind: 'agent', id: a.id, name: a.name }; })();
        if (from.kind === 'agent' && !agentOf(from.id)) { const a = alive.find(x => x.name === from.name) || alive[0]; from.id = a.id; from.name = a.name; }
        const letter = L.makeLetter({ from, subject: d.subject || 'A note', body: d.body, kind: d.kind || 'gossip', day: game.state.day,
          options: Array.isArray(d.options) ? d.options.filter(o => o && o.says).map(o => ({ label: o.label || o.says, says: o.says })) : [], effects: d.effects || {}, meta: { society: true } });
        game.sendLetter(letter); stats.societyLetters++;
      }
    } catch (e) { log('society', e.message); }
    societyBusy = false;
  }
  function startSociety() { stopSociety(); societyT = setInterval(society, societyEvery); }
  function stopSociety() { if (societyT) clearInterval(societyT); societyT = null; }

  // ---------- the meeting ----------
  let meetingOn = false;
  async function onMeetingStart({ where }) {
    meetingOn = true;
    const minister = game.state.minister ? agentOf(game.state.minister) : null;
    try { folk.setCloseUp(true); } catch (_) {}
    if (stages && stages.scene === 'world') { try { world.upClose({ x: where.x, z: where.z }, { r: 10, pitch: 0.22 }); } catch (_) {} }
    let report = null;
    if (live()) {
      try {
        const r = await Promise.race([net.letter({ purpose: 'report', agent: minister ? { id: minister.id, name: minister.name, species: minister.species, trade: minister.trade, traits: minister.traits } : null,
          context: { occasion: 'meeting', summary: game.summary() }, snapshot: snapshot() }), sleep(9000).then(() => null)]);
        if (r && r.body) report = r.body;
      } catch (_) {}
    }
    if (!report) {
      try { report = minister ? L.ministerReport(game.rng, { agent: minister, day: game.state.day, settlement: game.state.name, summary: game.summary(), occasion: 'meeting' }).body : plainReport(); }
      catch (_) { report = plainReport(); }
    }
    if (!meetingOn) return;
    ui.meeting.show({ title: minister ? `${minister.name} opens the meeting` : 'The folk are gathered', kicker: game.state.buildings.some(b => b.kind === 'assembly' && b.status === 'done') ? 'At the Assembly' : 'At the town centre',
      report, minister, id: 'meeting', options: [{ label: 'Thank you, back to work', says: 'thank you all, back to work' }, { label: 'Build a farm', says: 'build a farm' }, { label: 'Who is hungry?', says: 'who here is hungry?' }] });
  }
  function plainReport() {
    const s = game.summary(), r = game.state.resources;
    return `We are ${s.pop || game.state.agents.length} and ${s.housed || 0} of us have a roof. The crates hold ${r.food} food, ${r.wood} wood, ${r.stone} stone and ${r.coin} coin. ${s.sites ? `${s.sites} site${s.sites > 1 ? 's are' : ' is'} still being raised. ` : ''}My advice: ${s.advice || 'keep building'}.`;
  }
  function onMeetingEnd() {
    meetingOn = false;
    try { ui.meeting.hide(); } catch (_) {}
    try { folk.setCloseUp(false); } catch (_) {}
    if (stages && stages.scene === 'world' && world.rig.mode === 'close') { try { world.back(); } catch (_) {} }
  }
  game.on('meeting:start', e => { onMeetingStart(e).catch(err => console.error('[desk] meeting', err)); });
  game.on('meeting:end', onMeetingEnd);

  return {
    society, startSociety, stopSociety, stats, pause(on = true) { paused = !!on; },
    endMeeting() { if (meetingOn) { meetingOn = false; onMeetingEnd(); } },
    get meetingOn() { return meetingOn; },
    get sinceSociety() { return performance.now() - lastSociety; },
    dispose() { stopSociety(); }
  };
}

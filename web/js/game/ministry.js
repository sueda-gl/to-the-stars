// The Ministry of Builds directs the player (ART_DIRECTION §24, Sueda 2026-10-04 pm): concrete first goals as short
// clear tasks in a small pop card (top-left, under the rewards tally), each with a one-tap "say it" chip; ticked off as
// the buildings appear. And "Call the Ministry" (ui/call.js): the minister answers in babble with an English subtitle;
// the answers come from the minds' talk when the minds are live, else from plain canned advice built from the state
// (what to build next, food, homes, the neighbours, who is unhappy). A build said on the call is simply done.
//
//   const ministry = createMinistry({ game, ui, agents, command: text => ..., talkTo: (id, text) => Promise<string>, mindsLive: () => bool, voice })
//   ministry.start()          // the goals card + the Ministry's letter "Your first jobs" (the onboarding's last step)
//   ministry.goals() -> [{ id, text, done, n, of }] · ministry.next() · ministry.advise(text) · ministry.call (ui/call.js)

import { makeLetter } from '../sim/letters.js';
import { createCall } from '../ui/call.js';
import { h } from '../ui/paper.js';
import { iconSlot } from '../ui/icon-slots.js';

const alive = a => a.status !== 'left';
const HOME_KINDS = new Set(['house', 'hut', 'tent', 'cottage', 'apartment', 'villa', 'townhouse']);
const FIELD_KINDS = new Set(['field', 'farm', 'wheat-field', 'pumpkin-patch', 'lavender-field', 'sunflower-field', 'olive-grove', 'orchard', 'vineyard', 'garden']);

export function createMinistry({ game, ui, agents = null, command = null, talkTo = null, mindsLive = () => false, log = () => {} } = {}) {
  const S = game.state;
  const pop = () => S.agents.filter(alive).length;
  const built = test => S.buildings.filter(b => b.status !== 'removed' && test(b));
  // the first jobs, in order; three show at a time
  const GOALS = [
    { id: 'homes', of: 3, count: () => built(b => HOME_KINDS.has(b.kind)).length, text: () => `Your ${pop()} residents need homes: build houses`, says: 'build a house in the middle', chip: 'a house' },
    { id: 'bakery', of: 1, count: () => built(b => b.kind === 'bakery').length, text: () => 'Bread for everyone: build a bakery', says: 'build a bakery by the road', chip: 'a bakery' },
    { id: 'field', of: 1, count: () => built(b => FIELD_KINDS.has(b.kind)).length, text: () => 'Grow food: plant a field (draw a loop, say "a field here")', says: 'a field by the lake', chip: 'a field' },
    { id: 'well', of: 1, count: () => built(b => b.kind === 'well').length, text: () => 'Clean water: dig a well in the square', says: 'build a well in the square', chip: 'a well' },
    { id: 'market', of: 1, count: () => built(b => b.kind === 'market').length, text: () => 'Trade: open a market', says: 'build a market', chip: 'a market' },
    { id: 'workshop', of: 1, count: () => built(b => /workshop|smithy|carpenter|kiln|weaver/.test(b.kind || '')).length, text: () => 'Tools and goods: build a workshop', says: 'build a workshop', chip: 'a workshop' }
  ];
  const state = () => GOALS.map(g => { const n = Math.min(g.of, g.count()); return { id: g.id, text: g.text(), n, of: g.of, done: n >= g.of, says: g.says, chip: g.chip }; });
  const next = () => state().find(g => !g.done) || null;

  // ---------- the goals card ----------
  let card = null, list = null, collapsed = false, started = false, tick = 0, lastSig = '';
  function buildCard() {
    list = h('ol.ag-goals__list');
    const head = h('button.ag-goals__head', { type: 'button', 'aria-expanded': 'true', on: { click: e => { e.currentTarget.blur(); collapsed = !collapsed; card.classList.toggle('is-collapsed', collapsed); e.currentTarget.setAttribute('aria-expanded', String(!collapsed)); } } },
      h('span.ag-goals__ic', { html: iconSlot('ministry', 26, '') }), h('span.ag-goals__k', null, 'Ministry: to do'), h('span.ag-goals__chev', { html: iconSlot('chevron', 14, '▾') }));
    card = h('section.ag-goals', { role: 'region', 'aria-label': 'The Ministry of Builds: your next jobs' }, head, list);
    ui.el.append(card);
  }
  const doneAt = new Map();   // a goal just ticked off stays a moment, checked, before it leaves the list
  function render(force = false) {
    if (!card) return;
    const all = state(), now = performance.now();
    for (const g of all) if (g.done && !doneAt.has(g.id)) doneAt.set(g.id, lastSig ? now : 0);
    const flash = all.filter(g => g.done && now - doneAt.get(g.id) < 5000);
    const sig = all.map(g => g.n).join(',') + '|' + pop() + '|' + flash.map(g => g.id).join(',');
    if (!force && sig === lastSig) return;
    lastSig = sig;
    const show = all.filter(g => !g.done).slice(0, 3);
    list.replaceChildren(...[...flash, ...show].map(g => h('li.ag-goals__item' + (g.done ? '.is-done' : ''), { 'data-goal': g.id },
      h('span.ag-goals__box', { html: g.done ? iconSlot('check', 18, '✓') : '' }),
      h('span.ag-goals__txt', null, g.text, g.of > 1 ? h('b.ag-goals__n', null, ` ${g.n}/${g.of}`) : null),
      g.done ? null : h('button.ag-goals__say', { type: 'button', title: `say “${g.says}”`, on: { click: e => { e.currentTarget.blur(); if (command) command(g.says); } } }, h('span', { html: iconSlot('speech', 16, '') }), g.chip))));
    if (!show.length) list.append(h('li.ag-goals__item.is-done', null, h('span.ag-goals__txt', null, 'All first jobs done. Call the Ministry for more.')));
  }
  function start() {
    if (started) return; started = true;
    if (!card) buildCard();
    render(true);
    card.classList.add('is-on');
    tick = setInterval(() => render(), 1200);
    // the Ministry's letter: the first jobs, in plain words
    try {
      const jobs = state().filter(g => !g.done).slice(0, 3).map((g, i) => `${i + 1}. ${g.text}.`).join('\n');
      game.sendLetter(makeLetter({ from: { kind: 'ministry', id: 'builds', name: 'Ministry of Builds' }, kind: 'ministry', day: S.day || 1, subject: 'Your first jobs',
        body: `Hello, leader. Here is what to build first:\n\n${jobs}\n\nThe list is also at the top left of your screen. Call us any time if you are not sure what to do next.\n\n— Ministry of Builds`,
        options: [{ label: 'Build a house', says: 'build a house in the middle', command: true }], meta: { kind: 'goals' } }), { delay: 0.5 });
    } catch (e) { log('ministry letter', e.message); }
  }

  // ---------- the advice (canned; plain words) ----------
  function advise(text) {
    const t = String(text || '').toLowerCase().trim();
    const g = next(), n = pop();
    const res = S.resources || {}, food = Math.round(res.food || 0), days = n ? Math.max(0, Math.round(food / Math.max(1, n * 0.5))) : 0;
    const homes = built(b => HOME_KINDS.has(b.kind)).length;
    const unhappy = S.agents.filter(a => alive(a) && (a.mood ?? 60) < 40).map(a => a.name);
    const nb = (S.neighbours || []).slice().sort((a, b) => (a.attitude || 0) - (b.attitude || 0));
    const nextLine = g ? `Next job: ${g.text.replace(/^[^:]*:\s*/, '')}${g.of > 1 ? ` (${g.n} of ${g.of} so far)` : ''}.` : 'The first jobs are all done. Try something big: a market, a school, a lighthouse.';
    if (/^(please\s+)?(build|make|plant|put|place|dig|open|raise|add)\b|^(a|an)\s+\w+/.test(t) && command) { command(text); return `On it. The crew starts now: ${String(text).trim().replace(/[.!]+$/, '')}.`; }
    if (/\b(hi|hello|hey|good (morning|evening|day))\b/.test(t) && t.length < 24) return report();
    if (/food|hungry|eat|bread|starv|crop|farm|field/.test(t)) return food < n ? `Food is low: about ${days} days left. Build a bakery and plant a field.` : `Food is fine for now: about ${days} days. A bakery and a field will keep it that way.`;
    if (/home|house|sleep|roof|live/.test(t)) return `${n} residents, ${homes} ${homes === 1 ? 'house' : 'houses'} so far. Build ${Math.max(1, 3 - homes)} more to start.`;
    if (/neighbo|nation|envoy|gift|trade|across/.test(t)) return nb.length ? `${nb[0].title || nb[0].name} is the least friendly. A gift of bread helps: say "send bread to our neighbours".` : 'No word from the neighbours yet.';
    if (/happy|mood|sad|angry|feel|complain|upset/.test(t)) return unhappy.length ? `Unhappy: ${unhappy.slice(0, 3).join(', ')}${unhappy.length > 3 ? ' and others' : ''}. Homes and food help most. Read their letters and answer fairly.` : 'Everyone is in good spirits. Keep building homes and food.';
    if (/minister|who are you|your name/.test(t)) { const m = S.minister ? S.agents.find(a => a.id === S.minister) : null; return m ? `I am ${m.name}, your minister. I speak for the residents. ${nextLine}` : `This is the Ministry desk. You have no minister yet: click a resident and choose "Make minister".`; }
    if (/what|next|should|help|do now|job|task|idea|advice|suggest/.test(t)) return nextLine;
    if (/thank/.test(t)) return 'Chirp! Back to work.';
    return `${nextLine} You can also ask me about food, homes or the neighbours.`;
  }

  // the call opens with the report (14:00: "it shouldn't write like an AI agent; start with the report")
  function report() {
    const n = pop(), homes = built(b => HOME_KINDS.has(b.kind)).length, roofed = Math.min(n, homes * 4);
    const res = S.resources || {}, food = Math.round(res.food || 0), days = n ? Math.max(0, Math.round(food / Math.max(1, n * 0.5))) : 0;
    const unhappy = S.agents.filter(a => alive(a) && (a.mood ?? 60) < 40).length;
    const parts = [];
    if (roofed < n) parts.push(roofed ? `Only ${roofed} of us have a roof tonight. ${n - roofed} sleep under the stars.` : `None of us has a home for tonight. ${n} of us sleep under the stars.`);
    else parts.push(`Everyone has a roof tonight.`);
    parts.push(food < n ? `The crates are almost empty: bread for ${days} ${days === 1 ? 'day' : 'days'}.` : `Bread for about ${days} days.`);
    if (unhappy) parts.push(`${unhappy} ${unhappy === 1 ? 'resident is' : 'residents are'} grumbling.`);
    const g = next(); if (g) parts.push(`We need: ${g.text.replace(/^[^:]*:\s*/, '')}.`);
    return parts.join(' ');
  }
  // ---------- the call ----------
  const minister = () => (S.minister ? S.agents.find(a => a.id === S.minister) : null);
  let portraitSrc = null, portraitFor = null;
  function caller() {
    const m = minister();
    if (m && portraitFor !== m.id && agents && agents.portrait) {
      portraitFor = m.id; portraitSrc = null;
      try { const p = agents.portrait(m.id, { size: 128, ring: false }); if (p && typeof p.then === 'function') p.then(src => { if (portraitFor === m.id) { portraitSrc = src; if (call.isOpen) call.dress(); } }).catch(() => {}); else if (typeof p === 'string') portraitSrc = p; } catch (_) {}
    }
    return m ? { id: m.id, name: m.name, line: `your minister${m.trade ? ', ' + m.trade : ''}`, portrait: portraitSrc, seed: [...String(m.id)].reduce((s, c) => s * 31 + c.charCodeAt(0), 7),
      greeting: report() }
      : { name: 'Ministry of Builds', line: 'the Ministry desk · no minister yet', portrait: null, seed: 11 };
  }
  async function ask(text) {
    const m = minister();
    // a build said on the call is done at once (the canned path handles it); everything else: the minds when live
    if (m && mindsLive() && talkTo && !/^(please\s+)?(build|make|plant|put|place|dig)\b/i.test(text)) {
      try { const r = await Promise.race([talkTo(m.id, text), new Promise(res => setTimeout(() => res(null), 12000))]); if (r && String(r).trim()) return String(r).trim(); } catch (_) {}
    }
    await new Promise(r => setTimeout(r, 450));   // a breath, so the "hm…" is heard
    return advise(text);
  }
  const call = createCall({ layer: ui.el, onAsk: ask, caller, onMic: null });

  return { start, goals: state, next, advise, call, render: () => render(true), get started() { return started; }, get card() { return card; },
    dispose() { clearInterval(tick); card && card.remove(); } };
}

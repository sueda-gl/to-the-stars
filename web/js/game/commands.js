// Commands: one path for everything said or typed (voice finals, the typed line, letter replies, onboarding phrases,
// the director). transcript + the deictic pointer + the cursor mark + a snapshot -> /api/command -> game.apply each
// action -> route the effects (marks consumed, nudges said, refusals said as the minister). Returns the server result,
// so the director can tell a noop from a landed command.

const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = v => Math.round(v * 10) / 10;

// ART_DIRECTION §20: founding an institution asks the sovereign to pick its members by clicking folk (onPickMembers(action,
// { text, apply }) -> true when it took the action: the game's pick mode calls apply(members) on Done); "you choose" /
// "whoever" / "anyone" / an explicit members list keeps the sim's auto-pick.
const YOU_CHOOSE = /\byou (choose|pick|decide|select)\b|\bwhoever\b|\bwhomever\b|\bany ?one you\b|\bup to you\b|\byour (choice|pick)\b/i;

export function createCommands({ game, net, world, marks = null, ui, agents = null, stages = null, cursor, onPickMembers = null, log = () => {} } = {}) {
  let inFlight = 0, lastResult = null, offline = false;
  const listeners = new Set();

  function pointerOf(pointer) {
    if (stages && stages.scene !== 'world') return null;
    let p = null;
    try { p = pointer && Number.isFinite(pointer.x) ? world.pick(pointer.x, pointer.y) : cursor.pick(); } catch (_) { p = null; }
    if (!p) return null;
    const out = { x: r1(p.x), z: r1(p.z) };
    if (p.water) out.near = 'water';
    return out;
  }
  function markOf() {
    if (!marks) return null;
    const full = marks.current(); if (!full) return null;
    const sum = marks.summarize(full) || {};
    return { ...sum, ...full };
  }

  // the server is away: the catalogue still answers plain builds, so a typed "a house" lands on stage without a mind
  function localParse(text, ptr, mark) {
    const t = text.toLowerCase();
    const kind = game.catalog.resolve(t.replace(/\b(on|at|by|near|next to|in|into|beside|behind|in front of|over|there|here)\b.*$/, '').trim()) || game.catalog.resolve(t);
    if (/\b(meeting|assembly)\b/.test(t)) return [{ type: 'call_meeting' }];
    if (/\b(moon)\b/.test(t)) return [{ type: 'go_moon' }];
    if (/\b(neighbou?rs|globe|world)\b/.test(t) && /\b(show|see)\b/.test(t)) return [{ type: 'show', target: 'globe' }];
    if (/\b(home|back down)\b/.test(t)) return [{ type: 'show', target: 'home' }];
    if (kind) return [{ type: 'build', kind, at: mark ? { mode: 'mark' } : /\b(there|here)\b/.test(t) && ptr ? { mode: 'pointer' } : /\b(middle|centre|center|square)\b/.test(t) ? { mode: 'center' } : { mode: 'auto' } }];
    const m = t.match(/^(?:build|make|put|place|raise)?\s*(?:a|an|the|some)?\s*(.+?)(?:\s+(?:on|at|by|near|next to|in|into|beside|behind|over|there|here)\b.*)?$/);
    if (m && m[1] && m[1].split(' ').length <= 5) return [{ type: 'build', kind: null, request: text, at: mark ? { mode: 'mark' } : ptr ? { mode: 'pointer' } : { mode: 'auto' } }];
    return [{ type: 'noop', why: 'offline' }];
  }

  function routeEffects(action, r, beat) {
    const effects = (r && r.effects) || [];
    for (const e of effects) {
      if (e.type === 'mark' && marks) { try { marks.consume(e.markId != null ? e.markId : (marks.current() || {}).id); } catch (_) {} }
      if (e.type === 'nudge' && ui) ui.notice(`Moved ${e.dist} m from your mark (${e.why}).`, { kind: 'ministry', ttl: 4500 });
      if (e.type === 'short' && ui && e.text) ui.notice(e.text, { kind: 'ministry', ttl: 4000 });
    }
    if (r && r.ok === false && r.reason && ui && !(beat && beat.fallback)) ui.notice(r.reason, { kind: 'minister', ttl: 5000 });
  }

  // handle(text, { pointer:{x,y} client px | null, source, beat, quiet }) -> the server result (or null)
  async function handle(text, { pointer = null, source = 'typed', beat = null, quiet = false } = {}) {
    text = String(text || '').trim();
    if (!text) return null;
    const ptr = pointerOf(pointer), mark = markOf(), scene = game.state.scene;
    const snapshot = Object.assign(game.snapshot(), { scene });
    inFlight++;
    listeners.forEach(fn => { try { fn('start', text); } catch (_) {} });
    if (ui) ui.voiceBar.setState('thinking');
    if (agents && stages && stages.scene === 'world') { try { agents.crowdListen(true); } catch (_) {} }
    let res = null, failed = null;
    try { res = await net.command({ transcript: text, pointer: ptr, scene, mark, snapshot }); offline = false; }
    catch (e) { failed = e; log('command failed', e.message); }
    inFlight--;
    if (agents) { try { agents.crowdListen(false); } catch (_) {} }
    if (failed) {
      offline = true;
      if (ui) { ui.offlineNote(true); ui.voiceBar.setState('done', 'the minds are away; the folk heard you anyway'); }
      res = { actions: localParse(text, ptr, mark), say: null, meta: { mind: 'local' } };
    } else if (ui) ui.voiceBar.setState('done', '');
    lastResult = res;
    const acts = Array.isArray(res.actions) ? res.actions : [];
    const full = marks ? marks.current() : null;
    let landed = 0, builds = 0, picking = false;
    for (const a of acts) {
      if (!a || !a.type) continue;
      if (a.type === 'noop') continue;
      // §20: "start a police patrol" -> she clicks the members (unless she said "you choose", or they are already named)
      if (a.type === 'found_institution' && onPickMembers && !Array.isArray(a.members) && !YOU_CHOOSE.test(text) && !(stages && stages.scene !== 'world')) {
        let took = false;
        try { took = !!onPickMembers(a, { text, apply: members => { let r = null; try { r = game.apply({ ...a, members, leader: members[0] }); } catch (e) { r = { ok: false, reason: e.message }; } routeEffects(a, r, beat); return r; } }); } catch (e) { log('pick members', e.message); }
        if (took) { landed++; picking = true; continue; }
      }
      if (a.at && a.at.mode === 'mark' && full) a.at.mark = { ...full };
      // "in the lake" / "on the water" floats (the mind answers near+water for those words; the sim's water mode floats it)
      if (a.type === 'build' && a.at && a.at.mode === 'near' && a.at.ref === 'water' && !full) {
        const w = /\b(in|into|on|onto|across)\s+the\s+(lake|pond|water|sea|bay|ocean)\b/i.exec(text);
        if (w) a.at = { mode: 'water', water: /sea|bay|ocean/i.test(w[2]) ? 'sea' : 'lake' };
      }
      // the sim never sees the cursor: a pointer placement carries the ground point under it (ptr is the deictic moment)
      if (a.at && a.at.mode === 'pointer' && !Number.isFinite(a.at.x)) { if (ptr) { a.at.x = ptr.x; a.at.z = ptr.z; if (ptr.near === 'water') a.at.water = true; } else a.at.mode = 'auto'; }
      let r = null;
      try { r = game.apply(a); } catch (e) { r = { ok: false, reason: e.message }; console.error('[commands] apply', a, e); }
      routeEffects(a, r, beat);
      if (r && r.ok !== false) { landed++; if (a.type === 'build') builds++; }
      if (acts.length > 1) await sleep(250);
    }
    if (ui && !quiet) {
      const say = res.say && res.say.text ? res.say : null;
      const noop = !landed;
      if (say && (noop || !builds) && !picking) ui.notice(say.text, { kind: say.from === 'minister' ? 'minister' : 'ministry', ttl: 5500 });
      else if (noop && !(beat && beat.fallback) && res.meta && res.meta.mind !== 'local') ui.notice('Forgive me, sovereign, I did not catch that. Try "a house in the middle".', { kind: 'minister', ttl: 5000 });
    }
    listeners.forEach(fn => { try { fn('end', text, res); } catch (_) {} });
    return res;
  }

  return {
    handle,
    get inFlight() { return inFlight; }, get lastResult() { return lastResult; }, get offline() { return offline; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}

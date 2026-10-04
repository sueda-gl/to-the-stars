// Tiny emitter. Payloads are plain JSON so the visual/UI layers can take them as is.

export function createEmitter() {
  const map = new Map();
  const history = [];
  return {
    on(ev, fn) { if (!map.has(ev)) map.set(ev, []); map.get(ev).push(fn); return () => this.off(ev, fn); },
    off(ev, fn) { const l = map.get(ev); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    once(ev, fn) { const off = this.on(ev, p => { off(); fn(p); }); return off; },
    emit(ev, payload = {}) {
      history.push({ ev, payload });
      if (history.length > 400) history.splice(0, history.length - 400);
      const l = map.get(ev); if (l) for (const fn of l.slice()) fn(payload, ev);
      const all = map.get('*'); if (all) for (const fn of all.slice()) fn(payload, ev);
    },
    // exact listeners for one event ('*' wildcards do not count): the sim asks whether a visual layer is there
    count(ev) { const l = map.get(ev); return l ? l.length : 0; },
    history
  };
}

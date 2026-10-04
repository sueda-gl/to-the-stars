// Director hooks (?director=1): the scripted demo runs through the SAME caption and command path as live speech, so the
// recorded video is honest. A drawn cursor stands in for the OS pointer (the screencast captures the tab, not the mouse).

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function makeDirectorHooks({ game, world, ui, voice = null, commands, creation, agents = null, stages, folk, intro, letters: L, desk = null, opening = null, log = () => {} } = {}) {
  const cursorEl = document.createElement('div'); cursorEl.className = 'ag-cursor'; document.body.appendChild(cursorEl);
  let lastPointer = null, letterTimer = null;
  const SPOTS = {
    windmill: () => ({ x: 15, z: 11 }),
    cliff: () => ({ x: -16, z: game.state.plot.z0 + 4 }),
    lake: () => (world.lake && world.lake.centre ? { x: world.lake.centre.x, z: world.lake.centre.z } : { x: 10, z: 10 }),
    middle: () => ({ x: game.state.centre.x, z: game.state.centre.z }),
    edge: () => ({ x: 22, z: -18 })
  };
  function showCursor(x, y) { cursorEl.style.left = x + 'px'; cursorEl.style.top = y + 'px'; cursorEl.classList.add('is-on'); }
  function moveCursorTo(x, z) { const p = world.project(x, 0, z); showCursor(p.x, p.y); lastPointer = { x: p.x, y: p.y }; if (voice) { try { voice.injectPointer(p.x, p.y); } catch (_) {} } return p; }

  const hooks = {
    async say(text, { wps, speed, signal, wordByWord }) {
      ui.voiceBar.setState('listening');
      await wordByWord(text, { wps, speed, signal, onText: t => ui.voiceBar.setCaption(t, false) });
      ui.voiceBar.setCaption(text, true, { holdMs: 3500 });
      ui.voiceBar._used && ui.voiceBar._used();
    },
    command(text, beat) { return commands.handle(text, { pointer: lastPointer, source: 'director', beat }); },
    caption(text, { spoken } = {}) { if (spoken) return; if (text) ui.showDirectorCaption(text, {}); else ui.hideDirectorCaption(); },
    title({ text, sub, ms }) {
      ui.titleCard.show({ title: text, subtitle: sub, begin: 'Begin' });
      setTimeout(() => { try { ui.titleCard.hide(); } catch (_) {} }, Math.max(600, ms - 500));
    },
    async pointer(spot) {
      const p = typeof spot === 'string' ? (SPOTS[spot] || SPOTS.middle)() : spot && Number.isFinite(spot.x) && spot.x <= 1 && spot.y <= 1 ? null : spot;
      if (p) moveCursorTo(p.x, p.z); else if (spot) showCursor(spot.x * innerWidth, spot.y * innerHeight), lastPointer = { x: spot.x * innerWidth, y: spot.y * innerHeight };
      await sleep(900);
      if (p) moveCursorTo(p.x, p.z);   // the camera may still be settling
    },
    async camera({ to, ms }) {
      if (to === 'descent') { await intro(); return; }
      if (to === 'neighbours') return;   // the "show me the neighbours" command flies the globe itself
      if (to === 'meeting') { if (stages.scene !== 'world') await stages.goHome(); }
    },
    async idle() {
      const t0 = performance.now();
      await sleep(1500);
      while (performance.now() - t0 < 60000) {
        if (!commands.inFlight && !creation.pending() && !stages.fading && !stages.flying) break;   // flying: her descents, the voyage to Plissé and the landing
        await sleep(250);
      }
      await sleep(600);
    },
    waitEvent(name, timeoutMs) {
      return new Promise(res => {
        let done = false; const off = () => { if (done) return; done = true; try { game.off(name, fn); } catch (_) {} res(true); };
        const fn = () => off();
        game.on(name, fn);
        setTimeout(() => { if (!done) { done = true; try { game.off(name, fn); } catch (_) {} res(false); } }, timeoutMs);
      });
    },
    pickAgentName(skill) {
      const alive = game.state.agents.filter(a => a.status !== 'left');
      const best = alive.slice().sort((a, b) => ((b.skills || {})[skill] || 0) - ((a.skills || {})[skill] || 0))[0];
      return best ? best.name : 'Olla';
    },
    openLetter(ms = 4000) {
      clearTimeout(letterTimer);
      try { ui.letters.toggleList(true); } catch (_) {}
      letterTimer = setTimeout(() => { try { if (ui.letters.isOpen) ui.letters.close(); } catch (_) {} }, Math.max(1500, ms - 400));
    },
    closeLetter() { clearTimeout(letterTimer); try { if (ui.letters.isOpen) ui.letters.close(); } catch (_) {} },
    // the spawn beat is the whole opening now (landing view, fleets, introductions, the minister picked by itself)
    spawn() { if (opening) return opening.run({ auto: true }).catch(e => log('opening', e.message)); game.spawnAll(); },
    envoy() {
      const n = game.state.neighbours.slice().sort((a, b) => (b.attitude || 0) - (a.attitude || 0))[0];
      if (!n) return;
      try { game.sendLetter(L.neighbourLetter(game.rng, { neighbour: n, kind: 'greeting', day: game.state.day, settlement: game.state.name, our: game.state.resources, give: {}, get: {} })); } catch (e) { log('envoy', e.message); }
    },
    gift({ what = 'bread' } = {}) {
      const n = game.state.neighbours.slice().sort((a, b) => (b.attitude || 0) - (a.attitude || 0))[0];
      return game.apply({ type: 'send_gift', neighbourId: n ? n.id : 'n2', gift: `a basket of ${what}`, give: { food: 3 } });
    },
    visitNeighbour() { return stages.showGlobe(); },
    meeting() { return game.apply({ type: 'call_meeting' }); },
    goHome() { return stages.scene === 'world' ? Promise.resolve(true) : stages.goHome(); },
    endMeeting() { try { if (desk && desk.meetingOn) desk.endMeeting(); } catch (_) {} },
    hideCursor() { cursorEl.classList.remove('is-on'); },
    onPlay() { ui.cinema(false); },
    onDone() { cursorEl.classList.remove('is-on'); ui.hideDirectorCaption(); },
    onError(e, beat) { log('director error', beat && beat.id, e && e.message); }
  };
  return hooks;
}

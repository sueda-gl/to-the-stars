import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDirector, DEFAULT_BEATS, TIMING, wordByWord, isDirectorMode } from '../../web/js/director.js';

const fast = { speed: 0.002 };   // every wait becomes ~ms-scale

function fakeHooks(log) {
  return {
    say: async (text, { wordByWord: wbw, speed, signal }) => { let last = ''; await wbw(text, { speed, signal, onText: t => last = t }); log.push(['say', last]); },
    command: async (text) => { log.push(['command', text]); },
    caption: (t) => log.push(['caption', t]),
    title: (t) => log.push(['title', t.text]),
    camera: (c) => log.push(['camera', c.to]),
    pointer: (p) => log.push(['pointer', p]),
    idle: () => new Promise(r => setTimeout(r, 2)),
    waitEvent: (name) => new Promise(r => setTimeout(() => r(name), 2)),
    pickAgentName: (skill) => ({ baking: 'Olla' })[skill] || 'Pim',
    openLetter: () => log.push(['openLetter']),
    spawn: () => log.push(['spawn']),
    envoy: () => log.push(['envoy']),
  };
}

test('DEFAULT_BEATS play end to end with fake hooks, in order, and set __directorDone', async () => {
  const log = [], win = {};
  const d = createDirector({ hooks: fakeHooks(log), timing: fast, win });
  await d.play();
  assert.equal(win.__directorDone, true); assert.equal(d.state.done, true);
  const commands = log.filter(l => l[0] === 'command').map(l => l[1]);
  assert.deepEqual(commands, [
    "Let's build a house in the middle.", 'and a windmill there', 'who here is good at baking?', 'make Olla our minister',
    'build a lighthouse on the cliff', 'put a giant rubber duck there, in the lake', 'send the neighbours a basket of bread', 'show me the neighbours', 'call a meeting',
    'build a rocket', "let's go to the moon", 'offer them a seed', 'wait for the evening', "let's go home",   // act 3 (2026-10-04)
  ]);
  const says = log.filter(l => l[0] === 'say').map(l => l[1]);
  assert.deepEqual(says, commands, 'spoken text equals the command text');
  assert.deepEqual(log.filter(l => l[0] === 'pointer').map(l => l[1]), ['windmill', 'cliff', 'lake']);
  assert.deepEqual(log.filter(l => l[0] === 'camera').map(l => l[1]), ['descent', 'neighbours', 'meeting']);
  assert.deepEqual(log.filter(l => l[0] === 'title').map(l => l[1]), ['AGORA', 'AGORA']);
  assert.equal(log.filter(l => l[0] === 'openLetter').length, 2);
  assert.ok(log.some(l => l[0] === 'spawn') && log.some(l => l[0] === 'envoy'));
  // the pointer is set before the utterance that uses it
  const iPointer = log.findIndex(l => l[0] === 'pointer' && l[1] === 'windmill'), iSay = log.findIndex(l => l[0] === 'command' && /windmill/.test(l[1]));
  assert.ok(iPointer < iSay);
  assert.equal(log.at(-1)[0], 'caption'); assert.equal(log.at(-1)[1], null, 'caption cleared at the end');
});

test('missing hooks are skipped (a partial game still plays)', async () => {
  const d = createDirector({ hooks: {}, timing: fast, win: {} });
  await d.play();
  assert.equal(d.state.done, true);
});

test('hook errors do not stop the run; onError is told', async () => {
  const errs = [];
  const d = createDirector({ beats: [{ id: 'bad', do: async () => { throw new Error('boom'); } }, { id: 'ok', wait: 1 }], hooks: { onError: (e, b) => errs.push(b.id) }, timing: fast });
  await d.play();
  assert.deepEqual(errs, ['bad']); assert.equal(d.state.done, true);
});

test('skip() moves to the next beat, stop() ends the run', async () => {
  const seen = [];
  const beats = [{ id: 'a', wait: 100000 }, { id: 'b', wait: 100000 }, { id: 'c', wait: 100000 }];
  const d = createDirector({ beats, hooks: { onBeat: b => seen.push(b.id) }, timing: { speed: 1 } });
  const p = d.play();
  await new Promise(r => setTimeout(r, 5));
  d.skip();
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(seen, ['a', 'b']);
  d.stop();
  await p;
  assert.deepEqual(seen, ['a', 'b']); assert.equal(d.state.playing, false);
});

test('idle wait is capped by idleMax; event wait by its timeout', async () => {
  const t0 = Date.now();
  const d = createDirector({ beats: [{ wait: 'idle' }, { wait: { event: 'x', timeout: 10 } }], hooks: { idle: () => new Promise(() => {}), waitEvent: () => new Promise(() => {}) }, timing: { idleMax: 10, speed: 1 } });
  await d.play();
  assert.ok(Date.now() - t0 < 500);
});

test('wordByWord paces at ~wps and ends with the full text', async () => {
  const seen = [];
  const t0 = Date.now();
  const out = await wordByWord('one two three four five six seven eight', { wps: 32, onText: t => seen.push(t) });
  const dt = Date.now() - t0;
  assert.equal(out, 'one two three four five six seven eight');
  assert.equal(seen.length, 8); assert.equal(seen[0], 'one'); assert.equal(seen.at(-1), out);
  assert.ok(dt > 120 && dt < 1200, `8 words at 32 wps took ${dt} ms`);
  assert.equal(TIMING.wordsPerSecond, 3.2);
});

test('isDirectorMode', () => {
  assert.equal(isDirectorMode('?director=1'), true);
  assert.equal(isDirectorMode('?x=2&director=true'), true);
  assert.equal(isDirectorMode('?director=0'), false);
  assert.equal(isDirectorMode(''), false);
});

// ---------- reviewer findings (2026-10-03) ----------
import { isNoop } from '../../web/js/director.js';

test('every spoken beat carries a build / send / show verb or a fallback (no bare "a <noun> <place>")', () => {
  const spoken = DEFAULT_BEATS.filter(b => typeof b.say === 'string');
  for (const b of spoken) {
    const verb = /^(build|put|make|send|show|call|who|and a)\b|\b(build|put|make|send|show|call)\b/i.test(b.say);
    assert.ok(verb || b.fallback, `${b.id}: "${b.say}"`);
  }
  const ids = DEFAULT_BEATS.map(b => b.id);
  for (const id of ['bread', 'neighbours', 'meeting']) assert.equal(typeof DEFAULT_BEATS[ids.indexOf(id)].fallback, 'function', `${id} has a local fallback`);
  assert.match(DEFAULT_BEATS[ids.indexOf('lighthouse')].say, /^build /);
  assert.match(DEFAULT_BEATS[ids.indexOf('duck')].say, /^put .*\bthere\b/);
});

test('isNoop, and a noop-only command result runs the beat fallback (a throw too); handled results do not', async () => {
  assert.equal(isNoop({ actions: [{ type: 'noop', why: 'x' }] }), true);
  assert.equal(isNoop({ actions: [] }), true);
  assert.equal(isNoop(undefined), true);
  assert.equal(isNoop({ actions: [{ type: 'build' }, { type: 'noop' }] }), false);
  assert.equal(isNoop([{ type: 'call_meeting' }]), false);
  assert.equal(isNoop({ ok: true }), false, 'an object without actions counts as handled');

  const calls = [];
  const beats = [
    { id: 'a', say: 'send them bread', fallback: (h, r) => calls.push(['fallback-a', r.actions[0].type]) },
    { id: 'b', say: 'show me the neighbours', fallback: () => calls.push(['fallback-b']) },
    { id: 'c', say: 'call a meeting', fallback: () => calls.push(['fallback-c']) },
    { id: 'd', say: 'build a house', fallback: () => calls.push(['fallback-d']) },
  ];
  const hooks = {
    say: async () => {},
    command: async (text, beat) => {
      calls.push(['command', beat.id]);
      if (beat.id === 'a') return { actions: [{ type: 'noop', why: 'no send_gift yet' }] };
      if (beat.id === 'b') throw new Error('http 500');
      if (beat.id === 'c') return { actions: [{ type: 'call_meeting' }] };
      return undefined;   // a game that returns nothing: treated as noop
    },
  };
  const d = createDirector({ beats, hooks, timing: { speed: 0, afterSay: 0 }, win: null });
  await d.play();
  assert.deepEqual(calls, [['command', 'a'], ['fallback-a', 'noop'], ['command', 'b'], ['fallback-b'], ['command', 'c'], ['command', 'd'], ['fallback-d']]);
});

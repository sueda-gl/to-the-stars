import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanForbidden, validateCode, compile } from '../../server/codegen/validate.js';
import { normaliseAction, normaliseActions, normaliseLetterDraft, normaliseCodegenMeta, COMMAND_SCHEMA, SOCIETY_SCHEMA, LETTER_SCHEMA, CODEGEN_SCHEMA, SKETCH_SCHEMA } from '../../server/schemas.js';
import { STOCK, mockAsset } from '../../server/mock/codegen.js';
import { parseEnv, resolveMock } from '../../server/config.js';
import { loadCatalogue } from '../../server/catalogue.js';

const catalogue = await loadCatalogue();

test('forbidden-token scan catches every listed token, ignores strings and comments', () => {
  for (const tok of ['window.x', 'document.body', 'globalThis.a', 'fetch(u)', 'new XMLHttpRequest()', 'import x from "y"', 'eval(s)', 'Function("x")', 'localStorage.get', 'setTimeout(f)', 'setInterval(f)', 'while(true){}', 'while (true) {}', 'for(;;){}']) {
    assert.ok(scanForbidden(`function build(api){ ${tok}; return api.group(); }`).length > 0, `should flag ${tok}`);
  }
  assert.deepEqual(scanForbidden('function build(api){ var important = 1; var g = api.group(); g.add(api.window({ w: 1 })); // window\n /* document */ var s = "a sill"; return g; }'), []);
  // phase-3 audit: the words are banned INSIDE string literals too (obj["constructor"] smuggling), decoders are banned
  assert.deepEqual(scanForbidden('function build(api){ var s = "fetch"; return api.group(); }'), ['"fetch" inside a string literal']);
  for (const tok of ['api["constructor"]', 'api["__proto__"]', 'api["prototype"]', 'var s = "globalThis"', 'var s = "window"', 'var s = `Function`', 'String.fromCharCode(1)', 'atob("x")', 'btoa("x")', 'x.codePointAt(0)', 'api.group().prototype']) {
    assert.ok(scanForbidden(`function build(api){ ${tok}; return api.group(); }`).length > 0, `should flag ${tok}`);
  }
});

test('validateCode: syntax, shape, dry run; every stock asset passes', () => {
  for (const [k, s] of Object.entries(STOCK)) if (s.code) assert.equal(validateCode(s.code).ok, true, k);
  assert.equal(Object.keys(STOCK).sort().join(','), 'boat,dragon,duck,generic,lighthouse,rocket,statue,tower,tree,windclock');
  assert.match(validateCode('function build(api){ return api.group( }').errors[0], /syntax/);
  assert.match(validateCode('function make(api){ return 1 }').errors[0], /function build\(api\)/);
  assert.match(validateCode('function build(api){ window.x = 1; return api.group(); }').errors[0], /forbidden/);
  assert.match(validateCode('function build(api){ var g = api.group(); g.add(undefinedThing()); return g; }').errors[0], /runtime error/);
  assert.match(validateCode('function build(api){ var g = api.group(); return; }').errors[0], /returned nothing/);
  assert.equal(validateCode('').ok, false);
  assert.equal(typeof compile(STOCK.tower.code), 'function');
});

test('mock codegen picks a stock plan per keyword family, names it after the request, and raises unknown nouns from the sketch', () => {
  const a = mockAsset({ request: 'a lighthouse on the cliff' });
  assert.equal(a.stock, 'lighthouse'); assert.equal(a.name, 'Lighthouse'); assert.match(a.id, /^gen-lighthouse-/);
  assert.ok(a.aliases.includes('beacon')); assert.equal(a.meta.category, 'landmark');
  assert.equal(mockAsset({ request: 'a great statue of our minister' }).stock, 'statue');
  assert.equal(mockAsset({ request: 'an observatory' }).stock, 'tower');
  const fam = { 'a giant rubber duck in the lake': 'duck', 'a dragon statue in the square': 'dragon', 'build a rocket': 'rocket', 'a boat on the lake': 'boat', 'a giant tree': 'tree', 'bir ejderha heykeli': 'dragon', 'a bathhouse': 'generic', 'a totem pole': 'statue' };
  for (const [r, f] of Object.entries(fam)) assert.equal(mockAsset({ request: r }).stock, f, r);
  const g = mockAsset({ request: 'a bathhouse' });
  assert.match(g.code, /massing sketch/); assert.equal(validateCode(g.code).ok, true); assert.equal(g.meta.category, 'building');
  assert.equal(mockAsset({ request: 'a giant tree' }).meta.category, 'nature'); assert.equal(mockAsset({ request: 'a boat' }).meta.category, 'prop');
});

test('mock sketch: ≤16 parts, palette hexes only, scaled by size words, same family as the stock plan', async () => {
  const { mockSketch, pickFamily } = await import('../../server/mock/sketch.js');
  const { SKETCH_PALETTE, normaliseSketch, SKETCH_SCHEMA } = await import('../../server/schemas.js');
  const hexes = new Set(Object.values(SKETCH_PALETTE));
  for (const r of ['a giant rubber duck in the lake', 'a lighthouse on the cliff', 'a dragon statue', 'a rocket', 'a boat', 'a giant tree', 'an observatory', 'a bathhouse', 'a statue']) {
    const s = mockSketch({ request: r });
    assert.ok(s.parts.length >= 3 && s.parts.length <= 16, r); assert.ok(s.parts.every(p => hexes.has(p.color)), r);
    assert.ok(s.footprint.w >= 1 && s.height > 0, r); assert.equal(s.family, pickFamily(r));
    for (const k of Object.keys(SKETCH_SCHEMA.properties)) assert.ok(k in s, `${r} has ${k}`);
  }
  assert.ok(mockSketch({ request: 'a giant duck' }).height > mockSketch({ request: 'a duck' }).height * 1.5);
  assert.ok(mockSketch({ request: 'a small boat' }).height < mockSketch({ request: 'a boat' }).height);
  const n = normaliseSketch({ parts: Array.from({ length: 30 }, () => ({ shape: 'box', x: 0, y: 1, z: 0, w: 2, h: 2, d: 2, color: 'red' })) }, 'a cube');
  assert.equal(n.parts.length, 16); assert.equal(n.parts[0].color, SKETCH_PALETTE.limestone); assert.equal(n.name, 'cube');
  assert.equal(normaliseSketch({ parts: [] }), null); assert.equal(normaliseSketch(null), null);
});

test('structured-output schemas: every object closes additionalProperties and lists required', () => {
  const walk = (s, path = '$') => {
    if (!s || typeof s !== 'object') return;
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false, `${path} must set additionalProperties:false`);
      assert.deepEqual(Object.keys(s.properties), s.required, `${path} must require every key`);
      for (const [k, v] of Object.entries(s.properties)) walk(v, `${path}.${k}`);
    }
    if (s.items) walk(s.items, `${path}[]`);
    if (s.anyOf) s.anyOf.forEach((v, i) => walk(v, `${path}|${i}`));
    for (const k of ['minimum', 'maximum', 'minLength', 'maxLength']) assert.equal(s[k], undefined, `${path} must not use ${k}`);
  };
  for (const s of [COMMAND_SCHEMA, SOCIETY_SCHEMA, LETTER_SCHEMA, CODEGEN_SCHEMA, SKETCH_SCHEMA]) walk(s);
  // the API caps union-typed (nullable / anyOf / type-array) parameters at 16 per schema (a live 400 otherwise)
  const unions = (s) => { let n = 0; const w = (x) => { if (!x || typeof x !== 'object') return; if (x.anyOf || Array.isArray(x.type)) n++; if (x.properties) Object.values(x.properties).forEach(w); if (x.items) w(x.items); if (x.anyOf) x.anyOf.forEach(w); }; w(s); return n; };
  for (const [k, s] of Object.entries({ COMMAND_SCHEMA, SOCIETY_SCHEMA, LETTER_SCHEMA, CODEGEN_SCHEMA, SKETCH_SCHEMA })) assert.ok(unions(s) <= 16, `${k} has ${unions(s)} union-typed parameters (limit 16)`);
  // empty values are "unset" for the normaliser, exactly as the prompt tells the model
  const e = normaliseAction({ type: 'build', kind: 'house', request: '', name: '', at: { mode: 'center', ref: '', x: null, z: null }, count: 0, assign: [], question: '', skill: '', agentId: '', agentIds: [], to: '', letterId: '', decision: '', text: '', buildingId: '', neighbourId: '', give: [], get: [], gift: '', do: '', target: '', why: '' }, null, catalogue);
  assert.deepEqual(e.action, { type: 'build', kind: 'house', at: { mode: 'center' } });
});

test('normaliseAction enforces §4 and never invents ids', () => {
  const snap = { agents: [{ id: 'a1', name: 'Olla' }], buildings: [{ id: 'b1', kind: 'windmill' }], neighbours: [{ id: 'n1' }], letters: [{ id: 'l1' }] };
  assert.equal(normaliseAction({ type: 'appoint_minister', agentId: 'ghost' }, snap).ok, false);
  assert.equal(normaliseAction({ type: 'reply_letter', letterId: 'l9' }, snap).ok, false);
  assert.equal(normaliseAction({ type: 'demolish', buildingId: 'b1' }, snap).ok, true);
  // unknown kind (no prefab, no asset) becomes a request; near-by-kind resolves to the building id
  const b = normaliseAction({ type: 'build', kind: 'zeppelin', at: { mode: 'near', ref: 'windmill' }, count: 99 }, snap, catalogue);
  assert.equal(b.ok, true); assert.equal(b.action.kind, null); assert.equal(b.action.request, 'zeppelin'); assert.deepEqual(b.action.at, { mode: 'near', ref: 'b1' }); assert.equal(b.action.count, 6);
  // trade: array form -> {res:n}
  const t = normaliseAction({ type: 'trade', neighbourId: 'n1', give: [{ res: 'wood', n: 10 }], get: [{ res: 'food', n: 5 }] }, snap);
  assert.deepEqual(t.action, { type: 'trade', neighbourId: 'n1', give: { wood: 10 }, get: { food: 5 } });
  const r = normaliseActions([{ type: 'call_meeting' }, { type: 'nonsense' }, { type: 'noop' }], snap);
  assert.equal(r.actions.length, 2); assert.equal(r.dropped.length, 1);
});

test('letter drafts and codegen meta normalise', () => {
  const l = normaliseLetterDraft({ from: { kind: 'agent', id: 'a1', name: 'Olla' }, subject: 'Hi', body: 'There.', kind: 'weird', options: [{ label: 'a', says: 'yes' }, { label: 'x' }] });
  assert.equal(l.kind, 'petition'); assert.equal(l.options.length, 1);
  assert.equal(normaliseLetterDraft({ subject: 'no body' }), null);
  const m = normaliseCodegenMeta({ footprint: { w: 0, d: 2 }, cost: { stone: 5 }, workers: 99, skill: 'magic', buildSeconds: 1, perDay: { coin: 2, food: 0 } });
  assert.deepEqual(m.footprint, { w: 3, d: 2 }); // 0 is 'unset' -> default 3 assert.equal(m.workers, 6); assert.equal(m.skill, 'building'); assert.equal(m.buildSeconds, 10); assert.deepEqual(m.perDay, { coin: 2 });
});

test('env parsing and mock resolution', () => {
  assert.deepEqual(parseEnv('# c\nexport A=1\nB="two words"\nC=x # trailing\n\nbad line'), { A: '1', B: 'two words', C: 'x' });
  assert.equal(resolveMock({}).mock, true);
  assert.equal(resolveMock({ ANTHROPIC_API_KEY: 'k' }).mock, false);
  assert.equal(resolveMock({ ANTHROPIC_AUTH_TOKEN: 't' }).mock, false);
  assert.equal(resolveMock({ ANTHROPIC_API_KEY: 'k', AGORA_MOCK: '1' }).mock, true);
  assert.equal(resolveMock({ AGORA_MOCK: '0' }).mock, false);
});

// Audit round 1: generated code must never run in the server's realm, hang it, or reach the host.
test('validateCode rejects escapes, host access, promises, async and endless loops; dry run is isolated and timed', async () => {
  const { dryRun, harden, stripLiterals } = await import('../../server/codegen/validate.js');
  const probes = {
    promiseReject: `function build(api){ Promise.reject(new Error('boom')); return api.group(); }`,
    thisFetch: `function build(api){ this.fetch('http://x'); return api.group(); }`,
    thisProcessEnv: `function build(api){ var k = this.process.env.ANTHROPIC_API_KEY; return api.group(); }`,
    unicodeEscape: `function build(api){ \\u0067lobalThis.__pwned = 1; return api.group(); }`,
    constructorChain: `function build(api){ api.constructor.constructor('return this')(); return api.group(); }`,
    childrenArray: `function build(api){ api.group().children.constructor.constructor('return this')(); return api.group(); }`,
    whileOne: `function build(api){ while(1){} return api.group(); }`,
    forEmptyCond: `function build(api){ for(;1;){} return api.group(); }`,
    doWhile: `function build(api){ do {} while (true); return api.group(); }`,
    longLoop: `function build(api){ var s=0; for (var i=0;i<4e9;i++){ s+=i; } return api.group(); }`,
    asyncFn: `function build(api){ (async function(){ throw new Error('x'); })(); return api.group(); }`,
    selfTop: `function build(api){ self.x = 1; return api.group(); }`,
    template: 'function build(api){ var s = `${window.name}`; return api.group(); }',
    withStmt: `function build(api){ with (api) { } return api.group(); }`,
  };
  for (const [name, code] of Object.entries(probes)) assert.equal(validateCode(code).ok, false, `must reject ${name}`);
  // the dry run alone (blacklist bypassed) cannot generate code, see the host, or spin forever
  assert.match(dryRun(`function build(api){ return [].constructor.constructor('return process')(); }`).error, /Code generation from strings disallowed/);
  assert.equal(dryRun(`function build(api){ return typeof globalThis.process + typeof globalThis.require; }`).value, 'undefinedundefined');
  assert.equal(dryRun(`function build(api){ return (function(){ return this; })() === undefined; }`).value, true); // strict: no sloppy this
  const t0 = Date.now(); assert.match(dryRun(`function build(api){ for(;1;){} }`, { timeout: 200 }).error, /ran for more than 200 ms/); assert.ok(Date.now() - t0 < 1500);
  // benign code still passes, including loops, children.forEach and iteration over a group
  const good = `function build(api){ var g = api.group(); for (var i = 0; i < 12; i++) g.add(api.window({ w: 0.5, h: 0.6, x: i })); g.children.forEach(function (c) {}); for (var c of g.children) {} var r = /a'b/g; var label = "the sill"; /* the window sill */ return g; }`;
  assert.deepEqual(validateCode(good), { ok: true });
  // strict prologue is idempotent and keeps the shape the browser wrapper expects
  assert.ok(harden(STOCK.tower.code).startsWith("'use strict';\n"));
  assert.equal(harden(harden(STOCK.tower.code)), harden(STOCK.tower.code));
  assert.equal(validateCode(harden(STOCK.tower.code)).ok, true);
  // literal stripping keeps template expressions and drops regex literals
  assert.match(stripLiterals('`a ${fetch(1)} b`'), /fetch/);
  assert.doesNotMatch(stripLiterals('var r = /window/; var s = "window"; // window'), /window/);
});

test('normaliseActions keeps one reply per letter and one meeting', () => {
  const snap = { letters: [{ id: 'l1' }], agents: [{ id: 'a1' }] };
  const r = normaliseActions([{ type: 'reply_letter', letterId: 'l1', decision: 'yes', text: 'yes' }, { type: 'reply_letter', letterId: 'l1', decision: 'yes', text: 'go ahead' }, { type: 'call_meeting' }, { type: 'call_meeting' }], snap);
  assert.equal(r.actions.length, 2); assert.equal(r.dropped.length, 2); assert.match(r.dropped[0].reason, /duplicate/);
});

test('asset cache matches the request noun, not any word; mock aliases stay specific', async () => {
  const { createAssetStore, requestNoun } = await import('../../server/assets.js');
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const store = createAssetStore(fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cache-')));
  assert.equal(requestNoun('another lighthouse on the cliff, please'), 'lighthouse');
  assert.equal(requestNoun('two lighthouses there'), 'lighthouse');
  assert.equal(requestNoun('a clock tower'), 'clock tower');
  const obs = store.put(mockAsset({ request: 'an observatory' }));
  assert.deepEqual(obs.aliases, ['observatory']); // served by the stock tower, but not aliased as one
  assert.deepEqual(mockAsset({ request: 'a clock tower' }).aliases, ['clock tower']); // contains the word, is not the thing
  assert.ok(mockAsset({ request: 'a tall tower by the gate' }).aliases.includes('keep')); // is the thing: stock synonyms apply
  assert.ok(obs.code.startsWith("'use strict';"));
  store.put(mockAsset({ request: 'a lighthouse on the cliff' }));
  assert.equal(store.find('a tower'), null); assert.equal(store.find('a clock tower'), null); assert.equal(store.find('a giant lighthouse'), null);
  assert.equal(store.find('another lighthouse')?.name, 'Lighthouse'); assert.equal(store.find('a beacon by the sea')?.name, 'Lighthouse'); assert.equal(store.find('the observatory')?.name, 'Observatory');
  // a legacy record (old mock, no strict prologue, generic stock aliases) is migrated on read
  fs.writeFileSync(path.join(store.dir, 'gen-giraffe-legacy.json'), JSON.stringify({ id: 'gen-giraffe-legacy', name: 'Totally New Giraffe', aliases: ['totally new giraffe', 'tower', 'tall tower', 'keep', 'belfry'], stock: 'tower', request: 'a totally new giraffe', code: STOCK.tower.code, generated: true }));
  const legacy = store.get('gen-giraffe-legacy');
  assert.deepEqual(legacy.aliases, ['totally new giraffe']); assert.ok(legacy.code.startsWith("'use strict';"));
  assert.equal(store.find('a tower'), null); assert.equal(store.find('a totally new giraffe')?.id, 'gen-giraffe-legacy');
  assert.equal(store.put(mockAsset({ request: 'a tall tower' })).aliasesVersion, 2);
  assert.ok(store.find('a tower')?.aliases.includes('keep')); // new stock record keeps its synonyms through a read
});

test('§9 actions normalise: send_gift / visit_neighbour need a known nation, moon needs the moon scene, show defaults to globe', () => {
  const snap = { neighbours: [{ id: 'n1' }], unread: [{ id: 'l1' }], agents: [{ id: 'a1' }] };
  assert.deepEqual(normaliseAction({ type: 'send_gift', neighbourId: 'n1', gift: ' a basket of bread ', give: [{ res: 'food', n: 3 }] }, snap).action, { type: 'send_gift', neighbourId: 'n1', gift: 'a basket of bread', give: { food: 3 } });
  assert.deepEqual(normaliseAction({ type: 'send_gift', neighbourId: 'n1' }, snap).action, { type: 'send_gift', neighbourId: 'n1', gift: 'a gift' });
  assert.equal(normaliseAction({ type: 'send_gift', neighbourId: 'ghost' }, snap).ok, false);
  assert.deepEqual(normaliseAction({ type: 'visit_neighbour', neighbourId: 'n1' }, snap).action, { type: 'visit_neighbour', neighbourId: 'n1' });
  assert.deepEqual(normaliseAction({ type: 'show' }, snap).action, { type: 'show', target: 'globe' });
  assert.deepEqual(normaliseAction({ type: 'show', target: 'home' }, snap).action, { type: 'show', target: 'home' });
  assert.equal(normaliseAction({ type: 'go_moon' }, snap).ok, true); assert.equal(normaliseAction({ type: 'go_moon' }, snap, null, { scene: 'moon' }).ok, false);
  assert.equal(normaliseAction({ type: 'moon', do: 'seed' }, snap).ok, false);
  assert.deepEqual(normaliseAction({ type: 'moon', do: 'seed', text: 'offer them a seed' }, snap, null, { scene: 'moon' }).action, { type: 'moon', do: 'seed', text: 'offer them a seed' });
  assert.equal(normaliseAction({ type: 'moon', do: 'dance' }, snap, null, { scene: 'moon' }).ok, false);
  // the sim's snapshot shape (unread / recent, no letters) is enough for reply_letter
  assert.equal(normaliseAction({ type: 'reply_letter', letterId: 'l1', decision: 'yes' }, snap).ok, true);
  assert.equal(normaliseAction({ type: 'reply_letter', letterId: 'l2', decision: 'yes' }, snap).ok, false);
  // one voyage / one globe per utterance
  const r = normaliseActions([{ type: 'go_moon' }, { type: 'go_moon' }, { type: 'show' }, { type: 'show', target: 'home' }], snap);
  assert.equal(r.actions.length, 2); assert.equal(r.dropped.length, 2);
  // codegen meta carries a category (given, or guessed from the words)
  assert.equal(normaliseCodegenMeta({ category: 'prop' }).category, 'prop');
  assert.equal(normaliseCodegenMeta({ desc: 'a tall lighthouse by the sea' }).category, 'landmark');
  assert.equal(normaliseCodegenMeta({ desc: 'an old oak' }).category, 'nature');
  assert.equal(normaliseCodegenMeta({}).category, 'building');
});

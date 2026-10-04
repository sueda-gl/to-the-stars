import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDeictic, mergeTranscript, createAssembler, settleTranscript, langKey } from '../../web/js/voice/transcript.js';
import { createPointerTimeline } from '../../web/js/voice/pointer.js';

test('findDeictic: english words and phrases, whole words only', () => {
  assert.deepEqual(findDeictic('and a windmill there'), { word: 'there', index: 15 });
  assert.equal(findDeictic('a windmill over there').word, 'over there');
  assert.equal(findDeictic('put a well right here').word, 'right here');
  assert.equal(findDeictic('this spot please').word, 'this spot');
  assert.equal(findDeictic('build a house in the middle'), null);
  assert.equal(findDeictic('therefore we build'), null, 'no partial-word match');
  assert.equal(findDeictic('the heretics'), null);
  assert.deepEqual(findDeictic('THERE'), { word: 'there', index: 0 }, 'case-insensitive');
  assert.equal(findDeictic(''), null, 'empty is null');
});

test('findDeictic: turkish forms, and english words still count in tr-TR', () => {
  assert.equal(findDeictic('şuraya bir yel değirmeni', 'tr-TR').word, 'şuraya');
  assert.equal(findDeictic('Burada bir ev yap', 'tr-TR').word, 'burada');
  assert.equal(findDeictic('orada bir fener', 'tr-TR').word, 'orada');
  assert.equal(findDeictic('bir fener there', 'tr-TR').word, 'there');
  assert.equal(findDeictic('buradaki ev', 'tr-TR'), null, 'suffix forms are not matched');
  assert.equal(langKey('tr-TR'), 'tr'); assert.equal(langKey('EN_us'), 'en');
});

test('mergeTranscript joins finals and interim, tidies whitespace', () => {
  assert.equal(mergeTranscript(["let's build", ' a house '], 'in the  middle'), "let's build a house in the middle");
  assert.equal(mergeTranscript([], ''), '');
  assert.equal(mergeTranscript(['one'], undefined), 'one');
});

const ev = (resultIndex, list) => ({ resultIndex, results: list.map(([t, f]) => ({ isFinal: f, 0: { transcript: t }, length: 1 })) });

test('assembler: interim rewrites settle into finals, Chrome-style', () => {
  const a = createAssembler();
  a.ingest(0, [['lets', false]].map(x => ({ isFinal: x[1], 0: { transcript: x[0] } })));
  assert.equal(a.text(), 'lets'); assert.equal(a.finalText(), ''); assert.equal(a.hasPendingInterim(), true);
  a.ingest(0, ev(0, [["let's build", false]]).results);
  a.ingest(0, ev(0, [["let's build a house", true]]).results);
  assert.equal(a.finalText(), "let's build a house"); assert.equal(a.hasPendingInterim(), false);
  // the next phrase arrives at index 1; only index 1 is sent (resultIndex = 1)
  a.ingest(1, ev(1, [["let's build a house", true], ['in the middle', false]]).results);
  assert.equal(a.text(), "let's build a house in the middle");
  assert.equal(a.interim(), 'in the middle');
  a.ingest(1, ev(1, [["let's build a house", true], ['in the middle', true]]).results);
  assert.equal(a.finalText(), "let's build a house in the middle");
});

test('assembler: rollover keeps text across a recogniser restart', () => {
  const a = createAssembler();
  a.ingest(0, ev(0, [['a windmill', true]]).results);
  a.ingest(1, ev(1, [['a windmill', true], ['over', false]]).results);
  a.rollover();
  assert.equal(a.text(), 'a windmill over');
  a.ingest(0, ev(0, [['there', true]]).results);     // indices start again at 0
  assert.equal(a.text(), 'a windmill over there');
  assert.equal(a.finalText(), 'a windmill over there');
  a.reset(); assert.equal(a.text(), '');
});

test('settleTranscript: finals now, wait on a pending interim, waitedOut uses the interim', () => {
  const a = createAssembler();
  a.ingest(0, ev(0, [['a house', true]]).results);
  assert.equal(settleTranscript(a), 'a house');
  a.ingest(1, ev(1, [['a house', true], ['in the', false]]).results);
  assert.equal(settleTranscript(a), null, 'mid-sentence: keep waiting');
  assert.equal(settleTranscript(a, { waitedOut: true }), 'a house in the');
  const empty = createAssembler();
  assert.equal(settleTranscript(empty), '');
});

test('pointer timeline: lookup by time', () => {
  let t = 1000;
  const p = createPointerTimeline({ now: () => t, keepMs: 2000 });
  assert.equal(p.at(500), null); assert.equal(p.current(), null);
  p.push(10, 10); t = 1200; p.push(20, 20); t = 1400; p.push(30, 30);
  assert.deepEqual(p.at(1300), { x: 20, y: 20 });
  assert.deepEqual(p.at(100), { x: 10, y: 10 });
  assert.deepEqual(p.at(9999), { x: 30, y: 30 });
  assert.deepEqual(p.at(1200), { x: 20, y: 20 });
  t = 4000; p.push(40, 40);
  assert.equal(p.size, 1, 'old samples pruned');
  assert.deepEqual(p.current(), { x: 40, y: 40 });
});

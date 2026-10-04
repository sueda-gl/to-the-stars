import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSSEParser, parseEventData, readSSE } from '../../web/js/net/sse.js';

const collect = () => { const out = []; const p = createSSEParser(e => out.push(e)); return { out, p }; };

test('event:/data: framing, default event name, multi-line data', () => {
  const { out, p } = collect();
  p.push('event: status\ndata: {"stage":"drafting"}\n\n');
  p.push('data: line one\ndata: line two\n\n');
  p.push(': a comment\nid: 7\nretry: 250\ndata:x\n\n');
  p.end();
  assert.deepEqual(out.map(e => [e.event, e.data]), [['status', '{"stage":"drafting"}'], ['message', 'line one\nline two'], ['message', 'x']]);
  assert.equal(out[2].id, '7'); assert.equal(out[2].retry, 250);
});

test('chunks split anywhere, CRLF and CR endings, BOM, trailing CR across chunks', () => {
  const { out, p } = collect();
  const text = '﻿event: don';
  p.push(text); p.push('e\r\ndata: {"as'); p.push('set":{"id":"lh"}}\r'); p.push('\n\r\nevent: error\rdata: boom\r\r');
  p.end();
  assert.deepEqual(out.map(e => [e.event, e.data]), [['done', '{"asset":{"id":"lh"}}'], ['error', 'boom']]);
});

test('end() flushes a final event without a trailing blank line; empty events are dropped', () => {
  const { out, p } = collect();
  p.push('event: ping\n\n');          // event without data: dropped per spec
  p.push('data: tail');
  p.end();
  assert.deepEqual(out.map(e => [e.event, e.data]), [['message', 'tail']]);
});

test('parseEventData parses JSON, keeps strings', () => {
  assert.deepEqual(parseEventData('{"a":1}'), { a: 1 });
  assert.equal(parseEventData('plain'), 'plain');
  assert.equal(parseEventData('  '), null);
  assert.equal(parseEventData('{not json'), '{not json');
});

const streamOf = (chunks, delay = 0) => new ReadableStream({
  async start(c) { for (const ch of chunks) { if (delay) await new Promise(r => setTimeout(r, delay)); c.enqueue(new TextEncoder().encode(ch)); } c.close(); },
});

test('readSSE reads a fetch-like body and decodes JSON', async () => {
  const events = [];
  const n = await readSSE({ body: streamOf(['event: status\ndata: {"stage":"writing"}\n\nevent: do', 'ne\ndata: {"asset":{"id":"x"}}\n\n']) }, { onEvent: e => events.push(e) });
  assert.equal(n, 2);
  assert.deepEqual(events.map(e => [e.event, e.json]), [['status', { stage: 'writing' }], ['done', { asset: { id: 'x' } }]]);
});

test('readSSE aborts via AbortSignal and times out when idle', async () => {
  const ac = new AbortController();
  const never = new ReadableStream({ start() {} });
  const p = readSSE({ body: never }, { onEvent() {}, signal: ac.signal });
  setTimeout(() => ac.abort(), 20);
  await assert.rejects(p);
  await assert.rejects(readSSE({ body: new ReadableStream({ start() {} }) }, { onEvent() {}, idleMs: 30 }), e => e.code === 'timeout');
});

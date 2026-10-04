// Server-Sent Events parsing for a POST response body (EventSource can't POST).
// Pure parser + a reader over fetch's ReadableStream. Spec framing: lines of `field: value`,
// a blank line dispatches; `data:` lines join with "\n"; `:` lines are comments; CR, LF or CRLF.

export function createSSEParser(onEvent) {
  let buf = '', event = '', data = [], id = null, retry = null, first = true;
  function dispatch() {
    if (data.length === 0) { event = ''; return; }   // spec: no data, no event
    onEvent({ event: event || 'message', data: data.join('\n'), id, retry });
    event = ''; data = [];
  }
  function line(l) {
    if (l === '') return dispatch();
    if (l[0] === ':') return;
    const c = l.indexOf(':');
    const field = c < 0 ? l : l.slice(0, c);
    let value = c < 0 ? '' : l.slice(c + 1);
    if (value[0] === ' ') value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    else if (field === 'id') { if (!value.includes('\0')) id = value; }
    else if (field === 'retry') { const n = Number(value); if (Number.isInteger(n)) retry = n; }
  }
  return {
    push(chunk) {
      if (first) { first = false; if (chunk.charCodeAt(0) === 0xFEFF) chunk = chunk.slice(1); }
      buf += chunk;
      let pos = 0;
      for (;;) {
        const n = buf.indexOf('\n', pos), r = buf.indexOf('\r', pos);
        let i, len = 1;
        if (r >= 0 && (n < 0 || r < n)) {
          if (r === buf.length - 1) break;          // a trailing CR may be half of a CRLF: wait for more
          i = r; if (buf[r + 1] === '\n') len = 2;
        } else if (n >= 0) i = n;
        else break;
        line(buf.slice(pos, i)); pos = i + len;
      }
      buf = buf.slice(pos);
    },
    end() { if (buf) { line(buf.replace(/\r$/, '')); buf = ''; } dispatch(); },
  };
}

// Parses JSON data when it looks like JSON; otherwise returns the raw string.
export function parseEventData(data) {
  const t = data.trim();
  if (!t) return null;
  if (t[0] === '{' || t[0] === '[') { try { return JSON.parse(t); } catch { /* fall through */ } }
  return data;
}

// Reads a fetch Response as SSE. Resolves when the stream ends; rejects on abort/read errors.
// onEvent({ event, data, json }) per event. `idleMs` rejects if nothing arrives for that long.
export async function readSSE(response, { onEvent, signal = null, idleMs = 0 } = {}) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  const parser = createSSEParser((ev) => onEvent({ ...ev, json: parseEventData(ev.data) }));
  let idle = null, count = 0, failure = null;
  // reader.cancel() makes the pending read() resolve { done: true }, so the cause is kept aside and thrown after.
  const fail = (err) => { if (!failure) failure = err; reader.cancel().catch(() => {}); };
  const armIdle = () => { if (!idleMs) return; clearTimeout(idle); idle = setTimeout(() => fail(Object.assign(new Error('stream idle'), { code: 'timeout' })), idleMs); };
  const onAbort = () => fail(Object.assign(new Error('stream aborted'), { code: 'aborted', name: 'AbortError' }));
  if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, { once: true });
  try {
    armIdle();
    for (;;) {
      const { value, done } = await reader.read();
      if (done || failure) break;
      count++;
      armIdle();
      parser.push(dec.decode(value, { stream: true }));
    }
    if (failure) throw failure;
    parser.push(dec.decode());
    parser.end();
  } finally {
    clearTimeout(idle);
    signal?.removeEventListener('abort', onAbort);
  }
  return count;
}

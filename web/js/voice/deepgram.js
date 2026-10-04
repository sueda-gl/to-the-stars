// Deepgram streaming recogniser, behind the same interface voice.js expects.
// Only used when /api/health says stt:'deepgram'. The browser never holds the Deepgram key:
// it opens a WebSocket to OUR server relay (default ws(s)://<host>/api/stt?lang=xx-XX) and streams
// MediaRecorder chunks (audio/webm;codecs=opus); the relay forwards them to Deepgram and sends the
// Deepgram "Results" messages back verbatim. The relay is not implemented yet (server/ owner); this
// client is ready for it and fails soft (onerror 'network') until it exists.
//
//   const voice = createVoice({ recognizerFactory: deepgramFactory({ url }) })
import { tidy } from './transcript.js';

export const RELAY_PATH = '/api/stt';

export function relayUrl({ base = (typeof location !== 'undefined' ? location.origin : 'http://localhost:8870'), lang = 'en-US', path = RELAY_PATH } = {}) {
  const u = new URL(path, base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.searchParams.set('language', lang);
  u.searchParams.set('interim_results', 'true');
  u.searchParams.set('smart_format', 'true');
  return u.toString();
}

// Converts Deepgram Results messages into Web-Speech-shaped result events. Pure; tested.
//   is_final=false -> rewrite the open interim slot; is_final=true -> settle it and open a new one.
export function createDeepgramAdapter(emit) {
  const results = [];
  return {
    results,
    message(msg) {
      if (!msg || msg.type !== 'Results') return false;
      const text = tidy(msg.channel?.alternatives?.[0]?.transcript || '');
      if (!text && !msg.is_final) return false;
      let i = results.length;
      if (i > 0 && !results[i - 1].isFinal) i -= 1;
      if (!text && msg.is_final) { if (results[i] && !results[i].isFinal) results.splice(i, 1); return false; }
      results[i] = { isFinal: Boolean(msg.is_final), 0: { transcript: text }, length: 1 };
      emit({ resultIndex: i, results: results.slice() });
      return true;
    },
    reset() { results.length = 0; },
  };
}

export function deepgramFactory({ url = null, base, win = typeof window !== 'undefined' ? window : null, chunkMs = 250 } = {}) {
  return () => {
    let ws = null, mr = null, stream = null;
    const rec = {
      lang: 'en-US', continuous: true, interimResults: true, maxAlternatives: 1,
      onstart: null, onresult: null, onend: null, onerror: null,
      async start() {
        const adapter = createDeepgramAdapter((ev) => rec.onresult?.(ev));
        try {
          stream = await win.navigator.mediaDevices.getUserMedia({ audio: true });
          ws = new win.WebSocket(url || relayUrl({ base, lang: rec.lang }));
          ws.onmessage = (e) => { try { adapter.message(JSON.parse(e.data)); } catch { /* ignore non-JSON */ } };
          ws.onerror = () => rec.onerror?.({ error: 'network', message: 'Speech relay unreachable.' });
          ws.onclose = () => { rec.stop(); rec.onend?.({}); };
          await new Promise((res, rej) => { ws.onopen = res; ws.addEventListener('error', rej, { once: true }); });
          mr = new win.MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
          mr.ondataavailable = (e) => { if (e.data.size && ws?.readyState === 1) ws.send(e.data); };
          mr.start(chunkMs);
          rec.onstart?.({});
        } catch (e) {
          rec.onerror?.({ error: e?.name === 'NotAllowedError' ? 'not-allowed' : 'network', message: e?.message || String(e) });
          rec.stop();
        }
      },
      stop() {
        try { mr?.state !== 'inactive' && mr?.stop(); } catch { /* ignore */ }
        stream?.getTracks?.().forEach(t => t.stop()); stream = null; mr = null;
        if (ws && ws.readyState <= 1) { try { ws.send(JSON.stringify({ type: 'CloseStream' })); ws.close(); } catch { /* ignore */ } }
        ws = null;
      },
      abort() { rec.stop(); },
    };
    return rec;
  };
}

// Picks the engine from /api/health: Deepgram only when the server relays it.
export function pickEngine(health, { webSpeechAvailable = true } = {}) {
  if (health?.stt === 'deepgram') return 'deepgram';
  return webSpeechAvailable ? 'webspeech' : 'none';
}

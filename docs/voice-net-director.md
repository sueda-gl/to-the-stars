# Voice, net client, director, recorder

Owner: Fable 5.1 (logic). Files: `web/js/voice/`, `web/js/net/`, `web/js/director.js`, `web/voice-lab.html`, `tests/voice/`, `tests/record/`.
Everything is plain ES modules that run in Chrome and under `node --test` (no DOM at import time).

## Test
```
export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH
node --test 'tests/voice/*.test.mjs'          # 50 tests: transcript, pointer, SSE, api, voice (fake recogniser), director, recorder schedule + ffmpeg args
```
Lab page (needs any static server on `web/`, the real server serves it at http://localhost:8870/voice-lab.html):
- `?fake=1` injected recogniser (works headless; the "Fake utterance" button types interims then a final)
- `?autoplay=1` plays the director with fake hooks; `&speed=0.4` shrinks every wait; `&panel=0` hides the log panel
- `?lang=tr-TR` Turkish

## Voice: `web/js/voice/voice.js`
```js
import { createVoice, webSpeechFactory, voiceSupport, langFromQuery, UNSUPPORTED_MESSAGE, INSECURE_MESSAGE } from './js/voice/voice.js';
const voice = createVoice({
  lang: langFromQuery(),                  // ?lang=tr-TR, default en-US
  onStart({ startedAt, lang }) {},        // key went down, recogniser running
  onPartial(text, { interim, deictic }) {},   // live caption; deictic = 'there' once heard
  onFinal(text, meta) {},                 // on release; see meta below
  onError({ code, message, fatal, delivered? }) {}, // 'unsupported' | 'not-allowed' | 'empty' | 'network' | 'audio-capture' | 'restart-loop' | ...
  onLevel(v) {},                          // 0..1 mic RMS per frame (getUserMedia AnalyserNode; silent on failure)
  onState(s) {},                          // 'listening' | 'settling' | 'idle'
  // injection points:
  recognizerFactory,                      // default webSpeechFactory(); null => unsupported; fake.js / deepgram.js plug in here
  engine, win, doc, now, setTimeout, clearTimeout, tailWaitMs = 600, deicticLagMs = 350, level = true,
});
voice.start(); voice.stop(); voice.toggle();   // mic pill: pointerdown on the pill -> start; pointerup -> stop ONLY if that press began on the pill (see below)
voice.holdKey('Space');                        // default; ignored while an input/textarea/contentEditable is focused, or with ⌘/ctrl/alt
voice.supported; voice.engine;                 // 'webspeech' | 'deepgram' | 'fake' | 'none'
voice.unsupportedMessage;                      // UNSUPPORTED_MESSAGE, or INSECURE_MESSAGE on http://<LAN-IP> (Web Speech needs localhost/https)
voice.setLang('tr-TR'); voice.lang; voice.listening; voice.state;
voice.injectPointer(x, y);                     // scripted cursor (director) — feeds the same timeline the mouse does
voice.pointerNow(); voice.pointerAt(t);
voice.feed(ev); voice.text();                  // tests: feed a Web-Speech-shaped result event
voice.destroy();
```
`meta` = `{ startedAt, endedAt, lang, engine, waitedOut, pointerAtStart:{x,y}|null, pointerAtEnd:{x,y}|null, pointerAtThere:{x,y}|null, deictic:'there'|null }`.
Client coordinates; the game converts with `world.pick(x, y)`. `pointerAtThere` is the cursor **350 ms before** the interim first contained a deictic word (recognition latency), looked up in a 6 s cursor timeline (`pointer.js`).

Release rules (`transcript.js`, pure, tested): all finals merged in order; if released mid-sentence (an interim pending) wait ≤ 600 ms for the last `isFinal` (or the recogniser's `onend`), else use the latest interim. Chrome ends continuous recognition on silence: while the key is held it is restarted and the text rolled over. `no-speech`/`aborted` are swallowed; `not-allowed` is fatal (message tells them to type). Empty release → `onError({code:'empty'})`, never `onFinal('')`.

Failure rules (2026-10-03, after review):
- **Space pressed again inside the 600 ms settle window**: the first utterance is delivered at once (`waitedOut:true`, latest interim) and the second hold starts. Nothing is dropped.
- **`network` / `audio-capture` while held** (venue Wi-Fi, mic unplugged): the hold ends immediately, no restart. If something was already heard it is delivered via `onFinal` and the error carries `delivered:true` (show a quiet toast, not a failure); otherwise one `onError` with a message that says to type. Exactly one error, never a loop (`HOLD_ENDING_ERRORS`).
- **Restart loop guard**: a recogniser that dies again within 1.5 s of being restarted more than `MAX_RAPID_RESTARTS` (2) times ends the hold with `code:'restart-loop'`. Real silence-stops (seconds apart) still restart forever.
- **Insecure origin**: Chrome refuses Web Speech on `http://192.168.x.x`. `webSpeechFactory()` returns null there, `voiceSupport(win)` says `{ ok:false, reason:'insecure' }`, and `voice.unsupportedMessage` is `INSECURE_MESSAGE`. Demo on `http://localhost:8870` (or https), never the LAN IP.
- **Mic pill in the game UI**: track `micHeld` from the pill's `pointerdown` and only call `voice.stop()` on `pointerup`/`pointercancel` when `micHeld` was set, as `voice-lab.html` does. A window-wide `pointerup → stop()` would end a Space hold on any click.

Deictic words: en `there, here, over there, right there, this spot, that spot, right here, over here`; tr `burada, şurada, orada, buraya, şuraya, oraya, burası, şurası, orası, tam burada, tam şurada` (whole-word, Unicode-aware; `buradaki`/`therefore` don't match).

Unsupported browser → `voice.supported === false`, `start()` calls `onError({code:'unsupported', message: UNSUPPORTED_MESSAGE})`; show the typed field.

### Deepgram (`web/js/voice/deepgram.js`) — client ready, relay not built
`pickEngine(health)` → `'deepgram'` only when `/api/health` says `stt:'deepgram'`. Then `createVoice({ recognizerFactory: deepgramFactory({ base }), engine:'deepgram' })`.
The factory returns the same recogniser interface: it opens `ws(s)://<host>/api/stt?language=xx-XX&interim_results=true&smart_format=true`, streams `MediaRecorder` chunks (`audio/webm;codecs=opus`, 250 ms), expects Deepgram `Results` JSON back verbatim, and sends `{"type":"CloseStream"}` on stop. `createDeepgramAdapter` (tested) maps `is_final` into Web-Speech-shaped result events. Server side (not mine): a `ws` relay at `/api/stt` holding the key.

### Fake (`web/js/voice/fake.js`)
`createFakeRecognizer({ script, endOnStop })` → `rec.say(text, isFinal)`, `rec.error(code)`, `rec.end()`. Used by the tests and `voice-lab.html?fake=1`.

## Net: `web/js/net/api.js`
```js
import api, { createApi, ApiError, TIMEOUTS } from './js/net/api.js';   // default instance on same origin
await api.health();                                           // { ok, mock, models:{logic, visual}, stt }
await api.command({ transcript, pointer:{x,z,near?}|null, selected?:agentId, snapshot });  // { actions:[Action], say?:{from, text} }
await api.society({ snapshot, recent, wants: ['report'] });   // { letters:[LetterDraft], events:[...] }; wants:['report'] = the minister's report (meeting beat)
await api.letter({ purpose, agent, context, snapshot });      // { subject, body, options? }
await api.sketch({ request, snapshot });                      // { name, footprint, height, parts } | null (server has no /api/sketch yet: 404 once, then api.sketchAvailable === false and no more calls)
await api.assets();                                           // [asset] (accepts a bare array or { assets })
const h = api.codegen({ request, kindHint, snapshot }, { onStatus({stage}), onDone(asset), onError(err), signal? });
h.abort(); await h.done;                                      // asset = { id, name, aliases, meta, code }
// The creation moment, in one call: codegen starts at once, the massing sketch is asked for in parallel.
const c = api.create({ request, kindHint, snapshot }, { onSketch(sketch), onStatus, onDone(asset), onError(err), signal? });
c.abort(); await c.done; await c.sketch;                      // onSketch fires only if the sketch lands before codegen; 404 / errors / late sketch are silent
```
- POST SSE: `fetch` + `ReadableStream` reader, `event:`/`data:` framing, multi-line data, CR/LF/CRLF, chunk splits anywhere (`sse.js`, tested). Also accepts data-only frames carrying `type`, and a plain JSON `{ asset }` answer (cache hit).
- Timeouts (`TIMEOUTS`): health 4 s, command 32 s, letter 38 s, sketch 32 s, society 70 s, assets 10 s, codegen 300 s total (a real bound on the whole stream) + 120 s idle. Command/letter/society sit **above** the server's live timeouts (25/30/60 s) so a slow live mind reaches the server's mock fallback instead of a client error.
- One retry on **network** error only (never on timeout/HTTP/abort). Errors are `ApiError { code: 'timeout'|'network'|'http'|'server'|'bad_json'|'aborted'|'stream', status?, body? }`.
- `createApi({ base, fetch, timeouts, retries, retryDelayMs, log })` for tests / another origin.

## Director: `web/js/director.js`
```js
import { createDirector, DEFAULT_BEATS, TIMING, wordByWord, isDirectorMode } from './js/director.js';
const director = createDirector({ beats: DEFAULT_BEATS, hooks, timing: { speed: 1 } });
director.play(); director.skip(); director.stop(); director.state;   // sets window.__directorDone, window.__director
```
Beat: `{ id, caption?, title?:{text,sub,ms}, say?: string | (hooks)=>string, pointer?: 'windmill'|'cliff'|'lake'|{x,y}, camera?:{to, ms}, wait?: ms | 'idle' | {event, timeout}, do?: async (hooks, ctx), fallback?: (hooks, result, err) }`.
`fallback` runs when `hooks.command` returned a noop-only result (`isNoop`: no actions, or only `type:'noop'`, or nothing) or threw, so the video never shows "Forgive me, sovereign". The game gets the beat as `command(text, beat)` and should suppress its refusal toast when `beat.fallback` exists.
Any `ms` may be a `TIMING` key. All timing lives in `TIMING` (wordsPerSecond 3.2, descent 7000, title 3200, spawn 2600, settle 1400, letterRead 4200, letterWait 12000, idleMax 45000, neighbourFlight 9000, meeting 7000, outro 4000, speed 1).

Hooks the game should implement (all optional; missing ones are skipped):
| hook | called with | expected |
|---|---|---|
| `say(text, { wps, speed, signal, wordByWord })` | the utterance | show it in the voice caption word-by-word (use the passed `wordByWord`), resolve when typed |
| `command(text, beat)` | after `say` | the normal command path (`api.command` → `game.apply`); **return the server result** (`{ actions }`) so the director can detect a noop and run `beat.fallback` |
| `caption(text\|null, { spoken })` | stage captions and (default `say`) spoken text | |
| `title({ text, sub, ms })` | title card | |
| `pointer(spotName \| {x,y})` | before an utterance that says "there" | move a visible cursor, call `voice.injectPointer`, resolve when there |
| `camera({ to:'descent'\|'neighbours'\|'meeting', ms })` | | |
| `idle()` | `wait:'idle'` | resolves when the world is quiet (no sites building, no codegen pending); capped by `idleMax` |
| `waitEvent(name, timeoutMs)` | `wait:{event:'letter:new'}` | resolves on the game event |
| `pickAgentName(skill)` | `'baking'` | a folk name for "make X our minister" |
| `openLetter()`, `spawn()`, `envoy()` | | open the newest letter / spawn folk / send a neighbour envoy with a letter |
| `gift({ what })`, `visitNeighbour()`, `meeting()` | beat fallbacks | local stand-ins for `send_gift` / `visit_neighbour` / `call_meeting` while the server lacks them: courier walks a basket to the horizon / camera flies to the neighbours and back / folk gather |
| `onBeat(beat, i)`, `onPlay()`, `onDone()`, `onError(err, beat)` | | |

`DEFAULT_BEATS` (ids): descent → title → spawn → house → windmill (pointer) → baking (waits for `letter:new`) → baking-letter → minister → lighthouse (pointer 'cliff', the unknown-thing moment) → duck (pointer 'lake') → envoy → envoy-letter → bread → neighbours (camera) → meeting (camera) → outro. Nine utterances in total, every one verb-ful:
"Let's build a house in the middle." · "and a windmill there" · "who here is good at baking?" · "make <name> our minister" · "build a lighthouse on the cliff" · "put a giant rubber duck there, in the lake" · "send the neighbours a basket of bread" · "show me the neighbours" · "call a meeting".
Mock parser today (verified with curl against `AGORA_MOCK=1`): 7 of 9 map (house, windmill, baking, minister, lighthouse → `build` kind null near edge, duck → `build` kind null at pointer, meeting); **bread and neighbours are noop** until server/ adds `send_gift` and `visit_neighbour` (ARCHITECTURE §8; `schemas.js` ACTION_TYPES lacks them). Those two beats carry `fallback`s (`hooks.gift`, `hooks.visitNeighbour`), the neighbours beat also moves the camera itself.
`game.js` should do: `if (isDirectorMode()) createDirector({ hooks }).play()` after the world is ready.

## Recorder: `tests/record/record.mjs`
```
node tests/record/record.mjs --url 'http://localhost:8870/?director=1' [--out shots/video/x.mp4] [--max 240] [--fps 30] [--headed] [--quality 90] [--crf 18] [--size 1920x1080] [--keep-frames]
```
puppeteer-core → `/Applications/Google Chrome.app` (`--use-angle=metal`, 1920×1080, DPR 1, fake mic UI) → `Page.startScreencast` (jpeg q90, every frame, acked) → frames to a temp dir with CDP timestamps (every write promise is awaited before encoding) → stops on `window.__directorDone === true` or `--max` s → replayed at a constant fps (`cfrSchedule`: duplicate/drop by timestamp) through `image2pipe` → `scale=in_range=pc:out_range=tv` + `setparams` (full-range MJPEG squeezed to **limited range, tagged tv/BT.709**, so editors and players don't wash out the paper) → libx264 crf 18 yuv420p faststart → `shots/video/agora-demo-<stamp>.mp4`, then ffprobe (`ffmpegArgs()` is exported and tested). Prints a JSON result on stdout.
Default is headless (`new`); pass `--headed` if headless GPU output looks wrong. Proven run (lab page, speed 0.3, 2026-10-03): 1457 captured frames in 26.8 s → 804 output frames, 26.8 s, 2.3 MB, 1920×1080@30, `color_range=tv color_space=bt709`.
There is **no audio track** (the screencast is video only): narration/music is added in the edit.

## Gaps / notes for the lead
- Deepgram relay server side is not built (not my folder); the client is ready and gated on `/api/health.stt`.
- `pointerAtThere` is client xy; the world owner's `pick()` turns it into world xz. The game should pass `pointer` to `/api/command` as `{x, z}` from `pointerAtThere || pointerAtEnd`.
- The director's `say` hook in the game should run the text through the same caption element as live speech, and `command` through the same path as a voice final, so the video is honest.
- Screencast captures the tab, not the OS cursor: the game needs a drawn cursor (the lab's `.cursor` dot) for the pointing beats.

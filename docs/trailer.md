# Trailer pipeline (`tests/record/trailer.mjs`, `web/trailer/`, `shots/trailer/`)

The ALOUD launch trailer (beat sheet: `TRAILER.md`) is captured frame-perfectly from deterministic scene pages and cut
by ffmpeg from a JSON cut list. Nothing is recorded in real time except the gameplay section.

```
node tests/record/trailer.mjs capture  [--scene <id>] [--force]        scenes + title cards -> shots/trailer/seq/<id>/%05d.png (+ clips/<id>.mp4 previews)
node tests/record/trailer.mjs gameplay [--max 300] [--url ...]         ?director=1 screencast -> shots/trailer/gameplay/raw.mp4 + beats.json (beat id -> t)
node tests/record/trailer.mjs edit     [--out ...] [--cut <json>]      shots/trailer/cut.json -> shots/trailer/aloud-trailer-v1.mp4 (+ timeline.json)
node tests/record/trailer.mjs sheet    [--in <mp4>] [--every 2]        contact sheet, 1 frame / 2 s, timestamped -> aloud-trailer-v1-contact.png
node tests/record/trailer.mjs all                                       capture (skips what is up to date) + gameplay (if missing) + edit + sheet
```
Node 22 (`~/.nvm/versions/node/v22.22.3/bin`), `puppeteer-core` + Chrome (`--use-angle=metal`), ffmpeg 8 (`/opt/homebrew/bin`).
Pages are served from **:8870 when it is up (never restarted)**, otherwise from the script's own python static server on a free port.
Preview page: **`/trailer/`** (`web/trailer/index.html`): lists the scenes, scrubs any of them frame-exactly through `__shot.seek`
in a 1920×1080 iframe (Space play, `,` `.` frame step, chips jump to marks/shots), and plays the final cut with its beat
timeline. `web/trailer/out` is a symlink to `shots/trailer/` (gitignored) so the player can reach the renders.

## The scene contract (`web/trailer/<id>.html`)
Full-bleed 1920×1080 canvas, no chrome, a fixed clock:
```
window.__shot = { duration, seek(t), play(), done, ready?, stop?()/pause?(), marks?, shots? }
?t=4.5   one still       ?hold=1 / ?paused=1   do not auto-play (the capture appends both)
```
- `seek(t)` renders exactly the frame at `t` (may return a promise); the capture calls it for `t = k / 30`, waits two rAFs,
  then `Page.captureScreenshot` (PNG). It never relies on wall time.
- `ready` (promise) is awaited before the first seek; `stop()` / `pause()` are called if present. A scene that keeps its own
  rAF loop running while being seeked produces scrambled frames: honour `?hold` (the `mountShot` helper in
  `web/js/trailer/shot.js` does) or `?paused`.
- `marks` (`{ name: t | [t0, t1] }`, mountShot scenes) and `shots` (`[{ id|name, t0, dur|t1 }]`, t3/t5) are stored in
  `shots/trailer/seq/manifest.json` at capture time and can be named in the cut list (`"in": "ignite-0.3"`, `"in": "golden"`).
- `web/trailer/card.html` is the **title renderer**, itself a `__shot` scene: `?text=ALOUD&sub=...&face=melodrama|sentient&size=&bg=night|clear|paper&dur=&fin=&fout=&lb=1&italic=1`.
  Melodrama semibold 600 (uppercase, tracked .34em → .29em over the card's life) for ALOUD, Sentient for lines; white (`#f3eee3`) on
  night blue (`#060814`), `bg=clear` gives a transparent RGBA still for overlays, `lb=1` draws 2.39:1 bars.

A scene that is not built yet is captured as a paper placeholder card (its name + "scene not built yet") so the whole edit
renders end to end; the manifest remembers it and the real scene replaces it on the next `capture` (mtime-checked; `--force` redoes everything).
Capture cost: ~0.6 s/frame on the painted scenes (the gouache post at 1080p), i.e. ~7 min for a 22 s scene; a PNG sequence is
~2 MB/frame (the four scenes ≈ 5 GB), so keep an eye on disk space.

## The cut list (`shots/trailer/cut.json`)
Global: `fps width height crf letterbox out`, `music { file gain fadeOut duckThreshold duckRatio duckRelease }`,
`voice { file at gain }`, `sfx.tapeStop { file at gain }`. `file` patterns take a `*` (`shots/trailer/music.*`); a missing
file is a silent placeholder and the log says so. Segment types (`out` = the transition INTO the next one: `cut | dissolve |
fadeblack | fadewhite | push`, `xd` its length):

| type | fields | what |
|---|---|---|
| `live` | `file` (opener.mp4), `still` (start frame), `dur`, `audio`, `push { dur x y zoom settle }` | the live-action opener. `opener.mp4` when it exists; else the Cinema-Studio start frame with a slow drift; else black. **Push into the screen**: over the last `push.dur` s an eased zoom (`zoom`×) into the monitor at (`x`,`y`), a light bloom (blurred copy screened in, chroma easing to white) and a paper flicker (per-frame brightness jitter). The next segment arrives 22 % tight and bright and settles over `settle` s; the join is a short dissolve (`xd`). |
| `scene` | `scene`, `in` (s or mark/shot name ± offset), `dur` | a slice of a captured sequence (frame-exact; held on its last frame if `dur` runs past it) |
| `card` | `text` (`|` = line break), `sub`, `face`, `italic`, `size`, `dur`, `fin`, `fout`, `bg` | a title card captured through card.html (so the fades are frame-exact) |
| `rewind` | `dur`, `vmax`, `sources [{ scene, reverse?, dur? }]` | the **REWIND**: the sources' frames newest-first, each played backwards (`reverse: false` for t6-unbuild, which is authored as an un-build), on one clock whose speed ramps 1× → `vmax` (power ramp solved so the sources are consumed exactly over `dur`), plus a subtle paper flutter (jittered crop, brightness flicker, paper-grain multiply, all growing with the speed). The tape-stop sfx slot sits at its start. |
| `gameplay` | `file` (raw.mp4), `cuts [{ beat, from, dur } | { at, dur }]`, `cutXd`, `overlay { text face italic size at dur fade }` | cuts from the director capture by **beat id** (`beats.json`; `from ≥ 0` after the beat starts, `from < 0` before it ends), joined with `cutXd` dissolves; an over-footage card (RGBA still, alpha fades) at `at` |

`edit` cuts straight from the PNG sequences and builds every segment to `shots/trailer/build/<id>.mov` (near-lossless H.264
4:4:4 crf 8, exact frame counts; `INTER=prores` for ProRes 422 HQ, which is ~20× larger and filled the disk once), then one filtergraph
(saved as `build/assemble.filtergraph.txt`): cut-joined runs are `concat`ed, runs are joined with `xfade`
(offsets from frame counts), optional 2.39:1 `drawbox` bars, then audio: music bed (looped/trimmed, fade-out) ducked by the
voice through `sidechaincompress`, the opener's own audio, the voice file at `voice.at`, the tape-stop at the rewind, `amix` + limiter.
Export: H.264 high, `yuv420p`, 1920×1080, 30 fps, BT.709 tags, AAC 192k, `-movflags +faststart`. `timeline.json` lists every
segment's start/end in the final (the player's chips and the report come from it).

## Audio slots (drop files, re-run `edit`)
- `shots/trailer/music.mp3|wav|m4a` — the cinematic bed (silent placeholder until then)
- `shots/trailer/voice.mp3|wav` — the clean line "Light the engines" (ElevenLabs), placed at `voice.at` (1.2 s); the opener's own track is mixed too when `live.audio` is true
- `shots/trailer/sfx/tape-stop.wav` — the rewind cue
- `shots/trailer/live/opener.mp4` — the Seedance clip (Higgsfield); until it exists the start frame `live/start-a.png` stands in

## Files
| | |
|---|---|
| `tests/record/trailer.mjs` | the pipeline (capture / gameplay / edit / sheet / all); exports `rewindPlan`, `resolveRange`, `scenesOf`, `findFile` |
| `web/trailer/index.html` | player / preview |
| `web/trailer/card.html` | title renderer (a `__shot` scene) |
| `shots/trailer/cut.json` | the cut list (v1 follows TRAILER.md) |
| `shots/trailer/seq/<id>/` + `manifest.json` | PNG sequences, per-scene frames/marks/shots |
| `shots/trailer/clips/<id>.mp4` | H.264 previews per scene (the edit reads the PNGs) |
| `shots/trailer/gameplay/raw.mp4`, `beats.json` | the director run and its beat log |
| `shots/trailer/build/` | per-segment builds, the filtergraph |
| `shots/trailer/aloud-trailer-v1.mp4`, `-contact.png`, `timeline.json` | the final, its contact sheet, its timing |

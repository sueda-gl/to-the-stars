# The Gouache lab (`web/js/lab/look-lab.js`)

Tune the look live and save it as the default. One paper sheet, in the reference's own idiom (Instrument Serif,
the paper tokens, the reference's "Gouache settings" panel seated inside it verbatim).

```
http://localhost:8870/            press G (toggles the sheet; ignored while typing)
http://localhost:8870/?lab=1      the sheet opens at boot (with the paint chrome)
http://localhost:8870/look.html   standalone: the real map + our fliers, the real globe on demand
                                  ?view=globe · ?closed=1 · ?shot=1 · ?seed=
```
Director mode (`?director=1`) never installs the G key, so the sheet can't appear in the video (unless `?lab=1`).

## What it edits
| section | keys | goes to |
|---|---|---|
| Gouache settings | brush, wobble, saturation, warmth, paper tooth, pigment pooling, pencil lines, line weight, line strength | `painter.G` through the **verbatim** `paint/ui.js` `mountPaintUI` (seated in the sheet; under `?lab=1` the already-mounted `#tweaks` is adopted). The same G is copied to the globe's painter on every change, so one hand paints both. |
| Light | `sunAz`, `sunEl`, `keyIntensity`, `keyColor`, `hemiIntensity`, `hemiSky`, `hemiGround`, `shadowTint`, `shadowStrength` | the LOOK CONTRACT |
| Land | `creamColor`, `bloomPalette`, `reliefScale`, `contours`, `contourSpacing`, `contourOpacity`, `coastLine`, `haze` | " |
| Water | `waterShallow`, `waterDeep` | " |
| Camera | `camPitch`, `camDist`, `camFov` | " |
| View brush | `brush` (Kuwahara radius override for this view) | " |

The **Map / Globe** switch picks which target the contract sections edit (each has its own values); "show the globe" /
"back to the map" moves the game's stage (`stages.showGlobe` / `homeFromGlobe`).

### The LOOK CONTRACT (shared with the terrain designer)
`world.getLook()` / `world.setLook(partial)` and `globe.getLook()` / `globe.setLook(partial)`: plain JSON, applied
live. The lab **probes `getLook()` every time it opens** (and on the Map / Globe switch): a key it returns is live, a
key it doesn't is greyed out ("not wired"). Units the lab assumes:
- `sunAz`: compass bearing **toward the sun**, degrees: 0 = north (−z, the bay), 90 = east (+x), 180 = south, 270 = west.
  `sunEl`: degrees above the horizon. Today's map key is az ≈ 257, el ≈ 32.
- `camPitch`: the lab shows degrees down; a native value under 1.6 is taken as radians and converted both ways.
- colours: `'#rrggbb'` (numbers and THREE.Colors are read too). `bloomPalette`: an array of them.

**Lab-side fallback** (until `world.setLook` owns them): the map's `sunAz/sunEl` (re-aims `world.keyDir` in place
and the key light with it), `keyIntensity/keyColor` and `hemi*` (`world.backdrop.key` / `.hemi`), and `camPitch/
camDist/camFov` (`world.rig.setPose` + the home view `rig.view`). A key the world reports always goes to
`world.setLook` instead. The globe has no fallback: its keys grey out until `globe.setLook` exists.

## Presets
Reference (the Red arch's own light / paint, aimed from the west) · Dawn · Noon · Golden · Moodboard 1 (cream relief,
long warm shadows, pencil contours, teal sea) · Lush (mb 4/5: saturated greens, ultramarine water). Presets set
light / land / water (+ painter G) and never the camera; on the globe they skip camera keys too.

## Save as default
`Save as default` → `POST /api/look {look:{painter, world, globe}}` → `server/look.js` validates (plain numbers /
booleans / strings ≤ 64 / arrays ≤ 24, keys `[A-Za-z][A-Za-z0-9_]*`, ≤ 96 keys per section, painter values numeric or
boolean, ≤ 32 KB) and writes **`web/assets/look.json`** atomically. `GET /api/look` returns it (404 when none).
`AGORA_LOOK_FILE=/path` overrides the file (tests).

Only values that **differ from the factory look** are written (the factory look is captured at boot, before the saved
one is applied), so later improvements to the defaults still arrive for every key nobody tuned. Camera keys are
written only when set from the lab (a wheel zoom never becomes the default view).

`Copy JSON` copies the same diff. `Reset` returns to the factory look (not saved until you save).
A server started before this route existed answers 405: the sheet then copies and downloads `look.json` and says to
restart the server (`npm start`) or drop the file in `web/assets/`.

### Boot
`game.js` (and `look.html`) call `bootLook({ painter, world, stages, director })`: it fetches `/api/look` (falling back
to the static `assets/look.json`), applies `painter` + `world` at once, and the `globe` section when the lazy globe
is built (polled every 0.5 s + on stage changes; `look.syncGlobe()` forces it). `window.__agora.look` exposes it:
`{ factory, saved, world, globe (adapters: get/set/probe/supports), lab, open(), close(), toggle(), syncGlobe() }`.

## Verify
```
PORT=8893 AGORA_MOCK=1 AGORA_LOOK_FILE=/tmp/look-test.json node server/index.js &   # your own port, never :8870
node tests/lab/look-lab.mjs http://localhost:8893    # G opens, controls change, presets, save, reload, persisted -> shots/look-lab/
node tests/lab/look-page.mjs                         # look.html: map, show the globe, G shared with the globe painter
node tests/lab/look-8870.mjs                         # read-only: the sheet on the running game
```
Last run (2026-10-04): 11/11 checks, 0 page errors.

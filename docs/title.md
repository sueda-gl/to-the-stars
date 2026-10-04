# Title + guide text (ART_DIRECTION §21, Sueda 2026-10-04 08:30)

> "I don't like this beginning aesthetic, font and the name, it is underwhelming; if we see the planet on its own and a
> cooler darker font and a name it would be more cool" · the guide text "shouldn't be blue … should be something cooler".

## Files (all new except the hint block in agora.css)
| file | what |
|---|---|
| `web/title-lab.html` | the lab: her Tower Planet (`createPlanet`, Grain orbit, slow spin, saved look.json lens + colours) alone in dark space, the title under it. Name × face switcher, tone, contact sheet, Begin demo. |
| `web/js/ui/title.js` | the title module the game imports: `createTitle`, `frameTitlePlanet`, `TITLE_NAMES`, `TITLE_FONTS`, `TITLE_DEFAULT`, `loadTitleFont`. Pure DOM; links `css/title.css` itself. |
| `web/css/title.css` | the title styles + `@font-face` for the vendored faces. All classes are `.tt*` (no clash with `.ag-*`). |
| `web/assets/fonts/` | vendored (offline): `Sinistre-Regular/Dark`, `Aujournuit-Regular/Wide` (Collletttivo, OFL), `Cantique-Normal`, `Lineal-Thin/Light` (Velvetyne, OFL), `Melodrama-Light/Regular` (Fontshare, ITF FFL). Licences in `web/assets/fonts/licenses/`. |
| `web/css/agora.css` | only the `.ag-hint` block (+ its phone override): the guide / hint line restyle. |
| `tests/title/shoot.mjs`, `tests/title/sheet.py`, `tests/title/hint.mjs` | screenshots (own python server on a free port; never :8870). |

## The lab
`/title-lab.html` — `?name=<id>&font=<id>&tone=ivory|gold` · `?grid=1` (contact sheet) · `?shot` (no chrome) · `?nospin` · `?zoom=1.4`.
Keys: ← → faces, ↑ ↓ names, H hides the panel, Esc closes the sheet. Clicking a sheet cell opens that combination.
Begin demonstrates the hand-back: the planet eases to her own framing (what the descent starts from), then the title returns.

Layout: nothing is drawn over the planet. The orbit camera is pulled back (1.4 × her fit distance; 1.06 on portrait) and
the frame slid down 12.5 % (a camera view offset) so the planet + tower sit in the upper part; under it, a soft pool of
night (behind the type only, it quiets the stars) holds: the name (grain worn into the letters), a tracked small-caps
tagline between hairlines (Sentient), **Begin** as a hairline frame (no pill, no blue; hover = pale gold frame + a gold
dot), and "sound on, then hold Space and speak" in small italic.

### Names (8) — all checked: none is a famous game title
| id | name | tagline | why |
|---|---|---|---|
| hither | Hither | a small world that comes when called | "come hither": you call, the fliers come |
| aloud | Aloud | a civilisation, spoken aloud | the game in one quiet word |
| bidden | Bidden | a little world at your bidding | to bid = command by word; bidden = invited |
| parley | Parley | speak, and a small world answers | parler; talk, treaties, the neighbours |
| murmur | Murmur | a flock that listens | you murmur, a murmuration of fliers turns (a tiny itch.io "MurMur" exists) |
| folkmoot | Folkmoot | the gathering of the little folk | the Old English folk assembly: the agora, ours |
| orison | Orison | a small world, spoken into being | a spoken prayer; rhymes with horizon |
| tellus | Tellus | tell us what to build | Earth + "tell us" (several small itch.io games use it: least ownable) |

### Faces (5) — darker / cooler, free for commercial use, vendored
| id | face | foundry · licence | set as |
|---|---|---|---|
| sinistre | Sinistre | Collletttivo · OFL | lowercase, uncial cut: dark, mythic (ivory) |
| cantique | Cantique | Velvetyne · OFL | title case, hairline art-nouveau (pale gold) |
| melodrama | Melodrama Light | Fontshare · ITF FFL | caps, tracked .2em: cinematic (ivory) |
| lineal | Lineal Light | Velvetyne · OFL | caps, tracked .56em: cold, orbital (pale gold) |
| aujournuit | Aujournuit Wide | Collletttivo · OFL | wide engraved caps (ivory) |

Rejected after a specimen of ~40 OFL/FFL faces: Le Murmure (too heavy at this size), Bluu/Ouroboros/Flor de Ruina (too
loud), Mazius (warm/bookish), Lineal Thin (vanished at title size; Light kept).

### Screenshots (`shots/title/`)
- every combination full-frame: `<name>-<face>.png` (40)
- contact sheets: `contact-all.png` (names × faces), `contact-<face>.png` (one face, all names, larger), `sheet.png` (the lab's own sheet view)
- favourites full-frame: `hither-sinistre.png`, `orison-cantique.png`, `murmur-melodrama.png`, `aloud-cantique.png`; phone: `favourites-mobile.png`, `*-mobile.png`
- Begin hand-back: `begin-mid.png` (type lifting away, planet easing to her framing)

### Recommendation (top 3)
1. **Hither × Sinistre** — the darkest and most ownable: lowercase uncial reads like a myth, the name is the mechanic.
2. **Orison × Cantique** (or **Aloud × Cantique**) — the most elegant: pale-gold hairline title case, very "expensive".
3. **Murmur × Melodrama** — the most cinematic: tall light caps, the flock + voice double meaning.

`TITLE_DEFAULT` in title.js was changed to `{ name: 'aloud', font: 'cantique', alt: 'lineal' }` by someone else during
this run (kept as found). Sueda picks in the lab; set `TITLE_DEFAULT` to her pick.

### Keep §17 for letters?
Yes. The title face is used **only** for the title word. Basteleur (display) + Sentient (text) stay for letters, cards,
captions; the title's tagline / Begin / hint are already Sentient, so the title hands over to the game's type cleanly.

## Wiring it into the game (for the integration stage — not done here: game.js / game/* were being edited)
1. **ui.js `titleCard`** (web/js/ui/ui.js ~line 68): keep its API (`show / hide / start / visible`, used by game.js:421,
   ui.js idle `busy()` and the Enter key at ~1520) and delegate to the module. Parent it to `document.body`, not the UI
   layer (the `.ag-ui.is-title > :not(.ag-title)` rule would hide it); `.tt` is z-index 60, above the layer.
   ```js
   import { createTitle, TITLE_DEFAULT } from './title.js';
   const titleCard = (() => {
     let t = null;
     function show({ begin = 'Begin', name = TITLE_DEFAULT.name, font = TITLE_DEFAULT.font } = {}) {
       if (!t) t = createTitle({ parent: document.body, name, font, begin, enterKey: false,
         onBegin: () => { layer.classList.remove('is-title'); fire(onStart); } });
       else t.set({ name, font });
       layer.classList.add('is-title'); t.show();          // t.show() also adds body.ag-title-on (hides paint chrome)
     }
     function start() { if (t && t.visible) t.start(); }    // hides + onBegin
     function hide() { if (!t) return; layer.classList.remove('is-title'); t.hide(); }
     return { show, hide, start, get visible() { return !!t && t.visible; } };
   })();
   ```
   The old `.ag-title*` CSS can stay (unused) or be deleted.
2. **game.js** where the title is shown (~line 466, `ui.titleCard.show({ title: 'AGORA', … })`):
   ```js
   import { frameTitlePlanet } from './ui/title.js';
   let releaseTitle = frameTitlePlanet(planet);           // after stages.introGlobe() put her orbit up
   ui.titleCard.show({ name: Q.get('title') || undefined, font: Q.get('titlefont') || undefined });
   ```
   and in the UI's `onStart` (game.js ~line 152): `onStart: () => { if (releaseTitle) { releaseTitle(1400); releaseTitle = null; } begin(); }`.
   `release(ms)` eases the view offset + orbit distance back to her framing while the descent starts (the descent flies
   from wherever the camera is), and finally restores her `fitDist` so later orbits (`showGlobe`, the Plissé stand-in's
   `orbitPose`) are unchanged. The director / `?autostart=1` paths never show the title, so they need nothing.
3. Remove the old title's "AGORA" from the settlement default if the name changes (`S.name`, the boot text) — product call.

## Guide / hint text (done, CSS only)
`.ag-hint` in `web/css/agora.css`: small ivory Sentient (15 px; guide 16 px) on a soft dark-ink pill
(`rgba(12,16,34,.8)` + 6 px backdrop blur + a hairline ivory inset), the spoken phrase (`<i>` in the guide copy, and the
"try saying" button) in pale gold italic `#e2c98f` with a faint gold underline. No halo, no paper wash, no blue, no red.
It rises 6 px as it fades in. Phone: wraps inside the pill (radius 20 px). Same DOM as before (ui.js untouched).
Shots: `shots/title/hint-guide-{arch,map,folk}[-mobile].png`, `hint-says-*.png` (legible over bright Red-arch sand,
the relief map and the folk close-up). `tests/ui/fonts.mjs G` still passes (60/60).
Note: the bottom voice mark ("hold Space") is still ink-blue italic; restyle it to match if she wants (not in scope).

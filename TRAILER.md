# ALOUD: launch trailer (Sueda, 2026-10-04 09:10)
Goal: a polished, professionally edited game launch trailer (~90–110 s, 1920×1080, 30 fps), for the hackathon jury. **Within 10 s the jury sees: a human says "Light the engines", we push into her screen, the Red arch, the launch into space, and the shadelings in the midday sun.**

## Cut v4 (round 3 + sound, 2026-10-04 pm): `shots/trailer/to-the-stars-trailer.mp4`, 100.37 s (copy `aloud-trailer-final.mp4`; previous `to-the-stars-trailer-prev.mp4`)
hold (t1 rocket hold, 6.3 s) 0–2.5 · lift-off/climb 1.5x 2.5–11.3 (ignition 2.8) · porthole, glass · space 15.3–20.1 · landing, crew, offering 19.7–28.8 · question cards over t5 golden (dimmed) 28.8–34.8 (card 1 from ~29.7, card 2 from ~32.0) · rewind 34.45 (tape-stop 34.3) · t6 city rewind (from 9.6 s at 1.3x, to the folk, "It all begins with a word." ~51.6) 38.65–55.15 · gameplay 54.65–83.55 with voice lines · "To the stars." lift-off card 83.05–87.25 (voice 83.8) · "Plissé is just one planet… / What will you build?" over t3 space 87.25–93.85 · title screen (`gameplay/raw-titlescreen.mp4`, the live game at ?minds=mock, dpr 2) 93.35–100.37.
Sound: music.wav (-6 dB, dipped -4 dB under "To the stars."), chirps.wav bed (-4 dB) both ducked under the voice lines (`shots/trailer/vo/*.mp3`, on each gameplay cut 0.2 s early), fx.wav (-2 dB, not ducked), tape-stop. After a re-cut: `node tests/record/trailer.mjs edit && python3 shots/trailer/sfx/make_audio.py && node tests/record/trailer.mjs edit` (the second edit only re-assembles).

## Cut v3 "To the Stars" (2026-10-04 pm): `shots/trailer/to-the-stars-trailer.mp4` (copy: `aloud-trailer-final.mp4`; previous render: `aloud-trailer-final-prev.mp4`), 101.5 s
No live action. arch 0–3.2 (fade from black) · reception –6.2 · launch: t1 ignition through the full climb at 1.5× –15.0 · porthole · glass · t3 space in full at 1.5× –23.8 · landing, crew, offering, golden –35.5 · pop card "How does a civilisation reach the stars? / What else is out there?" –40.4 · rewind –44.3 · t6 from 3.4 s to its end at 1.8× (+1.6 s hold) with the pop card "It all begins with a word." –60.1 · gameplay from house on (house, windmill, field, red dot, lighthouse, duck, call, future peek, moon) –86.2 · crowd cheering at lift-off (t1 13–16.6) with "To the stars." –89.9 · "Plissé is just one planet. There are countless more out there. / What will you build?" –96.3 · TO THE STARS pop title –101.5.
Pop motion cards: `web/trailer/pop.html` (the game's pop print: Titan One, cream card, ink outline, pink offset shadow, halftone corners, stars; mode=card|title). Cut list: `cut.json` (`pop` cards, `overlay.pop` motion overlays, scene `speed` / `holdEnd`). Re-render: `node tests/record/trailer.mjs edit` (cached segments).

## Cut v2 (2026-10-04 14:00) — `shots/trailer/aloud-trailer-final.mp4`, 104.7 s, 1080p30, H.264 + AAC
Cut list: `shots/trailer/cut.json` (pipeline: `tests/record/trailer.mjs`). Contact sheet, one frame per segment: `shots/trailer/v2-sheet.jpg`.
`aloud-trailer-v2.mp4` is the same cut with the OLD gameplay take (placeholder render).

| t (s) | Segment | Source |
|---|---|---|
| 0.0–4.4 | her-room: behind her at the monitors, arc to profile; slow push, **white flare** into… | `clips/t0-cold-open.mp4` 0–4.4 s, own audio |
| 3.9–9.2 | arch (push through the Red arch), reception (the squares march in, floaties) | t1 1.0–3.6, 5.2–7.9 |
| 9.2–10.7 | engines: her profile, *"Start the engines"* (hard cut on the last word) | t0 5.15–6.6 s, own audio |
| 10.7–18.1 | launch (gold flash on the cut + her monitors' flare whoosh t0 7.95–9.3 s as sfx), faces, climb | t1 ignite-0.1, faces+0.25, climb+0.3 |
| 18.1–26.2 | porthole, glass, space | t3 porthole+1.6, glass+0.9, space+0.2 |
| 25.8–37.9 | landing, **crew** (helmets off, parasols pop), offering, golden → fade to black | t5 descent+2.3, hatch+3.0, offering+0.8, golden |
| 37.2–41.2 | *"How does a civilisation / reach the stars?"* (Montserrat 300, night) | card |
| 40.8–45.0 | rewind: reversed t5 → t3 → t1 (climb back down to the pad), ramp to 22× | rewind |
| 45.0–60.9 | t6 at real speed: unbuild 4.8–14.8 (rocket un-builds, swoop over the rewinding city) ⟶ dissolve ⟶ 22.5–29 (empty land, the folk) with *"It began with a word."* (Montserrat, night-blue ink, lower third) | t6 |
| 60.3–94.2 | gameplay, 12 cuts (descent, companies, minister, house, windmill, field, red dot, lighthouse, duck, the Ministry call, the developed-civ peek, moon) | `gameplay/raw-v2.mp4` + `beats-v2.json` |
| 93.6–98.5 | lift-again, launch-again → fade to black | t1 lift+0.5, climb+2.8 |
| 97.7–104.7 | **ALOUD** (Melodrama 600, title white #f4f1ea, tracking settling to the game's .2em), *A civilisation, spoken aloud* (Montserrat 500) | card |

- Captures: every scene frame by frame at `?w=1920&h=1080&dpr=2` (3840×2160, browser deviceScaleFactor 2), each frame lanczos-downscaled to 1080p PNG in the capture (`cut.json` `render`). Captured 2026-10-04 12:43–13:22 (t1, t3, t6 final, t5 final 13:13 version).
- Music: none yet (silent bed, the duck slot is ready): drop `shots/trailer/music.(mp3|wav|m4a)` and re-run edit. Audio now = the cold open's room tone, her line and the flare whoosh. Tape-stop sfx slot: `shots/trailer/sfx/tape-stop.*`.
- Re-render (only changed segments rebuild; scene captures and unchanged segments come from `shots/trailer/build/*.mov` + `.sig`):
  - `node tests/record/trailer.mjs edit` (cut.json `out`), then `node tests/record/trailer.mjs segsheet --in shots/trailer/aloud-trailer-final.mp4`
  - a new gameplay take `gameplay/raw-<tag>.mp4` + `beats-<tag>.json`: `node tests/record/trailer.mjs edit --gameplay <tag>` (uses the play segment's `takes.<tag>` cuts when present, else its `cuts`)
  - a changed scene: `node tests/record/trailer.mjs capture --scene <id> --force`, then edit. `--fresh` rebuilds every segment.

## Beat sheet (v1 plan, superseded by cut v2 above)
| t (s) | Beat | Source |
|---|---|---|
| 0–5 | Live action: a young woman at her desk at night leans to her mic: *"Light the engines."* Push into her monitor. | Higgsfield Seedance 2.0 (start frame from Cinema Studio) |
| 5–7 | Match cut through the screen: **Red arch reception**, a farewell gathering. Our flits and floaties stand on the terrace with lanterns, facing the sea at sundown. | trailer scene `t1-reception` (her Red arch verbatim + our folk) |
| 7–9 | The **rocket fires** from the sea platform: a painted plume and steam, the folk look up and wave. | `t2-launch` |
| 9–11 | **Cabin:** our folk in bubble astronaut helmets press to round portholes, amazed; the Earth (her Tower Planet) falls away outside. | `t3-cabin` |
| 11–14 | Space: the rocket streaks toward Plissé, which grows. | `t4-space` (Tower Planet space + Plissé stand-in + rocket) |
| 14–22 | **Landing + first contact** on Plissé's meadow at **midday**: the rocket settles, the hatch opens, a flit offers a seed, the shadelings gather, and golden hour washes in. | `t5-contact` (the landing-bridge lounge replica, identical paint) |
| 22–26 | Title card: *"How does a civilisation reach the stars?"* | edit |
| 26–40 | **Rewind:** reversed footage from contact → space → launch → reception → the town un-builds (paint → pencil → nothing) → empty cream land with our folk. VHS-free: paper-flutter + tape-rewind feel, accelerating. | reversed captures + `t6-unbuild` |
| 40–98 | **"It began with a word."** Real gameplay (director mode): descent, fleets, choosing the minister, voice → creation (house, a field drawn with the pencil, a generated lighthouse with the Ministry of Builds moment), letters, rewards, neighbours, and *"build a rocket"* (Opus designs it live). | `?director=1` capture |
| 98–110 | Back to the launch, then **ALOUD** (Melodrama semibold, white), then the tagline. | edit |

## Rules
- **The look is sacred:** her reference scenes are verbatim (Red arch, Tower Planet, Plissé, Alpine lounge). Trailer additions (rocket, helmets, plume, cabin) are authored in the Red arch gouache grammar.
- **Creations stand in for live AI while the API has no credit:** Opus authors stock assets (the rocket, lighthouse, rubber duck…) through the Build API into `server/mock/assets/`, so the Ministry → pencil → paint moment is identical on camera.
- **Edit:** ffmpeg (installed). The trailer pages expose `window.__shot.play()` / `__shot.done` for frame-accurate capture with tests/record/record.mjs. Music: a premium cinematic score (TBD: licensed track or generated).

## Paint settings rule (2026-10-04, Sueda: "a bit smudged / not my defaults")
Every painted trailer page must render exactly like her Red arch reference:
- painter defaults = her G_DEFAULT untouched (brush 4, wobble 3, saturation 1.06, warmth 0, tooth 0.1, pooling 0.06, lines on, lineWeight 3.4, lineStrength 0.55) — no per-scene overrides of brush/wobble/kuwahara radius/tooth/pooling/lines.
- pixel ratio like the reference: renderer.setPixelRatio(Math.min(devicePixelRatio, 2)), canvas sized to the window. NEVER force setPixelRatio(1) + a fixed 1920x1080 canvas (on her Retina screen that canvas is upscaled → the smudge she saw).
- recording: ?w=1920&h=1080&dpr=2 renders 3840x2160 (her internal 1500px paint + full-res paper/lines, same as on her screen), then downscale with lanczos to 1080p (or keep 4K).
- t5 contact (her Plissé/lounge verbatim) is approved: leave it.

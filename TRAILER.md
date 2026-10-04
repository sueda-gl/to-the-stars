# ALOUD: launch trailer (Sueda, 2026-10-04 09:10)
Goal: a polished, professionally edited game launch trailer (~90–110 s, 1920×1080, 30 fps), for the hackathon jury. **Within 10 s the jury sees: a human says "Light the engines", we push into her screen, the Red arch, the launch into space, and the shadelings in the midday sun.**

## Beat sheet
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

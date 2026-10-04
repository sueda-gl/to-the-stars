# UI: the world is the interface

Owner: UI builder. This follows ART_DIRECTION §3 (2026-10-03): Sueda rejected the cluttered UI (mb 6, mb 8) and liked the envelope stack (mb 7). UI v3 (2026-10-04, §11) adds the inbox fanned out on the table, agent card v2 + Talk, and the opening (fleet captions, the election). **UI v4 (2026-10-04, §14) is the mail system**: the stack opens the latest letter (v4: as a compact card beside its sender; v5 reads it in the inbox instead), notes slide in under the stack, a slim recent column manages them, and the fanned table is only "see all at once". See **Mail** below. **UI v5 (2026-10-04, §15)**: letters are **read inside the top-right inbox** (the column expands in place into a reading pane; nothing beside the sender, nothing mid-screen), **painted portraits everywhere** (inbox rows, notes, the reading pane, the agent card header), the job/workplace bug fixed, and the **type is switchable** (`--ag-font-display` / `--ag-font-text`, `?font=A..G`, `createUI({ font })`, `ui.setFont(id)`). See **Mail**, **Fonts** and **agentCard** below.

Files:
- `web/js/ui/ui.js`: `createUI(...)`, the whole game UI. Pure DOM, no THREE, no sim imports.
- `web/js/ui/words.js`: plain words, no DOM. `TRAIT_MEANINGS` / `traitMeaning(t)`, `fleetLine({flit:4, floatie:2})` → *four flits · two floaties*, `jobOf(agent, lookup)` → `{title, place}`, `ventureOf` / `ventureLine`, and `plainReply(agent, text)`: the folk's own short, plain answers when no model answers (mock mode). Re-exported from ui.js.
- `web/js/ui/mail.js`: the mail system (§14, §15), built by `createUI`: the notes, the inbox column and its reading pane, the portrait cameos and faces. `noteKind(letter)`, `ago(t)` exported.
- `web/js/ui/fonts.js`: the typeface sets (`FONT_SETS`, `FONT_IDS`, `setFont(id)`, `normFont`, `fontFromURL`, `currentFont`). It flips `<html data-ag-font="A">` and links the Fontshare / Google faces a set needs (Velvetyne's are vendored, `@font-face` in agora.css).
- `web/js/ui/paper.js`: helpers. These are the DOM builder `h()` (it now sets `--custom` style properties properly), deckled sheets, wax seals, heraldic shields, the small envelope, the **big three-layer envelope** (`ENV_BACK_SVG`, `ENV_POCKET_SVG`, `ENV_FLAP_SVG`), `MIC_SVG`, `FLOURISH_SVG`, the pencil scribble and the resource glyphs.
- `web/css/agora.css`: every game style. Tokens: `--paper #f3ecdc`, `--ink #3d5588`, `--red #e0503f`, and the type: `--ag-font-display` (names, subjects, titles, signatures) and `--ag-font-text` (everything else), Instrument Serif by default (`--ag-serif` is kept as an alias of the text face). Text that sits straight on the map uses a paper halo (`--ag-halo`; `--ag-halo-strong` for small lettering such as the name and the mark's words) and a faint radial paper wash (`--ag-wash`) behind it, so it reads over dark relief, sea and the Red arch's red. Keys are written as upright words inside the italic (`.ag-kbd`), never as boxed keycaps.
- `web/ui-lab.html`: every state over a still of the world (see Lab).
- `web/assets/backdrop-map.jpg` and `backdrop-green.jpg` are rotated crops of moodboard 1 and 2. `backdrop-reference.png` is the Red arch (made by `tests/ui/backdrop.mjs`). `backdrop-folk.jpg` is `shots/agents/close-landed.png` cropped above the lab chrome (the folk close up, for the card / talk / opening presets).

## What is on screen
| when | what | where |
|---|---|---|
| **at rest** | the settlement name, small italic, no card (click = ledger) | top-left |
| | the **envelope stack** (mb 7): two cream envelopes, a red wax seal with the sender's initial, a red count badge. It shows only when letters exist; with one letter it is one envelope. A small ink **chevron** under it opens the recent column (a red dot on it while unseen unread notes wait). | top-right |
| | the **voice mark**: a small mic glyph (no disc, no pill; a paper halo keeps it legible) and *hold Space* in tiny italic (*hold to speak* on touch). After the first command it fades to just the glyph. | bottom-centre |
| transient | the **live caption**: one line of large italic serif. It fades ~3 s after landing. | just above the mark |
| | the **director line**: the same voice, larger, with a small red kicker | above the caption |
| | **notices**: one short line plus the pencil scribble (progress) and its stage. One at a time; when the newest goes, the one under it comes back. | top-centre |
| | **mail notes**: slim paper slips, *(portrait) **Olla** sent a letter · “Bread”*; up to 3, newest on top; each tucks itself into the column after ~6 s | under the stack |
| | **hint line**: onboarding's pointing hint (a `guide` line: a touch larger, full strength), or after 30 s idle one faint rotating "try saying …" (clickable). Both sit on a soft paper wash; a quoted phrase never breaks across lines. | above the mark |
| | the **typed line**: one underlined input in place of the mark (Enter, `/`, or a click on the mark; Esc closes) | bottom-centre |
| on demand | **the inbox**: the recent column (portrait rows, dismiss / mark read; the chevron, or hover the stack) | under the stack |
| | **reading a letter** (click the stack / a note / a row / the folk's tag): the column **expands in place** into the reading pane, the world fully visible | under the stack, top-right |
| | **see all at once**: every letter fanned out on the table (shift-click or long-press the stack, or the column's link) | centre |
| | **the full sheet**: only the onboarding's welcome letter and the director use it now | centre |
| | the **ledger**: one paper sheet (Tab, or click the name) | top-left, over the name |
| | the **agent card v2**: small, near the click, headed by the folk's painted portrait | near the folk |
| | **talk**: the folk's paper speech bubble + one underlined line under it | above the folk |
| scenes | the meeting letterbox, the envoy decree, the title card | full screen |
| opening | the **fleet caption** (lower third), the **election** line, the **elected** seal moment | lower-left / upper centre |
| choosing folk | the **pick prompt** (`ui.pick`): *Who joins the Police Patrol?*, the chosen folk's portraits, Done / cancel | top centre (phone: under the stack) |

The following are gone from the game: the chip bar, the "say …" pill, the HUD card, the minister pill, the neighbours pill and the letter-list dropdown. The reference's editions pill, Gouache settings and Up close are hidden by default (`body.ag-no-paint-chrome`). Only labs show them (`paintChrome: true`, or `?lab=1` in ui-lab).

The UI layer is `.ag-ui` (`position:fixed; inset:0; z-index:10; pointer-events:none`). Only the name, the stack, the mark and the paper objects take the pointer. The voice mark and caption sit above the reading overlay, so you can reply aloud or type while a letter is open.

## Mail (ART_DIRECTION §14, §15): letters live in the world, the inbox stays top-right, letters are read IN it
Sueda (§14): *"I should still have my letter UI on the right side, and when I click there it should bring me to the latest one, or I could open whatever I feel like by clicking the agent."* Sueda (§15, 03:55): *"Inbox stays at the top right. Opening a letter shows it inside the top-right inbox area (the inbox expands to read it), not beside the folk and not mid-screen. Inbox rows show the sender's painted portrait."*

**What it looks like** (shots: `shots/ui/inbox-read*.png`, `mail-*.png`; lab: `?state=inbox-read | inbox-read&long=1 | inbox-read&font=A | mail-notify | mail-column | mail-compact | mail-seeall`):
- **The stack** (unchanged mb 7 look). A click asks the game for the **latest unread** letter (`onOpenLatest(letter)`); the game may glide the camera to its sender and then calls `ui.letters.openCompact(letter)` (the old name: it opens the letter **in the inbox**). Shift-click or a long press (520 ms) fans everything out (**see all at once**). Hovering it with a mouse opens the recent column.
- **The inbox column** (`.ag-mailcol`, under the stack, ≤ 45vh, scrolls): *Recent post · 3 unread · mark all read · dismiss all*; one row per note: the sender's **portrait cameo** (38 px: the painted head pressed into a disc of wax), **sender** *verb* (the verb moves to the next line whole rather than being cut), “subject” (up to 2 lines), time (*just now*, *12 min ago*), a red **unread dot** (click = mark read) and ×; read rows are quiet. Footer: *see all at once*. A row click → `onNotificationClick(letterId, {from:'column'})` (without it: straight to the pane). Opened by the chevron (pinned; the chevron again or Esc closes it) or by hovering the stack (unpinned; leaving closes it).
- **Reading (§15): the column expands in place into the reading pane** (`.ag-mailcol.is-reading` › `.ag-mread`). **Pinned (2026-10-04, Sueda's screenshot of a pane floating on its own with "the Ministry of / Builds" wrapped):** the inbox (list and pane) hangs in the top-right corner **directly under the stack's chevron**, right-aligned with the stack, ≤ 380 px wide, at most 70vh tall (scrolling inside), and only grows downward. `mail.js place()` measures the chevron / stack and sets `--ag-inbox-top` on the layer (the CSS calc is the fallback). **While the inbox is open the stack and chevron stay visible even in a cinema frame** (the opening's ceremony hid the stack and left the pane floating), and the unfold animation fills *backwards* only, so the title card / meeting really hide it. On a phone: full width under the stack and clear of the voice mark. No veil, no blur, nothing beside the sender, nothing mid-screen: the world stays visible (the game can still glide the camera to the sender). Inside:
  - the **bar**: *‹ back to the list* · *‹ prev*  *2 of 7*  *next ›* (down the same newest-first order; disabled at the ends) · ×;
  - the sender's **portrait cameo** (62 px; for a folk the painted portrait fills the disc, the wax only a thin rim), the **name** (display face) and trade, *Day n*. A **Ministry** letter keeps its ink seal, and the current minister's portrait is pressed beside it (*sent by Olla, your minister*; `createMail({ minister })` reads `ministerSeal`); nations keep their shields;
  - the **subject**, the **body** (it scrolls inside; its lower edge fades while there is more), the **signature** (always one line: a long one, > 12 characters, moves left and is set smaller; if it still does not fit, `fitSign` right-aligns it and shrinks it to fit, down to 14 px), the **P.S.**;
  - 2–3 **quick replies** (*say* <u>yes, build it</u>) and *or say it: hold Space*; an *answered* stamp once resolved.
  - Keys (focus is in the pane when it opens): **↓** reads on, then the next letter; **← / →** prev / next; **Esc** back to the list if the letter was opened from it, else the inbox folds. A reply does the same after 1.8 s. × folds the whole inbox. A click on the world leaves it open (it sits in the corner).
- **Notes** (`.ag-note`): a slim slip slides in under the stack for each new letter: *(cameo) **Olla** sent a letter · “On the matter of bread”*. Kinds: a folk's letter (*sent a letter*), a **Ministry notice** (*posted a notice*), a neighbour's **envoy** (*sent an envoy*), an **election** (*held a vote*). Up to 3 at once, newest on top; hovering pauses them; after ~6 s each one flies into the chevron (the column). A click → `onNotificationClick(letterId, {from:'toast'})`; × dismisses it. While the inbox is open, notes go straight into it.
- **Portraits (§15: everywhere a folk appears)**: `letter.portrait` (a dataURL) > `letter.from.portrait` > `createUI({ getPortrait(senderId, letter) })` (a dataURL, a Promise of one, or null) > `ui.setPortrait(senderId, dataURL)` at any time later (every cameo and face on screen updates). **Only folk** (`from.kind` agent / minister) are asked: nations keep their heraldic shield, the Ministry its ink scales, *the folk* their red seal. While a portrait is pending: the red wax seal with the initial. The **agent card header** uses the same cache (`getPortrait(agentId)`). The game passes `agents.portrait(id, { size: 96, ring: false })`.
- **In the world** (§15): the agents layer draws the **tiny text tags** above the sender's head (name, one line, 2–3 quick replies); a click on one → the game's open (camera glide) → `openCompact(letter)` → the pane. The lab fakes them (`.lab-pin`, lab only).

### Contract for `web/js/game.js` (the wiring builder)
The UI never moves the camera. Everything that needs the world comes back through these (all optional):
```js
const ui = createUI({
  // ...the existing options...
  onOpenLatest: L => { if (L) openLetterInWorld(L.id); },          // the stack: L = the latest unread letter (or the newest), a copy
  onNotificationClick: (letterId, { from }) => openLetterInWorld(letterId),   // from: 'toast' | 'column' | 'seeall' | 'next' | 'prev'
  onNextLetter: letterId => openLetterInWorld(letterId),            // optional (next ›); defaults to onNotificationClick
  onLetterRead: letterId => { try { game.markRead(letterId); } catch (_) {} },   // a letter opened, a dot clicked, mark all read
  onNotificationDismiss: letterId => {},                            // optional: × on a note / a row ('dismiss all' calls it per note)
  getPortrait: (senderId, letter) => agents.portrait(senderId, { size: 96, ring: false }),   // dataURL | Promise<dataURL> | null (folk only)
  notifyOnArrive: true,                                             // default: letters.addLetter() (not silent, unread) also slides a note in
  font: null                                                        // 'now' | 'A'..'G' (see Fonts); ?font= in the URL wins
});
// optional glide: the camera to the sender, then the letter in the inbox (top-right)
async function openLetterInWorld(id) {
  const L = ui.letters.all.find(l => l.id === id); if (!L) return;
  const at = senderObject(L); if (at) glideCameraTo(at);   // don't need to await: the pane opens in its corner, the world stays visible
  ui.letters.openCompact(L);                               // = ui.letters.read(L)
}
```
- Without any of the callbacks (today's game.js passes only `getPortrait`) everything works: the stack, a note, a row, *next* open the letter in the pane directly.
- **Notes for things that are not letters** (or to re-announce one): `ui.notify.push({ kind: 'ministry'|'envoy'|'election'|'letter', name, subject, verb?, letterId?, from?: {kind, id, name}, portrait?, at?, toast? })` → note id. `ui.notify.letter(letterOrId)` re-announces a letter (no duplicates: the same letter moves to the top).
- **`desk.js` needs no change**: `ui.letters.addLetter(L)` already slides the note in, and `markResolved` stamps the open letter *answered*. `feedHud()`'s `if (ui.letters.openId) game.markRead(...)` keeps working (`openId` is the pane's letter too).
- The director's `ui.letters.toggleList(true)` / `isOpen` / `close()` keep working (the full sheet).

### API (mail)
- `letters.openCompact(letterOrId, { anchor? })` → id (**§15: opens it in the inbox pane**; `anchor` is accepted and ignored). Same as `letters.read(letterOrId)`. A letter object not on the stack yet is added silently. Opening marks it read (`onLetterRead`) and removes its note.
- `letters.closeCompact()` (Esc's behaviour: back to the list, or the inbox folds), `letters.backToList()`, `letters.moveCompact()` (a no-op now), `letters.compactId` = `letters.readingId`, `letters.isCompact`, `letters.compactEl` (the inbox element while reading).
- `letters.openLatest()` (= a click on the stack), `letters.latest()` (the letter it would open), `letters.markRead(id, read = true)` (fires `onLetterRead` on unread → read), `letters.seeAll()` (= `fan()`), `letters.chevron`.
- `letters.close()` closes the pane (or the full letter); `openId` / `isOpen` cover both.
- `ui.notify`: `letter(letterOrId)`, `push(opts)`, `dismiss(noteIdOrLetterId)`, `dismissAll()`, `markRead(noteIdOrLetterId)`, `markAllRead()` (every letter too: the count goes to 0), `clearToasts()`, `list` (copies: `{id, letterId, kind, name, verb, subject, at, read, toast}`), `toasts` (how many on screen), `column.open({pin = true})` / `close()` / `toggle()` / `isOpen` / `pinned` / `el`.
- `ui.setPortrait(senderId, dataURL | null)`.

## Fonts: two variables, eight candidate sets (Sueda, 2026-10-04)
Sueda dislikes Instrument Serif (*"looks like any game AI built"*). Every UI style now reads **`--ag-font-display`** (names, subjects, titles, signatures, the fleet name, the director line, the ledger name) and **`--ag-font-text`** (everything else). The default stays Instrument Serif until she picks. The candidates are the specimens in `web/fonts.html`:

| id | display + text | from |
|---|---|---|
| `now` | Instrument Serif | Google (linked by the pages) |
| `A` | Basteleur + Compagnon | Velvetyne, vendored in `web/assets/fonts/` |
| `B` | Boska | Fontshare |
| `C` | Zodiak | Fontshare |
| `D` | Gambetta | Fontshare |
| `E` | Erode | Fontshare |
| `F` | Young Serif + Compagnon | Google + Velvetyne |
| `G` | Basteleur + Sentient | Velvetyne + Fontshare |

- Switch: **`?font=A`** in any page URL (createUI reads it), **`createUI({ font: 'A' })`**, or **`ui.setFont('C')`** at any time (instant; `ui.font` reads it). `setFont('now')` goes back. It sets `<html data-ag-font>`; the per-set variables live in agora.css; `js/ui/fonts.js` links only the faces that set needs.
- **Optical size**: the UI was sized on Instrument Serif, a very condensed face; every candidate is wider (Compagnon ~1.7×). Each set carries a `font-size-adjust` (`--ag-fsa-display`, `--ag-fsa-text`) so its x-height sits where Instrument's did, a touch smaller for the widest. Basteleur and Young Serif have no italic: they stay upright (`font-synthesis-style: none`), no fake slant.
- **Fit**: `tests/ui/fonts.mjs` loads 29 presets × 2 sizes × 8 sets and checks every line of text stays inside its paper sheet and on screen. All pass; the only ellipses are the fan cards' one-line trade line (*Harbourmaster Brusco, from across the wa…*), which already happens with Instrument. Notes and rows wrap instead of cutting (*Little Lantern / sent an envoy*), the fan cards' sender takes two lines when it must, the notice's stage wraps on phones.
- The lab drawer has a **Font** row (every set, live).

## See all at once: mail on a table (ART_DIRECTION §11, now optional per §14)
**Shift-click or long-press the stack** (or *see all at once* in the column; `ui.letters.seeAll()` / `fan()`): **every** letter fans out across the centre, over the world dimmed and blurred, like mail spread on a table. The stack and the name step away while it is open; the head reads *Your letters · 12 letters · 4 unread · gather them up* in paper-coloured italic.
- **A card** (236×152 at full size) is an envelope front: the sender's seal (red wax / heraldry / the Ministry's scales) top-left, the sender and trade, a blue **postmark** with *DAY n* top-right, the subject in italic, and a small *UNREAD* (red dot) or *ANSWERED* (blue). **Unread** cards sit slightly raised with a deeper shadow; **answered** ones are dimmed and desaturated. Hover / focus lifts a card straight and to the top.
- **Layout**: loose rows that arc a little, each card with a seeded tilt and jitter (stable screenshots). The column count is chosen so the cards fit without overlap, preferring vertical overlap when they must (the top strip with seal, sender and day always shows). 1–2 letters are larger; more than 12 shrink (to .78) before they overlap; phones use two columns. 1 to 30 letters tested.
- **Motion**: the cards fly out of the stack one after another (32 ms stagger, ~0.6 s each, WAAPI). **A click on a card** (§14) folds the table away and goes where every letter goes: `onNotificationClick(id, {from:'seeall'})` (the game glides, then the inbox pane), or straight to the pane without the callback. *gather them up*, **Esc** or a click on the bare table folds every card back into the stack and the count pings. A letter arriving while the table is open lands on it as a new card. The cards' seals are the portrait cameos when portraits exist.
- `ui.letters.toggleList()` still opens the newest unread letter directly (the director uses it); the onboarding's welcome letter also opens directly.

## Reading a letter (the full sheet)
`letters.open(id)` opens one letter on a full sheet: the onboarding's welcome letter and the director's `toggleList(true)` use it. Everything else opens in the inbox pane (§15).
- **Variant A (default), a tall portrait letter centred.** The envelope flies off the stack to the middle of the screen. The wax seal gives, the flap opens on a 3D hinge, and the letter rises out of the envelope (it sits between the envelope's back and its pocket). The envelope then slides away below and the letter comes up to full size, settling at a slight −0.6° rotation. It takes about 2.3 s, using WAAPI.
- **Variant B: on a desk.** A large kraft-cream desk sheet holds the opened envelope on the left (flap up, seal broken, "from Olla" on the pocket) and the letter beside it, laid at +1°. On screens ≤900px the envelope steps aside and the letter fills the desk.
- The paper has deckled edges, grain, two faint fold creases and layered shadow. The sender's seal (red wax for folk, heraldry for nations, the ink scales for the Ministry) sits at the top with the sender, trade · species, and *Day N* in the corner. Then come the subject in italic, the body in 21px of the text face, and a **signature**. The last body line becomes the signature when it starts with "—" or with the sender's first name, and "Name, rest" splits into a big italic name plus a small line. A red flourish follows, then an optional **P.S.** (`letter.note`, trusted HTML for our own letters only). Then 2–3 **reply links** (*say* <u>yes, build it</u>), *or simply say it*, and *fold it away* and **next letter →** (when more are waiting).
- The sheet has two parts: the inside (`.ag-letter__in`) and the foot (`.ag-letter__foot`). The foot never scrolls, so *fold it away* and *next letter* are always visible and clear of the deckled edge. If a long letter is taller than the screen, only the inside scrolls (no scrollbar on paper): its lower edge fades out while more is below.
- Opening a letter moves keyboard focus into it (the dialog), so a click on the stack never leaves focus on the stack: Enter then opens the typed line and Space never re-clicks the stack.
- A reply calls `onLetterOption(id, says)` (or `onCommand(says,'chip')` if the option has `command:true`), marks itself ✓ and folds the letter after 1.5 s. Esc, a click outside, or *fold it away* folds it back into the stack. The letter flies to the stack and the count pings. → (ArrowRight) goes to the next letter.
- Choose the variant with `createUI({ letterVariant: 'a'|'b' })` or `ui.letters.variant = 'b'`. In the lab, use `?letter=b`. **A is the default and the recommended one** (the letter rising out of the envelope); B (on a desk) is kept as an alternative.

## API (backwards-compatible where cheap)
```js
import { createUI } from './js/ui/ui.js';
const ui = createUI({
  root: document.body,
  onCommand(text, source),        // 'typed' (the typed line) | 'chip' (an example phrase in the welcome letter, a hint line, a command:true reply)
  onLetterOption(letterId, says), // a reply link in a letter; meeting -> letterId 'meeting'; decree -> its id
  onAgentAction(agentId, what),   // card: 'minister' | 'talk' ; ledger neighbours: 'neighbour:'+id, 'visit' | 'gift'
  onTalk(agentId, text, {source, agent}), // -> string | Promise<string> | nothing (then talk.reply later, or the folk's own words)
  bubble(agentId, text, {thinking, ttl}), // optional: return true when the game drew the speech bubble (agents.bubble)
  onStart(),                      // the title card's Begin (or Enter)
  onMic(down),                    // hold the mark (>200 ms): true on hold, false on release. A short click opens the typed line instead.
  onOnboardingDone({skipped}),
  getPortrait(id, letter?),       // the folk's painted portrait: dataURL | Promise<dataURL> | null (the mail + the agent card)
  font: null,                     // 'now' | 'A'..'G' (Fonts); ?font= wins
  lookup: { agent(id), neighbour(id), anchor(id) -> {x,y} screen px above the folk's head, workplace(agent) -> name },
  letterVariant: 'a',             // 'a' | 'b'
  paintChrome: false,             // false = body.ag-no-paint-chrome hides editions / Gouache settings / Up close. ui.setPaintChrome(on) later.
  hintIdleMs: 30000,              // idle before the faint rotating hint line (0 = never)
  holdMs: 200                     // mark press longer than this = talk
});
```
All callbacks are wrapped in try/catch.

### voiceBar
- `setState('idle'|'listening'|'thinking'|'done'|'error', text?)`. While listening, the glyph turns red with a thin pulsing red ring and a small red waveform, with the label *listening*. Thinking shows *the folk are listening …*. Done and error show `text` (or *heard* / *the folk didn't quite catch that*, in red) and return to idle after 1.8 s. `done` (or any command) marks the voice as used, and the *hold Space* label goes quiet.
- `setCaption(text, final=false, { holdMs=3000 })` shows the live caption. Interim text is pale with a red caret. Final text fades `holdMs` after landing (0 means it holds). `who` is accepted and ignored. `setCaption('')` hides it.
- `setChips(list)` draws **nothing** now. The list feeds the idle hint rotation. `chips` returns it.
- `openTyping()`, `closeTyping()`, `focus()` (= openTyping), `setValue(t)`, `isTyping()` (focus is in the field), `typingOpen`, `setLevel(0..1)`, `state`, `el`.
- Keystrokes in the typed line call `stopPropagation()`. **A voice module that listens in the capture phase must check `ui.voiceBar.isTyping()`.**

### letters (shape = ARCHITECTURE §2 `letters[]`; optional `note`, and `options[].command`)
- `addLetter(letter, { silent=false, open=false })`: the envelope slides in and lands on the stack, and the count pings. `open(id)`, `close()`, `next()`, `markResolved(id, {choice?})` (which stamps *answered*), `setLetters(array)`, `toggleList(force?)` (compat: opens the newest unread, or closes), `variant` (get/set), `openId`, `isOpen`, `unread`, `all`, `el` (the stack).

### notices
- `const id = ui.notice(text, { kind:'ministry'|'minister'|'neighbour'|'info', progress?, stage?, title?, from?, neighbourId?, ttl?, sticky?, id? })`. It is one line, with a tiny seal for ministry, minister or neighbour (the kicker text is now the element's `title`). `progress` 0..1 draws the pencil scribble to that length; `true` loops it. `stage` is the italic word beside it. Lifetime: info 4.5 s, others 6.5 s, unfinished progress stays. Only the newest live notice shows.
- `updateNotice(id, {text?, progress?, stage?, kind?, ttl?})` and `closeNotice(id)`.

### ledger (new) and what feeds it
- `ui.ledger.open()`, `close()`, `toggle()`, `isOpen`. Tab toggles it (not while a letter or decree is open). A click on the settlement name opens it; Esc or an outside click closes it. It shows the name, *a hamlet, on the third day*, stage dots, the honour, the **minister** (red seal and name, or *No one yet. Say "make Olla our minister".*), the **neighbours** (riso shield, name, attitude word with a dot, and *Visit · Send gift* text links), the **stores** (glyph, number, word) and **prosperity** (a pencil line with a red dot), plus the *offline mind* dot.
- `hud.set({ name, stage, day, prosperity, prosperityMax, resources, honour })` feeds the name (top-left) and the ledger. `hud.el` is the name; `hud.state` is a copy.
- `ministerSeal.set(agent|null, { quiet })` feeds the ledger. A **new** appointment is said once as a quiet minister notice (*Olla now carries the minister's seal*), unless `quiet`. `agentId`.
- `neighbours.set([{ id, name, attitude, allied?, species?|leaderSpecies?, leaderName? }])`. `open()` / `close()` open or close the ledger; `isOpen`, `get(id)`, `list`.
- `offlineNote(on)` puts a tiny dot in the ledger only.
- **§18 (the minds)** `ledger.note(text)` adds a quiet line to an **"Of late"** section (the last 4 shown of 12 kept, each cut to 96 characters; never a notice); `ledger.setMind({ mode:'live'|'mock'|'rules', cast, castCount, calls, perHour, fallback })` is the one-line status in the foot (*live minds · ≈ $0.12/h*, *live minds, answered offline*, *minds resting (rules)*, *minds of their own (offline)*; it replaces the *offline mind* dot when set); `ledger.society` is a copy of the lines. game.js feeds both (docs/game.md "The minds in the game").

### letters: the inbox
- `letters.fan()` (= a click on the stack, = `ui.inbox.open()`), `letters.gather()` (= `ui.inbox.close()`), `letters.isFanned`, `letters.table` (the element). `addLetter`, `setLetters`, `markResolved` keep the table in sync while it is open.

### agentCard (v2)
- `show(agent, {x,y}, {isMinister?})`: a small paper card (304px) beside the folk (never on it), kept on screen and off the stack, the name, the voice mark and the folk's talk line. It shows:
  - **§15: the folk's painted portrait** (64 px, in a paper ring and a ring of the species' ink; `getPortrait(agent.id)` / `ui.setPortrait`, the species seal while it is pending), the **name**, *a flit* / *a floatie*; the red **minister seal** is a small badge pressed onto the portrait's edge;
  - the **job and workplace**, the place said **once** (*Farmer at the Field*, *Builder at the Windmill site*, *Diplomat at the Assembly steps*, or *Builder, no workplace yet*). `jobOf` splits the sim's label (*farmer at the Field*) and drops the game's `lookup.workplace` name when it is the same place (the §15 bug *at the Field at the Field*), or when the title already names it (*keeper of the Tea house*); and an entrepreneur's **venture** in red italic (*dreams of opening a tea house by the bay* / *has asked to open …* / *is starting …* / *runs …*);
  - what they **wear** when the agents layer says (`agent.wears` or `agent.look.desc`);
  - the **mood word** (*cheerful, and tired*) and the status;
  - up to three **traits with their plain meaning** (*generous — gives away what they have*);
  - **every skill** in two columns: known ones with pencil ticks, unknown ones a red **?**;
  - **Talk** · **Make minister** (*your minister* when they are; no Make minister during the opening election);
  - the last **4 lines of talk** (*you* / *Olla*). On phones the skills fold away while talking.
- Agent fields read (all optional): `name, species, trade, job ('title' or {title, place}), workplace ('the bakery' or {name}), venture|ambition ('…' or {name, status:'dream'|'proposed'|'started'|'open'}), wears, look.desc, traits[], mood, energy, status, skills{}, known{}`. With no workplace on the agent, `lookup.workplace(agent)` is asked (return a name).
- `hide()`, `refresh(agent?)` (rebuild in place: a new minister, the election ending), `agentId`, `agent`, `el`. It closes on Esc or an outside pointerdown (not on a click into the talk line). `onAgentAction(id, 'minister' | 'talk')`.

### talk: folk answer in a small paper speech bubble
- **Talk** on the card opens one underlined line on a paper slip **under the folk's speech bubble** (`talk.open(agentOrId, {focus})`). Enter sends and keeps the line open for the next question; Esc closes it. **Space on the empty line** is push-to-talk: the line lets go of focus and the voice module takes the key.
- `talk.target`: the folk a spoken sentence should go to (the open talk line's folk, else the selected folk = the open card). **The game routes a final transcript to `ui.talk.say(text, {source:'voice'})` when `ui.talk.target != null`**, else to its commands. `ui.voiceBar.isTyping()` is true while the talk line has focus.
- `talk.say(text, {source, agentId?})` logs *you*, shows a thinking bubble and calls **`onTalk(agentId, text, {source, agent})`**. The reply comes back as a string or a Promise of one from `onTalk`, or later by **`talk.reply(agentId, text)`**. If nothing answers (no `onTalk`: 0.75 s; an empty / failed promise: at once; `onTalk` returning nothing: 9 s) the folk answer in their own plain words (`plainReply`: *I am a baker. I work at the bakery.*). Mock mode works fully.
- **The bubble**: `createUI({ bubble(agentId, text, {thinking, ttl}) })` — return `true` when the game drew it (agents.bubble), and the UI draws none; otherwise the UI draws its own: a paper bubble (sheet colour, grain, soft shadow, a tail pointing at the folk), 19px of the text face, centred. It stays while the line is open; otherwise it fades after 3.8–9 s.
- **Anchor**: `lookup.anchor(agentId) → {x, y}` (screen px just above the head / parasol; tracked every frame while the bubble shows). Without it the bubble sits above the click point. For the game: `const a = agents.creature(id); a.root.getWorldPosition(v); v.y += 1.1 * scale; v.project(camera)` → px.
- `talk.close()`, `talk.thinking(id)`, `talk.history(id)`, `talk.isOpen`, `talk.agentId`, `talk.el`, `talk.isTyping()`.

### the opening (ART_DIRECTION §11): fleet captions, then the election
- `fleet.caption({ name, counts?: {flit, floatie}, line?, note?, index?, total?, ttl? })`: an elegant lower third, bottom-left (never under the voice mark): a red kicker *FLEET TWO OF FIVE*, the name in large italic (*The Builders*), a red rule that draws, the counts with tiny flit / floatie glyphs (*four flits · two floaties*), and an optional note. A new caption crossfades over the last. `fleet.hide()`, `fleet.visible`, `fleet.line(counts)`.
- `election.prompt({ title, action, note })`: one calm centred line near the top, *Choose your minister — click one of them*, with a small note (*Your minister speaks for the folk and carries your seal. Later on, the folk will hold their own elections.*). Clicks pass through to the world. `election.hover(agent|null)` names the folk under the cursor under it (optional).
- **The game** turns a click on a folk during the prompt into `await ui.election.elected(agent)`: the prompt goes, a big red wax seal presses in, *ELECTED · **Olla** is your minister · a floatie · diplomat · carries your seal from today*, a red flourish draws; after `ttl` (3.8 s; 0 holds until `end()`) it fades, `ministerSeal.set(agent, {quiet:true})` has been called, and the election is over. `election.end()`, `election.active` (the card hides Make minister while it is true), `election.visible`.
- Later elections are the crowd's (sim) and arrive by letter; nothing new in the UI.

### pick: choose some folk (an institution's members, a crew)
Sueda (2026-10-04): *"for the police thing I need to select someone from the agents."* A small calm card at the top centre, the election prompt's voice made compact; the world stays clickable (the layer passes clicks through).
```js
ui.pick.show({ title: 'Who joins the Police Patrol?', hint: 'click folk, then Done', min: 1, max: 6,
  kicker: 'A new institution',            // optional red small-caps line above the title
  count: 0,                               // optional: how many are chosen already, or (n, {min, max}) => 'the counter words'
  onDone: (ids, agents) => {},            // Done or Enter, once min..max are chosen; return false to keep the card open
  onCancel: () => {},                     // 'cancel' or Esc
  onRemove: id => {} });                  // optional: each chosen portrait becomes a button that takes that folk out
ui.pick.update(list);                     // agents or ids (lookup.agent fills them in); the new ones pop into the row
ui.pick.hover(agentOrId | null);          // optional: names the folk under the cursor (*Pell · a flit, scout · chosen*)
ui.pick.hide();  ui.pick.done();  ui.pick.cancel();  ui.pick.active;  ui.pick.list;  ui.pick.el
```
- The card: the title (display face), *click folk, then Done · 2 of 6 chosen*, a row of the chosen folk's **painted portraits** (40 px, `getPortrait` / `setPortrait`, the species seal while pending) with their names, an empty pulsing slot for the next one (up to `max`), then **Done** (an ink pill, disabled until `min`) and *cancel*. ≤ 440 px wide; on a phone full width under the stack.
- **The game owns the picking**: while `ui.pick.active`, turn a click on a folk into your own list and call `ui.pick.update(list)`; don't open the agent card. The idle hint waits; notices step down under the card (`--ag-pick-b`); the election line hides under it.
- Keys: **Enter** = Done (not the typed line) and **Esc** = cancel while it shows (after the typed line, the talk line and the agent card in Esc's order).

### onboarding (§24, 2026-10-04 11:20): ONE panel on the lower half (`ui/guide.js`)
- No welcome letter any more. `ui.guide` is the onboarding's one place: a soft rounded card centred low (Montserrat,
  near-black on warm white, a pink halftone corner), `Step n of 6` + the pop step markers (icons.js `step / step-current /
  step-done`), the step's pop picture beside a short heading, one or two lines of body, an optional live **aside** (the
  census of the residents, the folk under the cursor during the election), chips, and ONE action: a Continue button or a
  yellow "do it" pill (`todo`) that the game completes when the player does it; `success(text)` shows the tick. A pulsing
  pink ring (`point(target, label)`: an element, a selector, a function, or `{x, y}`) hugs the UI the step is about.
  `guide.show({ step, total, id, title, body, aside, todo, chips: [{ label, icon, onClick }], action: { label, onClick }, point, pointLabel })`,
  `guide.update(partial)`, `guide.aside(text | { html })`, `guide.hide()`, `guide.visible`. The words: `ONBOARDING_STEPS` (guide.js).
- `ui.onboarding` keeps its API (`start / step(n) / next / skip / current / active`). `attach(machine)` hands it to the
  game's state machine (`web/js/game/onboarding.js`, docs/game.md); without one (ui-lab) it pages through the six steps
  with a button. While the panel shows, `fleet.caption`, `election.prompt / hover / elected` speak through it (no big
  caption, no centred prompt, no seal moment over the world).

### the rest
- `titleCard.show({ title, subtitle, begin })`, `hide()`, `start()`, `visible`. It is calmer now: the riso-registered word (softer yellow and red), one italic line, Begin and the sound hint. The registration marks, colour strip, edition line and tracked footer are gone. While it shows, nothing else of ours is on screen, and the paint chrome is hidden too.
- `meeting.show({ title, kicker, report, options, minister?, id })` and `hide()`: the letterbox for the Assembly / up-close scene, with reply links and the minister's seal. It sets `--ag-band-b`; the caption and director line sit above the band, and the voice mark sits inside its foot.
- `decree.show({ id, kicker, title, body, shields, honour, options, ttl })` and `hide()`: a ceremonial sheet over the dimmed, blurred world, with the shields stamping in and reply links. `honour` appears under the settlement name and in the ledger.
- `showDirectorCaption(text, { kicker, ttl })` (`*word*` prints in red italic) and `hideDirectorCaption()`.
- `cinema(on)` hides the name, stack, mark and hint, and keeps the caption, director line and notices.
- `hint.show(text, { says?, html?, ttl, guide? })` and `hint.hide()` for a one-off line. `guide: true` is the onboarding strength (larger, fully opaque); without it the line is the faint idle hint.
- `setPaintChrome(on)`, `destroy()`, `el`.

## Keys
Enter or `/` opens the typed line (while the pick prompt shows, Enter is its Done). Esc closes, in this order: typed line → talk line → agent card → the pick prompt (cancel) → the letter in the inbox pane (back to the list, or the inbox folds) → decree → letter → the recent column → the table → ledger. Tab toggles the ledger (not while the table or the column is open). → goes to the next letter (full sheet); in the inbox pane ↓ reads on, then the next letter, and ← / → are prev / next. Enter on the title starts. Space belongs to the voice module. Keys are ignored when focus is in any input.

## Other exports
`SKILLS`, `STAGES`, `EXAMPLES`, `DEFAULT_CHIPS` / `MORE_CHIPS` (now the idle-hint rotation), `moodWord`, `attitudeWord`. From paper.js: `shieldSVG(id, w, species?)`, `heraldry`, `sealSVG`, `SPECIES`, `INK`.

## Motion
CSS keyframes and transitions, plus WAAPI for the letter's unfolding and folding. `prefers-reduced-motion: reduce` makes every animation nearly instant; the letter appears in place and folds away at once.

## Lab
Serve `web/` (the game server on :8870 does) and open `/ui-lab.html?lab=1` to get the drawer, which has preset links, a backdrop switch and every action. `?lab=1` also mounts the paint chrome so you can check it never collides.
- `?state=rest|speaking|typing|notice|letter|ledger|card|onboarding|title|director|hint|meeting|envoy`, plus `&letter=b` and `&step=2` (onboarding).
- **2026-10-04 (pinned inbox, pick)**: `?state=inbox-read` (the pane pinned top-right under the stack, Olla's letter with her portrait), `inbox-read&who=builds` (the Ministry's letter: its seal + the minister's face, *the Ministry of Builds* signed on one line), `inbox-read&cinema=1` (the opening's cinema frame: the stack stays with the open inbox), `pick` (2 chosen; `&n=0..4`, `&hover=1`; on the folk backdrop a click near a folk picks / unpicks them, the lab's stand-in for the game's picking).
- v3: `?state=inbox` (12 letters fanned; `&n=…` for another count), `inbox-1`, `inbox-30`, `inbox-read` (a card opened from the table), `agentcard2`, `talk` (a question, Olla's answer in the bubble and the card), `fleetcaption`, `election` (`&hover=1` names Olla under it), `elected`. The folk presets default to `&bg=folk`, and the lab's `lookup.anchor` maps the folk in that still to the screen. The lab's `onTalk` answers with nothing, so typing to a folk shows the mock-mode reply. The old names `play`, `voice`, `letters`, `tray` and `neighbours` still map to the new ones.
- **v5 (§15)**: `?state=inbox-read` (the column opened, Olla's row clicked: the pane in place; `&long=1` a long letter, `&who=n2` a nation's letter with its shield), `agentcard2` (portrait header; `&who=a3`: Pell, the sim's *farmer at the Field* + workplace *Field*, said once). **`&font=A..G`** on any preset; the drawer's *Font* row switches live. The lab's world tags (`.lab-pin`) stand in for the agents layer's §15 tags.
- `&bg=map` (default, the cream relief of mb 1), `&bg=green` (mb 2), `&bg=arch` (the Red arch) or `&bg=folk` (the landed folk, close).
- `&idle=3000` shortens the idle-hint delay.
- **v4 mail (§14)**: `?state=mail-notify` (three notes: Olla's letter, Little Lantern's envoy, the Ministry's notice), `mail-column` (the column, 7 rows, some read), `mail-compact` (the stack's path: the backdrop glides to Olla, her letter opens in the inbox pane; `&who=n2`, `&long=1`, `&bg=folk`, `&still=1`), `mail-seeall`. The lab fakes the game's half: portraits are the folk's heads cropped from `backdrop-folk.jpg` (via `getPortrait`, a Promise), tiny tags float over the unread senders (`.lab-pin`, lab only), and `onOpenLatest` / `onNotificationClick` pan + zoom the backdrop to the sender (the "glide") and open the letter in the pane. The drawer's *Mail* row has every action.

## Test it
```sh
export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH
node tests/ui/shoot.mjs     # 39 presets at 1440x900 + 22 at 390x844 -> shots/ui/*.png; `shoot.mjs inbox-read --mobile` for a few
node tests/ui/smoke.mjs     # 105 interaction checks (stack -> the inbox pane -> reply; full sheet by API; shift-click / long press -> table -> card -> pane; card v2 with
                            #   the portrait header + minister badge, "Farmer at the Field" said once, jobOf cases; talk typed / voice / mock reply / bubble hook;
                            #   fleet caption; election + elected; 30 letters on screen; a letter landing on the open table)
node tests/ui/mail.mjs      # 44 checks: notes (3 max, newest on top, kinds, no duplicates, tuck into the column), every callback (onOpenLatest,
                            #   onNotificationClick {from} incl. 'next', onLetterRead, onNotificationDismiss, onLetterOption), the column (chevron, hover, dot, ×,
                            #   mark all read, dismiss all, see all), reading in the inbox (same top-right place whatever the anchor, no veil, n of m, prev / next,
                            #   ← ↓, portraits sync / Promise / setPortrait, shields for nations, long letters scroll, reply folds / back to the list, Esc twice, ×,
                            #   world click leaves it), phone (under the stack, clear of the mark, the bar fits)
node tests/ui/layout.mjs    # 91 checks: rest clutter budget (the chevron counts as the stack's), hit-tests, overlaps, on-screen at 1440x900 and
                            #   390x844, incl. the inbox (1/12/30), talk, fleet caption / election / elected, and mail (notes, column, the pane x6 incl. font A)
node tests/ui/fonts.mjs     # 480 checks: every font set (now, A..G) loads; 29 presets x 2 sizes: no line outside its sheet or off screen, no page scroll;
                            #   lists the deliberate one-line ellipses. `fonts.mjs A F` for some sets, `--shots` -> shots/ui/fonts/
node tests/ui/pick.mjs      # 32 checks: the pick prompt (show / update / pop-in / hover / remove / Enter = Done / Esc = cancel / min-max /
                            #   onDone false keeps it / count words / notices step down / phone under the stack); the inbox pinned under the
                            #   stack at 1440x900 and 390x844 (in a cinema frame too), ≤ 380 px, ≤ 70vh, the Ministry signature on one line,
                            #   the minister's face beside the Ministry seal, a folk's portrait, hidden under the title card
node tests/ui/zoom.mjs mail-notify 1080 0 360 330 out.png   # a 2x close-up of one preset (x y w h [out] [vw vh])
```

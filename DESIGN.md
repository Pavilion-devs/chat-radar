# DESIGN.md: Chat Radar

> **Read this before any UI work** (overlay, dashboard, report, setup page, README visuals). Phase 4 onward follows this file. If a design choice isn't covered here, pick the calmer option and add it to this file.

---

## 1. The concept: "The producer's marker"

Every AI chat tool looks the same: a dark glass card, a gradient, a glowing orb, sparkles. **We don't do that.**

Chat Radar acts like a **live producer standing behind the streamer with a marker**. It reads chat and *marks it up*:
- a **highlighter swipe** behind the #1 topic
- **tally marks** for how many people are saying something
- a **hand-drawn circle** around anything urgent
- a **rubber stamp** slammed on screen when something is broken ("YOU'RE MUTED")
- a **taped polaroid** when a moment gets clipped

**Structure is broadcast-grade.** Panels are crisp, opaque, aligned and readable over any game, like F1 or NBA graphics. **The marks on top are human:** pressure-varied marker strokes, a little imperfect, never two the same.

This is what makes it *fun to watch*: viewers see a "person" marking up their messages, not a dashboard. It also shows what the AI does (it reads, ranks, flags, clips) instead of decorating it with AI clichés.

**Sources:** the hand-drawn mark language and its rules come from **Looseleaf** (kevintngo.github.io/looseleaf). The anti-slop craft rules and the demo-shot rules come from the **Stageshow** skill (benjitaylor/skills). The broadcast discipline comes from esports and sports broadcast packages (Dribbble/Behance research, §11).

---

## 2. Anti-slop rules (hard rules: check every screen against these)

1. **No AI clichés.** No sparkle or star icons, no magic wands, no glowing orbs, no "breathing" listening animations. **Purple is not the AI color**, and we don't use Twitch purple at all (trademark rule).
2. **No decorative gradients, no glassmorphism blur.** Panels are opaque solid ink. A gradient or glow must carry meaning, and nothing in this spec needs one (even the mood line is a plain track, see §6.1).
3. **Emoji are content, never icons.** Emoji may appear in chat text and bot messages. UI icons come from **one icon set: Phosphor** (filled weight at 20px and under, bold weight above). Never hand-drawn icons, never mixed sets.
4. **Meaning never rides on color alone.** Every state also has an icon, a word, a pattern or a shape (red alarm = stamp + word + icon; complaint = icon + label).
5. **One thing is big.** Each surface has one hero element (the #1 topic, the alarm, the clip). Everything else is a step down.
6. **Real words only where the story is.** Labels of 5 words or fewer, no filler copy, no timestamps or IDs on the overlay.
7. **No invented logo.** The wordmark is plain text: `CHAT RADAR` set in the display face. No monogram in a colored square.
8. **Quiet by default, loud only when it matters.** If two things compete for attention, the less urgent one waits.
9. **Every motion has a cause** (a new topic, a count change, an alert). Nothing loops or pulses just to look alive. Idle means still.
10. **Charm is a dial.** The overlay and report get the hand-drawn marks. The dashboard is *calm*: no wobble, no tilt, hairline rules (Looseleaf law 10).

---

## 3. Surfaces and quality bar

| Surface | Route | Audience | Density | Bar |
|---|---|---|---|---|
| Overlay | `/overlay` | Streamer at a glance + viewers | Comfortable (marks on) | **10/10**, the star of the video |
| End-of-stream report | `/report` | Streamer, shared on socials | Comfortable (paper notebook) | **9/10** |
| Dashboard | `/dashboard` | Streamer + mods, second monitor | **Calm** | **8/10**, fast, keyboard-first |
| Bot messages | Twitch chat | Viewers | — | **8/10**, short, human, never spammy |
| Setup | `/` | Streamer, judges | Calm | **7/10**, 3 steps, one screen |

---

## 4. Tokens

All colors, sizes and durations are CSS custom properties in `web/shared/tokens.css`. No literal colors or milliseconds in component CSS.

### Color: five inks, one accent, status colors only for status
| Token | Value | Job (one job each) |
|---|---|---|
| `--ink-0` | `#0B0C0E` | Panel surface (opaque) |
| `--ink-1` | `#16181C` | Raised surface (rows, cards on the dashboard) |
| `--ink-2` | `#2A2D33` | Hairline rules, tracks |
| `--paper` | `#F3EEE4` | Primary text on ink; paper surface on the report |
| `--graphite` | `#A6A299` | Meta text: captions, hints, counts' units (7.7:1 on `--ink-0`) |
| `--marker` | `#FFD83D` | **The accent.** Highlighter, the #1 topic, the one main action |
| `--alarm` | `#FF4A3D` | Broken things only. Always paired with a stamp/icon + word |
| `--ok` | `#38D98A` | Fixed / all good / live |
| `--ink-blue` | `#5AA9FF` | Dashboard only: links, focus rings, things you can click |

Rules:
- Highlighter uses `mix-blend-mode: multiply` on paper (report) and a solid swipe behind text at 85% on ink (overlay), so text stays at full contrast.
- **Overlay contrast** (it gets compressed by video encoding): text under 24px needs at least 7:1; bold text 24px and up needs at least 4.5:1. Everywhere else: 4.5:1.
- **Never put `--paper` text on `--alarm`** (2.9:1). On the alarm red, text is `--ink-0` (5.9:1, so only bold 24px+). Smaller text in an alarm sits on an `--ink-0` band (see §6.3).
- Shadows are short: `0 1px 0 #0006, 0 6px 14px #0005`. Never long gray blurs (Looseleaf law 6).

### Type
| Role | Face | Overlay size @1080p | Dashboard size |
|---|---|---|---|
| Display / wordmark / topic labels | **Space Grotesk** 700 (already in `web/shared/fonts`) | 30px topic, 20px wordmark | 20px |
| Numbers | Space Grotesk 700, `font-variant-numeric: tabular-nums` | 32px | 18px |
| Body / UI | **Inter** 500/600 (already in repo) | 20px minimum | 14–15px |
| Margin notes only | **Caveat** 600 (Google Fonts, OFL; self-host like the others) | 22px | — |

- **Nothing on the overlay under 20px.** Viewers watch on phones at 720p.
- The handwriting face is for short margin notes and stamps only ("+212 since you looked away"). Never for data, never for topic labels.
- Sentence case everywhere except the stamp and the wordmark.
- Text never tilts or jitters. Only paper, stamps and stickers rotate, by up to 2° (Looseleaf law 7).

### Space and shape
- Spacing scale: 4, 8, 12, 16, 24, 32, 48. Words keep a 16px inset from any panel edge on the overlay (12px on the dashboard).
- Radius: 6px panels, 4px rows, full circles only for dots. Nested radius = outer radius − padding.
- Overlay safe area: 48px from every edge of 1920×1080. The panel is 420px wide by default (360px compact).

### Motion tokens (from Looseleaf, all multiplied by `--motion`, which is 0 under reduced motion)
| Token | ms | Use |
|---|---|---|
| `--dur-press` | 90 | Dashboard button press |
| `--dur-hover` | 120 | Hover layers |
| `--dur-fade` | 150 | State layers fading |
| `--dur-pop` | 180 | Tally mark added, chip stamped |
| `--dur-sheet` | 300 | Panel or sticky note settling |
| `--dur-toss` | 440 | Polaroid tossed in |
| `--dur-draw` | 600 | Marker stroke drawing on (circle, underline, highlighter) |
| `--dur-reorder` | 500 | Topic rows swapping places |

Easings:
- `--ease-out: cubic-bezier(0.25, 0.8, 0.25, 1)`: arrivals
- `--ease-travel: cubic-bezier(0.45, 0, 0.1, 1)`: rows moving
- `--ease-settle: cubic-bezier(0.2, 0.9, 0.25, 1.12)`: paper landing (one small overshoot)
- `--ease-pop: cubic-bezier(0.2, 0.9, 0.3, 1.15)`: stamps, tally marks

Motion rules (from Stageshow):
- **Change only what changed.** A count roll animates only the changed digits (last digit first). Unchanged rows don't move.
- Rows reorder with a FLIP animation on `--ease-travel`. Stagger related arrivals by 40–80ms in reading order.
- Paper and stamps get one overshoot. Text and numbers never bounce.
- A payoff (a clip toast, a fixed alarm) holds at least 2s before leaving.
- **No flashing faster than 3 times a second, ever** (photosensitivity). The alarm "pulse" is one slow 2s ring on the strip's edge, not blinking text.
- `prefers-reduced-motion` or `?motion=reduced`: durations go to 0, marks appear fully drawn, and nothing is left half-drawn.

---

## 5. The marks (hand-drawn layer)

Build these as small SVG generators in `web/shared/marks.ts`. Each mark is a **filled path with varying width** (a ribbon), not a uniform stroke (Looseleaf law 1). Each one is **seeded** from the topic or alert id, so the same topic always gets the same stroke and nothing flickers between renders (law 3). Marks draw on with `stroke-dasharray`/`pathLength="1"` over `--dur-draw`.

| Mark | Where | Look |
|---|---|---|
| **Highlighter swipe** | Behind the #1 topic label | `--marker`, slightly wider than the text, ragged ends, offset 2–3px from the text box (law 4: fill is a separate, imperfect layer) |
| **Tally marks** | Next to each topic's count | Groups of 5 (four lines + a slash). One tally = a scaled unit (the unit is shown once in graphite, e.g. "each mark = 50"). Max 4 groups, then the number carries it. New tallies pop in on `--ease-pop` |
| **Circle** | Around an urgent topic (urgency ≥ 0.7) or a question pinned on screen | A loop that overlaps itself at the end, `--alarm` for complaints, `--marker` otherwise |
| **Underline** | Under the mood word when mood shifts | A single wavy ribbon, drawn left to right |
| **Arrow + margin note** | Optional, for a big change ("+212 since you looked away") | Caveat text with a short curved arrow pointing at the row |
| **Stamp** | Alarm (§6.3) | Rectangular rubber stamp, rough inner texture, word in caps |
| **Tape** | Corners of the clip polaroid and sticky notes | Semi-opaque paper-colored strip, 1–2° off |

Budget: at most **2 marks drawing at the same time** on the overlay. If more are queued, they wait.

Implementation notes for the marks library:
- Visible strokes are filled ribbon outlines with pressure variation. A centerline stroke exists only inside an alpha mask to reveal a ribbon; it is not the visible mark.
- Count the drawing budget per ribbon, including each tally. Tally seeds include their index so adding a mark preserves every earlier path. Stop at 20 tallies and keep the exact number beside them.
- On paper, tallies and mood underlines use `--ink-0`; highlighters retain `--marker` with multiply blending. Ink-panel highlighters use 85% opacity.
- Stamp words use Space Grotesk 700, up to 40px and never below 24px. Increase the frame for a longer word rather than squeezing it into unreadable type. Distress is seeded negative space, not an animated noise filter.
- A single draw queue is shared by each surface. Reduced motion completes active and queued ribbons immediately.

---

## 6. Overlay (`/overlay`): the hero

Transparent background, 1920×1080, `pointer-events: none`. Three attention levels:

### 6.1 Calm: the radar panel
```
┌────────────────────────────────────┐  ← opaque --ink-0, 6px radius, 420px wide
│ CHAT RADAR              ● LIVE  SIM │  ← 20px wordmark; SIM only in sim mode
│────────────────────────────────────│
│ Chat is asking                     │  ← graphite zone header, 20px
│ ▓▓▓Play Fortnite next▓▓▓      1,284 │  ← top asking row: highlighter
│  ? Question       ||||/ ||||/ || + │
│ (Can't hear you)                412 │  ← urgent complaint: circle only
│  ! Complaint                 |||| + │
│ When's the collab?              206 │
│  ? Question                   || + │
│ Each mark = 100 · + extra          │  ← applies to asking rows only
│────────────────────────────────────│
│ Chat is reacting                   │  ← graphite zone header, 20px
│ ϟ W stream                   2,692 │  ← slim Inter 600 20px, graphite
│────────────────────────────────────│
│ Mood  hyped  ━━━━━━━━━━●━━━━       │
└────────────────────────────────────┘
```
- Two explicitly named zones separate actionable chat from reactions. **Chat is asking:** questions, requests and complaints only, up to **3 rows** (**2 in compact**), sorted by count descending. Counts never imply a ranking across zones.
- The top asking row gets the highlighter. An urgent complaint (urgency ≥0.7) gets the red circle instead, including at #1. Never both; at most one semantic annotation per row. Asking rows retain Phosphor kind icons (`Question`, `HandPointing`, `WarningCircle`) and right-aligned tabular counts.
- Tallies belong **only to asking rows**. Pick the nice-number unit (10/25/50/100/250/500/1000) from the top asking count, aiming for 2–4 groups. Each stroke represents one complete unit; at most 20 strokes. Show a graphite **+** whenever the exact count has a remainder beyond the drawn full units, including beyond the cap. The shared legend says “Each mark = N · + extra”; the numeric count stays exact. Never let a reaction set this unit or carry tallies.
- **Chat is reacting:** one slim row for the largest reaction count, below a hairline when both zones exist. Filled lightning icon, chat-voice label and count in **Inter 600 20px**, all graphite. No tallies, highlighter or circle. Only changed count digits roll; reaction labels switch without an entrance/reorder animation.
- Hide a zone and its header when empty. Maximum **3 asking + 1 reacting** by default, **2 asking + 1 reacting** in the 360px compact panel. No empty headers or reserved slots.
- Labels remain ≤5 words and ≤22 characters, one line, no truncation mid-word. The top asking label is the hero even when the reaction count is larger.
- The mood line is one neutral track (`--ink-2`) with a `--paper` dot. No red-to-green gradient. The word ("hyped", "confused", "salty") is the meaning.
- **Idle pill:** if chat is under ~2 msg/s for 60s, the panel collapses into a small pill (`CHAT RADAR · quiet`), like Apple's Dynamic Island. It expands again when topics form. Nothing animates while idle.
- When topics are not ready yet: show the pill with "Reading chat…", not a spinner or orb.

### 6.2 Notice: something changed
- **New #1 topic:** rows FLIP-reorder (`--dur-reorder`), then the highlighter draws on behind the new #1 (`--dur-draw`), and the old swipe fades out (`--dur-fade`).
- **Count jumps a lot:** digits roll and tallies pop in. Optionally a margin note appears for 4s ("+212 in 30s").
- **Clip made:** a **polaroid** tosses in at bottom-left (`--dur-toss`, `--ease-settle`, rotated about −2°). It shows the clip's `thumbnail_url` from Twitch, two strips of tape, and the moment title underneath in Inter 600 22px (not handwriting, it has to be read), with "CLIPPED" as a small stamp in the corner. It holds 6s, then slides out. In sim mode the polaroid has no thumbnail; it shows "Moment marked" with a sim badge instead (never a fake thumbnail).

### 6.3 Alarm: something is broken
- **A full-width strip at the top** (inside the 48px safe area), in two bands:
  - **Red band:** solid `--alarm` with `--ink-0` content: a Phosphor icon (`MicrophoneSlash`, `SpeakerSimpleSlash`, `MonitorPlay`, `WifiSlash`…) at 48px and the problem in Space Grotesk 700 40px caps ("CHAT SAYS YOU'RE MUTED").
  - **Ink band** directly under it: `--ink-0` with `--paper` text, a count and one real sample in Inter 20px ("212 people · 'bro we cant hear u'").
- **A stamp** slams onto the right edge of the red band on the first frame (`--ease-pop`, rotated −3°, one overshoot), drawn in `--ink-0`: `MUTED`, `FROZEN`, `NO GAME AUDIO`…
- **It stays until it's fixed.** It's dismissed from the dashboard ("Fixed") or when the complaint rate falls below threshold for 20s. On fix, the stamp swaps to a green `FIXED` stamp, holds 2s, then the strip slides up.
- While the alarm is up, the radar panel stays visible below it but dims to 60%. Only one alarm shows at a time; if a second category fires, it shows as a small count "+1 more" on the strip.

### 6.4 Other overlay elements (Phases 5–6)
- **Pinned question:** a sticky note (`--marker` paper, a tape strip, rotated 1°) with the question in Inter 600 24px and the asker's name in graphite. Hotkey S from the dashboard pins it, and it goes away on "answered".
- **Translated chat:** a lower-third strip, max 2 lines. The original in graphite 18px with a language tag (`ES`, `PT`, `JA`), and the translation in paper 22px. It shows only during a burst of foreign-language chat, not constantly.

### 6.5 URL parameters
`?position=right|left` · `?layout=compact` (360px, 2 asking + 1 reacting) · `?scale=0.75–1.5` · `?motion=reduced` · `?marks=off` (structure only, no hand-drawn layer) · `?theme=paper` (light paper panel for bright games).

---

## 7. Dashboard (`/dashboard`): calm and keyboard-first

The streamer glances at it mid-game. Mods use it with a mouse. **Calm density:** no marks, no tilt, hairline rules, `--ink-blue` for interactive things.

```
┌ CHAT RADAR ── ● LIVE  SIM  ── 38 msg/s ▁▂▅▇▅▃ ── radar 2s ago ── LLM: claude ┐
│ NOW                        │ QUESTIONS (J/K, Enter, S)  │ MOMENTS               │
│ ┌ ALARM: muted · 212  [F]ix┐│ › When's the collab?   ×46 │ 21:04 W in chat  ▶clip│
│ └──────────────────────────┘│   What sens do you use ×31 │ 20:51 Clutch 1v4 ▶clip│
│ Topics                      │   Is this ranked?      ×18 │                       │
│ 1 Play Fortnite next  1,284 │                            │ [Generate report]     │
│ 2 Mic sounds crunchy    412 │                            │                       │
└─────────────────────────────┴────────────────────────────┴───────────────────────┘
  ? shortcuts   F fix alarm   J/K move   Enter answered   S show on stream   M mute radar   R report
```
- **Top status bar:** live/offline, SIM badge, a messages-per-second sparkline, last radar update age, and the active LLM provider. These are facts you need when debugging live.
- **Three columns:** Now (alarm + topics) · Questions queue · Moments. Below 1100px wide they stack: Now first.
- **Hit targets at least 40px.** The streamer is clicking with game adrenaline.
- **Every action has a hotkey** and a `?` cheatsheet overlay. The focus ring is `--ink-blue`, 2px, always visible on keyboard focus.
- Mod suggestions (Phase 6) appear as a card with the suggested action ("Turn on followers-only for 10 min") and a single **Apply** button. It never auto-applies.
- Empty states are plain sentences ("No moments yet. They appear when chat spikes."), not illustrations.

---

## 8. End-of-stream report (`/report`): "Stream Notebook"

This is where the full Looseleaf language lives: **a paper notebook page about the stream**, designed to be screenshotted and shared (like Spotify Wrapped, but handmade).

- **Light paper theme:** `--paper` sheet with a subtle tooth texture, `--ink-0` text, the highlighter multiplied onto the paper.
- **Sections, top to bottom:**
  1. **Header:** channel, date, duration, peak msg/s. **One big number** (total messages read) with tally-style decoration.
  2. **Moments timeline:** a ruled horizontal line across the stream, with taped polaroids of each clip at their timestamps (thumbnail + title + link).
  3. **What chat talked about:** top topics over time as a simple stacked strip per 10-minute block, with the top label hand-circled per block.
  4. **Mood line:** a single hand-drawn ribbon across the stream, with margin notes at the highest and lowest points.
  5. **Unanswered questions:** a sticky note list. This is the "do this next stream" section.
- **Share:** a "Copy image" button (render the page section to PNG) and an "Export markdown" button.
- Data visualizations follow the same rule: one neutral track, the marker for emphasis, labels in words. No rainbow series.

---

## 9. Setup page (`/`)

One screen, three numbered steps, each with a done state (green `--ok` check + the word "Done"):
1. **Connect Twitch** (button → OAuth). Shows the connected channel name when done.
2. **Pick your AI provider** (shows which keys `.env` has; nothing is typed here).
3. **Add the overlay to OBS:** the URL in a copy field, the recommended browser-source size (1920×1080), and a small live preview of the overlay at 25% scale.

Plus a "Try demo mode" secondary button that starts the simulator, so judges can see it working in 10 seconds.

---

## 10. Bot voice (chat messages)

- Short, warm, lowercase-friendly, at most one emoji, never ALL CAPS, never more than one message per trigger.
- `!missed` → `@name here's the last 10 min: …` (≤450 chars).
- Fixed alarm → `thanks chat, audio's back 🎙️`.
- Answered question → `✅ answered: "When's the collab?"`.
- Never reveal internal numbers like confidence scores. Never shame chat.

---

## 11. Research notes and inspiration

**What we saw and decided:**
- **Dribbble "stream overlay":** mostly themed decoration packs (sakura, pixel fairy garden, gold mythology frames). This is what streamers already have and it's pure decoration. **We avoid it.** Our overlay carries live data, not ornament.
- **Dribbble "broadcast graphics":** sports lower thirds (an angled number tag + a name bar, a team lineup board). **We take:** an opaque block with strong alignment, tabular numbers, one accent, and a clear reading order.
- **Dribbble "HUD UI" (game HUDs):** dense, small type, transparent panels. They work in a game but **fail on a compressed stream** viewed on a phone. We take only the edge-anchoring and safe zones.
- **Behance "esports broadcast package":** a single loud accent on black, bold display type, sharp geometry. **We take:** the one-accent discipline (ours is marker yellow).
- **Looseleaf:** every color has one job, states are drawn not just colored, meaning never by color alone, charm is a dial (calm density for data), named motion tokens with reduced motion as one switch, short warm shadows. We borrow the **principles and mark language**, not the React package (our front end is plain TS). If we copy any drawing recipe, keep its MIT license notice.
- **Stageshow:** the anti-slop craft rules in §2, plus the rules for our promo visuals in §12.

**Keep looking at (for the person designing):** F1 TV live timing graphics · NBA/Premier League score bugs · Apple Dynamic Island / Live Activities · Spotify Wrapped · Looseleaf's Principles and Motion pages · Dribbble searches: `broadcast graphics`, `score bug`, `lower third`, `highlighter annotation`, `hand drawn ui`, `sticky note ui`, `polaroid ui`, `tally marks`.

---

## 12. Promo visuals for the README and video (Stageshow)

The demo video's core must be **real footage of Chat Radar working on Twitch**. Stageshow is for the extras:
- **README hero / Devpost thumbnail:** a still faux-UI scene of a stream frame with the radar panel, the #1 topic highlighted and a polaroid tossed in. The poster frame must tell the story on its own.
- **"How it works" insert (10–16s):** chat messages fly into the radar → a topic forms → a tally grows → the stamp lands. 3–5 beats with one payoff, no unexplained motion.
- Install it for Codex in this repo with `npx skills add benjitaylor/skills --skill stageshow`, and follow its own workflow (plan → closest gold example → film → verify).
- Stageshow rules that apply: real words only on the subject, one big number, no invented logo, every motion has a cause, data never rewinds in view.

---

## 13. Before you ship a screen (checklist)

- [ ] Readable at 720p on a phone? (Screenshot the overlay at 1280×720, view it at phone size.)
- [ ] Readable over a bright game and a dark game? (Test over two background screenshots.)
- [ ] One hero element per surface? Nothing else competing?
- [ ] No sparkles, orbs, gradients, glass blur, purple, emoji icons or invented logo?
- [ ] Every state has an icon/word/shape, not just a color?
- [ ] Every motion has a cause, changes only what changed, and nothing flashes more than 3×/s?
- [ ] Reduced motion leaves everything fully drawn and readable?
- [ ] Marks are seeded (same topic → same stroke on every render)?
- [ ] At most 4 topics, labels ≤5 words, no text under 20px on the overlay?
- [ ] Sim mode clearly labeled everywhere it appears?

### Step 3a implementation decisions

- The overlay gets its own DOM renderer (`web/overlay/radar-view.ts`); the dashboard's shared topic renderer and all shared event/data contracts remain unchanged. Pending notice/alarm markup is hidden until its own review step.
- A 1920×1080 logical canvas scales uniformly to the browser-source viewport, retaining the 48px safe area and 420px panel at 1080p. Normal sources remain transparent; only explicit `?bg=bright|dark` loads the two development game screenshots.
- Topic labels are chat-voice phrases, ≤5 words AND ≤22 characters, with no kind/category word. They fit from 30px to a 20px floor in a fixed 264px track, followed by a 16px gutter and 106px right-aligned count track. The swipe covers the entire fitted label. Urgent complaints use a circle instead of a highlighter, including at #1; each row has one semantic annotation, in addition to its data tallies. Tally pigment is ~24px tall (44px SVG viewport), at least 2.5px wide, aligned with the count. The asking-zone unit comes from 10/25/50/100/250/500/1000 using its top count, targeting 10–20 strokes. Low volume shows fewer honest marks; every remainder, including beyond the four-group cap, is explicit with + and the exact numeric count. Reactions have no tallies or semantic marks.
- Mood is schema-enforced as one word (hyped, curious, happy, confused, frustrated, salty, welcoming, neutral); it is no longer shortened in the view. Counts come from validated sampled-entry indices, weighted by observed duplicate frequencies, scaled by window / represented-message coverage, then smoothed locally. Reaction variants merge into one topic. The overlay partitions the existing payload into named asking/reacting zones and sorts within each; the server and public event contracts are unchanged.
- Quiet mode uses existing simulator rate or deduplicated live-chat receipt buckets. It requires 60 continuous seconds below 2 msg/s, wakes on fresh traffic or newly formed topic IDs, and does not wake merely because an unchanged radar snapshot refreshes. Reading/quiet changes are immediate and still; hidden topics do not animate.
- Highlighter reveal masks use butt caps extended beyond the pigment footprint, preventing a rounded zero-length dash from exposing the far end at 0%. Internal streak opacity is 72%: its composite over ink is `#BB9F30`, giving ink text 7.56:1 even if a long label fits below 24px. The main pigment remains 85% (10.23:1 composite contrast).
- `/dev/` is a static local-review route only. Explicit `?review` replays recorded SIM radar payloads from the actual demo pipeline, never writes events or chat, and offers held mid-animation frames. It is omitted from OBS URLs.

- Reorders clip FLIP travel into each occupied rank slot, with temporary aria-hidden outgoing body snapshots filling the slot until the incoming body reaches it. Snapshots keep readable paper labels and omit semantic annotations; SVG IDs are distinct. This prevents crossing text and vacant full slots. Exiting rows collapse their actual height in normal flow before removal, so the panel/footer follow without retained gaps.

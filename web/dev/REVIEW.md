# Step 3b — fixed asking type and producer notices

2026-11-02. Two-zone radar is approved. This review covers the requested fixed-type follow-up and Step 3b only. **Stopped before 3c.**

## What changed

- Every asking label is **26px Space Grotesk 700**, including #1 and urgent complaints. No per-row font fitting or shortening. Whole words wrap onto a second line, adding 36px to the row. A highlighted label gets one seeded swipe per line, with the existing paper/ink reveal layers; one protected circle encloses both lines. Explicit recorded examples include “What's the next game?”, “No audio, you're muted” and “Play Minecraft next”. Compact keeps the full text too, with two asking rows and one reaction.
- Radar prompt prefers **≤20 characters wherever possible**; the existing schema's 22-character/5-word ceiling remains compatible with the approved phrases. Counts, evidence sampling, smoothing and event handling retain their existing behavior.
- The old top swipe withdraws through its shared reveal over `--dur-fade`, leaving readable paper letters as it retreats. Asking rows then FLIP-reorder, and only afterward does the new top swipe/circle draw. Mixed-height transitions cover each rank slot with no overlap; outgoing start positions now handle travel shorter than the destination row height.
- A surviving asking topic gaining at least **100 messages and 35%** receives a **four-second** Caveat 600 22px margin note with the actual delta and radar-update interval. A seeded filled-ribbon curved arrow points toward that row. Its ink backing keeps contrast over either game.
- A **bottom-left polaroid** tosses in over 440ms, holds **six seconds after landing**, then exits over 300ms. Tape and clip stamp are already attached when the paper arrives. Title/save updates update the card without replaying the toss or resetting the timer. Distinct moments queue.
- SIM always displays **“Moment marked” + SIM**, with **no image element**, even if misleading clip fields are supplied. A ready real clip displays its actual Twitch thumbnail and an ink CLIPPED stamp. A missing/failed image has a truthful text state, never a substitute image. Titles are Inter 600 22px.
- All drawing uses one shared **two-ribbon maximum** queue. Scoped finishing avoids completing unrelated surface marks when the radar refreshes. Reduced motion completes the toss and marks immediately while retaining the six-second hold.

## Necessary server / event change

The live clip result previously contained only its URL. Added an optional **`thumbnailUrl`** from the same existing Twitch Get Clips request, validated against HTTPS Twitch CDN families. Existing `clipUrl` helper, fields and stored moments remain compatible. The shared model adds only that optional field; shared connection/topics and dashboard logic are unchanged. Moment storage validates the optional thumbnail.

The existing self-only image policy blocked Twitch images. `img-src` now explicitly permits the same three Twitch CDN domain families. Other CSP directives retain their existing scope. Reference: [Twitch Get Clips](https://dev.twitch.tv/docs/api/reference/#get-clips).

Read the previously verified real clip's metadata and rendered its genuine thumbnail through the live presentation branch, saved in `data/design/notice-review/real-clip.jpg`. The review fixture is `web/dev/live-clip-review.json`. This is an **existing recorded real clip**, with no new broadcast, clip creation or invented live chat spike.

## Full demo evidence

- Complete **10,400/10,400 messages, all five phases** of `scenarios/demo.json`, normal shared local pipeline and configured real provider. No fixture radar events or fake Twitch messages. The read-only observer recorded **18 distinct ready radar updates**, with no error/stale statuses during this run.
- Recorder signals readiness after the first native captures, then the simulator starts. The first capture is **4.415s before run start**. Final recording lasts **150s**, with **76 timestamps × three views = 228 native JPEGs**, plus **three natural intermediate toss frames**. Two-second schedule; maximum start lateness **8ms**.
- Views: **1920×1080 bright**, **1920×1080 dark**, **1280×720 bright**. All clients are ordinary `/overlay/?bg=…` clients connected to live events, without `review` mode. Explicit backgrounds are development-only.
- Source JPEGs, raw events, manifest, extra toss manifest and contact sheets: ignored **`data/design/soak-notice-final/`**. All 228 scheduled captures and all three toss captures were visually inspected. The gallery at **`/dev/soak-gallery.html`** has Radar (228 frames), Polaroid (9), Jump notes (21), and Mid toss (3) views; every preview links to its untouched native capture.
- During recording, **17,983 animation-frame audit ticks** across the three clients found **zero issues**. Checks include fixed 26px/700 asking labels, ≤2 lines, descending asking counts, honest tally decomposition/remainders, unit consistency, no new highlight drawing during reorder, collapsed/occupied/non-overlapping rank slots, full SVG labels, safe text/count gaps, correct reaction styling, one semantic annotation, one-word mood, SIM image exclusion, polaroid title type and global drawing budget.
- Minimum logical label/count gap **32.95px**; minimum tally pigment height **24.08px**; maximum drawing ribbons **2**.
- Polaroid landing/exit times were identical in all three clients: `holdAt=1793653397463`, `exitAt=1793653403464`, hence **6.001 seconds fully landed**. One toss/hold/exit sequence per client, despite the title changing during the hold. SIM title changed from “Hype spike in chat” to “Chat Hypes Despite Audio Issues” without a replay.
- Grounded notes observed: **+383 in 8s**, **+283 in 7s**, **+136 in 8s**. Natural toss captures are `mid-toss-{bright,dark,small}-0.jpg` at about 51.1s. Settled notice frames include `bright-026.jpg`, `dark-027.jpg`, `small-028.jpg`.
- The earlier timing pilot began 13s into the opening phase and is excluded from final evidence (`soak-notice-timing-pilot/`). It passed behavior, but the synchronized recording above is the acceptance capture set.
- Additional explicit recorded-review proofs: `data/design/notice-review/wrapped-26px.jpg` shows both two-line annotations; `compact-reduced.jpg` shows compact wrapping and a fully settled SIM polaroid. Reduced-motion audit: drawing 0, queued 0, ghosts 0, moment phase hold, asking labels 26px.
- Native 720p `small-028.jpg` was also inspected fitted to an **844×475 landscape-phone viewport** (`phone.jpg`). Physical-phone / portrait / OBS acceptance is not claimed.
- `bright-4x.mp4` is a **4× playback of the two-second samples**, not continuous high-frame-rate footage.

## DESIGN §13 — result for 3a + 3b

| Item | Result |
| --- | --- |
| 720p / phone readability | **PASS** in landscape viewport review: radar, SIM badge, polaroid state and Inter title remain legible. |
| Bright and dark backgrounds | **PASS** across the full capture set, including notes and the polaroid. |
| One hero / hierarchy | **PASS**: uniform asking type, top-row mark supplies emphasis; the paper notice is the brief payoff, reactions stay slim graphite. |
| Anti-slop rules | **PASS**: opaque surfaces, Phosphor icons, plain wordmark, no decorative loops/glows/gradients/glass/emoji icons. |
| Meaning beyond color | **PASS**: named zones, kind words/icons, circle/swipe, actual delta, Moment marked + SIM, CLIPPED stamp and mood word. |
| Caused motion / only changes / no flashing | **PASS**: reorder precedes the new mark; count changes cause rolls/tallies/notes; one toss per moment; no idle animation or flashing. |
| Reduced motion | **PASS**: no queued ribbons/ghosts, readable complete two-line marks and landed card; six-second hold retained. |
| Seeded marks | **PASS**: line seeds, circle, tally prefixes, arrow, tape and stamp stable for the same IDs. |
| Topic / label / type limits | **PASS**: 3 asking + 1 reaction, compact 2 + 1; all asking type 26px/700, complete wrapping, schema limits retained. |
| SIM labeling | **PASS**: radar and polaroid explicitly SIM; no SIM image element or false CLIPPED stamp. |

Build and **162 tests pass**. New/expanded checks cover complete label wrapping, mixed-height slot coverage, grounded note thresholds, real/SIM presentation and safe thumbnail URLs, clip thumbnail propagation and the existing regression suite. Full Phase 4, alarm state, remaining URL options, dashboard, setup and OBS acceptance remain pending.

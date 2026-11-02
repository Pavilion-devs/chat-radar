# Step 3a — sustained correction review

2026-11-02. Replaces the earlier single-frame completion claim, which the user's live review correctly reopened. Visual direction is approved; corrected behavior awaits user acceptance. No Step 3b work started.

## What changed

1. Provider labels are ≤22 characters and ≤5 words, in chat's voice, with no question/request/reaction/complaint word. Prompt examples include “Play Minecraft next”, “Can't hear you”, “What's the next game?” and “W stream”. Local validation enforces bounds and forbidden kind words. Reaction variants are merged locally; actionable topics rank first and only one reaction survives.
2. The model returns supporting sample indices instead of counts/quotes. Indices point to deduplicated entries with real observed frequencies. Local counts are `sum(support frequencies) × window total / sum(all sample frequencies)`, rounded, then smoothed 60% new / 40% previous and bounded to the window. Quotes are derived from those same entries. Repeated indices, missing/out-of-range evidence and conflicting topic assignments fail validation. Public event fields are unchanged.
3. Tally ink measures at least 24.07px in the sustained run, rendered through a 144×44 SVG with ≥2.5px widths. White pigment remains readable at 720p. The unit uses 10/25/50/100/250/500/1000, targets 10–20 strokes for #1, is displayed once, and caps at four groups. At fewer than 100 messages, the smallest allowed unit can necessarily yield fewer than two complete groups; marks are not padded or invented.
4. Labels and counts have fixed 264px / 106px tracks with a 16px gutter. Full swipe geometry follows the complete fitted label. Minimum measured text-to-count gap in the final run: 22.48px.
5. Exits collapse in normal flow. FLIP travel is clipped into occupied rank cells with aria-hidden outgoing snapshots; their edges meet the incoming body's edges, preventing blank slots or overprinted text. Old semantic marks are omitted from snapshots. Mathematical regression tests cover both directions and moves of one to three rows.
6. Urgent complaints have a circle only, even at #1. One semantic annotation per live row; count tallies remain separate data marks.
7. Mood is an enum of single words, enforced in schema and local validation.

## Full-run evidence

- Normal `/overlay/?bg=bright` and `/overlay/?bg=dark` clients at 1920×1080, plus a normal bright client at 1280×720. All connected live to the same local WebSocket pipeline; no fixture override, injected radar events or fake Twitch messages.
- Clean complete `scenarios/demo.json`: **10,400/10,400 messages, all five phases**. The configured real Anthropic client produced **20 distinct successful validated radar updates**, zero stale/error updates during the run.
- Capture began 4.206s before the simulator started and ran for **150 seconds**. **76 timestamps × 3 views = 228 native JPEGs**; consecutive timestamps at two seconds, maximum schedule lateness **5ms**. Source screenshots, raw radar snapshots and manifest are in ignored `data/design/soak-3a-final/`.
- **All 228 captures were visually inspected**, including mid-arrival, swaps, exits, digit rolls and trailing window changes, in 19 contact sheets. Browse `/dev/soak-gallery.html`; each sheet has all three views at four successive timestamps. Crop previews normalize scale only for review; native captures remain untouched.
- Continuous animation-frame auditing additionally checks fixed-track gaps, visible active rows, collapsed list space, occupied/non-overlapping transition cells, SVG text bounds, valid snapshot masks, ≤4 live topics, one reaction, one live annotation, one-word mood, ≥20px labels, tally size and ≤2 drawing ribbons. Final audit: **no recorded issues**, minimum gap **22.48px**, minimum tally ink **24.07px**, maximum simultaneous drawing **2**.
- Initial recording pilots had an invalid timer epoch or gaps between batches and are excluded. The first continuous diagnostic pass exposed crossing-row text during visual inspection; that pass is also excluded. The accepted capture set was produced after the occupied-slot fix in one uninterrupted recording call.
- `bright-4x.mp4` is a **4× playback of the two-second capture sequence**, not a claim of continuous high-frame-rate video.

## DESIGN §13

| Check | Result for corrected 3a |
| --- | --- |
| 720p / phone readability | PASS in landscape review; larger white tallies and short complete labels. Portrait-phone / OBS acceptance is not claimed. |
| Bright and dark games | PASS across every captured timestamp. |
| One hero | PASS: highlighter or urgent circle at #1; no double annotation. |
| Anti-slop rules | PASS: opaque ink, one Phosphor set, plain wordmark, no ornamental loops/glow/gradients/emoji icons. |
| Meaning beyond color | PASS: kind words/icons, mood word, SIM badge and reading/quiet wording. |
| Caused motion / changes only / no flashing | PASS: data changes cause rolls/FLIP/marks; occupied clipped transitions and collapsing exits; no idle loop. |
| Reduced motion | PASS: same zero-motion switch, no active/queued ribbons or ghosts, final readable labels/marks. |
| Seeded marks | PASS: seeds/prefixes retained; snapshots have distinct SVG IDs without changing paths. |
| ≤4 topics / label limits / ≥20px type | PASS: schema + local validation + every-frame layout audit. |
| Simulation labeling | PASS: SIM remains visible while simulated data is shown, including reading state during replay. |

Build and **157 tests pass**. This covers schema, sample evidence/frequencies/scaling, reaction consolidation, actionable ranking, unequal/equal grounded counts, per-topic smoothing, nice tally units, FLIP coverage, and existing Twitch/simulator/provider/command regressions. Full Phase 4, notice/alarm/URL options and OBS acceptance remain pending.

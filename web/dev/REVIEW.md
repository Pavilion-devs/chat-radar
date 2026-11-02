# Step 3a — explicit asking / reacting zones

2026-11-02. Labels, counts, tallies, mood and spacing were approved; this review fixes the remaining ambiguity between actionable priority and numeric rank. Zone implementation awaits user acceptance. No Step 3b work started.

## Behavior

- **Chat is asking:** question/request/complaint only; three rows, sorted by count descending. Top row highlighted, except an urgent complaint receives a circle only. Existing fixed label/count tracks and occupied-slot FLIP remain.
- **Chat is reacting:** largest reaction, one slim graphite row below a hairline; filled lightning, label and count in Inter 600 20px. Only count digits roll. No tallies/highlight/circle.
- Empty zones and their headers hide. Compact (`?layout=compact`) is 360px with two asking rows plus one reaction. Other Step 3d parameters remain pending.
- Asking-only unit: nice numbers 10/25/50/100/250/500/1000, fitted to the top asking count. Every tally represents a complete unit, capped at 20 strokes. Visible **+** means extra messages beyond those full units (including beyond the cap). Shared legend: “Each mark = N · + extra”. Exact numeric counts stay visible. Example from this run: 625 = 12 marks × 50 + 25 extra; a reaction of 6,579 has no tallies.
- Outgoing FLIP snapshots take the destination slot's count and tally evidence, avoiding old rank numbers or stale units during a swap. Old semantic annotations stay omitted; mark IDs remain distinct.
- No server, public event contracts, shared connection/model/topics or dashboard changes.

## Full demo verification

- Clean complete `scenarios/demo.json`: **10,400/10,400 messages, all five phases**, normal local pipeline and configured provider. Normal live WebSocket clients (no `review` param) at bright/dark 1920×1080 plus bright 1280×720. No fixture radar events or fake Twitch messages.
- **150 seconds, 76 timestamps × 3 views = 228 native JPEGs.** Two-second schedule; intervals 1,997–2,003ms, maximum lateness 3ms. Includes reading, arrivals, urgent complaint becoming top, digit rolls, unit changes, row exits, raid and reaction-only ending.
- **Every capture visually inspected** in 19 contact sheets. `/dev/soak-gallery.html` links every native full-frame image; previews normalize the panel size for comparison. Source captures, manifest, contact sheets and 4× sampled playback: ignored `data/design/soak-zones-final/`. Prior `soak-3a-final/` is historical, before the zone split.
- Continuous audit: **20,239 animation-frame checks**, no recorded issues across the three clients. Specifically: no asking-zone rank inversions; every tally has `strokes × unit = represented ≤ count`, `represented + remainder = count`, and visible + iff remainder > 0; legend matches each row; no reaction tallies/annotations; correct Inter 600 20px reaction and filled lightning; hidden empty asking header; row collapse/slot coverage; no label collisions or clipping; one-word mood; one semantic annotation; ≤2 drawing ribbons.
- Minimum logical text/count gap **22.48px**, minimum tally pigment height **24.08px**, maximum drawing ribbons **2**. Asking counts 1,198 / 495 remained ordered while the separate reaction reached 6,043; later a 457 question and a 5,459 reaction occupy explicitly different zones. Asking header and unit disappear completely in the reaction-only ending.
- Pure tests cover shuffled inputs, largest-reaction selection, asking-only kinds, 3/2 limits, empty zones, unit independence from reaction volume, and exact tally decomposition at low volume and above the cap. Existing engine tests retain grounded count/evidence/smoothing coverage.
- The auxiliary raw-event recorder disconnected during the clean restart and contains only the initial waiting snapshot. It is **not used as proof of provider success counts**. The native captures and DOM-audit manifest document this run; `calm-capture.json` intentionally remains the prior actual-demo payload fixture for explicit held-frame review.
- `bright-4x.mp4` is a 4× playback of two-second samples (76 frames, 38s), not continuous high-frame-rate video. Natural mid-animation frames include `*-022.jpg` (FLIP), `*-034.jpg` / `*-070.jpg` (digits), `*-058.jpg` (swipe).

## DESIGN §13 — this 3a review

| Check | Result |
| --- | --- |
| 720p / phone readability | PASS: native 1280×720, also inspected fitted to an 844×475 landscape-phone viewport (`phone.jpg`). Physical-device/portrait and OBS acceptance not claimed. |
| Bright and dark games | PASS: all 76 timestamps in both backgrounds. |
| One hero | PASS: the top asking topic; reaction remains slim graphite even with a larger number. Urgent top row has circle only. |
| Anti-slop rules | PASS: opaque ink, one Phosphor set, plain wordmark, no ornamental loops/glow/gradients/emoji icons. |
| Meaning beyond color | PASS: named zones, kind icons/words, explicit remainder + and legend, mood word, SIM and reading/quiet words. |
| Caused motion / changes only / no flashing | PASS: FLIP/roll/marks caused by data; reaction count roll only; no idle loop. |
| Reduced motion | PASS: zero active/queued ribbons and no ghosts after changing the review motion switch; readable final state. |
| Seeded marks | PASS: original seeds/prefixes retained; snapshots get unique SVG IDs without changing paths. |
| ≤4 topics / label limits / ≥20px | PASS: 3 asking + 1 reacting; compact 2 + 1. Labels ≤22 characters/5 words; compact uses whole-word shortening where needed. |
| Simulation labeling | PASS: SIM visible while simulated content appears, including reading and reaction-only states. |

Build and **159 tests pass**. DESIGN §6.1 diagram/rules, compact rules, PLAN and NOTES updated. Full Phase 4 and notice/alarm/remaining URL options/dashboard/setup/OBS acceptance remain pending.

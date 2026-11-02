# PLAN.md: Chat Radar

> **Hackathon:** Codex x TwitchCon (Devpost). **Deadline: Nov 2, 2026, 2:00 pm PT.**
> **Must:** connect to Twitch, be built with OpenAI Codex (submit the session ID), include a public repo with run instructions, and a YouTube demo video of 3 minutes or less showing it working **on Twitch** and **how Codex was used**.
> **Judging:** Innovation · Potential impact · Technical implementation + use of Codex · Design (easy to use, fun to watch).

## 1. Problem
On big streams (Kai Cenat, IShowSpeed, Jynxzi…) chat moves thousands of messages a minute. Streamers say it on stream all the time: *"chat, you're moving too fast."* As a result:
- Questions and requests get buried.
- Chat spots problems (muted mic, frozen stream, game audio too loud) minutes before the streamer does.
- Great moments go unclipped, and editors have to dig through 8-hour VODs.
- Viewers who join late have no idea what's going on.
- International chat goes unread.

## 2. Product
**Chat Radar** is a live co-pilot that turns a flood of chat into a glanceable overlay and a streamer dashboard.

**One line:** *"Never miss your chat again."*

### Features, by priority
| # | Feature | Priority | Shown in demo |
|---|---|---|---|
| 1 | **Topic radar**: top live topics with counts and a mood meter | P0 | ✅ |
| 2 | **Tech-problem alerts**: "🔇 CHAT SAYS YOU'RE MUTED" within ~2 s | P0 | ✅ |
| 3 | **Hype detector → auto-clip** through the Twitch Clips API | P0 | ✅ |
| 4 | **`!missed`**: 10-minute recap posted in chat for late joiners (plus `!radar`) | P0 | ✅ |
| 5 | **Question queue** with dashboard hotkeys; the bot confirms answers | P1 | quick cut |
| 6 | **Translation** of foreign-language chat, fed into the radar | P1 | quick cut |
| 7 | **Raid/hate-flood guard**: mod alert with suggested actions (human applies) | P2 | quick cut |
| 8 | **End-of-stream report**: moments, clips, topics over time, mood, unanswered questions | P2 | quick cut |

P0 must be solid and polished before P1/P2 starts.

## 3. Architecture

```
Twitch chat ──EventSub WebSocket (channel.chat.message)──┐
Chat simulator (local only, flagged sim:true) ───────────┤
                                                          ▼
                                  Ingest → normalize → ring buffer (15 min)
                   ┌───────────────┬───────────────┬───────────────┬───────────────┐
              techAlerts       topicRadar        hype            commands        extras
            (rules, <2 s;   (LLM every       (rate z-score →  (!missed,       (questions,
             LLM confirm     ~8 s, structured  Clips API +     !radar)         translate,
             optional)       output)           title)                          raid, report)
                   └───────────────┴───────┬───────┴───────────────┴───────────────┘
                                           ▼  event bus → WebSocket hub
                   /overlay (OBS browser source, transparent, 1920×1080)   /dashboard (streamer/mod UI)
```

### Twitch integration
| Need | API | Scope |
|---|---|---|
| Read chat | EventSub WebSocket `channel.chat.message` | `user:read:chat` for this local user-token flow (`user:bot`/`channel:bot` apply to an app-token/cloud bot flow) |
| Send chat | `POST /helix/chat/messages` | `user:write:chat` |
| Create clips | `POST /helix/clips?broadcaster_id=` then poll `GET /helix/clips?id=` | `clips:edit`. **Only works while live** |
| Stream state | `GET /helix/streams`, EventSub `stream.online` / `stream.offline` | none |
| Raids (P2) | EventSub `channel.raid` | none |
| Mod actions (P2, human-applied) | `PATCH /helix/chat/settings` | `moderator:manage:chat_settings` |

OAuth: authorization code flow, redirect `http://localhost:3000/auth/callback`. Tokens go in `.tokens.json` and refresh automatically.

### Env (`.env.example`)
```
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_CHANNEL=            # broadcaster login name
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
LLM_PROVIDER=anthropic
LLM_MODEL=claude-haiku-5-5
LLM_TIMEOUT_MS=30000
ANTHROPIC_API_KEY=
OPENAI_API_KEY=            # used only with LLM_PROVIDER=openai
PORT=3000
```

### Event types (server → clients over WebSocket)
`chat` (sampled) · `command_reply {command, text, sim, status, source, cached}` · `radar {topics, mood}` · `alert {category, count, sample}` · `alert_cleared` · `moment {ts, title, clipUrl, peakRate}` · `question_queue` · `translation` · `raid_warning` · `status {live, sim, rate}`

---

## 4. Phases

### Phase 1: Foundation
- [x] TS project, scripts (`dev`, `build`, `test`, `sim`, `demo`), `.gitignore` (`.env`, `.tokens.json`, `node_modules`)
- [x] Express + WebSocket hub; static `/overlay` and `/dashboard`
- [x] Twitch OAuth (`/auth/login`, `/auth/callback`), token storage and refresh
- [x] EventSub WebSocket client: subscribe `channel.chat.message`, keepalive, reconnect, session_reconnect
- [x] Normalize to `{id, user, text, ts, badges, sim}` → ring buffer + event bus
- [x] `sendChat(text)` helper with rate limiting
- [x] README setup section

**Implementation status:** Engine and minimal verification viewer implemented. Dashboard design stays in Phase 4. Automated checks pass; these do not substitute for Twitch acceptance.

- [x] Live acceptance (2026-11-02): owner authorized `olaboye7`; a genuine message typed in Twitch chat appeared on `/dashboard` with a displayed timestamp age of 16 ms, and `!ping` received `@olaboye7 pong!` in Twitch. This is the viewer’s timestamp-based measurement, not a clock-calibrated benchmark. **Historical user exception (2026-11-01): proceeded to Phase 2 while Twitch setup was deferred; now resolved.**

**Done when:** a real message typed in Twitch chat shows up on `/dashboard` within 1 s, and `!ping` gets a reply from the bot.

### Phase 2: Chat simulator
- [x] `src/sim/`: replays scenario timelines into the local pipeline at a set rate (e.g. 40 msg/s)
- [x] `scenarios/demo.json` phases:
  1. Hype, emotes, questions about the "next game"
  2. A burst of "no audio / ur muted / cant hear u / sin audio"
  3. A huge "W / LMAOOO / CLIP IT" spike
  4. Mixed Spanish / Portuguese / Japanese / Arabic messages
  5. A raid flood (for the P2 demo)
- [x] The dashboard shows a "SIM" badge whenever simulated messages are flowing

**Done when:** `npm run demo` replays all five scenario phases through the shared ingest/buffer/event bus/WebSocket path with no viewers or credentials, and SIM status is shown while replay runs and cleared afterward. Feature-specific detector firing is verified in Phase 3 and later, when those consumers exist. (Clarified dependency: those features are not implemented in Phase 2.)

### Phase 3: P0 features

**Current scope:** all Phase 3 P0 engine features are implemented and locally verified, including real Anthropic topic, title, and recap generation with the selected `claude-sonnet-5` model. Twitch is authorized and real message delivery, `!ping`, `!radar`, and `!missed` are verified on `olaboye7`. A real 30-second clip was created through the existing clip helper during an authorized test broadcast and played successfully in Twitch. Automatic triggering from a genuine multi-user chat spike remains unverified. Stage-ready dashboard/overlay design remains Phase 4.
- [x] **techAlerts:** multilingual keyword/fuzzy rules per category (audio_muted, game_audio_loud, frozen/lag, black_screen, wrong_scene, mic_peaking). 30 s sliding window. Fires when both a unique-user minimum and a share-of-chat threshold are met. Cooldown per category. Dashboard "Fixed ✅" clears it and the bot thanks chat. Unit tests.
- [x] **topicRadar:** every ~8 s, sample ≤300 deduplicated entries from the last 60 s with observed frequencies. Provider output is `{topics:[{label≤5 words/22 characters in chat’s voice, kind, message_indices, urgency}], mood:{single-word enum, score}}`. Validate evidence indices, merge reaction families, derive counts/quotes locally, scale by represented-message coverage and smooth 60% new / 40% prior. Actionable topics rank ahead of at most one reaction. Public radar event fields stay unchanged; last good state survives errors.
- [x] **LLM layer:** provider-neutral structured-generation interface, shared radar prompt/validation, OpenAI Responses and Anthropic Messages adapters, explicit `.env` selection, normalized usage and errors. Anthropic is the default; no implicit provider fallback.
- [x] Selected-provider acceptance: configured Anthropic `claude-sonnet-5` completed the full 10,400-message demo with 12 successful validated topic/mood updates and zero failed updates. Token usage was logged. Larger default-effort requests exceeded the old ten-second deadline; low-effort radar requests and a configurable 30-second deadline resolved this. Prior OpenAI `insufficient_quota` remains historical and does not block Anthropic.
- [x] **hype:** messages/s and unique chatters/s, EWMA baseline, z-score spike with 60 s cooldown. Creates a clip when live; when not live, records a moment marker. LLM writes a 3–6 word title. Moments are saved to `data/moments.json`.
- [x] Live Clips API acceptance (2026-11-02): at the owner’s request, broadcast a silent Chat Radar test card, invoked the existing `TwitchClipper.create` helper once, and verified a [real 30-second clip](https://www.twitch.tv/olaboye7/clip/EphemeralExcitedGoldfishBlargNaut-L3y6n3ANwK6jfWCT) played through in Twitch. The test broadcast was stopped and the channel confirmed offline afterward. This was a manual helper invocation, with no invented chat spike.
- [ ] Genuine-chat spike acceptance: verify that a real multi-user chat spike automatically creates a playable clip through the complete hype pipeline. Local detector/service integration is automated-test coverage; the manual live helper check does not establish this remaining field check. Simulated spikes always remain local markers. LLM titles label local moments; Twitch supplies its default clip title.
- [x] **commands:** `!missed` gives a recap of 450 characters or fewer from radar history + moments + sampled messages, @mentions the user, 60 s per-user and 10 s global cooldowns, cached for 20 s. `!radar` gives the top 3 topics.

- [x] Live command acceptance (2026-11-02): `!radar` and Anthropic-generated `!missed` were sent and observed in real Twitch chat, correctly mentioning `@olaboye7`, at 73 and 207 characters. Repeated case-insensitive requests within the 60-second viewer cooldown produced no extra replies. Shared cooldown and multi-user cache behavior remain covered by automated tests.

**Done when:** in demo mode, each P0 feature fires correctly on cue from the scenario, and on a live channel a real clip URL is created.

### Phase 4: Overlay and dashboard design (stage-ready)
**Follow `DESIGN.md`.** It replaces the earlier glass-panel/emoji-toast idea. The current overlay CSS (gradient glass panel, mint glow, breathing orb) breaks its anti-slop rules and gets rebuilt.
- [x] Tokens (`web/shared/tokens.css`): colors, type, spacing, motion durations/easings, reduced motion (DESIGN §4). Step 1 approved by the user; updated to the revised 20px wordmark, `--graphite: #A6A299`, and size/weight-dependent contrast thresholds. All five approved review pairs pass at `/shared/token-review.html`. Caveat and Phosphor remain self-hosted.
- [x] Marks library (`web/shared/marks.ts`): all six seeded filled-ribbon marks approved. Fixed the remaining 0% swipe end-cap leak; the final state still reveals the entire cap. Polaroid title verified as Inter 600 22px. Shared queue caps drawing ribbons at two.
- [x] Overlay calm state (Step 3a zone correction implemented; user acceptance pending): named **Chat is asking** (3 actionable rows, count descending) and **Chat is reacting** (largest reaction, slim Inter 600 20px, digit roll only) zones; empty zones hidden. Compact is 2 asking + 1 reacting at 360px. Asking-only adaptive tallies show + for remainders/caps; outgoing FLIP snapshots use destination counts/tallies. Full 10,400-message demo verified again: 228 native captures every two seconds over 150 seconds, every capture visually reviewed, no continuous audit issues or within-zone rank inversions. Build and 159 tests pass. Evidence in `web/dev/REVIEW.md`. Stopped before 3b.
- [ ] Overlay notice state: margin note, clip polaroid with the Twitch thumbnail; review new-#1 sequencing and count-jump behavior (DESIGN §6.2). Basic digit rolls were implemented in 3a at the user's request.
- [ ] Overlay alarm state: top strip + stamp, persists until fixed, FIXED stamp on clear (DESIGN §6.3)
- [ ] URL params: `position`, `layout`, `scale`, `motion`, `marks`, `theme` (DESIGN §6.5)
- [ ] Dashboard: calm, three columns, status bar with sparkline, hotkeys + `?` cheatsheet (DESIGN §7)
- [ ] Setup page at `/` with demo-mode button (DESIGN §9)

**Review status:** Steps 1 and 2 and 3a's labels/counts/tallies/mood/spacing and visual direction are approved. The user's remaining ranking ambiguity is addressed with explicit asking/reacting zones and another complete sustained capture review at `/dev/soak-gallery.html`. Awaiting the user's 3a zone review. The live overlay remains `/overlay/?bg=bright`; review fixtures do not override its events. Notice, alarm, remaining URL options, dashboard and setup remain unchecked. Only `layout=compact` was brought forward to satisfy this review; full Phase 4 / OBS acceptance is not complete.

**Done when:** every item in the DESIGN.md §13 checklist passes, it reads well at 720p on a phone over both a bright and a dark game screenshot, and it looks good at 1080p in OBS.

### Phase 5: P1 features
- [ ] **Question queue:** extract questions, merge similar ones, rank by how often they repeat. Hotkeys: J/K move, Enter = answered (the bot posts "✅ answered: …"), S = show on overlay.
- [ ] **Translation:** cheap language heuristic → batched LLM translation → "🌍 translated chat" strip on the overlay. Translations feed into the radar.

### Phase 6: P2 features
- [ ] **Raid/flood guard:** `channel.raid` + new-account/repeated-toxic-message flood detection → a mod-only dashboard alert with suggested actions (followers-only, slow mode, emote-only) applied only by a human click.
- [ ] **End-of-stream report:** on `stream.offline` or a dashboard button, a `/report` page with a timeline of moments + clips, topics over time, a mood graph and unanswered questions. Also exported as markdown.

### Phase 7: Submission polish
- [ ] README: problem, features, GIFs/screenshots, architecture, setup (Twitch app, scopes, .env), live + sim usage, costs, limitations, **How we used Codex**
- [ ] `NOTES.md` complete (Codex build log)
- [ ] Clean install test: clone → `npm i` → `.env` → `npm run demo` works

---

## 5. Demo video (3:00 max)
| Time | Shot |
|---|---|
| 0:00–0:12 | Hook: streamer quotes or tweet screenshots ("chat you're moving too fast"). *No copyrighted video clips without permission.* "Every big streamer has the same problem." |
| 0:12–0:25 | A wall of scrolling chat → title card **Chat Radar** |
| 0:25–0:55 | Live on Twitch with the overlay in OBS. The simulator ramps up. The radar sorts itself, mood moves. Say "real Twitch chat + simulated volume" |
| 0:55–1:20 | Mute the mic → "no audio" flood → red banner in under 2 s → Fixed → the bot thanks chat |
| 1:20–1:45 | Hype spike → "🔥 CLIPPED" toast → open the real Twitch clip |
| 1:45–2:05 | A second account types `!missed` → recap in chat |
| 2:05–2:25 | Fast cuts: question queue, translated chat, raid guard, report |
| 2:25–2:50 | How we built it with Codex: the thread, prompts, tests, the architecture diagram |
| 2:50–3:00 | "Never miss your chat again." + repo link |

## 6. Devpost description outline
Inspiration · What it does · How we built it (Twitch EventSub + Helix Chat/Clips, provider-neutral structured LLM outputs, OBS overlay, **built with Codex**, session ID) · Challenges · Accomplishments · What we learned · What's next.

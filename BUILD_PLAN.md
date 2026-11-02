# Chat Radar — Build Plan (Codex x TwitchCon Hackathon)

> Working name: **Chat Radar**. Rename it whenever you like.
> **Deadline:** Nov 2, 2026, 2:00 pm PT. Do most of the build in **one Codex thread**, because you submit that thread's session ID (run `/status` in Codex to see it).

**One line:** At 50k viewers chat is unreadable. Chat Radar turns the flood into a live overlay the streamer can read at a glance: what chat wants, what's broken, and what just went viral.

---

## Submission checklist
- [ ] GitHub repo with all source code, a README and setup steps (public, or private and shared with testing@devpost.com)
- [ ] YouTube video, **3 minutes or less**, public, showing it working **on Twitch** and **how you used Codex**
- [ ] Project description: features, how it works, how Codex was used
- [ ] Codex session ID
- [ ] No copyrighted clips without permission. Use quotes or tweet screenshots in the intro.

## Judging, and how we cover each one
| Criterion | How we cover it |
|---|---|
| Innovation | Not a chat summarizer: it gives live alerts, auto-clips and a recap for viewers |
| Impact | A problem every big streamer complains about out loud |
| Tech + Codex | EventSub, Helix Chat API, Clips API, live overlay, OpenAI. Show Codex at work in the video |
| Design / fun | A polished overlay, readable at a glance, that looks good on the TwitchCon stage |

---

## Architecture

```
Twitch chat ──EventSub WebSocket (channel.chat.message)──┐
Chat simulator (demo mode) ──────────────────────────────┤
                                                          ▼
                                       Node/TS server: message buffer
                     ┌──────────────┬──────────────┬──────────────┬──────────────┐
                Tech alerts      Topic radar     Hype detector    Commands      Extras
              (fast rules +    (OpenAI, every   (msgs/sec spike  (!missed,     (translate,
               LLM confirm)     ~8–10 s)         → Clips API)     !radar)       raid, queue)
                     └──────────────┴──────┬───────┴──────────────┴──────────────┘
                                           ▼ WebSocket
                     ┌─────────────────────┴─────────────────────┐
              /overlay (OBS browser source)          /dashboard (streamer control panel)
```

**Stack:** Node.js + TypeScript, `ws`, Express, the OpenAI API (it's an OpenAI hackathon, so use OpenAI models), and plain HTML/CSS/JS for the overlay (or Vite + React if you prefer).

**Twitch pieces:**
- EventSub WebSocket: `channel.chat.message` (scope `user:read:chat`, plus `channel:bot` if a separate bot account is used)
- Send Chat Message API, `POST /helix/chat/messages` (scope `user:write:chat`)
- Create Clip API, `POST /helix/clips` (scope `clips:edit`). **This only works while the channel is live.**
- Optional: `channel.raid` and `channel.follow` EventSub for the raid alert

---

## Phases: build in this order

### Phase 0: Setup (do this yourself before Codex)
1. Create a Twitch app at dev.twitch.tv/console. Set the redirect to `http://localhost:3000/auth/callback`.
2. Pick the channel you will stream on. A second Twitch account for the bot is optional.
3. Get an OpenAI API key.
4. Create an empty GitHub repo and open it in Codex.

### Phase 1: Core pipeline
Chat comes in, gets buffered, and reaches the overlay. The simulator lets you demo at "Kai Cenat scale" without a big audience.

### Phase 2: The 4 demo features (finish and polish these first)
1. **Topic radar:** the top 3–5 live topics with counts, updated every ~8 s
2. **Tech-problem alert:** "🔇 CHAT SAYS YOU'RE MUTED" flashes within ~2 s
3. **Hype detector → auto-clip:** a spike in messages per second creates a Twitch clip and adds a moment marker
4. **`!missed`:** a recap of the last 10 minutes in 500 characters or fewer, posted in chat

### Phase 3: Make the overlay look great
Motion, readable type, a dark theme, and a layout that works at 1080p in OBS.

### Phase 4: Extra features (build and test after Phase 3)
5. Question queue with hotkeys on the dashboard (mark answered, and the bot replies in chat)
6. Inline translation of foreign-language chat
7. Raid alert for mods (flood detection, with suggested actions a mod confirms)
8. End-of-stream report (moments, clips, unanswered questions, how chat's mood changed)

### Phase 5: Submission
README, screenshots, the video and the description.

---

## Codex prompts (paste them in order, in ONE thread)

### Prompt 1: Scaffold + Twitch auth + chat ingest
```
We're building "Chat Radar" for the Codex x TwitchCon hackathon: a live co-pilot for big Twitch
streamers whose chat moves too fast to read. It reads chat via EventSub, analyzes it, and pushes
results to an OBS browser-source overlay and a streamer dashboard.

Set up a Node.js + TypeScript project:
- Express server on :3000, a WebSocket hub for overlay/dashboard clients, .env config
  (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL, OPENAI_API_KEY).
- Twitch OAuth (authorization code flow) at /auth/login and /auth/callback with scopes
  user:read:chat user:write:chat clips:edit moderator:read:followers; store/refresh tokens in a local JSON file.
- Connect to EventSub WebSocket (wss://eventsub.wss.twitch.tv/ws), subscribe to channel.chat.message,
  handle keepalive/reconnect.
- Normalize every message into {id, user, text, ts, badges} and push into an in-memory ring buffer
  (last 15 minutes).
- A helper sendChat(text) using POST /helix/chat/messages.
- Serve /overlay and /dashboard as static pages that connect to the WebSocket and log events.
Add a README with setup steps. Keep modules small: twitch/, analysis/, server/, web/.
```

### Prompt 2: Chat simulator (demo mode)
```
Add a chat simulator so we can demo at 50k-viewer scale on a small channel.
- `npm run sim -- --rate 40 --scenario scenarios/demo.json` injects fake messages straight into the
  same ring buffer/pipeline (NOT posted to Twitch — no spam accounts).
- A scenario is a timeline of phases: e.g. 0–20s random hype/emotes + questions about "next game",
  20–35s burst of "no audio / ur muted / cant hear u", 35–50s huge "W"/"LMAO" spike, mixed with
  some Spanish/Portuguese/Japanese messages. Write that demo.json.
- Simulated messages should be flagged so the dashboard can show "SIM" mode honestly.
Real Twitch chat and simulated chat must flow together.
```

### Prompt 3: Tech-problem alerts
```
Add analysis/techAlerts.ts.
- A fast rules layer (regex + fuzzy keywords, multilingual-ish: "muted", "no audio", "cant hear",
  "mic", "frozen", "lag", "buffering", "black screen", "game audio loud", "sin audio") tracked per
  category in a 30s sliding window.
- Fire an alert when a category passes a threshold (min unique users AND share of recent chat),
  with a cooldown, and emit {type:"alert", category, count, sample} over the WebSocket.
- Optional LLM confirm step for borderline cases (OpenAI, small fast model), never blocking the
  fast path. Target: alert appears < 2s after the burst starts.
- Dashboard button "Fixed ✅" dismisses the alert; bot posts "Thanks chat, fixed!".
Write unit tests for the threshold/cooldown logic.
```

### Prompt 4: Topic radar
```
Add analysis/topicRadar.ts.
- Every 8s, take the last ~60s of messages (sample up to 300, dedupe spam/emote-only),
  send to OpenAI with a structured-output JSON schema:
  topics: [{label (≤5 words), kind: question|request|reaction|complaint, count_estimate,
  example_messages[2], urgency 0–1}], mood: one word + score -1..1.
- Merge with previous topics so labels stay stable (don't flicker); smooth counts.
- Emit {type:"radar", topics, mood}. Handle API errors gracefully (keep last good state).
- Log token usage; keep cost low.
```

### Prompt 5: Hype detector + auto-clip
```
Add analysis/hype.ts.
- Track messages/sec and unique chatters/sec; compute rolling baseline (EWMA) and z-score.
- When a spike crosses threshold (with cooldown 60s): call POST /helix/clips?broadcaster_id=...
  to create a clip (only when live; handle 404/not-live gracefully), then poll GET /helix/clips?id=
  until ready. Ask OpenAI for a 3–6 word title for the moment from the spike's messages.
- Store moments {ts, title, clipUrl, peakRate} and emit {type:"moment"}.
- Overlay shows a short "🔥 CLIPPED: <title>" toast; dashboard lists all moments with links.
```

### Prompt 6: !missed command
```
Add commands/missed.ts.
- When a viewer types !missed, summarize the last 10 minutes (use radar history + moments + a
  sample of messages) into ≤ 450 chars, friendly, no slurs/PII, and reply via sendChat, @mentioning
  the user. Per-user cooldown 60s, global cooldown 10s. Cache the recap for 20s.
- Also !radar → posts current top 3 topics.
```

### Prompt 7: Overlay design pass
```
Make /overlay look stage-ready for TwitchCon (OBS browser source, 1920x1080, transparent bg).
- Right-side panel: "CHAT RADAR" header, live mood meter, top topics as animated bars with counts
  (smooth reorder animations), kind icons.
- Alerts: full-width top banner, red, pulsing, large icon + text, impossible to miss.
- Moments: bottom-left toast with clip title.
- Bold readable type (e.g., Inter/Space Grotesk via Google Fonts), high contrast, subtle glass
  background. Add ?layout=compact and ?position=left|right URL params.
- Dashboard (/dashboard): dark UI with alert controls, topic list, moments list, sim toggle,
  keyboard shortcuts.
```

### Prompt 8+: Extras (one prompt each)
```
Question queue: extract the best questions (dedupe similar, rank by upvotes = repeat count) into a
queue on the dashboard. Hotkeys: J/K to move, Enter = mark answered (bot posts "✅ answered: <q>"),
S = show the current question on the overlay.
```
```
Translation: detect non-English messages (cheap heuristic first, LLM confirm), translate in batches,
show a "🌍 translated chat" strip on the overlay and include translated content in radar analysis.
```
```
Raid/hate-flood guard: subscribe to channel.raid; detect floods of new accounts / repeated toxic
messages; show a mod-only dashboard alert with suggested actions (enable followers-only, slow mode)
that a human must click to apply. Never auto-ban.
```
```
End-of-stream report: on stream.offline (or a dashboard button), generate a report page with
timeline of moments + clips, top topics over time, unanswered questions, mood graph. Export as
markdown too.
```

### Final prompt: README + polish
```
Write a strong README: problem, features with screenshots/GIF placeholders, architecture diagram,
setup (Twitch app, scopes, .env), how to run live + simulator, cost notes, limitations,
and a "How we used Codex" section. Add `npm run demo` that starts server + sim scenario.
```

**Tips for working in Codex**
- After each prompt, run it, test it, and commit. Tell Codex about any errors in the same thread.
- Keep a `NOTES.md` of what Codex did. You'll need it for the "how you used Codex" part.
- Screen-record a few Codex moments while you build, to use in the video.

---

## Demo video script (3:00 max)

| Time | What's on screen |
|---|---|
| 0:00–0:12 | **Hook.** Fast montage of streamer quotes or tweets on screen ("chat you're moving too fast", "chat I can't read this"). Text: *"Every big streamer has the same problem."* |
| 0:12–0:25 | **The problem.** A wall of chat scrolling. Text: *"50,000 messages. One streamer."* Then the title card **Chat Radar**. |
| 0:25–0:55 | **Radar.** Live on your Twitch channel with the overlay in OBS. Simulator ramps up. Topic bars sort themselves, mood meter moves. Point out "real Twitch chat + simulated volume". |
| 0:55–1:20 | **Mute alert.** You mute your mic. Chat floods "no audio". The red banner fires within 2 s. Click "Fixed" and the bot thanks chat. |
| 1:20–1:45 | **Auto-clip.** A hype moment, then the "🔥 CLIPPED" toast. Open the real Twitch clip URL. |
| 1:45–2:05 | **`!missed`.** A friend's account types `!missed` and gets the recap in chat. |
| 2:05–2:25 | **Quick extras.** Question queue hotkeys, translated chat strip, end-of-stream report (fast cuts). |
| 2:25–2:50 | **How we built it with Codex.** Screen recording of the Codex thread, prompts, tests, architecture diagram. |
| 2:50–3:00 | **Close.** *"Never miss your chat again."* Repo link. |

**Recording tips:** stream to your own channel and capture with OBS. Have a friend or a second account chatting for real so it's clearly on Twitch. Turn on a "SIM" badge on the dashboard so the simulated volume is labeled.

---

## Project description template
**Inspiration:** Big streamers (Kai Cenat, IShowSpeed, Jynxzi…) constantly say "chat, you're moving too fast." At scale, chat stops being a conversation.
**What it does:** live topic radar, tech-problem alerts, hype detection that clips automatically, `!missed` recaps, a question queue, translation, a raid guard, and end-of-stream reports.
**How we built it:** Node/TS, Twitch EventSub + Helix (Chat, Clips), OpenAI structured outputs, and an OBS browser-source overlay, built in OpenAI Codex (session ID: …).
**Challenges / what we learned / what's next:** fill these in after the build.

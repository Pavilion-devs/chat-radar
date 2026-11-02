# Devpost submission draft: Chat Radar

**Tagline:** Never miss your chat again. A live co-pilot that turns a flood of Twitch chat into an overlay a streamer can read at a glance.

## Inspiration
Every big streamer says it on stream: *"chat, you're moving too fast."* At 50,000 viewers, chat stops being a conversation:
- Questions get buried.
- Chat notices the mic is muted minutes before the streamer does.
- Great moments go unclipped.
- Viewers who join late have no idea what's happening.

We wanted to give streamers a producer who reads every message for them.

## What it does
Chat Radar reads Twitch chat live and marks it up like a producer with a marker:
- **Topic radar overlay (OBS browser source).** It splits chat into **"Chat is asking"** (questions, requests, complaints) and **"Chat is reacting"** (hype). Labels are in chat's own words ("What's the next game?", "Play Minecraft next"). Counts are grounded in real messages. The #1 ask gets a hand-drawn highlighter, urgent complaints get circled, and tally marks show volume.
- **Tech-problem alerts.** When chat floods "no audio" or "you're muted", a can't-miss alarm with a rubber stamp appears in about 2 seconds and stays until the streamer marks it fixed. The bot then thanks chat.
- **Hype detector → auto-clip.** A spike in chat activity creates a real Twitch clip through the Clips API and saves the moment.
- **`!missed` and `!radar` chat commands.** Late joiners get an AI recap of the last 10 minutes in chat.
- **Streamer dashboard** with live status, alerts and moments.
- **Demo mode.** A chat simulator drives the whole pipeline at "50k-viewer" volume without fake accounts. It's clearly labeled SIM everywhere.

## How we built it
- **Node.js + TypeScript (strict)**, Express and WebSockets.
- **Twitch:** EventSub WebSocket (`channel.chat.message`), Helix Send Chat Message, Create Clip, OAuth authorization code flow.
- **AI:** a provider-agnostic LLM layer with structured outputs (Anthropic or OpenAI, chosen in `.env`), used for the topic radar, mood, clip-moment titles and `!missed` recaps. Fast keyword rules handle tech alerts so they never wait on an LLM call.
- **Overlay:** plain HTML/CSS/TS with a custom design system: seeded hand-drawn SVG "marks" (highlighter, circle, tallies, stamp, tape), motion tokens and full reduced-motion support.

**How we used Codex:** Codex built the project in one thread, phase by phase from our `PLAN.md`, `AGENTS.md` and `DESIGN.md`:
- It scaffolded Twitch OAuth and EventSub, the simulator, the analysis engine and the overlay.
- It wrote 150+ unit tests and kept a build log in `NOTES.md`.
- It verified features live on Twitch: a real clip was created through the Clips API, and `!radar` and `!missed` were answered in real chat.
- For the overlay, it captured and reviewed hundreds of frames from full demo runs against our design checklist and fixed what failed (topic labels, grounded counts, ranking, spacing).

## Challenges
- Making AI topic labels sound like chat instead of categories.
- Grounding counts in real messages so the numbers never look fake.
- Designing an overlay readable at 720p on a phone over any game, without the generic "AI glow" look.

## Accomplishments
- A real Twitch clip created automatically through the pipeline.
- Live chat commands working in real Twitch chat.
- A distinctive "producer's marker" visual language.

## What's next
- Question queue with hotkeys.
- Live translation for international chat.
- A raid and hate-flood guard for mods.
- An end-of-stream "Stream Notebook" report.

## Links
- Repo: https://github.com/Pavilion-devs/chat-radar
- Video: <YouTube URL>
- Codex session ID: 01a19688-6a48-7762-9933-4f55c880066e

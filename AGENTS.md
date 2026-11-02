# AGENTS.md — instructions for Codex

You are building **Chat Radar** for the Codex x TwitchCon Hackathon. **Read `PLAN.md` before doing anything.** It is the source of truth for scope, architecture, phases and acceptance criteria. **Before any UI work (overlay, dashboard, report, setup page, README visuals), read `DESIGN.md`.** It is the source of truth for how everything looks and moves, and its anti-slop rules (§2) and checklist (§13) are hard requirements.

## How to work
- Work **one phase at a time**, in the order in `PLAN.md`. Don't start a new phase until the current one meets its "Done when" criteria.
- At the end of each phase:
  1. Tick the checkboxes in `PLAN.md`.
  2. Add a short entry to `NOTES.md`: what you built, decisions made, and problems hit. It's used for the "how we used Codex" part of the submission.
  3. Run the build and tests, then suggest a commit message.
- If something in `PLAN.md` is wrong or blocked (an API limit or a missing scope), say so, propose a fix, and update `PLAN.md`.

## Stack and conventions
- Node.js 20+, TypeScript (strict), ESM. Express + `ws`. Vitest for tests.
- Front end: plain HTML/CSS/TS served from `web/` (no heavy framework unless `PLAN.md` changes).
- Layout: `src/twitch/`, `src/analysis/`, `src/commands/`, `src/server/`, `src/sim/`, `web/overlay/`, `web/dashboard/`, `scenarios/`.
- Small, focused modules. Every analysis module is a pure function or class that is testable without Twitch or OpenAI (inject clients).
- LLM calls (Anthropic/OpenAI): use structured outputs (JSON schema), translate provider schema subsets while retaining full local validation, handle errors and timeouts, never block the realtime path, and log token usage.

## Secrets and safety (hard rules)
- Secrets live only in `.env` (git-ignored). Keep `.env.example` up to date. Never print, log or commit tokens, client secrets or API keys.
- Store OAuth tokens in `.tokens.json` (git-ignored).
- The chat simulator injects messages **into the local pipeline only**. It must never post fake messages to Twitch or use extra accounts.
- Moderation features only **suggest** actions. A human clicks to apply them. Never auto-ban or auto-timeout.
- The bot respects Twitch chat limits: messages of 500 characters or fewer, rate limiting, and cooldowns on commands.

## Commands (keep these working)
- `npm run dev` starts the server with reload
- `npm run sim -- --scenario scenarios/demo.json` runs the chat simulator
- `npm run demo` starts the server and the demo scenario together
- `npm test` runs the tests
- `npm run build` runs the type-check and build

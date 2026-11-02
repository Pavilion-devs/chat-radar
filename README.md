# Chat Radar

A Twitch chat engine for “Never miss your chat again.” Built with Codex for the Codex x TwitchCon Hackathon. Phase 1 connects real Twitch chat to a local pipeline, buffer, WebSocket viewer, and `!ping` command. Phase 2 adds local scenario replay without credentials. Tech-problem alerts and the provider-neutral topic radar are implemented in Phase 3. Hype detection, saved moments, and clip integration are also implemented; the designed dashboard belongs to later work in [PLAN.md](PLAN.md).

## Try the local demo first

```sh
npm install
npm run demo
```

Open [the minimal viewer](http://localhost:3000/dashboard/). No `.env`, Twitch account, viewers, or LLM API key is required. The **SIM** badge appears during replay, and each generated message is labeled `[SIM]`. After 95 seconds the badge clears and the server stays up for inspection or another replay. Demo mode does not load saved Twitch tokens or connect to Twitch automatically.

The default timeline emits **10,400** local messages:

| Phase | Duration | Messages/second |
| --- | --- | --- |
| Next-game questions, hype, emotes | 30 s | 40 |
| Muted-audio reports | 15 s | 80 |
| Hype spike / CLIP IT | 10 s | 400 |
| Spanish, Portuguese, Japanese, Arabic | 25 s | 40 |
| Raid-style local flood | 15 s | 200 |

These messages reach the same buffer, event bus, and WebSocket path as real chat. They do not create real raids or post chat to Twitch. The muted-audio phase now triggers the tech-alert detector. With the selected provider’s API key configured, the same replay also drives topic radar. The hype stage creates a saved local moment with a generated title. The first stage previews `!radar`; the multilingual stage previews `!missed` and later cached replies from different simulated viewers. All simulated command output stays local.

For an existing server started with `npm run dev`, run the simulator in a second terminal:

```sh
npm run sim -- --scenario scenarios/demo.json
```

You can also replay against the still-running demo server after a run finishes. Only one replay runs at a time. Ctrl+C stops a CLI-started replay; stopping the server cancels any active run.

Optional flags for `sim` and `demo`:

- `--scenario path/to/scenario.json`: select a local timeline.
- `--speed 2`: finish twice as fast, preserving message counts and increasing the actual send rate. `--speed 10` runs the default demo in about 9.5 seconds.
- `--rate 40`: override every phase's rate with 40 messages/s; omit it to preserve the scenario's hype/flood spikes.
- `--server http://localhost:3000`: `sim` only, target an already-running local server.

Scenario JSON has `name` and sequential `phases`, each with `name`, `durationSeconds`, `rate`, `users`, and a nonempty `messages` array. Templates and synthetic users cycle deterministically; each replay gets unique local IDs and current timestamps. Validation caps a timeline at 15 minutes, 100,000 messages, and an effective 5,000 messages/s. Delayed ticks catch up in bounded batches to keep the server responsive.

The simulator's local JSON control routes are `/sim/run`, `/sim/status`, and `/sim/stop`; mutation requests require JSON, and browser-origin requests are rejected. The CLI accepts only localhost targets. No additional `.env` settings are required.

## Twitch setup (deferred until you are ready)

Requires Node.js 20+ and npm.

1. Run `npm install`.
2. Register a **Confidential** application in the [Twitch Developer Console](https://dev.twitch.tv/console/apps). Set its OAuth redirect URL to exactly `http://localhost:3000/auth/callback` and category to Chat Bot. Generate a client secret.
3. Copy `.env.example` to `.env` if it does not already exist. Fill it in as follows:

   ```dotenv
   TWITCH_CLIENT_ID=your_app_client_id
   TWITCH_CLIENT_SECRET=your_app_client_secret
   TWITCH_CHANNEL=your_broadcaster_login
   TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
   PORT=3000
   OPENAI_API_KEY=
   OPENAI_MODEL=
   ```

   `TWITCH_CHANNEL` is the channel's lowercase login, without `@`, `#`, or a URL. LLM values can stay empty in Phase 1. Never paste secrets into chat or commit them. `.env` and `.tokens.json` are ignored by Git. If changing the port, change the redirect URL in both `.env` and Twitch app settings.
4. Run `npm run dev`. Open [Connect Twitch](http://localhost:3000/auth/login) in your browser and authorize as your broadcaster account. The same account sends replies; a separate bot account is optional. New authorizations request `user:read:chat`, `user:write:chat`, and `clips:edit`. Existing chat-only tokens still work for chat; reconnect Twitch when ready to grant clip creation. Tokens are saved to `.tokens.json` with owner-only permissions, refreshed automatically, and validated at startup and hourly. See [Twitch's installed chatbot authorization](https://dev.twitch.tv/docs/chat/authenticating/) and [token validation rules](https://dev.twitch.tv/docs/authentication/validate-tokens/).
5. Open the [minimal viewer](http://localhost:3000/dashboard/). The engine listens only on localhost. Use `localhost` in the browser, rather than a LAN address or `127.0.0.1`.

Chat reading and sending work while the channel is offline. No streaming or LLM API key is needed for Phase 1.

## Phase 1 live acceptance check

- Wait for “Connected · … · Receiving Twitch chat” in `/dashboard/`.
- Type a unique message in the configured Twitch channel. It must appear in the viewer within **1 second**. Its displayed age measures the Twitch event timestamp to browser receipt; keep your computer clock synchronized. Messages from the most recent buffer are replayed when a viewer connects, so use a new message for this check.
- Type `!ping` in Twitch chat. The authorized account must post `@your_login pong!` back to Twitch. You can use the same account for this check. Wait at least 10 seconds before repeating with that user.
- Restart the app to verify saved-token restoration. Disconnect the network briefly to verify reconnect behavior.

Automated tests exercise local WebSocket delivery, OAuth protection, token persistence/refresh, and EventSub recovery with injected clients. They do **not** establish that Twitch credentials or real-world latency have passed the live acceptance check. Live verification passed on `olaboye7` on 2026-11-02: a genuine message typed in Twitch chat appeared in the viewer with a displayed timestamp age of 16 ms, and `!ping` received a real reply. Clock synchronization was not independently calibrated. Live `!radar` and Anthropic-generated `!missed` replies were also verified, including mentions, message lengths, and repeated-request suppression.

## Tech-problem alerts

The engine uses local rules for six categories: muted audio, loud game audio, frozen/lagging video, black screen, wrong scene, and microphone peaking/distortion. Rules include English, Spanish, Portuguese, Japanese, and Arabic phrases, punctuation/accent cleanup, and common repeated-letter typos. Explicit healthy phrases such as “audio is fine” and “no lag” are suppressed. This is a heuristic vocabulary, not complete language understanding; human review remains necessary.

Defaults: a **30-second receipt-time sliding window**, **5 distinct reporters**, **10% of messages** reporting the category, and a **60-second cooldown after marking fixed**. Both reporter and share thresholds must pass. Evidence is capped at 100,000 messages per source. Real and simulated traffic have separate windows and alerts. Counts/samples shown on an alert are captured when it first fires. An active alert remains visible until a person clears it.

Run the default demo at normal speed: at 30 seconds, the audio-problem phase begins; the muted alert should appear within about two seconds. The basic viewer shows the category, distinct reporters, share of chat, sample messages, and a **Fixed ✅** button. Active alerts are restored when a browser reconnects.

Clicking Fixed clears that alert, resets its evidence, and starts its cooldown without affecting other categories. A simulated alert clears locally and never sends a Twitch message. For a real alert, the bot queues one thank-you using the existing rate-limited sender; the viewer reports whether it was sent, unavailable, or failed. Live thank-you verification remains deferred until Twitch setup. No LLM API key or new `.env` values are needed.

`GET /alerts` returns active alerts. `POST /alerts/:id/clear` requires JSON and a local/same-origin request. Only the explicit clear action requests a thank-you; the detector itself does not send messages or perform moderation.

## Topic radar and LLM providers

The LLM layer supports **Anthropic** and **OpenAI** through the same `StructuredLLMClient.generate(request, signal)` contract. Radar prompts, sampling, runtime validation, stable labels, smoothing, scheduling, cancellation, and stale-state recovery are shared. Anthropic is the default. Provider choice is explicit; there is no automatic fallback or cross-provider key reuse.

Set these in your local `.env`, then restart the server:

```dotenv
LLM_PROVIDER=anthropic
LLM_MODEL=claude-haiku-5-5
ANTHROPIC_API_KEY=your_anthropic_api_key
```

To select OpenAI instead:

```dotenv
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
OPENAI_API_KEY=your_openai_api_key
```

Only the selected provider receives requests. A missing selected key disables the radar even if another key is present. `LLM_MODEL` wins over provider-specific `ANTHROPIC_MODEL` / legacy `OPENAI_MODEL`; if all model values are blank, the defaults are `claude-haiku-5-5` for Anthropic and `gpt-4.1-mini` for OpenAI. Unknown provider names fail at startup. Twitch authorization is not needed for simulated chat analysis.

Anthropic uses the [Messages API](https://platform.claude.com/docs/en/api/http/messages/create), API version `2026-10-21`, and [JSON structured output](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) through `output_config.format`. Its adapter moves unsupported numeric, string-length/pattern, and array bounds into field descriptions. The shared application validator still enforces the original constraints, counts, and grounded quotes. The model default is documented in the [Haiku 5.5 overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

OpenAI retains its [Responses API Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) request with strict `text.format` and `store:false`. Both adapters send no tools and cap output at 1,800 tokens. Radar requests include a low-effort hint; the Anthropic adapter applies it to documented effort-capable model families and omits it for legacy/unknown IDs. OpenAI models retain their existing request settings. See [Anthropic effort controls](https://platform.claude.com/docs/en/build-with-claude/effort). Their separate authentication headers, schema formats, response/refusal parsing, and error mapping stay inside `src/llm/`.

Every eight seconds, the engine samples the last 60 seconds of one chat source: simulated chat during replay, otherwise real chat if present, or recent simulated chat if no real traffic exists. Real and simulated result/label history stay separate. Text is deduplicated with repetition/distinct-chatter counts retained. At most 300 entries, 300 characters per entry, and 24,000 text characters are sent. Sampling spans the window and retains the most repeated entry. No usernames, user IDs, OAuth tokens, or API keys appear in the analysis payload.

Output permits six topics, labels of at most five words, known kinds, bounded counts/urgency/mood, and exactly two verbatim sample quotes (a quote may repeat). Chat is untrusted input, never instructions. Counts estimate original messages rather than deduplicated templates, and categories may overlap. Exact, word-overlap, or shared-evidence matches retain IDs/labels within a kind. Counts use 60% new / 40% prior estimates, capped by window size. Unsupported topics disappear after successful updates.

The basic viewer, `GET /radar`, and WebSocket reconnect snapshots expose topics, approximate counts, mood, source, last-success time, and stale/error state. Requests are single-flight with a configurable abort deadline (`LLM_TIMEOUT_MS`, default 30,000; allowed 1,000–120,000 ms). The eight-second scheduler skips ticks while a request is in flight, so slower models can update less often. Errors and invalid/incomplete/refused responses keep the last good result. Temporary rate limits honor `Retry-After` or wait 30 seconds. Quota, authentication, and invalid model/access errors stop requests until restart. Unchanged input avoids another request, and empty windows clear old topics without an API call.

Logs include provider and numeric token counts only. Anthropic cache-read/cache-write input tokens are included in normalized input/total counts and reported separately. Error bodies, keys, and chat text are never logged. Missing keys disable the radar without fabricated topics; simulation and tech alerts continue.

Tests inject provider responses and cover both wire formats plus the simulator path. The configured Anthropic key and `claude-sonnet-5` model have passed a real structured-output probe, with validated topics and logged usage. A larger default-effort batch took 14.5 seconds; low effort reduced a comparable probe to 4.1 seconds. The full 95-second, 10,400-message scenario then produced 12 successful validated radar updates and zero failed updates, covering game requests, audio complaints, hype, and raid welcomes with stable IDs. These measurements are local observations, not latency guarantees. The earlier OpenAI account returned `insufficient_quota`; it can still be selected once its account access is resolved.

To add another provider, implement `StructuredLLMClient`, register its metadata and factory branch, and test its schema/auth/usage/error translation. The radar engine needs no changes. Future recap/title consumers can use the same generic structured-generation interface.

## Hype detection and saved moments

The engine measures messages and distinct chatters in one-second receipt-time buckets, with separate real/simulated baselines. It warms up for 20 seconds, then compares both rates against an EWMA baseline (alpha 0.1). Detection needs at least 25 messages/s, 10 distinct chatters, a message z-score of 4 and 3x baseline, plus a chatter z-score of 3 and 2x baseline. Noise floors protect small baselines. Sustained detected spikes do not inflate the baseline; a 60-second cooldown suppresses nearby moments. Long idle gaps reset warmup.

The default scenario's 40→80 messages/s audio stage does not fire hype; its 400/s hype stage does. The nearby raid flood stays in cooldown. Simulation uses timeline time for these calculations, so `--speed 10` preserves warmup and cooldown behavior. A new scenario run resets only its simulated detector; real and simulated crowds cannot combine to manufacture a spike. The displayed peak is the one-second rate at detection, not a later peak across the whole broadcast.

A moment appears immediately with a safe fallback title. An asynchronous, bounded LLM request generates a 3–6 word title from a small recent sample, using the selected provider and low-effort hint. Missing keys, invalid titles, refusals, or timeouts keep the marker and fallback title. Title work never blocks chat or clip creation.

Moments are atomically saved to **`data/moments.json`**, retaining the latest 1,000 entries. Serialized updates prevent title/clip completion races. Restarting restores history; interrupted pending jobs become fallback/failed states rather than being retried as duplicate external actions. Corrupt storage is preserved, `GET /moments` reports `storageError`, and unsaved moments remain visible. Runtime history is git-ignored. This local JSON store assumes one server instance writes it.

Simulated spikes **always create local markers and never call Twitch**, even with a connected live channel. Real spikes check `clips:edit` and current stream state before calling [Twitch Create Clip](https://dev.twitch.tv/docs/api/clips/). Missing scope, no connection, or an offline channel leaves a marker with a clear reason. Twitch must be live and allow the authorized user to create clips. After creating a clip, the app polls for up to 15 seconds; it publishes a clip link only after Twitch returns a verified HTTPS URL. Failed/ambiguous creation is not automatically retried. The generated title belongs to the local moment; Twitch supplies its default clip title.

The basic viewer shows title, source, rate, chatter count, save state, and any verified clip link; reconnect snapshots restore recent moments. `GET /moments` returns the history and storage health. Stage-ready clip toasts and dashboard design remain Phase 4. Real clip creation was verified on 2026-11-02 using the existing clip helper during an authorized silent test broadcast: a [30-second Twitch clip](https://www.twitch.tv/olaboye7/clip/EphemeralExcitedGoldfishBlargNaut-L3y6n3ANwK6jfWCT) was created and played through successfully. The broadcaster was stopped afterward. A genuine multi-user chat spike automatically triggering the full clip pipeline remains a separate field check; this verification called the helper directly.

## Chat commands and local previews

Type `!radar` or `!missed` in Twitch chat after authorization:

- **`!radar`** mentions the requester and replies with the latest top three topics, approximate counts, and mood. It makes no model call. Missing data produces a warmup message; older results are labeled as the last available topics.
- **`!missed`** mentions the requester and summarizes up to ten minutes of available radar history, moment titles, and sampled chat. It uses the selected structured-output LLM, not a separate provider. The full reply, including mention and label, stays within 450 Unicode characters on one line.

Each command has a **60-second per-user cooldown** and **10-second global cooldown**, tracked separately per command and per real/simulated source. Replies use the existing bounded/rate-limited sender. Limits reserve a slot before work starts; unsuccessful sends are reported locally and not blindly retried. Incoming real commands are handled only while Twitch is connected.

Recap bodies are cached for **20 seconds after generation**. Each reply gets its own requester mention; names are never cached into another viewer's response. Eligible requests arriving while generation is in progress share one model call per source. A bounded timeout, malformed output, refusal, or unavailable key falls back to known topic labels/moment titles (or a clear no-data message). Provider error bodies never go to chat.

The recap context keeps the real and simulated sources separate. It contains up to 20 representative successful radar frames, 10 recent moment titles, and 80 deduplicated message entries / 16,000 text characters from the available ten-minute window. It omits sender metadata, commands, and recognized bot replies; overlapping radar frames are not summed as independent counts. Quotes and labels are untrusted data, and the model is instructed to summarize reports rather than invent events or fixes. New replay runs reset simulated command cache/history/cooldowns; real state is unaffected. History remains bounded in memory and starts fresh after restart, while recent saved moments remain usable.

Before Twitch setup, run `npm run demo` and watch **Chat commands** in the basic viewer, or click **Preview !radar locally** / **Preview !missed locally**. The default scenario exercises both commands automatically. Simulated requests always produce a local preview, even if Twitch is connected, and never invoke the sender. Local preview buttons use the same cooldowns as simulated chat, so a recent scenario command can temporarily suppress a manual preview.

`POST /commands/preview` accepts JSON `{ "command": "!radar" }` or `{ "command": "!missed" }`. It always uses simulated context, ignoring attempts to select real chat. Foreign browser origins and non-JSON requests are rejected. `GET /commands/replies` and WebSocket reconnect snapshots expose the latest 20 local/sent/failed replies. There are no new `.env` values. Real Twitch `!radar`/`!missed` delivery still awaits account setup and live verification.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Compile the minimal viewer and run the engine with reload |
| `npm run build` | Strict TypeScript checks and server/viewer compilation |
| `npm start` | Run the compiled server after building |
| `npm test` | Run engine and server tests without Twitch credentials |
| `npm run sim -- --scenario scenarios/demo.json` | Replay a scenario into an existing local server |
| `npm run demo` | Start the server and the default scenario together without Twitch |

`/overlay/` is a transparent placeholder. The dashboard is a basic connection/message/alert viewer; visual design remains Phase 4.

## Engine

`Twitch EventSub → normalize → bounded 15-minute ring buffer → event bus → WebSocket hub / !ping`

- `src/twitch/`: OAuth, Helix API, EventSub lifecycle, outbound queue.
- `src/analysis/`: buffer with 15-minute retention and a 100,000-message memory cap.
- `src/server/`: synchronous ingest/event bus, Express routes, and `/ws` hub.
- `src/llm/`: generic structured generation, provider adapters, shared error/usage types, and the radar prompt wrapper.
- `src/sim/`: validated scenario timelines, bounded replay scheduling, local control and CLI.
- `src/commands/`: `!ping` with a 3-second global and 10-second user cooldown.
- `web/`: plain HTML/CSS/TypeScript verification surfaces.

Messages normalize to `{id, user: {id, login, name}, text, ts, badges, sim}`. Timestamps are epoch milliseconds. Duplicate EventSub notifications and chat IDs are suppressed. Chat events are broadcast immediately; slow browser clients are disconnected above 1 MB of pending data. Command sending is asynchronous and cannot hold up ingestion.

Outbound messages are limited to 500 Unicode characters on one line, spaced at least 1.6 seconds apart (below the ordinary 20 messages/30 seconds limit), and held in a bounded queue. Send errors trigger a 30-second pause. Ambiguous failed sends are not retried; a 401 causes one token refresh and API retry. Simulated messages cannot invoke `!ping` or send fake chat to Twitch. No moderation actions are implemented.

OAuth callbacks require a short-lived, single-use state tied to an HTTP-only SameSite cookie. Upstream response bodies and tokens are never logged. Keep this single-user local tool on localhost. Do not expose it publicly without adding application authentication.

EventSub handles welcome, keepalive deadlines, disconnect backoff/resubscription, revocations, and Twitch's reconnect URL handoff. During handoff the old socket stays open until the replacement welcomes; existing subscriptions transfer without re-creation. As [Twitch documents](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), events lost during an ordinary disconnection are not replayed.

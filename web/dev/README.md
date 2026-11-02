# Local overlay review

The normal `/overlay/` is transparent and uses only real WebSocket events. `?bg=bright|dark` opts into these **test backgrounds**, never enabled implicitly. They are not clip thumbnails.

- `bright.jpg`: SuperTuxKart, Freytra Peaks (Evolution preview), downloaded from the [official gallery](https://supertuxkart.net/Gallery), source https://supertuxkart.net/assets/gallery/STKEvolution_1.jpg. Game artwork belongs to its credited SuperTuxKart contributors; see https://github.com/supertuxkart/stk-assets for asset licenses.
- `dark.jpg`: Xonotic screenshot, downloaded from the [official media page](https://xonotic.org/media/), source https://xonotic.org/m/uploads/2012/07/frontpage_005.jpg. Xonotic contributors, GPL game artwork; see https://xonotic.org/faq/ for project licensing.

`?review` enables local controls for replaying recorded **SIM radar outputs** from the real `scenarios/demo.json` pipeline, and inspecting mid-animation, reading and quiet states. Press R to restore hidden controls. Review playback does not inject any chat messages or publish events. Normal OBS sources must omit `review` and `bg`.

## Sustained live verification

`/dev/soak.html` embeds three **normal live** overlay clients at bright/dark 1920×1080 and bright 1280×720. Its read-only observer checks layout every animation frame, including occupied transition-cell coverage. It does not replay fixtures or start the simulator. Run the existing CLI scenario separately; capture the three iframe rectangles on an absolute two-second schedule through the browser tool.

The final acceptance recording is in ignored `data/design/soak-3a-final/`: 228 native captures, source radar updates, start time and timing/audit manifest. Copied local evidence is browsable at `/dev/soak-gallery.html` with links to every full-size image. `bright-4x.mp4` is a 4× playback of the two-second still sequence. These generated assets live under ignored `web/dev/review-captures/`; a clean checkout needs a fresh capture before that gallery can display evidence. Earlier pilots and the failed crossing-text pass are excluded from acceptance.

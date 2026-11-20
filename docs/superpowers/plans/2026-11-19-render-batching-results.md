# Render batching: measurements

Machine: AMD Radeon 780M (integrated, ANGLE / Direct3D 11) on a fast Zen 4 laptop CPU, Chrome-based in-app browser, display refresh above 144 Hz. Dev server (`npm run dev`), not a production build.

Readout = the in-page counter (`world/Stats.tsx`): fps · average frame interval ms · draw calls per frame (shadow pass included). Medians of three readings 1 s apart, 3.5 s after scrolling to each position.

## Baseline (before batching), 2026-11-19

Small pane viewport 736×726 CSS px, dpr 1.25 (canvas 920×907):

| Position | f | fps | frame ms | draw calls | main-thread work per frame (median / p95) |
|---|---|---|---|---|---|
| opening | 0 | 155 | 6.5 | 555 | 4.1 / 6.1 ms |
| mid-flight to Zhangjiajie | 0.1982 | 148 | 6.7 | 625 | 4.3 / 6.3 ms |
| among the pillars | 0.2911 | 147 | 6.8 | 556 | 4.1 / 5.8 ms |
| Huangshan arrival | 0.8499 | 153 | 6.5 | 349 | 3.0 / 4.6 ms |

Emulated 1920×1080, dpr 1.25 (canvas 2400×1350), three readings each:

| Position | readings (fps / ms / calls) |
|---|---|
| opening | 102 / 9.8 / 597 · 95 / 10.5 / 597 · 125 / 8.0 / 597 |
| among the pillars | 87 / 11.5 / 564 · 87 / 11.5 / 564 · 80 / 12.4 / 564 |

Main-thread work = summed time inside every `requestAnimationFrame` callback of one frame (R3F's render loop, GSAP), so it's the CPU cost of preparing and submitting the frame. It doesn't include GPU time.

### What this says

- Real draw calls are 350–625, not ~2,000: three.js already skips off-screen sheets.
- In the small pane, frames are capped by the display refresh (~150 fps), so frame interval hides the cost. The CPU spends about 4 ms a frame preparing it. A laptop CPU 3–4× slower would spend 12–16 ms, the whole 60 fps budget, before the GPU even starts. Batching targets exactly this: fewer draw calls, no 990 per-sheet callbacks, no per-sheet matrix updates.
- At full-HD size the frame interval rises to 8–12 ms with CPU work unchanged, so the GPU's pixel work becomes the limit even on this fairly strong integrated GPU. Batching will help the GPU less. Resolution, antialiasing and shadow map size are the levers there, all ruled out for now.

## After batching, 2026-11-19

Same method, same positions. Emulated 736×726 viewport (the emulation reported dpr 2, so the canvas was capped at dpr 1.75: more pixels than the baseline's 1.25; draw calls and main-thread work don't depend on pixel count):

| Position | fps | frame ms | draw calls (before → after) | main-thread work per frame, median / p95 (before → after) |
|---|---|---|---|---|
| opening | 159 | 6.3 | 555 → 193 | 4.1 / 6.1 → 2.0 / 3.5 ms |
| mid-flight to Zhangjiajie | 162 | 6.2 | 625 → 166 | 4.3 / 6.3 → 1.6 / 2.8 ms |
| among the pillars | 155 | 6.4 | 556 → 160 | 4.1 / 5.8 → 2.5 / 3.7 ms |
| Huangshan arrival | 164 | 6.1 | 349 → 146 | 3.0 / 4.6 → 1.9 / 3.1 ms |

Emulated 1920×1080, dpr 1.25 (canvas 2400×1350, same as the baseline):

| Position | readings (fps / ms / calls) |
|---|---|
| opening | 123 / 8.1 / 194 · 134 / 7.5 / 194 · 134 / 7.4 / 193 (baseline 95–125 fps) |
| among the pillars | 85 / 11.8 / 160 · 71 / 14.1 / 160 · 86 / 11.6 / 160 (baseline 80–87 fps) |

### What this says

- Draw calls fell by 60–74% everywhere (146–193 a frame, under the 180–250 estimate). Main-thread work per frame roughly halved. That's the cost a slower laptop CPU pays, so it should be the visible win there.
- At full-HD among the pillars, fps is unchanged: that view is limited by the GPU painting pixels (the dense pillar sheets, fog and shadow filtering at 2400×1350), which batching doesn't reduce. The opening view, lighter on pixels, gained ~15–30 fps.
- Identical picture: 1280×800 `?still` screenshots, before vs after, pixel-diffed (JPEG, readout masked). Pillars and Huangshan: 0 pixels differ by more than 40/255. Opening: 4 pixels (the animated "Scroll to fly" line). Mid-flight: 110 pixels (0.03%) in two faint distant patches, consistent with the expected draw-order change between sheets at nearly the same depth.
- Cloud drift: 10 instance-matrix uploads per frame with motion on (one per cloud batch), 0 under `?still`.
- Loading: the cloud veil opened at 8.2 s before and 7.9 s after (dev server, `?still`), so the build-out cost didn't change.

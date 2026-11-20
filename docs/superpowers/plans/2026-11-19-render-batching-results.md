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

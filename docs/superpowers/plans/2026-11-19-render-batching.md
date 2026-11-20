# Batch the Paper Sheets: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the flight smooth on ordinary laptops by drawing every paper sheet that shares a texture in one draw call, with no visible change to the painting.

**Architecture:** First a readout (fps, frame ms, draw calls) and a recorded baseline, then a stop to decide with the learner. Then the 960-odd painted sheets in `REGIONS` are grouped by texture + mirror flag into `THREE.InstancedMesh`es built from a pure grouping module. Mist, water, sun and cave stay plain `Sheet`s. Last, `Plaques` stops rewriting unchanged DOM state.

**Tech Stack:** Next.js 16 (static export), React 19, three r187, @react-three/fiber 9.8, TypeScript. No test runner: checks are `npx tsc --noEmit`, dev-time `console.assert` self-checks (the project's pattern, see the bottom of `journey/journey.ts`), and observation in the dev server.

**Spec:** `docs/superpowers/specs/2026-11-19-render-batching-design.md`

## Global Constraints

- The picture must not change: no change to dpr (`[1, 1.75]`), `antialias`, shadow map size (2048 / 1024 under 800px), `shadow-radius`, shadow camera box, fog, or any material settings.
- No new dependencies. No Drei. Plain CSS in `app/globals.css`.
- Anything a visitor can scrub is computed from `progress.p`, never accumulated per frame. Only cosmetic motion (cloud drift) uses `clock.elapsedTime`.
- The opening build-out keeps its cadence: `shown` starts at `REGIONS[0].pieces.length` after `loadPaintings()`, then +12 every 60 ms; `onReady` two frames after the opening mounts; the Zhangjiajie dev assert in `World` stays.
- Cloud drift today: region-local `x = at[0] + sin(t * 0.08 + at[2]) * 0.6`, none under reduced motion.
- After each task: a VibeWise **Implementation report** in chat (what changed, where, how the key code works, why it fits the design, what was verified and what wasn't), and append the task's outcome to `.vibe-wise/progress.md`. The learner asked for this after every change.
- The browser pane must be visible for frame measurements (a hidden pane doesn't run `requestAnimationFrame`). If `tabs_context` says hidden, ask the learner to show it.

## Check positions

The four scroll positions are progress fractions, applied as `window.scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight))` after the opening flight has landed, then waiting 3 s for the scrub to settle:

| Name | f |
|---|---|
| opening | 0 |
| mid-flight to Zhangjiajie | 0.1982 |
| among the pillars (Zhangjiajie arrival) | 0.2911 |
| Huangshan arrival | 0.8499 |

## Review Focus

1. **Mirrored sheets** (`flip: true`) must light exactly like unmirrored ones. A negative instance scale would make them render back-facing and darker. Pinned by an assert in Task 2 and the side-by-side check in Task 3.
2. **Reduced motion**: clouds sit still at their base position (the same place today's code leaves them), not at some drift offset. Pinned in Task 3.
3. **Scrolling back out of a plaque**: a plaque that was visible must become hidden (opacity 0, `visibility: hidden`, `inert`) when you scroll back past it, even though writes are now skipped when unchanged. Pinned in Task 4.
4. **Window resize while a plaque is on screen** (desktop → 375 px wide): the plaque keeps tracking its point. The transform must still be written every frame while visible. Pinned in Task 4.
5. **Opening build-out under load**: sheets appear in journey order, Huaguo Shan is complete before the clouds part, and no "Zhangjiajie was still being built" assert fires. Pinned in Task 3.

---

### Task 1: Readout, still-frame switch, and baseline

**Files:**
- Create: `world/Stats.tsx`
- Modify: `world/World.tsx` (mount `<Stats />` inside `<Canvas>`, after `<Plaques />`)
- Modify: `app/Experience.tsx:52-53` (still-frame switch)
- Create: `docs/superpowers/plans/2026-11-19-render-batching-results.md`

**Interfaces:**
- Produces: `export default function Stats(): null`, a component that must sit inside `<Canvas>`. It reads `useThree((s) => s.gl).info.render.calls` in a `useFrame`.
- Produces: the `?still` URL switch. It makes `reduced` true (no camera drift, no cloud drift, opening flight lands at once) so before/after screenshots line up.

- [ ] **Step 1: Write `world/Stats.tsx`**

Enabled when `process.env.NODE_ENV !== 'production' || new URLSearchParams(location.search).has('stats')`. When disabled it registers no frame work at all (put the `useFrame` in an inner component that's only rendered when enabled). When enabled:
- create one `div` on `document.body` in an effect (removed on unmount), fixed bottom-left, `z-index: 20`, `pointer-events: none`, monospace 12px, dark text on a translucent paper background, so it stays clear of the skip link (top-left) and the hint (bottom-centre);
- each frame, read `gl.info.render.calls` (this is the previous `render()`'s total, shadow pass included) and accumulate frame count, summed `dt` and summed calls;
- every 0.5 s, write `"{fps} fps · {ms} ms · {calls} calls"` (fps and calls rounded to integers, ms to 1 decimal), then reset the sums.

- [ ] **Step 2: Add the still-frame switch in `Experience.tsx`**

`const rm = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('still')` in the ScrollTrigger effect, and use the same expression in the intro effect (line 45). There are two `rm` reads; both change.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 4: Check the readout in the dev server**

`preview_start {name: "portfolio"}`, wait for the opening flight, `read_page`. Expected: the readout text matches `/\d+ fps · [\d.]+ ms · \d+ calls/`, and the console has no new errors (`read_console_messages {onlyErrors: true}`).

- [ ] **Step 5: Record the baseline**

At each of the four check positions, without `?still`, read the readout three times 1 s apart and record the median fps, ms and calls in the results file under `## Baseline`, with the machine/GPU (`gl.getParameter(gl.RENDERER)` via the debug-renderer-info extension if available) and the viewport size. Then load `/?still`, and at each position take a screenshot: these are the "before" images for Task 3. Keep them in the conversation, captioned with the position name.

- [ ] **Step 6: Commit**

```bash
git add world/Stats.tsx world/World.tsx app/Experience.tsx docs/superpowers/plans/2026-11-19-render-batching-results.md
git commit -m "Add fps/draw-call readout and ?still switch; record baseline"
```

- [ ] **Step 7: STOP: checkpoint with the learner**

Give the VibeWise Implementation report, then show the baseline table. Say plainly whether draw calls look like the main cost. If calls are already low (under ~300) while frame time is still high, say that pixel work (dpr, MSAA, shadow map) is the likely cost. Ask the learner whether to continue with instancing or re-decide. **Do not start Task 2 without their answer.**

---

### Task 2: Pure batching module with a transform self-check

**Files:**
- Modify: `art/ink.ts:302-305` (export the cache key)
- Create: `world/paper.ts` (the shared plane geometries and the `paper()` material cache moved out of `World.tsx`)
- Create: `world/batches.ts`
- Modify: `world/World.tsx:9,12-18` (import `PLANE`, `paper` from `./paper` instead of defining them)

**Interfaces:**
- Produces in `art/ink.ts`: `export function textureKey(kind: Kind, seed: number, k = 1, tone: Tone = 'jade'): string`, returning exactly today's key `kind + seed + '/' + k + tone`. `texture()` uses it.
- Produces in `world/paper.ts`: `export const PLANE: THREE.PlaneGeometry` (unchanged 1×1), `export const PLANE_FLIPPED: THREE.PlaneGeometry` (1×1 with every uv `u` replaced by `1 - u`), `export function paper(map: THREE.Texture): THREE.Material` (moved verbatim).
- Produces in `world/batches.ts`:
  - `export const PAINTED: ReadonlySet<string>` = `ridge, peak, falls, pillar, pine, cloud`
  - `export type BatchItem = { index: number; base: THREE.Matrix4; axis: [number, number]; phase: number }`. `index` is the piece's global build order (position counted through `REGIONS` in order, the same count `World`'s `shown` uses). `base` is the world matrix with no drift and positive scale. `axis` is the region's local x axis in world xz, `[cos(yaw), -sin(yaw)]`. `phase` is `piece.at[2]`.
  - `export type Batch = { key: string; kind: Kind; seed: number; ink: number; tone: Tone; flip: boolean; items: BatchItem[] }`. `items` are in ascending `index` order.
  - `export function buildBatches(regions: Region[]): Batch[]`. One batch per (texture key, flip). Batch order is the order of each batch's first item.
  - `export function checkBatches(regions: Region[], batches: Batch[]): void`, dev-only asserts (see Step 1).

- [ ] **Step 1: Write the self-check `checkBatches` first**

For every painted piece, build today's transform with real three objects: a `THREE.Group` at `region.origin` with `rotation.y = region.yaw`, holding a `THREE.Object3D` at `[at[0], at[1] + h/2, at[2]]`, `rotation.y = yaw ?? 0`, `scale = [flip ? -w : w, h, 1]`, then `updateMatrixWorld(true)`. Find the piece's `BatchItem` by `index`, and assert with `console.assert`:
- `item.base` with `flip ? PLANE_FLIPPED : PLANE` places the quad's four corners, **with their texture coordinates**, where the reference object places `PLANE`'s corners with theirs: each corner's world position within 1e-4, matched by uv;
- `item.base.determinant() > 0` (no mirrored instances: Review Focus 1);
- every painted piece appears in exactly one batch, and the total item count equals the number of painted pieces;
- within each batch, `items` are strictly ascending by `index`;
- no two batches share both `key` and `flip`.
Log one summary line at the end: `batches: {n} meshes for {m} sheets`.

- [ ] **Step 2: Wire the check so it runs, and see it fail**

In `World.tsx`, at module level under `if (process.env.NODE_ENV !== 'production')`, call `checkBatches(REGIONS, buildBatches(REGIONS))`. Write `buildBatches` as a stub returning `[]`.
Run: reload the dev server and `read_console_messages`.
Expected: assertion failures ("every painted piece appears in exactly one batch").

- [ ] **Step 3: Implement `textureKey`, `world/paper.ts`, and `buildBatches`**

`buildBatches` walks `regions` in order with a running global index over **all** pieces (painted or not, so indexes match `shown`), skips non-painted kinds, and fills a `Map<string, Batch>` keyed by `textureKey(kind, seed, ink, tone) + (flip ? '|f' : '')`. `base` = region matrix × piece matrix with scale `[w, h, 1]`.

- [ ] **Step 4: Verify the check passes**

Run: `npx tsc --noEmit`, then reload the dev server and `read_console_messages`.
Expected: tsc clean. Console shows the `batches:` summary line, with meshes between 49 and 98 and sheets equal to the painted count (expected 970 = 990 − 15 mist − 2 water − 2 cave − 1 sun), and no assertion failures. The page still looks as before (nothing renders from batches yet).

- [ ] **Step 5: Commit**

```bash
git add art/ink.ts world/paper.ts world/batches.ts world/World.tsx
git commit -m "Group painted sheets into per-texture batches, with a transform self-check"
```

- [ ] **Step 6: Implementation report** (VibeWise), and update `.vibe-wise/progress.md`.

---

### Task 3: Render the batches as instanced meshes

**Files:**
- Create: `world/Batches.tsx`
- Modify: `world/World.tsx:20-53` (`Sheet` only for mist/water/sun/cave), `World.tsx:370-386` (render plain sheets by global index; mount `<Batches>`)

**Interfaces:**
- Consumes: `buildBatches`, `Batch`, `BatchItem` (Task 2); `PLANE`, `PLANE_FLIPPED`, `paper` (Task 2); `texture` (art/ink.ts).
- Produces: `export default function Batches({ shown, reduced }: { shown: number; reduced: boolean }): JSX.Element`

- [ ] **Step 1: Write `world/Batches.tsx`**

- Build batches once at module level (`const BATCHES = buildBatches(REGIONS)`) so the dev check and rendering use the same data (have `World.tsx`'s check import `BATCHES` from here instead of building its own).
- For each batch, `n = items.filter(i => i.index < shown).length` (items are sorted, so a counter works). Render nothing for a batch until `n > 0`. Paint the texture (`texture(kind, seed, ink, tone)`) only then, in a `useMemo` inside a per-batch child component, so painting keeps arriving in journey order.
- Each batch child renders `<instancedMesh args={[flip ? PLANE_FLIPPED : PLANE, paper(map), items.length]} castShadow receiveShadow frustumCulled />`. In a layout effect on `n`: write `base` matrices for items `[0, n)` via `setMatrixAt`, set `mesh.count = n`, flag `instanceMatrix.needsUpdate`, `computeBoundingSphere()`, and for cloud batches add `0.6` to `boundingSphere.radius`.
- One `useFrame` in `Batches` (not per batch), skipped when `reduced`: for every mounted cloud batch and each of its first `count` items, `off = Math.sin(t * 0.08 + phase) * 0.6`; copy `base` into a scratch matrix, add `axis[0] * off` to `elements[12]` and `axis[1] * off` to `elements[14]`, `setMatrixAt`; then flag `needsUpdate`. Batch children register their mesh refs with the parent for this.

- [ ] **Step 2: Switch `World` over**

The `REGIONS.map` keeps its region groups but only renders pieces whose kind is not in `PAINTED`, and only those with global index `< shown` (keep counting all pieces so indexes line up). Drop the cloud branch from `Sheet`'s `useFrame`. Mount `<Batches shown={shown} reduced={reduced} />` right after the region groups. `castShadow` / `receiveShadow` on `Sheet` stay as they are for the remaining kinds.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Opening build-out (Review Focus 5)**

Hard-reload the dev server, watch the opening flight, then `read_console_messages`.
Expected: the `batches:` summary, no assertion failures, no "Zhangjiajie was still being built" message, and no WebGL errors. A screenshot at f = 0 right after the clouds part shows Huaguo Shan complete.

- [ ] **Step 5: Still frames and cloud drift (Review Focus 2)**

Load `/?still`. At each check position take a screenshot and put it next to Task 1's "before" image of the same position. Expected: indistinguishable by eye, including mirrored sheets (Review Focus 1) and the shadows sheets cast on the sheets behind them. Then load `/` (no `?still`) among the pillars and take two screenshots 5 s apart. Expected: the foot clouds have shifted sideways slightly, and their shadows moved with them.

- [ ] **Step 6: After numbers**

Without `?still`, record the readout medians at the four positions under `## After batching` in the results file, using the same method as the baseline. Expected: calls roughly 180–250 at each position, frame ms at or below baseline. If calls are much higher, or ms is worse, stop and report before Task 4.

- [ ] **Step 7: Commit**

```bash
git add world/Batches.tsx world/World.tsx docs/superpowers/plans/2026-11-19-render-batching-results.md
git commit -m "Draw painted sheets as one instanced mesh per texture"
```

- [ ] **Step 8: Implementation report** (VibeWise) with the before/after table and the side-by-side screenshots, and ask the learner to sign off that the picture is unchanged (the spec makes them the judge). Update `.vibe-wise/progress.md`.

---

### Task 4: Plaques write the DOM only when something changed

**Files:**
- Modify: `world/World.tsx` (`Plaques`, currently lines 327-347)

**Interfaces:**
- Consumes: `ANCHORS` (journey.ts, unchanged).
- Produces: nothing new for other tasks.

- [ ] **Step 1: Implement the cache**

Keep a per-anchor record `{ el: HTMLElement | null; o: number; open: string; inked: boolean; inert: boolean }`, created once (`useMemo` over `ANCHORS`). Resolve `el` with `getElementById` only while it's null. Per frame, compute `o`, `open` (`toFixed(3)` string) and inked exactly as today, then write each of opacity, visibility, `--open`, `data-inked` and `inert` only if it differs from the record. Write `transform` every frame whenever `o > 0` (Review Focus 4). When `o` is 0 and was 0 last frame, skip all writes after the distance maths.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Scroll in and back out (Review Focus 3)**

Scroll to f = 0.2911 (a plaque unrolls, then inks), then back to f = 0, waiting 3 s each time. `read_page` / `javascript_tool` on the first Projects plaque (`#plaque-zhangjiajie-0`). Expected: at the pillars `opacity` is 1, `data-inked` is present and `inert` is false; back at the start `opacity` is "0", `visibility` is "hidden" and `inert` is true.

- [ ] **Step 4: Resize while visible (Review Focus 4)**

At f = 0.2911, `resize_window {preset: "mobile"}`, wait 1 s, screenshot. Expected: the plaque is still centred on its pillar point, not stuck where it was at desktop width. Then `resize_window {preset: "desktop"}`.

- [ ] **Step 5: Commit**

```bash
git add world/World.tsx
git commit -m "Plaques: cache elements and skip unchanged DOM writes"
```

- [ ] **Step 6: Implementation report** (VibeWise), then a **System check**: how scroll → `sample` → batches/plaques/readout fit together now. Update `.vibe-wise/progress.md`, and `.vibe-wise/project-map.md` with the new files (`world/Stats.tsx`, `world/paper.ts`, `world/batches.ts`, `world/Batches.tsx`).

---

### Task 5: Final verification and docs

**Files:**
- Modify: `CLAUDE.md` (Architecture: `Sheet` now only renders mist/water/sun/cave; painted sheets are instanced per texture in `world/Batches.tsx` from `world/batches.ts`; `?stats` and `?still` switches. Working notes: the readout exists.)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: completes, writing `out/`. (CLAUDE.md lists a production build as never verified; record the result either way.)

- [ ] **Step 2: Type-check and journey self-check**

Run: `npx tsc --noEmit`, then reload the dev server, scroll from f = 0 to 1 and back, and `read_console_messages {onlyErrors: true}`.
Expected: tsc clean; no journey or batch assertion messages.

- [ ] **Step 3: Update `CLAUDE.md`** as listed above. It's gitignored (local only), so there's nothing to commit. Commit the results file if it changed.

- [ ] **Step 4:** Tell the learner what stays unverified: a real weak laptop. Suggest they open the deployed site with `?stats` on one once this is merged and deployed.

# Batch the paper sheets: smooth flight on ordinary laptops

Date: 2026-11-19. Status: draft, awaiting approval.

## Intent

The portfolio stutters on any machine that isn't fairly powerful, and the stutter breaks the impression the whole site rests on: a paper ink painting that comes alive as Wukong flies through it. The goal is a smooth flight on ordinary laptops with **no change to what anyone sees**: every sheet, plaque, shadow and drift stays exactly as it is today.

## What costs the time today (measured from the code)

- `REGIONS` holds **990 sheets** (Huaguo Shan 26, crossing 29, Zhangjiajie 112, generated land 737, Huangshan 86). They share only **49 painted textures**.
- Each sheet is its own `<mesh>` in `world/World.tsx` (`Sheet`). Every sheet except mist/water/sun/cave casts and receives shadows, so each is drawn twice a frame: once in the 2048² shadow map pass and once on screen. That's up to **2,000 draw calls a frame**. That's an upper bound: three.js already skips each sheet that's outside the camera's view or outside the shadow box (±85 units), so the real count is probably a few hundred. It hasn't been measured at runtime yet, which is why measuring comes first (see Order of work).
- Each `Sheet` registers its own `useFrame`: 990 callbacks a frame, nearly all doing nothing. The 362 `cloud` sheets each move their own `position.x` (drift `sin(t * 0.08 + at[2]) * 0.6`, in the region's frame).
- `Plaques` looks up every anchor element with `getElementById` and writes opacity, `--open`, `data-inked`, visibility, `inert` and transform on every frame, including for plaques that are hidden and unchanged.
- Not targeted here: render resolution (dpr up to 1.75), 4× MSAA, the shadow map size and softness, and about 180 MB of sheet textures. These cost real time, but changing them would change the picture.

## Goals

1. Cut draw calls to roughly 180–250 a frame, the shadow pass included, by drawing every sheet that shares a texture in one call. (Roughly 60–98 instanced meshes, almost always on screen because each one's sheets are spread across the world, each drawn in both passes, plus Wukong's ~18 meshes ×2, ~20 plain sheets and the 2 backdrop rings.)
2. Remove the per-sheet per-frame callbacks.
3. Keep plaque positioning exactly as it is, but touch the DOM only when something actually changed.
4. Add a readout (frame rate, frame time, draw calls) so the before and after can be measured, including on the deployed site on a weak laptop.

## Non-goals

- Lowering render resolution or dpr, removing antialiasing, or changing the shadow map size, radius or type. The learner's decision: render smarter first; consider these only after seeing what batching achieves.
- A texture atlas (approach C). It's held in reserve in case A isn't enough, because its mipmaps bleed between neighbouring paintings at the cut edges when seen at a distance.
- Moving texture painting off the main thread (that's load-time jank, not flight lag). A possible later step.
- Changes to the timeline, regions data, content, CSS look, or Wukong.

## Anti-goals (failure even if it's faster)

- Any visible difference at the same scroll position: a sheet lit differently, mirrored the wrong way, missing a shadow, or not drifting.
- Breaking the gradual build-out during the opening flight, or the dev assert that Zhangjiajie is in before the opening flight lands.
- Breaking exact replay when scrolling backwards (nothing scrubbable may become per-frame accumulated).

## Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| **A** | One `THREE.InstancedMesh` per texture, holding a transform for every sheet that uses it | ~100 calls; drift and gradual loading still work; three.js can no longer skip individual off-screen sheets (cheap, because the GPU drops them before shading) | **Chosen** |
| B | Weld each texture's sheets into one merged geometry | ~100 calls, but welded pieces are frozen: drifting clouds and gradual loading become awkward, and any change means a rebuild | Rejected: the learner judged it would hurt immersion |
| C | Pack all textures into a few atlases | A handful of calls, but painting bleeds across sheet edges at a distance | Held in reserve only if A falls short |

## Design

### 1. Instanced sheets (`world/World.tsx`)

- **Grouping.** Painted sheets (kinds `ridge`, `peak`, `falls`, `pillar`, `pine`, `cloud`) are grouped by their texture key (the same key `texture()` caches on: kind + seed + ink + tone, with the same defaults filled in, ink 1 and tone `jade`, so sheets that share a texture never end up in separate meshes), and within that by `flip`. Each group becomes one `InstancedMesh` sharing the existing `paper(map)` material (Lambert, `alphaTest` 0.5, `alphaToCoverage`, DoubleSide). `castShadow` and `receiveShadow` are on, as today. That makes at most 2 meshes per texture: under 100.
- **Instance transform** = region matrix (origin, yaw) × piece matrix (position `[at.x, at.y + h/2, at.z]`, rotation `yaw ?? 0`, scale `[w, h, 1]`). This matches today's nested group + mesh exactly.
- **Mirroring without negative scale.** Today `flip` is a negative x scale on the mesh. three.js corrects face winding for a mirrored *object*, but not for a mirrored *instance*. A mirrored instance would therefore read as back-facing, and Lambert's DoubleSide would flip its normal, so the sheet would light from behind (darker). Instead, flipped sheets go in their own instanced mesh that uses a second shared plane geometry with mirrored texture coordinates (u → 1 − u) and positive scale. A flat quad with mirrored UVs is pixel-identical to a mirrored quad.
- **Cloud drift.** For instanced meshes of `cloud` textures, a single frame callback recomputes each cloud's instance matrix with the same drift as today (`sin(t * 0.08 + at[2]) * 0.6` along the region's x axis) and flags `instanceMatrix.needsUpdate`. That's 362 matrix writes and about 23 KB uploaded per frame, which is negligible. Doing it on the CPU keeps shadows drifting with their sheets automatically, with no custom shader and no separate depth material. Reduced motion: no drift, as today.
- **Gradual build-out.** `World` keeps its `shown` counter (sheets built so far, counted through `REGIONS` in order, +12 every 60 ms). Each piece gets its global index in that order. Each instanced mesh holds its instances sorted by global index and sets `count` to how many have index < `shown`. A mesh is created, and its texture painted, only once its first instance is due, so painting cost still arrives in journey order just as it does now. The `onReady` timing (two frames after the opening's sheets) and the Zhangjiajie dev assert keep working off `shown`.
- **Bounds.** Each instanced mesh's bounding sphere is recomputed when its `count` changes, so frustum culling stays correct for the mesh as a whole. For cloud meshes, pad it by the drift (0.6).
- **Draw order (builder's call, checked by eye).** Sheets inside one instanced mesh lose three's per-object near-to-far sort. They're opaque and alpha-tested, so the depth buffer decides overlaps, but sheets at almost the same depth could overlap slightly differently. The side-by-side check (below) is where this would show up.
- **What stays a plain `Sheet`.** `mist`, `water`, `sun` and `cave` (about 20 pieces) keep the current component and their per-frame behaviour: mist takes the fog colour and drifts, water scrolls. Wukong and his cloud (about 18 meshes) are unchanged.

### 2. Plaques (`world/World.tsx`, `Plaques`)

- Look up each anchor's element once (re-resolving if it's missing), not every frame.
- Keep the last written values per plaque. Write opacity, `--open`, `data-inked`, visibility and `inert` only when they change. When a plaque was hidden and stays hidden, skip it after the cheap distance test.
- The positioning maths is unchanged.

### 3. Performance readout

- A small screen-corner text readout: frames per second, average frame time in ms, and draw calls from `gl.info.render.calls` (which includes the shadow pass, since three resets `info` once per `render()`). It updates twice a second.
- It's shown in the dev server, and in any build when the URL has `?stats`, so it can be checked on the deployed site from a weak laptop. In a production build without `?stats` it renders nothing and runs no frame callback.
- It's a plain text tool overlay, not part of the painting. The "nothing textured pinned to the screen" rule isn't affected.

## Order of work

1. **Readout first, then a baseline.** Build the readout (part 3) before touching any rendering. Record frame rate, frame time and draw calls at four scroll positions: the opening shot, mid-flight to Zhangjiajie, among the pillars, and Huangshan.
2. **Checkpoint with the learner.** Report the baseline. If draw calls turn out not to be the main cost (for example, a few hundred calls but the frame is still slow, which would point at pixel work: dpr, MSAA, shadow map), stop and decide together before building the instancing. The non-goals rule pixel-work changes out unless the learner reopens them.
3. Instanced sheets (part 1), then plaques (part 2).

## How we'll know it worked

- **Before/after numbers** from the readout at the same four scroll positions. Draw calls should drop to roughly 180–250, and frame time should fall.
- **Identical picture, judged by eye:** screenshots at the same scroll positions before and after, shown side by side to the learner, who signs off. Reduced motion freezes the camera drift for the comparison so the frames line up. There's no automated pixel diff (MSAA edges make exact matching noisy).
- The journey self-check in `journey.ts` stays silent, and `npx tsc --noEmit` passes.
- Not verifiable here: a real weak laptop. The learner can open the deployed site with `?stats` on one.

## Left to the builder

- Component and file structure for the instanced sheets (inside `World.tsx` or a new file under `world/`).
- Exactly how pieces are indexed and grouped, and when bounding spheres are recomputed, within the rules above.
- Readout styling and placement, as long as it stays out of the way of the intro text and the skip link.

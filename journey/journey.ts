// The master timeline. One number, `progress.p` in [0,1], decides everything:
// camera, Wukong, cloud, banking. `sample()` is a pure function of it, so
// scrolling backwards replays the journey exactly.
//
// To extend the journey, append a flight and an explore segment to SEGMENTS.
import * as THREE from 'three'
import { sections } from '../content/site'
import { FRAME, PERCH, fromHuangshanPerch as hp, toWorld, zhangjiajieExit, zhangjiajieStations, type Vec } from '../world/regions'

type Shot = { pos: Vec; look: Vec }
export type Explore = {
  kind: 'explore'; id: string; name: string; hanzi: string
  span: number // scroll length, in viewport heights
  perch: Vec // where Wukong arrives
  mood: number // 0 = pale daylight, 1 = sunset; flights blend between their two ends
  section?: string // key into content/site.ts `sections`
  // one of:
  shots?: Shot[] // a composed camera move; Wukong stays on his perch
  stations?: Vec[] // hover points Wukong flies between; a plaque hangs beside the perch and each station
}
export type Flight = { kind: 'flight'; id: string; span: number; path: Vec[] } // waypoints between two explores
export type Segment = Explore | Flight

const zj = (v: Vec) => toWorld(FRAME.zhangjiajie, v)
const hs = (v: Vec) => toWorld(FRAME.huangshan, v)
const workCount = sections.projects.projects?.length ?? 0
const researchCount = sections.research.projects?.length ?? 0

export const SEGMENTS: Segment[] = [
  {
    kind: 'explore', id: 'huaguo', name: 'Huaguo Shan', hanzi: '花果山', span: 1.6,
    perch: PERCH.huaguo, mood: 0,
    shots: [
      { pos: [0, 7, 26], look: [0, 10, -40] },
      { pos: [-2, 6.5, 15], look: [-3, 8.5, -40] },
    ],
  },
  {
    kind: 'flight', id: 'to-zhangjiajie', span: 4.2,
    path: [
      [-4.5, 8, -14], [-2, 11, -24], [4, 14, -42], [11, 20, -66], [16, 24, -90],
      [24, 26, -118], [42, 27.5, -160], [64, 28.5, -205],
      zj([-7, 31, 60]), zj([-6.5, 25, 30]),
    ],
  },
  {
    kind: 'explore', id: 'zhangjiajie', name: 'Zhangjiajie', hanzi: '张家界', span: 1.2 + 1.5 * workCount,
    section: 'projects',
    perch: PERCH.zhangjiajie, mood: 1,
    stations: zhangjiajieStations(workCount), // one per project
  },
  {
    kind: 'flight', id: 'to-huangshan', span: 8.5,
    // up out of the pillars, right round through most of a half-circle, then the long run south over the sea of clouds,
    // weaving a little (regions.ts scatters the clouds about x = -7 in Huangshan's frame)
    path: [
      ...zhangjiajieExit, hs([5, 20, 450]), hs([-19, 18, 300]), hs([-7, 14.5, 150]), hs([-6.5, 10.5, 90]),
      hp([1, 6, 50]), hp([0.5, 3.5, 28]),
    ],
  },
  {
    kind: 'explore', id: 'huangshan', name: 'Huangshan', hanzi: '黄山', span: 1.2 + 1.5 * researchCount,
    section: 'research',
    perch: PERCH.huangshan, mood: 1,
    // out over the sea of clouds toward the summits, one hover point per scroll; 30 apart like Zhangjiajie's,
    // so the next scroll stays beyond Plaques' 40-unit fade-in range until you leave the current one
    stations: Array.from({ length: researchCount }, (_, k) => hp([k % 2 ? -3 : 3, 4 + 3 * k, -30 * (k + 1)])),
  },
]

const LEAP = 0.1 // share of a flight Wukong spends crouching, backflipping and landing on his cloud before moving off
export const TAKEOFF = 0.2 // share of a flight spent blending from the composed shot to the chase camera
const SETTLE = 0.75 // viewport heights spent settling out of a flight
const FOV = { explore: 27, flight: 40 }
const CHASE = { back: 14, up: 2.2, ahead: 40, lift: 5, lag: 0.012 }
const STATION = { back: 17, right: 2.8, up: 1.5 } // camera behind a station; the plaque hangs 2x `right` from Wukong

export const TOTAL = SEGMENTS.reduce((a, s) => a + s.span, 0)
const starts = SEGMENTS.map((_, i) => SEGMENTS.slice(0, i).reduce((a, s) => a + s.span, 0) / TOTAL)
const settle = (s: Segment) => Math.min(0.5, SETTLE / s.span)

const V = (v: Vec) => new THREE.Vector3(...v)
const curve = (pts: Vec[]) => new THREE.CatmullRomCurve3(pts.map(V), false, 'centripetal')

// Each explore segment becomes camera curves (and, with stations, a curve for Wukong and plaque anchors).
export const ANCHORS: { id: string; pos: Vec }[] = []
const rigs = SEGMENTS.map((s, i) => {
  if (s.kind !== 'explore') return null
  if (!s.stations) return { n: s.shots!.length, pos: curve(s.shots!.map((x) => x.pos)), look: curve(s.shots!.map((x) => x.look)), wk: null }
  const pts = [s.perch, ...s.stations]
  const shots = pts.map((p, k) => {
    const q = k ? pts[k - 1] : (SEGMENTS[i - 1] as Flight).path.at(-1)! // face the way he came from
    const l = Math.hypot(p[0] - q[0], p[2] - q[2]), fx = (p[0] - q[0]) / l, fz = (p[2] - q[2]) / l
    const { back, right: r, up } = STATION, sx = -fz * r, sz = fx * r
    ANCHORS.push({ id: `plaque-${s.id}-${k}`, pos: [p[0] + sx * 2, p[1] + 2, p[2] + sz * 2] })
    return { pos: [p[0] - fx * back + sx, p[1] + up, p[2] - fz * back + sz] as Vec, look: [p[0] + fx * 40 + sx, p[1] + up, p[2] + fz * 40 + sz] as Vec }
  })
  return { n: pts.length, pos: curve(shots.map((x) => x.pos)), look: curve(shots.map((x) => x.look)), wk: curve(pts) }
})
const exit = (s: Explore) => s.stations?.at(-1) ?? s.perch
const curves = SEGMENTS.map((s, i) =>
  s.kind === 'flight' ? curve([exit(SEGMENTS[i - 1] as Explore), ...s.path, (SEGMENTS[i + 1] as Explore).perch]) : null,
)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => ((x = clamp01(x)), x * x * (3 - 2 * x))

export function locate(p: number) {
  let i = 0
  while (i < SEGMENTS.length - 1 && p >= starts[i + 1]) i++
  return { i, t: clamp01(((p - starts[i]) * TOTAL) / SEGMENTS[i].span) }
}

/** Progress at which a segment is settled and readable (used by the navigation). */
export const arrival = (i: number) => (i === 0 ? 0 : starts[i] + ((settle(SEGMENTS[i]) + 0.01) * SEGMENTS[i].span) / TOTAL)

export const progress = { p: 0 } // written by ScrollTrigger, read every frame
/** The opening: k runs 0 -> 1 once on load, carrying the camera `back` units forward out of the cave to the first shot. */
export const intro = { k: 1, back: 34 }

export const S = {
  cam: new THREE.Vector3(), look: new THREE.Vector3(), wk: new THREE.Vector3(),
  fov: FOV.explore, bank: 0, roll: 0, cloud: 0, mood: 0,
  // Wukong's acting, all 0..1 except flip (radians), lift and dip (world units)
  crouch: 0, tuck: 0, ride: 0, flip: 0, lift: 0, dip: 0,
}
const bump = (x: number, a: number, b: number, c: number) => smooth((x - a) / (b - a)) * (1 - smooth((x - b) / (c - b)))
const h = new THREE.Vector3(), h2 = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3()
const turn = (c: THREE.Curve<THREE.Vector3>, t: number, d: number, arc = true) => {
  const tan = (x: number, out: THREE.Vector3) => (arc ? c.getTangentAt(clamp01(x), out) : c.getTangent(clamp01(x), out)).setY(0).normalize()
  tan(t - d, h); tan(t + d, h2)
  return h.x * h2.z - h.z * h2.x // > 0 turning right
}

/** Composed camera for explore segment `i` at local time `st`; moves Wukong too if the segment has stations. */
function explore(i: number, st: number, o: typeof S) {
  const g = rigs[i]!
  const x = st * (g.n - 1), k = Math.min(g.n - 2, Math.floor(x)), f = x - k
  const u = (k + (g.wk ? f * 0.35 + smooth(f) * 0.65 : f)) / (g.n - 1) // linger at each station
  g.pos.getPoint(u, o.cam); g.look.getPoint(u, o.look)
  if (g.wk) {
    g.wk.getPoint(u, o.wk)
    o.bank = THREE.MathUtils.clamp(turn(g.wk, u, 0.03, false) * 3, -0.35, 0.35)
    o.cloud = o.ride = 1
  } else {
    o.wk.set(...(SEGMENTS[i] as Explore).perch)
    o.bank = 0
  }
}

/** Blend the camera toward the chase position behind Wukong on flight `fi` at `ft`. */
function chase(fi: number, ft: number, w: number, o: typeof S) {
  const c = curves[fi]!
  // the camera trails slightly behind the turn, so Wukong visibly leads into it
  c.getTangentAt(clamp01(ft - CHASE.lag), h).setY(0).normalize()
  a.copy(o.wk).addScaledVector(h, -CHASE.back); a.y += CHASE.up
  b.copy(o.wk).addScaledVector(h, CHASE.ahead); b.y += CHASE.lift
  o.cam.lerp(a, w); o.look.lerp(b, w)
}

export function sample(p: number, o = S) {
  const { i, t } = locate(p)
  const s = SEGMENTS[i]
  let w = 0
  o.cloud = o.crouch = o.tuck = o.ride = o.flip = o.lift = o.dip = 0
  if (s.kind === 'flight') {
    const from = SEGMENTS[i - 1] as Explore, to = SEGMENTS[i + 1] as Explore
    explore(i - 1, 1, o) // take off from wherever the last composed shot ended
    const leap = o.cloud ? 0 : LEAP // already on the cloud: no need to jump onto it
    const ft = smooth((t - leap) / (1 - leap))
    w = smooth(t / TAKEOFF)
    curves[i]!.getPointAt(ft, o.wk)
    chase(i, ft, w, o)
    o.bank = THREE.MathUtils.clamp(turn(curves[i]!, ft, 0.03) * 5, -0.5, 0.5) * Math.sin(Math.PI * ft) ** 0.5
    o.mood = from.mood + (to.mood - from.mood) * smooth((ft - 0.3) / 0.5)
    if (leap) {
      // a: the leap's own clock. crouch -> spring up into a backflip -> the cloud sweeps in -> land, sink, recover
      const a = clamp01((t / leap) * 0.7), j = clamp01((a - 0.15) / 0.55), x = clamp01((a - 0.7) / 0.3)
      o.crouch = bump(a, 0, 0.1, 0.2) + bump(a, 0.64, 0.74, 0.95)
      o.tuck = Math.sin(Math.PI * j) ** 0.6
      o.flip = Math.PI * 2 * smooth(j)
      o.lift = Math.sin(Math.PI * j) * 2.6
      o.dip = -0.45 * Math.exp(-4 * x) * Math.sin(11 * x)
      o.ride = smooth((a - 0.74) / 0.2)
      o.cloud = smooth((a - 0.3) / 0.35)
    }
  } else {
    const st = i ? clamp01((t - settle(s)) / (1 - settle(s))) : t
    explore(i, st, o)
    o.mood = s.mood
    if (i) {
      w = 1 - smooth(t / settle(s))
      if (w > 0) chase(i - 1, 1, w, o)
      o.cloud = Math.max(o.cloud, w)
      o.ride = Math.max(o.ride, w)
    }
  }
  o.fov = FOV.explore + (FOV.flight - FOV.explore) * w
  o.roll = o.bank * 0.3 * w
  return o
}

// self-check: the camera never jumps and never goes non-finite anywhere on the timeline
if (process.env.NODE_ENV !== 'production') {
  const prev = new THREE.Vector3(), probe = { ...S, cam: new THREE.Vector3(), look: new THREE.Vector3(), wk: new THREE.Vector3() }
  const n = Math.ceil(TOTAL * 140) // samples per viewport height of scroll, so a longer journey isn't sampled more coarsely
  for (let k = 0; k <= n; k++) {
    sample(k / n, probe)
    console.assert(Number.isFinite(probe.cam.lengthSq() + probe.look.lengthSq() + probe.wk.lengthSq()), 'journey: non-finite at', k)
    console.assert(k === 0 || prev.distanceTo(probe.cam) < 2, 'journey: camera jump at', k / n)
    prev.copy(probe.cam)
  }
}

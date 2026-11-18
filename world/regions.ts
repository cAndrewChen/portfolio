// Where every sheet of paper sits. Each region has its own frame (origin + yaw)
// so its sheets face the direction Wukong arrives from. Pure data: no three.js here.
import { FALLS, rand, shape, type Kind, type Tone } from '../art/ink'
import { sections } from '../content/site'

export type Vec = [number, number, number]
export type Piece = {
  kind: Kind | 'mist' | 'water' | 'sun' | 'cave'
  seed?: number
  at: Vec // bottom-centre, in the region's frame
  size: [number, number]
  ink?: number // ink strength; foreground sheets are painted darker
  flip?: boolean
  hole?: [number, number] // cave sheets: the opening's radii, as fractions of the sheet
  tone?: Tone // which painting the brushwork is cut from
  yaw?: number // turned about its upright, within its region; otherwise it faces the region's +z
}
export type Region = { id: string; origin: Vec; yaw: number; pieces: Piece[] }

export const toWorld = (r: { origin: Vec; yaw: number }, [x, y, z]: Vec): Vec => {
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw)
  return [r.origin[0] + x * c + z * s, r.origin[1] + y, r.origin[2] - x * s + z * c]
}

/** A point standing on the cut edge of a sheet, `xn` of the way across it. */
const on = (p: Piece, xn: number, dz = 0.2): Vec => [
  p.at[0] + (xn - 0.5) * p.size[0],
  p.at[1] + p.size[1] * shape(p.kind as Kind, p.seed!).top(xn),
  p.at[2] + dz,
]


// ---- Huaguo Shan: a composed painting, layers stepping back from the viewer

const ledge: Piece = { kind: 'ridge', seed: 11, at: [-12, -6, -6], size: [26, 18], ink: 1.5, tone: 'ink' }
const fallsCliff: Piece = { kind: 'falls', seed: 22, at: [19, -30, -24], size: [40, 58], ink: 1.3 }
const fallsTop = shape('falls', 22).top(FALLS.x) - FALLS.drop
const pineSpot = on(ledge, 0.3, 0.3)

const huaguo: Region = {
  id: 'huaguo', origin: [0, 0, 0], yaw: 0,
  pieces: [
    ledge,
    { kind: 'pine', seed: 1, at: [pineSpot[0], pineSpot[1] - 1, pineSpot[2]], size: [8, 8] },
    { kind: 'ridge', seed: 12, at: [18, -6, 2], size: [24, 14], ink: 1.5, tone: 'ink' },
    { kind: 'pine', seed: 2, at: [15, 0.5, 2.3], size: [9, 9], flip: true },
    { kind: 'peak', seed: 21, at: [-32, -30, -20], size: [44, 60], ink: 1.4 },
    fallsCliff,
    { kind: 'water', at: [19 + (FALLS.x - 0.5) * 40, -30 + 58 * 0.2, -23.8], size: [40 * FALLS.half * 2, 58 * (fallsTop - 0.2)] },
    { kind: 'peak', seed: 32, at: [-26, -30, -44], size: [46, 72] },
    { kind: 'ridge', seed: 31, at: [34, -30, -40], size: [50, 50] },
    { kind: 'peak', seed: 41, at: [-10, -30, -66], size: [52, 62] },
    { kind: 'ridge', seed: 51, at: [-50, -30, -88], size: [90, 60], tone: 'blue' },
    { kind: 'ridge', seed: 52, at: [62, -30, -84], size: [80, 56], flip: true, tone: 'blue' },
    { kind: 'ridge', seed: 61, at: [-40, -30, -112], size: [150, 66], tone: 'blue', ink: 0.6 },
    { kind: 'cloud', seed: 80, at: [8, -1, -15], size: [18, 5] },
    { kind: 'cloud', seed: 81, at: [22, 5, -32], size: [30, 8] },
    { kind: 'cloud', seed: 82, at: [-24, 8, -54], size: [34, 9] },
    { kind: 'cloud', seed: 83, at: [50, 3, -60], size: [40, 10] },
    { kind: 'cloud', seed: 84, at: [26, 0, -76], size: [44, 10] },
    { kind: 'cloud', seed: 80, at: [-30, 5, -100], size: [70, 14], flip: true },
    // the Water Curtain Cave: two walls and a curtain of water on the opening camera's line of sight (see INTRO in journey.ts)
    { kind: 'cave', seed: 5, at: [0, -14.1, 50], size: [60, 40], hole: [0.037, 0.04] },
    { kind: 'cave', seed: 6, at: [0, -13.45, 36], size: [60, 40], hole: [0.07, 0.075] },
    { kind: 'water', at: [0, 2.2, 35.4], size: [11, 9] },
    { kind: 'mist', at: [0, 4.4, 34.6], size: [16, 5] },
    { kind: 'mist', at: [20, -4, -10], size: [90, 16] },
    { kind: 'mist', at: [0, -2, -30], size: [120, 22] },
    { kind: 'mist', at: [-10, 2, -60], size: [160, 26] },
  ],
}

// ---- the sea of clouds crossed on the way

const r1 = rand(7)
const crossing: Region = {
  id: 'crossing', origin: [40, 0, -170], yaw: -0.26,
  pieces: [
    { kind: 'peak', seed: 21, at: [-38, -30, 20], size: [40, 62], flip: true, tone: 'blue' },
    { kind: 'peak', seed: 41, at: [46, -30, -4], size: [38, 58], flip: true, tone: 'ink' },
    { kind: 'peak', seed: 32, at: [-36, -30, -50], size: [42, 70], tone: 'dusk' },
    { kind: 'peak', seed: 21, at: [60, -30, -72], size: [46, 76], tone: 'dusk' },
    ...Array.from({ length: 14 }, (_, i): Piece => ({
      kind: 'cloud', seed: 80 + (i % 5), flip: i % 3 === 0,
      at: [(r1() - 0.5) * 200, -14 + r1() * 14, 70 - i * 12], size: [60 + r1() * 50, 14 + r1() * 8],
    })),
    // small clouds beside the flight line, close enough to sweep past the camera
    ...Array.from({ length: 10 }, (_, i): Piece => {
      const z = 60 - i * 14, side = i % 2 ? 1 : -1
      return {
        kind: 'cloud', seed: 80 + (i % 5),
        at: [side * (22 + r1() * 16) + Math.max(0, -z) * 0.35, 17 + r1() * 16, z], size: [14 + r1() * 10, 4.5 + r1() * 3],
      }
    }),
    { kind: 'mist', at: [0, 0, 0], size: [240, 30] },
  ],
}

// ---- Zhangjiajie: a forest of sandstone pillars standing in cloud

const perchPillar: Piece = { kind: 'pillar', seed: 71, at: [-6, -40, 12], size: [10, 62], tone: 'dusk' }
const perch = on(perchPillar, 0.5)

/** Hover points deeper into the forest, one per project, weaving between the pillars (region frame). */
const stationsLocal = (n: number): Vec[] =>
  Array.from({ length: n }, (_, k) => [perch[0] + (k % 2 ? -2 : 7), perch[1] + 3 + 2.5 * (k + 1), perch[2] - 30 * (k + 1)])

// Sheets are kept off the flight line: Wukong and the camera on its left, the plaque on its right.
const line: Vec[] = [[-6.5, 0, 60], perch, ...stationsLocal(8)]
const lineX = (z: number) => {
  for (let i = 1; i < line.length; i++)
    if (z >= line[i][2]) { const [p, q] = [line[i - 1], line[i]]; return p[0] + ((q[0] - p[0]) * (p[2] - z)) / (p[2] - q[2]) }
  return null
}
const clear = (x: number, z: number, r: () => number) => {
  const c = lineX(z)
  if (c === null) return x
  const dx = x - c
  return dx > -11 && dx < 18 ? (dx < 3.5 ? c - 11 - r() * 9 : c + 18 + r() * 9) : x
}

const r2 = rand(99)
const zhangjiajie: Region = {
  id: 'zhangjiajie', origin: [120, 0, -300], yaw: -Math.PI / 6,
  pieces: [
    perchPillar,
    { kind: 'pillar', seed: 75, at: [-30, -40, 24], size: [12, 80], ink: 1.5, tone: 'dusk' },
    { kind: 'pillar', seed: 73, at: [27, -40, 20], size: [11, 72], ink: 1.5, tone: 'dusk' },
    ...Array.from({ length: 64 }, (_, i): Piece => {
      const z = 4 - i * 4.4 - r2() * 3
      return { kind: 'pillar', seed: 70 + (i % 6), tone: 'dusk', flip: r2() < 0.5, at: [clear((r2() - 0.5) * (80 + i * 1.5), z, r2), -40, z], size: [7 + r2() * 6, 56 + r2() * 50] }
    }),
    ...Array.from({ length: 22 }, (_, i): Piece => ({
      kind: 'cloud', seed: 80 + (i % 5), flip: i % 2 === 0,
      at: [(r2() - 0.5) * 170, -16 + r2() * 12, 30 - i * 13], size: [50 + r2() * 50, 12 + r2() * 6],
    })),
    ...Array.from({ length: 18 }, (_, i): Piece => {
      const z = -5 - i * 14
      return { kind: 'cloud', seed: 80 + (i % 5), at: [clear((r2() - 0.5) * 120, z, r2), 12 + r2() * 34, z], size: [18 + r2() * 20, 5 + r2() * 4] }
    }),
    { kind: 'mist', at: [0, -4, -20], size: [200, 30] },
    { kind: 'mist', at: [0, 2, -70], size: [260, 36] },
    { kind: 'mist', at: [0, 6, -130], size: [300, 40] },
    { kind: 'mist', at: [0, 8, -200], size: [320, 40] },
    { kind: 'sun', at: [-60, 60, -420], size: [150, 150] },
  ],
}

// ---- Huangshan: three granite summits standing out of a sea of cloud.
// The map: Zhangjiajie, Huangshan and (later) Huanglong stand at the corners of a triangle around Huaguo Shan. So Huangshan is
// Zhangjiajie swung 120 degrees clockwise about the world origin, and the flight there swings right through most of a
// half-circle out of the pillars, then runs back south, passing Huaguo Shan well off to the right.

// Where Wukong leaves Zhangjiajie (his last station), and his climb out over the pillar tops as the turn begins.
// shortcut: the climb needs ~90 units of cleared corridor past the last station, which `line` gives up to 5 projects; lengthen `line` beyond that.
const exit0 = stationsLocal(sections.projects.projects?.length ?? 0).at(-1) ?? perch
const exitClimb: Vec[] = ([[3, 0.26, -30], [8, 0.65, -62], [15, 1, -90]] as Vec[]).map(
  ([dx, k, dz]): Vec => [exit0[0] + dx, exit0[1] + (70 - exit0[1]) * k, exit0[2] + dz],
)
// the turn, flown level above the pillar tops: a circle to the right. Headings are radians right of Zhangjiajie's forward.
const TURN = { r: 80, from: 0.245, to: 3 }
const exitTurn: Vec[] = Array.from({ length: 6 }, (_, k): Vec => {
  const p = exitClimb[2], a = TURN.from + ((k + 1) / 6) * (TURN.to - TURN.from)
  return [p[0] + TURN.r * (Math.cos(TURN.from) - Math.cos(a)), p[1], p[2] - TURN.r * (Math.sin(a) - Math.sin(TURN.from))]
})

const hsLedge: Piece = { kind: 'ridge', seed: 13, at: [-10, -8, -6], size: [30, 20], ink: 1.5, tone: 'ink' }
const hsRock: Piece = { kind: 'ridge', seed: 14, at: [19, -7, 1], size: [24, 14], ink: 1.5, tone: 'ink' }
const hsPerch = on(hsLedge, 0.6)
const greeter = on(hsLedge, 0.5, 0.3), rockPine = on(hsRock, 0.4, 0.3)
// Wukong's perch here is Zhangjiajie's perch swung 120 degrees clockwise about the origin; the region faces the run in from the end of the turn
const zjPerch = toWorld(zhangjiajie, perch), turnEnd = toWorld(zhangjiajie, exitTurn[5])
const hsAt = [-zjPerch[0] / 2 - (zjPerch[2] * Math.sqrt(3)) / 2, (zjPerch[0] * Math.sqrt(3)) / 2 - zjPerch[2] / 2]
const hsYaw = Math.atan2(turnEnd[0] - hsAt[0], turnEnd[2] - hsAt[1])
const hsOff = toWorld({ origin: [0, 0, 0], yaw: hsYaw }, [hsPerch[0], 0, hsPerch[2]])
// the arriving flight line in this frame (see `to-huangshan` in journey.ts) runs in along x = -7: clouds are scattered about it
const flightY = (z: number) => Math.min(20, 6 + z * 0.06)

const r3 = rand(41)
const huangshan: Region = {
  id: 'huangshan', origin: [hsAt[0] - hsOff[0], 50, hsAt[1] - hsOff[2]], yaw: hsYaw,
  pieces: [
    hsLedge,
    { kind: 'pine', seed: 3, at: [greeter[0], greeter[1] - 1, greeter[2]], size: [6.5, 6.5] }, // the Welcoming Pine
    hsRock,
    { kind: 'pine', seed: 4, at: [rockPine[0], rockPine[1] - 1, rockPine[2]], size: [8, 8], flip: true },
    // the three summits
    { kind: 'peak', seed: 23, at: [14, -30, -70], size: [30, 62], ink: 1.3, tone: 'ink' }, // Celestial Capital Peak 天都峰: the steep one
    { kind: 'ridge', seed: 16, at: [-26, -30, -90], size: [60, 68], ink: 1.2, tone: 'ink' }, // Bright Summit 光明顶: a broad dome
    { kind: 'peak', seed: 33, at: [-3, -30, -115], size: [56, 85], ink: 1.1, tone: 'ink' }, // Lotus Peak 莲花峰: the highest
    { kind: 'ridge', seed: 52, at: [60, -30, -140], size: [90, 62], flip: true, tone: 'dusk' },
    { kind: 'ridge', seed: 51, at: [-55, -30, -150], size: [100, 70], tone: 'dusk' },
    { kind: 'ridge', seed: 61, at: [0, -30, -185], size: [190, 80], tone: 'dusk', ink: 0.6 },
    { kind: 'cloud', seed: 80, at: [10, -2, -20], size: [20, 6] },
    { kind: 'cloud', seed: 81, at: [26, -4, -40], size: [30, 8] },
    { kind: 'cloud', seed: 82, at: [-20, 2, -45], size: [34, 9] },
    { kind: 'cloud', seed: 83, at: [-6, -6, -63], size: [44, 11] }, // under the last station: any higher and it swallows Wukong
    { kind: 'cloud', seed: 84, at: [40, 2, -97], size: [40, 10] },
    { kind: 'cloud', seed: 80, at: [-40, 4, -120], size: [70, 14], flip: true },
    // the sea of clouds flown over on the way in, kept below the flight line
    // cloud banked against the foot of the two foreground crags, so the flight in never sees their cut lower edge
    { kind: 'cloud', seed: 82, at: [-10, -15, -5.4], size: [44, 11] },
    { kind: 'cloud', seed: 84, at: [19, -14, 1.6], size: [36, 10], flip: true },
    { kind: 'cloud', seed: 81, at: [-24, -20, 44], size: [50, 13] },
    { kind: 'cloud', seed: 83, at: [22, -22, 50], size: [56, 14], flip: true },
    ...Array.from({ length: 40 }, (_, i): Piece => {
      const z = 606 - i * 14
      return { kind: 'cloud', seed: 80 + (i % 5), flip: i % 3 === 0, at: [-7 + (r3() - 0.5) * 220, -24 + r3() * 12, z], size: [60 + r3() * 50, 12 + r3() * 6] }
    }),
    // small clouds beside the flight line, close enough to sweep past the camera
    ...Array.from({ length: 20 }, (_, i): Piece => {
      const z = 585 - i * 27, side = i % 2 ? 1 : -1
      return { kind: 'cloud', seed: 80 + (i % 5), at: [-7 + side * (32 + r3() * 14), flightY(z) - 4 + r3() * 12, z], size: [14 + r3() * 10, 4.5 + r3() * 3] }
    }),
    { kind: 'mist', at: [0, -16, 523], size: [300, 34] },
    { kind: 'mist', at: [0, -16, 327], size: [300, 34] },
    { kind: 'mist', at: [10, -16, 125], size: [280, 34] },
    { kind: 'mist', at: [0, -4, -30], size: [130, 22] },
    { kind: 'mist', at: [-10, 0, -82], size: [190, 28] }, // never at the same depth as a sheet it overlaps: coplanar sheets flicker
    { kind: 'mist', at: [0, 2, -160], size: [280, 36] },
  ],
}

// ---- the flights (journey.ts flies these waypoints) and the scenery standing along them

/** Huaguo Shan to Zhangjiajie, in world space. */
export const toZhangjiajie: Vec[] = [
  [-4.5, 8, -14], [-2, 11, -24], [4, 14, -42], [11, 20, -66], [16, 24, -90],
  [24, 26, -118], [42, 27.5, -160], [64, 28.5, -205],
  toWorld(zhangjiajie, [-7, 31, 60]), toWorld(zhangjiajie, [-6.5, 25, 30]),
]
/** Zhangjiajie to Huangshan, in world space: up out of the pillars, right round through most of a half-circle, then the run
 *  south over the sea of clouds, weaving a little (the clouds above are scattered about x = -7 in Huangshan's frame).
 *  journey.ts adds the approach to the perch. */
export const toHuangshan: Vec[] = [
  ...[...exitClimb, ...exitTurn].map((v) => toWorld(zhangjiajie, v)),
  ...([[5, 20, 450], [-19, 18, 300], [-7, 14.5, 150], [-6.5, 10.5, 90]] as Vec[]).map((v) => toWorld(huangshan, v)),
]

const nProj = sections.projects.projects?.length ?? 0, nRes = sections.research.projects?.length ?? 0
const nearHs = (d: Vec): Vec => toWorld(huangshan, [hsPerch[0] + d[0], hsPerch[1] + d[1], hsPerch[2] + d[2]])
/** Everywhere the camera goes, in journey order: both flights, Zhangjiajie's stations, Huangshan's approach and stations. */
const route: Vec[] = [
  ...toZhangjiajie, toWorld(zhangjiajie, perch), ...stationsLocal(nProj).map((v) => toWorld(zhangjiajie, v)), ...toHuangshan,
  nearHs([1, 6, 50]), nearHs([0.5, 3.5, 28]), nearHs([0, 0, 0]), ...Array.from({ length: nRes }, (_, k) => nearHs([0, 4 + 3 * k, -30 * (k + 1)])),
]
const PILLARS = [7, toZhangjiajie.length + 1 + nProj + 8] // route segments near which the land is Zhangjiajie's: the approach through the turn

/** The nearest point of the route to (x, z): its distance, height, position and place along the route (segment index + fraction). */
function nearest(x: number, z: number) {
  const q = { d: Infinity, y: 0, x: 0, z: 0, at: 0 }
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[2] - a[2]
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)))
    const px = a[0] + dx * t, pz = a[2] + dz * t, d = Math.hypot(x - px, z - pz)
    if (d < q.d) Object.assign(q, { d, y: a[1] + (b[1] - a[1]) * t, x: px, z: pz, at: i - 1 + t })
  }
  return q
}
/** The route `back` units (along it) before place `at`: where the camera is coming from. */
const segLen = route.slice(1).map((b, i) => Math.hypot(b[0] - route[i][0], b[2] - route[i][2]))
function before(at: number, back: number): [number, number] {
  let i = Math.min(Math.floor(at), segLen.length - 1), left = (at - i) * segLen[i] - back
  while (left < 0 && i > 0) left += segLen[--i]
  const t = Math.max(0, left / segLen[i]), a = route[i], b = route[i + 1]
  return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]
}
const summit = (k: Kind, seed: number) => {
  const s = shape(k, seed)
  let b = 0.5
  for (let x = 0.2; x <= 0.8; x += 0.05) if (s.top(x) > s.top(b)) b = x
  return b
}

// ---- terrain everywhere: rock fills the land round the whole route, out to where the fog takes it, so whichever way the
// camera looks there is something near and far. Each sheet turns to face the stretch of route the camera approaches it along
// (facing straight across to the route, the ones nearby were seen edge-on as the camera came up to them).
const GAP = 20 // nothing comes nearer the route than this
const SEE = 300 // and nothing is placed further than this (fog: World.tsx)
const land: Piece[] = (() => {
  const r = rand(123), xs = route.map((v) => v[0]), zs = route.map((v) => v[2]), out: { at: number; p: Piece[] }[] = []
  const c = Math.cos(huangshan.yaw), s = Math.sin(huangshan.yaw)
  for (let gx = Math.min(...xs) - SEE; gx < Math.max(...xs) + SEE; gx += 34)
    for (let gz = Math.min(...zs) - SEE; gz < Math.max(...zs) + SEE; gz += 34) {
      const x = gx + (r() - 0.5) * 30, z = gz + (r() - 0.5) * 30, q = nearest(x, z), d = q.d
      if (d > SEE || (d > 130 && r() < 0.45) || Math.hypot(x, z) < 150) continue // Huaguo Shan is its own composed painting
      const hx = (x - huangshan.origin[0]) * c - (z - huangshan.origin[2]) * s, hz = (x - huangshan.origin[0]) * s + (z - huangshan.origin[2]) * c
      if (Math.abs(hx - hsPerch[0]) < 60 && hz > -200 && hz < 30) continue // keep the view out to Huangshan's summits clear
      const [bx, bz] = before(q.at, 90), yaw = Math.atan2(bx - x, bz - z), fx = Math.sin(yaw), fz = Math.cos(yaw)
      const pillar = q.at >= PILLARS[0] && q.at <= PILLARS[1]
      const wide = !pillar && d > 120
      const h = pillar ? 56 + r() * 50 + d * 0.35 : 32 + d * 0.45 + r() * 18
      const w = pillar ? (7 + r() * 6) * (1 + d / 60) : h * (wide ? 1.6 + r() * 0.6 : 0.5 + r() * 0.3)
      // the sheet's two edges must stay clear of the route too, where it bends
      if ([-1, 1].some((e) => nearest(x + e * fz * w / 2, z - e * fx * w / 2).d < GAP) || d < GAP + 4) continue
      const base = pillar ? -40 : q.y - 45 - d * 0.08, ps: Piece[] = []
      const i = out.length, tones: Tone[] = q.at < PILLARS[0] ? ['jade', 'blue', 'ink'] : ['dusk', 'ink']
      const kind: Kind = pillar ? 'pillar' : wide ? 'ridge' : 'peak'
      const seed = pillar ? 70 + (i % 6) : wide ? [51, 52, 61][i % 3] : [21, 32, 41][i % 3]
      const pine = !pillar && !wide && d < 90 && r() < 0.6
      ps.push({ kind, seed, yaw, tone: pillar ? 'dusk' : tones[i % tones.length], flip: !pine && r() < 0.5, at: [x, base, z], size: [w, h] })
      if (pine) {
        const ox = (summit(kind, seed) - 0.5) * w, t = shape(kind, seed).top(summit(kind, seed)) * h, sz = w * 0.4
        ps.push({ kind: 'pine', seed: 1 + (i % 4), yaw, at: [x + ox * fz + 0.3 * fx, base + t - 1, z - ox * fx + 0.3 * fz], size: [sz, sz] })
      }
      // a bank of cloud in front of its foot, so the cut lower edge never shows
      const cw = pillar ? 30 + r() * 30 + d * 0.2 : Math.min(w * 1.3 + 8, 70)
      if (d < 200 && (!pillar || r() < 0.45))
        ps.push({ kind: 'cloud', seed: 80 + (i % 5), yaw, flip: r() < 0.5, at: [x + fx * 2, pillar ? -16 + r() * 14 : base - 2, z + fz * 2], size: [Math.min(cw, 2 * (d - GAP)), Math.min(cw, 2 * (d - GAP)) * 0.28] })
      out.push({ at: q.at, p: ps })
    }
  return out.sort((a, b) => a.at - b.at).flatMap((o) => o.p) // built in journey order
})()

// The land mounts after Zhangjiajie (World builds in this order), which must be in before the opening flight lands.
export const REGIONS: Region[] = [huaguo, crossing, zhangjiajie, { id: 'land', origin: [0, 0, 0], yaw: 0, pieces: land }, huangshan]
export const FRAME = { huaguo, crossing, zhangjiajie, huangshan }

/** Where Wukong stands in each region, in world space. */
export const PERCH = {
  huaguo: on(ledge, 0.73),
  zhangjiajie: toWorld(zhangjiajie, perch),
  huangshan: toWorld(huangshan, hsPerch),
}

export const zhangjiajieStations = (n: number) => stationsLocal(n).map((v) => toWorld(zhangjiajie, v))

/** A point `d` away from Wukong's Huangshan perch (in Huangshan's frame), in world space. */
export const fromHuangshanPerch = (d: Vec): Vec => toWorld(huangshan, [hsPerch[0] + d[0], hsPerch[1] + d[1], hsPerch[2] + d[2]])

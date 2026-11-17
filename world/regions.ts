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
const exit0 = stationsLocal(sections.work.projects?.length ?? 0).at(-1) ?? perch
const exitClimb: Vec[] = ([[3, 0.26, -30], [8, 0.65, -62], [15, 1, -90]] as Vec[]).map(
  ([dx, k, dz]): Vec => [exit0[0] + dx, exit0[1] + (70 - exit0[1]) * k, exit0[2] + dz],
)
// the turn, flown level above the pillar tops: a circle to the right. Headings are radians right of Zhangjiajie's forward.
const TURN = { r: 120, from: 0.245, to: 3 }
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
    { kind: 'cloud', seed: 83, at: [-6, 0, -63], size: [44, 11] },
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

export const REGIONS: Region[] = [huaguo, crossing, zhangjiajie, huangshan]
export const FRAME = { huaguo, crossing, zhangjiajie, huangshan }

/** Where Wukong stands in each region, in world space. */
export const PERCH = {
  huaguo: on(ledge, 0.73),
  zhangjiajie: toWorld(zhangjiajie, perch),
  huangshan: toWorld(huangshan, hsPerch),
}

export const zhangjiajieStations = (n: number) => stationsLocal(n).map((v) => toWorld(zhangjiajie, v))

/** The climb out of Zhangjiajie from the last station and the turn back south, in world space. */
export const zhangjiajieExit = [...exitClimb, ...exitTurn].map((v) => toWorld(zhangjiajie, v))

/** A point `d` away from Wukong's Huangshan perch (in Huangshan's frame), in world space. */
export const fromHuangshanPerch = (d: Vec): Vec => toWorld(huangshan, [hsPerch[0] + d[0], hsPerch[1] + d[1], hsPerch[2] + d[2]])

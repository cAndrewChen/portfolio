// Procedural ink-on-paper art. Every piece is a sheet of ivory paper, cut to a
// silhouette, with ink painted on it. To swap in hand-painted artwork later,
// make `texture()` return a loaded PNG for a given kind/seed; nothing else changes.
import * as THREE from 'three'

export const PAPER = '#efe5cf'
export const MIST = '#e6dcc6'
const RIM = 'rgba(249,243,229,.92)' // the pale core of the paper showing at a cut edge
const ink = (a: number) => `rgba(28,25,22,${a})`

/** Which real painting a sheet's brushwork is cut from (files in public/paintings). */
export type Tone = 'jade' | 'blue' | 'ink' | 'dusk'
const SOURCES: Record<Tone, string[]> = {
  jade: ['jade-a', 'jade-b', 'jade-c', 'jade-d'], // Wang Hui, Mount Tai, blue-green
  blue: ['blue-a', 'blue-c'], // the same, washed to distant indigo
  ink: ['ink-a', 'ink-b', 'ink-c'], // Qu Ding, Summer Mountains
  dusk: ['dusk-a', 'dusk-b', 'dusk-c'], // Mount Tai again, toned to sunset sienna
}
const FADE: Record<Tone, string> = { jade: '239,229,207', blue: '226,230,220', ink: '232,224,204', dusk: '246,208,158' }
const imgs = new Map<string, HTMLImageElement>()
/** Load the painting crops. A missing file is fine: that sheet falls back to procedural brushwork. */
export const loadPaintings = () =>
  Promise.all([...Object.values(SOURCES).flat().map((n) => n + '.jpg'), 'range.webp', 'weave.jpg'].map((file) => new Promise<void>((done) => {
    const im = new Image()
    im.onload = () => { imgs.set(file.split('.')[0], im); done() }
    im.onerror = () => done()
    im.src = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/paintings/${file}`
  })))

export type Kind = 'ridge' | 'peak' | 'falls' | 'pillar' | 'pine' | 'cloud'
type Pt = [number, number]
type Shape = { w: number; h: number; ridge: Pt[]; outline: Pt[]; top: (xn: number) => number }

const DIM: Record<Kind, Pt> = {
  ridge: [1280, 640], peak: [768, 1024], falls: [768, 1024],
  pillar: [384, 1536], pine: [512, 512], cloud: [1024, 384],
}
/** Where the waterfall sits on a `falls` sheet: x centre, half-width, as fractions of width. */
export const FALLS = { x: 0.5, half: 0.03, drop: 0.07 }

export const rand = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function fbm(r: () => number, oct = 5) {
  const tab = Array.from({ length: oct }, () => Array.from({ length: 64 }, r))
  return (x: number) => {
    let v = 0, a = 0.5, f = 1, n = 0
    for (let o = 0; o < oct; o++) {
      const xi = x * f, i = Math.floor(xi), u = xi - i, s = u * u * (3 - 2 * u)
      v += a * (tab[o][i & 63] * (1 - s) + tab[o][(i + 1) & 63] * s)
      n += a; a *= 0.5; f *= 2
    }
    return v / n
  }
}

// ---- silhouettes (pure: safe on the server, used to stand things on top of them)

const shapes = new Map<string, Shape>()
export function shape(kind: Kind, seed: number): Shape {
  const key = kind + seed
  if (shapes.has(key)) return shapes.get(key)!
  const [w, h] = DIM[kind]
  const r = rand(seed), n = fbm(r)
  const ridge: Pt[] = []
  if (kind === 'pillar') {
    const L = (y: number) => w * (0.27 - (0.07 * y) / h) + (n(y / 110) - 0.5) * w * 0.2 + (n(y / 23 + 9) - 0.5) * w * 0.05
    const R = (y: number) => w * (0.73 + (0.07 * y) / h) + (n(y / 110 + 31) - 0.5) * w * 0.2 + (n(y / 23 + 47) - 0.5) * w * 0.05
    const y0 = h * 0.07
    for (let y = h; y > y0; y -= 8) ridge.push([L(y), y])
    const a = L(y0), b = R(y0)
    for (let i = 0; i <= 24; i++) {
      const s = i / 24
      ridge.push([a + (b - a) * s, y0 - Math.sin(Math.PI * s) * h * 0.018 - n(s * 6 + 70) * h * 0.02])
    }
    for (let y = y0; y <= h; y += 8) ridge.push([R(y), y])
  } else if (kind !== 'pine' && kind !== 'cloud') {
    const c = 0.35 + 0.3 * r()
    for (let x = 0; x <= w; x += 4) {
      const s = x / w
      let f: number
      if (kind === 'ridge') {
        const d = Math.sin(Math.PI * s) ** 0.7
        f = d * (0.3 + 0.6 * n(s * 5)) + (n(s * 26) - 0.5) * 0.07 * d
      } else {
        const d = s < c ? s / c : (1 - s) / (1 - c)
        f = d ** 0.9 * 0.5 + d ** 3 * 0.22 + Math.min(d * 5, 1) * 0.06 + (n(s * 5) - 0.5) * 0.4 * Math.sqrt(d) + (n(s * 30) - 0.5) * 0.05 * d
      }
      ridge.push([x, h * (1 - Math.min(0.97, Math.max(0, f)))])
    }
  }
  const outline: Pt[] = kind === 'pillar' ? ridge : [[0, h], ...ridge, [w, h]]
  const top = (xn: number) => {
    let y = h
    for (const p of ridge) if (Math.abs(p[0] - xn * w) < 8 && p[1] < y) y = p[1]
    return 1 - y / h
  }
  const s = { w, h, ridge, outline, top }
  shapes.set(key, s)
  return s
}

// ---- brushes

type Ctx = CanvasRenderingContext2D
function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d')!] as const
}
function trace(ctx: Ctx, pts: Pt[], close = true) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (close) ctx.closePath()
}
function dab(ctx: Ctx, x: number, y: number, rx: number, ry: number, a: number) {
  ctx.fillStyle = ink(a)
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill()
}
function tree(ctx: Ctx, r: () => number, x: number, y: number, sz: number) {
  const lean = (r() - 0.5) * sz * 0.4
  ctx.strokeStyle = ink(0.88); ctx.lineWidth = sz * 0.07 + 1
  ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + lean, y - sz); ctx.stroke()
  for (let k = 0; k < 4; k++) {
    const t = 0.4 + k * 0.2
    dab(ctx, x + lean * t + (r() - 0.5) * sz * 0.2, y - sz * t, sz * (0.55 - k * 0.1), sz * 0.1, 0.8)
  }
}
function speckle(ctx: Ctx, r: () => number, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() < 0.7 ? ink(0.03 + r() * 0.08) : 'rgba(255,252,242,.25)'
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 1.5)
  }
}

/** Lay a random window of the silk weave over what is already painted, so the sheet has its own grain and stains. */
function silk(ctx: Ctx, r: () => number, w: number, h: number, mode: GlobalCompositeOperation, alpha: number) {
  const im = imgs.get('weave')
  if (!im) return
  const sw = im.width * 0.6, sh = Math.min(im.height, (sw * h) / w)
  ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha
  ctx.drawImage(im, r() * (im.width - sw), r() * (im.height - sh), sw, sh, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1
}

// layered washes: wide and faint first, narrow and dark last, all hugging the ridge
const WASH: Pt[] = [[0.34, 0.07], [0.22, 0.1], [0.13, 0.14], [0.06, 0.2], [0.022, 0.34], [0.006, 0.7]]

function paintRock(ctx: Ctx, s: Shape, kind: Kind, r: () => number, k: number, tone: Tone, seed: number) {
  const { w, h, ridge, outline } = s
  const tall = kind === 'pillar'
  const u = tall ? w * 1.5 : h
  ctx.save()
  trace(ctx, outline); ctx.clip()
  ctx.fillStyle = `rgb(${FADE[tone]})`; ctx.fillRect(0, 0, w, h)
  // real brushwork: a window onto the painting, cut to this sheet's silhouette
  const im = imgs.get(SOURCES[tone][seed % SOURCES[tone].length])
  if (im) {
    const dh = tall ? h : h * 0.78 // the foot of the sheet is mist anyway: keep the painting up where it shows
    const ar = (w / dh) * (tall ? 2 : 1) // pillars stretch the strokes into vertical strata
    let sw = im.width, sh = sw / ar
    if (sh > im.height) { sh = im.height; sw = sh * ar }
    ctx.globalAlpha = Math.min(1, 0.55 + 0.4 * k)
    const sx = r() * (im.width - sw), sy = (0.3 + 0.7 * r()) * (im.height - sh)
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, w, dh)
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= 0.55 // a second pass deepens the pigment
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, w, dh)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }
  silk(ctx, r, w, h, 'multiply', 0.7)
  ctx.lineJoin = ctx.lineCap = 'round'
  for (const [lw, a] of im ? WASH.slice(2) : WASH) {
    const j = lw * u * 0.15
    ctx.strokeStyle = ink(Math.min(1, a * k)); ctx.lineWidth = lw * u
    trace(ctx, ridge.map(([x, y]) => [x + (r() - 0.5) * j, y + lw * u * 0.2 + (r() - 0.5) * j]), false)
    ctx.stroke()
  }
  // texture strokes (cun) falling away from the ridge
  for (let i = 0; i < (tall ? 300 : 440) * (im ? 0.3 : 1); i++) {
    const [x0, y0] = ridge[(r() * ridge.length) | 0]
    let x = x0 + (r() - 0.5) * (tall ? w * 0.6 : 30), y = y0 + r() * r() * h * 0.35
    const len = (0.04 + r() * 0.2) * h * (tall ? 0.5 : 1), lean = (r() - 0.5) * 0.5
    ctx.beginPath(); ctx.moveTo(x, y)
    for (let k = 0; k < 5; k++) { x += (lean * len) / 5 + (r() - 0.5) * 6; y += len / 5; ctx.lineTo(x, y) }
    ctx.strokeStyle = ink((0.05 + r() * 0.25) * k); ctx.lineWidth = 0.8 + r() * r() * 6; ctx.stroke()
  }
  if (tall) // sandstone bedding
    for (let i = 0; i < 90; i++) {
      let x = r() * w; const y = r() * h * 0.8, len = 30 + r() * 110
      ctx.beginPath(); ctx.moveTo(x, y)
      for (let k = 0; k < 4; k++) { x += len / 4; ctx.lineTo(x, y + (r() - 0.5) * 5) }
      ctx.strokeStyle = ink(0.07 + r() * 0.18); ctx.lineWidth = 1 + r() * 2.5; ctx.stroke()
    }
  if (kind === 'falls') {
    const bx = FALLS.x * w, hw = FALLS.half * w, yb = h * (1 - s.top(FALLS.x) + FALLS.drop)
    for (const [lw, a] of [[190, 0.2], [110, 0.25]]) {
      ctx.strokeStyle = ink(a); ctx.lineWidth = lw
      ctx.beginPath(); ctx.moveTo(bx, yb); ctx.lineTo(bx, h); ctx.stroke()
    }
    dab(ctx, bx, yb, hw * 2.2, hw * 1.5, 0.88) // the cave mouth behind the water curtain
    ctx.fillStyle = '#faf5e8'; ctx.beginPath(); ctx.moveTo(bx - hw, yb + 6)
    for (let y = yb; y <= h; y += 24) ctx.lineTo(bx + hw + r() * 8, y)
    for (let y = h; y >= yb; y -= 24) ctx.lineTo(bx - hw - r() * 8, y)
    ctx.fill()
  }
  for (let i = 0; i < 110; i++) { // moss dots
    const [x, y] = ridge[(r() * ridge.length) | 0]
    dab(ctx, x + (r() - 0.5) * 14, y + r() * 18, 2 + r() * 5, 1 + r() * 2, 0.5 + r() * 0.4)
  }
  speckle(ctx, r, w, h, 2600)
  // the foot of every mountain is left as bare paper: that is the mist
  const g = ctx.createLinearGradient(0, h * (im ? (tall ? 0.62 : 0.5) : tall ? 0.5 : 0.45), 0, h * (im ? (tall ? 0.92 : 0.78) : 0.82))
  g.addColorStop(0, `rgba(${FADE[tone]},0)`); g.addColorStop(1, `rgb(${FADE[tone]})`)
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  ctx.restore()
  ctx.strokeStyle = RIM; ctx.lineWidth = 3; ctx.lineJoin = 'round'
  trace(ctx, outline); ctx.stroke()
  // trees stand proud of the cut edge
  if (tall) {
    ridge.forEach(([x, y], i) => { if (y < h * 0.1 && i % 3 === 0) tree(ctx, r, x, y + 4, 16 + r() * 26) })
    for (let i = 0; i < 14; i++) {
      const [x, y] = ridge[(r() * ridge.length) | 0]
      if (y < h * 0.6) for (let k = 0; k < 6; k++) dab(ctx, x + (r() - 0.5) * 30, y - r() * 14, 5 + r() * 9, 2 + r() * 3, 0.7 + r() * 0.2)
    }
  } else
    for (let i = 0; i < 26; i++) {
      const [x, y] = ridge[(r() * ridge.length) | 0]
      if (y > h * 0.75) continue
      tree(ctx, r, x, y + 3, 10 + r() * 18)
      if (tone === 'jade' && r() < 0.6) // peach blossom: this is Flower-Fruit Mountain
        for (let b = 0; b < 7; b++) { ctx.fillStyle = 'rgba(216,92,84,.92)'; ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 22, y - r() * 20, 2 + r() * 2.5, 0, 7); ctx.fill() }
    }
}

function paintPine(ctx: Ctx, w: number, h: number, r: () => number) {
  ctx.lineCap = 'round'
  const lean = (r() - 0.5) * 0.6, ph = r() * 6
  const at = (t: number): Pt => [w * 0.5 + Math.sin(t * 2.2 + ph) * w * 0.07 + lean * t * w * 0.3, h - t * h * 0.8]
  for (let i = 0; i < 24; i++) {
    const t = i / 24, [x, y] = at(t), [x2, y2] = at(t + 1 / 24)
    ctx.strokeStyle = ink(0.93); ctx.lineWidth = 26 * (1 - t * 0.8) + 3
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke()
  }
  const pad = (x: number, y: number, len: number) => {
    for (let k = 0; k < 18; k++) dab(ctx, x + (r() - 0.5) * len, y - r() * len * 0.22, 10 + r() * 14, 4 + r() * 4, 0.75 + r() * 0.2)
  }
  for (let i = 0; i < 8; i++) {
    const t = 0.34 + i * 0.085, [x, y] = at(t), side = i % 2 ? 1 : -1
    const len = w * (0.14 + 0.2 * r()) * (1 - t * 0.45)
    ctx.strokeStyle = ink(0.9); ctx.lineWidth = 5
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + side * len * 0.5, y - len * 0.3, x + side * len, y - len * 0.12); ctx.stroke()
    pad(x + side * len * 0.75, y - len * 0.2, len * 0.9)
  }
  const [tx, ty] = at(1)
  pad(tx, ty, w * 0.2)
}

function paintCloud(ctx: Ctx, w: number, h: number, r: () => number) {
  const base = h * 0.78, n = 11
  const blobs: [number, number, number, number][] = [[w * 0.5, base - h * 0.07, w * 0.47, h * 0.09]]
  for (let i = 0; i < n; i++) {
    const rad = h * (0.16 + 0.3 * Math.sin((Math.PI * (i + 0.5)) / n) * (0.6 + 0.4 * r()))
    blobs.push([w * (0.14 + (0.72 * i) / (n - 1)) + (r() - 0.5) * 40, base - rad * 0.75, rad, rad])
  }
  for (let i = 0; i < 7; i++) { const rad = h * (0.07 + 0.07 * r()); blobs.push([w * (0.1 + 0.8 * r()), base + h * 0.02, rad * 1.6, rad]) }
  const each = (f: () => void) => blobs.forEach(([x, y, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); f() })
  ctx.strokeStyle = 'rgba(96,90,80,.7)'; ctx.lineWidth = 3.5
  each(() => ctx.stroke()) // outline first, then fill: only the outer edge of the union survives
  ctx.fillStyle = '#f7f1e2'
  each(() => ctx.fill())
  ctx.globalCompositeOperation = 'source-atop'
  blobs.slice(1, n + 1).forEach(([x, y, rad]) => { // each lobe: a soft grey wash pooling under it, and one faint dry-brush curl
    const w2 = ctx.createRadialGradient(x, y + rad * 0.55, rad * 0.1, x, y + rad * 0.3, rad * 1.1)
    w2.addColorStop(0, ink(0.13)); w2.addColorStop(1, ink(0))
    ctx.fillStyle = w2; ctx.fillRect(x - rad * 1.2, y - rad * 1.2, rad * 2.4, rad * 2.4)
    ctx.strokeStyle = ink(0.07 + r() * 0.1); ctx.lineWidth = 1.5 + r() * 2.5
    ctx.beginPath(); ctx.arc(x - rad * 0.1, y + rad * 0.05, rad * (0.5 + r() * 0.2), Math.PI * (1 + r() * 0.15), Math.PI * (1.6 + r() * 0.3)); ctx.stroke()
  })
  ctx.globalCompositeOperation = 'source-atop'
  const g = ctx.createLinearGradient(0, base - h * 0.3, 0, base)
  g.addColorStop(0, ink(0)); g.addColorStop(1, ink(0.1))
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  speckle(ctx, r, w, h, 900)
  silk(ctx, r, w, h, 'source-atop', 0.3)
  ctx.globalCompositeOperation = 'source-over'
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const textures = new Map<string, THREE.Texture>()
/** `k` is ink strength: 1 for the middle distance, more for foreground sheets. */
export function texture(kind: Kind, seed: number, k = 1, tone: Tone = 'jade') {
  const key = kind + seed + '/' + k + tone
  if (!textures.has(key)) {
    const s = shape(kind, seed)
    const [c, ctx] = canvas(s.w, s.h)
    const r = rand(seed * 7 + 1)
    if (kind === 'pine') paintPine(ctx, s.w, s.h, r)
    else if (kind === 'cloud') paintCloud(ctx, s.w, s.h, r)
    else paintRock(ctx, s, kind, r, k, tone, seed)
    textures.set(key, finish(c))
  }
  return textures.get(key)!
}

/** Soft blob for drifting mist. */
export function mistTexture() {
  const [c, ctx] = canvas(256, 128)
  const r = rand(31)
  for (let i = 0; i < 46; i++) {
    const x = 40 + r() * 176, y = 30 + r() * 68, rx = 30 + r() * 80, ry = 6 + r() * 20
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, `rgba(255,255,255,${0.1 + r() * 0.2})`); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.min(rx, x, 256 - x), Math.min(ry, y, 128 - y))
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore()
  }
  return finish(c)
}

/** Tiling streaks, scrolled downward for falling water. */
export function waterTexture() {
  const [c, ctx] = canvas(64, 256)
  const r = rand(5)
  for (let i = 0; i < 26; i++) {
    const x = r() * 64, y = r() * 256, len = 40 + r() * 90
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,253,246,.9)' : ink(0.16)
    ctx.lineWidth = 1 + r() * 2
    for (const o of [0, -256]) { ctx.beginPath(); ctx.moveTo(x, y + o); ctx.lineTo(x, y + o + len); ctx.stroke() }
  }
  const t = finish(c)
  t.wrapT = THREE.RepeatWrapping
  return t
}

/** A cave wall with a ragged opening cut through it. `rx`, `ry`: the opening's radii as fractions of the sheet. */
export function caveTexture(seed: number, rx: number, ry: number) {
  const w = 1024, h = 683
  const [c, ctx] = canvas(w, h)
  const n = fbm(rand(seed))
  ctx.fillStyle = 'rgb(20,18,18)'; ctx.fillRect(0, 0, w, h)
  const im = imgs.get('ink-b')
  if (im) { ctx.globalAlpha = 0.4; ctx.drawImage(im, 0, 0, w, h); ctx.globalAlpha = 1 }
  const pts: Pt[] = []
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * Math.PI * 2, co = Math.cos(a), si = Math.sin(a)
    const k = 1 + (n(co * 1.6 + 3) + n(si * 1.6 + 11) - 1) * 0.6 + (n(co * 7 + 20) - 0.5) * 0.14
    pts.push([w / 2 + co * rx * w * k, h / 2 + si * ry * h * k * (si > 0 ? 0.8 : 1.15)])
  }
  ctx.globalCompositeOperation = 'destination-out'
  trace(ctx, pts); ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = RIM; ctx.lineWidth = 3
  trace(ctx, pts); ctx.stroke()
  return finish(c)
}

/** Distant mountain ranges for the horizon ring: ink on transparency, fading out above and below, tiling sideways. */
export function rangeTexture() {
  const [c, ctx] = canvas(2048, 272)
  const im = imgs.get('range')
  if (im) {
    ctx.drawImage(im, 0, 0, 2048, 272)
    const g = ctx.createLinearGradient(0, 0, 0, 272)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, '#000'); g.addColorStop(0.78, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 272)
  }
  const t = finish(c)
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = 4
  return t
}

/** The silk the sky is painted on: weave and stains as brown ink on transparency, mirrored so it tiles without seams. */
export function silkTexture() {
  const [c, ctx] = canvas(1024, 342)
  const im = imgs.get('weave')
  if (im) {
    ctx.drawImage(im, 0, 0, 1024, 342)
    const d = ctx.getImageData(0, 0, 1024, 342), p = d.data
    for (let i = 0; i < p.length; i += 4) {
      const dark = 250 - (p[i] + p[i + 1] + p[i + 2]) / 3 // the paler the silk, the clearer the sky shows through
      p[i] = 96; p[i + 1] = 72; p[i + 2] = 40; p[i + 3] = Math.max(0, Math.min(55, dark * 0.8)) // a whisper of weave, never a wash of brown
    }
    ctx.putImageData(d, 0, 0)
  }
  const t = finish(c)
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(16, 5)
  return t
}

/** The sun: a vermilion disc with a soft halo. */
export function sunTexture() {
  const [c, ctx] = canvas(256, 256)
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, '#f2683c'); g.addColorStop(0.36, '#d83f26'); g.addColorStop(0.4, 'rgba(232,96,52,.5)'); g.addColorStop(1, 'rgba(244,160,90,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256)
  return finish(c)
}

// ---- Wukong, seen from behind: a jointed paper puppet. Every part is its own sheet with a pivot.

export type Part = { tex: THREE.Texture; w: number; h: number; px: number; py: number }
/** Pixel height of the figure the parts are drawn for (feet to crown), and where the hips sit above the feet. */
export const FIGURE = { h: 448, hips: 186 }
/** Hip pivot to knee, and knee to sole, in the same pixels. */
export const LEGS = { thigh: 92, shin: 82 }

export function wukongParts() {
  const GOLD = 'rgb(198,156,64)', BRASS = 'rgb(150,112,52)', FUR = 'rgb(134,96,58)', PALE = 'rgb(210,166,124)'
  const DARK = 'rgb(40,36,34)', RED = 'rgb(180,44,30)'
  let ctx!: Ctx
  const part = (w: number, h: number, px: number, py: number, draw: () => void): Part => {
    const [c, x] = canvas(w, h)
    ctx = x; ctx.lineCap = ctx.lineJoin = 'round'
    draw()
    return { tex: finish(c), w, h, px, py }
  }
  // each shape is cut out with a pale paper rim, like a collaged shadow puppet
  const cut = (fill: string, path: () => void) => {
    ctx.beginPath(); path()
    ctx.strokeStyle = RIM; ctx.lineWidth = 4; ctx.stroke()
    ctx.fillStyle = fill; ctx.fill()
  }
  const line = (color: string, width: number, path: () => void) => {
    ctx.beginPath(); path(); ctx.strokeStyle = RIM; ctx.lineWidth = width + 4; ctx.stroke()
    ctx.beginPath(); path(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke()
  }
  const poly = (...p: number[]) => { for (let i = 0; i < p.length; i += 2) i ? ctx.lineTo(p[i], p[i + 1]) : ctx.moveTo(p[i], p[i + 1]); ctx.closePath() }
  const mark = (a: number, w: number, path: () => void) => { ctx.beginPath(); path(); ctx.strokeStyle = ink(a); ctx.lineWidth = w; ctx.stroke() }

  const torso = part(160, 216, 80, 160, () => {
    cut(DARK, () => poly(30, 24, 130, 24, 114, 150, 46, 150))
    ctx.strokeStyle = 'rgba(198,156,64,.6)'; ctx.lineWidth = 2 // scale armour
    for (let y = 52; y < 140; y += 16) for (let x = 50 + ((y / 16) % 2) * 7; x < 112; x += 14) { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI); ctx.stroke() }
    cut(BRASS, () => ctx.ellipse(34, 30, 24, 15, -0.3, 0, 7))
    cut(BRASS, () => ctx.ellipse(126, 30, 24, 15, 0.3, 0, 7))
    cut('rgb(190,144,68)', () => poly(44, 152, 116, 152, 136, 212, 24, 212)) // tiger-skin kilt
    for (let x = 40; x < 126; x += 13) mark(0.7, 3, () => { ctx.moveTo(x, 166 + (x % 3) * 5); ctx.quadraticCurveTo(x + 6, 182, x + 1, 200) })
    cut(RED, () => ctx.rect(42, 138, 76, 17))
    cut(GOLD, () => ctx.rect(70, 136, 20, 21))
  })

  // the leg is two pieces hinged at the knee (LEGS gives the lengths), so he can sink into a real crouch
  const thigh = part(72, 116, 36, 12, () => cut('rgb(58,50,46)', () => poly(14, 6, 58, 6, 54, 110, 18, 110)))
  const shin = part(72, 96, 36, 8, () => { // drawn with the knee 8px from the top
    cut('rgb(58,50,46)', () => ctx.ellipse(36, 10, 18, 12, 0, 0, 7)) // the knee
    cut('rgb(216,202,172)', () => poly(20, 18, 52, 18, 49, 66, 23, 66)) // shin wraps
    for (let y = 26; y < 64; y += 9) mark(0.5, 2, () => { ctx.moveTo(22, y); ctx.lineTo(50, y + 5) })
    cut('rgb(28,24,22)', () => poly(21, 62, 51, 62, 60, 88, 12, 91))
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, 66); ctx.lineTo(50, 66); ctx.stroke()
  })

  const upper = part(60, 84, 30, 14, () => {
    line(FUR, 22, () => { ctx.moveTo(30, 14); ctx.lineTo(30, 70) })
  })
  const fore = part(60, 84, 30, 12, () => { // elbow at the pivot: bracer, then the hand
    line(FUR, 20, () => { ctx.moveTo(30, 12); ctx.lineTo(30, 22) })
    cut(BRASS, () => poly(17, 14, 43, 14, 41, 56, 19, 56)) // bracer
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3
    for (const y of [20, 50]) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(42, y); ctx.stroke() }
    cut(PALE, () => ctx.arc(30, 67, 12, 0, 7))
  })

  const staff = part(28, 460, 14, 230, () => {
    line('rgb(112,36,26)', 9, () => { ctx.moveTo(14, 14); ctx.lineTo(14, 446) })
    for (const y of [10, 404]) line(GOLD, 13, () => { ctx.moveTo(14, y); ctx.lineTo(14, y + 46) })
    ctx.strokeStyle = 'rgba(60,30,10,.7)'; ctx.lineWidth = 2
    for (const y of [22, 44, 416, 438]) { ctx.beginPath(); ctx.moveTo(7, y); ctx.lineTo(21, y); ctx.stroke() }
  })

  const head = part(150, 150, 75, 138, () => {
    line(FUR, 20, () => { ctx.moveTo(75, 138); ctx.lineTo(75, 108) })
    cut('rgb(170,130,86)', () => poly(36, 58, 6, 70, 30, 80, 8, 98, 36, 98, 24, 116, 50, 108)) // cheek fur
    cut('rgb(170,130,86)', () => poly(114, 58, 144, 70, 120, 80, 142, 98, 114, 98, 126, 116, 100, 108))
    cut(PALE, () => ctx.arc(27, 64, 12, 0, 7))
    cut(PALE, () => ctx.arc(123, 64, 12, 0, 7))
    cut(FUR, () => ctx.arc(75, 70, 46, 0, 7))
    for (let i = 0; i < 13; i++) { const x = 40 + i * 6; mark(0.42, 2, () => { ctx.moveTo(x, 76 + (i % 3) * 6); ctx.lineTo(x + 2, 96 + (i % 2) * 8) }) }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 7 // the golden fillet, with its upturned ends
    ctx.beginPath(); ctx.ellipse(75, 54, 46, 13, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke()
    ctx.lineWidth = 4
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(75 + d * 50, 50, 7, 0, 7); ctx.stroke() }
    cut(RED, () => poly(66, 34, 84, 34, 80, 12, 70, 12))
    cut(GOLD, () => ctx.arc(75, 26, 10, 0, 7))
  })

  const plume = part(64, 300, 30, 292, () => {
    const path = () => { ctx.moveTo(30, 292); ctx.bezierCurveTo(20, 200, 26, 90, 56, 8) }
    line('rgb(176,62,38)', 7, path)
    ctx.setLineDash([9, 15]); ctx.beginPath(); path()
    ctx.strokeStyle = 'rgba(36,22,16,.85)'; ctx.lineWidth = 7; ctx.lineCap = 'butt'; ctx.stroke()
    ctx.setLineDash([])
  })

  const tail = part(150, 170, 20, 150, () => {
    line(FUR, 10, () => { ctx.moveTo(20, 150); ctx.bezierCurveTo(70, 166, 132, 122, 112, 62); ctx.bezierCurveTo(102, 32, 70, 30, 76, 54) })
    cut('rgb(170,130,86)', () => ctx.arc(76, 54, 8, 0, 7))
  })

  // the long cape: four overlapping lengths, each hinged to the one above so it can ripple
  const CW = [92, 108, 128, 152, 180]
  const cape = [0, 1, 2, 3].map((k) => part(240, 136, 120, 10, () => {
    const a = CW[k] / 2, b = CW[k + 1] / 2
    ctx.beginPath(); ctx.moveTo(120 - a, 6); ctx.lineTo(120 + a, 6); ctx.lineTo(120 + b, 118)
    if (k === 3) for (let i = 1; i <= 6; i++) ctx.quadraticCurveTo(120 + b - (i - 0.5) * (b / 3), 134 - (i % 2) * 14, 120 + b - i * (b / 3), 118) // scalloped hem
    else ctx.lineTo(120 - b, 118)
    ctx.closePath()
    const g = ctx.createLinearGradient(120 - b, 0, 120 + b, 0)
    g.addColorStop(0, 'rgb(128,26,22)'); g.addColorStop(0.3, RED); g.addColorStop(0.55, 'rgb(206,66,40)'); g.addColorStop(0.8, RED); g.addColorStop(1, 'rgb(120,24,20)')
    ctx.fillStyle = g; ctx.fill()
    for (let i = 1; i < 5; i++) { // folds
      const t = i / 5
      mark(0.28, 3, () => { ctx.moveTo(120 - a + 2 * a * t, 6); ctx.quadraticCurveTo(120 - a + 2 * a * t + 6, 60, 120 - b + 2 * b * t, 120) })
    }
    ctx.lineWidth = 5; ctx.strokeStyle = GOLD // gold edging down both sides
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(120 + d * a, 6); ctx.lineTo(120 + d * b, 118); ctx.stroke() }
    ctx.lineWidth = 2.5; ctx.strokeStyle = RIM
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(120 + d * (a + 3), 6); ctx.lineTo(120 + d * (b + 3), 118); ctx.stroke() }
    if (k === 0) { ctx.strokeStyle = GOLD; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(120 - a, 9); ctx.lineTo(120 + a, 9); ctx.stroke() }
  }))

  return { torso, thigh, shin, upper, fore, staff, head, plume, tail, cape }
}

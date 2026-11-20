// Painted sheets grouped for drawing: every sheet that uses the same texture (and the same mirroring) goes into one
// batch, drawn later as one instanced mesh, so ~970 sheets cost a few dozen draw calls instead of one each.
// No React here; `checkBatches` is the dev self-check that each batched sheet lands exactly where it used to.
import * as THREE from 'three'
import { textureKey, type Kind, type Tone } from '../art/ink'
import { PLANE, PLANE_FLIPPED } from './paper'
import { type Region } from './regions'

export const PAINTED: ReadonlySet<string> = new Set<Kind>(['ridge', 'peak', 'falls', 'pillar', 'pine', 'cloud'])

/** One sheet in a batch. `index`: its place in build order through REGIONS (all pieces counted, as World's `shown`
 *  counts them). `base`: world matrix without drift, positive scale. `axis`: the region's x axis in world xz (clouds
 *  drift along it). `phase`: the sheet's drift phase (its z in the region's frame). */
export type BatchItem = { index: number; base: THREE.Matrix4; axis: [number, number]; phase: number }
export type Batch = { key: string; kind: Kind; seed: number; ink: number; tone: Tone; flip: boolean; items: BatchItem[] }

export function buildBatches(regions: Region[]): Batch[] {
  const batches = new Map<string, Batch>()
  const frame = new THREE.Matrix4(), local = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0)
  let index = 0
  for (const r of regions) {
    frame.makeRotationY(r.yaw).setPosition(...r.origin)
    const axis: [number, number] = [Math.cos(r.yaw), -Math.sin(r.yaw)]
    for (const p of r.pieces) {
      const i = index++ // every piece counts, painted or not, so indexes line up with World's `shown`
      if (!PAINTED.has(p.kind)) continue
      const kind = p.kind as Kind, ink = p.ink ?? 1, tone = p.tone ?? 'jade', flip = !!p.flip
      const key = textureKey(kind, p.seed!, ink, tone)
      const id = key + (flip ? '|f' : '')
      if (!batches.has(id)) batches.set(id, { key, kind, seed: p.seed!, ink, tone, flip, items: [] })
      const [w, h] = p.size
      local.compose(new THREE.Vector3(p.at[0], p.at[1] + h / 2, p.at[2]), q.setFromAxisAngle(up, p.yaw ?? 0), new THREE.Vector3(w, h, 1))
      batches.get(id)!.items.push({ index: i, base: new THREE.Matrix4().multiplyMatrices(frame, local), axis, phase: p.at[2] })
    }
  }
  return [...batches.values()]
}

/** Dev self-check: rebuild every painted sheet the old way (region group > mesh with a negative x scale for mirrored
 *  sheets) and confirm its batch item puts each corner of the quad, with the same picture coordinate, in the same place. */
export function checkBatches(regions: Region[], batches: Batch[]) {
  const byIndex = new Map<number, { batch: Batch; item: BatchItem }>()
  let items = 0
  const seen = new Set<string>()
  for (const batch of batches) {
    const id = batch.key + (batch.flip ? '|f' : '')
    console.assert(!seen.has(id), `batches: two batches for ${id}`)
    seen.add(id)
    batch.items.forEach((item, k) => {
      items++
      console.assert(k === 0 || batch.items[k - 1].index < item.index, `batches: ${id} items out of build order`)
      console.assert(!byIndex.has(item.index), `batches: sheet ${item.index} is in two batches`)
      byIndex.set(item.index, { batch, item })
      console.assert(item.base.determinant() > 0, `batches: sheet ${item.index} is mirrored by its matrix`)
    })
  }

  const group = new THREE.Group(), sheet = new THREE.Object3D()
  group.add(sheet)
  const a = new THREE.Vector3(), b = new THREE.Vector3()
  let index = 0, painted = 0
  for (const r of regions) {
    group.position.set(...r.origin)
    group.rotation.set(0, r.yaw, 0)
    for (const p of r.pieces) {
      const i = index++
      if (!PAINTED.has(p.kind)) continue
      painted++
      const found = byIndex.get(i)
      console.assert(!!found, `batches: painted sheet ${i} (${p.kind}) is in no batch`)
      if (!found) continue
      const [w, h] = p.size
      sheet.position.set(p.at[0], p.at[1] + h / 2, p.at[2])
      sheet.rotation.set(0, p.yaw ?? 0, 0)
      sheet.scale.set(p.flip ? -w : w, h, 1)
      group.updateMatrixWorld(true)
      // match corners by picture coordinate: the old mirrored quad and the new flipped-uv quad must agree
      const ref = PLANE, now = found.batch.flip ? PLANE_FLIPPED : PLANE
      for (let c = 0; c < 4; c++) {
        const u = ref.attributes.uv.getX(c), v = ref.attributes.uv.getY(c)
        let m = -1
        for (let d = 0; d < 4; d++) if (now.attributes.uv.getX(d) === u && now.attributes.uv.getY(d) === v) m = d
        a.fromBufferAttribute(ref.attributes.position as THREE.BufferAttribute, c).applyMatrix4(sheet.matrixWorld)
        b.fromBufferAttribute(now.attributes.position as THREE.BufferAttribute, m).applyMatrix4(found.item.base)
        console.assert(a.distanceTo(b) < 1e-4, `batches: sheet ${i} (${p.kind}) corner ${c} moved by ${a.distanceTo(b)}`)
      }
    }
  }
  console.assert(items === painted, `batches: ${items} batched sheets, ${painted} painted sheets`)
  console.log(`batches: ${batches.length} meshes for ${items} sheets`)
}

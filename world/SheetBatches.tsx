'use client'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { texture } from '../art/ink'
import { buildBatches, type Batch } from './batches'
import { PLANE, PLANE_FLIPPED, paper } from './paper'
import { REGIONS } from './regions'

// Every painted sheet, drawn as one instanced mesh per batch (same texture, same mirroring): ~78 draw calls for ~970
// sheets, where each sheet used to be its own mesh with its own draw call, shadow draw and per-frame callback.
export const BATCHES = buildBatches(REGIONS)
const DRIFT = 0.6 // how far foot clouds sway sideways, as before

/** `shown`: how many sheets are built so far, counted through REGIONS in journey order (see World). */
export default function Batches({ shown, reduced }: { shown: number; reduced: boolean }) {
  const clouds = useMemo(() => new Set<THREE.InstancedMesh>(), [])
  const m = useMemo(() => new THREE.Matrix4(), [])

  // one callback for all drifting clouds: recompute each cloud's matrix from its base, so shadows drift with it
  useFrame(({ clock }) => {
    if (reduced) return
    const t = clock.elapsedTime
    for (const mesh of clouds) {
      const items = (mesh.userData.batch as Batch).items
      for (let k = 0; k < mesh.count; k++) {
        const it = items[k], off = Math.sin(t * 0.08 + it.phase) * DRIFT
        m.copy(it.base)
        m.elements[12] += it.axis[0] * off
        m.elements[14] += it.axis[1] * off
        mesh.setMatrixAt(k, m)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      {BATCHES.map((b, i) => {
        let n = 0
        while (n < b.items.length && b.items[n].index < shown) n++ // items are in build order
        return n > 0 && <BatchMesh key={i} batch={b} n={n} clouds={clouds} />
      })}
    </>
  )
}

/** One batch. Mounted when its first sheet is due, so its texture is painted then, in journey order as before. */
function BatchMesh({ batch, n, clouds }: { batch: Batch; n: number; clouds: Set<THREE.InstancedMesh> }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const material = useMemo(() => paper(texture(batch.kind, batch.seed, batch.ink, batch.tone)), [batch])

  useLayoutEffect(() => {
    const mesh = ref.current
    mesh.userData.batch = batch
    if (batch.kind !== 'cloud') return
    clouds.add(mesh)
    return () => { clouds.delete(mesh) }
  }, [batch, clouds])

  // place the sheets that are due; bounds cover them (plus the sway, for clouds) so culling stays right
  useLayoutEffect(() => {
    const mesh = ref.current
    for (let k = 0; k < n; k++) mesh.setMatrixAt(k, batch.items[k].base)
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    if (batch.kind === 'cloud') mesh.boundingSphere!.radius += DRIFT
  }, [batch, n])

  return <instancedMesh ref={ref} args={[batch.flip ? PLANE_FLIPPED : PLANE, material, batch.items.length]} castShadow receiveShadow />
}

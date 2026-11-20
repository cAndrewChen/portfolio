import * as THREE from 'three'

// The unit quad every sheet and puppet part is drawn on.
export const PLANE = new THREE.PlaneGeometry(1, 1)

// The same quad with the picture mirrored left to right (u -> 1 - u). Mirrored sheets use this instead of a negative
// scale: three.js corrects face winding for a mirrored object, but not for a mirrored instance, so a negatively scaled
// instance would read as back-facing and be lit from behind.
export const PLANE_FLIPPED = (() => {
  const g = new THREE.PlaneGeometry(1, 1)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i))
  return g
})()

// One lit, hard-cut paper material per texture. alphaToCoverage keeps the cut edge clean.
const mats = new Map<string, THREE.Material>()
export function paper(map: THREE.Texture) {
  if (!mats.has(map.uuid))
    mats.set(map.uuid, new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }))
  return mats.get(map.uuid)!
}

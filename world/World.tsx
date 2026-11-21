'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { FIGURE, LEGS, MIST, caveTexture, loadPaintings, mistTexture, rangeTexture, silkTexture, sunTexture, texture, waterTexture, wukongParts, type Part } from '../art/ink'
import { ANCHORS, S, intro, progress, sample } from '../journey/journey'
import { PAINTED, checkBatches } from './batches'
import Batches, { BATCHES } from './SheetBatches'
import { PLANE, paper } from './paper'
import { FRAME, REGIONS, type Piece } from './regions'
import Stats from './Stats'

const { clamp, lerp, smoothstep } = THREE.MathUtils

if (process.env.NODE_ENV !== 'production') checkBatches(REGIONS, BATCHES)

/** The unlit one-off pieces: mist, water, sun and the cave mouths. Painted sheets are drawn in batches (SheetBatches.tsx). */
function Sheet({ p, reduced }: { p: Piece; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const [w, h] = p.size
  const material = useMemo(() => {
    if (p.kind === 'cave') return new THREE.MeshBasicMaterial({ map: caveTexture(p.seed!, ...p.hole!), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }) // fogged, so the dark walls fade out when seen from far across the world
    if (p.kind === 'sun') return new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, depthWrite: false, fog: false })
    if (p.kind === 'mist') return new THREE.MeshBasicMaterial({ map: mistTexture(), transparent: true, depthWrite: false, opacity: 0.7 })
    const map = waterTexture()
    map.repeat.set(1, h / w / 4)
    return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
  }, [p, w, h])

  useFrame(({ clock, scene }) => {
    if (p.kind === 'mist') (material as THREE.MeshBasicMaterial).color.copy((scene.fog as THREE.Fog).color) // mist takes the colour of the air
    if (reduced) return
    const t = clock.elapsedTime
    if (p.kind === 'water') (material as THREE.MeshBasicMaterial).map!.offset.y = t * 0.35
    else if (p.kind === 'mist') ref.current.position.x = p.at[0] + Math.sin(t * 0.05 + p.at[2]) * 6
  })

  // none of these cast or catch shadows
  return (
    <mesh
      ref={ref} geometry={PLANE} material={material}
      position={[p.at[0], p.at[1] + h / 2, p.at[2]]}
      rotation-y={p.yaw ?? 0} scale={[p.flip ? -w : w, h, 1]}
    />
  )
}

const DAY = new THREE.Color(MIST), DUSK = new THREE.Color('#e6a877')
const WHITE = new THREE.Color('#ffffff'), AMBER = new THREE.Color('#ffdcb8'), EMBER = new THREE.Color('#ffb47a')

/** Camera, lamp and mood, all derived from scroll progress. Mounted first so it samples before anything reads S. */
function Rig({ reduced }: { reduced: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null!), ambient = useRef<THREE.AmbientLight>(null!)
  const scene = useThree((s) => s.scene)
  useEffect(() => { scene.add(light.current.target) }, [scene])
  const f = useMemo(() => new THREE.Vector3(), [])
  const shown = useRef(-1)

  useFrame(({ camera, size, clock }) => {
    const cam = camera as THREE.PerspectiveCamera
    sample(progress.p)
    cam.position.copy(S.cam)
    if (intro.k < 1) cam.position.addScaledVector(f.subVectors(S.cam, S.look).normalize(), (1 - intro.k) * intro.back) // still inside the cave
    if (!reduced) { // a little drift, so the camera breathes rather than sitting on rails
      const t = clock.elapsedTime
      cam.position.x += Math.sin(t * 0.37) * 0.12
      cam.position.y += Math.sin(t * 0.53 + 1) * 0.1
    }
    cam.up.set(0, 1, 0)
    cam.lookAt(S.look)
    if (!reduced) cam.rotateZ(-S.roll)
    // hold the horizontal framing on narrow screens
    const aspect = size.width / size.height
    const half = Math.tan(THREE.MathUtils.degToRad(S.fov / 2)) * Math.max(1, 1.5 / aspect)
    const fov = Math.min(80, THREE.MathUtils.radToDeg(Math.atan(half) * 2))
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix() }
    cam.updateMatrixWorld()

    // the lamp sits over the viewer's left shoulder, so every sheet shadows the one behind it, down and to the right
    f.subVectors(S.look, S.cam).setY(0).normalize()
    const t = light.current.target.position.copy(S.cam).addScaledVector(f, 50)
    light.current.position.set(t.x - f.x * 60 + f.z * 26, t.y + 24, t.z - f.z * 60 - f.x * 26)
    light.current.target.updateMatrixWorld()

    // mood: daylight to sunset. Air, lamp and the CSS sky behind the canvas all move together.
    const m = S.mood
    ;(scene.fog as THREE.Fog).color.lerpColors(DAY, DUSK, m)
    ambient.current.color.lerpColors(WHITE, AMBER, m)
    ambient.current.intensity = lerp(1.75, 1.5, m)
    light.current.color.lerpColors(WHITE, EMBER, m)
    light.current.intensity = lerp(1.63, 1.9, m)
    if (Math.abs(m - shown.current) > 0.004) {
      shown.current = m
      const root = document.documentElement
      root.style.setProperty('--mood', m.toFixed(3))
      root.toggleAttribute('data-dusk', m > 0.5)
    }
  })

  const mapSize = typeof window !== 'undefined' && window.innerWidth < 800 ? 1024 : 2048
  return (
    <>
      <ambientLight ref={ambient} intensity={1.75} />
      <directionalLight
        ref={light} intensity={1.63} castShadow
        shadow-mapSize={[mapSize, mapSize]} shadow-bias={-0.002} shadow-radius={4}
        shadow-camera-left={-85} shadow-camera-right={85} shadow-camera-top={85} shadow-camera-bottom={-85}
        shadow-camera-near={1} shadow-camera-far={280}
      />
    </>
  )
}

/** The far distance, as real objects around the whole world: a ring of silk the sky is painted on, and a ring of
 *  mountain ranges standing on the horizon. Being in the scene, they turn and shift with the camera like everything else. */
function Backdrop() {
  const [range, silk] = useMemo(() => [rangeTexture(), silkTexture()], [])
  return (
    <group position={[190, 0, -60]}>{/* centred on the whole journey, Huaguo Shan to Huangshan */}
      <mesh position-y={150} renderOrder={-2}>
        <cylinderGeometry args={[840, 840, 900, 64, 1, true]} />
        <meshBasicMaterial map={silk} side={THREE.BackSide} transparent depthWrite={false} fog={false} />
      </mesh>
      <mesh position-y={62} renderOrder={-1}>
        <cylinderGeometry args={[800, 800, 170, 64, 1, true]} />
        <meshBasicMaterial map={range} side={THREE.BackSide} transparent opacity={0.6} depthWrite={false} fog={false} />
      </mesh>
    </group>
  )
}

// ---- Wukong: a jointed paper puppet. Poses blend by the acting weights in S; cloth and feathers follow on springs.

const FIG = 2 // world height, feet to crown
const U = FIG / FIGURE.h // puppet pixels to world units
//      armL   armR   legL   legR   elbow  knee (elbow: how far the forearm folds past the upper arm; knee: how far the shin folds back in)
const POSE = {
  idle: [-0.18, 0.35, -0.06, 0.06, 0.25, 0], // standing, staff held out to the side
  crouch: [-0.9, 0.9, -0.6, 0.6, 0.8, 0.9],
  tuck: [0.5, -0.5, -1.0, 1.0, 1.6, 1.9], // balled up mid-flip
  // riding the cloud (with STANCE below): both arms straight, the free arm a little out, the staff arm down at about -75 degrees on screen
  ride: [-0.35, 0.22, -0.2, 0.2, 0, 0],
}
// Riding the cloud he lunges like a surfer, seen from behind: the left (front) leg reaches forward into the scene with the knee bent,
// the right (back) leg runs straight back toward the viewer, and the body leans forward over the front knee. That depth can't be drawn
// in the picture plane, so these pieces tilt toward or away from the viewer about their hinges (radians). The body leans with it, so
// the arms and cape, which hang from it, are already tipped back toward the viewer by `lean`; `reach` brings the free arm forward again.
// `back` is solved so both feet stand on the cloud.
const STANCE = { front: 1.05, knee: 1.45, lean: 0.85, head: 0.45, reach: 1.4 }
const footHeight = LEGS.thigh * Math.cos(STANCE.front) + LEGS.shin * Math.cos(STANCE.front - STANCE.knee)
const BACK = Math.acos(footHeight / (LEGS.thigh + LEGS.shin)) // back leg, straight, tipped toward the viewer
const STREAM = 0.35 // how far the cape lifts back toward the viewer on the cloud, on top of the body's lean (radians)
// the staff on the cloud: in the straight, lowered right hand, standing up behind his back, top leaning a little toward the front foot
const RIDE = { elbowR: 0, tilt: 0.25, grip: 115 }

type Bind = (g: THREE.Group | null) => void
function Limb({ part, at, z = 0, flip, bind, children }: { part: Part; at: [number, number]; z?: number; flip?: boolean; bind?: Bind; children?: ReactNode }) {
  const d = flip ? -1 : 1
  return (
    <group ref={bind} position={[at[0] * U, at[1] * U, z]}>
      <mesh
        geometry={PLANE} material={paper(part.tex)} castShadow
        position={[(part.w / 2 - part.px) * U * d, (part.py - part.h / 2) * U, 0]}
        scale={[part.w * U * d, part.h * U, 1]}
      />
      {children}
    </group>
  )
}

function Wukong({ reduced }: { reduced: boolean }) {
  const P = useMemo(wukongParts, [])
  const cloudMat = useMemo(() => [paper(texture('cloud', 85)), paper(texture('cloud', 86))], [])
  const J = useRef<Record<string, THREE.Group>>({}).current
  const bind = (name: string): Bind => (g) => { if (g) J[name] = g }
  const cloud = useRef<THREE.Group>(null!)
  const st = useMemo(() => ({ prev: new THREE.Vector3(), side: 0, speed: 0, cape: [0, 0, 0, 0], plume: [0, 0], init: false, v: new THREE.Vector3() }), [])

  useFrame(({ clock, camera }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = reduced ? 0 : clock.elapsedTime
    const { crouch, tuck, ride } = S
    const idle = Math.max(0, 1 - crouch - tuck - ride)
    const pose = (k: number) => idle * POSE.idle[k] + crouch * POSE.crouch[k] + tuck * POSE.tuck[k] + ride * POSE.ride[k]
    const yaw = Math.atan2(camera.position.x - S.wk.x, camera.position.z - S.wk.z)

    // how fast he is moving, and how much of that is sideways on screen: cloth and feathers trail behind it
    if (!st.init) { st.prev.copy(S.wk); st.init = true }
    st.v.subVectors(S.wk, st.prev).divideScalar(Math.max(dt, 1e-3))
    st.prev.copy(S.wk)
    const ease = 1 - Math.exp(-dt * 5)
    st.side += (clamp(st.v.x * Math.cos(yaw) - st.v.z * Math.sin(yaw), -30, 30) - st.side) * ease
    st.speed += (Math.min(st.v.length(), 60) - st.speed) * ease
    const rush = Math.min(1, st.speed / 22)

    // root: hips. Feet stay planted as the legs splay and the knees bend; the flip turns about the hips.
    const bob = Math.sin(t * 1.4) * 0.14 * S.cloud
    const legs = Math.abs(pose(3)), knee = pose(5)
    const drop = (LEGS.thigh * (1 - Math.cos(legs)) + LEGS.shin * (1 - Math.cos(legs - knee)) + ride * (LEGS.thigh + LEGS.shin - footHeight)) * U
    const g = J.root
    g.position.copy(S.wk)
    g.position.y += FIGURE.hips * U - drop - crouch * 0.12 + S.lift + S.dip + bob
    g.rotation.set(0, yaw, 0)
    // riding he stays square on the cloud: no sway and no lean into turns, only the camera's own roll so he reads upright on screen
    const lean = lerp(S.bank, S.roll, ride)
    g.rotateZ(-lean - st.side * 0.006 * (1 - ride))
    // a flat puppet flipped head-over-heels would turn edge-on and vanish, so the somersault spins in the picture plane with a paper-like tilt
    g.rotateZ(S.flip)
    g.rotateX(Math.sin(S.flip) * 0.55)
    g.scale.setScalar(1 - tuck * 0.12)

    // every so often he slings the staff behind his neck, hooks both arms over it with elbows bent, and cracks his neck
    const cyc = t % 14
    const rest = smoothstep(cyc, 5.5, 6.7) * (1 - smoothstep(cyc, 11.6, 12.8)) * Math.max(0, 1 - 3 * (crouch + tuck)) * (1 - rush) * (1 - ride) // never on the cloud
    const snap = (a: number) => smoothstep(cyc, a, a + 0.16) * (1 - smoothstep(cyc, a + 0.5, a + 0.95)) // quick over, slow back
    const neck = (snap(7.6) - snap(9.2)) * 0.5 * rest
    const armL = lerp(pose(0) + Math.sin(t * 1.4) * 0.05 * (1 - ride) - lean * 0.6, -1.2, rest)
    const armR = lerp(pose(1) + Math.sin(t * 1.4 + 1) * 0.04 * (1 - ride) - lean * 0.6, 1.2, rest)
    const elbow = lerp(pose(4) + Math.sin(t * 1.1) * 0.05 * (1 - ride), 1.3, rest)
    const elbowR = lerp(elbow, RIDE.elbowR, ride)
    J.armR.position.z = lerp(-0.016, 0.046, ride) // ...and behind him: on the viewer's side of the cape
    J.armL.rotation.set(STANCE.reach * ride, 0, armL) // riding, the free arm reaches forward into the scene
    J.armR.rotation.set(STANCE.lean * ride, 0, armR) // riding, the staff arm hangs straight down past his hip despite the lean
    J.elbowL.rotation.z = -elbow
    J.elbowR.rotation.z = elbowR
    // the staff rides in his right hand (worked out from shoulder, elbow and wrist), or lies level behind the neck
    const a2 = armR + elbowR
    const hx = 50 + Math.sin(armR) * 58 + Math.sin(a2) * 55, hy = 134 - Math.cos(armR) * 58 - Math.cos(a2) * 55
    // riding the cloud he holds it high behind his back, hand by the shoulder: steep, falling from upper left to lower right
    const tilt = lerp(0.1 - armR * 0.1, RIDE.tilt, ride), grip = lerp(60, RIDE.grip, ride) // how far the staff's middle sits above the hand, along the staff
    // riding, the staff arm is swung about the shoulder by `th` to hang straight despite the lean, so the staff swings with it,
    // on the layer above the arm and hand
    const th = STANCE.lean * ride, dy = hy + Math.cos(tilt) * grip - 134
    J.staff.position.set(
      lerp(hx - Math.sin(tilt) * grip, 0, rest) * U,
      lerp(134 + dy * Math.cos(th), 158, rest) * U,
      lerp(lerp(-0.022, 0.058, ride) + dy * Math.sin(th) * U, 0.06, rest),
    )
    J.staff.rotation.set(th, 0, lerp(tilt, Math.PI / 2, rest))
    J.legL.rotation.set(STANCE.front * ride, 0, pose(2))
    J.legR.rotation.set(-BACK * ride, 0, pose(3))
    J.kneeL.rotation.set(-STANCE.knee * ride, 0, knee)
    J.kneeR.rotation.set(0, 0, -knee)
    J.torso.scale.y = 1 + Math.sin(t * 1.6) * 0.014 - crouch * 0.1 // breathing
    J.torso.rotation.set(-STANCE.lean * ride, 0, Math.sin(t * 0.5) * 0.025 * idle - neck * 0.12)
    J.head.rotation.x = STANCE.head * ride // head lifted to look ahead over the lean
    J.head.rotation.z = (Math.sin(t * 0.5) * 0.16 + Math.sin(t * 1.3) * 0.05) * (idle + ride * 0.2) - lean * 0.5 - st.side * 0.01 * (1 - ride) + neck // looking about
    J.tail.rotation.z = 0.1 + Math.sin(t * 2.3) * 0.25 + Math.sin(t * 5.1) * 0.06 + tuck * 0.8

    for (let k = 0; k < 2; k++) {
      const target = (k ? -0.28 : 0.28) + Math.sin(t * 2.1 + k) * 0.07 + st.side * 0.02 + tuck * (k ? 0.5 : -0.5)
      st.plume[k] += (target - st.plume[k]) * (1 - Math.exp(-dt * 7))
      J['plume' + k].rotation.z = st.plume[k]
    }
    // the cape: each length chases its own target, later lengths more slowly, so a wave runs down it.
    // On the cloud it streams back toward the viewer in the headwind, clear of his legs, and ripples along its length
    // rather than flapping side to side (a full-length cape swinging sideways reads as Wukong himself swaying).
    const sway = 1 - 0.85 * ride
    for (let k = 0; k < 4; k++) {
      const wind = idle * (0.2 + k * 0.03 + Math.sin(t * 1.9 - k * 0.9) * 0.09 * (1 + k * 0.4)) // a steady breeze off the cliff
      const flutter = (0.07 + Math.sin(t * 6.5 - k * 1.2) * (0.1 + 0.07 * k) * (0.4 + 0.6 * rush)) * (1 - idle)
      const target = wind + (flutter + clamp(st.side * 0.022 * (k + 1), -0.55, 0.55)) * sway + lean * 0.25 + tuck * 0.35
      st.cape[k] += (target - st.cape[k]) * (1 - Math.exp(-dt * (11 - k * 2.2)))
      J['cape' + k].rotation.set(ride * (k ? Math.sin(t * 6.5 - k * 1.2) * 0.12 * (0.4 + 0.6 * rush) : -STREAM), 0, st.cape[k])
    }
    J.cape0.scale.set(1 - 0.45 * ride, 1 - 0.3 * ride, 1) // gathered up in the wind, so it clears his legs and his straight staff arm

    // the somersault cloud: sweeps in from the side and sinks as he lands
    const c = cloud.current, away = (1 - S.cloud) ** 2
    c.position.copy(S.wk)
    c.position.x -= Math.cos(yaw) * away * 8
    c.position.z += Math.sin(yaw) * away * 8
    c.position.y += S.dip * 1.2 + bob - 0.34 - away * 2 // its puffy top at his ankles: he stands on it, shins and knees in view
    c.rotation.set(0, yaw, away * 1.6)
    c.scale.setScalar(S.cloud + 0.001)
    c.children[1].position.x = 0.5 + Math.sin(t * 0.8) * 0.25
  })

  return (
    <>
      <group ref={bind('root')}>
        <Limb part={P.thigh} at={[-20, -4]} z={-0.02} bind={bind('legL')}>
          <Limb part={P.shin} at={[0, -LEGS.thigh]} z={0.002} bind={bind('kneeL')} />
        </Limb>
        <Limb part={P.thigh} at={[20, -4]} z={-0.02} flip bind={bind('legR')}>
          <Limb part={P.shin} at={[0, -LEGS.thigh]} z={0.002} flip bind={bind('kneeR')} />
        </Limb>
        <Limb part={P.tail} at={[8, 0]} z={-0.012} bind={bind('tail')} />
        <Limb part={P.torso} at={[0, 0]} bind={bind('torso')}>
          <Limb part={P.upper} at={[-50, 134]} z={-0.016} bind={bind('armL')}>
            <Limb part={P.fore} at={[0, -58]} z={0.003} bind={bind('elbowL')} />
          </Limb>
          <Limb part={P.upper} at={[50, 134]} z={-0.016} flip bind={bind('armR')}>
            <Limb part={P.fore} at={[0, -58]} z={0.003} flip bind={bind('elbowR')} />
          </Limb>
          <Limb part={P.staff} at={[0, 0]} bind={bind('staff')} />
          <Limb part={P.head} at={[0, 140]} z={0.012} bind={bind('head')}>
            <Limb part={P.plume} at={[-10, 104]} z={-0.006} flip bind={bind('plume0')} />
            <Limb part={P.plume} at={[10, 104]} z={-0.006} bind={bind('plume1')} />
          </Limb>
          <Limb part={P.cape[0]} at={[0, 134]} z={0.03} bind={bind('cape0')}>
            <Limb part={P.cape[1]} at={[0, -100]} z={0.004} bind={bind('cape1')}>
              <Limb part={P.cape[2]} at={[0, -100]} z={0.004} bind={bind('cape2')}>
                <Limb part={P.cape[3]} at={[0, -100]} z={0.004} bind={bind('cape3')} />
              </Limb>
            </Limb>
          </Limb>
        </Limb>
      </group>
      <group ref={cloud}>
        <mesh geometry={PLANE} material={cloudMat[0]} position={[0.1, 0, 0.1]} scale={[3.8, 1.3, 1]} castShadow receiveShadow />
        <mesh geometry={PLANE} material={cloudMat[1]} position={[0.5, -0.25, 0.16]} scale={[2.3, 0.8, 1]} castShadow />
      </group>
    </>
  )
}

const EDGE = 16 // px a squeezed plaque keeps clear of the screen edges (room for its rods)
/** Where a plaque centred at (x, y) with `scale` and unscaled size w × h ends up on a W × H screen.
 *  On a wide screen a plaque is a small card beside its point and is left exactly where the camera puts it. On a phone
 *  it is most of the screen wide, so centred on a point 3/4 of the way across it hangs half off the edge; there it is
 *  shrunk to fit and slid back inside. `k` fades that in as plaques go from 40% to 60% of the screen width, so desktops
 *  (well under 40%) are untouched. Pure: same inputs, same answer, so scrolling back replays exactly. */
function fitOnScreen(x: number, y: number, scale: number, w: number, h: number, W: number, H: number) {
  const k = clamp((w / W - 0.4) / 0.2, 0, 1)
  if (!k) return [x, y, scale]
  const s = Math.min(scale, (W - 2 * EDGE) / w, (H - 2 * EDGE) / h), hw = (w * s) / 2, hh = (h * s) / 2
  const fx = clamp(x, EDGE + hw, W - EDGE - hw), fy = clamp(y, EDGE + hh, H - EDGE - hh)
  return [lerp(x, fx, k), lerp(y, fy, k), lerp(scale, s, k)]
}

/** Pins each HTML plaque to its point in the painting: it grows as you fly up to it and slides past as you leave.
 *  Flying in, the handscroll unrolls left to right (--open, from distance so it scrubs); once open the ink spreads (CSS, data-inked).
 *  On narrow screens fitOnScreen keeps it inside the edges. */
function Plaques() {
  const v = useMemo(() => new THREE.Vector3(), [])
  // what each plaque was last given, so the page is only touched when something changes (o = -1: nothing written yet)
  const last = useMemo(() => ANCHORS.map(() => ({ el: null as HTMLElement | null, o: -1, open: '', inked: false, inert: false })), [])
  // each plaque's laid-out size (unaffected by the transform), kept by a ResizeObserver so the frame loop never reads layout
  const sizes = useMemo(() => new Map<string, [number, number]>(), [])
  useEffect(() => {
    const ro = new ResizeObserver((es) => { for (const e of es) { const el = e.target as HTMLElement; sizes.set(el.id, [el.offsetWidth, el.offsetHeight]) } })
    for (const a of ANCHORS) { const el = document.getElementById(a.id); if (el) ro.observe(el) }
    return () => ro.disconnect()
  }, [sizes])
  useFrame(({ camera, size }) => {
    ANCHORS.forEach((a, i) => {
      const s = last[i]
      s.el ??= document.getElementById(a.id)
      const el = s.el
      if (!el) return
      v.set(...a.pos).applyMatrix4(camera.matrixWorldInverse)
      const d = v.length(), ahead = v.z < 0
      v.applyMatrix4(camera.projectionMatrix)
      const near = ahead ? clamp((40 - d) / 12, 0, 1) : 0, leave = clamp((d - 6) / 5, 0, 1)
      const o = Math.min(1, near * 5) * leave, open = smoothstep(near, 0.2, 0.9)
      // each value is written only when it changed, so a plaque that stays hidden costs nothing; it still gets reset to
      // rolled-up and un-inked after it's passed, as before
      const op = open.toFixed(3), inked = open > 0.98, inert = open < 0.9
      if (o !== s.o) {
        el.style.opacity = String(o)
        if (s.o < 0 || (o > 0) !== (s.o > 0)) el.style.visibility = o ? 'visible' : 'hidden'
      }
      if (op !== s.open) el.style.setProperty('--open', op)
      if (inked !== s.inked) el.toggleAttribute('data-inked', inked)
      if (inert !== s.inert || s.o < 0) el.inert = inert
      Object.assign(s, { o, open: op, inked, inert })
      // while it's on screen it follows its point every frame (the camera and the window size can both move it)
      if (!o) return
      const [w, h] = sizes.get(a.id) ?? [0, 0]
      const [x, y, sc] = fitOnScreen(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, clamp(17.4 / d, 0.3, 1.25), w, h, size.width, size.height)
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${sc})`
    })
  })
  return null
}

// Sheets are painted when they mount, and painting is the slow part of loading. So only Huaguo Shan (all you see flying out of
// the cave) is built before the clouds part; the rest is added a few sheets at a time behind the opening flight, in journey order,
// so the crossing and Zhangjiajie are in before the flight lands and Huangshan follows in the background.
const OPENING = REGIONS[0].pieces.length
const SHEETS = REGIONS.reduce((n, r) => n + r.pieces.length, 0)
const UPTO_ZJ = REGIONS.slice(0, REGIONS.indexOf(FRAME.zhangjiajie) + 1).reduce((n, r) => n + r.pieces.length, 0)

export default function World({ reduced, onReady }: { reduced: boolean; onReady: () => void }) {
  // the sheets are painted from the painting crops, so wait for those before building the world
  const [shown, setShown] = useState(0) // how many sheets are built, counted through REGIONS in order
  const ready = shown > 0
  useEffect(() => { loadPaintings().then(() => setShown(OPENING)) }, [])
  useEffect(() => {
    // "ready" means the opening is painted and on screen: two frames after its sheets mount
    if (shown === OPENING) requestAnimationFrame(() => requestAnimationFrame(onReady))
    if (process.env.NODE_ENV !== 'production' && shown >= UPTO_ZJ && shown - 8 < UPTO_ZJ)
      console.assert(intro.k < 1 || reduced, 'loading: Zhangjiajie was still being built when the opening flight landed')
    if (!shown || shown >= SHEETS) return
    const id = setTimeout(() => setShown((n) => Math.min(SHEETS, n + 12)), 60)
    return () => clearTimeout(id)
  }, [shown, onReady, reduced])
  let left = shown
  return (
    <Canvas flat shadows dpr={[1, 1.75]} camera={{ near: 0.3, far: 1600, fov: 27 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <fog attach="fog" args={[MIST, 40, 380]} />
      <Rig reduced={reduced} />
      {REGIONS.map((r) => {
        const n = Math.min(left, r.pieces.length)
        left -= n
        return (
          <group key={r.id} position={r.origin} rotation-y={r.yaw}>
            {r.pieces.slice(0, n).map((p, i) => !PAINTED.has(p.kind) && <Sheet key={i} p={p} reduced={reduced} />)}
          </group>
        )
      })}
      <Batches shown={shown} reduced={reduced} />
      {ready && <Backdrop />}
      {ready && <Wukong reduced={reduced} />}
      <Plaques />
      <Stats />
    </Canvas>
  )
}

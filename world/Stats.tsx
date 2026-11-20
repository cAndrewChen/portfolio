'use client'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

// A small speed readout for checking performance: frames per second, average frame time and draw calls.
// Shown in the dev server, and in any build when the URL has ?stats (so it can be checked on the live site from a
// slow laptop). It's a plain text tool, not part of the painting.
const enabled = () => process.env.NODE_ENV !== 'production' || new URLSearchParams(location.search).has('stats')

export default function Stats() {
  const on = useMemo(enabled, [])
  return on ? <Probe /> : null
}

function Probe() {
  const gl = useThree((s) => s.gl)
  const box = useMemo(() => {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;left:.5rem;bottom:.5rem;z-index:20;pointer-events:none;font:12px/1.4 ui-monospace,monospace;color:#1c1916;background:rgba(239,229,207,.8);padding:.2rem .45rem'
    return el
  }, [])
  useEffect(() => {
    document.body.appendChild(box)
    return () => box.remove()
  }, [box])
  const acc = useMemo(() => ({ frames: 0, time: 0, calls: 0 }), [])
  useFrame((_, dt) => {
    // gl.info is reset at the start of every render, so this is the previous frame's total, shadow pass included
    acc.frames++; acc.time += dt; acc.calls += gl.info.render.calls
    if (acc.time < 0.5) return
    box.textContent = `${Math.round(acc.frames / acc.time)} fps · ${((acc.time / acc.frames) * 1000).toFixed(1)} ms · ${Math.round(acc.calls / acc.frames)} calls`
    acc.frames = 0; acc.time = 0; acc.calls = 0
  })
  return null
}

'use client'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { sections, site } from '../content/site'
import { SEGMENTS, TOTAL, arrival, intro, locate, progress } from '../journey/journey'

const World = dynamic(() => import('../world/World'), { ssr: false })

// The loading cloud bank: a 6x6 scatter of paper clouds in four depths. Each drifts away from the centre
// at its own pace while it fades. Values are rounded so server and browser render identical markup.
const TONES = ['#d6cab0', '#e2d8c0', '#ede4ce', '#f8f2e4']
const LOBES = [[100, 70, 94, 22], [30, 66, 20, 17], [56, 52, 27, 25], [90, 40, 34, 32], [128, 46, 30, 28], [160, 60, 24, 20], [178, 70, 16, 13]]
const PUFFS = Array.from({ length: 36 }, (_, i) => {
  const h = (n: number) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x) }
  const layer = (i * 7) % 4
  const x = ((i % 6) + 0.5) / 6 * 100 + (h(1) - 0.5) * 16, y = (Math.floor(i / 6) + 0.5) / 6 * 100 + (h(2) - 0.5) * 14
  const r = (v: number) => Math.round(v * 100) / 100
  return {
    layer, x: r(x), y: r(y), w: r(40 + h(3) * 30), flip: h(7) > 0.5 ? -1 : 1,
    dx: r((x - 50) * (1.3 + layer * 0.35) + (h(4) - 0.5) * 24), dy: r((y - 50) * 0.5 + (h(8) - 0.5) * 10), // nearer clouds travel further
    delay: r(h(5) * 0.6), dur: r(2.2 + h(6) * 1.6),
  }
}).sort((a, b) => a.layer - b.layer)

const stops = SEGMENTS.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'explore')

export default function Experience() {
  const track = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = useState(false)
  const [at, setAt] = useState(0) // which segment we are in
  const [loaded, setLoaded] = useState(false)

  // Once the world is painted the clouds part and the camera flies out of the Water Curtain Cave.
  // The page cannot be scrolled until that flight has landed (reduced motion: it lands at once).
  const flying = useRef(true)
  useEffect(() => {
    const html = document.documentElement
    html.style.overflow = 'hidden'
    flying.current = true
    const land = () => { flying.current = false; html.style.overflow = '' }
    if (!loaded) return land
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const arrive = () => root.current?.style.setProperty('--arrive', String(Math.max(0, (intro.k - 0.75) / 0.25)))
    const fly = gsap.to(intro, { k: 1, duration: rm ? 0 : 5.5, delay: rm ? 0 : 0.5, ease: 'power2.inOut', onUpdate: arrive, onComplete: () => { arrive(); land() } })
    return () => { fly.kill(); land() }
  }, [loaded])

  useEffect(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduced(rm)
    intro.k = 0 // start inside the cave
    gsap.registerPlugin(ScrollTrigger)
    const tween = gsap.to(progress, {
      p: 1, ease: 'none',
      scrollTrigger: {
        trigger: track.current, start: 'top top', end: 'bottom bottom',
        scrub: rm ? true : 1, // the 3D world eases after the scroll; the UI below follows it directly
        onUpdate: (self) => {
          const { i, t } = locate(self.progress)
          setAt(i)
          root.current!.style.setProperty('--intro', String(i === 0 ? Math.max(0, 1 - t * 2.5) : 0))
        },
      },
    })
    return () => { tween.scrollTrigger?.kill(); tween.kill() }
  }, [])

  const go = (i: number) =>
    !flying.current && window.scrollTo({
      top: arrival(i) * (document.documentElement.scrollHeight - window.innerHeight),
      behavior: reduced ? 'auto' : 'smooth',
    })
  const ready = useCallback(() => { document.fonts.ready.then(() => setLoaded(true)) }, [])
  const workStop = stops.find((x) => (x.s as { section?: string }).section === 'projects')

  return (
    <div ref={root} className="experience">
      {workStop && <button className="skip" onClick={() => go(workStop.i)}>Skip to projects</button>}
      <div className="sky" aria-hidden="true" />
      <div className="stage" aria-hidden="true"><World reduced={reduced} onReady={ready} /></div>
      <div className="grain" aria-hidden="true" />

      {/* the ink filter for the plaques' writing (globals.css .ink): ragged letter edges plus a faint feather into the paper */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="bleed" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation=".7" result="b" />
          <feComponentTransfer in="b" result="h"><feFuncA type="linear" slope=".45" /></feComponentTransfer>
          <feMerge><feMergeNode in="h" /><feMergeNode in="d" /></feMerge>
        </filter>
      </svg>

      <main>
        <section className="intro">
          <h1>{site.name}</h1>
          <p>{site.intro}</p>
        </section>

        {stops.map(({ s, i }) => {
          if (s.kind !== 'explore') return null
          const sec = s.section ? sections[s.section] : null
          return (
            <div key={s.id}>
              <p className="inscription" data-on={at === i}>
                <span lang="zh">{s.hanzi}</span>
                <small>{s.name}</small>
              </p>
              {sec && (
                <section id={s.section} aria-labelledby={`${s.section}-title`}>
                  {/* each plaque is pinned to a point among the pillars by World.tsx */}
                  <div className="plaque" id={`plaque-${s.id}-0`}>
                    <div><div className="ink">
                      <h2 id={`${s.section}-title`}>
                        {sec.title} {sec.hanzi && <span lang="zh" aria-hidden="true">{sec.hanzi}</span>}
                      </h2>
                      {sec.body && <p>{sec.body}</p>}
                    </div></div>
                  </div>
                  {sec.projects?.map((p, k) => (
                    <article className="plaque" id={`plaque-${s.id}-${k + 1}`} key={p.title}>
                      <div><div className="ink">
                        {p.kind && <p className="kind">{p.kind}</p>}
                        <h3>{p.title}</h3>
                        {p.media && (/\.(mp4|webm)$/.test(p.media.src)
                          ? <video src={p.media.src} aria-label={p.media.alt} controls preload="none" />
                          : <img src={p.media.src} alt={p.media.alt} loading="lazy" />)}
                        <p>{p.summary}</p>
                        {p.stack && <p className="stack">Built with {p.stack.join(', ')}</p>}
                        {p.links && <p className="links">{p.links.map((l) => <a key={l.label} href={l.href}>{l.label}</a>)}</p>}
                      </div></div>
                    </article>
                  ))}
                </section>
              )}
            </div>
          )
        })}

        <p className="hint">Scroll to fly</p>
      </main>

      {/* the clouds that cover everything until the world is painted */}
      <div className="veil" data-open={loaded} role="status">
        {PUFFS.map((c, i) => (
          <svg
            key={i} className="puff" viewBox="0 0 200 100" aria-hidden="true"
            style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}vw`, transitionDelay: `${c.delay}s`, transitionDuration: `${c.dur}s`, '--dx': `${c.dx}vw`, '--dy': `${c.dy}vh`, '--f': c.flip } as React.CSSProperties}
          >
            {/* outline first, then fill: only the outer edge of the joined lobes survives */}
            {LOBES.map(([cx, cy, rx, ry], k) => <ellipse key={k} cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#6a6257" strokeWidth="2.4" />)}
            {LOBES.map(([cx, cy, rx, ry], k) => <ellipse key={k} cx={cx} cy={cy} rx={rx} ry={ry} fill={TONES[c.layer]} />)}
            <ellipse cx="100" cy="80" rx="88" ry="11" fill="#3a2a12" opacity=".07" />
            {LOBES.slice(2, 6).map(([cx, cy, rx], k) => (
              <g key={k} fill="none" stroke="#6a6257" strokeOpacity=".38" strokeWidth="1.4" strokeLinecap="round">
                <path d={`M${cx - rx * 0.62} ${cy + 2} A${rx * 0.62} ${rx * 0.62} 0 0 1 ${cx + rx * 0.3} ${cy - rx * 0.52}`} />
                <path d={`M${cx - rx * 0.28} ${cy + 6} A${rx * 0.3} ${rx * 0.3} 0 1 1 ${cx + rx * 0.3} ${cy + 5}`} />
              </g>
            ))}
          </svg>
        ))}
        <p>{loaded ? '' : 'Loading'}</p>
      </div>

      <div ref={track} style={{ height: `${(TOTAL + 1) * 100}vh` }} />
    </div>
  )
}

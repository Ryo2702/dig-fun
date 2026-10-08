import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { zones } from '../data/mineData'
import DepthZone from './DepthZone'

gsap.registerPlugin(ScrollTrigger)

function progressToDepth(progress) {
  if (progress >= 1) return zones.at(-1).endDepth
  const scaled = Math.max(0, progress) * zones.length
  const index = Math.min(zones.length - 1, Math.floor(scaled))
  const localProgress = scaled - index
  const zone = zones[index]
  return zone.startDepth + (zone.endDepth - zone.startDepth) * localProgress
}

export default function MineWorld({
  discoveries,
  onDepthChange,
  onScrollState,
  onDiscover,
  playSound,
  onReact,
  shakeSignal,
  onShake,
}) {
  const worldRef = useRef(null)
  const cameraRef = useRef(null)
  const idleTimer = useRef(null)
  const lastDepth = useRef(-1)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = gsap.context(() => {
      ScrollTrigger.create({
        trigger: worldRef.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          const depth = progressToDepth(self.progress)
          if (Math.abs(depth - lastDepth.current) > 1 || self.progress === 1) {
            lastDepth.current = depth
            onDepthChange(depth, self.progress)
          }

          if (!reduceMotion) {
            const velocity = Math.abs(self.getVelocity())
            onScrollState(velocity > 1350 ? 'running' : 'walking')
            window.clearTimeout(idleTimer.current)
            idleTimer.current = window.setTimeout(
              () => onScrollState(depth > 50000 ? 'tired' : 'looking'),
              180,
            )
          }
        },
      })

      if (!reduceMotion) {
        gsap.utils.toArray('.parallax-slow').forEach((layer) => {
          gsap.fromTo(
            layer,
            { yPercent: -7 },
            {
              yPercent: 10,
              ease: 'none',
              scrollTrigger: {
                trigger: layer.closest('.depth-zone'),
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.6,
              },
            },
          )
        })
      }
    }, worldRef)

    return () => {
      window.clearTimeout(idleTimer.current)
      context.revert()
    }
  }, [onDepthChange, onScrollState])

  useEffect(() => {
    if (!shakeSignal || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(
      cameraRef.current,
      { x: -7, y: 4 },
      { x: 7, y: -3, repeat: 7, yoyo: true, duration: 0.045, clearProps: 'transform' },
    )
  }, [shakeSignal])

  return (
    <main ref={worldRef} className="mine-world" id="mine-start">
      <div ref={cameraRef} className="mine-world__camera">
        <div className="shaft-rails" aria-hidden="true"><i /><i /><span /><span /><span /><span /></div>
        {zones.map((zone, index) => (
          <DepthZone
            key={zone.id}
            zone={zone}
            index={index}
            eager={index < 2}
            discoveries={discoveries}
            onDiscover={onDiscover}
            playSound={playSound}
            onReact={onReact}
            onShake={onShake}
          />
        ))}
        <section className="mine-end" aria-label="End of the current mine">
          <div className="end-diamond" aria-hidden="true">◆</div>
          <p>160 KM · PERSONAL BEST?</p>
          <h2>THE HOLE CONTINUES.</h2>
          <span>So does the bit.</span>
          <a href="#top">RETURN TO SURFACE ↑</a>
        </section>
      </div>
    </main>
  )
}

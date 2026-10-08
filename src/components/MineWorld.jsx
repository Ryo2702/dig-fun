import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { zones } from '../data/mineData'
import DepthZone from './DepthZone'

gsap.registerPlugin(ScrollTrigger)

export default function MineWorld({
  discoveries,
  onDepthChange,
  onScrollState,
  onDiscover,
  playSound,
  onReact,
  onStat,
  shakeSignal,
  onShake,
}) {
  const worldRef = useRef(null)
  const cameraRef = useRef(null)
  const idleTimer = useRef(null)
  const sleepTimer = useRef(null)
  const lastDepth = useRef(-1)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let boundaries = []
    const measure = () => {
      boundaries = [...worldRef.current.querySelectorAll('.depth-zone')].map((node, index) => ({
        top: node.getBoundingClientRect().top + window.scrollY,
        height: node.offsetHeight,
        zone: zones[index],
      }))
    }
    measure()
    const context = gsap.context(() => {
      ScrollTrigger.create({
        trigger: worldRef.current,
        start: 'top top',
        end: 'bottom bottom',
        onRefresh: measure,
        onUpdate: (self) => {
          const y = window.scrollY
          const boundary = boundaries.findLast((item) => y >= item.top) || boundaries[0]
          const fraction = Math.max(0, Math.min(1, (y - boundary.top) / boundary.height))
          const depth = boundary.zone.startDepth + (boundary.zone.endDepth - boundary.zone.startDepth) * fraction
          if (Math.abs(depth - lastDepth.current) > 1 || self.progress === 1) {
            lastDepth.current = depth
            onDepthChange(depth, self.progress)
          }

          if (!reduceMotion) {
            const velocity = Math.abs(self.getVelocity())
            onScrollState(velocity > 1350 ? 'running' : 'walking')
            window.clearTimeout(idleTimer.current)
            window.clearTimeout(sleepTimer.current)
            idleTimer.current = window.setTimeout(
              () => {
                onScrollState('tired')
                onStat('timesAlmostGivingUp')
              },
              5000,
            )
            sleepTimer.current = window.setTimeout(() => onScrollState('sleeping'), 12000)
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

    let resizeTimer
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150)
    })
    observer.observe(worldRef.current)

    return () => {
      observer.disconnect()
      window.clearTimeout(resizeTimer)
      window.clearTimeout(idleTimer.current)
      window.clearTimeout(sleepTimer.current)
      context.revert()
    }
  }, [onDepthChange, onScrollState, onStat])

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
            onStat={onStat}
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

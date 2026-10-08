import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'

export default function InteractiveRock({
  artifact,
  discovered,
  label = 'Suspicious rock',
  variant = 'stone',
  onDiscover,
  onReact,
  onStat,
  playSound,
}) {
  const [hits, setHits] = useState(discovered ? 3 : 0)
  const rockRef = useRef(null)

  useEffect(() => {
    if (discovered) setHits(3)
  }, [discovered])

  function strike() {
    if (hits >= 3) return
    const nextHits = hits + 1
    setHits(nextHits)
    playSound('impact')
    onReact('digging')

    const rock = rockRef.current
    gsap.killTweensOf(rock)
    gsap.fromTo(
      rock,
      { x: -4, rotate: -1 },
      { x: 4, rotate: 1, repeat: 5, yoyo: true, duration: 0.045, clearProps: 'x,rotation' },
    )
    gsap.fromTo(
      rock?.querySelectorAll('.rock-chip'),
      { opacity: 1, x: 0, y: 0 },
      { opacity: 0, x: () => gsap.utils.random(-28, 28), y: () => gsap.utils.random(-24, 18), duration: 0.35 },
    )

    if (nextHits === 3) {
      onStat?.('rocksBroken')
      gsap.to(rock, {
        scale: 0.72,
        opacity: 0,
        y: 22,
        duration: 0.38,
        delay: 0.12,
        ease: 'steps(4)',
        onComplete: () => onDiscover(artifact.id),
      })
    }
  }

  return (
    <div className={`interactive-rock-wrap interactive-rock-wrap--${variant} ${hits >= 3 ? 'is-broken' : ''}`}>
      <motion.button
        ref={rockRef}
        type="button"
        className="interactive-rock"
        onClick={strike}
        whileHover={hits < 3 ? { scale: 1.04 } : undefined}
        whileTap={hits < 3 ? { scale: 0.96 } : undefined}
        disabled={hits >= 3}
        aria-label={hits >= 3 ? `${label}, excavated` : `${label}, hit ${hits + 1} of 3`}
      >
        <span className="rock-face" aria-hidden="true">
          <i className="rock-crack rock-crack--one" />
          <i className="rock-crack rock-crack--two" />
          <i className="rock-chip rock-chip--one" />
          <i className="rock-chip rock-chip--two" />
          <i className="rock-chip rock-chip--three" />
        </span>
        <span className="rock-hint">{hits >= 3 ? 'OPEN' : `${3 - hits} HIT${3 - hits === 1 ? '' : 'S'}`}</span>
      </motion.button>
      <div className="rock-treasure" aria-hidden="true"><span>{artifact.icon}</span></div>
    </div>
  )
}

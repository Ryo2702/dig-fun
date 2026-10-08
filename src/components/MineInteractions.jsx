import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'

export function DraggableDebris({ cleared, onClear, playSound, onReact }) {
  const [dragged, setDragged] = useState(cleared)

  useEffect(() => setDragged(cleared), [cleared])

  function clearDebris() {
    if (dragged) return
    setDragged(true)
    playSound('debris')
    onReact('inspect')
    onClear()
  }

  return (
    <div className={`debris-puzzle ${dragged ? 'is-cleared' : ''}`}>
      <div className="side-tunnel" aria-hidden="true"><span>?</span></div>
      <motion.button
        type="button"
        className="debris-pile"
        drag={dragged ? false : 'x'}
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => Math.abs(info.offset.x) > 72 && clearDebris()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          clearDebris()
        }}
        animate={dragged ? { x: 145, opacity: 0 } : { x: 0, opacity: 1 }}
        whileTap={dragged ? undefined : { scale: 0.97 }}
        aria-label={dragged ? 'Side tunnel cleared' : 'Drag debris aside to reveal the blocked tunnel'}
        disabled={dragged}
      >
        <i /><i /><i /><i /><span>DRAG →</span>
      </motion.button>
    </div>
  )
}

export function RevealCrack({ onReact, onStat, playSound, message = 'THE NEXT BLOCK KNOWS.' }) {
  const [revealed, setRevealed] = useState(false)

  function reveal() {
    if (!revealed) {
      playSound('secret')
      onStat?.('wallsInspected')
    }
    setRevealed(true)
    onReact('inspect')
  }

  return (
    <motion.button
      type="button"
      className={`wall-crack ${revealed ? 'is-revealed' : ''}`}
      onMouseEnter={reveal}
      onFocus={reveal}
      onClick={reveal}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      aria-expanded={revealed}
    >
      <span className="wall-crack__line" aria-hidden="true"><i /><i /><i /></span>
      <span className="wall-crack__message">{message}</span>
      <span className="wall-crack__hint">{revealed ? 'SIGNAL FOUND' : 'SUSPICIOUS CRACK'}</span>
    </motion.button>
  )
}

export function MineMachine({ active: savedActive = false, playSound, onReact }) {
  const [active, setActive] = useState(savedActive)
  const machineRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const tween = gsap.to(machineRef.current, {
      x: 2,
      repeat: -1,
      yoyo: true,
      duration: 0.055,
      ease: 'none',
    })
    return () => tween.kill()
  }, [active])

  function activate() {
    setActive((current) => !current)
    playSound('machine')
    onReact('startled')
  }

  return (
    <div ref={machineRef} className={`mine-machine ${active ? 'is-active' : ''}`}>
      <div className="machine-wheel" aria-hidden="true"><i /><i /><i /></div>
      <div className="machine-body" aria-hidden="true"><b>07</b><span /></div>
      <button type="button" className="machine-lever" onClick={activate} aria-pressed={active}>
        <i aria-hidden="true" />
        <span>{active ? 'STOP DRILL' : 'START DRILL'}</span>
      </button>
      <div className="machine-smoke" aria-hidden="true"><i /><i /><i /></div>
    </div>
  )
}

export function InspectArtifact({ icon, label, found, onInspect, playSound, onReact, className = '' }) {
  function inspect() {
    if (!found) {
      playSound('secret')
      onReact('inspect')
      onInspect()
    }
  }

  return (
    <motion.button
      type="button"
      className={`inspect-artifact ${found ? 'is-found' : ''} ${className}`}
      onClick={inspect}
      whileHover={found ? undefined : { y: -4, rotate: -1 }}
      whileTap={found ? undefined : { scale: 0.94 }}
      disabled={found}
      aria-label={found ? `${label}, collected` : `Inspect ${label}`}
    >
      <span aria-hidden="true">{found ? '·' : icon}</span>
      <small>{found ? 'RECOVERED' : 'INSPECT'}</small>
    </motion.button>
  )
}

export function BlastPlunger({ blasted, onBlast, playSound, onReact }) {
  const blastRef = useRef(null)

  function trigger() {
    if (blasted) return
    playSound('explosion')
    onReact('startled')
    onBlast()
    gsap.fromTo(
      blastRef.current?.querySelectorAll('.blast-pixel'),
      { opacity: 1, scale: 0.2, x: 0, y: 0 },
      {
        opacity: 0,
        scale: 1,
        x: () => gsap.utils.random(-120, 120),
        y: () => gsap.utils.random(-100, 30),
        duration: 0.7,
        stagger: 0.015,
        ease: 'power2.out',
      },
    )
  }

  return (
    <div ref={blastRef} className={`blast-station ${blasted ? 'is-blasted' : ''}`}>
      <div className="dynamite" aria-hidden="true"><i /><i /><i /><span /></div>
      <motion.button
        type="button"
        className="blast-plunger"
        onClick={trigger}
        whileTap={blasted ? undefined : { y: 8 }}
        disabled={blasted}
      >
        <i aria-hidden="true" />
        <span>{blasted ? 'KABOOMED' : 'DO NOT PUSH'}</span>
      </motion.button>
      <div className="blast-cloud" aria-hidden="true">
        {Array.from({ length: 16 }, (_, index) => <i className="blast-pixel" key={index} />)}
      </div>
    </div>
  )
}

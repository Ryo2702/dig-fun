import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import gsap from 'gsap'
import { formatPurchase } from '../utils/activity'

export default function AutonomyOverlay({ state, offlineSummary, onDismissMajor, onDismissJoin, onDismissEvent, onDismissNotice, onMute, onReaction, onRace, onOpenCrew, onInspectMajor }) {
  const reduced = useReducedMotion()
  const majorRef = useRef(null)
  const [puzzleHidden, setPuzzleHidden] = useState(null)
  const [resultHidden, setResultHidden] = useState(null)
  const live = state.activity?.mode === 'live' && state.activity?.liveAvailable
  const activityLabel = live ? 'LIVE ON-CHAIN ACTIVITY' : 'SIMULATED MINE ACTIVITY'

  useEffect(() => {
    setPuzzleHidden(null)
    setResultHidden(null)
  }, [state.puzzle?.id])

  useEffect(() => {
    if (!state.major || !majorRef.current || reduced) return undefined
    const element = majorRef.current
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'steps(5)' } })
      timeline.fromTo(element, { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: .35, snap: { y: 1 } })
      timeline.fromTo(element.querySelectorAll('.autonomy-confetti i'), { opacity: 0, y: 12, x: 0 }, { opacity: 1, y: -36, x: index => Math.round((index % 5 - 2) * 28), duration: .65, stagger: .03, snap: { x: 1, y: 1 } }, 0)
    }, element)
    return () => context.revert()
  }, [state.major?.id, reduced])

  return <>
    <div className="mine-ticker" role="status" aria-live="polite">
      <span className="ticker-signal"><i /><i /><i /></span>
      <strong>{activityLabel}</strong>
      <span>{state.ticker}</span>
      <button onClick={onOpenCrew}>COMMUNITY RECORDS ↗</button>
      <button className="mute-ticker" onClick={onMute}>{state.mute ? 'UNMUTE' : 'MUTE'}</button>
      <button className="ticker-close" onClick={onDismissNotice} aria-label="Close">×</button>
    </div>

    <AnimatePresence>
      {state.activity?.join && <motion.aside className="buyer-toast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="overlay-close" onClick={onDismissJoin} aria-label="Close">×</button>
        <small>{state.activity.join.verified ? 'LIVE ON-CHAIN ACTIVITY' : 'SIMULATED MINE ACTIVITY'}</small>
        <strong>{state.activity.join.title}</strong>
        <span>{state.activity.join.name} · {formatPurchase(state.activity.join.amount, state.activity.join.unit)}</span>
        <b>{state.activity.join.subtitle}</b>
      </motion.aside>}

      {state.event && <motion.div className={'mine-event mine-event--' + state.event.phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="overlay-close" onClick={onDismissEvent} aria-label="Close">×</button>
        <span>{state.event.phase === 'countdown' ? 'EVENT IN' : 'EVENT LIVE'}</span><strong>{state.event.name.toUpperCase()}</strong><b>{Math.ceil(state.event.remaining)}s</b>
      </motion.div>}

      {state.puzzle && !state.puzzle.done && puzzleHidden !== state.puzzle.id && <motion.aside className="puzzle-alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="overlay-close" onClick={() => setPuzzleHidden(state.puzzle.id)} aria-label="Close">×</button>
        <small>PUZZLE CHAMBER / {state.puzzle.kind.toUpperCase()}</small><strong>{state.puzzle.title}</strong><p>{state.puzzle.message || 'Reading ancient symbols'}</p><div className="puzzle-progress"><i style={{ width: state.puzzle.progress + '%' }} /></div><small className="puzzle-auto-note">The miner is working it out. Mining resumes when the door opens.</small>
      </motion.aside>}

      {state.puzzle?.done && resultHidden !== state.puzzle.id && <motion.div className="puzzle-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="overlay-close" onClick={() => setResultHidden(state.puzzle.id)} aria-label="Close">×</button>
        <small>CHAMBER CLEARED</small><strong>{state.puzzle.result}</strong><span>RESUMING THE SHAFT</span>
      </motion.div>}

      {offlineSummary && <motion.aside className="offline-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="overlay-close" onClick={onDismissMajor} aria-label="Close">×</button>
        <small>LOCAL TIMESTAMP / OFFLINE SHIFT</small><h2>YOUR MINER KEPT DIGGING</h2><div className="offline-stats"><span><b>{offlineSummary.blocks}</b> blocks broken</span><span><b>{offlineSummary.copper}</b> copper collected</span><span><b>{offlineSummary.silver}</b> silver collected</span><span><b>{offlineSummary.keys}</b> strange key found</span><span><b>{offlineSummary.meters}</b> meters gained</span></div><p>Offline mining is slower. Rare artifacts and SOL crystals require you to be present.</p>
      </motion.aside>}

      {state.major && !state.mute && <aside ref={majorRef} className="major-announcement" role="alert">
        <button className="overlay-close" onClick={onDismissMajor} aria-label="Close">×</button>
        <div className="autonomy-confetti">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><small>{state.major.sourceLabel || 'LOCAL CREW SIMULATION'}</small><h2>{state.major.title}</h2><strong>{state.major.subtitle}</strong><div className="major-actions"><button onClick={onInspectMajor}>INSPECT ITEM</button><button onClick={onOpenCrew}>VIEW TUNNEL</button><button onClick={onRace}>FOLLOW THERE</button><button onClick={() => onReaction('NICE')}>NICE</button><button onClick={() => onReaction('RIGGED')}>RIGGED</button></div><button className="mute-announcement" onClick={onMute}>MUTE EVENTS</button>
      </aside>}
    </AnimatePresence>
  </>
}

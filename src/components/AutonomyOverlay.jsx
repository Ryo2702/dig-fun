import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import gsap from 'gsap'
import { AUTO_STRATEGIES } from '../utils/autonomy'

const number = value => Number.isFinite(value) ? value : 0

export default function AutonomyOverlay({ state, offlineSummary, onToggleAuto, onStrategy, onDismissMajor, onMute, onPuzzle, onReaction, onRace }) {
  const reduced = useReducedMotion()
  const majorRef = useRef(null)
  const [crewOpen, setCrewOpen] = useState(false)
  const strategy = AUTO_STRATEGIES[state.auto.strategy] || AUTO_STRATEGIES['follow-sparkles']
  const openCrew = () => setCrewOpen(true)

  useEffect(() => {
    if (!state.major || !majorRef.current || reduced) return undefined
    const element = majorRef.current
    gsap.killTweensOf(element)
    gsap.fromTo(element, { opacity: 0, y: -24, scale: .92, rotate: -1 }, { opacity: 1, y: 0, scale: 1, rotate: 0, duration: .45, ease: 'steps(5)' })
    gsap.fromTo(element.querySelectorAll('.autonomy-confetti i'), { opacity: 0, y: 12, x: 0 }, { opacity: 1, y: -36, x: 'random(-80,80)', duration: .75, stagger: .04, ease: 'steps(5)' })
    return () => gsap.killTweensOf(element)
  }, [state.major?.id, reduced])

  return <>
    <div className="mine-ticker" role="status" aria-live="polite">
      <span className="ticker-signal"><i /><i /><i /></span>
      <strong>LIVE MINE</strong>
      <span>{state.ticker}</span>
      <button onClick={openCrew}>LOCAL CREW RECORDS ↗</button><button className="mute-ticker" onClick={onMute}>{state.mute ? 'UNMUTE' : 'MUTE'}</button>
    </div>

    <motion.aside className="auto-console" animate={{ opacity: 1, x: 0 }} transition={{ duration: .25 }}>
      <div className="auto-console-head">
        <div><small>PLAYER CONTROL</small><strong>AUTO MINE</strong></div>
        <button className={'auto-toggle ' + (state.auto.enabled ? 'is-on' : '')} onClick={onToggleAuto} aria-pressed={state.auto.enabled}>{state.auto.enabled ? 'ON' : 'OFF'}</button>
      </div>
      <div className="auto-decision">
        <span>AUTO MINER: <b>{strategy.label}</b></span>
        <strong>{state.auto.decision}</strong>
        <div className="auto-metrics"><span>Target <b>{state.auto.target ? 'Suspicious block' : 'Scanning'}</b></span><span>Distance <b>{number(state.auto.distance)} tiles</b></span><span>Confidence <b>{number(state.auto.confidence)}%</b></span></div>
      </div>
      <div className="auto-strategies" aria-label="Auto mine strategy">
        {Object.entries(AUTO_STRATEGIES).map(([key, item]) => <button key={key} className={state.auto.strategy === key ? 'selected' : ''} onClick={() => onStrategy(key)} aria-pressed={state.auto.strategy === key}><i>{item.icon}</i>{item.label}</button>)}
      </div>
      <small className="auto-note">Manual movement or clicking a block pauses Auto Mine instantly.</small>
    </motion.aside>

    <AnimatePresence>
      {state.event && <motion.div className={'mine-event mine-event--' + state.event.phase} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><span>{state.event.phase === 'countdown' ? 'EVENT IN' : 'EVENT LIVE'}</span><strong>{state.event.name.toUpperCase()}</strong><b>{Math.ceil(state.event.remaining)}s</b></motion.div>}
      {state.puzzle && !state.puzzle.done && <motion.aside className="puzzle-alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><small>PUZZLE CHAMBER / {state.puzzle.kind.toUpperCase()}</small><strong>{state.puzzle.title}</strong><p>{state.puzzle.clue || 'The miner is pacing, inspecting symbols, and trying not to touch the lava.'}</p><div className="puzzle-progress"><i style={{ width: state.puzzle.progress + '%' }} /></div><div className="puzzle-actions"><button onClick={() => onPuzzle('manual')}>SOLVE MANUALLY</button><button onClick={() => onPuzzle('assist')}>MINER ASSIST</button><button className="primary" onClick={() => onPuzzle('auto')}>AUTO SOLVE</button></div></motion.aside>}
      {state.puzzle?.done && <motion.div className="puzzle-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><small>CHAMBER CLEARED</small><strong>{state.puzzle.result}</strong><button onClick={() => onPuzzle('dismiss')}>BACK TO DIGGING</button></motion.div>}
      {offlineSummary && <motion.aside className="offline-card" initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .94 }}><small>LOCAL TIMESTAMP / OFFLINE SHIFT</small><h2>YOUR MINER KEPT DIGGING</h2><div className="offline-stats"><span><b>{offlineSummary.blocks}</b> blocks broken</span><span><b>{offlineSummary.copper}</b> copper collected</span><span><b>{offlineSummary.silver}</b> silver collected</span><span><b>{offlineSummary.keys}</b> strange key found</span><span><b>{offlineSummary.meters}</b> meters gained</span></div><p>Offline mining is slower. Rare artifacts and SOL crystals require you to be present.</p><button onClick={onDismissMajor}>RETURN TO THE SHAFT</button></motion.aside>}
      {state.major && !state.mute && <motion.aside ref={majorRef} className="major-announcement" role="alert"><div className="autonomy-confetti">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><small>CREW DISCOVERY / LOCAL SIMULATION</small><h2>{state.major.title}</h2><strong>{state.major.subtitle}</strong><div className="major-actions"><button onClick={openCrew}>INSPECT ITEM</button><button onClick={openCrew}>VIEW TUNNEL</button><button onClick={onRace}>RACE THERE</button><button onClick={() => onReaction('NICE')}>NICE</button><button onClick={() => onReaction('RIGGED')}>RIGGED</button><button onClick={onDismissMajor} aria-label="Dismiss announcement">×</button></div><button className="mute-announcement" onClick={onMute}>MUTE EVENTS</button></motion.aside>}
    </AnimatePresence>
    <AnimatePresence>{crewOpen && <motion.aside className="crew-drawer" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 28 }}><header><div><small>LOCAL SIMULATION / NO ONLINE PLAYERS</small><h2>LOCAL CREW RECORDS</h2></div><button onClick={() => setCrewOpen(false)} aria-label="Close crew records">×</button></header><p className="crew-disclaimer">Eight NPC miners are making their own decisions in this browser. Their records change while the mine runs.</p><div className="crew-list">{state.miners.map(miner => <article key={miner.id} className="crew-card"><span className="crew-avatar" style={{ '--crew-color': miner.color }}><i /><i /><i /></span><div><strong>{miner.name}</strong><small>{miner.role}</small><p>“{miner.speech}”</p><div className="crew-stats"><span>{miner.blocks} BLK</span><span>{Math.round(miner.deepest)}M</span><span>{miner.puzzles} PUZ</span><span>{miner.haul.gold + miner.haul.diamond + miner.haul.sol} RARE</span></div></div></article>)}</div><div className="record-board"><small>LEADERS / LIVE</small>{[['Deepest miner', 'deepest', 'm'], ['Most blocks destroyed', 'blocks', 'blocks'], ['Highest-value haul', 'value', 'points'], ['Most puzzles solved', 'puzzles', 'puzzles'], ['Biggest explosion', 'explosions', 'blocks'], ['Most unfortunate lava incident', 'lavaIncidents', 'incidents']].map(([label, key, unit]) => <div key={key}><span>{label}</span><strong>{state.records[key]?.name || 'YOU'} <b>{Math.round(state.records[key]?.[key] || 0)} {unit}</b></strong></div>)}</div><small className="crew-disclaimer">LOCAL CREW RECORDS · simulated offline NPCs · no server, wallet, or global ranking.</small></motion.aside>}</AnimatePresence>
  </>
}

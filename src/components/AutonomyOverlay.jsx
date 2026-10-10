import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import gsap from 'gsap'
import { formatPurchase } from '../utils/activity'

export default function AutonomyOverlay({ state, offlineSummary, inspectedMiner, onDismissMajor, onMute, onReaction, onRace, onInspect, onFollow, onOverview }) {
  const reduced = useReducedMotion()
  const majorRef = useRef(null)
  const [crewOpen, setCrewOpen] = useState(false)
  const [query, setQuery] = useState('')
  const openCrew = () => setCrewOpen(true)
  const live = state.activity?.mode === 'live' && state.activity?.liveAvailable
  const activityLabel = live ? 'LIVE ON-CHAIN ACTIVITY' : 'SIMULATED MINE ACTIVITY'
  const activityNote = live ? 'PUBLIC RPC · VERIFIED BALANCE DELTAS' : state.activity?.error || 'DEMO BUYERS · NO REAL USERS'
  const miners = state.miners.filter(miner => !query || `${miner.name} ${miner.wallet}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (!state.major || !majorRef.current || reduced) return undefined
    const element = majorRef.current
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'steps(5)' } })
      timeline.fromTo(element, { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: .45, snap: { y: 1 } })
      timeline.fromTo(element.querySelectorAll('.autonomy-confetti i'), { opacity: 0, y: 12, x: 0 }, { opacity: 1, y: -36, x: index => Math.round((index % 5 - 2) * 28), duration: .75, stagger: .04, snap: { x: 1, y: 1 } }, 0)
    }, element)
    return () => context.revert()
  }, [state.major?.id, reduced])

  return <>
    <div className="mine-ticker" role="status" aria-live="polite">
      <span className="ticker-signal"><i /><i /><i /></span>
      <strong>{activityLabel}</strong>
      <span>{state.ticker}</span>
      <button onClick={openCrew}>COMMUNITY RECORDS ↗</button><button className="mute-ticker" onClick={onMute}>{state.mute ? 'UNMUTE' : 'MUTE'}</button>
    </div>

    <AnimatePresence>
      {state.activity?.join && <motion.aside className="buyer-toast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><small>{state.activity.join.verified ? 'LIVE ON-CHAIN ACTIVITY' : 'SIMULATED MINE ACTIVITY'}</small><strong>{state.activity.join.title}</strong><span>{state.activity.join.name} · {formatPurchase(state.activity.join.amount, state.activity.join.unit)}</span><b>{state.activity.join.subtitle}</b></motion.aside>}
      {state.event && <motion.div className={'mine-event mine-event--' + state.event.phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span>{state.event.phase === 'countdown' ? 'EVENT IN' : 'EVENT LIVE'}</span><strong>{state.event.name.toUpperCase()}</strong><b>{Math.ceil(state.event.remaining)}s</b></motion.div>}
      {state.puzzle && !state.puzzle.done && <motion.aside className="puzzle-alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><small>PUZZLE CHAMBER / {state.puzzle.kind.toUpperCase()}</small><strong>{state.puzzle.title}</strong><p>{state.puzzle.message || 'Reading ancient symbols'}</p><div className="puzzle-progress"><i style={{ width: state.puzzle.progress + '%' }} /></div><small className="puzzle-auto-note">The miner is working it out. Mining resumes when the door opens.</small></motion.aside>}
      {state.puzzle?.done && <motion.div className="puzzle-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><small>CHAMBER CLEARED</small><strong>{state.puzzle.result}</strong><span>RESUMING THE SHAFT</span></motion.div>}
      {offlineSummary && <motion.aside className="offline-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><small>LOCAL TIMESTAMP / OFFLINE SHIFT</small><h2>YOUR MINER KEPT DIGGING</h2><div className="offline-stats"><span><b>{offlineSummary.blocks}</b> blocks broken</span><span><b>{offlineSummary.copper}</b> copper collected</span><span><b>{offlineSummary.silver}</b> silver collected</span><span><b>{offlineSummary.keys}</b> strange key found</span><span><b>{offlineSummary.meters}</b> meters gained</span></div><p>Offline mining is slower. Rare artifacts and SOL crystals require you to be present.</p><button onClick={onDismissMajor}>RETURN TO THE SHAFT</button></motion.aside>}
      {state.major && !state.mute && <aside ref={majorRef} className="major-announcement" role="alert"><div className="autonomy-confetti">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><small>{state.major.sourceLabel || 'LOCAL CREW SIMULATION'}</small><h2>{state.major.title}</h2><strong>{state.major.subtitle}</strong><div className="major-actions"><button onClick={openCrew}>INSPECT ITEM</button><button onClick={openCrew}>VIEW TUNNEL</button><button onClick={onRace}>FOLLOW THERE</button><button onClick={() => onReaction('NICE')}>NICE</button><button onClick={() => onReaction('RIGGED')}>RIGGED</button><button onClick={onDismissMajor} aria-label="Dismiss announcement">×</button></div><button className="mute-announcement" onClick={onMute}>MUTE EVENTS</button></aside>}
    </AnimatePresence>

    <AnimatePresence>{crewOpen && <motion.aside className="crew-drawer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><header><div><small>{activityLabel} / {activityNote}</small><h2>LOCAL CREW RECORDS</h2></div><button onClick={() => setCrewOpen(false)} aria-label="Close crew records">×</button></header><p className="crew-disclaimer">Every miner is simulated in this browser. Public activity is read-only when configured; all digging, loot, and records remain local.</p><div className="community-stats"><span><b>{state.miners.length}</b> active miners</span><span><b>{Math.round(state.community?.depth || 0)}m</b> community depth</span><span><b>{state.community?.buys || 0}</b> buys tracked</span><span><b>{state.community?.blocks || 0}</b> blocks cleared</span><span><b>{state.community?.ore?.diamond || 0}</b> diamonds</span><span><b>{state.community?.ore?.sol || 0}</b> SOL crystals</span></div><div className="crew-tools"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="SEARCH SHORT WALLET" aria-label="Search shortened wallet address" /><button onClick={onOverview}>MINE OVERVIEW</button></div><div className="crew-list">{miners.slice(0, 80).map(miner => <article className={`crew-card ${inspectedMiner === miner.id ? 'is-selected' : ''}`} key={miner.id}><span className="crew-avatar" style={{ '--crew-color': miner.color, '--crew-helmet': miner.appearance?.helmet || miner.color, '--crew-skin': miner.appearance?.skin || '#d0a57b' }}><i /><i /><i /></span><div><strong>{miner.name}</strong><small>{miner.role} · {miner.tool}</small><p>{miner.status || miner.goal}</p><div className="crew-stats"><span>{miner.blocks} BLK</span><span>{Math.round(miner.deepest)}M</span><span>{miner.purchaseCount ? `${miner.purchaseCount} BUY` : 'LOCAL NPC'}</span><span>{miner.haul.gold + miner.haul.diamond + miner.haul.sol} RARE</span></div><div className="crew-card-actions"><button onClick={() => onInspect?.(miner.id)}>INSPECT</button><button onClick={() => onFollow?.(miner.id)}>FOLLOW</button></div></div></article>)}</div><div className="record-board"><small>LEADERS / LIVE</small>{[['Deepest miner', 'deepest', 'm'], ['Most blocks destroyed', 'blocks', 'blocks'], ['Highest-value haul', 'value', 'points'], ['Most puzzles solved', 'puzzles', 'puzzles'], ['Biggest explosion', 'explosions', 'blocks'], ['Most unfortunate lava incident', 'lavaIncidents', 'incidents']].map(([label, key, unit]) => <div key={key}><span>{label}</span><strong>{state.records[key]?.name || 'YOU'} <b>{Math.round(state.records[key]?.[key] || 0)} {unit}</b></strong></div>)}</div><div className="transaction-log"><small>RECENT ACTIVITY</small>{(state.activity?.transactions || []).slice(0, 6).map(item => <p key={item.id}><b>{item.name}</b> · {formatPurchase(item.amount, item.unit)} <em>{item.source === 'live' ? 'VERIFIED' : 'SIMULATED'}</em></p>)}</div><small className="crew-disclaimer">LOCAL CREW RECORDS · no server, authentication, wallet access, or global ranking.</small></motion.aside>}</AnimatePresence>
  </>
}

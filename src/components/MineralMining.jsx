import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import gsap from 'gsap'
import { minerals, surprises, tools } from '../data/minerals'
import { formatSOL, rewardFor, roomFor, untouched } from '../utils/mining'
import { formatDepth } from '../utils/storage'

export const MiningContext = createContext(null)
const glyphs = ['⌁', '◇', '⋈']

export function MiningScore() {
  const { summary } = useContext(MiningContext)
  return <div className="mining-score"><b>{formatSOL(summary.cents)} <span>SOL</span></b><small>Local Mining SOL — No Real Monetary Value</small></div>
}

export function MineralIcon({ kind }) {
  return <span className={`mineral-icon mineral-icon--${kind}`} style={{ '--mineral': minerals[kind]?.color }} aria-hidden="true"><i /><i /><i /><b>{minerals[kind]?.icon || '?'}</b></span>
}

function MiningWall({ room }) {
  const { mining, summary, act, play, react, shake, replay } = useContext(MiningContext)
  const record = mining.rooms[room.id] || untouched
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const cursor = useRef(null)
  const phase = useRef({ position: 0 })
  const [close, setClose] = useState(false)
  const [focused, setFocused] = useState(false)
  const [message, setMessage] = useState('')
  const [method, setMethod] = useState('pattern')
  const [crack, setCrack] = useState(0)
  const [pressure, setPressure] = useState(0)
  const [holding, setHolding] = useState(false)
  const pressureRef = useRef(0)
  const drillTicks = useRef(0)
  const [visible, setVisible] = useState(!document.hidden)
  const latest = useRef(null)
  const tween = useRef(null)
  const hasPuzzle = room.zone === 2 || room.outcome === 'sol'
  const locked = room.outcome === 'sol' && (!record.scanned || summary.tool.power < 5)
  const mineral = minerals[room.outcome]

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setClose(entry.isIntersecting), { threshold: 0.35 })
    observer.observe(ref.current)
    const visibility = () => { setVisible(!document.hidden); setHolding(false) }
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); tween.current?.kill() }
  }, [])

  useEffect(() => {
    if (!close || !visible || record.done || method !== 'timing' || reduce) return
    const animation = gsap.to(phase.current, { position: 100, duration: 1.35, ease: 'none', repeat: -1, yoyo: true, onUpdate: () => {
      if (cursor.current) cursor.current.style.left = `${phase.current.position}%`
    } })
    return () => animation.kill()
  }, [close, visible, record.done, method, reduce])

  function strike(accurate, explosive = false) {
    if (!record.inspected || record.done || record.hazard || locked || (hasPuzzle && !record.ready)) return
    const next = act(room, { type: 'strike', accurate, explosive }, summary.tool.power)
    if (!next) return
    play(explosive ? 'explosion' : room.shine ? 'metal' : 'impact')
    react(accurate ? 'digging' : 'disappointed')
    setMessage(accurate ? 'Clean fracture. Follow the next seam.' : 'The pickaxe hit your lunch. Less of the deposit will survive.')
    if (explosive) { shake(); setMessage('Fast excavation. Delicate pieces did not survive the blast.') }
    if (!reduce) {
      tween.current?.kill()
      tween.current = gsap.fromTo(ref.current.querySelector('.vein-stone'), { x: -3 }, { x: 0, duration: 0.22, ease: 'steps(4)' })
    }
    if (next.hazard) { play('explosion'); shake(); react('running'); setHolding(false) }
    if (next.done) { play(room.outcome === 'sol' ? 'crystal' : mineral ? 'discovery' : 'secret'); react(mineral ? 'celebrate' : 'disappointed'); setHolding(false) }
  }
  latest.current = strike

  useEffect(() => {
    if (!holding || !close || !visible) return
    const timer = window.setInterval(() => {
      pressureRef.current = Math.min(100, pressureRef.current + 7)
      setPressure(pressureRef.current)
      drillTicks.current += 1
      if (pressureRef.current >= 100) {
        setHolding(false)
        latest.current(false)
        setMessage('OVERHEATED. The drill is now a very expensive kettle. Release to cool.')
      } else if (pressureRef.current >= 35 && pressureRef.current <= 75 && drillTicks.current % 3 === 0) latest.current(true)
    }, 200)
    return () => window.clearInterval(timer)
  }, [holding, close, visible])

  useEffect(() => {
    if (holding || pressureRef.current === 0) return
    const timer = window.setInterval(() => {
      pressureRef.current = Math.max(0, pressureRef.current - 10)
      setPressure(pressureRef.current)
      if (!pressureRef.current) window.clearInterval(timer)
    }, 150)
    return () => window.clearInterval(timer)
  }, [holding, pressure > 0])

  function inspect() {
    act(room, { type: 'inspect' })
    react('pointing')
    play(room.shine === 'sol' || room.event === 'Diamond Echo' ? 'crystal' : 'secret')
    setMessage(room.shine ? 'Something reflected the helmet light. That proves absolutely nothing.' : 'Silent stone. The scanner refuses to make a prediction.')
  }

  function follow(index) {
    if (hasPuzzle && !record.ready) {
      act(room, { type: 'symbol', symbol: index })
      play('secret')
      return
    }
    if (index !== room.pattern[crack]) { setCrack(0); strike(false); return }
    if (crack === 2) { setCrack(0); strike(true) } else { setCrack(crack + 1); play('metal') }
  }

  return (
    <article ref={ref} className={`mining-wall ${close && visible ? 'is-near' : ''} ${focused ? 'in-light' : ''} ${record.done ? 'is-excavated' : ''}`}
      style={{ '--vein': minerals[room.shine]?.color || '#50443b', '--damage': `${100 * (record.hits / room.hardness)}%` }}
      onPointerEnter={() => setFocused(true)} onPointerLeave={() => setFocused(false)} onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <div className="vein-label"><span>VEIN {String(room.number + 1).padStart(3, '0')}</span><span>{formatDepth(room.depth)}</span></div>
      {!record.done ? <>
        <button type="button" className={`vein-stone shine--${room.shine || 'silent'}`} onClick={inspect} aria-label={`Inspect sealed vein ${room.number + 1}`}>
          <span className="vein-fracture" aria-hidden="true" /><i className="vein-glint" aria-hidden="true">✦</i><span className="vein-damage" aria-hidden="true" />
          <b>{record.inspected ? record.stage ? 'ONE MORE LAYER' : 'FOLLOW THE FRACTURE' : 'INSPECT'}</b>
        </button>
        {record.inspected && <div className="excavation-controls">
          <p className="wall-durability">{room.outcome === 'sol' ? 'Resonant chamber' : room.zone === 2 ? 'Ancient wall' : room.hardness > 11 ? 'Reinforced stone' : room.hardness > 5 ? 'Stone' : room.hardness > 2 ? 'Loose rock' : 'Soft soil'} · {room.hardness - record.hits} integrity · layer {Math.min(record.stage + 1, room.stages)}/{room.stages}</p>
          {summary.scanner ? <button className="mining-control scanner-control" type="button" onClick={() => { act(room, { type: 'scan' }); play('secret') }}>{record.scanned ? room.reading : 'SCAN WALL'}<small>{record.scanned ? 'Uncertain reading · scanner may be wrong' : 'No mineral identification'}</small></button> : <small>Scanner unlocks at 1 km or with silver.</small>}
          {record.hazard ? <div className="vein-hazard" role="status"><b>{room.outcome === 'sol' ? 'Explosive crystal reaction' : surprises[room.hazard]?.[0]}</b><p>{surprises[room.hazard]?.[1]}</p><p>{room.hazard === 'gas' ? 'Open the vent' : room.hazard === 'lava' ? 'Close the floodgate' : room.hazard === 'creature' ? 'Unpack your lunch' : room.hazard === 'mimic' ? 'Retreat behind the supports' : 'Brace the ceiling'} in this order: {room.pattern.map((n) => glyphs[n]).join(' → ')}</p><div className="crack-buttons">{glyphs.map((glyph, i) => <button type="button" key={glyph} aria-label={`Safety latch ${i + 1}`} onClick={() => { const next = act(room, { type: 'rescue', symbol: i }); play('debris'); react(next?.done ? 'celebrate' : 'running') }}>{glyph}</button>)}</div><small>{record.rescueStep || 0}/3 latches secured. No saved progress is lost.</small></div> : locked ? <p className="wall-note">The seal responds to a scanner and a Diamond-Tip Drill or stronger. Reach 50 km, then scan this wall.</p> : <>
            {(!hasPuzzle || record.ready) && <div className="mining-methods" aria-label="Mining technique">
              {['pattern', ...(!reduce ? ['timing'] : []), ...(summary.tool.power >= 3 ? ['drill'] : [])].map((value) => <button type="button" key={value} aria-pressed={method === value} onClick={() => { setMethod(value); setHolding(false) }}>{value === 'pattern' ? 'CRACKS' : value === 'timing' ? 'WEAK POINT' : 'DRILL'}</button>)}
            </div>}
            {(method === 'pattern' || (hasPuzzle && !record.ready) || reduce) && <>
              <p className="crack-code">{hasPuzzle && !record.ready ? 'Align the ancient seal' : 'Follow the crack order'}: <b>{room.pattern.map((n) => glyphs[n]).join(' → ')}</b></p>
              <div className="crack-buttons">{glyphs.map((glyph, i) => <button type="button" key={glyph} onClick={() => follow(i)} aria-label={`Crack symbol ${i + 1}`}>{glyph}</button>)}</div>
              <small>{hasPuzzle && !record.ready ? record.pattern : crack}/3 · Untimed precision mining</small>
            </>}
            {method === 'timing' && !reduce && (!hasPuzzle || record.ready) && <><div className="weak-point" aria-hidden="true"><span /><i ref={cursor} /></div><button type="button" className="mining-control" onClick={() => strike(phase.current.position >= 36 && phase.current.position <= 64)}>STRIKE WHEN ALIGNED</button><small>Hit the pale band. Misses fracture the deposit.</small></>}
            {method === 'drill' && !reduce && (!hasPuzzle || record.ready) && <><meter min="0" max="100" low="35" high="75" optimum="55" value={pressure} aria-label="Drill heat" /><button type="button" className="mining-control drill-control" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setHolding(true) }} onPointerUp={() => setHolding(false)} onPointerCancel={() => setHolding(false)} onLostPointerCapture={() => setHolding(false)} onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setHolding(true) } }} onKeyUp={() => setHolding(false)} onBlur={() => setHolding(false)}>HOLD TO DRILL · {pressure}%</button><small>Work at 35–75% heat. Release to cool before 100%.</small></>}
            {summary.tool.power >= 2 && (!hasPuzzle || record.ready) && <button type="button" className="risky-tool" onClick={() => strike(true, true)}>RISK EXPLOSIVE · MORE DAMAGE, LESS YIELD</button>}
          </>}
        </div>}
      </> : <div className={`mineral-result ${room.outcome === 'sol' ? 'sol-reveal' : ''}`} role="status">
        {mineral ? <MineralIcon kind={room.outcome} /> : <span className="junk-icon" aria-hidden="true">{room.outcome === 'empty' ? '·' : room.outcome === 'spoon' ? '⌕' : '¿'}</span>}
        <small>{mineral ? `${mineral.rarity} · ${room.size}` : 'EXCAVATION COMPLETE'}</small>
        <h4>{mineral?.name || surprises[room.outcome]?.[0]}</h4><p>{mineral?.description || surprises[room.outcome]?.[1]}</p>
        {room.outcome === 'diamond' && <b className="one-more-caption">ONE MORE BLOCK. IT WAS RIGHT THERE.</b>}
        {room.outcome === 'sol' && <b className="one-more-caption">PRISM HELMET + SOL-POWERED DRILL UNLOCKED</b>}
        <strong>+{formatSOL(rewardFor(room, record))} local SOL</strong>
        <button className="mining-control" type="button" onClick={() => replay(room)}>REPLAY DISCOVERY</button>
      </div>}
      {room.event && record.inspected && <p className={`mineral-event event--${room.event.replaceAll(' ', '-').toLowerCase()}`}>{room.event} · {room.event === 'Motherlode' ? 'Three layers. The signal may still be wrong.' : room.event === 'Miner’s Luck' ? 'The miner sneezed. A seam appeared.' : room.event === 'Fool’s Gold Room' ? 'Every reflection is under suspicion.' : 'A brief signal crosses the tunnel.'}</p>}
      {!record.done && <p className="wall-feedback" aria-live="polite">{message}</p>}
    </article>
  )
}

export default function MineralTunnel({ zone }) {
  const { mining, summary, nextBranch } = useContext(MiningContext)
  const branch = mining.branches[zone]
  return <section className="mineral-tunnel" aria-label="Mineral side tunnel">
    <header><div><span>UNSURVEYED SIDE TUNNEL / {branch + 1}</span><h3>Something caught the light.</h3><p>Most walls have nothing to offer. Some lie.</p></div><span className="equipped-tool">⛏ {summary.tool.name}</span></header>
    <div className="mineral-walls">{[0, 1, 2].map((i) => { const room = roomFor(mining.seed, zone, branch * 3 + i); return <MiningWall key={`${mining.seed}:${room.id}`} room={room} /> })}</div>
    <button type="button" className="tunnel-next" disabled={branch >= 999} onClick={() => nextBranch(zone)}>FOLLOW THE NEXT SIDE TUNNEL →</button><small className="tunnel-note">Leave these veins behind. Discovered minerals stay in your field notes.</small>
  </section>
}

export function MineralJournal() {
  const { mining, summary, replay, equip } = useContext(MiningContext)
  return <section className="mineral-journal" aria-label="Mineral journal">
    <div className="journal-section-heading"><span>LOCAL DISCOVERIES</span><h3>Minerals &amp; tools</h3></div>
    <MiningScore />
    <p className="journal-intro">Fictional browser score. Minerals and SOL Crystals cannot be withdrawn, transferred, traded, or added to a wallet. Values include one-time exploration and survival bonuses.</p>
    <div className="mineral-catalog">{Object.entries(minerals).map(([id, mineral]) => {
      const item = summary.found[id]
      return <article className={`mineral-entry ${item ? '' : 'is-locked'}`} key={id}>
        {item ? <MineralIcon kind={id} /> : <span className="mineral-silhouette">?</span>}
        <div><small>{item || id !== 'unknown' ? mineral.rarity : '???'}</small><h4>{id === 'unknown' && !item ? 'Unidentified' : mineral.name}</h4>
          {item ? <><p>{mineral.description}</p><dl><dt>Amount</dt><dd>{item.count} deposits</dd><dt>Deepest</dt><dd>{formatDepth(item.deepest)}</dd><dt>Rarest deposit</dt><dd>{item.size}</dd><dt>Local value</dt><dd>{formatSOL(item.value)} SOL</dd><dt>First found</dt><dd>{new Date(item.first).toLocaleString()}</dd></dl><button type="button" className="mining-control" onClick={() => replay(item.replay)}>REPLAY DISCOVERY</button></> : <p>{id === 'unknown' ? 'Even the value is unknown.' : 'No samples. Keep an eye on the cracks.'}</p>}
        </div>
      </article>
    })}</div>
    <div className="tool-rack"><h4>Tool rack · equipped automatically</h4>{tools.map((tool) => <p key={tool.name} className={summary.unlocked.includes(tool) ? 'tool-unlocked' : ''}><b>{summary.unlocked.includes(tool) ? '✓' : '▧'} {tool.name}</b><small>{tool.hint}</small></p>)}<p><b>{summary.scanner ? '✓' : '▧'} Mineral scanner</b><small>Reach 1 km or discover silver. Readings are uncertain.</small></p>
      <button type="button" className="mining-control" disabled={!summary.found.sol} aria-pressed={mining.cosmetic} onClick={equip}>{mining.cosmetic ? 'UNEQUIP' : 'EQUIP'} PRISM HELMET {summary.found.sol ? '' : '· SOL CRYSTAL REQUIRED'}</button>
    </div>
  </section>
}

export function MineralReplay({ room, onClose }) {
  if (!room) return null
  const mineral = minerals[room.outcome]
  return <motion.aside className={`mineral-replay ${room.outcome === 'sol' ? 'sol-reveal' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status">
    {mineral ? <MineralIcon kind={room.outcome} /> : <span className="junk-icon">¿</span>}<div><small>DISCOVERY REPLAY · NO EXTRA REWARD</small><h3>{mineral?.name || surprises[room.outcome]?.[0]}</h3><p>{mineral?.description || surprises[room.outcome]?.[1]}</p></div><button type="button" onClick={onClose} aria-label="Close discovery replay">×</button>
  </motion.aside>
}

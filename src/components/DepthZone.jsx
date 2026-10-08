import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { artifacts, mysteryTiles } from '../data/mineData'
import InteractiveRock from './InteractiveRock'
import DiscoveryReveal from './DiscoveryReveal'
import MineralTunnel from './MineralMining'
import {
  BlastPlunger,
  DraggableDebris,
  InspectArtifact,
  MineMachine,
  RevealCrack,
} from './MineInteractions'

const dust = Array.from({ length: 18 }, (_, index) => index)
const roots = Array.from({ length: 9 }, (_, index) => index)
const ribs = Array.from({ length: 8 }, (_, index) => index)
const cityBlocks = Array.from({ length: 12 }, (_, index) => index)

function GlyphLock({ solved, onSolve, playSound, onReact }) {
  const [active, setActive] = useState(solved ? [0, 1, 2] : [])
  const glyphs = ['⌁', '◇', '⋈']

  useEffect(() => {
    if (solved) setActive([0, 1, 2])
  }, [solved])

  function press(index) {
    if (active.includes(index)) return
    const next = [...active, index]
    setActive(next)
    playSound('secret')
    onReact('inspect')
    if (next.length === glyphs.length) window.setTimeout(onSolve, 280)
  }

  return (
    <div className={`glyph-lock ${solved ? 'is-solved' : ''}`}>
      <div className="glyph-lock__door" aria-hidden="true"><i /><span>III</span><i /></div>
      <div className="glyph-lock__controls" aria-label="Ancient symbol lock">
        {glyphs.map((glyph, index) => (
          <motion.button
            type="button"
            key={glyph}
            onClick={() => press(index)}
            className={active.includes(index) ? 'is-active' : ''}
            whileTap={{ scale: 0.9 }}
            aria-pressed={active.includes(index)}
            aria-label={`Activate ancient symbol ${index + 1}`}
          >
            {glyph}
          </motion.button>
        ))}
      </div>
      <span className="interaction-label">{solved ? 'CHAMBER OPEN' : 'ACTIVATE ALL SYMBOLS'}</span>
    </div>
  )
}

function FossilDisplay({ onReact }) {
  const [inspecting, setInspecting] = useState(false)
  return (
    <motion.button
      type="button"
      className={`fossil-display ${inspecting ? 'is-inspecting' : ''}`}
      onClick={() => {
        setInspecting((current) => !current)
        onReact('inspect')
      }}
      whileHover={{ scale: 1.02 }}
      aria-expanded={inspecting}
    >
      <span className="fossil-shape" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span className="fossil-note">{inspecting ? 'SPECIES: PERMANENT BULL · AGE: TOO OLD' : 'INSPECT FOSSIL'}</span>
    </motion.button>
  )
}

function CaveCreature({ onReact, onStat, playSound }) {
  const [awake, setAwake] = useState(false)

  function disturb() {
    if (awake) return
    setAwake(true)
    playSound('secret')
    onReact('startled')
    onStat('creaturesDisturbed')
  }

  return (
    <button
      type="button"
      className={`cave-creature ${awake ? 'is-awake' : ''}`}
      onClick={disturb}
      aria-label={awake ? 'The cave creature is awake and annoyed' : 'Wake the sleeping cave creature'}
      aria-pressed={awake}
    >
      <i /><i />
    </button>
  )
}

function SignalConsole({ found, onDiscover, playSound, onReact }) {
  const [sequence, setSequence] = useState(found ? 4 : 0)
  const signals = ['↑', '↓', '◁', '▷']

  function advance() {
    if (found || sequence >= 4) return
    const next = sequence + 1
    setSequence(next)
    playSound('machine')
    onReact('inspect')
    if (next === 4) window.setTimeout(() => onDiscover('token'), 250)
  }

  return (
    <motion.button
      type="button"
      className={`signal-console ${found ? 'is-complete' : ''}`}
      onClick={advance}
      whileTap={{ y: 3 }}
      disabled={found}
      aria-label={found ? 'Civilization signal decoded' : `Decode civilization signal, ${sequence} of 4 pulses`}
    >
      <span className="signal-screen">
        {signals.map((signal, index) => <i className={index < sequence ? 'is-lit' : ''} key={signal}>{signal}</i>)}
      </span>
      <span>{found ? 'TOKEN MATERIALIZED' : 'TRANSMIT PULSE'}</span>
    </motion.button>
  )
}

function ZoneScene({ zone, discoveries, onDiscover, playSound, onReact, onShake, onStat }) {
  const found = (id) => discoveries.some((item) => item.id === id)

  if (zone.kind === 'soil') {
    return (
      <div className="zone-scene soil-scene">
        <div className="parallax-layer soil-roots" aria-hidden="true">
          {roots.map((root) => <i key={root} style={{ '--i': root }} />)}
        </div>
        <div className="old-pipe parallax-slow" aria-hidden="true"><i /><i /><span /></div>
        <div className="scene-note scene-note--left"><span>SHIFT 4</span><b>They heard tapping.<br />Then nothing.</b></div>
        <MineMachine playSound={playSound} onReact={onReact} />
        <DraggableDebris
          cleared={found('pickaxe')}
          playSound={playSound}
          onReact={onReact}
          onClear={() => onDiscover('pickaxe')}
        />
        <DiscoveryReveal
          visible={found('pickaxe')}
          icon={artifacts.pickaxe.icon}
          title="SIDE TUNNEL OPEN"
          text="Something gold was left behind."
        />
      </div>
    )
  }

  if (zone.kind === 'cave') {
    return (
      <div className="zone-scene cave-scene">
        <div className="stalactites parallax-slow" aria-hidden="true">{dust.slice(0, 9).map((item) => <i key={item} style={{ '--i': item }} />)}</div>
        <CaveCreature onReact={onReact} onStat={onStat} playSound={playSound} />
        <div className="glow-shrooms" aria-hidden="true"><i /><i /><i /></div>
        <RevealCrack onReact={onReact} onStat={onStat} playSound={playSound} message="TURN BACK? NICE TRY." />
        <InteractiveRock
          artifact={artifacts.coin}
          discovered={found('coin')}
          label="Fossil-bearing cave rock"
          variant="moss"
          onDiscover={onDiscover}
          onReact={onReact}
          playSound={playSound}
          onStat={onStat}
        />
        <div className="cave-sign" aria-hidden="true">PRICE<br />SUPPORT<br />↓</div>
      </div>
    )
  }

  if (zone.kind === 'temple') {
    return (
      <div className="zone-scene temple-scene">
        <div className="temple-pillars parallax-slow" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="temple-eye" aria-hidden="true"><span>◇</span></div>
        <GlyphLock
          solved={found('gear')}
          onSolve={() => onDiscover('gear')}
          playSound={playSound}
          onReact={onReact}
        />
        <DiscoveryReveal
          visible={found('gear')}
          icon={artifacts.gear.icon}
          title="CONSENSUS REACHED"
          text="Three buttons. Zero governance proposals."
        />
      </div>
    )
  }

  if (zone.kind === 'skeleton') {
    return (
      <div className="zone-scene skeleton-scene">
        <div className="giant-skull parallax-slow" aria-hidden="true"><i /><i /><b /></div>
        <div className="giant-ribs" aria-hidden="true">{ribs.map((rib) => <i key={rib} style={{ '--i': rib }} />)}</div>
        <FossilDisplay onReact={onReact} />
        <RevealCrack onReact={onReact} onStat={onStat} playSound={playSound} message="IT IS STILL HOLDING." />
        <div className="bone-worm" aria-hidden="true"><i /><i /><i /><i /><b>•</b></div>
      </div>
    )
  }

  if (zone.kind === 'lava') {
    return (
      <div className="zone-scene lava-scene">
        <div className="heat-columns parallax-slow" aria-hidden="true"><i /><i /><i /></div>
        <div className="lava-fall" aria-hidden="true"><span /><i /><i /></div>
        <div className="lava-river" aria-hidden="true">{dust.slice(0, 8).map((item) => <i key={item} />)}</div>
        <BlastPlunger
          blasted={found('ledger')}
          playSound={playSound}
          onReact={onReact}
          onBlast={() => {
            onStat('explosionsSurvived')
            onShake()
            window.setTimeout(() => onDiscover('ledger'), 520)
          }}
        />
        <DiscoveryReveal
          visible={found('ledger')}
          icon={artifacts.ledger.icon}
          title="LEDGER EXPOSED"
          text="The transaction history is extremely well done."
        />
      </div>
    )
  }

  if (zone.kind === 'civilization') {
    return (
      <div className="zone-scene civilization-scene">
        <div className="alien-city parallax-slow" aria-hidden="true">
          {cityBlocks.map((block) => <i key={block} style={{ '--i': block }}><b /></i>)}
        </div>
        <div className="watcher" aria-hidden="true"><i /><span>···</span></div>
        <div className="ceiling-miners" aria-hidden="true"><i /><i /><span /></div>
        <SignalConsole
          found={found('token')}
          onDiscover={onDiscover}
          playSound={playSound}
          onReact={onReact}
        />
        <InspectArtifact
          className="civilization-token"
          icon={artifacts.token.icon}
          label={artifacts.token.name}
          found={found('token')}
          onInspect={() => onDiscover('token')}
          playSound={playSound}
          onReact={onReact}
        />
      </div>
    )
  }

  return (
    <div className="zone-scene beyond-scene">
      <div className="mystery-grid parallax-slow" aria-label="Unmapped mystery environments">
        {mysteryTiles.map((tile, index) => (
          <motion.div key={tile.label} style={{ '--i': index }} whileHover={{ y: -8 }}>
            <span aria-hidden="true">{tile.glyph}</span><small>{tile.label}</small>
          </motion.div>
        ))}
      </div>
      <div className="impossible-stairs" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <RevealCrack onReact={onReact} onStat={onStat} playSound={playSound} message="ONE. MORE. BLOCK." />
      <InteractiveRock
        artifact={artifacts.diamond}
        discovered={found('diamond')}
        label="The final suspicious wall"
        variant="void"
        onDiscover={(id) => {
          onShake()
          onDiscover(id)
        }}
        onReact={onReact}
        playSound={playSound}
        onStat={onStat}
      />
      <DiscoveryReveal
        visible={found('diamond')}
        icon={artifacts.diamond.icon}
        title="GLASS. OF COURSE."
        text="Try the side tunnel. Sparkle is not a mineral certificate."
      />
    </div>
  )
}

export default function DepthZone({
  zone,
  index,
  eager,
  discoveries,
  onDiscover,
  playSound,
  onReact,
  onStat,
  onShake,
}) {
  const sectionRef = useRef(null)
  const [nearby, setNearby] = useState(eager)
  const particles = useMemo(() => dust.slice(0, index > 4 ? 10 : 18), [index])

  useEffect(() => {
    if (nearby) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setNearby(true),
      { rootMargin: '120% 0px' },
    )
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [nearby])

  return (
    <section
      ref={sectionRef}
      className={`depth-zone zone--${zone.kind}`}
      data-zone={zone.id}
      style={{ '--zone-accent': zone.accent }}
      aria-labelledby={`zone-${zone.id}`}
    >
      <div className="zone-seam" aria-hidden="true" />
      <div className="zone-dust" aria-hidden="true">
        {particles.map((particle) => <i key={particle} style={{ '--i': particle }} />)}
      </div>
      <header className="zone-heading">
        <p>{zone.kicker}</p>
        <h2 id={`zone-${zone.id}`}>{zone.title}</h2>
        <span>{zone.subtitle}</span>
      </header>
      <div className="zone-index" aria-hidden="true">0{index + 1}</div>
      {nearby ? (
        <><ZoneScene
          zone={zone}
          discoveries={discoveries}
          onDiscover={onDiscover}
          playSound={playSound}
          onReact={onReact}
          onStat={onStat}
          onShake={onShake}
        /><MineralTunnel zone={index} /></>
      ) : (
        <div className="zone-loading" aria-hidden="true"><span>DESCENDING…</span></div>
      )}
    </section>
  )
}

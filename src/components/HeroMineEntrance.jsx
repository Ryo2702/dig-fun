import { motion, useReducedMotion } from 'motion/react'
import PixelButton from './PixelButton'

const stones = Array.from({ length: 16 }, (_, index) => index)
const stars = Array.from({ length: 20 }, (_, index) => index)

export default function HeroMineEntrance({ onEnter, onWalletOpen }) {
  const reducedMotion = useReducedMotion()

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-sky" aria-hidden="true">
        {stars.map((star) => <i key={star} style={{ '--i': star }} />)}
        <div className="pixel-moon" />
        <div className="distant-ridge distant-ridge--back" />
        <div className="distant-ridge distant-ridge--front" />
      </div>
      <div className="hero-copy">
        <motion.p
          className="eyebrow"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          AN UNREASONABLY DEEP WEBSITE
        </motion.p>
        <motion.h1
          id="hero-title"
          className="hero-logo"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 130, damping: 12 }}
        >
          <span>DIG</span><b>.</b>FUN
        </motion.h1>
        <p className="hero-tagline">How deep can crypto go?</p>
        <p className="hero-lede">
          Every miner quits at the worst possible block.<br />Surely you are different.
        </p>
        <div className="hero-actions">
          <PixelButton onClick={onEnter}>START DIGGING <span aria-hidden="true">↓</span></PixelButton>
          <PixelButton variant="ghost" onClick={onWalletOpen}>CONNECT WALLET*</PixelButton>
        </div>
        <p className="wallet-footnote">*install links only · nothing connects here</p>
      </div>
      <div className="entrance-scene" aria-hidden="true">
        <div className="warning-sign"><b>KEEP</b><span>DIGGING</span></div>
        <div className="mine-crane"><i /><b /></div>
        <div className="shaft-mouth">
          <div className="shaft-glow" />
          {stones.map((stone) => <i key={stone} style={{ '--i': stone }} />)}
        </div>
      </div>
      <button className="scroll-cue" onClick={onEnter} aria-label="Scroll into the mine">
        <span>DESCEND</span>
        <i aria-hidden="true">↓</i>
      </button>
    </section>
  )
}

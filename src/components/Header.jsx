import { motion } from 'motion/react'
import PixelButton from './PixelButton'

export default function Header({
  artifactCount,
  soundEnabled,
  shakeEnabled,
  onSoundToggle,
  onShakeToggle,
  onJournalOpen,
  onWalletOpen,
  onResetOpen,
}) {
  return (
    <header className="site-header" aria-label="Main controls">
      <a className="mini-logo" href="#top" aria-label="DIG.FUN, back to mine entrance">
        <span>DIG</span><b>.</b>FUN
      </a>
      <nav className="header-actions" aria-label="Mine tools">
        <motion.button
          className="hud-button hud-button--journal"
          type="button"
          onClick={onJournalOpen}
          whileTap={{ scale: 0.94 }}
          aria-label={`Open artifact journal, ${artifactCount} found`}
        >
          <span aria-hidden="true">▤</span>
          <span className="hud-button__label">JOURNAL</span>
          <b>{String(artifactCount).padStart(2, '0')}</b>
        </motion.button>
        <motion.button
          className="hud-button hud-button--shake"
          type="button"
          onClick={onShakeToggle}
          whileTap={{ scale: 0.94 }}
          aria-pressed={shakeEnabled}
          aria-label={shakeEnabled ? 'Disable screen shake' : 'Enable screen shake'}
        >
          <span aria-hidden="true">{shakeEnabled ? '≈' : '—'}</span>
          <span className="hud-button__label">{shakeEnabled ? 'SHAKE ON' : 'NO SHAKE'}</span>
        </motion.button>
        <motion.button
          className="hud-button"
          type="button"
          onClick={onSoundToggle}
          whileTap={{ scale: 0.94 }}
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? 'Mute mine sounds' : 'Enable mine sounds'}
        >
          <span aria-hidden="true">{soundEnabled ? '♪' : '×'}</span>
          <span className="hud-button__label">{soundEnabled ? 'SOUND ON' : 'MUTED'}</span>
        </motion.button>
        <button className="text-control" type="button" onClick={onResetOpen}>
          RESET
        </button>
        <PixelButton className="wallet-button" variant="stone" onClick={onWalletOpen}>
          CONNECT WALLET
        </PixelButton>
      </nav>
    </header>
  )
}

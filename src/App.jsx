import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import HeroMineEntrance from './components/HeroMineEntrance'
import DepthMeter from './components/DepthMeter'
import MinerCharacter from './components/MinerCharacter'
import MineWorld from './components/MineWorld'
import ArtifactJournal from './components/ArtifactJournal'
import WalletLinksModal from './components/WalletLinksModal'
import ResetProgressModal from './components/ResetProgressModal'
import DiscoveryToast from './components/DiscoveryToast'
import useMineSound from './hooks/useMineSound'
import { artifacts as artifactCatalog } from './data/mineData'
import { clearProgress, loadProgress, saveProgress } from './utils/storage'

export default function App() {
  const initialProgress = useRef(loadProgress())
  const [depth, setDepth] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [deepest, setDeepest] = useState(initialProgress.current.deepest)
  const [discoveries, setDiscoveries] = useState(initialProgress.current.artifacts)
  const [journalOpen, setJournalOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [scrollState, setScrollState] = useState('walking')
  const [reaction, setReaction] = useState(null)
  const [toast, setToast] = useState(null)
  const [shakeSignal, setShakeSignal] = useState(0)
  const reactionTimer = useRef(null)
  const toastTimer = useRef(null)
  const { enabled: soundEnabled, toggle: toggleSound, play } = useMineSound()

  useEffect(() => {
    const timeout = window.setTimeout(() => saveProgress({ deepest, artifacts: discoveries }), 220)
    return () => window.clearTimeout(timeout)
  }, [deepest, discoveries])

  useEffect(() => () => {
    window.clearTimeout(reactionTimer.current)
    window.clearTimeout(toastTimer.current)
  }, [])

  const handleDepthChange = useCallback((nextDepth, progress) => {
    setDepth(nextDepth)
    setScrollProgress(progress)
    setDeepest((current) => Math.max(current, nextDepth))
  }, [])

  const handleReact = useCallback((state) => {
    setReaction(state)
    window.clearTimeout(reactionTimer.current)
    reactionTimer.current = window.setTimeout(() => setReaction(null), state === 'celebrate' ? 1500 : 850)
  }, [])

  const handleDiscover = useCallback((id) => {
    const artifact = artifactCatalog[id]
    if (!artifact) return
    setDiscoveries((current) => {
      if (current.some((item) => item.id === id)) return current
      return [...current, { id, discoveredAt: new Date().toISOString() }]
    })
    setToast(artifact)
    play('discovery')
    handleReact('celebrate')
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3600)
  }, [handleReact, play])

  const enterMine = useCallback(() => {
    document.getElementById('mine-start')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [])

  const resetProgress = useCallback(() => {
    clearProgress()
    setDepth(0)
    setScrollProgress(0)
    setDeepest(0)
    setDiscoveries([])
    setResetOpen(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#mine-start">Skip to mine</a>
      <div className="crt-overlay" aria-hidden="true" />
      <Header
        artifactCount={discoveries.length}
        soundEnabled={soundEnabled}
        onSoundToggle={toggleSound}
        onJournalOpen={() => setJournalOpen(true)}
        onWalletOpen={() => setWalletOpen(true)}
        onResetOpen={() => setResetOpen(true)}
      />
      <DepthMeter depth={depth} deepest={deepest} progress={scrollProgress} />
      <MinerCharacter state={reaction || scrollState} visible={scrollProgress > 0.002} />
      <HeroMineEntrance onEnter={enterMine} onWalletOpen={() => setWalletOpen(true)} />
      <MineWorld
        discoveries={discoveries}
        onDepthChange={handleDepthChange}
        onScrollState={setScrollState}
        onDiscover={handleDiscover}
        playSound={play}
        onReact={handleReact}
        shakeSignal={shakeSignal}
        onShake={() => setShakeSignal((current) => current + 1)}
      />
      <DiscoveryToast artifact={toast} />
      <ArtifactJournal open={journalOpen} discoveries={discoveries} onClose={() => setJournalOpen(false)} />
      <WalletLinksModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      <ResetProgressModal open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={resetProgress} />
    </div>
  )
}

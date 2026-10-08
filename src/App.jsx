import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header'
import HeroMineEntrance from './components/HeroMineEntrance'
import DepthMeter from './components/DepthMeter'
import MinerCharacter from './components/MinerCharacter'
import MineWorld from './components/MineWorld'
import ArtifactJournal from './components/ArtifactJournal'
import WalletLinksModal from './components/WalletLinksModal'
import ResetProgressModal from './components/ResetProgressModal'
import DiscoveryToast from './components/DiscoveryToast'
import ActivityFeed from './components/ActivityFeed'
import { MiningContext, MiningScore, MineralReplay } from './components/MineralMining'
import { applyMiningAction, bonusValues, miningMilestones, miningSummary, newMining } from './utils/mining'
import useMineSound from './hooks/useMineSound'
import { artifacts as artifactCatalog } from './data/mineData'
import { clearProgress, emptyStats, loadProgress, saveProgress } from './utils/storage'

export default function App() {
  const [initialProgress] = useState(loadProgress)
  const [depth, setDepth] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [deepest, setDeepest] = useState(initialProgress.deepest)
  const [discoveries, setDiscoveries] = useState(initialProgress.artifacts)
  const [stats, setStats] = useState(initialProgress.stats)
  const [mining, setMining] = useState(initialProgress.mining)
  const miningRef = useRef(mining)
  const [worldVersion, setWorldVersion] = useState(0)
  const [replayRoom, setReplayRoom] = useState(null)
  const summary = useMemo(() => miningSummary(mining, deepest), [mining, deepest])
  const commitMining = useCallback((next) => { miningRef.current = next; setMining(next) }, [])
  const [journalOpen, setJournalOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [scrollState, setScrollState] = useState('walking')
  const [reaction, setReaction] = useState(null)
  const [toast, setToast] = useState(null)
  const [shakeSignal, setShakeSignal] = useState(0)
  const [shakeEnabled, setShakeEnabled] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const reactionTimer = useRef(null)
  const toastTimer = useRef(null)
  const { enabled: soundEnabled, toggle: toggleSound, play } = useMineSound()
  const diggingActive = scrollProgress > 0.002 && scrollProgress < 1

  useEffect(() => {
    const progress = { deepest, artifacts: discoveries, stats, mining }
    const flush = () => saveProgress(progress)
    const timeout = window.setTimeout(flush, 100)
    window.addEventListener('pagehide', flush)
    return () => { window.clearTimeout(timeout); window.removeEventListener('pagehide', flush) }
  }, [deepest, discoveries, stats, mining])

  useEffect(() => {
    const current = miningRef.current
    const earned = [...miningMilestones.filter((m) => deepest >= m).map((m) => `depth:${m}`), ...discoveries.map((d) => d.id).filter((id) => Object.hasOwn(bonusValues, id))]
    const bonuses = [...new Set([...current.bonuses, ...earned])]
    if (bonuses.length !== current.bonuses.length) commitMining({ ...current, bonuses })
  }, [deepest, discoveries, commitMining])

  useEffect(() => {
    if (!diggingActive) return undefined
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        setStats((current) => ({ ...current, diggingSeconds: current.diggingSeconds + 5 }))
      }
    }, 5000)
    return () => window.clearInterval(interval)
  }, [diggingActive])

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

  const incrementStat = useCallback((key, amount = 1) => {
    setStats((current) => ({ ...current, [key]: (current[key] || 0) + amount }))
  }, [])

  const requestShake = useCallback(() => {
    if (shakeEnabled) setShakeSignal((current) => current + 1)
  }, [shakeEnabled])

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
  }, [handleReact, incrementStat, play])

  const handleActivityEffect = useCallback((effect) => {
    if (effect === 'blast') {
      play('explosion')
      handleReact('startled')
      requestShake()
      return
    }
    play(effect === 'wave' ? 'machine' : 'impact')
    handleReact(effect === 'wave' ? 'running' : 'digging')
    if (effect === 'medium' || effect === 'wave') requestShake()
  }, [handleReact, play, requestShake])

  const importProgress = useCallback((progress) => {
    const artifacts = progress.artifacts.filter((item) => artifactCatalog[item.id])
    setDeepest(progress.deepest)
    setDiscoveries(artifacts)
    setStats(progress.stats)
    commitMining(progress.mining)
    setWorldVersion((current) => current + 1)
    setReplayRoom(null)
    saveProgress({ ...progress, artifacts })
  }, [commitMining])

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
    setStats({ ...emptyStats })
    commitMining(newMining())
    setWorldVersion((current) => current + 1)
    setReplayRoom(null)
    setResetOpen(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [commitMining])

  const act = useCallback((room, action, power = summary.tool.power) => {
    const current = miningRef.current
    const next = applyMiningAction(current, room, action, power)
    if (next === current) return null
    commitMining(next)
    if (!current.rooms[room.id]?.inspected && next.rooms[room.id].inspected) incrementStat('wallsInspected')
    if (!current.rooms[room.id]?.done && next.rooms[room.id].done) {
      incrementStat('rocksBroken')
      if (room.outcome === 'empty') incrementStat('emptyRooms')
      if (room.outcome === 'diamond') incrementStat('oneMoreBlockDiscoveries')
      if (room.outcome === 'creature') incrementStat('creaturesDisturbed')
      if (room.hazard) incrementStat('explosionsSurvived')
    }
    return next.rooms[room.id]
  }, [commitMining, incrementStat, summary.tool.power])

  const miningContext = {
    mining, summary, act, play, react: handleReact, shake: requestShake,
    nextBranch: (zone) => {
      const current = miningRef.current
      commitMining({ ...current, branches: current.branches.map((branch, i) => i === zone ? Math.min(999, branch + 1) : branch) })
    },
    replay: (room) => { setReplayRoom(room); play(room.outcome === 'sol' ? 'crystal' : 'discovery'); handleReact('celebrate') },
    equip: () => { if (summary.found.sol) commitMining({ ...miningRef.current, cosmetic: !miningRef.current.cosmetic }) },
  }

  return (
    <MiningContext.Provider value={miningContext}>
    <div className={`app-shell ${mining.cosmetic && summary.found.sol ? 'prism-equipped' : ''}`}>
      <a className="skip-link" href="#mine-start">Skip to mine</a>
      <div className="crt-overlay" aria-hidden="true" />
      <Header
        artifactCount={discoveries.length}
        soundEnabled={soundEnabled}
        shakeEnabled={shakeEnabled}
        onSoundToggle={toggleSound}
        onShakeToggle={() => setShakeEnabled((current) => !current)}
        onJournalOpen={() => setJournalOpen(true)}
        onWalletOpen={() => setWalletOpen(true)}
        onResetOpen={() => setResetOpen(true)}
      />
      <DepthMeter depth={depth} deepest={deepest} progress={scrollProgress} />
      <ActivityFeed onEffect={handleActivityEffect} />
      <MiningScore />
      <MinerCharacter state={reaction || scrollState} visible={scrollProgress > 0.002} />
      <HeroMineEntrance onEnter={enterMine} onWalletOpen={() => setWalletOpen(true)} />
      <MineWorld
        key={worldVersion}
        discoveries={discoveries}
        onDepthChange={handleDepthChange}
        onScrollState={setScrollState}
        onDiscover={handleDiscover}
        playSound={play}
        onReact={handleReact}
        onStat={incrementStat}
        shakeSignal={shakeSignal}
        onShake={requestShake}
      />
      <DiscoveryToast artifact={toast} />
      <ArtifactJournal
        open={journalOpen}
        deepest={deepest}
        discoveries={discoveries}
        stats={stats}
        mining={mining}
        onImport={importProgress}
        onClose={() => setJournalOpen(false)}
      />
      <WalletLinksModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      <ResetProgressModal open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={resetProgress} />
      <MineralReplay room={replayRoom} onClose={() => setReplayRoom(null)} />
    </div>
    </MiningContext.Provider>
  )
}

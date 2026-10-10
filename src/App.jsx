import { useEffect, useRef, useState } from 'react'
import useModalFocus from './hooks/useModalFocus'
import useMineSound from './hooks/useMineSound'
import AutonomyOverlay from './components/AutonomyOverlay'
import MinerNameplates from './components/MinerNameplates'
import ResponsivePanel from './components/ResponsivePanel'
import { formatSOL } from './utils/sol'
import { WALLET_OPTIONS } from './utils/wallet'
import { loadProgress } from './utils/storage'
import { createGame, restore, serialize, SAVE_KEY, DEFAULT_KEYS, DEFAULT_SETTINGS, ORE_COLORS, TILE, step, reveal, interact, say, keyOf, turnDial } from './utils/world'
import { drawWorld } from './utils/renderWorld'
import { AUTONOMY_KEY, applyOfflineProgress, autoDecision, computeRecords, createAutonomy, restoreAutonomy, serializeAutonomy, spawnBuyer, startPuzzle, tickCrew } from './utils/autonomy'
import { pollLiveBuys } from './utils/activity'

const artifactText = {
  component: 'A broken pickaxe head. Rebuilt into your first tool upgrade.',
  puzzle: 'Align the three marks to open the ancient lock.',
  clue: 'Follow the broken white seams. Reflections can lie.',
  cosmetic: 'The foreman’s green scarf. Now worn by your miner.',
  map: 'The old chambers repeat every 14 vertical tiles.',
  funny: 'A tiny frog whispered “one more block” and left.',
  hazard: 'An ancient dust trap. Survived, with every ore intact.',
  empty: 'An empty lunch box. Hope was the last thing inside.',
  reward: 'A forgotten cache. Its reward was added directly to your in-game SOL balance.',
}

const panelTitles = {
  menu: 'MINE MENU',
  sol: 'IN-GAME SOL',
  wallet: 'OFFICIAL WALLET LINKS',
  help: 'VISITOR GUIDE',
  settings: 'SETTINGS',
  journal: 'FIELD NOTEBOOK',
  inventory: 'DISCOVERY LOG',
  crew: 'LOCAL CREW RECORDS',
  reset: 'START A NEW SHAFT?',
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function initial() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) return restore(JSON.parse(raw))
  } catch { /* Storage can be unavailable; gameplay still works. */ }
  return { g: createGame(), settings: { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS }, reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches } }
}

function initialAutonomy(now = Date.now()) {
  try {
    const raw = localStorage.getItem(AUTONOMY_KEY)
    return restoreAutonomy(raw ? JSON.parse(raw) : null, now)
  } catch {
    return createAutonomy(now)
  }
}

function PixelIcon({ type = 'pick', color }) {
  return <span className={`pixel-icon icon-${type}`} style={color ? { '--icon-color': color } : undefined} aria-hidden="true"><i /><i /><i /></span>
}

export default function App() {
  const [loaded] = useState(initial)
  const game = useRef(loaded.g)
  const [autonomy, setAutonomy] = useState(() => {
    const state = initialAutonomy()
    applyOfflineProgress(state, loaded.g)
    return state
  })
  const [settings, setSettings] = useState(loaded.settings)
  const [offlineSummary, setOfflineSummary] = useState(autonomy.offline)
  const [panel, setPanel] = useState(null)
  const [status, setStatus] = useState('')
  const [inspectedMiner, setInspectedMiner] = useState(null)
  const [focusMiner, setFocusMiner] = useState(null)
  const [crewQuery, setCrewQuery] = useState('')
  const [legacy] = useState(loadProgress)
  const [, refresh] = useState(0)
  const canvas = useRef(null)
  const view = useRef(null)
  const nameplates = useRef(null)
  const camera = useRef({ x: 0, y: 0, zoom: 1, manualUntil: 0 })
  const gesture = useRef(null)
  const pointers = useRef(new Map())
  const config = useRef(settings)
  const panelRef = useRef(panel)
  const savedError = useRef(false)
  const runtime = useRef(null)
  const autonomyRef = useRef(autonomy)
  const autoRef = useRef(autonomy.auto)
  const focusMinerRef = useRef(focusMiner)
  config.current = settings
  panelRef.current = panel
  autonomyRef.current = autonomy
  autoRef.current = autonomy.auto
  focusMinerRef.current = focusMiner
  const { play } = useMineSound(settings.music && !panel, settings.sound)
  const playRef = useRef(play)
  playRef.current = play

  const closePanel = () => {
    setPanel(null)
    gesture.current = null
    pointers.current.clear()
    requestAnimationFrame(() => canvas.current?.focus())
  }
  const focus = useModalFocus(!!panel, closePanel)

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(game.current, config.current)))
      savedError.current = false
    } catch { savedError.current = true }
  }

  function saveAutonomy() {
    try {
      autonomyRef.current.lastActive = Date.now()
      localStorage.setItem(AUTONOMY_KEY, JSON.stringify(serializeAutonomy(autonomyRef.current)))
    } catch { /* Crew life continues for this session if storage is unavailable. */ }
  }

  function refreshAutonomy() {
    setAutonomy({ ...autonomyRef.current, auto: { ...autonomyRef.current.auto } })
  }

  function resetAutonomy() {
    const next = createAutonomy()
    autonomyRef.current = next
    setAutonomy(next)
    setOfflineSummary(null)
    saveAutonomy()
  }

  function dismissMajor() {
    autonomyRef.current.major = null
    autonomyRef.current.offline = null
    setOfflineSummary(null)
    refreshAutonomy()
  }

  function dismissJoin() {
    autonomyRef.current.activity.join = null
    refreshAutonomy()
  }

  function dismissEvent() {
    autonomyRef.current.event = null
    autonomyRef.current.community.event = null
    refreshAutonomy()
  }

  function dismissNotice() {
    const next = autonomyRef.current.noticeQueue?.shift() || null
    autonomyRef.current.noticeCurrent = next
    autonomyRef.current.ticker = next?.message || 'The crew is moving through the local mine.'
    autonomyRef.current.tickerClock = 0
    refreshAutonomy()
  }

  function reactToMajor(reaction) {
    autonomyRef.current.ticker = 'YOU: ' + reaction + ' · reaction recorded locally.'
    autonomyRef.current.feed.unshift('You sent “' + reaction + '” to the crew.')
    autonomyRef.current.feed = autonomyRef.current.feed.slice(0, 30)
    refreshAutonomy()
  }

  function raceToMajor() {
    const miner = autonomyRef.current.miners.find(item => item.id === autonomyRef.current.major?.minerId)
    autonomyRef.current.followId = miner?.id || null
    autonomyRef.current.auto.suggestion = miner ? { x: Math.floor(miner.x), y: Math.floor(miner.y), until: game.current.time + 12 } : null
    autonomyRef.current.auto.status = 'Following a crew discovery'
    autonomyRef.current.auto.decision = autonomyRef.current.auto.status
    dismissMajor()
  }

  function inspectMajor() {
    const id = autonomyRef.current.major?.minerId
    const miner = autonomyRef.current.miners.find(item => item.id === id)
    if (miner) {
      setInspectedMiner(miner.id)
      setFocusMiner(miner.id)
      autonomyRef.current.followId = miner.id
      refreshAutonomy()
    }
    open('crew')
  }

  function suggestTile(target) {
    autonomyRef.current.auto.suggestion = { x: target.x, y: target.y, until: game.current.time + 8 }
    autonomyRef.current.auto.target = null
    autonomyRef.current.auto.status = 'Investigating sparkle'
    autonomyRef.current.auto.decision = autonomyRef.current.auto.status
    refreshAutonomy()
  }

  function open(name) {
    setStatus('')
    setPanel(name)
    if (name !== 'crew') setCrewQuery('')
    save()
  }

  function inspectMiner(id) {
    const miner = autonomyRef.current.miners.find(item => item.id === id)
    if (!miner) return
    setInspectedMiner(id)
    setFocusMiner(id)
    autonomyRef.current.followId = id
    autonomyRef.current.ticker = `${miner.name} is ${String(miner.status || miner.goal).toLowerCase()}.`
    refreshAutonomy()
    open('crew')
  }

  function followMiner(id) {
    autonomyRef.current.followId = id
    setInspectedMiner(id)
    setFocusMiner(id)
    refreshAutonomy()
  }

  function showOverview() {
    autonomyRef.current.followId = null
    setInspectedMiner(null)
    setFocusMiner(null)
    refreshAutonomy()
  }

  useEffect(() => {
    reveal(game.current)
    const element = canvas.current
    const container = view.current
    const context = element.getContext('2d')
    context.imageSmoothingEnabled = false
    let frame
    let last = performance.now()
    let lastUI = 0
    let lastSave = 0
    let scale = 1

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      scale = Math.max(1, Math.min(4, Math.floor(Math.min(width / 180, height / 240))))
      element.width = Math.max(1, Math.floor(width / scale))
      element.height = Math.max(1, Math.floor(height / scale))
      element.style.width = `${element.width * scale}px`
      element.style.height = `${element.height * scale}px`
      runtime.current = { scale }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    const pagehide = () => { save(); saveAutonomy() }
    const visibility = () => { if (document.hidden) pagehide() }
    const blur = () => { pagehide() }

    const loop = now => {
      const dt = Math.min((now - last) / 1000, .035)
      last = now
      const g = game.current
      if (!document.hidden) {
        const earnedBefore = g.sol.total
        const puzzleBusy = autonomyRef.current.puzzle && !autonomyRef.current.puzzle.done
        const decision = puzzleBusy ? { input: {}, target: g.target, interact: false } : autoDecision(g, autoRef.current, dt)
        if (decision.interact) {
          const before = g.artifacts.length
          interact(g)
          const artifact = g.artifacts.length > before ? g.artifacts[g.artifacts.length - 1] : null
          if (artifact?.outcome === 'puzzle') startPuzzle(autonomyRef.current, g, 'player', artifact.id)
        }
        if (decision.target) g.target = decision.target
        step(g, puzzleBusy ? {} : decision.input, dt, config.current)
        tickCrew(autonomyRef.current, g, dt)
        if (g.sol.total !== earnedBefore) save()
        if (g.sound) { playRef.current(g.sound); g.sound = null }
        if (g.vibrate) { if (config.current.vibration && navigator.vibrate) navigator.vibrate(12); g.vibrate = false }
        if (now - lastUI > 120) {
          computeRecords(autonomyRef.current, g)
          refreshAutonomy()
          refresh(value => value + 1)
          lastUI = now
        }
        drawWorld(context, g, camera.current, element.width, element.height, config.current, 0, autonomyRef.current)
        nameplates.current?.update({ game: g, autonomy: autoRef.current, camera: camera.current, canvas: element, container, scale, followId: autonomyRef.current.followId || 'player', focusId: focusMinerRef.current })
      }
      if (now - lastSave > 1500) { save(); saveAutonomy(); lastSave = now }
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    window.addEventListener('blur', blur)
    window.addEventListener('pagehide', pagehide)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('blur', blur)
      window.removeEventListener('pagehide', pagehide)
      document.removeEventListener('visibilitychange', visibility)
      save()
      saveAutonomy()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let busy = false
    const poll = async () => {
      const activity = autonomyRef.current.activity
      if (document.hidden || busy || !activity.source.liveConfigured) return
      busy = true
      const purchases = await pollLiveBuys(activity)
      if (!cancelled) {
        for (const purchase of purchases) spawnBuyer(autonomyRef.current, game.current, purchase)
        if (purchases.length || activity.error) refreshAutonomy()
      }
      busy = false
    }
    poll()
    const timer = setInterval(poll, 18_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  function viewportPoint(event) {
    const element = canvas.current
    const rect = element.getBoundingClientRect()
    const scale = runtime.current?.scale || 1
    const zoom = camera.current.zoom || 1
    const x = (event.clientX - rect.left) / scale
    const y = (event.clientY - rect.top) / scale
    const localX = (x - element.width / 2 * (1 - zoom)) / zoom + (camera.current.drawX ?? camera.current.x)
    const localY = (y - element.height / 2 * (1 - zoom)) / zoom + (camera.current.drawY ?? camera.current.y)
    return { x: Math.floor(localX / TILE), y: Math.floor(localY / TILE) }
  }

  function minerAt(event) {
    const element = canvas.current
    const rect = element.getBoundingClientRect()
    const scale = runtime.current?.scale || 1
    const zoom = camera.current.zoom || 1
    const x = (event.clientX - rect.left) / scale
    const y = (event.clientY - rect.top) / scale
    const worldToScreen = (worldX, worldY) => ({
      x: ((worldX * TILE - (camera.current.drawX ?? camera.current.x)) * zoom + element.width / 2 * (1 - zoom)),
      y: ((worldY * TILE - (camera.current.drawY ?? camera.current.y)) * zoom + element.height / 2 * (1 - zoom)),
    })
    const entries = [{ id: 'player', x: game.current.player.x + .325, y: game.current.player.y + .9 }, ...autonomyRef.current.miners.map(miner => ({ id: miner.id, x: (miner.renderX ?? miner.x) + .325, y: (miner.renderY ?? miner.y) + .9 }))]
    return entries.map(entry => ({ ...entry, point: worldToScreen(entry.x, entry.y) })).sort((a, b) => Math.hypot(a.point.x - x, a.point.y - y) - Math.hypot(b.point.x - x, b.point.y - y)).find(entry => Math.hypot(entry.point.x - x, entry.point.y - y) <= 25 / scale)
  }

  function focusPointer(event) {
    if (event.pointerType === 'touch') return
    setFocusMiner(minerAt(event)?.id || null)
  }

  function point(event) {
    const nearby = minerAt(event)
    if (nearby?.id && nearby.id !== 'player') {
      inspectMiner(nearby.id)
      return true
    }
    const target = viewportPoint(event)
    if (game.current.impact?.until > game.current.time && Math.hypot(target.x - game.current.impact.x, target.y - game.current.impact.y) <= 1) {
      game.current.reactUntil = game.current.time + .6
      say(game.current, 'Nice impact. The miner noticed your reaction.')
      return true
    }
    if (game.current.seen[keyOf(target.x, target.y)]) {
      game.current.target = target
      suggestTile(target)
      return true
    }
    return false
  }

  function pointerDown(event) {
    if (panel || (event.pointerType === 'mouse' && event.button !== 0)) return
    canvas.current.focus()
    canvas.current.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const points = [...pointers.current.values()]
      gesture.current = { moved: true, pinchDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), pinchZoom: camera.current.zoom }
      return
    }
    gesture.current = { startX: event.clientX, startY: event.clientY, cameraX: camera.current.x, cameraY: camera.current.y, moved: false }
    focusPointer(event)
  }

  function pointerMove(event) {
    if (panel) return
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2 && gesture.current?.pinchDistance) {
      const points = [...pointers.current.values()]
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      camera.current.zoom = clamp(Math.round((gesture.current.pinchZoom * distance / gesture.current.pinchDistance) * 4) / 4, .75, 2)
      camera.current.manualUntil = game.current.time + 8
      return
    }
    if (!gesture.current || pointers.current.size !== 1) return focusPointer(event)
    const scale = runtime.current?.scale || 1
    const zoom = camera.current.zoom || 1
    const dx = event.clientX - gesture.current.startX
    const dy = event.clientY - gesture.current.startY
    if (Math.hypot(dx, dy) > 5) gesture.current.moved = true
    if (gesture.current.moved) {
      camera.current.x = gesture.current.cameraX - dx / scale / zoom
      camera.current.y = gesture.current.cameraY - dy / scale / zoom
      camera.current.manualUntil = game.current.time + 8
    }
    focusPointer(event)
  }

  function pointerUp(event) {
    const moved = gesture.current?.moved
    pointers.current.delete(event.pointerId)
    if (!moved && pointers.current.size === 0 && !panel) point(event)
    if (pointers.current.size === 0) gesture.current = null
  }

  function zoom(event) {
    if (panel) return
    event.preventDefault()
    camera.current.zoom = clamp(camera.current.zoom + (event.deltaY < 0 ? .25 : -.25), .75, 2)
    camera.current.zoom = Math.round(camera.current.zoom * 4) / 4
    camera.current.manualUntil = game.current.time + 8
  }

  function exportSave() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(serialize(game.current, settings))], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dig-fun-world.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importSave(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 4 * 1024 * 1024) throw Error('Save is too large.')
      const value = JSON.parse(await file.text())
      if (value?.version !== 2 || !value.player || !value.removed) throw Error('Choose a version 2 world save. Your current mine is unchanged.')
      const next = restore(value)
      game.current = next.g
      config.current = next.settings
      setSettings(next.settings)
      save()
      setStatus('World restored.')
      camera.current = { x: 0, y: 0, zoom: 1, manualUntil: 0 }
    } catch (error) {
      setStatus(error.message || 'Invalid save. Your current mine is unchanged.')
    }
  }

  const g = game.current
  const depth = Math.max(0, Math.round(Math.max(g.deepest || 0, autonomy.community?.depth || 0)))
  const live = autonomy.activity?.mode === 'live' && autonomy.activity?.liveAvailable
  const crew = autonomy.miners.filter(miner => !crewQuery || `${miner.name} ${miner.wallet}`.toLowerCase().includes(crewQuery.toLowerCase())).slice(0, 80)

  return <main className="game">
    <header className="top-bar">
      <a className="wordmark" href="#game" onClick={event => { event.preventDefault(); canvas.current?.focus() }} aria-label="DIG.FUN — focus game"><PixelIcon />DIG<span>.FUN</span><small>ONE MORE BLOCK.</small></a>
      <div className="top-readouts" aria-label="Mine status">
        <span><b>DEPTH:</b> {depth}m</span>
        <span><b>MINERS:</b> {autonomy.miners.length}</span>
        <span className="connection-status"><i /> {live ? 'LIVE' : 'DEMO'}</span>
        <button type="button" className="menu-button" onClick={() => open('menu')} aria-label="Open menu" aria-expanded={panel === 'menu'}>☰ <span>MENU</span></button>
      </div>
    </header>

    <section className="playfield" ref={view} id="game" aria-label="Autonomous community mining world">
      <canvas className="pixel-art" ref={canvas} tabIndex={0} aria-label="Autonomous community mining world. Click a miner to inspect them, click a suspicious wall to suggest it, drag to pan, and scroll to zoom." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={zoom} onContextMenu={event => event.preventDefault()} />
      <MinerNameplates ref={nameplates} miners={autonomy.miners} crewVisible={autonomy.crewIntroduced} followId={autonomy.followId || 'player'} focusId={focusMiner} onMinerClick={inspectMiner} />
      <AutonomyOverlay state={autonomy} offlineSummary={offlineSummary} onDismissMajor={dismissMajor} onDismissJoin={dismissJoin} onDismissEvent={dismissEvent} onDismissNotice={dismissNotice} onMute={() => { autonomyRef.current.mute = !autonomyRef.current.mute; refreshAutonomy() }} onReaction={reactToMajor} onRace={raceToMajor} onOpenCrew={() => open('crew')} onInspectMajor={inspectMajor} />
    </section>

    <ResponsivePanel isOpen={!!panel} title={panelTitles[panel]} onClose={closePanel} panelRef={focus}>
      {panel === 'menu' && <>
        <p className="panel-lede">The crew is already digging. Use this menu to inspect the local mine without interrupting its autonomous work.</p>
        <div className="menu-grid"><button className="primary" onClick={() => open('crew')}>LOCAL CREW RECORDS</button><button onClick={() => open('inventory')}>DISCOVERY LOG</button><button onClick={() => open('journal')}>FIELD NOTEBOOK</button><button onClick={() => open('sol')}>IN-GAME SOL</button><button onClick={() => open('wallet')}>OFFICIAL WALLET LINKS</button><button onClick={() => open('help')}>HOW TO INTERACT</button><button onClick={() => open('settings')}>SETTINGS</button><button onClick={() => open('reset')}>RESET LOCAL MINE</button></div>
        <p className="fine-print">{savedError.current ? 'SAVE UNAVAILABLE · EXPORT IN SETTINGS' : 'PROGRESS SAVED LOCALLY'} · THE SIMULATION KEEPS RUNNING BEHIND THIS PANEL.</p>
      </>}

      {panel === 'sol' && <><dl className="sol-details">{[['CURRENT BALANCE', formatSOL(g.sol.balance)], ['TOTAL EARNED', formatSOL(g.sol.total)], ['THIS SESSION', formatSOL(g.solSession)], ['LARGEST REWARD', formatSOL(g.sol.largest)], ['LATEST REWARD', `+${formatSOL(g.sol.latest?.amount || 0)}`], ['SOURCE', g.sol.latest?.source || 'NO REWARDS YET']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="sol-panel-disclaimer">IN-GAME SOL — NO REAL MONETARY VALUE</p><p className="fine-print">This local fictional balance cannot be withdrawn, transferred, traded, or sent to a wallet.</p></>}

      {panel === 'wallet' && <><p>DIG.FUN never connects to a wallet. These links only open the official Phantom and Solflare websites.</p><div className="wallet-choices">{WALLET_OPTIONS.map(option => <a className="wallet-external" key={option.name} href={option.url} target="_blank" rel="noopener noreferrer">OPEN OFFICIAL {option.name.toUpperCase()} ↗</a>)}</div><p className="fine-print">NO SIGNING · NO BALANCES · NO WALLET ACCESS. Your mine stays saved in this browser.</p></>}

      {panel === 'help' && <><ul className="interaction-list"><li><b>Watch the mine.</b> Every miner chooses routes, breaks blocks, collects ore, and solves chambers automatically.</li><li><b>Inspect a miner.</b> Click or tap a visible miner to open their local record and follow their tunnel.</li><li><b>Suggest a wall.</b> Click a revealed block or suspicious sparkle. The main miner may investigate when the route is safe.</li><li><b>Move the view.</b> Drag to pan. Scroll or pinch to zoom. The mine never resets while you look around.</li><li><b>Follow discoveries.</b> Click a major announcement to inspect the crew records or follow its miner.</li></ul><p className="fine-print">Wallet activity is read-only when configured. Otherwise all buyers, miners, records, and reactions are clearly simulated in this browser.</p></>}

      {panel === 'inventory' && <><p>Collected deposits are local fictional discoveries. IN-GAME SOL — NO REAL MONETARY VALUE.</p><div className="ore-list">{Object.entries(ORE_COLORS).map(([ore, color]) => <div key={ore}><PixelIcon type="ore" color={color} /><span>{ore === 'sol' ? 'SOL CRYSTAL' : `${ore.toUpperCase()} ORE`}</span><strong>{g.inventory[ore] || 0}</strong></div>)}</div></>}

      {panel === 'crew' && <><p>{live ? 'LIVE ON-CHAIN ACTIVITY · PUBLIC RPC READ ONLY.' : 'SIMULATED MINE ACTIVITY · NO REAL BUYERS OR ONLINE PLAYERS.'}</p><div className="community-stats"><span><b>{autonomy.miners.length}</b> active miners</span><span><b>{Math.round(autonomy.community?.depth || 0)}m</b> community depth</span><span><b>{autonomy.community?.buys || 0}</b> buys tracked</span><span><b>{autonomy.community?.blocks || 0}</b> blocks cleared</span><span><b>{autonomy.community?.ore?.diamond || 0}</b> diamonds</span><span><b>{autonomy.community?.ore?.sol || 0}</b> SOL crystals</span></div><div className="crew-tools"><input value={crewQuery} onChange={event => setCrewQuery(event.target.value)} placeholder="SEARCH SHORT WALLET" aria-label="Search shortened wallet address" /><button onClick={showOverview}>MINE OVERVIEW</button></div><div className="crew-list">{crew.map(miner => <article className={`crew-card ${inspectedMiner === miner.id ? 'is-selected' : ''}`} key={miner.id}><span className="crew-avatar" style={{ '--crew-color': miner.color, '--crew-helmet': miner.appearance?.helmet || miner.color, '--crew-skin': miner.appearance?.skin || '#d0a57b' }}><i /><i /><i /></span><div><strong>{miner.name}</strong><small>{miner.role} · {miner.tool}</small><p>{miner.status || miner.goal}</p><div className="crew-stats"><span>{miner.blocks} BLK</span><span>{Math.round(miner.deepest)}M</span><span>{miner.purchaseCount ? `${miner.purchaseCount} BUY` : 'LOCAL NPC'}</span><span>{miner.haul.gold + miner.haul.diamond + miner.haul.sol} RARE</span></div><div className="crew-card-actions"><button onClick={() => inspectMiner(miner.id)}>INSPECT</button><button onClick={() => followMiner(miner.id)}>FOLLOW</button></div></div></article>)}</div><div className="record-board"><small>LOCAL CREW RECORDS</small>{[['Deepest miner', 'deepest', 'm'], ['Most blocks destroyed', 'blocks', 'blocks'], ['Highest-value haul', 'value', 'points'], ['Most puzzles solved', 'puzzles', 'puzzles'], ['Biggest explosion', 'explosions', 'blocks'], ['Most unfortunate lava incident', 'lavaIncidents', 'incidents'], ['Most suspicious empty chests', 'emptyChests', 'chests']].map(([label, key, unit]) => <div key={key}><span>{label}</span><strong>{autonomy.records[key]?.name || 'YOU'} <b>{Math.round(autonomy.records[key]?.[key] || 0)} {unit}</b></strong></div>)}</div><div className="transaction-log"><small>RECENT ACTIVITY</small>{(autonomy.activity?.transactions || []).slice(0, 8).map(item => <p key={item.id}><b>{item.name}</b> · {item.amount} {item.unit} <em>{item.source === 'live' ? 'VERIFIED' : 'SIMULATED'}</em></p>)}</div><small className="crew-disclaimer">LOCAL CREW RECORDS · no server, authentication, wallet access, or global ranking.</small></>}

      {panel === 'journal' && <><p>{g.artifacts.length} objects recovered · {g.deepest.toFixed(1)}m deepest descent.</p>{!g.artifacts.length && <div className="empty-note"><PixelIcon type="book" /><h2>THE PAGES ARE STILL EMPTY.</h2><p>The autonomous crew will inspect sealed casings as they find them.</p></div>}{g.artifacts.map(artifact => <article className="field-entry" key={artifact.id}><small>OBJECT {artifact.id} / {artifact.outcome.toUpperCase()}</small><p>{artifactText[artifact.outcome]}</p>{artifact.outcome === 'puzzle' && <><p>Inscription: “First the tool, then the sun, then the way down.”</p><div className="puzzle-dials">{(artifact.dials || [0, 0, 0]).map((dial, index) => <button key={index} disabled={artifact.solved} aria-label={`Rotate mark ${index + 1}, currently ${['Ladder', 'Pickaxe', 'Sun'][dial]}`} onClick={() => { turnDial(g, artifact, index); save(); refresh(value => value + 1) }}><span>{['H', 'T', '*'][dial]}</span>{['LADDER', 'PICKAXE', 'SUN'][dial]}</button>)}</div>{artifact.solved && <p role="status">SEAL DECODED · Ancient walls unlocked.</p>}</>}</article>)}{legacy.artifacts.length > 0 && <div className="field-entry"><h2>PREVIOUS EXPEDITION ARCHIVE</h2><p>{legacy.artifacts.length} artifacts from your original save are preserved.</p></div>}</>}

      {panel === 'settings' && <><h2>COMFORT & SOUND</h2><div className="settings-toggles">{[['sound', 'Mining sounds'], ['music', 'Ambient music'], ['shake', 'Screen shake'], ['reduced', 'Reduced motion'], ['contrast', 'High-contrast targeting'], ['vibration', 'Touch vibration']].map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={event => setSettings(value => ({ ...value, [key]: event.target.checked }))} />{label}</label>)}</div><h2>LOCAL SAVE</h2><div className="save-actions"><button onClick={exportSave}>EXPORT WORLD</button><label className="file-button">IMPORT WORLD<input type="file" accept="application/json" aria-label="Import world save, replaces current world" onChange={importSave} /></label><button onClick={() => open('reset')}>NEW EXPEDITION</button></div><p className="fine-print">Reduced motion removes nonessential effects. The autonomous mine continues while settings are open.</p></>}

      {panel === 'reset' && <><p>This replaces your current world, discovery records, and in-game SOL balance. Export your world first if you want to keep it.</p><button onClick={exportSave}>EXPORT CURRENT WORLD</button><button className="danger" onClick={() => { game.current = createGame(); resetAutonomy(); camera.current = { x: 0, y: 0, zoom: 1, manualUntil: 0 }; reveal(game.current); save(); closePanel() }}>RESET & START AGAIN</button>{status && <p role="status">{status}</p>}</>}
      {status && panel !== 'reset' && <p role="status">{status}</p>}
      <footer>NO DEADLINES. NO LEADERBOARDS. JUST THE NEXT BLOCK.</footer>
    </ResponsivePanel>
  </main>
}

import { useEffect, useRef, useState } from 'react'
import useModalFocus from './hooks/useModalFocus'
import useMineSound from './hooks/useMineSound'
import SolCounter from './components/SolCounter'
import AutonomyOverlay from './components/AutonomyOverlay'
import MinerNameplates from './components/MinerNameplates'
import { formatSOL } from './utils/sol'
import { WALLET_OPTIONS } from './utils/wallet'
import { loadProgress } from './utils/storage'
import { createGame, restore, serialize, SAVE_KEY, DEFAULT_KEYS, DEFAULT_SETTINGS, TOOLS, ORE_COLORS, SURFACE, TILE, ZONES, zoneAt, step, reveal, switchTool, interact, scan, say, promptFor, unlocked, keyOf, playerTile, tile, turnDial, returnToSurface, gameplayHint } from './utils/world'
import { drawWorld } from './utils/renderWorld'
import { AUTONOMY_KEY, applyOfflineProgress, autoDecision, computeRecords, createAutonomy, restoreAutonomy, serializeAutonomy, startPuzzle, tickCrew } from './utils/autonomy'

const keyLabel = code => code.replace('Key', '').replace('Digit', '').replace('Arrow', '').replace('Left', 'LEFT').replace('Right', 'RIGHT').replace('Space', 'SPACE').replace('Escape', 'ESC')
const shortTools = ['RUSTY', 'IRON', 'SILVER', 'GOLD', 'DIAMOND', 'LASER', 'SOL']
const artifactText = { component: 'A broken pickaxe head. Rebuilt into your first tool upgrade.', puzzle: 'Align the three marks to open the ancient lock.', clue: 'Follow the broken white seams. Reflections can lie.', cosmetic: 'The foreman’s green scarf. Now worn by your miner.', map: 'The old chambers repeat every 14 vertical tiles.', funny: 'A tiny frog whispered “one more block” and left.', hazard: 'An ancient dust trap. Survived, with every ore intact.', empty: 'An empty lunch box. Hope was the last thing inside.', reward: 'A forgotten cache. Its reward was added directly to your in-game SOL balance.' }
function initial() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return restore(JSON.parse(raw)) } catch { /* Storage can be unavailable; gameplay still works. */ }
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
  const [loaded] = useState(initial), game = useRef(loaded.g)
  const [autonomy, setAutonomy] = useState(() => {
    const state = initialAutonomy()
    applyOfflineProgress(state, loaded.g)
    return state
  })
  const [settings, setSettings] = useState(loaded.settings)
  const [offlineSummary, setOfflineSummary] = useState(autonomy.offline)
  const [panel, setPanel] = useState(null), [binding, setBinding] = useState(null), [status, setStatus] = useState(''), [inspectedMiner, setInspectedMiner] = useState(null), [legacy] = useState(loadProgress)
  const [, refresh] = useState(0), canvas = useRef(null), view = useRef(null), nameplates = useRef(null), input = useRef({}), camera = useRef({ x: 0, y: 0 }), inspect = useRef(0), gesture = useRef(null)
  const config = useRef(settings), panelRef = useRef(panel), savedError = useRef(false), runtime = useRef(null), autonomyRef = useRef(autonomy), autoRef = useRef(autonomy.auto)
  config.current = settings; panelRef.current = panel
  autonomyRef.current = autonomy
  autoRef.current = autonomy.auto
  const { play } = useMineSound(settings.music && !panel, settings.sound), playRef = useRef(play)
  playRef.current = play
  const closePanel = () => { setPanel(null); setBinding(null); input.current = {}; requestAnimationFrame(() => canvas.current?.focus()) }
  const focus = useModalFocus(!!panel, closePanel)
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(game.current, config.current))); savedError.current = false }
    catch { savedError.current = true }
  }
  function saveAutonomy() {
    try {
      autonomyRef.current.lastActive = Date.now()
      localStorage.setItem(AUTONOMY_KEY, JSON.stringify(serializeAutonomy(autonomyRef.current)))
    } catch { /* Crew life continues for this session if storage is unavailable. */ }
  }
  function resetAutonomy() {
    const next = createAutonomy()
    autonomyRef.current = next
    setAutonomy(next)
    setOfflineSummary(null)
    saveAutonomy()
  }
  function refreshAutonomy() {
    setAutonomy({ ...autonomyRef.current, auto: { ...autonomyRef.current.auto } })
  }
  function dismissMajor() {
    autonomyRef.current.major = null
    autonomyRef.current.offline = null
    setOfflineSummary(null)
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
    autonomyRef.current.auto.suggestion = miner ? { x: Math.floor(miner.x), y: Math.floor(miner.y), until: game.current.time + 12 } : null
    autonomyRef.current.auto.status = 'Following a crew discovery'
    autonomyRef.current.auto.decision = autonomyRef.current.auto.status
    dismissMajor()
  }
  function suggestTile(target) {
    autonomyRef.current.auto.suggestion = { x: target.x, y: target.y, until: game.current.time + 8 }
    autonomyRef.current.auto.target = null
    autonomyRef.current.auto.status = 'Investigating sparkle'
    autonomyRef.current.auto.decision = autonomyRef.current.auto.status
    refreshAutonomy()
  }
  function inspectMiner(id) {
    const miner = autonomyRef.current.miners.find(item => item.id === id)
    if (!miner) return
    setInspectedMiner(id)
    autonomyRef.current.ticker = `${miner.name} is ${String(miner.status || miner.goal).toLowerCase()}.`
    refreshAutonomy()
    open('crew')
  }
  function open(name) { input.current = {}; setStatus(''); setPanel(name); setBinding(null); save() }
  const actions = useRef(null)
  actions.current = action => {
    const g = game.current
    if (action === 'pause') { if (panelRef.current) closePanel(); else open('pause'); return }
    if (panelRef.current) return
    if (action === 'journal' || action === 'inventory') { open(action); return }
    if (action === 'next' || action === 'previous') switchTool(g, action === 'next' ? 1 : -1)
    if (action === 'scanner') scan(g)
    if (action === 'surface') { input.current = {}; gesture.current = null; inspect.current = 0; returnToSurface(g); camera.current = { x: 0, y: 0 }; save(); canvas.current?.focus() }
    if (action === 'interact') { const next = interact(g); if (next) open(next); save() }
    refresh(n => n + 1)
  }
  useEffect(() => {
    reveal(game.current)
    const element = canvas.current, container = view.current
    const context = element.getContext('2d')
    context.imageSmoothingEnabled = false
    let frame, last = performance.now(), lastUI = 0, lastSave = 0, scale = 3
    const resize = () => {
      scale = Math.max(1, Math.min(4, Math.floor(container.clientWidth / (container.clientWidth < 600 ? 160 : 400))))
      element.width = Math.floor(container.clientWidth / scale); element.height = Math.floor(container.clientHeight / scale)
      element.style.width = `${element.width * scale}px`; element.style.height = `${element.height * scale}px`
      runtime.current = { scale }
    }
    const observer = new ResizeObserver(resize); observer.observe(container); resize()
    const clear = () => { input.current = {}; gesture.current = null }
    const blur = () => { clear(); if (!panelRef.current) setPanel('pause'); save(); saveAutonomy() }
    const visibility = () => { if (document.hidden) blur() }
    const pagehide = () => { save(); saveAutonomy() }
    const keydown = e => {
      if (panelRef.current || e.target.closest('input,select,textarea')) return
      if (e.target.closest('button,a') && ['Space', 'Enter'].includes(e.code)) return
      const keys = config.current.keys
      let action = Object.keys(keys).find(a => keys[a] === e.code)
      const aliases = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
      if (!action && aliases[e.code] && keys[aliases[e.code]] === DEFAULT_KEYS[aliases[e.code]]) action = aliases[e.code]
      if (!action) return
      e.preventDefault()
      if (['left', 'right', 'up', 'down', 'jump', 'mine'].includes(action)) {
        input.current[action] = true
        if (action === 'jump') input.current.jumpPressed = true
        if (action === 'up' || action === 'down') {
          const g = game.current, pos = playerTile(g)
          if (tile(g, pos.x, pos.y) !== 'ladder') g.target = { x: pos.x, y: pos.y + (action === 'down' ? 1 : -1) }
        }
      }
      else if (!e.repeat) actions.current(action)
    }
    const keyup = e => {
      const keys = config.current.keys
      for (const action of Object.keys(keys)) if (keys[action] === e.code) input.current[action] = false
      const alias = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.code]
      if (alias) input.current[alias] = false
    }
    const preventWheel = e => e.preventDefault()
    const release = e => { if (e.pointerType !== 'touch') input.current.mine = false }
    const loop = now => {
      const dt = Math.min((now - last) / 1000, .035); last = now
      const g = game.current
      if (document.hidden) { frame = requestAnimationFrame(loop); return }
      if (!panelRef.current) {
        const earnedBefore = g.sol.total
        const puzzleBusy = autonomyRef.current.puzzle && !autonomyRef.current.puzzle.done
        const decision = puzzleBusy ? { input: {}, target: g.target, interact: false } : autoDecision(g, autoRef.current, dt)
        if (decision.interact) {
          const before = g.artifacts.length
          interact(g)
          const artifact = g.artifacts.length > before ? g.artifacts[g.artifacts.length - 1] : null
          if (artifact?.outcome === 'puzzle') startPuzzle(autonomyRef.current, g, 'player', artifact.id)
        }
        const manual = Object.fromEntries(Object.entries(input.current).filter(([, active]) => active))
        const activeInput = puzzleBusy ? {} : { ...decision.input, ...manual }
        if (decision.target) g.target = decision.target
        step(g, activeInput, dt, config.current)
        if (g.sol.total !== earnedBefore) save()
        if (g.sound) { playRef.current(g.sound); g.sound = null }
        if (g.vibrate) { if (config.current.vibration && navigator.vibrate) navigator.vibrate(12); g.vibrate = false }
      }
      if (!document.hidden) {
        tickCrew(autonomyRef.current, g, dt)
        if (now - lastUI > 120) { computeRecords(autonomyRef.current, g); refreshAutonomy(); refresh(n => n + 1); lastUI = now }
      }
      drawWorld(context, g, camera.current, element.width, element.height, config.current, inspect.current, autonomyRef.current)
      nameplates.current?.update({ game: g, autonomy: autoRef.current, camera: camera.current, canvas: element, container, scale })
      if (now - lastSave > 1500) { save(); saveAutonomy(); lastSave = now }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('pointerup', release); window.addEventListener('pagehide', pagehide)
    document.addEventListener('visibilitychange', visibility); container.addEventListener('wheel', preventWheel, { passive: false })
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('pointerup', release); window.removeEventListener('pagehide', pagehide); document.removeEventListener('visibilitychange', visibility); container.removeEventListener('wheel', preventWheel); save(); saveAutonomy() }
  }, [])
  useEffect(() => { if (panel) input.current = {} }, [panel])
  function point(e) {
    const rect = canvas.current.getBoundingClientRect(), scale = runtime.current.scale
    const target = { x: Math.floor(((e.clientX - rect.left) / scale + camera.current.drawX) / TILE), y: Math.floor(((e.clientY - rect.top) / scale + camera.current.drawY) / TILE) }
    if (game.current.impact?.until > game.current.time && Math.hypot(target.x - game.current.impact.x, target.y - game.current.impact.y) <= 1) {
      game.current.reactUntil = game.current.time + .6
      say(game.current, 'Nice impact. The miner noticed your reaction.')
      return true
    }
    if (game.current.seen[keyOf(target.x, target.y)]) { game.current.target = target; suggestTile(target); return true }
    say(game.current, 'Too far away. Move closer.'); return false
  }
  function pointerDown(e) {
    if (panel || e.button > 0) return
    canvas.current.focus(); canvas.current.setPointerCapture(e.pointerId)
    if (e.pointerType === 'touch') gesture.current = { x: e.clientX, y: e.clientY, moved: false }
    else input.current.mine = point(e)
  }
  function pointerMove(e) {
    if (e.pointerType === 'touch' && gesture.current) {
      const dx = e.clientX - gesture.current.x
      if (Math.abs(dx) > 12) { gesture.current.moved = true; inspect.current = Math.max(-48, Math.min(48, -dx / runtime.current.scale)) }
    } else if (!input.current.mine && !panel) point(e)
  }
  function pointerUp(e) {
    if (e.pointerType === 'touch' && gesture.current && !gesture.current.moved) point(e)
    gesture.current = null; input.current.mine = false; inspect.current = 0
  }
  function bind(e, action) {
    e.preventDefault(); e.stopPropagation()
    if (e.code === 'Escape') { setBinding(null); return }
    if (!/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Enter|ShiftLeft|ControlLeft)$/.test(e.code)) { setStatus('Use a letter, number, arrow, Space, Enter, Shift or Control.'); return }
    const previous = Object.keys(settings.keys).find(a => settings.keys[a] === e.code)
    setSettings(s => ({ ...s, keys: { ...s.keys, [action]: e.code, ...(previous && previous !== action ? { [previous]: s.keys[action] } : {}) } })); setBinding(null); setStatus('Binding saved. Conflicting bindings are swapped.')
  }
  function touchButton(action, label, symbol, hold = false) {
    return <button key={action} className={`touch-${action}`} aria-label={label} onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); if (hold) input.current[action] = true; else actions.current(action) }} onPointerUp={() => { input.current[action] = false }} onPointerCancel={() => { input.current[action] = false }} onLostPointerCapture={() => { input.current[action] = false }} onKeyDown={e => { if (hold && ['Space', 'Enter'].includes(e.code)) { e.preventDefault(); input.current[action] = true } }} onKeyUp={e => { if (hold && ['Space', 'Enter'].includes(e.code)) { e.preventDefault(); input.current[action] = false } }} onBlur={() => { input.current[action] = false }}>{symbol}<small>{label}</small></button>
  }
  function exportSave() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(serialize(game.current, settings))], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'dig-fun-world.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importSave(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    try {
      if (file.size > 4 * 1024 * 1024) throw Error('Save is too large.')
      const value = JSON.parse(await file.text()); if (value?.version !== 2 || !value.player || !value.removed) throw Error('Choose a version 2 world save. Your current mine is unchanged.')
      const next = restore(value); game.current = next.g; config.current = next.settings; setSettings(next.settings); save(); setStatus('World restored.'); camera.current = { x: 0, y: 0 }
    } catch (error) { setStatus(error.message || 'Invalid save. Your current mine is unchanged.') }
  }
  const g = game.current, hint = gameplayHint(g), depth = Math.max(0, (Math.floor(g.player.y + .9) - SURFACE) / 10), tool = TOOLS[g.tool]
  return <main className={`game ${settings.touch ? 'show-touch' : ''}`}>
    <header className="game-header">
      <a className="wordmark" href="#game" onClick={e => { e.preventDefault(); canvas.current.focus() }} aria-label="DIG.FUN — focus game"><PixelIcon />DIG<span>.FUN</span><small>ONE MORE BLOCK.</small></a>
      <div className="header-center"><span className="live-pixel" /> LOCAL EXPEDITION <span className="muted">/</span> NO. 006</div>
      <nav aria-label="Game menus"><button className="connect-wallet" onClick={() => open('wallet')} aria-label="Open official wallet links">WALLET LINKS</button><button className="reset-world" onClick={() => open('reset')} aria-label="Reset game">RESET</button><button onClick={() => open('journal')}><PixelIcon type="book" /><span>JOURNAL</span><kbd>{keyLabel(settings.keys.journal)}</kbd></button><button onClick={() => open('inventory')}><PixelIcon type="pouch" /><span>FINDS</span></button><button onClick={() => open('pause')} aria-label="Pause and settings"><span className="pause-icon">Ⅱ</span></button></nav>
    </header>
    <section className="sol-hud" aria-label="In-game SOL rewards"><div className="sol-hud-tip"><strong>MINE ORE. EARN SOL.</strong><span>Copper, silver, gold & discoveries add rewards here →</span></div><SolCounter sol={g.sol} reduced={settings.reduced} onOpen={() => open('sol')} /></section>
    <div className="expedition-bar"><span><i /> {ZONES[zoneAt(g.player.y)]}</span><span>SECTOR {String(zoneAt(g.player.y) + 1).padStart(2, '0')} <span className="muted">/ 06</span></span></div>
    <section className="playfield" ref={view} id="game" aria-label="Mining expedition">
      <canvas className="pixel-art" ref={canvas} tabIndex={0} aria-label="Mining world. A D move, W S aim or climb, Space jump, X hold to mine, E interact. Rebind controls in Settings." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={() => { input.current.mine = false }} onContextMenu={e => e.preventDefault()} />
      <MinerNameplates ref={nameplates} miners={autonomy.miners} crewVisible={autonomy.crewIntroduced} onMinerClick={inspectMiner} />
      <AutonomyOverlay state={autonomy} offlineSummary={offlineSummary} onDismissMajor={dismissMajor} onMute={() => { autonomyRef.current.mute = !autonomyRef.current.mute; refreshAutonomy() }} onReaction={reactToMajor} onRace={raceToMajor} />
      <div className="depth-counter"><span>DEPTH / METERS</span><strong>{depth.toFixed(1).padStart(5, '0')}<small>M</small></strong><div><i /> DEEPEST <b>{g.deepest.toFixed(1)} M</b></div></div>
      {g.broken > 0 && <aside className="gameplay-hint"><small>MINER’S TIP</small><strong>{hint.title}</strong><p>{hint.text}</p><button onClick={() => open('help')}>FULL CONTROLS</button></aside>}
      <button className="surface-lift" onClick={() => actions.current('surface')} disabled={depth === 0} aria-label="Return to surface"><span>↑ SURFACE LIFT</span><small>{depth === 0 ? 'AT THE ENTRANCE' : 'FREE · KEEP YOUR SOL'}</small></button>
      <div className="interaction-prompt">{promptFor(g)}</div>
      <div className="easy-controls">{g.broken > 0 ? <>{touchButton('digDown', 'Hold to dig down', '↓', true)}<button onClick={() => open('help')}>HOW TO PLAY</button></> : <span className="auto-start-label">MINER ACTIVE · INSPECTING THE WALL</span>}</div>
      <div className="notification" role="status" aria-live="polite">{g.noticeUntil > g.time ? g.notice : ''}</div>
      <div className="miner-readout"><span className="live-pixel" />{g.player.state.replaceAll('-', ' ').toUpperCase()}<span> {g.broken} BLOCKS</span></div>
      <button className={`scanner-button ${g.scanner ? 'scanning' : ''}`} onClick={() => actions.current('scanner')}><PixelIcon type="scan" /><span>MINERAL SCANNER<small>{g.time < g.scannerReady ? `RECHARGING ${Math.ceil(g.scannerReady - g.time)}S` : 'LOOK FOR A GLINT, NOT A GUARANTEE'}</small></span><kbd>{keyLabel(settings.keys.scanner)}</kbd></button>
      <div className="touch-controls" style={{ '--touch-opacity': settings.opacity, '--touch-inset': `${settings.inset}px`, '--touch-bottom': `${settings.bottom}px` }}>
        <div className="touch-movement">{touchButton('up', 'Up', '↑', true)}{touchButton('left', 'Left', '←', true)}{touchButton('down', 'Down', '↓', true)}{touchButton('right', 'Right', '→', true)}</div>
        <div className="touch-actions">{touchButton('mine', 'Mine', '×', true)}{touchButton('jump', 'Jump', '↑', true)}{touchButton('interact', 'Interact', 'E')}{touchButton('next', 'Tool', 'R')}{touchButton('scanner', 'Scan', 'F')}</div>
      </div>
    </section>
    <footer className="tool-deck">
      <div className="equipped"><span>IN YOUR HANDS</span><strong>{tool.name}</strong><small>{tool.drill ? 'CONTINUOUS / WATCH THE HEAT' : tool.laser ? 'ARTIFACT CASINGS ONLY' : 'STEADY HANDS. STUBBORN ROCK.'}</small><div className={`heat-gauge ${g.cooldown ? 'hot' : ''}`} aria-label={`Tool heat ${Math.round(g.heat)} percent`}><i style={{ width: `${g.heat}%` }} /></div></div>
      <div className="tool-belt" role="group" aria-label="Tool belt">{TOOLS.map((t, i) => <button key={t.name} className={g.tool === i ? 'selected' : ''} disabled={!unlocked(g, i)} aria-label={`${t.name}${unlocked(g, i) ? '' : ` — unlock at ${t.unlock} blocks`}`} aria-pressed={g.tool === i} onClick={() => { g.tool = i; canvas.current.focus() }} title={`${t.name} · ${t.unlock} blocks to unlock`}><small>{String(i + 1).padStart(2, '0')}</small><PixelIcon type={t.drill ? 'drill' : t.laser ? 'laser' : 'pick'} color={t.color} /><span>{unlocked(g, i) ? shortTools[i] : `${t.unlock} BLK`}</span></button>)}</div>
      <button className="pouch-summary" onClick={() => open('inventory')}><PixelIcon type="book" /><span>DISCOVERY LOG<strong>YOUR FINDS</strong></span></button>
    </footer>
    <div className="control-strip"><span><kbd>{keyLabel(settings.keys.left)}</kbd><kbd>{keyLabel(settings.keys.right)}</kbd> MOVE <i /> <kbd>{keyLabel(settings.keys.jump)}</kbd> JUMP <i /> <kbd>{keyLabel(settings.keys.mine)}</kbd> / HOLD CLICK TO MINE <i /> <kbd>{keyLabel(settings.keys.interact)}</kbd> INTERACT</span><span>{savedError.current ? 'SAVE UNAVAILABLE · EXPORT IN SETTINGS' : 'PROGRESS SAVED LOCALLY'} <i className="save-pixel" /></span></div>
    {panel && <div className="panel-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) closePanel() }}><section ref={focus} className="game-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header><div><small>EXPEDITION PAUSED / FIELD EQUIPMENT</small><h1 id="panel-title">{({ sol: 'IN-GAME SOL', wallet: 'OFFICIAL WALLET LINKS', help: 'LET’S START DIGGING.', pause: 'TAKE A BREATHER.', settings: 'CONTROL ROOM', journal: 'FIELD NOTEBOOK', inventory: 'DISCOVERY LOG', crew: 'LOCAL CREW RECORDS', reset: 'START A NEW SHAFT?' })[panel]}</h1></div><button onClick={closePanel} aria-label="Close panel">×</button></header>
      {panel === 'sol' && <><dl className="sol-details">{[['CURRENT BALANCE', formatSOL(g.sol.balance)], ['TOTAL EARNED', formatSOL(g.sol.total)], ['THIS SESSION', formatSOL(g.solSession)], ['LARGEST REWARD', formatSOL(g.sol.largest)], ['LATEST REWARD', `+${formatSOL(g.sol.latest?.amount || 0)}`], ['SOURCE', g.sol.latest?.source || 'NO REWARDS YET']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="sol-panel-disclaimer">In-Game SOL — No Real Monetary Value</p><p className="fine-print">Earn SOL by collecting ore, opening rewarding artifacts, solving ancient seals, reaching new depths, and entering secret chambers. This local game balance cannot be withdrawn, transferred, traded, or sent to a wallet.</p></>}
      {panel === 'wallet' && <><p>DIG.FUN never connects to a wallet. These links only open the official Phantom and Solflare websites.</p><div className="wallet-choices">{WALLET_OPTIONS.map(option => <a className="wallet-external" key={option.name} href={option.url} target="_blank" rel="noopener noreferrer">OPEN OFFICIAL {option.name.toUpperCase()} ↗</a>)}</div><p className="fine-print">NO SIGNING · NO BALANCES · NO WALLET ACCESS. Your mine stays saved in this browser.</p><button onClick={closePanel}>BACK TO DIGGING</button></>}
      {panel === 'help' && <><ol className="play-guide"><li><b>Break your first block.</b> Hold the DIG DOWN button. Release whenever you want to stop.</li><li><b>Pick a direction.</b> Use {keyLabel(settings.keys.left)} / {keyLabel(settings.keys.right)} or the arrow keys to walk. On a phone, hold the movement plates.</li><li><b>Explore sideways.</b> Hold a click on a neighboring block. On a phone, tap a block and hold Mine. Keyboard: aim with Up / Down and hold {keyLabel(settings.keys.mine)}.</li><li><b>Watch your SOL grow.</b> Soil and plain rock have no payout. Nearby copper, silver, gold, diamonds and crystals convert directly into in-game SOL. Your balance is always in the bright strip above the mine. Press {keyLabel(settings.keys.interact)} or Interact beside an artifact. Better tools unlock as you break blocks.</li><li><b>Come back up easily.</b> Tap SURFACE LIFT below the depth meter for an instant, free return to the entrance. Your SOL, discoveries and deepest record stay safe. Hold Up on a ladder to climb normally.</li></ol><p>Your miner only digs within reach. If the ground below is unsafe, explore another direction. Use {keyLabel(settings.keys.jump)} / Jump to get over gaps.</p><button className="primary" onClick={closePanel}>LET ME DIG</button></>}
      {panel === 'pause' && <><p>The mine can wait. Your discoveries are safe.</p><div className="menu-buttons"><button className="primary" onClick={closePanel}>BACK TO THE MINE</button><button onClick={() => open('help')}>HOW TO PLAY</button><button onClick={() => { closePanel(); input.current = {}; returnToSurface(g); camera.current = { x: 0, y: 0 }; save() }}>RETURN TO SURFACE · FREE</button><button onClick={() => open('reset')}>RESET GAME</button><button onClick={() => open('settings')}>SETTINGS & CONTROLS</button><button onClick={() => open('journal')}>ARTIFACT JOURNAL</button><button onClick={() => open('inventory')}>DISCOVERY LOG</button></div><p className="fine-print">Tools unlock as you break blocks. A / D or arrows to move; W / S to aim vertically or climb. Hold X to mine without a mouse. The ladder is to your left.</p></>}
      {panel === 'inventory' && <><p>Each collected deposit rewards SOL immediately. These are discovery records, not spendable items or currencies.</p><div className="ore-list">{Object.entries(ORE_COLORS).map(([ore, color]) => <div key={ore}><PixelIcon type="ore" color={color} /><span>{ore === 'sol' ? 'SOL CRYSTAL' : `${ore.toUpperCase()} ORE`}</span><strong>{g.inventory[ore] ? 'DISCOVERED' : 'UNKNOWN'}</strong></div>)}</div><p className="fine-print">SOL Crystals and all tools are fictional local game items.</p></>}
      {panel === 'crew' && <><p>Simulated miners only. They are running in this browser, not on a server.</p>{autonomy.miners.map(miner => <article className={`crew-inspect ${inspectedMiner === miner.id ? 'is-selected' : ''}`} key={miner.id}><strong>{miner.name}</strong><small>{miner.role} · {miner.tool}</small><p>{miner.status || miner.goal}</p><div><span>{miner.blocks} BLOCKS</span><span>{Math.round(miner.deepest)}M DEEP</span><span>{miner.puzzles} PUZZLES</span><span>{miner.haul.gold + miner.haul.diamond + miner.haul.sol} RARE</span></div></article>)}<button onClick={closePanel}>BACK TO DIGGING</button></>}
      {panel === 'journal' && <><p>{g.artifacts.length} objects recovered · {g.deepest.toFixed(1)} m deepest descent.</p>{!g.artifacts.length && <div className="empty-note"><PixelIcon type="book" /><h2>THE PAGES ARE STILL EMPTY.</h2><p>Find an engraved casing. Approach it and press {keyLabel(settings.keys.interact)}. There’s one at the right edge of the entrance.</p></div>}{g.artifacts.map(a => <article className="field-entry" key={a.id}><small>OBJECT {a.id} / {a.outcome.toUpperCase()}</small><p>{artifactText[a.outcome]}</p>{a.outcome === 'puzzle' && <><p>Inscription: “First the tool, then the sun, then the way down.”</p><div className="puzzle-dials">{(a.dials || [0, 0, 0]).map((dial, index) => <button key={index} disabled={a.solved} aria-label={`Rotate mark ${index + 1}, currently ${['Ladder', 'Pickaxe', 'Sun'][dial]}`} onClick={() => { turnDial(g, a, index); save(); refresh(n => n + 1) }}><span>{['H', 'T', '*'][dial]}</span>{['LADDER', 'PICKAXE', 'SUN'][dial]}</button>)}</div>{a.solved && <p role="status">SEAL DECODED · Ancient walls unlocked.</p>}<small>You can close this notebook and return later.</small></>}</article>)}{legacy.artifacts.length > 0 && <div className="field-entry"><h2>PREVIOUS EXPEDITION ARCHIVE</h2><p>{legacy.artifacts.length} artifacts from your original save are preserved.</p>{legacy.artifacts.map(a => <p key={a.id}>{a.id} · {a.discoveredAt.slice(0, 10)}</p>)}</div>}</>}
      {panel === 'settings' && <><h2>COMFORT & SOUND</h2><div className="settings-toggles">{[['sound','Mining sounds'],['music','Ambient music'],['shake','Screen shake'],['reduced','Reduced motion'],['contrast','High-contrast targeting'],['vibration','Touch vibration'],['touch','Always show touch controls']].map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))} />{label}</label>)}</div><h2>TOUCH CONTROL PLATES</h2>{[['opacity','Opacity',.25,1,.05],['inset','Horizontal inset',0,90,1],['bottom','Bottom inset',0,90,1]].map(([key,label,min,max,stepValue]) => <label className="range-setting" key={key}>{label}<input type="range" min={min} max={max} step={stepValue} value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))} /><output>{key === 'opacity' ? `${Math.round(settings[key] * 100)}%` : `${settings[key]}px`}</output></label>)}<h2>KEY BINDINGS</h2><p className="fine-print">Select a binding, then press a key. Escape cancels. Conflicts swap places. Escape always closes a panel.</p><div className="key-bindings">{Object.entries(settings.keys).map(([action, code]) => <button key={action} onClick={() => setBinding(action)} onKeyDown={e => { if (binding === action) bind(e, action) }} aria-label={`Rebind ${action}, currently ${keyLabel(code)}`}><span>{action}</span><kbd>{binding === action ? 'PRESS KEY…' : keyLabel(code)}</kbd></button>)}</div><button onClick={() => setSettings(s => ({ ...s, keys: { ...DEFAULT_KEYS } }))}>RESTORE DEFAULT KEYS</button><h2>LOCAL SAVE</h2><div className="save-actions"><button onClick={exportSave}>EXPORT WORLD</button><label className="file-button">IMPORT WORLD<input type="file" accept="application/json" aria-label="Import world save, replaces current world" onChange={importSave} /></label><button onClick={() => open('reset')}>NEW EXPEDITION</button></div></>}
      {panel === 'reset' && <><p>This replaces your current world, discovery records, and in-game SOL balance. Export your world first if you want to keep it. Your original expedition archive is preserved.</p><button onClick={exportSave}>EXPORT CURRENT WORLD</button><button className="danger" onClick={() => { game.current = createGame(); resetAutonomy(); camera.current = { x: 0, y: 0 }; inspect.current = 0; gesture.current = null; reveal(game.current); save(); closePanel() }}>RESET & START AGAIN</button><button onClick={closePanel}>CANCEL — KEEP MY MINE</button></>}
      {status && <p role="status">{status}</p>}<footer>NO DEADLINES. NO LEADERBOARDS. JUST THE NEXT BLOCK.</footer>
    </section></div>}
  </main>
}

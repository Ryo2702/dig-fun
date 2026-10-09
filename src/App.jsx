import { useEffect, useRef, useState } from 'react'
import useModalFocus from './hooks/useModalFocus'
import useMineSound from './hooks/useMineSound'
import { loadProgress } from './utils/storage'
import { createGame, restore, serialize, SAVE_KEY, DEFAULT_KEYS, DEFAULT_SETTINGS, TOOLS, ORE_COLORS, SURFACE, TILE, ZONES, zoneAt, step, reveal, switchTool, interact, scan, say, promptFor, unlocked, keyOf, playerTile, tile, turnDial } from './utils/world'
import { drawWorld } from './utils/renderWorld'

const keyLabel = code => code.replace('Key', '').replace('Digit', '').replace('Arrow', '').replace('Left', 'LEFT').replace('Right', 'RIGHT').replace('Space', 'SPACE').replace('Escape', 'ESC')
const shortTools = ['RUSTY', 'IRON', 'SILVER', 'GOLD', 'DIAMOND', 'LASER', 'SOL']
const artifactText = { component: 'A broken pickaxe head. Rebuilt into your first tool upgrade.', puzzle: 'Align the three marks to open the ancient lock.', clue: 'Follow the broken white seams. Reflections can lie.', cosmetic: 'The foreman’s green scarf. Now worn by your miner.', map: 'The old chambers repeat every 14 vertical tiles.', funny: 'A tiny frog whispered “one more block” and left.', hazard: 'An ancient dust trap. Survived, with every ore intact.', empty: 'An empty lunch box. Hope was the last thing inside.', reward: 'A forgotten cache containing three pieces of gold.' }
function initial() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return restore(JSON.parse(raw)) } catch { /* Storage can be unavailable; gameplay still works. */ }
  return { g: createGame(), settings: { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS }, reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches } }
}
function PixelIcon({ type = 'pick', color }) {
  return <span className={`pixel-icon icon-${type}`} style={color ? { '--icon-color': color } : undefined} aria-hidden="true"><i /><i /><i /></span>
}
export default function App() {
  const [loaded] = useState(initial), game = useRef(loaded.g), [settings, setSettings] = useState(loaded.settings)
  const [panel, setPanel] = useState(null), [binding, setBinding] = useState(null), [status, setStatus] = useState(''), [legacy] = useState(loadProgress)
  const [, refresh] = useState(0), canvas = useRef(null), view = useRef(null), input = useRef({}), camera = useRef({ x: 0, y: 0 }), inspect = useRef(0), gesture = useRef(null)
  const config = useRef(settings), panelRef = useRef(panel), savedError = useRef(false), runtime = useRef(null)
  config.current = settings; panelRef.current = panel
  const { play } = useMineSound(settings.music && !panel, settings.sound), playRef = useRef(play)
  playRef.current = play
  const closePanel = () => { setPanel(null); setBinding(null); input.current = {}; requestAnimationFrame(() => canvas.current?.focus()) }
  const focus = useModalFocus(!!panel, closePanel)
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(game.current, config.current))); savedError.current = false }
    catch { savedError.current = true }
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
    if (action === 'interact') { const next = interact(g); if (next) open(next); save() }
    refresh(n => n + 1)
  }
  useEffect(() => {
    reveal(game.current)
    const element = canvas.current, container = view.current
    let frame, last = performance.now(), lastUI = 0, lastSave = 0, scale = 3
    const resize = () => {
      scale = Math.max(1, Math.min(4, Math.floor(container.clientWidth / (container.clientWidth < 600 ? 160 : 400))))
      element.width = Math.floor(container.clientWidth / scale); element.height = Math.floor(container.clientHeight / scale)
      element.style.width = `${element.width * scale}px`; element.style.height = `${element.height * scale}px`
      runtime.current = { scale }
    }
    const observer = new ResizeObserver(resize); observer.observe(container); resize()
    const clear = () => { input.current = {}; gesture.current = null }
    const blur = () => { clear(); if (!panelRef.current) setPanel('pause'); save() }
    const visibility = () => { if (document.hidden) blur() }
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
      if (!panelRef.current && !document.hidden) {
        step(g, input.current, dt, config.current)
        if (g.sound) { playRef.current(g.sound); g.sound = null }
        if (g.vibrate) { if (config.current.vibration && navigator.vibrate) navigator.vibrate(12); g.vibrate = false }
      }
      drawWorld(element.getContext('2d'), g, camera.current, element.width, element.height, config.current, inspect.current)
      if (now - lastUI > 100) { refresh(n => n + 1); lastUI = now }
      if (now - lastSave > 1500) { save(); lastSave = now }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('pointerup', release); window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', visibility); container.addEventListener('wheel', preventWheel, { passive: false })
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('pointerup', release); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', visibility); container.removeEventListener('wheel', preventWheel); save() }
  }, [])
  useEffect(() => { if (panel) input.current = {} }, [panel])
  function point(e) {
    const rect = canvas.current.getBoundingClientRect(), scale = runtime.current.scale
    const target = { x: Math.floor(((e.clientX - rect.left) / scale + camera.current.drawX) / TILE), y: Math.floor(((e.clientY - rect.top) / scale + camera.current.drawY) / TILE) }
    if (game.current.seen[keyOf(target.x, target.y)]) { game.current.target = target; return true }
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
    return <button key={action} className={`touch-${action}`} aria-label={label} onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); if (hold) input.current[action] = true; else actions.current(action) }} onPointerUp={() => { input.current[action] = false }} onPointerCancel={() => { input.current[action] = false }} onLostPointerCapture={() => { input.current[action] = false }}>{symbol}<small>{label}</small></button>
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
  const g = game.current, depth = Math.max(0, (Math.floor(g.player.y + .9) - SURFACE) / 10), tool = TOOLS[g.tool], oreTotal = Object.values(g.inventory).reduce((a, b) => a + b, 0)
  return <main className={`game ${settings.touch ? 'show-touch' : ''}`}>
    <header className="game-header">
      <a className="wordmark" href="#game" onClick={e => { e.preventDefault(); canvas.current.focus() }} aria-label="DIG.FUN — focus game"><PixelIcon />DIG<span>.FUN</span><small>ONE MORE BLOCK.</small></a>
      <div className="header-center"><span className="live-pixel" /> LOCAL EXPEDITION <span className="muted">/</span> NO. 006</div>
      <nav aria-label="Game menus"><button onClick={() => open('journal')}><PixelIcon type="book" /><span>JOURNAL</span><kbd>{keyLabel(settings.keys.journal)}</kbd></button><button onClick={() => open('inventory')}><PixelIcon type="pouch" /><span>POUCH</span><b>{oreTotal.toString().padStart(2, '0')}</b></button><button onClick={() => open('pause')} aria-label="Pause and settings"><span className="pause-icon">Ⅱ</span></button></nav>
    </header>
    <div className="expedition-bar"><span><i /> {ZONES[zoneAt(g.player.y)]}</span><span>SECTOR {String(zoneAt(g.player.y) + 1).padStart(2, '0')} <span className="muted">/ 06</span></span></div>
    <section className="playfield" ref={view} id="game" aria-label="Mining expedition">
      <canvas ref={canvas} tabIndex={0} aria-label="Mining world. A D move, W S aim or climb, Space jump, X hold to mine, E interact. Rebind controls in Settings." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={() => { input.current.mine = false }} onContextMenu={e => e.preventDefault()} />
      <div className="depth-counter"><span>DEPTH / METERS</span><strong>{depth.toFixed(1).padStart(5, '0')}<small>M</small></strong><div><i /> DEEPEST <b>{g.deepest.toFixed(1)} M</b></div></div>
      <div className="field-coordinates"><span>FIELD NOTES</span><b>“Just one more block.”</b><small>X {Math.floor(g.player.x).toString().padStart(3, '0')} / Y {Math.floor(g.player.y).toString().padStart(3, '0')}</small></div>
      <div className="zone-marker"><span>{String(zoneAt(g.player.y) + 1).padStart(2, '0')}</span><i /> {depth === 0 ? 'SURFACE ENTRANCE' : 'EXPLORING THE SHAFT'} <small>↓ THE GOOD STUFF IS BELOW</small></div>
      <div className="interaction-prompt">{promptFor(g)}</div>
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
      <button className="pouch-summary" onClick={() => open('inventory')}><PixelIcon type="pouch" /><span>ORE POUCH<strong>{oreTotal.toString().padStart(3, '0')} <small>COLLECTED</small></strong></span></button>
    </footer>
    <div className="control-strip"><span><kbd>{keyLabel(settings.keys.left)}</kbd><kbd>{keyLabel(settings.keys.right)}</kbd> MOVE <i /> <kbd>{keyLabel(settings.keys.jump)}</kbd> JUMP <i /> <kbd>{keyLabel(settings.keys.mine)}</kbd> / HOLD CLICK TO MINE <i /> <kbd>{keyLabel(settings.keys.interact)}</kbd> INTERACT</span><span>{savedError.current ? 'SAVE UNAVAILABLE · EXPORT IN SETTINGS' : 'PROGRESS SAVED LOCALLY'} <i className="save-pixel" /></span></div>
    {panel && <div className="panel-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) closePanel() }}><section ref={focus} className="game-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header><div><small>EXPEDITION PAUSED / FIELD EQUIPMENT</small><h1 id="panel-title">{({ pause: 'TAKE A BREATHER.', settings: 'CONTROL ROOM', journal: 'FIELD NOTEBOOK', inventory: 'YOUR ORE POUCH', reset: 'START A NEW SHAFT?' })[panel]}</h1></div><button onClick={closePanel} aria-label="Close panel">×</button></header>
      {panel === 'pause' && <><p>The mine can wait. Your discoveries are safe.</p><div className="menu-buttons"><button className="primary" onClick={closePanel}>BACK TO THE MINE</button><button onClick={() => open('settings')}>SETTINGS & CONTROLS</button><button onClick={() => open('journal')}>ARTIFACT JOURNAL</button><button onClick={() => open('inventory')}>ORE INVENTORY</button></div><p className="fine-print">Tools unlock as you break blocks. A / D or arrows to move; W / S to aim vertically or climb. Hold X to mine without a mouse. The ladder is to your left.</p></>}
      {panel === 'inventory' && <><p>Only ore collected within reach enters your pouch.</p><div className="ore-list">{Object.entries(ORE_COLORS).map(([ore, color]) => <div key={ore}><PixelIcon type="ore" color={color} /><span>{ore === 'sol' ? 'SOL CRYSTAL' : `${ore.toUpperCase()} ORE`}</span><strong>×{g.inventory[ore] || 0}</strong></div>)}</div><p className="fine-print">SOL Crystals and all tools are fictional local game items.</p></>}
      {panel === 'journal' && <><p>{g.artifacts.length} objects recovered · {g.deepest.toFixed(1)} m deepest descent.</p>{!g.artifacts.length && <div className="empty-note"><PixelIcon type="book" /><h2>THE PAGES ARE STILL EMPTY.</h2><p>Find an engraved casing. Approach it and press {keyLabel(settings.keys.interact)}. There’s one at the right edge of the entrance.</p></div>}{g.artifacts.map(a => <article className="field-entry" key={a.id}><small>OBJECT {a.id} / {a.outcome.toUpperCase()}</small><p>{artifactText[a.outcome]}</p>{a.outcome === 'puzzle' && <><p>Inscription: “First the tool, then the sun, then the way down.”</p><div className="puzzle-dials">{(a.dials || [0, 0, 0]).map((dial, index) => <button key={index} disabled={a.solved} aria-label={`Rotate mark ${index + 1}, currently ${['Ladder', 'Pickaxe', 'Sun'][dial]}`} onClick={() => { turnDial(g, a, index); save(); refresh(n => n + 1) }}><span>{['H', 'T', '*'][dial]}</span>{['LADDER', 'PICKAXE', 'SUN'][dial]}</button>)}</div>{a.solved && <p role="status">SEAL DECODED · Ancient walls unlocked.</p>}<small>You can close this notebook and return later.</small></>}</article>)}{legacy.artifacts.length > 0 && <div className="field-entry"><h2>PREVIOUS EXPEDITION ARCHIVE</h2><p>{legacy.artifacts.length} artifacts from your original save are preserved.</p>{legacy.artifacts.map(a => <p key={a.id}>{a.id} · {a.discoveredAt.slice(0, 10)}</p>)}</div>}</>}
      {panel === 'settings' && <><h2>COMFORT & SOUND</h2><div className="settings-toggles">{[['sound','Mining sounds'],['music','Ambient music'],['shake','Screen shake'],['reduced','Reduced motion'],['contrast','High-contrast targeting'],['vibration','Touch vibration'],['touch','Always show touch controls']].map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))} />{label}</label>)}</div><h2>TOUCH CONTROL PLATES</h2>{[['opacity','Opacity',.25,1,.05],['inset','Horizontal inset',0,90,1],['bottom','Bottom inset',0,90,1]].map(([key,label,min,max,stepValue]) => <label className="range-setting" key={key}>{label}<input type="range" min={min} max={max} step={stepValue} value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))} /><output>{key === 'opacity' ? `${Math.round(settings[key] * 100)}%` : `${settings[key]}px`}</output></label>)}<h2>KEY BINDINGS</h2><p className="fine-print">Select a binding, then press a key. Escape cancels. Conflicts swap places. Escape always closes a panel.</p><div className="key-bindings">{Object.entries(settings.keys).map(([action, code]) => <button key={action} onClick={() => setBinding(action)} onKeyDown={e => { if (binding === action) bind(e, action) }} aria-label={`Rebind ${action}, currently ${keyLabel(code)}`}><span>{action}</span><kbd>{binding === action ? 'PRESS KEY…' : keyLabel(code)}</kbd></button>)}</div><button onClick={() => setSettings(s => ({ ...s, keys: { ...DEFAULT_KEYS } }))}>RESTORE DEFAULT KEYS</button><h2>LOCAL SAVE</h2><div className="save-actions"><button onClick={exportSave}>EXPORT WORLD</button><label className="file-button">IMPORT WORLD<input type="file" accept="application/json" aria-label="Import world save, replaces current world" onChange={importSave} /></label><button onClick={() => open('reset')}>NEW EXPEDITION</button></div></>}
      {panel === 'reset' && <><p>This replaces your current physical world and inventory. Export your world first if you want to keep it. Your original expedition archive is preserved.</p><button onClick={exportSave}>EXPORT CURRENT WORLD</button><button className="danger" onClick={() => { game.current = createGame(); reveal(game.current); save(); closePanel() }}>REPLACE WORLD & START AGAIN</button></>}
      {status && <p role="status">{status}</p>}<footer>NO DEADLINES. NO LEADERBOARDS. JUST THE NEXT BLOCK.</footer>
    </section></div>}
  </main>
}

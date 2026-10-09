import { emptySOL, normalizeSOL, awardSOL, rewardAmount, DEPTH_REWARDS } from './sol.js'
export const WIDTH = 80, HEIGHT = 180, SURFACE = 8, TILE = 16
export const SAVE_KEY = 'dig-fun-world-v2'
export const MATERIALS = {
  soil: { hits: 1, tier: 0 }, loose: { hits: 3, tier: 0 }, stone: { hits: 5, tier: 0 },
  hard: { hits: 9, tier: 1 }, copper: { hits: 6, tier: 0 }, silver: { hits: 10, tier: 1 },
  gold: { hits: 12, tier: 1 }, diamond: { hits: 18, tier: 4 }, sol: { hits: 20, tier: 6 },
  casing: { hits: 1, tier: 0 }, sealed: { hits: 8, tier: 1 }, bedrock: { hits: Infinity, tier: 99 },
}
export const TOOLS = [
  { name: 'Rusty Pickaxe', delay: .48, power: 1, tier: 0, unlock: 0, color: '#bb8b61' },
  { name: 'Reinforced Pickaxe', delay: .32, power: 2, tier: 1, unlock: 6, color: '#b7c5c7' },
  { name: 'Silver Drill', delay: .16, power: 2, tier: 2, unlock: 20, color: '#d4e3df', drill: true },
  { name: 'Golden Drill', delay: .12, power: 2, tier: 3, unlock: 45, color: '#ffd16b', drill: true, diagonal: true },
  { name: 'Diamond-Tip Drill', delay: .14, power: 3, tier: 4, unlock: 75, color: '#83f4ef', drill: true, diagonal: true },
  { name: 'Ancient Laser Cutter', delay: .3, power: 1, tier: 5, unlock: 110, color: '#e3a5ed', laser: true },
  { name: 'SOL-Powered Drill', delay: .12, power: 4, tier: 6, unlock: 140, color: '#a7ffad', drill: true, diagonal: true },
]
export const DEFAULT_KEYS = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space', interact: 'KeyE', previous: 'KeyQ', next: 'KeyR', scanner: 'KeyF', journal: 'KeyJ', inventory: 'KeyI', mine: 'KeyX', pause: 'Escape' }
export const DEFAULT_SETTINGS = { keys: DEFAULT_KEYS, sound: false, music: false, shake: true, reduced: false, contrast: false, vibration: false, touch: false, opacity: .85, inset: 16, bottom: 16 }
export const keyOf = (x, y) => `${x},${y}`
export const hash = (x, y) => ((Math.imul(x + 137, 374761393) ^ Math.imul(y + 43, 668265263)) >>> 0) % 10000
export const zoneAt = y => Math.min(5, Math.max(0, Math.floor((y - SURFACE) / 28)))
export const ZONES = ['THE OLD DIG SITE', 'WHISPERING CAVE', 'TEMPLE OF CONSENSUS', 'THE GREAT HOLDER', 'LIQUIDATION LAYER', 'THE BLOCK BELOW']
export const ORE_COLORS = { copper: '#d99365', silver: '#dcecf3', gold: '#ffcd65', diamond: '#79f3f2', sol: '#c492f4' }

export function baseTile(x, y) {
  if (x <= 0 || x >= WIDTH - 1 || y <= 0 || y >= HEIGHT - 1) return 'bedrock'
  if (x === 6 && y >= 4 && y < 30) return 'ladder'
  if (y < 8 && x >= 3 && x <= 18) return 'air'
  if (y === 7 && x === 19) return 'casing'
  if (y === 8 && x >= 10 && x <= 12) return 'soil'
  if (y === 10 && x >= 10 && x <= 12) return 'copper'
  if (y === 7 && x === 20) return 'diamond'
  if (y > 14 && y % 14 >= 10 && y % 14 <= 12 && x > 4 && x < 15 + (Math.floor(y / 14) % 3) * 8) {
    if (x === 12 && y % 14 === 12) return 'casing'
    if (x === 16 && y > 100 && y % 14 === 12) return 'lava'
    if (x === 9 && y % 14 === 12) return 'debris'
    return 'air'
  }
  const n = hash(Math.floor(x / 2), Math.floor(y / 2))
  if (y > 150 && n < 100) return 'sol'
  if (y > 100 && n < 210) return 'diamond'
  if (y > 65 && n < 380) return 'gold'
  if (y > 35 && n < 550) return 'silver'
  if (y > 9 && n < 800) return 'copper'
  if (y > 70 && x === 28 && y % 14 < 10) return 'sealed'
  if (y < 16) return hash(x, y) % 4 ? 'soil' : 'loose'
  return y > 65 ? 'hard' : hash(x, y) % 3 ? 'stone' : 'loose'
}
export function tile(g, x, y) { return g.removed[keyOf(x, y)] ? 'air' : baseTile(x, y) }
export const solid = type => !!MATERIALS[type] || type === 'debris'
export function createGame() {
  return { player: { x: 9.15, y: 7.05, vx: 0, vy: 0, facing: 1, state: 'idle', grounded: false }, removed: {}, damage: {}, drops: [], inventory: {}, sol: emptySOL(), solSession: 0, artifacts: [], deepest: 0, broken: 0, tool: 0, heat: 0, cooldown: 0, target: { x: 9, y: 8 }, seen: {}, particles: [], time: 0, lastHit: -1, notice: 'Start here: hold DIG DOWN to break the floor. A / D to explore.', noticeUntil: 7, scanner: 0, scannerReady: 0, recover: 0, reactUntil: 0, shake: 0, lastMove: 0, checkpoint: { x: 9.15, y: 7.05 } }
}
export function say(g, message) { if (g.notice !== message || g.noticeUntil < g.time) { g.notice = message; g.noticeUntil = g.time + 3.5 } }
export const playerTile = g => ({ x: Math.floor(g.player.x + .325), y: Math.floor(g.player.y + .45) })
export function unlocked(g, i) { return i >= 0 && i < TOOLS.length && g.broken >= TOOLS[i].unlock }
export function switchTool(g, direction) {
  for (let j = 1; j <= TOOLS.length; j++) { const i = (g.tool + direction * j + TOOLS.length * 2) % TOOLS.length; if (unlocked(g, i)) { g.tool = i; return } }
}
export function safeBelow(g, x, y) {
  for (let j = 1; j <= 4; j++) { const t = tile(g, x, y + j); if (t === 'lava') return false; if (solid(t) || t === 'ladder') return true }
  return false
}
export function targetInfo(g, target = g.target) {
  if (!target) return { reachable: false, reason: 'Choose a neighboring block.' }
  const p = playerTile(g), dx = target.x - p.x, dy = target.y - p.y, type = tile(g, target.x, target.y), tool = TOOLS[g.tool]
  const adjacent = Math.abs(dx) + Math.abs(dy) === 1 || (tool.diagonal && Math.abs(dx) === 1 && Math.abs(dy) === 1 && (!solid(tile(g, p.x + dx, p.y)) || !solid(tile(g, p.x, p.y + dy))))
  if (!adjacent) return { reachable: false, reason: 'Too far away. Move closer.', type }
  if (type === 'bedrock') return { reachable: true, locked: true, reason: 'Protected bedrock.', type }
  if (type === 'casing') return { reachable: true, locked: true, reason: 'Sealed artifact. Press Interact.', type }
  if (type === 'sealed' && !g.artifacts.some(a => a.solved)) return { reachable: true, locked: true, reason: 'Ancient wall: solve a field-notebook artifact first.', type }
  if (!MATERIALS[type]) return { reachable: true, locked: true, reason: 'No solid block selected.', type }
  if (tool.laser || MATERIALS[type].tier > tool.tier) return { reachable: true, locked: true, reason: tool.laser ? 'Laser cuts artifact casings only. Switch tools.' : 'Stronger tool needed. Break more ordinary blocks to upgrade.', type }
  if (dy > 0 && (!g.player.grounded || !safeBelow(g, target.x, target.y))) return { reachable: true, locked: true, reason: 'Unsafe below: long fall or lava. Dig another route.', type }
  return { reachable: true, locked: false, type, dx, dy }
}
function collides(g, x, y) {
  return [[x, y], [x + .64, y], [x, y + .89], [x + .64, y + .89]].some(([a, b]) => solid(tile(g, Math.floor(a), Math.floor(b))))
}
function burst(g, x, y, color, count = 7) {
  for (let i = 0; i < count; i++) g.particles.push({ x: x + .5, y: y + .5, vx: (i % 5 - 2) * 1.7, vy: -1 - i % 3, life: .3 + i * .025, color })
}
export function turnDial(g, artifact, index) {
  if (artifact.outcome !== 'puzzle' || artifact.solved || !Number.isInteger(index) || index < 0 || index > 2) return
  artifact.dials ||= [0, 0, 0]
  artifact.dials[index] = (artifact.dials[index] + 1) % 3
  artifact.solved = artifact.dials.every((value, i) => value === [1, 2, 0][i])
  if (artifact.solved) { awardSOL(g, `puzzle:${artifact.id}`, rewardAmount('puzzle', artifact.id), 'ANCIENT SEAL'); g.sound = 'discovery' }
}
export function interact(g) {
  const p = playerTile(g)
  if (g.recover > 0) { say(g, 'Recovering. Your pouch is safe.'); return }
  const near = [{ x: p.x, y: p.y }, { x: p.x + g.player.facing, y: p.y }, { x: p.x - g.player.facing, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }]
  const casing = near.find(a => tile(g, a.x, a.y) === 'casing')
  if (casing) {
    const id = keyOf(casing.x, casing.y), index = Math.floor(casing.y / 14), outcome = ['component', 'puzzle', 'clue', 'cosmetic', 'map', 'funny', 'hazard', 'empty', 'reward'][index % 9]
    if (index >= 7 && !TOOLS[g.tool].laser) { say(g, 'Ancient casing: equip the Laser Cutter, then Interact.'); return }
    g.removed[id] = true
    g.artifacts.push({ id, outcome, solved: false, turns: 0, dials: [0, 0, 0] })
    if (outcome === 'component') { g.broken = Math.max(g.broken, 6); say(g, 'Tool component recovered. Reinforced Pickaxe unlocked!') }
    else if (outcome === 'reward') awardSOL(g, `artifact:${id}`, rewardAmount('artifact', id), 'RARE ARTIFACT')
    else if (outcome === 'hazard') { g.recover = 1; g.player.state = 'damage'; g.shake = .3; say(g, 'Dust trap! Pouch and progress are safe.') }
    else say(g, ({ puzzle: 'A three-mark lock. Saved unfinished in your Artifact Journal.', clue: 'Field note: follow the broken white seams.', cosmetic: 'Recovered: the foreman’s green scarf.', map: 'Map fragment: old chambers repeat every 14 layers.', funny: 'A tiny frog says: “one more block.” Then leaves.', empty: 'An empty lunch box. Someone was here first.' })[outcome])
    if (outcome === 'funny') g.frog = { x: casing.x, y: casing.y, until: g.time + 4 }
    if (TOOLS[g.tool].laser) g.beam = { x: casing.x, y: casing.y, until: g.time + .35 }
    g.player.state = 'carrying'; g.reactUntil = g.time + 1.1; g.sound = 'discovery'
    if (outcome === 'puzzle') return 'journal'
    return
  }
  if (tile(g, p.x, p.y) === 'ladder') { say(g, 'Ladder: hold Up or Down to climb.'); return }
  if (g.target) { say(g, targetInfo(g).reason || 'Hold Mine to break the selected block.'); return }
  say(g, 'Nothing to interact with nearby.')
}
export function promptFor(g) {
  const p = playerTile(g)
  if (g.recover > 0) return 'RECOVERING · YOUR POUCH IS SAFE'
  if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, y]) => tile(g, p.x + x, p.y + y) === 'casing')) return 'INTERACT · SEALED ARTIFACT'
  if (tile(g, p.x, p.y) === 'ladder') return 'UP / DOWN · CLIMB LADDER'
  if (g.target) { const info = targetInfo(g); return info.reason || 'HOLD MINE · ' + (ORE_COLORS[info.type] ? 'REFLECTIVE STONE' : info.type.toUpperCase()) }
  return 'EXPLORE · ONE MORE BLOCK'
}
export function scan(g) {
  if (g.time < g.scannerReady) { say(g, 'Scanner recharging.'); return }
  g.scanner = 2.5; g.scannerReady = g.time + 8; say(g, 'Scanner: faint seams, not promises. Move close to inspect.'); g.sound = 'secret'
}
export function step(g, input, dt, settings = DEFAULT_SETTINGS) {
  const mining = input.mine || input.digDown
  dt = Math.min(dt, .035); g.time += dt
  const p = g.player, pos = playerTile(g), tool = TOOLS[g.tool]
  g.scanner = Math.max(0, g.scanner - dt); g.recover = Math.max(0, g.recover - dt); g.shake = Math.max(0, g.shake - dt)
  g.cooldown = Math.max(0, g.cooldown - dt); g.heat = Math.max(0, g.heat - dt * (g.cooldown ? 32 : 14))
  const ladder = tile(g, pos.x, pos.y) === 'ladder' || tile(g, pos.x, pos.y + 1) === 'ladder'
  const wasGrounded = p.grounded, oldVx = p.vx
  p.grounded = collides(g, p.x, p.y + .035)
  let direction = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (g.recover || mining) direction = 0
  p.vx = direction * 3.5
  if (direction) {
    const nx = p.x + p.vx * dt
    if (!collides(g, nx, p.y)) p.x = nx
    else if (p.grounded && !collides(g, nx, p.y - 1) && !collides(g, p.x, p.y - 1)) { p.y -= 1; p.x = nx }
    else {
      const bx = Math.floor(nx + (direction > 0 ? .64 : 0)), by = Math.floor(p.y + .6)
      if (tile(g, bx, by) === 'debris' && !solid(tile(g, bx + direction, by)) && solid(tile(g, bx + direction, by + 1))) { g.removed[keyOf(bx, by)] = true; burst(g, bx + direction, by, '#887961'); p.state = 'pushing'; g.reactUntil = g.time + .3 }
    }
    if (p.facing !== direction) { p.state = 'turning'; g.reactUntil = g.time + .12 }
    else if (!oldVx) { p.state = 'starting'; g.reactUntil = g.time + .08 }
    p.facing = direction; g.lastMove = g.time
  } else if (oldVx) { p.state = 'stopping'; g.reactUntil = g.time + .1 }
  if ((input.jump || input.jumpPressed) && !g.jumpHeld && (p.grounded || ladder) && !g.recover) { p.vy = -7; p.grounded = false; g.fallStart = p.y }
  g.jumpHeld = !!input.jump; input.jumpPressed = false
  if (ladder && (input.up || input.down) && !g.recover) { p.vy = (input.down ? 2.6 : -2.6); p.state = 'climbing' }
  else if (ladder && !input.jump && p.vy >= 0) p.vy = 0
  else p.vy = Math.min(10, p.vy + 18 * dt)
  const ny = p.y + p.vy * dt
  if (!collides(g, p.x, ny)) p.y = ny
  else {
    if (p.vy > 0) {
      p.y = Math.floor(ny + .89) - .9; p.grounded = true
      if (!wasGrounded && p.vy > 8 && g.fallStart != null && p.y - g.fallStart > 4) { g.recover = 1.1; say(g, 'Hard landing. Catch your breath — progress is safe.') }
      else if (!wasGrounded) { p.state = 'landing'; g.reactUntil = g.time + .13 }
      g.fallStart = null
    }
    p.vy = 0
  }
  if (!p.grounded && !ladder && g.fallStart == null) g.fallStart = p.y
  if (g.recover) p.state = 'damage'
  else if (g.reactUntil < g.time) p.state = ladder && (input.up || input.down) ? 'climbing' : p.vy < -.1 ? 'jumping' : p.vy > .8 ? 'falling' : direction ? 'walking' : input.down ? 'crouching' : g.time - g.lastMove > 15 ? 'tired' : 'idle'
  if (input.down && !ladder && !mining) g.target = { x: playerTile(g).x, y: playerTile(g).y + 1 }
  if (input.up && !ladder && !mining) g.target = { x: playerTile(g).x, y: playerTile(g).y - 1 }
  if (input.digDown) g.target = { x: playerTile(g).x, y: playerTile(g).y + 1 }
  if (mining && !g.target) g.target = { x: pos.x + p.facing, y: pos.y }
  if (mining && !g.recover && (!input.digDown || p.grounded)) {
    const info = targetInfo(g)
    if (!info.reachable || info.locked) say(g, info.reason)
    else if (g.cooldown) { p.state = 'tired'; say(g, 'OVERHEATED · cooling down. Release Mine.'); }
    else if (g.time - g.lastHit >= tool.delay) {
      const facing = Math.sign(g.target.x - playerTile(g).x) || p.facing
      if (facing !== p.facing) { p.facing = facing; p.state = 'turning'; g.lastHit = g.time - tool.delay + .13; g.reactUntil = g.time + .13 }
      else {
        // Plant both feet over the selected tile before digging down at a tile seam.
        if (info.dy === 1 && info.dx === 0 && !collides(g, g.target.x + .175, p.y)) p.x = g.target.x + .175
        const { x, y } = g.target, id = keyOf(x, y), critical = (g.broken + Math.round(g.time * 10)) % (g.tool ? 7 : 17) === 0
        p.state = info.dy > 0 ? 'dig-down' : info.dy < 0 ? 'dig-up' : 'dig-side'; g.reactUntil = g.time + tool.delay
        g.damage[id] = (g.damage[id] || 0) + tool.power + (critical ? 1 : 0); g.lastHit = g.time; g.lastMove = g.time
        g.impact = { x, y, until: g.time + .1, critical }; g.sound = info.type === 'soil' ? 'debris' : ORE_COLORS[info.type] ? 'metal' : 'impact'; g.vibrate = true; g.shake = .055
        if (!settings.reduced) burst(g, x, y, tool.color, critical ? 12 : 6)
        if (tool.drill) { g.heat += 7; if (g.heat >= 100) { g.heat = 100; g.cooldown = 3; say(g, 'OVERHEATED · motor cooling for 3 seconds.'); burst(g, pos.x, pos.y, '#9f9d96') } }
        if (g.damage[id] >= MATERIALS[info.type].hits) {
          g.removed[id] = true; delete g.damage[id]; g.broken++
          if (ORE_COLORS[info.type]) { g.drops.push({ x, y, type: info.type, amount: info.type === 'gold' ? 2 : 1, born: g.time }); say(g, info.type.toUpperCase() + ' exposed. Step close to collect.'); g.sound = 'discovery' }
          if (TOOLS.some(t => t.unlock === g.broken)) say(g, 'New tool unlocked! Open your tool belt or press Next Tool.')
          if (y > 45 && hash(x, y) % 23 === 0) { g.escapeUntil = g.time + 1.8; g.collapse = { x, y }; say(g, 'UNSTABLE CEILING · move away!') }
        }
      }
    }
  }
  if (g.escapeUntil && g.time > g.escapeUntil) { if (Math.hypot(p.x - g.collapse.x, p.y - g.collapse.y) < 2) g.recover = 1; g.shake = .3; burst(g, g.collapse.x, g.collapse.y, '#ad8e69', 16); g.escapeUntil = 0 }
  const foot = tile(g, Math.floor(p.x + .325), Math.floor(p.y + .8))
  if (foot === 'lava') { p.x = g.checkpoint.x; p.y = g.checkpoint.y; p.vy = 0; g.recover = 1.4; say(g, 'Lava! Returned to solid ground. All discoveries kept.'); g.sound = 'explosion' }
  if (p.grounded && foot !== 'lava') g.checkpoint = { x: p.x, y: p.y }
  const depth = Math.max(0, (Math.floor(p.y + .9) - SURFACE) / 10); g.deepest = Math.max(g.deepest, depth)
  for (const [milestone, reward] of Object.entries(DEPTH_REWARDS)) if (depth >= Number(milestone)) awardSOL(g, `depth:${milestone}`, reward, `${milestone} M DEPTH MILESTONE`)
  const location = playerTile(g), chamber = Math.floor(location.y / 14)
  if (location.y > 14 && location.y % 14 >= 10 && location.y % 14 <= 12 && location.x > 4 && location.x < 15 + chamber % 3 * 8 && baseTile(location.x, location.y) === 'air') awardSOL(g, `chamber:${chamber}`, rewardAmount('chamber', String(chamber)), 'SECRET CHAMBER')
  g.drops = g.drops.filter(drop => {
    if (Math.hypot(drop.x + .5 - (p.x + .325), drop.y + .5 - (p.y + .45)) > 1.35 || g.time - drop.born < .4) return true
    g.inventory[drop.type] = (g.inventory[drop.type] || 0) + drop.amount
    const deposit = keyOf(drop.x, drop.y)
    awardSOL(g, `ore:${deposit}`, rewardAmount(drop.type, deposit), drop.type === 'sol' ? 'SOL CRYSTAL' : `${drop.type.toUpperCase()} DEPOSIT`)
    p.state = 'celebrating'; g.reactUntil = g.time + .7; g.sound = drop.type === 'sol' ? 'crystal' : 'discovery'; if (drop.type === 'sol') g.shake = .6
    return false
  })
  for (const particle of g.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 12 * dt; particle.life -= dt }
  g.particles = g.particles.filter(a => a.life > 0)
  reveal(g)
}
export function reveal(g) {
  const p = playerTile(g), signature = `${p.x},${p.y},${g.broken},${g.artifacts.length}`
  if (g.revealedAt === signature) return
  g.revealedAt = signature
  const queue = [p], visited = new Set([keyOf(p.x, p.y)])
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]; g.seen[keyOf(cell.x, cell.y)] = true
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cell.x + dx, y = cell.y + dy, id = keyOf(x, y)
      if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT || visited.has(id) || Math.hypot(x - p.x, y - p.y) > 10) continue
      visited.add(id); g.seen[id] = true
      if (!solid(tile(g, x, y))) queue.push({ x, y })
    }
  }
}
export function serialize(g, settings) {
  return { version: 2, player: { x: g.player.x, y: g.player.y }, removed: g.removed, damage: g.damage, drops: g.drops.map(d => ({ ...d, born: -.5 })), inventory: g.inventory, sol: g.sol, artifacts: g.artifacts, deepest: g.deepest, broken: g.broken, tool: g.tool, seen: g.seen, settings }
}
const validCell = id => typeof id === 'string' && /^\d{1,2},\d{1,3}$/.test(id) && Number(id.split(',')[0]) > 0 && Number(id.split(',')[0]) < WIDTH - 1 && Number(id.split(',')[1]) > 0 && Number(id.split(',')[1]) < HEIGHT - 1
const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
export function restore(value) {
  const g = createGame(), settings = { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } }
  if (!value || value.version !== 2) return { g, settings }
  for (const name of ['removed', 'seen', 'damage']) for (const [id, v] of Object.entries(value[name] || {}).slice(0, WIDTH * HEIGHT)) if (validCell(id) && (name === 'damage' ? finite(v, 0, 100) : v === true)) g[name][id] = v
  if (finite(value.player?.x, 1, WIDTH - 2) && finite(value.player?.y, 1, HEIGHT - 2) && !collides(g, value.player.x, value.player.y)) { g.player.x = value.player.x; g.player.y = value.player.y }
  g.sol = normalizeSOL(value.sol)
  g.checkpoint = { x: g.player.x, y: g.player.y }
  for (const ore of Object.keys(ORE_COLORS)) if (finite(value.inventory?.[ore], 0, 1000000)) g.inventory[ore] = Math.floor(value.inventory[ore])
  g.broken = finite(value.broken, 0, WIDTH * HEIGHT) ? Math.floor(value.broken) : 0
  g.deepest = finite(value.deepest, 0, HEIGHT / 10) ? value.deepest : 0
  g.tool = Number.isInteger(value.tool) && unlocked(g, value.tool) ? value.tool : 0
  g.drops = Array.isArray(value.drops) ? value.drops.filter(d => d && finite(d.x, 1, WIDTH - 2) && finite(d.y, 1, HEIGHT - 2) && Object.hasOwn(ORE_COLORS, d.type) && finite(d.amount, 1, 3)).slice(0, WIDTH * HEIGHT).map(d => ({ ...d, born: -.5 })) : []
  g.artifacts = Array.isArray(value.artifacts) ? value.artifacts.filter(a => a && validCell(a.id) && ['component', 'puzzle', 'clue', 'cosmetic', 'map', 'funny', 'hazard', 'empty', 'reward'].includes(a.outcome)).slice(0, 100).map(a => ({ id: a.id, outcome: a.outcome, solved: a.solved === true, turns: finite(a.turns, 0, 3) ? Math.floor(a.turns) : 0, dials: Array.isArray(a.dials) && a.dials.length === 3 && a.dials.every(n => Number.isInteger(n) && n >= 0 && n <= 2) ? a.dials : [0, 0, 0] })) : []
  for (const name of ['sound', 'music', 'shake', 'reduced', 'contrast', 'vibration', 'touch']) if (typeof value.settings?.[name] === 'boolean') settings[name] = value.settings[name]
  for (const [name, range] of Object.entries({ opacity: [.25, 1], inset: [0, 90], bottom: [0, 90] })) if (finite(value.settings?.[name], ...range)) settings[name] = value.settings[name]
  const used = new Set()
  for (const action of Object.keys(DEFAULT_KEYS)) { const code = value.settings?.keys?.[action]; if (typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Escape|Enter|ShiftLeft|ControlLeft)$/.test(code) && !used.has(code)) { settings.keys[action] = code; used.add(code) } }
  if (new Set(Object.values(settings.keys)).size !== Object.keys(DEFAULT_KEYS).length) settings.keys = { ...DEFAULT_KEYS }
  reveal(g); return { g, settings }
}

import { awardSOL, rewardAmount } from './sol.js'
import { hash, keyOf, playerTile, solid, tile, WIDTH, HEIGHT } from './world.js'

export const AUTONOMY_KEY = 'dig-fun-autonomy-v1'
export const MAX_OFFLINE_SECONDS = 90 * 60

export const AUTO_STRATEGIES = {
  'go-deep': { label: 'GO DEEP', title: 'FASTEST ROUTE DOWN', icon: '↓' },
  'find-value': { label: 'FIND VALUE', title: 'HIGHEST VALUE ORE', icon: '◆' },
  'follow-sparkles': { label: 'FOLLOW SPARKLES', title: 'SUSPICIOUS SIGNAL', icon: '✦' },
  'find-puzzles': { label: 'FIND PUZZLES', title: 'SEALED CHAMBERS', icon: '◈' },
  'safe-mode': { label: 'SAFE MODE', title: 'HAZARDS AVOIDED', icon: '▣' },
  'chaos-mode': { label: 'CHAOS MODE', title: 'UNPREDICTABLE ROUTE', icon: '✹' },
}

const EVENTS = ['Gold Rush', 'Crystal Echo', 'Cave-In', 'Magma Rise', 'Mystery Signal', 'Puzzle Storm', 'Drill Frenzy', 'Lights Out', 'Mimic Hour', 'Unknown Transmission']
const PROFILE_SEED = [
  { id: 'dan', name: 'Drillbit Dan', role: 'TREASURE HUNTER', personality: 'follows shining ore clues', color: '#f2b84b', tool: 'Copper drill', x: 14, y: 7.05, speed: 1.15 },
  { id: 'sol', name: 'SOL Digger', role: 'SOL SEEKER', personality: 'hunts impossible crystals', color: '#bf8dff', tool: 'Prism drill', x: 17, y: 7.05, speed: .92 },
  { id: 'pete', name: 'Pickaxe Pete', role: 'DEEP DIGGER', personality: 'prioritizes depth over loot', color: '#d5d8c0', tool: 'Silver cutter', x: 12, y: 10.05, speed: 1.08 },
  { id: 'hands', name: 'Diamond Hands', role: 'CAREFUL MINER', personality: 'avoids lava and bad vibes', color: '#65e3ec', tool: 'Diamond laser', x: 14, y: 10.05, speed: .82 },
  { id: 'chad', name: 'Cave Chad', role: 'CHAOS MINER', personality: 'believes every wall is a bomb', color: '#ff7763', tool: 'Impact bomb', x: 16, y: 7.05, speed: 1.22 },
  { id: 'breaker', name: 'Block Breaker', role: 'PUZZLE HUNTER', personality: 'reads suspicious masonry', color: '#79d59c', tool: 'Rune pick', x: 18, y: 7.05, speed: .8 },
  { id: 'dusty', name: 'Dusty Wallet', role: 'COLLECTOR', personality: 'keeps a very specific list', color: '#e6a36c', tool: 'Rusty shovel', x: 11, y: 11.05, speed: .88 },
  { id: 'satoshi', name: 'Satoshi Shovels', role: 'DEEP DIGGER', personality: 'has not looked up in hours', color: '#9fb2d8', tool: 'Experimental SOL drill', x: 13, y: 11.05, speed: .98 },
]

const SPEECH = {
  'TREASURE HUNTER': ['Following a gold sparkle…', 'Diamond signal nearby.', 'This wall is glowing politely.'],
  'SOL SEEKER': ['Scanning for prismatic dust.', 'SOL signal? Be normal.', 'Purple-green shimmer detected.'],
  'DEEP DIGGER': ['Going down is a strategy.', 'Depth over everything.', 'The floor looks promising.'],
  'CAREFUL MINER': ['This tunnel feels suspicious.', 'Checking the lava math.', 'Safety first. Loot second.'],
  'CHAOS MINER': ['Absolutely safe explosion incoming.', 'I have a plan. Probably.', 'Stand back, science.'],
  'PUZZLE HUNTER': ['Scanning for hollow blocks.', 'Puzzle chamber detected.', 'Comparing suspicious runes…'],
  COLLECTOR: ['Missing one shiny thing.', 'Checking the collection list.', 'That looks collectible.'],
}

const VALUE = { soil: 1, loose: 1, stone: 2, hard: 3, copper: 5, silver: 12, gold: 25, diamond: 60, sol: 120, casing: 80, sealed: 45, lava: -40, debris: 0 }
const HITS = { soil: 1, loose: 2, stone: 3, hard: 4, copper: 3, silver: 4, gold: 5, diamond: 7, sol: 8, casing: 1, sealed: 5 }

const finite = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
const integer = (value, fallback, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : fallback
const choice = (list, index) => list[index % list.length]

function nextRandom(state) {
  state.seed = (Math.imul(state.seed || 1, 1664525) + 1013904223) >>> 0
  return state.seed / 4294967296
}

function makeMiner(profile, index) {
  return {
    ...profile,
    index,
    facing: index % 3 === 0 ? -1 : 1,
    state: 'idle',
    speech: choice(SPEECH[profile.role] || SPEECH.COLLECTOR, index),
    speechUntil: 5 + index,
    status: 'Scanning for clues.',
    goal: 'Scanning nearby tiles.',
    target: null,
    targetType: null,
    mineProgress: 0,
    think: index * .4,
    blocks: 0,
    deepest: 0,
    puzzles: 0,
    explosions: 0,
    lavaIncidents: 0,
    emptyChests: 0,
    streak: 0,
    haul: { copper: 0, silver: 0, gold: 0, diamond: 0, sol: 0 },
    lastDiscovery: null,
  }
}

export function createAutonomy(now = Date.now()) {
  return {
    version: 1,
    seed: 184467,
    time: 0,
    lastActive: now,
    tickerIndex: 0,
    tickerClock: 0,
    ticker: 'Drillbit Dan is scanning the abandoned entrance.',
    feed: [
      'The mine is awake. Eight simulated crews are already moving.',
      'Diamond Hands has marked the lava route as “probably fine.”',
      'SOL Digger is searching for a crystal nobody has seen yet.',
    ],
    major: null,
    event: null,
    nextEvent: 18,
    mute: false,
    crewIntroduced: false,
    auto: { enabled: true, strategy: 'follow-sparkles', target: null, suggestion: null, status: 'Inspecting the surrounding blocks.', decision: 'Inspecting the surrounding blocks.', distance: 0, confidence: 73 },
    puzzle: null,
    records: {},
    offline: null,
    miners: PROFILE_SEED.map(makeMiner),
  }
}

export function restoreAutonomy(value, now = Date.now()) {
  const fresh = createAutonomy(now)
  if (!value || value.version !== 1) return fresh
  fresh.seed = integer(value.seed, fresh.seed, 1, 0xffffffff)
  fresh.time = finite(value.time, 0, 0, 10_000_000)
  fresh.lastActive = finite(value.lastActive, now, 0, now + 86_400_000)
  fresh.tickerIndex = integer(value.tickerIndex, 0, 0, 9999)
  fresh.tickerClock = finite(value.tickerClock, 0, 0, 60)
  fresh.ticker = typeof value.ticker === 'string' ? value.ticker.slice(0, 140) : fresh.ticker
  fresh.feed = Array.isArray(value.feed) ? value.feed.filter(item => typeof item === 'string').slice(0, 30) : fresh.feed
  fresh.mute = value.mute === true
  fresh.crewIntroduced = value.crewIntroduced === true
  if (value.auto && typeof value.auto === 'object') {
    fresh.auto.strategy = Object.hasOwn(AUTO_STRATEGIES, value.auto.strategy) ? value.auto.strategy : fresh.auto.strategy
    fresh.auto.enabled = true
    fresh.auto.decision = typeof value.auto.decision === 'string' ? value.auto.decision.slice(0, 80) : fresh.auto.decision
    fresh.auto.status = typeof value.auto.status === 'string' ? value.auto.status.slice(0, 48) : fresh.auto.status
    fresh.auto.confidence = integer(value.auto.confidence, 73, 0, 100)
  }
  fresh.miners = fresh.miners.map((miner) => {
    const saved = Array.isArray(value.miners) ? value.miners.find(item => item?.id === miner.id) : null
    if (!saved) return miner
    return {
      ...miner,
      x: finite(saved.x, miner.x, 1, WIDTH - 2),
      y: finite(saved.y, miner.y, 2, HEIGHT - 2),
      facing: saved.facing < 0 ? -1 : 1,
      state: typeof saved.state === 'string' ? saved.state.slice(0, 16) : miner.state,
      speech: typeof saved.speech === 'string' ? saved.speech.slice(0, 80) : miner.speech,
      goal: typeof saved.goal === 'string' ? saved.goal.slice(0, 80) : miner.goal,
      blocks: integer(saved.blocks, 0, 0, 1_000_000),
      deepest: finite(saved.deepest, 0, 0, HEIGHT),
      puzzles: integer(saved.puzzles, 0, 0, 100_000),
      explosions: integer(saved.explosions, 0, 0, 100_000),
      lavaIncidents: integer(saved.lavaIncidents, 0, 0, 100_000),
      emptyChests: integer(saved.emptyChests, 0, 0, 100_000),
      streak: integer(saved.streak, 0, 0, 100_000),
      haul: Object.fromEntries(Object.keys(miner.haul).map(type => [type, integer(saved.haul?.[type], 0, 0, 1_000_000)])),
    }
  })
  return fresh
}

export function serializeAutonomy(state) {
  return {
    version: 1,
    seed: state.seed,
    time: state.time,
    lastActive: state.lastActive,
    tickerIndex: state.tickerIndex,
    tickerClock: state.tickerClock,
    ticker: state.ticker,
    feed: state.feed.slice(0, 30),
    mute: state.mute,
    crewIntroduced: state.crewIntroduced,
    auto: { enabled: true, strategy: state.auto.strategy, status: state.auto.status, decision: state.auto.decision, confidence: state.auto.confidence },
    miners: state.miners.map(miner => ({ id: miner.id, x: miner.x, y: miner.y, facing: miner.facing, state: miner.state, speech: miner.speech, goal: miner.goal, blocks: miner.blocks, deepest: miner.deepest, puzzles: miner.puzzles, explosions: miner.explosions, lavaIncidents: miner.lavaIncidents, emptyChests: miner.emptyChests, streak: miner.streak, haul: miner.haul })),
  }
}

function announce(state, message, major = null) {
  state.feed.unshift(message)
  state.feed = state.feed.slice(0, 30)
  state.ticker = message
  state.tickerClock = 0
  if (major) state.major = { ...major, id: String(state.time) + ':' + message }
}

function speak(miner, message, state, duration = 4) {
  miner.speech = message
  miner.speechUntil = state.time + duration
}

function clearTarget(miner) {
  miner.target = null
  miner.targetType = null
  miner.mineProgress = 0
}

function setAutoStatus(auto, status) {
  auto.status = status
  auto.decision = status
}

function clueDetected(g, x, y, p) {
  const distance = Math.hypot(x - p.x, y - p.y)
  if (distance > 4.5) return false
  const n = hash(x, y)
  return g.scanner > 0 || (g.time + n / 500) % 9 < .2 || n % 13 === 0
}

function candidateScore(type, x, y, miner, state, g, p) {
  const distance = Math.hypot(x - miner.x, y - miner.y)
  const depth = y - miner.y
  const nearbyLava = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => tile(g, a, b) === 'lava')
  let score = -distance * 2 + (clueDetected(g, x, y, p) ? (VALUE[type] || 0) * 2 : type === 'stone' || type === 'hard' ? 0 : -VALUE[type] * 1.5)
  if (miner.role === 'DEEP DIGGER') score += depth * 9
  if (miner.role === 'TREASURE HUNTER') score += ['gold', 'diamond', 'copper'].includes(type) ? 38 : 0
  if (miner.role === 'SOL SEEKER') score += type === 'sol' ? 160 : type === 'diamond' ? 60 : 0
  if (miner.role === 'CAREFUL MINER') score += nearbyLava ? -150 : type === 'lava' ? -250 : 15
  if (miner.role === 'CHAOS MINER') score += (hash(x, y) + state.seed) % 17
  if (miner.role === 'PUZZLE HUNTER') score += ['casing', 'sealed'].includes(type) ? 120 : 0
  if (miner.role === 'COLLECTOR') score += miner.haul[type] === 0 ? 32 : 0
  if (type === 'lava') score -= 300
  return score
}

function chooseTarget(state, g, miner) {
  const origin = { x: Math.floor(miner.x), y: Math.floor(miner.y) }
  let best = null
  for (let y = Math.max(2, origin.y - 3); y <= Math.min(HEIGHT - 2, origin.y + 4); y++) for (let x = Math.max(1, origin.x - 6); x <= Math.min(WIDTH - 2, origin.x + 6); x++) {
    const type = tile(g, x, y)
    if (!solid(type) || ['bedrock', 'debris'].includes(type)) continue
    const distance = Math.abs(x - origin.x) + Math.abs(y - origin.y)
    if (!distance || distance > 8) continue
    const score = candidateScore(type, x, y, miner, state, g, miner)
    if (!best || score > best.score) best = { x, y, type, score }
  }
  if (!best) return null
  miner.target = { x: best.x, y: best.y }
  miner.targetType = best.type
  miner.mineProgress = 0
  miner.goal = best.type === 'casing' || best.type === 'sealed' ? 'Inspecting a sealed chamber.' : best.type === 'sol' ? 'Chasing a SOL crystal.' : 'Investigating ' + best.type + ' signal.'
  miner.status = best.type === 'casing' || best.type === 'sealed' ? 'Entering chamber' : best.type === 'sol' ? 'Following a SOL signal' : best.type === 'diamond' ? 'Following a diamond signal' : 'Walking to target'
  if (best.type === 'gold' || best.type === 'diamond' || best.type === 'sol') speak(miner, choice(SPEECH[miner.role] || SPEECH.COLLECTOR, Math.floor(state.time + miner.index)), state)
  return best
}

function isOpen(g, x, y) {
  const type = tile(g, Math.floor(x), Math.floor(y))
  return !solid(type) || type === 'ladder'
}

function moveMiner(state, g, miner, dt) {
  if (!miner.target) return
  const target = miner.target
  const dx = target.x - miner.x
  const dy = target.y - miner.y
  const speed = miner.speed * (state.event?.name === 'Drill Frenzy' ? 1.8 : 1)
  if (Math.abs(dx) > 1.05) {
    const direction = Math.sign(dx)
    const next = miner.x + direction * speed * dt
    if (isOpen(g, next + (direction > 0 ? .45 : -.1), miner.y + .45)) {
      miner.x = next
      miner.facing = direction
      miner.state = 'walking'
      miner.status = 'Walking to target'
      return
    }
    clearTarget(miner)
    speak(miner, miner.role === 'CAREFUL MINER' ? 'Route blocked. Rerouting safely.' : 'Wall says no. Finding another route.', state)
    return
  }
  if (Math.abs(dy) > 1.05) {
    const direction = Math.sign(dy)
    const next = miner.y + direction * speed * dt
    if (isOpen(g, miner.x + .35, next + .45)) {
      miner.y = next
      miner.state = 'climbing'
      miner.status = 'Searching for a deeper route'
      return
    }
    clearTarget(miner)
    return
  }
  miner.state = 'mining'
  miner.status = type === 'casing' || type === 'sealed' ? 'Entering chamber' : type === 'lava' ? 'Avoiding lava' : 'Mining stone'
}

function discovery(state, g, miner, type) {
  const label = type === 'sol' ? 'SOL crystal' : type + ' cache'
  miner.haul[type] = (miner.haul[type] || 0) + (type === 'gold' ? 2 : 1)
  miner.blocks++
  miner.streak++
  miner.lastDiscovery = { type, at: state.time }
  g.removed[keyOf(miner.target.x, miner.target.y)] = true
  if (type === 'diamond' || type === 'sol') announce(state, miner.name + ' found a ' + label + ' at ' + Math.round(miner.y * 10) + 'm.', { title: 'RAREST DISCOVERY', subtitle: (type === 'sol' ? 'Prismatic SOL crystal' : 'Diamond cache') + ' · found by ' + miner.name, color: type === 'sol' ? '#c88cff' : '#73ecf0', minerId: miner.id })
  else if (type === 'gold') announce(state, miner.name + ' cracked ' + miner.haul.gold + ' gold at ' + Math.round(miner.y * 10) + 'm.')
  else if (state.tickerClock > 3) announce(state, miner.name + ' collected ' + miner.haul[type] + ' ' + type + '.')
  miner.status = 'Collecting ' + type
  speak(miner, type === 'sol' ? 'I found the impossible rock.' : type.toUpperCase() + ' exposed. Keep digging.', state, 5)
}

export function startPuzzle(state, g, minerId = 'player', artifactId = null) {
  if (state.puzzle && !state.puzzle.done) return false
  const miner = state.miners.find(item => item.id === minerId)
  const difficulty = 6 + (hash(Math.floor((miner?.x || g.player.x) * 10), Math.floor((miner?.y || g.player.y) * 10)) % 7)
  state.puzzle = {
    id: minerId + '-' + Math.floor(state.time),
    minerId,
    artifactId,
    title: 'THE UNBLINKING DOOR',
    kind: 'rune-pairs',
    progress: 0,
    duration: difficulty,
    mode: 'auto',
    clue: null,
    message: 'Reading ancient symbols',
    done: false,
    result: null,
  }
  if (miner) {
    miner.goal = 'Solving the sealed chamber.'
    miner.status = 'Solving puzzle'
    speak(miner, 'Puzzle chamber detected.', state, 6)
  } else {
    state.auto.status = 'Solving puzzle'
    state.auto.decision = state.auto.status
  }
  announce(state, (miner?.name || 'YOU') + ' entered a puzzle chamber.')
  return true
}

function workMiner(state, g, miner, dt) {
  const type = miner.targetType || (miner.target && tile(g, miner.target.x, miner.target.y))
  if (!miner.target || !type || !solid(type)) {
    clearTarget(miner)
    return
  }
  miner.mineProgress += dt * (1 + miner.speed * .45)
  miner.state = 'mining'
  if (type === 'casing' || type === 'sealed') {
    if (miner.mineProgress > 1.6 && !state.puzzle) {
      startPuzzle(state, g, miner.id)
      clearTarget(miner)
    }
    return
  }
  if (type === 'lava') {
    miner.lavaIncidents++
    speak(miner, 'Running from lava.', state, 4)
    clearTarget(miner)
    return
  }
  if (miner.mineProgress >= (HITS[type] || 3) * .45) {
    if (miner.role === 'CHAOS MINER' && nextRandom(state) > .72) {
      const blast = 6 + Math.floor(nextRandom(state) * 18)
      miner.explosions += blast
      miner.blocks += Math.max(1, Math.floor(blast / 3))
      miner.streak++
      g.shake = Math.max(g.shake || 0, .45)
      announce(state, miner.name + ' detonated ' + blast + ' blocks. The tunnel is “better” now.', { title: 'BIGGEST EXPLOSION', subtitle: blast + ' blocks destroyed by ' + miner.name, color: '#ffad5c', minerId: miner.id })
      speak(miner, 'Absolutely safe explosion incoming.', state, 5)
      g.removed[keyOf(miner.target.x, miner.target.y)] = true
    } else discovery(state, g, miner, type)
    clearTarget(miner)
  }
}

function updatePuzzle(state, g, dt) {
  if (!state.puzzle) return
  if (state.puzzle.done) {
    if (state.time - (state.puzzle.doneAt || state.time) > 2.8) state.puzzle = null
    return
  }
  const miner = state.miners.find(item => item.id === state.puzzle.minerId)
  const rate = 100 / Math.max(4, Math.min(12, state.puzzle.duration || 8)) * (1 + (miner?.puzzles || 0) * .03)
  state.puzzle.progress = Math.min(100, state.puzzle.progress + dt * rate)
  const step = Math.floor(state.puzzle.progress / 25)
  const messages = ['Reading ancient symbols', 'Testing the mechanism', 'Matching crystal signals', 'Trying another sequence']
  state.puzzle.message = messages[Math.min(3, step)]
  if (miner) {
    miner.status = state.puzzle.message
    if (Math.floor(state.time) % 3 === 0) speak(miner, step > 1 ? 'Recalculating.' : 'Trying the obvious answer.', state, 1.5)
  } else {
    state.auto.status = state.puzzle.message
    state.auto.decision = state.auto.status
  }
  if (state.puzzle.progress >= 100) finishPuzzle(state, g, 'auto')
}

export function finishPuzzle(state, g, mode = 'manual') {
  if (!state.puzzle || state.puzzle.done) return false
  const miner = state.miners.find(item => item.id === state.puzzle.minerId)
  if (mode === 'assist') {
    state.puzzle.clue = 'The brightest rune is lying. Start with the dim one.'
    state.puzzle.progress = Math.max(state.puzzle.progress, 35)
    state.puzzle.mode = 'auto'
    return true
  }
  if (mode === 'auto' && state.puzzle.mode !== 'auto') {
    state.puzzle.mode = 'auto'
    state.puzzle.clue = 'Miner pacing enabled. Testing switches over time.'
    return true
  }
  state.puzzle.done = true
  state.puzzle.doneAt = state.time
  state.puzzle.progress = 100
  state.puzzle.result = mode === 'manual' ? 'Rare ore cache · crew confidence +1' : 'Map fragment · puzzle skill increased'
  if (miner) {
    miner.puzzles++
    miner.streak++
    speak(miner, 'Puzzle solution found.', state, 6)
    miner.status = 'Opening artifact'
  } else {
    const artifact = state.puzzle.artifactId && g.artifacts.find(item => item.id === state.puzzle.artifactId)
    if (artifact && !artifact.solved) {
      artifact.solved = true
      awardSOL(g, `puzzle:${artifact.id}`, rewardAmount('puzzle', artifact.id), 'ANCIENT SEAL')
    }
    state.auto.status = 'Opening artifact'
    state.auto.decision = state.auto.status
  }
  announce(state, (miner?.name || 'YOU') + ' solved THE UNBLINKING DOOR.', { title: miner ? 'FIRST CREW ARTIFACT' : 'PUZZLE SOLVED', subtitle: miner ? 'The Unblinking Coin · local discovery' : 'Ancient seal opened · local discovery', color: '#d9bd67', minerId: miner?.id || 'player' })
  g.shake = Math.max(g.shake || 0, .28)
  return true
}

function updateEvent(state, dt) {
  if (state.event) {
    state.event.remaining -= dt
    if (state.event.phase === 'countdown' && state.event.remaining <= 0) {
      state.event = { name: state.event.name, phase: 'active', remaining: 22 }
      announce(state, state.event.name.toUpperCase() + ' is live. The crew is moving.', { title: state.event.name.toUpperCase(), subtitle: 'Local mine event · prepare for weirdness', color: '#f4c75c' })
    } else if (state.event.phase === 'active' && state.event.remaining <= 0) {
      state.event = null
      state.nextEvent = 42 + Math.floor(nextRandom(state) * 26)
    }
    return
  }
  state.nextEvent -= dt
  if (state.nextEvent <= 10) state.event = { name: choice(EVENTS, Math.floor(nextRandom(state) * EVENTS.length)), phase: 'countdown', remaining: 10 }
}

export function tickCrew(state, g, dt) {
  if (!state || !g || !Number.isFinite(dt) || dt <= 0) return state
  state.time += Math.min(dt, .1)
  state.tickerClock += dt
  if (!state.crewIntroduced && g.broken > 0) {
    state.crewIntroduced = true
    announce(state, 'The first block cracked. Rival crews are entering the shaft.')
  }
  updateEvent(state, dt)
  updatePuzzle(state, g, dt)
  for (const miner of state.miners) {
    if (state.puzzle?.minerId === miner.id && !state.puzzle.done) {
      miner.state = 'inspecting'
      continue
    }
    miner.think -= dt
    miner.deepest = Math.max(miner.deepest, Math.max(0, (miner.y - 8) * 10))
    if (state.time > miner.speechUntil && miner.think <= 0) {
      speak(miner, choice(SPEECH[miner.role] || SPEECH.COLLECTOR, Math.floor(state.time + miner.index)), state)
      miner.think = 4 + nextRandom(state) * 4
    }
    if (!miner.target && miner.think <= 0) chooseTarget(state, g, miner)
    if (miner.target) {
      if (Math.abs(miner.target.x - miner.x) <= 1.05 && Math.abs(miner.target.y - miner.y) <= 1.05) workMiner(state, g, miner, dt)
      else moveMiner(state, g, miner, dt)
    }
  }
  if (state.tickerClock > 6) {
    const active = state.miners[Math.floor(nextRandom(state) * state.miners.length)]
    state.ticker = active.name + ' ' + active.goal.toLowerCase()
    state.tickerIndex++
    state.tickerClock = 0
  }
  return state
}

function valueFor(miner) {
  return Object.entries(miner.haul).reduce((sum, [type, amount]) => sum + amount * (VALUE[type] || 0), 0)
}

export function computeRecords(state, g) {
  const player = {
    name: 'YOU',
    deepest: g.deepest,
    blocks: g.broken,
    value: valueFor({ haul: g.inventory }),
    puzzles: g.artifacts.filter(a => a.outcome === 'puzzle' && a.solved).length,
    explosions: 0,
    lavaIncidents: 0,
    streak: g.broken,
    emptyChests: g.artifacts.filter(a => a.outcome === 'empty').length,
  }
  const all = [...state.miners.map(miner => ({ name: miner.name, deepest: miner.deepest, blocks: miner.blocks, value: valueFor(miner), puzzles: miner.puzzles, explosions: miner.explosions, lavaIncidents: miner.lavaIncidents, streak: miner.streak, emptyChests: miner.emptyChests })), player]
  const max = field => all.reduce((best, item) => item[field] > best[field] ? item : best, all[0])
  state.records = {
    deepest: max('deepest'),
    blocks: max('blocks'),
    value: max('value'),
    puzzles: max('puzzles'),
    explosions: max('explosions'),
    streak: max('streak'),
    lavaIncidents: max('lavaIncidents'),
    emptyChests: max('emptyChests'),
  }
  return state.records
}

function routeToBlock(g, start, target) {
  const queue = [{ x: start.x, y: start.y, path: [] }]
  const visited = new Set([keyOf(start.x, start.y)])
  while (queue.length) {
    const current = queue.shift()
    if (Math.abs(current.x - target.x) + Math.abs(current.y - target.y) === 1) return [...current.path, { x: current.x, y: current.y }]
    if (current.path.length >= 12) continue
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx, y = current.y + dy, id = keyOf(x, y)
      if (x < 1 || y < 1 || x >= WIDTH - 1 || y >= HEIGHT - 1 || visited.has(id) || solid(tile(g, x, y))) continue
      visited.add(id)
      queue.push({ x, y, path: [...current.path, { x: current.x, y: current.y }] })
    }
  }
  return null
}

function targetLabel(type, clue) {
  if (type === 'sol') return clue ? 'Following a SOL signal' : 'Searching for ore'
  if (type === 'diamond') return clue ? 'Following a diamond signal' : 'Searching for ore'
  if (type === 'gold') return clue ? 'Following a gold signal' : 'Searching for ore'
  if (type === 'silver') return clue ? 'Following a silver signal' : 'Searching for ore'
  if (type === 'copper') return clue ? 'Following a copper signal' : 'Searching for ore'
  if (type === 'casing' || type === 'sealed') return 'Entering chamber'
  return 'Searching for a deeper route'
}

function pickAutoTarget(g, auto) {
  const p = playerTile(g)
  if (g.broken === 0) {
    const first = { x: p.x, y: p.y + 1, type: tile(g, p.x, p.y + 1), score: 1000, distance: 1, clue: false }
    if (solid(first.type) && g.seen[keyOf(first.x, first.y)]) {
      auto.target = { x: first.x, y: first.y }
      auto.distance = 1
      auto.confidence = 96
      setAutoStatus(auto, 'Mining stone')
      return first
    }
  }
  const candidates = []
  for (let y = Math.max(2, p.y - 3); y <= Math.min(HEIGHT - 2, p.y + 7); y++) for (let x = Math.max(1, p.x - 7); x <= Math.min(WIDTH - 2, p.x + 7); x++) {
    const type = tile(g, x, y)
    if (!solid(type) || ['bedrock', 'debris'].includes(type) || !g.seen[keyOf(x, y)]) continue
    if (type === 'sealed' && !g.artifacts.some(artifact => artifact.solved)) continue
    const route = routeToBlock(g, p, { x, y })
    if (!route) continue
    const distance = route.length + Math.abs(x - p.x) + Math.abs(y - p.y) * .25
    const clue = clueDetected(g, x, y, p) || type === 'casing' || type === 'sealed'
    const nearbyLava = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => tile(g, a, b) === 'lava')
    const rarePriority = { sol: 1000, diamond: 850, casing: 740, sealed: 650, gold: 520, silver: 330, copper: 180 }[type] || 0
    let score = -distance * 8 + (y - p.y) * 2
    if (rarePriority && clue) score += rarePriority
    if (rarePriority && !clue) score -= rarePriority * .65
    if (type === 'stone' || type === 'hard' || type === 'soil' || type === 'loose') score += y * 3
    if (nearbyLava) score -= 700
    const suggestion = auto.suggestion
    if (suggestion && g.time <= suggestion.until && Math.hypot(x - suggestion.x, y - suggestion.y) <= 2.5 && !nearbyLava) score += 280
    candidates.push({ x, y, type, score, distance, clue })
  }
  candidates.sort((a, b) => b.score - a.score)
  const next = candidates[0] || { x: p.x, y: p.y + 1, type: tile(g, p.x, p.y + 1), score: 0, distance: 1, clue: false }
  auto.target = { x: next.x, y: next.y }
  auto.distance = Math.max(0, Math.round(next.distance))
  auto.confidence = Math.max(42, Math.min(96, 64 + Math.round(Math.abs(next.score) % 28)))
  setAutoStatus(auto, targetLabel(next.type, next.clue))
  if (auto.suggestion && g.time > auto.suggestion.until) auto.suggestion = null
  return next
}

export function autoDecision(g, auto, dt = 0) {
  auto.enabled = true
  const p = playerTile(g)
  const current = auto.target
  if (!current || !solid(tile(g, current.x, current.y)) || Math.abs(current.x - p.x) + Math.abs(current.y - p.y) > 12 || !g.seen[keyOf(current.x, current.y)]) pickAutoTarget(g, auto)
  const target = auto.target
  if (!target) {
    setAutoStatus(auto, 'Searching for ore')
    return { input: {}, target: null, interact: false, decision: auto.status, distance: 0, confidence: 0 }
  }
  const type = tile(g, target.x, target.y), dx = target.x - p.x, dy = target.y - p.y
  const distance = Math.abs(dx) + Math.abs(dy)
  const input = {}
  let interact = false
  const route = routeToBlock(g, p, target)
  const next = route?.[1] || route?.[0]
  if (type === 'casing' && distance <= 1) {
    interact = true
    setAutoStatus(auto, 'Entering chamber')
  } else if (distance <= 1) {
    input[dy > 0 && dx === 0 ? 'digDown' : 'mine'] = true
    setAutoStatus(auto, targetLabel(type, clueDetected(g, target.x, target.y, p)) === 'Searching for a deeper route' ? 'Mining stone' : 'Investigating sparkle')
  } else if (next && next.x !== p.x) {
    input[next.x > p.x ? 'right' : 'left'] = true
    setAutoStatus(auto, 'Walking to target')
  } else if (next && next.y > p.y) {
    input.down = true
    setAutoStatus(auto, 'Searching for a deeper route')
  } else if (next && next.y < p.y) {
    const onLadder = tile(g, p.x, p.y) === 'ladder' || tile(g, p.x, p.y + 1) === 'ladder'
    if (onLadder) input.up = true
    else if (g.player.grounded) { input.jump = true; input.jumpPressed = true }
    setAutoStatus(auto, onLadder ? 'Walking to target' : 'Searching for a deeper route')
  } else if (dy > 0 && dx === 0) {
    input.digDown = true
    setAutoStatus(auto, 'Mining stone')
  } else {
    input[dx > 0 ? 'right' : 'left'] = true
    setAutoStatus(auto, 'Walking to target')
  }
  auto.distance = distance
  auto.decision = auto.status
  return { input, target, interact, decision: auto.status, distance, confidence: auto.confidence }
}

export function applyOfflineProgress(state, g, now = Date.now()) {
  const elapsed = Math.max(0, (now - state.lastActive) / 1000)
  state.lastActive = now
  if (elapsed < 45) return null
  const seconds = Math.min(MAX_OFFLINE_SECONDS, elapsed)
  const blocks = Math.min(80, Math.max(1, Math.floor(seconds / 15)))
  const copper = Math.floor(blocks * .36)
  const silver = Math.floor(blocks * .09)
  const keys = Math.floor(blocks / 28)
  const meters = Number((blocks * .19).toFixed(1))
  if (g) {
    g.broken += blocks
    g.deepest = Math.max(g.deepest, meters)
    g.inventory.copper = (g.inventory.copper || 0) + copper
    g.inventory.silver = (g.inventory.silver || 0) + silver
  }
  const summary = { seconds, blocks, copper, silver, keys, meters }
  state.offline = summary
  state.feed.unshift('Offline shift complete: ' + blocks + ' blocks broken while you were away.')
  state.feed = state.feed.slice(0, 30)
  state.ticker = 'YOUR MINER KEPT DIGGING.'
  return summary
}

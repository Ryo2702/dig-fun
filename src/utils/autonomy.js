import { awardSOL, rewardAmount } from './sol.js'
import { hash, keyOf, playerTile, solid, tile, WIDTH, HEIGHT } from './world.js'
import { activityConfig, createDemoPurchase, formatPurchase, minerTraits, purchaseTier, shortenAddress, PURCHASE_TIERS } from './activity.js'

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
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const NAV_LIMIT = 320
const PATH_LIMIT = 28
const RARE_TYPES = new Set(['diamond', 'sol', 'casing', 'sealed'])

const finite = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
const integer = (value, fallback, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : fallback
const choice = (list, index) => list[index % list.length]

function nextRandom(state) {
  state.seed = (Math.imul(state.seed || 1, 1664525) + 1013904223) >>> 0
  return state.seed / 4294967296
}

function developerDebug() {
  if (typeof window === 'undefined') return false
  try { return new URLSearchParams(window.location.search).has('debug') || window.localStorage.getItem('dig-fun-debug') === '1' } catch { return false }
}

function makeMiner(profile, index) {
  return {
    ...profile,
    kind: profile.kind || 'npc',
    wallet: profile.wallet || '',
    address: profile.address || profile.wallet || '',
    purchaseCount: profile.purchaseCount || 0,
    purchaseVolume: profile.purchaseVolume || 0,
    verifiedVolume: profile.verifiedVolume || 0,
    joinedAt: profile.joinedAt || 0,
    purchaseTier: profile.purchaseTier || 'small',
    appearance: profile.appearance || minerTraits(profile.wallet || profile.id),
    boostUntil: 0,
    spawnUntil: 0,
    celebrateUntil: 0,
    lastActive: 0,
    backgroundClock: 0,
    rarest: null,
    power: profile.power || 1,
    baseSpeed: profile.speed,
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
    renderX: profile.x,
    renderY: profile.y,
    move: null,
    breakTarget: null,
    escapeTarget: null,
    routeVersion: -1,
    routeFailures: 0,
    noProgress: 0,
    recovery: 0,
    lastPathFailure: '',
    reservationKey: null,
    avoid: {},
    initialized: false,
    carryingRare: false,
    carryingUntil: 0,
    recentTiles: [],
    stateClock: 0,
    lastState: 'idle',
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
  const source = activityConfig()
  return {
    version: 2,
    seed: 184467,
    time: 0,
    lastActive: now,
    tickerIndex: 0,
    tickerClock: 0,
    ticker: 'Drillbit Dan is scanning the abandoned entrance.',
    noticeCurrent: null,
    noticeQueue: [],
    feed: [
      'The mine is awake. Eight simulated crews are already moving.',
      'Diamond Hands has marked the lava route as “probably fine.”',
      'SOL Digger is searching for a crystal nobody has seen yet.',
    ],
    major: null,
    event: null,
    nextEvent: 18,
    mute: false,
    crewIntroduced: true,
    followId: 'dan',
    openingFollowUntil: 4.5,
    auto: { enabled: true, strategy: 'follow-sparkles', target: null, suggestion: null, status: 'Inspecting the surrounding blocks.', decision: 'Inspecting the surrounding blocks.', distance: 0, confidence: 73 },
    puzzle: null,
    navVersion: 0,
    lastWorldBroken: 0,
    reservations: [],
    debug: developerDebug(),
    records: {},
    offline: null,
    community: { blocks: 0, depth: 0, buys: 0, verifiedBuys: 0, simulatedBuys: 0, ore: { copper: 0, silver: 0, gold: 0, diamond: 0, sol: 0 }, artifacts: 0, puzzles: 0, explosions: 0, cooperation: 0 },
    activity: { source, mode: source.mode, liveAvailable: source.mode === 'live', error: '', lastChecked: 0, nextDemo: 7, demoIndex: 0, seenSignatures: [], transactions: [], join: null },
    miners: PROFILE_SEED.map(makeMiner),
  }
}

export function restoreAutonomy(value, now = Date.now()) {
  const fresh = createAutonomy(now)
  if (!value || ![1, 2].includes(value.version)) return fresh
  fresh.seed = integer(value.seed, fresh.seed, 1, 0xffffffff)
  fresh.time = finite(value.time, 0, 0, 10_000_000)
  fresh.lastActive = finite(value.lastActive, now, 0, now + 86_400_000)
  fresh.tickerIndex = integer(value.tickerIndex, 0, 0, 9999)
  fresh.tickerClock = finite(value.tickerClock, 0, 0, 60)
  fresh.ticker = typeof value.ticker === 'string' ? value.ticker.slice(0, 140) : fresh.ticker
  fresh.noticeCurrent = value.noticeCurrent && typeof value.noticeCurrent.message === 'string' ? { message: value.noticeCurrent.message.slice(0, 140), expires: finite(value.noticeCurrent.expires, fresh.time + 4, fresh.time, fresh.time + 60) } : null
  fresh.noticeQueue = Array.isArray(value.noticeQueue) ? value.noticeQueue.filter(item => item && typeof item.message === 'string').slice(0, 20).map(item => ({ message: item.message.slice(0, 140), expires: finite(item.expires, fresh.time + 4, fresh.time, fresh.time + 60) })) : []
  fresh.feed = Array.isArray(value.feed) ? value.feed.filter(item => typeof item === 'string').slice(0, 30) : fresh.feed
  fresh.mute = value.mute === true
  fresh.crewIntroduced = value.crewIntroduced !== false
  fresh.followId = typeof value.followId === 'string' ? value.followId.slice(0, 100) : null
  fresh.openingFollowUntil = 0
  fresh.navVersion = integer(value.navVersion, 0, 0, 10_000_000)
  fresh.lastWorldBroken = integer(value.lastWorldBroken, 0, 0, 10_000_000)
  if (value.auto && typeof value.auto === 'object') {
    fresh.auto.strategy = Object.hasOwn(AUTO_STRATEGIES, value.auto.strategy) ? value.auto.strategy : fresh.auto.strategy
    fresh.auto.enabled = true
    fresh.auto.decision = typeof value.auto.decision === 'string' ? value.auto.decision.slice(0, 80) : fresh.auto.decision
    fresh.auto.status = typeof value.auto.status === 'string' ? value.auto.status.slice(0, 48) : fresh.auto.status
    fresh.auto.confidence = integer(value.auto.confidence, 73, 0, 100)
  }
  if (value.community && typeof value.community === 'object') {
    fresh.community = {
      ...fresh.community,
      blocks: integer(value.community.blocks, 0, 0, 10_000_000),
      depth: finite(value.community.depth, 0, 0, HEIGHT * 10),
      buys: integer(value.community.buys, 0, 0, 1_000_000),
      verifiedBuys: integer(value.community.verifiedBuys, 0, 0, 1_000_000),
      simulatedBuys: integer(value.community.simulatedBuys, 0, 0, 1_000_000),
      artifacts: integer(value.community.artifacts, 0, 0, 1_000_000),
      puzzles: integer(value.community.puzzles, 0, 0, 1_000_000),
      explosions: integer(value.community.explosions, 0, 0, 1_000_000),
      cooperation: integer(value.community.cooperation, 0, 0, 1_000_000),
      ore: Object.fromEntries(Object.keys(fresh.community.ore).map(type => [type, integer(value.community.ore?.[type], 0, 0, 10_000_000)])),
    }
  }
  if (value.activity && typeof value.activity === 'object') {
    fresh.activity.mode = value.activity.mode === 'live' && fresh.activity.source.liveConfigured ? 'live' : 'demo'
    fresh.activity.liveAvailable = value.activity.liveAvailable === true && fresh.activity.mode === 'live'
    fresh.activity.error = typeof value.activity.error === 'string' ? value.activity.error.slice(0, 120) : ''
    fresh.activity.lastChecked = finite(value.activity.lastChecked, 0, 0, now)
    fresh.activity.nextDemo = finite(value.activity.nextDemo, 7, 0, 100000)
    fresh.activity.demoIndex = integer(value.activity.demoIndex, 0, 0, 1_000_000)
    fresh.activity.seenSignatures = Array.isArray(value.activity.seenSignatures) ? value.activity.seenSignatures.filter(item => typeof item === 'string').slice(-200) : []
    fresh.activity.transactions = Array.isArray(value.activity.transactions) ? value.activity.transactions.filter(item => item && typeof item.id === 'string').slice(0, 30) : []
  }
  const savedMiners = Array.isArray(value.miners) ? value.miners : []
  fresh.miners = fresh.miners.map((miner) => {
    const saved = savedMiners.find(item => item?.id === miner.id)
    if (!saved) return miner
    return {
      ...miner,
      x: finite(saved.x, miner.x, 1, WIDTH - 2),
      y: finite(saved.y, miner.y, 2, HEIGHT - 2),
      renderX: finite(saved.x, miner.x, 1, WIDTH - 2),
      renderY: finite(saved.y, miner.y, 2, HEIGHT - 2),
      move: null,
      breakTarget: null,
      escapeTarget: null,
      route: null,
      routeVersion: -1,
      reservationKey: null,
      initialized: false,
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
      kind: miner.kind,
      wallet: miner.wallet,
      address: miner.address,
      purchaseCount: integer(saved.purchaseCount, miner.purchaseCount, 0, 1_000_000),
      purchaseVolume: finite(saved.purchaseVolume, miner.purchaseVolume, 0, 1_000_000_000),
      verifiedVolume: finite(saved.verifiedVolume, miner.verifiedVolume, 0, 1_000_000_000),
      joinedAt: finite(saved.joinedAt, miner.joinedAt, 0, 10_000_000),
      purchaseTier: typeof saved.purchaseTier === 'string' ? saved.purchaseTier.slice(0, 20) : miner.purchaseTier,
      appearance: saved.appearance && typeof saved.appearance === 'object' ? { ...miner.appearance, ...saved.appearance } : miner.appearance,
      rarest: typeof saved.rarest === 'string' ? saved.rarest.slice(0, 30) : miner.rarest,
      power: finite(saved.power, miner.power, 1, 10),
      baseSpeed: finite(saved.baseSpeed, miner.baseSpeed, .1, 10),
      celebrateUntil: finite(saved.celebrateUntil, 0, 0, 10_000_000),
    }
  })
  for (const saved of savedMiners.filter(item => item?.kind === 'buyer').slice(0, 300)) {
    if (!saved.id || fresh.miners.some(miner => miner.id === saved.id)) continue
    const profile = {
      id: saved.id,
      name: typeof saved.name === 'string' ? saved.name.slice(0, 30) : shortenAddress(saved.wallet),
      role: typeof saved.role === 'string' ? saved.role.slice(0, 24) : 'COMMUNITY MINER',
      personality: typeof saved.personality === 'string' ? saved.personality.slice(0, 70) : 'digs with the community',
      color: typeof saved.color === 'string' ? saved.color : '#d0a57b',
      tool: typeof saved.tool === 'string' ? saved.tool.slice(0, 30) : 'Rusty pickaxe',
      x: finite(saved.x, 8, 1, WIDTH - 2), y: finite(saved.y, 7.05, 2, HEIGHT - 2), speed: finite(saved.baseSpeed || saved.speed, 1, .1, 10),
      wallet: typeof saved.wallet === 'string' ? saved.wallet.slice(0, 80) : '', address: typeof saved.address === 'string' ? saved.address.slice(0, 80) : '',
      kind: 'buyer', purchaseCount: integer(saved.purchaseCount, 1, 0, 1_000_000), purchaseVolume: finite(saved.purchaseVolume, 0, 0, 1_000_000_000), verifiedVolume: finite(saved.verifiedVolume, 0, 0, 1_000_000_000), joinedAt: finite(saved.joinedAt, 0, 0, 10_000_000), purchaseTier: typeof saved.purchaseTier === 'string' ? saved.purchaseTier.slice(0, 20) : 'small', appearance: saved.appearance, power: finite(saved.power, 1, 1, 10),
    }
    const miner = makeMiner(profile, fresh.miners.length)
    Object.assign(miner, saved, { kind: 'buyer', index: fresh.miners.length, appearance: profile.appearance || miner.appearance })
    miner.renderX = miner.x
    miner.renderY = miner.y
    miner.move = null
    miner.breakTarget = null
    miner.escapeTarget = null
    miner.route = null
    miner.routeVersion = -1
    miner.reservationKey = null
    miner.initialized = false
    fresh.miners.push(miner)
  }
  return fresh
}

export function serializeAutonomy(state) {
  return {
    version: 2,
    seed: state.seed,
    time: state.time,
    lastActive: state.lastActive,
    tickerIndex: state.tickerIndex,
    tickerClock: state.tickerClock,
    ticker: state.ticker,
    noticeCurrent: state.noticeCurrent,
    noticeQueue: state.noticeQueue.slice(0, 20),
    feed: state.feed.slice(0, 30),
    mute: state.mute,
    crewIntroduced: state.crewIntroduced,
    followId: state.followId,
    navVersion: state.navVersion,
    lastWorldBroken: state.lastWorldBroken,
    auto: { enabled: true, strategy: state.auto.strategy, status: state.auto.status, decision: state.auto.decision, confidence: state.auto.confidence },
    community: state.community,
    activity: { ...state.activity, source: state.activity.source, join: null },
    miners: state.miners.slice(0, 308).map(miner => ({ id: miner.id, name: miner.name, kind: miner.kind, wallet: miner.wallet, address: miner.address, role: miner.role, personality: miner.personality, color: miner.color, tool: miner.tool, x: miner.x, y: miner.y, facing: miner.facing, state: miner.state, speech: miner.speech, goal: miner.goal, blocks: miner.blocks, deepest: miner.deepest, puzzles: miner.puzzles, explosions: miner.explosions, lavaIncidents: miner.lavaIncidents, emptyChests: miner.emptyChests, streak: miner.streak, haul: miner.haul, purchaseCount: miner.purchaseCount, purchaseVolume: miner.purchaseVolume, verifiedVolume: miner.verifiedVolume, joinedAt: miner.joinedAt, purchaseTier: miner.purchaseTier, appearance: miner.appearance, rarest: miner.rarest, power: miner.power, baseSpeed: miner.baseSpeed, celebrateUntil: miner.celebrateUntil })),
  }
}

function announce(state, message, major = null) {
  state.feed.unshift(message)
  state.feed = state.feed.slice(0, 30)
  const group = message.match(/\b(copper|silver|gold)\b/i)?.[1]?.toLowerCase()
  const merge = item => {
    const itemGroup = item?.message?.match(/\b(copper|silver|gold)\b/i)?.[1]?.toLowerCase()
    return group && itemGroup === group
  }
  const current = { message, expires: state.time + 4 }
  const existing = merge(state.noticeCurrent) ? state.noticeCurrent : state.noticeQueue.find(merge)
  if (existing) {
    existing.message = `${(existing.count || 1) + 1} miners discovered ${group} nearby.`
    existing.count = (existing.count || 1) + 1
    existing.expires = state.time + 4
    if (existing === state.noticeCurrent) state.ticker = existing.message
  } else if (!state.noticeCurrent) {
    state.noticeCurrent = current
    state.ticker = message
    state.tickerClock = 0
  } else state.noticeQueue.push(current)
  if (major) state.major = { ...major, id: String(state.time) + ':' + message, expires: state.time + 6 }
}

const BUYER_ROLES = ['TREASURE HUNTER', 'DEEP DIGGER', 'CAREFUL MINER', 'CHAOS MINER', 'PUZZLE HUNTER', 'COLLECTOR', 'SOL SEEKER']
const BUYER_PERSONALITIES = ['follows useful signals', 'likes safe routes', 'tests every switch', 'collects suspicious things', 'wants the deepest tunnel', 'never ignores a sparkle', 'digs with the community']
const RARE_ORDER = ['copper', 'silver', 'gold', 'diamond', 'sol']

function tierRank(id) {
  return Math.max(0, PURCHASE_TIERS.findIndex(tier => tier.id === id))
}

function activityLabel(event) {
  return event.verified ? 'LIVE ON-CHAIN ACTIVITY · RPC VERIFIED' : 'SIMULATED MINE ACTIVITY'
}

function communityBurst(g, tier) {
  const level = tierRank(tier.id)
  const count = level >= 4 ? 30 : level >= 3 ? 20 : level >= 2 ? 12 : 7
  g.shake = Math.min(.68, Math.max(g.shake || 0, .14 + level * .12))
  g.communityBurst = { x: 7.8, y: 7, level, until: g.time + 1.4 }
  g.particles ||= []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    g.particles.push({ x: 7.8, y: 7, vx: Math.cos(angle) * (1 + level * .35), vy: -1.5 - Math.abs(Math.sin(angle)) * 2, life: .35 + (i % 5) * .06, color: i % 3 === 0 ? '#f4d47f' : i % 3 === 1 ? '#9cc48f' : '#c6a4ed' })
  }
  if (g.particles.length > (g.particleLimit || 96)) g.particles.splice(0, g.particles.length - (g.particleLimit || 96))
}

function createBuyerMiner(state, event, tier) {
  const wallet = String(event.wallet || event.address || 'UNKNOWN')
  const appearance = minerTraits(wallet)
  const index = state.miners.length
  const role = BUYER_ROLES[appearance.seed % BUYER_ROLES.length]
  const profile = {
    id: `buyer-${Math.floor(state.time * 10)}-${index}`,
    name: shortenAddress(wallet),
    role,
    personality: BUYER_PERSONALITIES[appearance.seed % BUYER_PERSONALITIES.length],
    color: appearance.outfit,
    tool: tier.equipment,
    x: 7.2 + (index % 5) * .75,
    y: 5.15,
    speed: tier.speed,
    kind: 'buyer',
    wallet,
    address: wallet,
    purchaseCount: 1,
    purchaseVolume: Math.max(0, Number(event.amount) || 0),
    verifiedVolume: event.verified ? Math.max(0, Number(event.amount) || 0) : 0,
    joinedAt: state.time,
    purchaseTier: tier.id,
    appearance,
    power: 1 + tierRank(tier.id) * .35,
  }
  const miner = makeMiner(profile, index)
  miner.state = 'spawning'
  miner.status = 'Entering the mine'
  miner.goal = 'Finding a safe first tunnel.'
  miner.spawnUntil = state.time + 1.5
  miner.celebrateUntil = state.time + 3.4
  miner.spawnY = 7.05
  return miner
}

export function spawnBuyer(state, g, event) {
  if (!state?.activity || !event?.wallet) return null
  const amount = Math.max(0, Number(event.amount) || 0)
  const tier = purchaseTier(amount, state.activity.source.tiers)
  const wallet = String(event.wallet)
  const existing = state.miners.find(miner => miner.kind === 'buyer' && miner.wallet === wallet)
  const source = activityLabel(event)
  const purchase = { id: event.id || event.signature || `${wallet}:${state.time}`, name: shortenAddress(wallet), wallet, amount, unit: event.unit || state.activity.source.unit, source: event.source || 'demo', verified: event.verified === true, tier: tier.id, at: state.time }
  state.activity.transactions.unshift(purchase)
  state.activity.transactions = state.activity.transactions.slice(0, 30)
  state.community.buys++
  if (event.verified) state.community.verifiedBuys++
  else state.community.simulatedBuys++
  if (existing) {
    existing.purchaseCount++
    existing.purchaseVolume += amount
    if (event.verified) existing.verifiedVolume += amount
    existing.boostUntil = state.time + 20
    existing.celebrateUntil = state.time + 2.4
    existing.state = 'celebrating'
    existing.status = 'Celebrating a repeat buy'
    existing.speech = 'Again? The drill is already warm.'
    if (tierRank(tier.id) > tierRank(existing.purchaseTier)) {
      existing.purchaseTier = tier.id
      existing.tool = tier.equipment
      existing.baseSpeed = tier.speed
      existing.speed = tier.speed
      existing.power = Math.max(existing.power, 1 + tierRank(tier.id) * .35)
    }
    let assistant = null
    if (tier.id === 'exceptional' && existing.purchaseCount % 2 === 0 && state.miners.length < 308) {
      assistant = createBuyerMiner(state, { ...event, wallet }, PURCHASE_TIERS[0])
      assistant.name = `${existing.name} ASSIST`
      assistant.wallet = wallet
      assistant.address = wallet
      assistant.purchaseCount = 0
      assistant.purchaseVolume = 0
      assistant.verifiedVolume = 0
      assistant.status = 'Following the crew into the mine'
      state.miners.push(assistant)
    }
    state.activity.join = { ...purchase, title: 'DIGGER POWERED UP', subtitle: `${existing.name} bought again · ${tier.label}${assistant ? ' · assistant recruited' : ''}`, sourceLabel: source, until: state.time + 4, minerId: existing.id, repeat: true }
    announce(state, `${existing.name} upgraded to ${tier.label.toLowerCase()}.`, { title: 'DIGGER POWERED UP', subtitle: `${existing.name} bought again · drill boost for 20 seconds`, sourceLabel: source, color: existing.color, minerId: existing.id })
    communityBurst(g, tier)
    return existing
  }
  const miner = createBuyerMiner(state, event, tier)
  state.miners.push(miner)
  state.activity.join = { ...purchase, title: 'NEW DIGGER JOINED', subtitle: `${miner.name} bought ${formatPurchase(amount, purchase.unit)} · ${tier.label}`, sourceLabel: source, until: state.time + 4, minerId: miner.id }
  announce(state, `${miner.name} entered the mine.`, { title: 'NEW DIGGER JOINED', subtitle: `${formatPurchase(amount, purchase.unit)} · ${tier.label}`, sourceLabel: source, color: miner.color, minerId: miner.id })
  communityBurst(g, tier)
  if (tier.id === 'exceptional') {
    state.event = { name: 'Drill Frenzy', phase: 'active', remaining: 18 }
    state.community.event = 'Drill Frenzy'
    state.major = { title: 'LARGEST BUY OF THE SESSION', subtitle: `${miner.name} powered up the whole shaft · community drill frenzy`, sourceLabel: source, color: '#d4b3ff', minerId: miner.id, id: String(state.time) + ':largest-buy', expires: state.time + 6 }
  }
  return miner
}

function speak(miner, message, state, duration = 4) {
  miner.speech = message
  miner.speechUntil = state.time + duration
}

function releaseReservation(state, miner) {
  if (!state?.reservations) return
  state.reservations = state.reservations.filter(item => item.minerId !== miner.id)
  miner.reservationKey = null
}

function clearTarget(miner, state = null) {
  releaseReservation(state, miner)
  miner.target = null
  miner.targetType = null
  miner.route = null
  miner.routeVersion = -1
  miner.breakTarget = null
  miner.move = null
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

function inside(x, y) {
  return x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1
}

function isLava(g, x, y) {
  return tile(g, x, y) === 'lava'
}

function openTile(g, x, y) {
  const type = tile(g, x, y)
  return inside(x, y) && (type === 'air' || type === 'ladder')
}

function safeStanding(g, x, y) {
  if (!openTile(g, x, y) || isLava(g, x, y)) return false
  for (let drop = 1; drop <= 4; drop++) {
    const below = tile(g, x, y + drop)
    if (below === 'lava') return false
    if (solid(below) || below === 'ladder') return true
  }
  return false
}

function mineable(type, state, g) {
  if (!Object.hasOwn(HITS, type) || ['bedrock', 'debris', 'lava'].includes(type)) return false
  if (type === 'sealed' && !g.artifacts.some(artifact => artifact.solved)) return false
  return Boolean(state)
}

function navCost(g, x, y, state, miner) {
  if (!inside(x, y) || isLava(g, x, y)) return Infinity
  const type = tile(g, x, y)
  if (type === 'bedrock' || type === 'debris') return Infinity
  if (type === 'casing' || type === 'sealed') return Infinity
  if (openTile(g, x, y)) {
    const crowd = state && miner ? state.miners.some(other => other.id !== miner.id && Math.floor(other.x) === x && Math.floor(other.y) === y) : false
    return (type === 'ladder' ? .8 : 1) + (crowd ? 5 : 0)
  }
  if (!mineable(type, state, g)) return Infinity
  const danger = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => isLava(g, a, b)) ? 7 : 0
  const power = Math.max(1, miner?.power || 1)
  return 1.5 + (HITS[type] || 3) * .7 / power + danger
}

function reservationAt(state, x, y, exceptId = '') {
  return (state?.reservations || []).find(item => item.x === x && item.y === y && item.minerId !== exceptId && item.expires > state.time)
}

function cleanupReservations(state) {
  state.reservations ||= []
  const miners = new Map(state.miners.map(miner => [miner.id, miner]))
  state.reservations = state.reservations.filter(item => {
    const miner = miners.get(item.minerId)
    const target = miner?.target
    const valid = miner && target && target.x === item.x && target.y === item.y && item.expires > state.time
    if (!valid && miner?.reservationKey === item.key) miner.reservationKey = null
    return valid
  })
}

function reserveTarget(state, miner, target, type) {
  cleanupReservations(state)
  const conflict = reservationAt(state, target.x, target.y, miner.id)
  if (conflict && type !== 'hard') return false
  releaseReservation(state, miner)
  const key = keyOf(target.x, target.y)
  state.reservations.push({ minerId: miner.id, x: target.x, y: target.y, key, type, reservedAt: state.time, expires: state.time + (type === 'hard' ? 12 : 8), action: 'target' })
  miner.reservationKey = key
  if (conflict) state.community.cooperation++
  return true
}

function markNavigationChanged(state, x, y) {
  state.navVersion = (state.navVersion || 0) + 1
  state.navDirty ||= []
  state.navDirty.push({ x, y, version: state.navVersion })
  if (state.navDirty.length > 48) state.navDirty.splice(0, state.navDirty.length - 48)
}

function reconstructPath(came, current) {
  const path = [{ x: current.x, y: current.y }]
  let cursor = keyOf(current.x, current.y)
  while (came.has(cursor)) {
    const previous = came.get(cursor)
    path.push(previous)
    cursor = keyOf(previous.x, previous.y)
  }
  return path.reverse()
}

function aStar(g, start, goal, state = null, miner = null, allowBreakableGoal = false) {
  const goalType = tile(g, goal.x, goal.y)
  if (!inside(start.x, start.y) || (!safeStanding(g, goal.x, goal.y) && !(allowBreakableGoal && mineable(goalType, state, g)))) return null
  const startKey = keyOf(start.x, start.y), goalKey = keyOf(goal.x, goal.y)
  const open = [{ x: start.x, y: start.y, g: 0, f: Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y) }]
  const came = new Map(), scores = new Map([[startKey, 0]]), closed = new Set()
  let inspected = 0
  while (open.length && inspected++ < NAV_LIMIT) {
    open.sort((a, b) => a.f - b.f || a.g - b.g)
    const current = open.shift()
    const currentKey = keyOf(current.x, current.y)
    if (closed.has(currentKey)) continue
    if (currentKey === goalKey) {
      const path = reconstructPath(came, current)
      return path.length <= PATH_LIMIT ? path : null
    }
    closed.add(currentKey)
    for (const [dx, dy] of DIRECTIONS) {
      const x = current.x + dx, y = current.y + dy, id = keyOf(x, y)
      if (!inside(x, y) || closed.has(id)) continue
      const cost = id === goalKey && allowBreakableGoal && mineable(tile(g, x, y), state, g) ? 1.5 + (HITS[tile(g, x, y)] || 3) * .7 / Math.max(1, miner?.power || 1) : navCost(g, x, y, state, miner)
      if (!Number.isFinite(cost)) continue
      if (miner?.avoid?.[id] > (state?.time || 0)) continue
      const nextScore = current.g + cost
      if (nextScore >= (scores.get(id) ?? Infinity)) continue
      scores.set(id, nextScore)
      came.set(id, { x: current.x, y: current.y })
      open.push({ x, y, g: nextScore, f: nextScore + Math.abs(x - goal.x) + Math.abs(y - goal.y) })
    }
  }
  return null
}

function routeCost(g, path, state, miner) {
  return path.slice(1).reduce((sum, cell) => sum + navCost(g, cell.x, cell.y, state, miner), 0)
}

export function routeToBlock(g, start, target, state = null, miner = null) {
  if (!inside(target.x, target.y) || isLava(g, target.x, target.y)) return null
  const standing = DIRECTIONS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).filter(cell => safeStanding(g, cell.x, cell.y))
  let best = null
  for (const goal of standing) {
    const path = aStar(g, { x: Math.floor(start.x), y: Math.floor(start.y) }, goal, state, miner)
    if (!path) continue
    const cost = routeCost(g, path, state, miner)
    if (!best || cost < best.cost) best = { path, cost }
  }
  if (!best) {
    const staging = DIRECTIONS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).filter(cell => mineable(tile(g, cell.x, cell.y), state, g))
    for (const goal of staging) {
      const path = aStar(g, { x: Math.floor(start.x), y: Math.floor(start.y) }, goal, state, miner, true)
      if (!path) continue
      const cost = routeCost(g, path, state, miner)
      if (!best || cost < best.cost) best = { path, cost }
    }
  }
  return best?.path || null
}

function nearestSafeCell(g, origin, radius = 8, state = null, miner = null) {
  for (let distance = 0; distance <= radius; distance++) {
    for (let y = Math.max(1, origin.y - distance); y <= Math.min(HEIGHT - 2, origin.y + distance); y++) for (let x = Math.max(1, origin.x - distance); x <= Math.min(WIDTH - 2, origin.x + distance); x++) {
      if (Math.abs(x - origin.x) + Math.abs(y - origin.y) !== distance || !safeStanding(g, x, y)) continue
      if (state && miner && state.miners.some(other => other.id !== miner.id && Math.floor(other.x) === x && Math.floor(other.y) === y)) continue
      return { x, y }
    }
  }
  return null
}

function occupiedByOther(state, miner, x, y) {
  return state.miners.find(other => {
    if (other.id === miner.id) return false
    const at = other.move ? { x: other.move.toX, y: other.move.toY } : { x: other.x, y: other.y }
    return Math.floor(at.x) === x && Math.floor(at.y) === y
  })
}

function minerPriority(miner) {
  if (miner.state === 'escaping' || miner.status?.includes('lava')) return 100
  if (miner.carryingRare || ['diamond', 'sol'].includes(miner.lastDiscovery?.type)) return 80
  return RARE_TYPES.has(miner.targetType) ? 60 : 20
}

function yieldMiner(state, g, miner) {
  if (miner.escapeTarget) return true
  const current = { x: Math.floor(miner.x), y: Math.floor(miner.y) }
  const candidates = DIRECTIONS.map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy })).filter(cell => safeStanding(g, cell.x, cell.y) && !occupiedByOther(state, miner, cell.x, cell.y))
  const next = candidates[0]
  if (!next) return false
  miner.escapeTarget = next
  miner.move = null
  miner.route = null
  miner.routeVersion = -1
  miner.state = 'escaping'
  miner.status = 'Excuse me… making room'
  speak(miner, 'Excuse me…', state, 1.5)
  return true
}

function recoverMiner(state, g, miner, reason = 'blocked route') {
  miner.recovery = Math.min(5, (miner.recovery || 0) + 1)
  miner.routeFailures = (miner.routeFailures || 0) + 1
  miner.lastPathFailure = reason
  miner.move = null
  miner.renderX = Math.round(miner.x * 16) / 16
  miner.renderY = Math.round(miner.y * 16) / 16
  miner.noProgress = 0
  if (miner.recovery === 1) {
    const snapped = safeStanding(g, Math.floor(miner.x), Math.floor(miner.y)) ? { x: Math.floor(miner.x), y: Math.floor(miner.y) } : nearestSafeCell(g, { x: Math.floor(miner.x), y: Math.floor(miner.y) }, 4, state, miner)
    if (snapped) { miner.x = snapped.x; miner.y = snapped.y; miner.renderX = snapped.x; miner.renderY = snapped.y }
    miner.route = null
    miner.routeVersion = -1
    miner.status = 'Rechecking route'
    return
  }
  if (miner.recovery === 2 && miner.target) {
    const route = routeToBlock(g, miner, miner.target, state, miner)
    if (route) {
      miner.route = route
      miner.routeVersion = state.navVersion
      miner.status = 'Rerouting safely'
      return
    }
  }
  if (miner.recovery === 3) {
    if (miner.target) miner.avoid[keyOf(miner.target.x, miner.target.y)] = state.time + 4
    clearTarget(miner, state)
    miner.status = 'Choosing another route'
    miner.think = 0
    speak(miner, 'Wall says no. Finding another route.', state, 2.5)
    return
  }
  if (miner.recovery === 4 && yieldMiner(state, g, miner)) return
  const safe = nearestSafeCell(g, { x: Math.floor(miner.x), y: Math.floor(miner.y) }, 8, state, miner)
  clearTarget(miner, state)
  if (safe) {
    miner.x = safe.x; miner.y = safe.y; miner.renderX = safe.x; miner.renderY = safe.y
    g.particles ||= []
    g.particles.push({ x: safe.x + .5, y: safe.y + .5, vx: 0, vy: -1.2, life: .32, color: '#ad9a78' })
  }
  miner.escapeTarget = null
  miner.recovery = 0
  miner.routeFailures = 0
  miner.state = 'idle'
  miner.status = 'Searching for a deeper route'
  miner.think = 0
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
  revealMinerArea(g, miner)
  const origin = { x: Math.floor(miner.x), y: Math.floor(miner.y) }
  const candidates = []
  for (let y = Math.max(2, origin.y - 3); y <= Math.min(HEIGHT - 2, origin.y + 4); y++) for (let x = Math.max(1, origin.x - 6); x <= Math.min(WIDTH - 2, origin.x + 6); x++) {
    const type = tile(g, x, y)
    if (!solid(type) || !mineable(type, state, g) || !g.seen[keyOf(x, y)] || reservationAt(state, x, y, miner.id) && type !== 'hard') continue
    const distance = Math.abs(x - origin.x) + Math.abs(y - origin.y)
    if (!distance || distance > 8) continue
    const route = routeToBlock(g, origin, { x, y }, state, miner)
    if (!route) continue
    const travel = routeCost(g, route, state, miner)
    const crowd = state.reservations.filter(item => Math.abs(item.x - x) + Math.abs(item.y - y) <= 2 && item.minerId !== miner.id).length
    const score = candidateScore(type, x, y, miner, state, g, miner) - travel * 1.8 - (HITS[type] || 3) * .8 - crowd * 12
    candidates.push({ x, y, type, score, route })
  }
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates.find(candidate => reserveTarget(state, miner, candidate, candidate.type))
  if (!best) return null
  miner.target = { x: best.x, y: best.y }
  miner.route = best.route
  miner.routeVersion = state.navVersion
  miner.targetType = best.type
  miner.mineProgress = 0
  miner.breakTarget = null
  miner.noProgress = 0
  miner.goal = best.type === 'casing' || best.type === 'sealed' ? 'Inspecting a sealed chamber.' : best.type === 'sol' ? 'Chasing a SOL crystal.' : 'Investigating ' + best.type + ' signal.'
  miner.status = best.type === 'casing' || best.type === 'sealed' ? 'Entering chamber' : best.type === 'sol' ? 'Following a SOL signal' : best.type === 'diamond' ? 'Following a diamond signal' : 'Walking to target'
  if (best.type === 'gold' || best.type === 'diamond' || best.type === 'sol') speak(miner, choice(SPEECH[miner.role] || SPEECH.COLLECTOR, Math.floor(state.time + miner.index)), state)
  return best
}

function isOpen(g, x, y) {
  return openTile(g, Math.floor(x), Math.floor(y))
}

function revealMinerArea(g, miner) {
  const origin = { x: Math.floor(miner.x), y: Math.floor(miner.y) }
  const queue = [origin]
  const visited = new Set([keyOf(origin.x, origin.y)])
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]
    g.seen[keyOf(current.x, current.y)] = true
    for (const [dx, dy] of DIRECTIONS) {
      const x = current.x + dx, y = current.y + dy, id = keyOf(x, y)
      if (x < 1 || y < 1 || x >= WIDTH - 1 || y >= HEIGHT - 1 || visited.has(id) || Math.hypot(x - origin.x, y - origin.y) > 6) continue
      visited.add(id)
      g.seen[id] = true
      if (isOpen(g, x, y)) queue.push({ x, y })
    }
  }
}

function moveMiner(state, g, miner, dt) {
  if (!miner.target && !miner.escapeTarget) return
  if (miner.move) {
    const boost = state.time < miner.boostUntil ? 1.35 : 1
    const speed = (miner.baseSpeed || miner.speed) * boost * (state.event?.name === 'Drill Frenzy' ? 1.8 : 1)
    miner.move.progress = Math.min(1, miner.move.progress + speed * dt)
    const progress = miner.move.progress
    miner.renderX = Math.round((miner.move.fromX + (miner.move.toX - miner.move.fromX) * progress) * 16) / 16
    miner.renderY = Math.round((miner.move.fromY + (miner.move.toY - miner.move.fromY) * progress) * 16) / 16
    miner.state = miner.move.dy ? 'climbing' : 'walking'
    miner.status = miner.move.dy > 0 ? 'Searching for a deeper route' : 'Walking to target'
    miner.noProgress = 0
    if (progress < 1) return
    const blocker = occupiedByOther(state, miner, miner.move.toX, miner.move.toY)
    if (blocker) {
      if (minerPriority(miner) > minerPriority(blocker)) yieldMiner(state, g, blocker)
      recoverMiner(state, g, miner, 'another miner blocked the tile')
      return
    }
    miner.x = miner.move.toX; miner.y = miner.move.toY
    miner.renderX = miner.x; miner.renderY = miner.y
    miner.move = null
    miner.noProgress = 0
    miner.routeFailures = 0
    miner.recovery = 0
    miner.stateClock = 0
    miner.recentTiles = [...(miner.recentTiles || []).slice(-3), keyOf(miner.x, miner.y)]
    const recent = miner.recentTiles
    if (recent.length >= 4 && recent.at(-1) === recent.at(-3) && recent.at(-2) === recent.at(-4)) recoverMiner(state, g, miner, 'alternating between two tiles')
    if (miner.escapeTarget && miner.x === miner.escapeTarget.x && miner.y === miner.escapeTarget.y) {
      miner.escapeTarget = null
      miner.state = 'idle'
      miner.status = 'Choosing another route'
      miner.think = 0
    }
    return
  }
  if (miner.escapeTarget) {
    const goal = miner.escapeTarget
    if (miner.x === goal.x && miner.y === goal.y) { miner.escapeTarget = null; miner.state = 'idle'; miner.think = 0; return }
    const route = aStar(g, { x: Math.floor(miner.x), y: Math.floor(miner.y) }, goal, state, miner)
    const next = route?.[1]
    if (!next) { recoverMiner(state, g, miner, 'no congestion escape route'); return }
    startTileMove(state, g, miner, next)
    return
  }
  const valid = validateTarget(state, g, miner)
  if (!valid) { recoverMiner(state, g, miner, 'target became unreachable'); return }
  const floorX = Math.floor(miner.x), floorY = Math.floor(miner.y)
  const routeIndex = miner.route.findIndex(cell => cell.x === floorX && cell.y === floorY)
  if (routeIndex < 0 || !miner.route[routeIndex + 1]) { recoverMiner(state, g, miner, 'path ended before target'); return }
  const target = miner.route[routeIndex + 1]
  startTileMove(state, g, miner, target)
}

function validateTarget(state, g, miner) {
  if (!miner.target) return null
  const type = tile(g, miner.target.x, miner.target.y)
  if (!mineable(type, state, g) || reservationAt(state, miner.target.x, miner.target.y, miner.id)) {
    clearTarget(miner, state)
    return null
  }
  if (miner.route && miner.routeVersion === state.navVersion) return { type, route: miner.route }
  const route = routeToBlock(g, miner, miner.target, state, miner)
  if (!route) return null
  miner.route = route
  miner.routeVersion = state.navVersion
  miner.targetType = type
  return { type, route }
}

function startTileMove(state, g, miner, next) {
  const type = tile(g, next.x, next.y)
  if (isLava(g, next.x, next.y) || !inside(next.x, next.y)) { recoverMiner(state, g, miner, 'hazard in path'); return false }
  if (!openTile(g, next.x, next.y)) {
    if (mineable(type, state, g)) {
      miner.breakTarget = { x: next.x, y: next.y }
      miner.state = 'mining'
      miner.status = type === 'gold' || type === 'diamond' || type === 'sol' ? 'Investigating sparkle' : 'Mining stone'
      return true
    }
    recoverMiner(state, g, miner, 'indestructible path tile')
    return false
  }
  if (!safeStanding(g, next.x, next.y)) { recoverMiner(state, g, miner, 'unsafe landing'); return false }
  const blocker = occupiedByOther(state, miner, next.x, next.y)
  if (blocker) {
    if (minerPriority(miner) > minerPriority(blocker) && yieldMiner(state, g, blocker)) return false
    miner.status = 'Waiting for an open tile'
    miner.noProgress += .1
    if (miner.noProgress > .6) recoverMiner(state, g, miner, 'tunnel congestion')
    return false
  }
  const fromX = miner.x, fromY = miner.y
  miner.move = { fromX, fromY, toX: next.x, toY: next.y, dx: next.x - Math.floor(fromX), dy: next.y - Math.floor(fromY), progress: 0 }
  miner.facing = Math.sign(next.x - fromX) || miner.facing
  miner.state = next.y !== Math.floor(fromY) ? 'climbing' : 'walking'
  miner.status = next.y > Math.floor(fromY) ? 'Searching for a deeper route' : 'Walking to target'
  miner.noProgress = 0
  miner.stateClock = 0
  return true
}

function discovery(state, g, miner, type, point = miner.target) {
  if (!point) return
  const label = type === 'sol' ? 'SOL crystal' : type + ' cache'
  miner.haul[type] = (miner.haul[type] || 0) + (type === 'gold' ? 2 : 1)
  miner.blocks++
  miner.streak++
  miner.lastDiscovery = { type, at: state.time }
  if (RARE_ORDER.includes(type) && RARE_ORDER.indexOf(type) >= RARE_ORDER.indexOf(miner.rarest)) miner.rarest = type
  g.removed[keyOf(point.x, point.y)] = true
  g.broken = (g.broken || 0) + 1
  markNavigationChanged(state, point.x, point.y)
  state.community.blocks++
  state.community.depth = Math.max(state.community.depth, Math.max(0, (miner.y - 8) * 10))
  if (state.community.ore[type] != null) state.community.ore[type]++
  g.communityImpact = { x: point.x, y: point.y, until: g.time + .18, type }
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
  const point = miner.breakTarget || miner.target
  const type = point && (miner.breakTarget ? tile(g, point.x, point.y) : miner.targetType || tile(g, point.x, point.y))
  if (!point || !type || !solid(type) || !mineable(type, state, g)) {
    if (miner.breakTarget) miner.breakTarget = null
    else clearTarget(miner, state)
    return
  }
  miner.mineProgress += dt * (1 + (miner.baseSpeed || miner.speed) * .45 + (miner.power || 1) * .12)
  miner.noProgress = 0
  miner.stateClock = 0
  miner.state = 'mining'
  if (type === 'casing' || type === 'sealed') {
    if (point !== miner.target) { recoverMiner(state, g, miner, 'locked door in path'); return }
    if (miner.mineProgress > 1.6 && !state.puzzle) {
      const id = keyOf(point.x, point.y)
      g.removed[id] = true
      markNavigationChanged(state, point.x, point.y)
      if (!g.artifacts.some(artifact => artifact.id === id)) g.artifacts.push({ id, outcome: 'puzzle', solved: false, turns: 0, dials: [0, 0, 0] })
      startPuzzle(state, g, miner.id, id)
      clearTarget(miner, state)
    }
    return
  }
  if (type === 'lava') {
    miner.lavaIncidents++
    speak(miner, 'Running from lava.', state, 4)
    clearTarget(miner, state)
    return
  }
  if (miner.mineProgress >= (HITS[type] || 3) * .45) {
    if (miner.role === 'CHAOS MINER' && nextRandom(state) > .72) {
      const blast = 6 + Math.floor(nextRandom(state) * 18)
      miner.explosions += blast
      miner.blocks += Math.max(1, Math.floor(blast / 3))
      miner.streak++
      state.community.blocks += blast
      state.community.explosions += blast
      g.broken = (g.broken || 0) + blast
      g.communityImpact = { x: point.x, y: point.y, until: g.time + .45, type: 'explosion' }
      g.shake = Math.max(g.shake || 0, .45)
      announce(state, miner.name + ' detonated ' + blast + ' blocks. The tunnel is “better” now.', { title: 'BIGGEST EXPLOSION', subtitle: blast + ' blocks destroyed by ' + miner.name, color: '#ffad5c', minerId: miner.id })
      speak(miner, 'Absolutely safe explosion incoming.', state, 5)
      g.removed[keyOf(point.x, point.y)] = true
      markNavigationChanged(state, point.x, point.y)
    } else discovery(state, g, miner, type, point)
    if (miner.breakTarget && (!miner.target || keyOf(point.x, point.y) !== keyOf(miner.target.x, miner.target.y))) {
      miner.breakTarget = null
      miner.mineProgress = 0
      miner.route = null
      miner.routeVersion = -1
      miner.status = 'Recalculating route'
      return
    }
    miner.carryingRare = ['diamond', 'sol'].includes(type)
    miner.carryingUntil = state.time + (miner.carryingRare ? 4 : 0)
    clearTarget(miner, state)
  }
}

function updatePuzzle(state, g, dt) {
  if (!state.puzzle) return
  if (state.puzzle.done) {
    if (state.time - (state.puzzle.doneAt || state.time) > 30) state.puzzle = null
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
    const artifact = state.puzzle.artifactId && g.artifacts.find(item => item.id === state.puzzle.artifactId)
    if (artifact && !artifact.solved) artifact.solved = true
    state.community.puzzles++
    state.community.artifacts += artifact ? 1 : 0
    miner.rarest ||= 'artifact'
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

function tickActivity(state, g) {
  if (state.activity.join && state.time > state.activity.join.until) state.activity.join = null
  if (state.activity.mode !== 'demo' || state.time < state.activity.nextDemo) return
  const index = state.activity.demoIndex++
  spawnBuyer(state, g, createDemoPurchase(index, null, state.activity.source.unit))
  state.activity.nextDemo = state.time + 15 + nextRandom(state) * 18
}

function advanceAnnouncements(state) {
  if (state.major?.expires != null && state.time >= state.major.expires) state.major = null
  if (state.noticeCurrent && state.time >= state.noticeCurrent.expires) {
    state.noticeCurrent = state.noticeQueue.shift() || null
    state.ticker = state.noticeCurrent?.message || 'The crew is moving through the local mine.'
    state.tickerClock = 0
  }
}

function normalizeMinerPosition(state, g, miner) {
  if (miner.initialized) return
  const origin = { x: Math.floor(miner.x), y: Math.floor(miner.y) }
  if (!safeStanding(g, origin.x, origin.y)) {
    const safe = nearestSafeCell(g, origin, 8, state, miner)
    if (safe) {
      miner.x = safe.x; miner.y = safe.y; miner.renderX = safe.x; miner.renderY = safe.y
      g.particles ||= []
      g.particles.push({ x: safe.x + .5, y: safe.y + .5, vx: 0, vy: -1, life: .28, color: '#ad9a78' })
      miner.status = 'Finding an open tunnel'
    }
  }
  miner.initialized = true
}

function updateMinerProgress(state, g, miner, dt) {
  if (miner.target && ['walking', 'climbing', 'escaping'].includes(miner.state) && !miner.move) {
    miner.noProgress = (miner.noProgress || 0) + dt
    if (miner.noProgress > 1.5) recoverMiner(state, g, miner, 'no movement for 1.5 seconds')
  }
  if (miner.target && miner.state === 'mining' && miner.mineProgress > 0 && miner.mineProgress < 0.1) {
    miner.noProgress = (miner.noProgress || 0) + dt
    if (miner.noProgress > 6) recoverMiner(state, g, miner, 'mining made no progress')
  }
}

export function tickCrew(state, g, dt) {
  if (!state || !g || !Number.isFinite(dt) || dt <= 0) return state
  state.time += Math.min(dt, .1)
  state.tickerClock += dt
  if (state.openingFollowUntil > 0 && state.time >= state.openingFollowUntil) {
    state.openingFollowUntil = 0
    if (state.followId === 'dan') state.followId = null
  }
  if (!state.crewIntroduced && g.broken > 0) {
    state.crewIntroduced = true
    announce(state, 'The first block cracked. Rival crews are entering the shaft.')
  }
  updateEvent(state, dt)
  tickActivity(state, g)
  updatePuzzle(state, g, dt)
  advanceAnnouncements(state)
  cleanupReservations(state)
  if (state.lastWorldBroken !== (g.broken || 0)) {
    state.lastWorldBroken = g.broken || 0
    markNavigationChanged(state, Math.floor(g.player.x), Math.floor(g.player.y))
  }
  for (const miner of state.miners) {
    miner.lastActive = state.time
    if (miner.carryingRare && state.time >= miner.carryingUntil) miner.carryingRare = false
    if (miner.lastState !== miner.state) { miner.lastState = miner.state; miner.stateClock = 0 }
    else miner.stateClock = (miner.stateClock || 0) + dt
    if (miner.stateClock > 12 && ['walking', 'climbing', 'mining'].includes(miner.state) && state.puzzle?.minerId !== miner.id) recoverMiner(state, g, miner, 'state lasted too long')
    if (miner.spawnUntil > state.time) {
      const progress = 1 - (miner.spawnUntil - state.time) / 1.5
      miner.y = 5.15 + (miner.spawnY - 5.15) * Math.max(0, Math.min(1, progress))
      miner.renderY = Math.round(miner.y * 16) / 16
      miner.move = null
      miner.state = 'spawning'
      miner.status = 'Entering the mine'
      continue
    }
    if (miner.celebrateUntil > state.time) {
      miner.state = 'celebrating'
      miner.status = miner.purchaseCount > 1 ? 'Celebrating a repeat buy' : 'Celebrating a new arrival'
      continue
    }
    if (miner.state === 'celebrating') {
      miner.state = 'idle'
      miner.status = 'Scanning for ore'
      miner.think = 0
    }
    normalizeMinerPosition(state, g, miner)
    if (state.puzzle?.minerId === miner.id && !state.puzzle.done) {
      miner.move = null
      miner.state = 'inspecting'
      continue
    }
    if (!miner.target && !miner.escapeTarget && ['mining', 'walking', 'climbing'].includes(miner.state)) {
      miner.state = 'idle'
      miner.status = 'Searching for ore'
    }
    const distance = Math.hypot(miner.x - g.player.x, miner.y - g.player.y)
    if (distance > 42) {
      miner.backgroundClock += dt
      if (miner.backgroundClock < .25) continue
      miner.backgroundClock = 0
    }
    const simDt = distance > 42 ? .25 : dt
    miner.think -= simDt
    miner.deepest = Math.max(miner.deepest, Math.max(0, (miner.y - 8) * 10))
    state.community.depth = Math.max(state.community.depth, miner.deepest)
    if (state.time > miner.speechUntil && miner.think <= 0) {
      speak(miner, choice(SPEECH[miner.role] || SPEECH.COLLECTOR, Math.floor(state.time + miner.index)), state)
      miner.think = 4 + nextRandom(state) * 4
    }
    if (!miner.target && !miner.escapeTarget && miner.think <= 0) {
      if (!chooseTarget(state, g, miner)) {
        miner.status = 'Searching for a deeper route'
        miner.think = .45 + nextRandom(state) * .45
      }
    }
    if (miner.escapeTarget) moveMiner(state, g, miner, simDt)
    else if (miner.target) {
      const targetDistance = Math.abs(miner.target.x - Math.floor(miner.x)) + Math.abs(miner.target.y - Math.floor(miner.y))
      if (targetDistance <= 1) workMiner(state, g, miner, simDt)
      else if (miner.breakTarget) workMiner(state, g, miner, simDt)
      else moveMiner(state, g, miner, simDt)
    }
    updateMinerProgress(state, g, miner, simDt)
  }
  if (!state.noticeCurrent && state.tickerClock > 6) {
    const active = state.miners[Math.floor(nextRandom(state) * state.miners.length)]
    state.ticker = active.name + ' ' + active.goal.toLowerCase()
    state.tickerIndex++
    state.tickerClock = 0
  }
  state.community.blocks = Math.max(state.community.blocks, g.broken || 0)
  state.community.depth = Math.max(state.community.depth, g.deepest || 0)
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

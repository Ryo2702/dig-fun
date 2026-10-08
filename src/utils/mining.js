import { minerals, tools, readings, events } from '../data/minerals.js'

export const zoneDepths = [74, 420, 4200, 24000, 73100, 112404, 150000]
export const miningMilestones = [100, 1000, 10000, 50000, 100000, 160000]
export const bonusValues = { pickaxe: 2, coin: 2, gear: 10, ledger: 5, token: 10, diamond: 5 }

export function randomFrom(seed) {
  let state = 2166136261
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619)
  return () => {
    state += 0x6D2B79F5
    let n = Math.imul(state ^ state >>> 15, 1 | state)
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

export function newMining(seed = globalThis.crypto.randomUUID()) {
  return { version: 1, seed, rooms: {}, branches: Array(7).fill(0), bonuses: [], cosmetic: false }
}

export function roomFor(seed, zone, number) {
  const random = randomFrom(`mining-v1:${seed}:${zone}:${number}`)
  const roll = random()
  let outcome = roll < 0.24 ? 'copper' : roll < 0.32 ? 'silver' : roll < 0.345 ? 'gold' : roll < 0.351 ? 'diamond' : roll < 0.3525 ? 'sol' : roll < 0.3528 ? 'unknown' : null
  if ((outcome === 'silver' && zone < 1) || (outcome === 'gold' && zone < 2) || (outcome === 'diamond' && zone < 1) || (outcome === 'sol' && zone < 4) || (outcome === 'unknown' && zone < 5)) outcome = null
  if (!outcome) outcome = ['empty', 'empty', 'spoon', 'tool', 'creature', 'gas', 'lava', 'rocks', 'mimic'][Math.floor(random() * 9)]
  const event = random() < 0.025 ? events[Math.floor(random() * events.length)] : null
  if (event === 'Fool’s Gold Room') outcome = 'spoon'
  const silent = outcome === 'unknown'
  const shines = ['copper', 'silver', 'gold', 'diamond', 'sol', 'unknown']
  const shine = silent ? null : event === 'Fool’s Gold Room' || event === 'Gold Rush' ? 'gold' : random() < 0.55 && minerals[outcome] ? outcome : shines[Math.floor(random() * shines.length)]
  const hardness = outcome === 'sol' ? 18 : outcome === 'diamond' ? 16 : zone === 0 ? 1 + Math.floor(random() * 2) : zone === 1 ? 3 + Math.floor(random() * 3) : zone < 4 ? 6 + Math.floor(random() * 5) : 12 + Math.floor(random() * 7)
  const stages = outcome === 'diamond' || outcome === 'sol' || event === 'Motherlode' ? 3 : 1
  return {
    id: `${zone}:${number}`, zone, number, depth: zoneDepths[zone], outcome, shine, event, hardness, stages,
    pattern: Array.from({ length: 3 }, () => Math.floor(random() * 3)),
    reading: readings[Math.floor(random() * readings.length)],
    baseValue: minerals[outcome] ? minerals[outcome].min + Math.floor(random() * (minerals[outcome].max - minerals[outcome].min + 1)) : 0,
    size: event === 'Motherlode' && minerals[outcome] && random() < 0.08 ? 'Motherlode' : random() < 0.04 ? 'Rich vein' : 'Small deposit',
    hazard: ['gas', 'lava', 'rocks', 'creature', 'mimic'].includes(outcome) ? outcome : ['diamond', 'sol'].includes(outcome) && random() < 0.3 ? 'rocks' : null,
  }
}

export const untouched = { hits: 0, misses: 0, stage: 0, pattern: 0, rescueStep: 0, inspected: false, scanned: false, ready: false, hazard: false, done: false, at: null }

export function rewardFor(room, record) {
  if (!record?.done) return 0
  const mineral = minerals[room.outcome]
  const quality = Math.max(0, 1 - record.misses * 0.12)
  const value = mineral ? mineral.min + Math.floor((room.baseValue - mineral.min) * quality) : 0
  return value + (room.hazard ? 2 : room.outcome === 'empty' && room.event ? 1 : 0)
}

export function miningSummary(mining, deepest = 0) {
  const found = {}
  let cents = mining.bonuses.reduce((sum, id) => sum + (id.startsWith('depth:') ? 5 : bonusValues[id] || 0), 0)
  for (const [id, record] of Object.entries(mining.rooms)) {
    if (!record.done) continue
    const [zone, number] = id.split(':').map(Number)
    const room = roomFor(mining.seed, zone, number)
    cents += rewardFor(room, record)
    if (!minerals[room.outcome]) continue
    const item = found[room.outcome] ||= { count: 0, deepest: 0, value: 0, first: record.at, size: 'Small deposit', replay: room }
    item.count += 1
    item.deepest = Math.max(item.deepest, room.depth)
    item.value += rewardFor(room, record) - (room.hazard ? 2 : 0)
    item.first = item.first < record.at ? item.first : record.at
    if (['Small deposit', 'Rich vein', 'Motherlode'].indexOf(room.size) > ['Small deposit', 'Rich vein', 'Motherlode'].indexOf(item.size)) item.size = room.size
  }
  const unlocked = tools.filter((tool) => deepest >= tool.depth || found[tool.mineral])
  return { cents, found, unlocked, tool: unlocked.at(-1), scanner: deepest >= 1000 || !!found.silver }
}

export function applyMiningAction(mining, room, action, power = 1, at = new Date().toISOString()) {
  const current = mining.rooms[room.id] || untouched
  if (current.done) return mining
  let next = { ...current }
  if (action.type === 'inspect') {
    next.inspected = true
    if (!current.inspected && room.event === 'Miner’s Luck') next.hits = Math.min(room.hardness - 1, 2)
  }
  else if (action.type === 'scan') next.scanned = true
  else if (action.type === 'symbol' && current.inspected && !current.ready) {
    if (action.symbol === room.pattern[current.pattern]) next.pattern += 1
    else { next.pattern = 0; next.misses += 1 }
    if (next.pattern === 3) next.ready = true
  } else if (action.type === 'strike' && current.inspected && !current.hazard) {
    if ((room.zone === 2 || room.outcome === 'sol') && !current.ready) return mining
    if (room.outcome === 'sol' && (!current.scanned || power < 5)) return mining
    next.misses += action.explosive ? 2 : action.accurate ? 0 : 1
    next.hits += action.explosive ? 7 : action.accurate ? Math.min(7, Math.max(1, power)) : 1
    if (next.hits >= room.hardness) {
      next.stage += 1
      next.hits = 0
      if (next.stage >= room.stages) {
        next.hazard = !!room.hazard
        next.done = !room.hazard
      }
    }
  } else if (action.type === 'rescue' && current.hazard) {
    if (action.symbol !== room.pattern[current.rescueStep || 0]) next.rescueStep = 0
    else next.rescueStep = (current.rescueStep || 0) + 1
    if (next.rescueStep === 3) { next.hazard = false; next.done = true }
  } else return mining
  if (next.done) next.at = at
  return { ...mining, rooms: { ...mining.rooms, [room.id]: next } }
}

export function normalizeMining(value) {
  if (!value || value.version !== 1 || typeof value.seed !== 'string' || value.seed.length > 100 || !value.seed.length) return newMining()
  const result = newMining(value.seed)
  const integer = (v, max) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v, max) : 0
  result.branches = result.branches.map((_, i) => integer(value.branches?.[i], 999))
  result.cosmetic = value.cosmetic === true
  result.bonuses = [...new Set(Array.isArray(value.bonuses) ? value.bonuses : [])].filter((id) => typeof id === 'string' && (Object.hasOwn(bonusValues, id) || miningMilestones.some((depth) => id === `depth:${depth}`)))
  if (value.rooms && typeof value.rooms === 'object') {
    for (const [id, record] of Object.entries(value.rooms).slice(0, 21000)) {
      if (!/^[0-6]:\d{1,4}$/.test(id) || !record || typeof record !== 'object') continue
      const [zone, number] = id.split(':').map(Number)
      if (number > 2999) continue
      const room = roomFor(result.seed, zone, number)
      result.rooms[id] = {
        hits: integer(record.hits, room.hardness - 1), misses: integer(record.misses, 10000),
        stage: integer(record.stage, room.stages), pattern: integer(record.pattern, 3),
        rescueStep: integer(record.rescueStep, 3),
        inspected: record.inspected === true, scanned: record.scanned === true, ready: record.ready === true,
        hazard: record.hazard === true, done: record.done === true,
        at: Number.isFinite(Date.parse(record.at)) ? new Date(record.at).toISOString() : new Date(0).toISOString(),
      }
    }
  }
  return result
}

export const formatSOL = (cents) => (cents / 100).toFixed(2)

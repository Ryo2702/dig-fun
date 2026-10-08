import test from 'node:test'
import assert from 'node:assert/strict'
import { minerals } from '../src/data/minerals.js'
import { applyMiningAction, miningSummary, newMining, normalizeMining, rewardFor, roomFor } from '../src/utils/mining.js'
import { normalizeProgress, parseProgress } from '../src/utils/storage.js'

function findRoom(outcome, zone = 5) {
  for (let i = 0; i < 50000; i++) {
    const room = roomFor('regression-mine', zone, i)
    if (room.outcome === outcome) return room
  }
  throw new Error(`No fixture for ${outcome}`)
}

function excavate(room, accurate = true) {
  let state = newMining('regression-mine')
  state = applyMiningAction(state, room, { type: 'inspect' })
  state = applyMiningAction(state, room, { type: 'scan' })
  for (const symbol of room.pattern) state = applyMiningAction(state, room, { type: 'symbol', symbol })
  for (let i = 0; i < 100 && !state.rooms[room.id].done && !state.rooms[room.id].hazard; i++) {
    state = applyMiningAction(state, room, { type: 'strike', accurate }, 7)
  }
  if (state.rooms[room.id].hazard) for (const symbol of room.pattern) state = applyMiningAction(state, room, { type: 'rescue', symbol })
  return state
}

test('seed reproduces rooms and partially mined walls across JSON reload', () => {
  const room = findRoom('gold')
  const mining = applyMiningAction(newMining('regression-mine'), room, { type: 'inspect' })
  const damaged = applyMiningAction(mining, room, { type: 'strike', accurate: true }, 2)
  const reloaded = normalizeMining(JSON.parse(JSON.stringify(damaged)))
  assert.deepEqual(roomFor(reloaded.seed, room.zone, room.number), room)
  assert.equal(reloaded.rooms[room.id].hits, damaged.rooms[room.id].hits)
})

test('scarcity order holds over a fixed population; majority of walls are unvaluable', () => {
  const counts = Object.fromEntries(Object.keys(minerals).map((key) => [key, 0]))
  const total = 60000
  for (let i = 0; i < total; i++) {
    const room = roomFor('rarity-audit', 6, i)
    if (Object.hasOwn(counts, room.outcome)) counts[room.outcome]++
  }
  const numbers = Object.values(counts)
  assert.ok(numbers.every((count, i) => count > 0 && (i === 0 || count < numbers[i - 1])), JSON.stringify(counts))
  assert.ok(numbers.reduce((a, b) => a + b, 0) < total * .4)
  for (let zone = 0; zone < 4; zone++) for (let i = 0; i < 3000; i++) assert.notEqual(roomFor('depth-gates', zone, i).outcome, 'sol')
})

test('mineral payouts remain in fictional ranges and repeated actions cannot pay twice', () => {
  for (const [kind, mineral] of Object.entries(minerals)) {
    const room = findRoom(kind)
    const completed = excavate(room)
    assert.equal(completed.rooms[room.id].done, true)
    const reward = rewardFor(room, completed.rooms[room.id]) - (room.hazard ? 2 : 0)
    assert.ok(reward >= mineral.min && reward <= mineral.max)
    assert.equal(applyMiningAction(completed, room, { type: 'strike', accurate: true }, 7), completed)
    const damaged = excavate(room, false)
    assert.ok(rewardFor(room, damaged.rooms[room.id]) <= rewardFor(room, completed.rooms[room.id]))
  }
})

test('SOL chamber requires inspection, scanning, tool, seal puzzle and all stages', () => {
  const room = findRoom('sol')
  let state = newMining('regression-mine')
  assert.equal(applyMiningAction(state, room, { type: 'strike', accurate: true }, 7), state)
  state = applyMiningAction(state, room, { type: 'inspect' })
  for (const symbol of room.pattern) state = applyMiningAction(state, room, { type: 'symbol', symbol })
  assert.equal(applyMiningAction(state, room, { type: 'strike', accurate: true }, 7), state)
  state = applyMiningAction(state, room, { type: 'scan' })
  assert.equal(applyMiningAction(state, room, { type: 'strike', accurate: true }, 1), state)
  state = applyMiningAction(state, room, { type: 'strike', accurate: true }, 7)
  assert.equal(state.rooms[room.id].done, false)
  assert.equal(room.stages, 3)
})

test('hazards need a correct safety sequence and retain all earlier discoveries', () => {
  const gold = findRoom('gold')
  const gas = findRoom('gas')
  let state = excavate(gold)
  const previous = state.rooms[gold.id]
  state = applyMiningAction(state, gas, { type: 'inspect' })
  for (let i = 0; i < 20 && !state.rooms[gas.id].hazard; i++) state = applyMiningAction(state, gas, { type: 'strike', accurate: true }, 7)
  assert.equal(state.rooms[gas.id].hazard, true)
  state = applyMiningAction(state, gas, { type: 'rescue', symbol: (gas.pattern[0] + 1) % 3 })
  assert.equal(state.rooms[gas.id].done, false)
  for (const symbol of gas.pattern) state = applyMiningAction(state, gas, { type: 'rescue', symbol })
  assert.equal(state.rooms[gas.id].done, true)
  assert.deepEqual(state.rooms[gold.id], previous)
  assert.equal(rewardFor(gas, state.rooms[gas.id]), 2)
})

test('new and old saves migrate and mining imports remove malformed state', () => {
  const migrated = normalizeProgress({ deepest: 420, artifacts: [] })
  assert.ok(migrated.mining.seed)
  const imported = normalizeMining({ version: 1, seed: 'test', rooms: { '99:1': {}, '0:0': { hits: Infinity, misses: -1 } }, branches: [Infinity], bonuses: ['depth:100', 'depth:100', 'fake'] })
  assert.equal(imported.branches[0], 0)
  assert.equal(imported.rooms['99:1'], undefined)
  assert.equal(imported.rooms['0:0'].hits, 0)
  assert.deepEqual(imported.bonuses, ['depth:100'])
  assert.throws(() => parseProgress('{}'))
  assert.equal(miningSummary(imported).cents, 5)
})

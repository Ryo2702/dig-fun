import test from 'node:test'
import assert from 'node:assert/strict'
import { emptySOL, awardSOL, formatSOL, rewardAmount, REWARD_RANGES, normalizeSOL } from '../src/utils/sol.js'
import { createGame, restore, serialize, step, interact, turnDial, DEFAULT_SETTINGS } from '../src/utils/world.js'
const tick = (g, seconds = 1) => { for (let n = 0; n < seconds * 60; n++) step(g, {}, 1 / 60) }
test('new SOL balance starts at zero and integer thousandths add exactly', () => {
  const g = createGame(); assert.equal(formatSOL(g.sol.balance), '0.000 SOL')
  for (let i = 1; i <= 10; i++) awardSOL(g, `ore:${i},10`, 1, 'COPPER DEPOSIT')
  assert.equal(g.sol.balance, 10); assert.equal(formatSOL(g.sol.balance), '0.010 SOL'); assert.equal(g.solSession, 10)
})
test('each deterministic reward stays within its configured range', () => {
  for (const [kind, [min, max]] of Object.entries(REWARD_RANGES)) for (let i = 0; i < 100; i++) {
    const value = rewardAmount(kind, String(i)); assert.ok(Number.isInteger(value) && value >= min && value <= max)
    assert.equal(value, rewardAmount(kind, String(i)))
  }
})
test('deposits award only on nearby collection and cannot be replayed after reload', () => {
  const g = createGame(); g.drops = [{ x: 15, y: 7, type: 'gold', amount: 2, born: -1 }]; tick(g)
  assert.equal(g.sol.balance, 0); g.player.x = 15.1; tick(g)
  const reward = g.sol.balance; assert.ok(reward >= 20 && reward <= 100); assert.equal(g.sol.latest.source, 'GOLD DEPOSIT')
  const next = restore(JSON.parse(JSON.stringify(serialize(g, DEFAULT_SETTINGS)))).g
  assert.equal(next.sol.balance, reward); assert.equal(next.solSession, 0)
  next.drops = [{ x: 15, y: 7, type: 'gold', amount: 2, born: -1 }]; tick(next)
  assert.equal(next.sol.balance, reward)
})
test('all ore types convert directly into SOL, preserving only discovery records', () => {
  for (const kind of ['copper', 'silver', 'gold', 'diamond', 'sol']) {
    const g = createGame(); g.drops = [{ x: 9, y: 7, type: kind, amount: 1, born: -1 }]; tick(g)
    assert.ok(g.sol.balance >= REWARD_RANGES[kind][0]); assert.ok(g.sol.balance <= REWARD_RANGES[kind][1]); assert.equal(g.sol.total, g.sol.balance)
  }
})
test('depth and chamber bonuses are paid once across repeat visits and saves', () => {
  const g = createGame(); g.player.x = 6.175; g.player.y = 18.1; tick(g)
  assert.equal(g.sol.balance, 10); tick(g); assert.equal(g.sol.balance, 10)
  g.player.x = 10.175; g.player.y = 26.1; tick(g)
  assert.ok(g.sol.claimed['chamber:1']); const total = g.sol.total
  const next = restore(serialize(g, DEFAULT_SETTINGS)).g; tick(next); assert.equal(next.sol.total, total)
})
test('rewarding artifacts and completed puzzles pay only once', () => {
  const g = createGame(); g.player.x = 11.175; g.player.y = 124.1; g.broken = 110; g.tool = 5
  interact(g); assert.equal(g.sol.latest.source, 'RARE ARTIFACT'); const reward = g.sol.balance; interact(g); assert.equal(g.sol.balance, reward)
  const artifact = { id: '12,26', outcome: 'puzzle', solved: false, dials: [0, 0, 0] }
  turnDial(g, artifact, 0); turnDial(g, artifact, 1); assert.equal(g.sol.balance, reward)
  turnDial(g, artifact, 1); assert.ok(g.sol.balance > reward); const total = g.sol.balance; turnDial(g, artifact, 2); assert.equal(g.sol.balance, total)
})
test('largest, latest, lifetime and session statistics are independent', () => {
  const g = createGame(); awardSOL(g, 'ore:10,10', 80, 'GOLD DEPOSIT'); awardSOL(g, 'ore:11,10', 3, 'COPPER DEPOSIT')
  assert.equal(g.sol.balance, 83); assert.equal(g.sol.total, 83); assert.equal(g.sol.largest, 80); assert.deepEqual(g.sol.latest, { amount: 3, source: 'COPPER DEPOSIT' })
  const next = restore(serialize(g, DEFAULT_SETTINGS)).g; awardSOL(next, 'ore:12,10', 5, 'COPPER DEPOSIT')
  assert.equal(next.solSession, 5); assert.equal(next.sol.total, 88); assert.equal(next.sol.largest, 80)
})
test('old saves keep discoveries and start SOL at zero; malformed amounts are rejected', () => {
  const next = restore({version: 2, inventory: { gold: 9 }, player: {x:9.15,y:7.1}}).g
  assert.equal(next.inventory.gold, 9); assert.deepEqual(next.sol, emptySOL())
  const normalized = normalizeSOL({ balance: Infinity, total: -1, largest: 1.5, latest: {amount:999,source:'fake'}, claimed: { 'ore:10,10': true, 'depth:9999': true } })
  assert.equal(normalized.balance, 0); assert.equal(normalized.total, 0); assert.equal(normalized.latest, null); assert.deepEqual(normalized.claimed, { 'ore:10,10': true })
  assert.equal(awardSOL(next, 'ore:10,10', NaN, 'INVALID'), false); assert.equal(awardSOL(next, 'ore:10,10', .5, 'INVALID'), false)
})

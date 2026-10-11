import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOfflineProgress, autoDecision, createAutonomy, finishPuzzle, restoreAutonomy, routeToBlock, serializeAutonomy, spawnBuyer, startPuzzle, tickCrew } from '../src/utils/autonomy.js'
import { activityConfig, minerTraits, pollLiveBuys, shortenAddress } from '../src/utils/activity.js'
import { createGame, DEFAULT_SETTINGS, reveal, step } from '../src/utils/world.js'

test('autonomy creates eight named miners and survives a safe round trip', () => {
  const state = createAutonomy(100)
  assert.equal(state.miners.length, 8)
  assert.ok(state.miners.some(miner => miner.name === 'SOL Digger'))
  const restored = restoreAutonomy(JSON.parse(JSON.stringify(serializeAutonomy(state))), 200)
  assert.equal(restored.miners.length, 8)
  assert.equal(restored.miners[0].name, 'Drillbit Dan')
  assert.equal(restored.auto.strategy, 'follow-sparkles')
  assert.equal(restored.auto.enabled, true)
})

test('the player loop starts mining immediately and introduces the crew after the first break', () => {
  const g = createGame()
  const state = createAutonomy(0)
  reveal(g)
  for (let i = 0; i < 180; i++) {
    const decision = autoDecision(g, state.auto, 1 / 60)
    if (decision.target) g.target = decision.target
    step(g, decision.input, 1 / 60, DEFAULT_SETTINGS)
    tickCrew(state, g, 1 / 60)
  }
  assert.ok(g.broken > 0)
  assert.equal(state.crewIntroduced, true)
})

test('auto decisions stay within revealed mine tiles and expose the selected strategy', () => {
  const g = createGame()
  reveal(g)
  const auto = { enabled: true, strategy: 'go-deep', target: null, decision: '', distance: 0, confidence: 0 }
  const decision = autoDecision(g, auto)
  assert.ok(decision.target)
  assert.ok(g.seen[decision.target.x + ',' + decision.target.y])
  assert.ok(decision.distance >= 0)
  assert.ok(decision.confidence >= 42 && decision.confidence <= 96)
})

test('crew simulation advances time and offline progress is capped without rare finds', () => {
  const g = createGame()
  reveal(g)
  const state = createAutonomy(0)
  for (let i = 0; i < 900; i++) tickCrew(state, g, 1 / 30)
  assert.ok(state.time > 20)
  assert.ok(state.miners.every(miner => miner.x >= 1 && miner.x < 79))
  const summary = applyOfflineProgress(state, g, 1000 * 60 * 60 * 5)
  assert.equal(summary.blocks, 80)
  assert.equal(summary.meters, 15.2)
  assert.equal(summary.keys, 2)
  assert.equal(summary.diamond, undefined)
  assert.equal(summary.sol, undefined)
})

test('puzzle assist gives a clue and solve modes complete the chamber', () => {
  const state = createAutonomy(0)
  const g = createGame()
  state.puzzle = { id: 'test', minerId: 'breaker', title: 'THE UNBLINKING DOOR', progress: 0, mode: 'waiting', done: false }
  assert.equal(finishPuzzle(state, g, 'assist'), true)
  assert.match(state.puzzle.clue, /brightest rune/)
  assert.equal(finishPuzzle(state, g, 'manual'), true)
  assert.equal(state.puzzle.done, true)
  assert.equal(state.miners.find(miner => miner.id === 'breaker').puzzles, 1)
  const autoState = createAutonomy(0)
  autoState.puzzle = { id: 'auto', minerId: 'breaker', title: 'THE UNBLINKING DOOR', progress: 0, mode: 'waiting', done: false }
  assert.equal(finishPuzzle(autoState, g, 'auto'), true)
  assert.equal(autoState.puzzle.done, false)
  for (let i = 0; i < 700; i++) tickCrew(autoState, g, 1 / 30)
  assert.equal(autoState.puzzle.done, true)
})

test('player puzzle solving is timed and marks the local artifact solved', () => {
  const state = createAutonomy(0)
  const g = createGame()
  g.artifacts.push({ id: '26,26', outcome: 'puzzle', solved: false, dials: [0, 0, 0] })
  assert.equal(startPuzzle(state, g, 'player', '26,26'), true)
  assert.ok(state.puzzle.duration >= 6 && state.puzzle.duration <= 12)
  for (let i = 0; i < 900 && !state.puzzle.done; i++) tickCrew(state, g, 1 / 60)
  assert.equal(state.puzzle.done, true)
  assert.equal(g.artifacts[0].solved, true)
})

test('buyer identities are deterministic, repeat buys recharge one miner, and demo activity stays labeled', () => {
  const wallet = '7Ks9Qp4nJtF3xV8sL2mR6cD1wH5bY9aZ4eP8uN3k'
  assert.deepEqual(minerTraits(wallet), minerTraits(wallet))
  assert.equal(shortenAddress(wallet), '7Ks9...uN3k')
  const state = createAutonomy(0)
  const g = createGame()
  const first = spawnBuyer(state, g, { id: 'buy-1', wallet, amount: 4.8, unit: 'SOL', source: 'demo', verified: false })
  const second = spawnBuyer(state, g, { id: 'buy-2', wallet, amount: 12, unit: 'SOL', source: 'demo', verified: false })
  assert.equal(first, second)
  assert.equal(state.miners.filter(miner => miner.wallet === wallet).length, 1)
  assert.equal(first.purchaseCount, 2)
  assert.equal(first.tool, 'Gold power drill')
  assert.equal(state.activity.join.source, 'demo')
  assert.equal(state.community.simulatedBuys, 2)
  spawnBuyer(state, g, { id: 'buy-3', wallet, amount: 75, unit: 'SOL', source: 'demo', verified: false })
  spawnBuyer(state, g, { id: 'buy-4', wallet, amount: 75, unit: 'SOL', source: 'demo', verified: false })
  assert.ok(state.miners.some(miner => miner.name.endsWith('ASSIST')))
})

test('mine announcements queue and major banners expire locally', () => {
  const state = createAutonomy(0)
  const g = createGame()
  spawnBuyer(state, g, { id: 'queue-1', wallet: '7Ks9Qp4nJtF3xV8sL2mR6cD1wH5bY9aZ4eP8uN3k', amount: 1.2, unit: 'SOL', source: 'demo', verified: false })
  spawnBuyer(state, g, { id: 'queue-2', wallet: '3Hp4Qp4nJtF3xV8sL2mR6cD1wH5bY9aZ4eP8uN3k', amount: 4.8, unit: 'SOL', source: 'demo', verified: false })
  assert.ok(state.noticeCurrent)
  assert.ok(state.noticeQueue.length >= 1)
  state.major = { id: 'test-major', title: 'TEST', subtitle: 'local', expires: state.time + .5 }
  for (let i = 0; i < 40; i++) tickCrew(state, g, 1 / 60)
  assert.equal(state.major, null)
  assert.notEqual(state.ticker, '')
})

test('crew routes are bounded, tile-aligned, and reserve different ordinary targets', () => {
  const g = createGame()
  const state = createAutonomy(0)
  reveal(g)
  const route = routeToBlock(g, { x: 9, y: 7 }, { x: 9, y: 8 }, state, state.miners[0])
  assert.ok(route)
  assert.ok(route.length <= 28)
  for (const [index, cell] of route.entries()) {
    assert.equal(Number.isInteger(cell.x), true)
    assert.equal(Number.isInteger(cell.y), true)
    if (index) assert.equal(Math.abs(cell.x - route[index - 1].x) + Math.abs(cell.y - route[index - 1].y), 1)
  }
  for (let i = 0; i < 240; i++) tickCrew(state, g, 1 / 60)
  assert.equal(new Set(state.reservations.map(item => `${item.x},${item.y}`)).size, state.reservations.length)
  assert.ok(state.miners.every(miner => Number.isInteger(Math.round((miner.renderX ?? miner.x) * 16))))
  assert.ok(state.reservations.every(item => {
    const miner = state.miners.find(candidate => candidate.id === item.minerId)
    return miner?.target?.x === item.x && miner?.target?.y === item.y
  }))
})

test('invalid targets are released and stuck recovery keeps miners in safe bounds', () => {
  const g = createGame()
  const state = createAutonomy(0)
  reveal(g)
  const miner = state.miners[0]
  miner.initialized = true
  miner.target = { x: 0, y: 0 }
  miner.targetType = 'bedrock'
  state.reservations.push({ minerId: miner.id, x: 0, y: 0, key: '0,0', reservedAt: 0, expires: 20, action: 'target' })
  tickCrew(state, g, 1 / 60)
  assert.equal(state.reservations.some(item => item.minerId === miner.id && item.x === 0), false)
  assert.ok(miner.x > 0 && miner.x < 79 && miner.y > 0 && miner.y < 179)
  assert.notEqual(miner.state, 'walking')
})

test('live read-only polling only emits verified public balance deltas', async () => {
  const mint = 'So11111111111111111111111111111111111111112'
  const wallet = '7Ks9Qp4nJtF3xV8sL2mR6cD1wH5bY9aZ4eP8uN3k'
  const activity = { source: { liveConfigured: true, rpcUrl: 'https://rpc.example', address: mint, coinMint: mint, poolAddress: '', unit: 'SOL' }, seenSignatures: [] }
  const fetchMock = async (_, options) => {
    const body = JSON.parse(options.body)
    if (body.method === 'getSignaturesForAddress') return { ok: true, json: async () => ({ result: [{ signature: 'verified-buy' }] }) }
    return { ok: true, json: async () => ({ result: { blockTime: 10, transaction: { message: { accountKeys: [{ pubkey: wallet, signer: true }] } }, meta: { err: null, preTokenBalances: [{ mint, owner: wallet, uiTokenAmount: { uiAmount: 0 } }], postTokenBalances: [{ mint, owner: wallet, uiTokenAmount: { uiAmount: 4.8 } }] } } }) }
  }
  const events = await pollLiveBuys(activity, fetchMock)
  assert.equal(events.length, 1)
  assert.equal(events[0].verified, true)
  assert.equal(events[0].wallet, wallet)
  assert.equal(events[0].amount, 4.8)
  assert.equal(activity.mode, 'live')
})

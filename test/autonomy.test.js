import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOfflineProgress, autoDecision, createAutonomy, finishPuzzle, restoreAutonomy, serializeAutonomy, tickCrew } from '../src/utils/autonomy.js'
import { createGame, reveal } from '../src/utils/world.js'

test('autonomy creates eight named simulated miners and survives a safe round trip', () => {
  const state = createAutonomy(100)
  assert.equal(state.miners.length, 8)
  assert.ok(state.miners.some(miner => miner.name === 'SOL Digger'))
  const restored = restoreAutonomy(JSON.parse(JSON.stringify(serializeAutonomy(state))), 200)
  assert.equal(restored.miners.length, 8)
  assert.equal(restored.miners[0].name, 'Drillbit Dan')
  assert.equal(restored.auto.strategy, 'follow-sparkles')
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

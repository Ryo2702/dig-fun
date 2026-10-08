import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProgress, parseProgress } from '../src/utils/storage.js'
import { effectForSignature, queueActivity } from '../src/utils/activity.js'

test('old saves are upgraded without losing progress', () => {
  const progress = normalizeProgress({ deepest: 420, artifacts: [{ id: 'coin', discoveredAt: '2026-01-01' }] })
  assert.equal(progress.deepest, 420)
  assert.equal(progress.artifacts[0].id, 'coin')
  assert.equal(progress.stats.rocksBroken, 0)
})

test('import rejects non-object saves and clamps negative values', () => {
  assert.throws(() => parseProgress('[]'), /not a DIG\.FUN save/)
  assert.equal(parseProgress('{"deepest":-4,"stats":{"diggingSeconds":-2}}').deepest, 0)
  assert.equal(parseProgress('{"deepest":"Infinity","artifacts":[{"id":"coin","discoveredAt":"nope"}]}').deepest, 0)
  assert.equal(parseProgress('{"artifacts":[{"id":"coin"},{"id":"coin"}]}').artifacts.length, 1)
})

test('activity effects are deterministic and bursts collapse into one wave', () => {
  assert.equal(effectForSignature('same-signature'), effectForSignature('same-signature'))
  assert.deepEqual(queueActivity(Array.from({ length: 5 }, (_, index) => ({ signature: `sig-${index}` })))[0].effect, 'wave')
})

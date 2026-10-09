import test from 'node:test'
import assert from 'node:assert/strict'
import { walletProvider, walletAddress, connectWallet } from '../src/utils/wallet.js'
const address = 'So11111111111111111111111111111111111111112'
test('detects each injected provider and does not substitute an unknown wallet', () => {
  const phantom = { isPhantom: true }, solflare = { isSolflare: true }
  assert.equal(walletProvider('Phantom', { phantom: { solana: phantom } }), phantom)
  assert.equal(walletProvider('Phantom', { solana: phantom }), phantom)
  assert.equal(walletProvider('Solflare', { solflare }), solflare)
  assert.equal(walletProvider('Phantom', { solana: {} }), null)
  assert.equal(walletProvider('Unknown', {}), null)
})
test('connects by requesting only a public address', async () => {
  let calls = 0
  const provider = { connect: async () => { calls++; return { publicKey: { toBase58: () => address } } }, signTransaction: () => assert.fail('Must never sign') }
  assert.equal(await connectWallet(provider), address); assert.equal(calls, 1)
  assert.equal(await connectWallet({ connect: async () => {}, publicKey: { toString: () => address } }), address)
})
test('handles unavailable, rejected and malformed wallet responses', async () => {
  await assert.rejects(connectWallet(null), /not detected/)
  await assert.rejects(connectWallet({ connect: async () => { throw new Error('User rejected') } }), /rejected/)
  await assert.rejects(connectWallet({ connect: async () => ({ publicKey: 'invalid' }) }), /valid Solana/)
  assert.equal(walletAddress(null), null); assert.equal(walletAddress({}), null)
})

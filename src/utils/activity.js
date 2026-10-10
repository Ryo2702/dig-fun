export function effectForSignature(signature) {
  const score = [...signature.slice(0, 12)].reduce((total, character) => total + character.charCodeAt(0), 0)
  return score % 4 === 0 ? 'medium' : 'small'
}

export function queueActivity(items) {
  if (items.length > 4) {
    return [{ id: `wave-${items.at(-1).signature}`, effect: 'wave', count: items.length, demo: false }]
  }
  return items.map((item) => ({
    id: item.signature,
    signature: item.signature,
    effect: effectForSignature(item.signature),
    count: 1,
    demo: false,
  }))
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const COLORS = ['#f2b84b', '#bf8dff', '#65e3ec', '#ff7763', '#79d59c', '#e6a36c', '#9fb2d8', '#ff9f7b']
const SKINS = ['#d0a57b', '#9e6b4e', '#f0c89e', '#79513e', '#c48963', '#e8b88c']
const LAMPS = ['warm lamp', 'twin lamp', 'green lamp', 'purple lamp']
const PICKS = ['basic pickaxe', 'copper pickaxe', 'gold pickaxe', 'prism pickaxe']

const viteEnv = import.meta.env || {}
const runtimeConfig = typeof window !== 'undefined' ? window.__DIG_FUN_ACTIVITY__ || {} : {}

function textHash(value) {
  let result = 2166136261
  for (const character of String(value || '')) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function validPublicKey(value) {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value)
}

export function shortenAddress(address) {
  const value = String(address || 'UNKNOWN').trim()
  return value.length > 10 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value
}

export function minerTraits(address) {
  const seed = textHash(address)
  const pick = (list, offset = 0) => list[(Math.imul(seed ^ offset, 2654435761) >>> 0) % list.length]
  return {
    seed,
    helmet: pick(COLORS, 11),
    skin: pick(SKINS, 17),
    outfit: pick(COLORS, 23),
    lamp: pick(LAMPS, 29),
    pickaxe: pick(PICKS, 31),
    backpack: seed % 3 !== 0,
    idle: seed % 3,
    celebration: (seed >>> 4) % 3,
  }
}

export const PURCHASE_TIERS = [
  { id: 'small', label: 'BASIC PICKAXE', min: 0, equipment: 'Rusty pickaxe', speed: 1 },
  { id: 'medium', label: 'COPPER DRILL', min: 3, equipment: 'Copper drill', speed: 1.18 },
  { id: 'large', label: 'GOLD POWER DRILL', min: 10, equipment: 'Gold power drill', speed: 1.38 },
  { id: 'very-large', label: 'HEAVY EXPLOSIVE DRILL', min: 25, equipment: 'Heavy explosive drill', speed: 1.58 },
  { id: 'exceptional', label: 'RARE MINER SKIN', min: 60, equipment: 'Experimental SOL drill', speed: 1.8 },
]

export function purchaseTier(amount, tiers = PURCHASE_TIERS) {
  const value = Number.isFinite(Number(amount)) ? Math.max(0, Number(amount)) : 0
  return [...tiers].reverse().find(tier => value >= tier.min) || tiers[0]
}

export function formatPurchase(amount, unit = 'SOL') {
  const value = Number(amount) || 0
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits).replace(/\.00$/, '')} ${unit}`
}

export function activityConfig(overrides = {}) {
  const config = { ...runtimeConfig, ...overrides }
  const rpcUrl = String(config.rpcUrl || config.rpc || viteEnv.VITE_SOLANA_RPC_URL || '').trim()
  const coinMint = String(config.coinMint || viteEnv.VITE_COIN_MINT || '').trim()
  const poolAddress = String(config.poolAddress || config.pool || viteEnv.VITE_LIQUIDITY_POOL_ADDRESS || '').trim()
  const address = validPublicKey(coinMint) ? coinMint : validPublicKey(poolAddress) ? poolAddress : ''
  const requestedMode = String(config.mode || viteEnv.VITE_ACTIVITY_MODE || (rpcUrl && address ? 'live' : 'demo')).toLowerCase()
  const liveConfigured = requestedMode === 'live' && Boolean(rpcUrl && address)
  return {
    mode: liveConfigured ? 'live' : 'demo',
    rpcUrl,
    coinMint: validPublicKey(coinMint) ? coinMint : '',
    poolAddress: validPublicKey(poolAddress) ? poolAddress : '',
    address,
    unit: String(config.unit || viteEnv.VITE_ACTIVITY_UNIT || 'SOL').slice(0, 12),
    tiers: Array.isArray(config.tiers) && config.tiers.length ? config.tiers.map((tier, index) => ({ ...PURCHASE_TIERS[index] || PURCHASE_TIERS[0], ...tier, min: Math.max(0, Number(tier.min) || 0) })).sort((a, b) => a.min - b.min) : PURCHASE_TIERS,
    liveConfigured,
  }
}

export function demoWallet(index) {
  let seed = textHash(`dig.fun.demo.${index}`)
  let value = ''
  for (let i = 0; i < 44; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    value += BASE58[seed % BASE58.length]
  }
  return value
}

export function createDemoPurchase(index, amount = null, unit = 'SOL') {
  const wallet = demoWallet(index)
  const values = [1.2, 4.8, 12, 28, 75]
  return {
    id: `demo-buy-${index}`,
    wallet,
    amount: amount == null ? values[index % values.length] : amount,
    unit,
    source: 'demo',
    verified: false,
    signature: `SIM-${textHash(wallet).toString(16).toUpperCase()}`,
    detectedAt: Date.now(),
  }
}

async function rpcCall(rpcUrl, method, params, fetchImpl) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), 6500) : null
  let response
  try {
    response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller?.signal,
    })
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (!response.ok) throw new Error(`RPC ${response.status}`)
  const payload = await response.json()
  if (payload.error) throw new Error(payload.error.message || 'RPC unavailable')
  return payload.result
}

function balanceDelta(transaction, config, buyer) {
  const meta = transaction?.meta
  if (!meta || meta.err) return null
  const keys = transaction.transaction.message.accountKeys.map(key => typeof key === 'string' ? key : key.pubkey)
  if (config.coinMint) {
    const before = new Map((meta.preTokenBalances || []).filter(row => row.mint === config.coinMint && row.owner).map(row => [row.owner, Number(row.uiTokenAmount?.uiAmount || 0)]))
    const after = new Map((meta.postTokenBalances || []).filter(row => row.mint === config.coinMint && row.owner).map(row => [row.owner, Number(row.uiTokenAmount?.uiAmount || 0)]))
    const delta = (after.get(buyer) || 0) - (before.get(buyer) || 0)
    return delta > 0 ? { amount: delta, unit: config.unit } : null
  }
  const poolIndex = keys.indexOf(config.poolAddress)
  const buyerIndex = keys.indexOf(buyer)
  if (poolIndex < 0 || buyerIndex < 0) return null
  const poolDelta = (meta.postBalances?.[poolIndex] || 0) - (meta.preBalances?.[poolIndex] || 0)
  const buyerDelta = (meta.postBalances?.[buyerIndex] || 0) - (meta.preBalances?.[buyerIndex] || 0)
  return poolDelta > 0 && buyerDelta < 0 ? { amount: poolDelta / 1_000_000_000, unit: 'SOL' } : null
}

function parsePurchase(transaction, signature, config) {
  const keys = transaction?.transaction?.message?.accountKeys || []
  const buyer = keys.map(key => typeof key === 'string' ? key : key.pubkey).find((key, index) => typeof keys[index] === 'string' || keys[index]?.signer)
  if (!buyer) return null
  const delta = balanceDelta(transaction, config, buyer)
  if (!delta) return null
  return { id: signature, signature, wallet: buyer, amount: delta.amount, unit: delta.unit, source: 'live', verified: true, detectedAt: transaction.blockTime ? transaction.blockTime * 1000 : Date.now() }
}

export async function pollLiveBuys(activity, fetchImpl = globalThis.fetch) {
  if (!activity?.source?.liveConfigured || typeof fetchImpl !== 'function') return []
  try {
    const signatures = await rpcCall(activity.source.rpcUrl, 'getSignaturesForAddress', [activity.source.address, { limit: 20 }], fetchImpl)
    const seen = new Set(activity.seenSignatures || [])
    const fresh = []
    for (const entry of Array.isArray(signatures) ? signatures.slice(0, 10) : []) {
      if (!entry?.signature || seen.has(entry.signature) || entry.err) continue
      seen.add(entry.signature)
      const transaction = await rpcCall(activity.source.rpcUrl, 'getTransaction', [entry.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], fetchImpl)
      const purchase = parsePurchase(transaction, entry.signature, activity.source)
      if (purchase) fresh.push(purchase)
    }
    activity.seenSignatures = [...seen].slice(-200)
    activity.mode = 'live'
    activity.liveAvailable = true
    activity.error = ''
    activity.lastChecked = Date.now()
    return fresh.reverse()
  } catch (error) {
    activity.mode = 'demo'
    activity.liveAvailable = false
    activity.error = 'Public source unavailable; demo activity is running.'
    activity.lastChecked = Date.now()
    return []
  }
}

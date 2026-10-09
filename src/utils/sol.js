// All amounts are integer thousandths of fictional SOL, never wallet balances.
export const REWARD_RANGES = { copper: [1, 5], silver: [5, 20], gold: [20, 100], diamond: [100, 500], sol: [500, 2000], artifact: [50, 350], puzzle: [25, 150], chamber: [25, 125] }
export const DEPTH_REWARDS = { 1: 10, 3: 25, 5: 50, 10: 100, 15: 200 }
export const formatSOL = amount => `${(amount / 1000).toFixed(3)} SOL`
export const emptySOL = () => ({ balance: 0, total: 0, largest: 0, latest: null, claimed: {} })
const MAX = 1_000_000_000_000
const amount = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX ? value : 0
const validId = id => /^(ore|artifact|puzzle):([1-9]|[1-7]\d),(\d{1,2}|1[0-7]\d)$/.test(id) || /^depth:(1|3|5|10|15)$/.test(id) || /^chamber:([1-9]|1[0-2])$/.test(id)
export function rewardAmount(kind, id) {
  const range = REWARD_RANGES[kind]
  if (!range) return 0
  let seed = 2166136261
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0
  return range[0] + seed % (range[1] - range[0] + 1)
}
export function awardSOL(g, id, value, source) {
  if (!validId(id) || !amount(value) || g.sol.claimed[id]) return false
  const credited = Math.min(value, MAX - g.sol.total)
  if (!credited) return false
  g.sol.claimed[id] = true
  g.sol.balance += credited; g.sol.total += credited; g.sol.largest = Math.max(g.sol.largest, credited)
  g.sol.latest = { amount: credited, source }
  g.solSession += credited
  g.notice = `+${formatSOL(credited)} · ${source}`; g.noticeUntil = g.time + 3.5
  return true
}
export function normalizeSOL(value) {
  const sol = emptySOL()
  if (!value || typeof value !== 'object') return sol
  sol.total = amount(value.total)
  sol.balance = Math.min(amount(value.balance), sol.total)
  sol.largest = Math.min(amount(value.largest), sol.total)
  if (amount(value.latest?.amount) > 0 && value.latest.amount <= sol.largest && typeof value.latest.source === 'string') sol.latest = { amount: value.latest.amount, source: value.latest.source.slice(0, 80) }
  for (const [id, claimed] of Object.entries(value.claimed || {}).slice(0, 15000)) if (validId(id) && claimed === true) sol.claimed[id] = true
  return sol
}

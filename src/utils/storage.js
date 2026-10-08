import { normalizeMining } from './mining.js'

const PROGRESS_KEY = 'dig-fun-progress-v1'

export const emptyStats = {
  rocksBroken: 0,
  wallsInspected: 0,
  emptyRooms: 0,
  explosionsSurvived: 0,
  timesAlmostGivingUp: 0,
  oneMoreBlockDiscoveries: 0,
  creaturesDisturbed: 0,
  diggingSeconds: 0,
}

const emptyProgress = { deepest: 0, artifacts: [], stats: emptyStats }

export function normalizeProgress(value) {
  const safeNumber = (candidate, maximum = 1_000_000_000) => {
    const number = Number(candidate)
    return Number.isFinite(number) ? Math.min(maximum, Math.max(0, number)) : 0
  }
  const stats = Object.fromEntries(
    Object.keys(emptyStats).map((key) => [key, Math.floor(safeNumber(value?.stats?.[key]))]),
  )
  const seen = new Set()

  return {
    mining: normalizeMining(value?.mining),
    deepest: safeNumber(value?.deepest),
    artifacts: Array.isArray(value?.artifacts)
      ? value.artifacts
          .filter((item) => item && typeof item.id === 'string' && !seen.has(item.id) && seen.add(item.id))
          .slice(0, 100)
          .map(({ id, discoveredAt }) => ({
            id,
            discoveredAt: typeof discoveredAt === 'string' && Number.isFinite(Date.parse(discoveredAt))
              ? new Date(discoveredAt).toISOString()
              : new Date(0).toISOString(),
          }))
      : [],
    stats,
  }
}

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY))
    return normalizeProgress(saved)
  } catch {
    return normalizeProgress(emptyProgress)
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // The mine still works when storage is unavailable.
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    // Nothing else to reset.
  }
}

export function formatDepth(meters) {
  if (meters < 1000) return `${Math.max(0, Math.floor(meters))} m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`
}

export function parseProgress(text) {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.artifacts) && !Object.hasOwn(parsed, 'deepest')) {
    throw new Error('That file is not a DIG.FUN save.')
  }
  if (parsed.mining !== undefined && (!parsed.mining || parsed.mining.version !== 1 || typeof parsed.mining.seed !== 'string' || !parsed.mining.seed.length || parsed.mining.seed.length > 100)) {
    throw new Error('Unsupported mineral save. Your current mine was not changed.')
  }
  return normalizeProgress(parsed)
}

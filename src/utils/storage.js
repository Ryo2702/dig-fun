const PROGRESS_KEY = 'dig-fun-progress-v1'

const emptyProgress = { deepest: 0, artifacts: [] }

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY))
    return {
      deepest: Number(saved?.deepest) || 0,
      artifacts: Array.isArray(saved?.artifacts) ? saved.artifacts : [],
    }
  } catch {
    return emptyProgress
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

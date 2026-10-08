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

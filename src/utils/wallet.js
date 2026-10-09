export const WALLET_OPTIONS = [
  { name: 'Phantom', url: 'https://phantom.com/download' },
  { name: 'Solflare', url: 'https://solflare.com/download' },
]
export function walletProvider(name, host = window) {
  if (name === 'Phantom') return host.phantom?.solana?.isPhantom ? host.phantom.solana : host.solana?.isPhantom ? host.solana : null
  if (name === 'Solflare') return host.solflare?.isSolflare ? host.solflare : null
  return null
}
export function walletAddress(key) {
  const address = typeof key === 'string' ? key : key?.toBase58?.() || key?.toString?.()
  return typeof address === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) ? address : null
}
export async function connectWallet(provider) {
  if (typeof provider?.connect !== 'function') throw new Error('Wallet not detected. Install it or open this game in its mobile browser, then try again.')
  const result = await provider.connect()
  const address = walletAddress(result?.publicKey || provider.publicKey)
  if (!address) throw new Error('The wallet did not share a valid Solana address. Try connecting again.')
  return address
}

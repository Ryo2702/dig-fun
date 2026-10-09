import { useEffect, useRef, useState } from 'react'
import { connectWallet, walletAddress, walletProvider } from '../utils/wallet'

export default function useWallet() {
  const [connection, setConnection] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(null), cleanup = useRef(() => {}), busy = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cleanup.current() } }, [])
  async function connect(name) {
    if (busy.current || active.current) return
    busy.current = true; setPending(true); setError('')
    try {
      const provider = walletProvider(name), address = await connectWallet(provider)
      if (!mounted.current) return
      active.current = provider
      const disconnected = () => { cleanup.current(); active.current = null; setConnection(null) }
      const changed = key => { const next = walletAddress(key); if (next) setConnection({ name, address: next }); else disconnected() }
      provider.on?.('disconnect', disconnected); provider.on?.('accountChanged', changed)
      cleanup.current = () => { provider.removeListener?.('disconnect', disconnected); provider.removeListener?.('accountChanged', changed) }
      setConnection({ name, address })
    } catch (e) {
      if (mounted.current) setError(e?.code === 4001 || /reject|cancel|declin/i.test(e?.message || '') ? 'Connection cancelled. You can keep playing or try again.' : e?.message || 'Could not connect. Please try again.')
    } finally { busy.current = false; if (mounted.current) setPending(false) }
  }
  async function disconnect() {
    if (busy.current) return
    busy.current = true; setPending(true); setError('')
    try { await active.current?.disconnect(); cleanup.current(); active.current = null; if (mounted.current) setConnection(null) }
    catch { if (mounted.current) setError('Could not disconnect. Try again or disconnect from your wallet.') }
    finally { busy.current = false; if (mounted.current) setPending(false) }
  }
  return { connection, pending, error, connect, disconnect }
}

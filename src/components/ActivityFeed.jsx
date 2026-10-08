import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { queueActivity } from '../utils/activity'

const RPC_URL = 'https://solana.publicnode.com'
const VOTE_PROGRAM = 'Vote111111111111111111111111111111111111111'
const demoEffects = ['small', 'small', 'medium', 'small', 'wave', 'blast']

function shortSignature(signature) {
  return signature ? `${signature.slice(0, 5)}…${signature.slice(-4)}` : 'waiting for next signature'
}

export default function ActivityFeed({ onEffect }) {
  const [mode, setMode] = useState('live')
  const [status, setStatus] = useState('checking')
  const [active, setActive] = useState(null)
  const [lastSeen, setLastSeen] = useState(null)
  const queueRef = useRef([])
  const playingRef = useRef(false)
  const latestSignature = useRef(null)
  const timerRef = useRef(null)
  const pumpRef = useRef(null)
  const demoIndex = useRef(0)
  const effectRef = useRef(onEffect)
  const reducedMotion = useReducedMotion()
  effectRef.current = onEffect

  const pump = useCallback(() => {
    if (playingRef.current || document.hidden || !queueRef.current.length) return
    const next = queueRef.current.shift()
    playingRef.current = true
    setActive(next)
    effectRef.current(next.effect)
    timerRef.current = window.setTimeout(() => {
      playingRef.current = false
      setActive(null)
      pumpRef.current?.()
    }, reducedMotion ? 500 : next.effect === 'wave' || next.effect === 'blast' ? 1700 : 1050)
  }, [reducedMotion])
  pumpRef.current = pump

  const enqueue = useCallback((events) => {
    queueRef.current.push(...events)
    pumpRef.current?.()
  }, [])

  useEffect(() => {
    function resume() {
      if (!document.hidden) pumpRef.current?.()
    }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [])

  useEffect(() => {
    latestSignature.current = null
    queueRef.current = []

    if (mode === 'demo') {
      setStatus('demo')
      const emit = () => {
        if (document.hidden) return
        const index = demoIndex.current++
        const effect = demoEffects[index % demoEffects.length]
        const event = { id: `demo-${index}`, effect, count: effect === 'wave' ? 8 : 1, demo: true }
        setLastSeen(event)
        enqueue([event])
      }
      const first = window.setTimeout(emit, 700)
      const interval = window.setInterval(emit, 6500)
      return () => {
        window.clearTimeout(first)
        window.clearInterval(interval)
      }
    }

    setStatus('checking')
    const controller = new AbortController()

    async function poll() {
      if (document.hidden) return
      try {
        const response = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [VOTE_PROGRAM, { commitment: 'confirmed', limit: 8 }],
          }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`RPC ${response.status}`)
        const payload = await response.json()
        if (!Array.isArray(payload.result) || !payload.result.length) throw new Error('No activity returned')

        const visible = payload.result.filter((item) => !item.err)
        setStatus('live')
        setLastSeen(visible[0] || payload.result[0])
        if (latestSignature.current) {
          const boundary = visible.findIndex((item) => item.signature === latestSignature.current)
          const newItems = visible.slice(0, boundary === -1 ? visible.length : boundary)
          if (newItems.length) enqueue(queueActivity(newItems.reverse()))
        }
        latestSignature.current = payload.result[0].signature
      } catch (error) {
        if (error.name !== 'AbortError') setStatus('offline')
      }
    }

    poll()
    const interval = window.setInterval(poll, 10000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [enqueue, mode])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const label = status === 'live'
    ? 'RECENT SOLANA ACTIVITY'
    : status === 'demo'
      ? 'DEMO MODE · FICTIONAL EVENTS'
      : status === 'offline'
        ? 'PUBLIC FEED UNAVAILABLE'
        : 'CHECKING PUBLIC FEED'

  return (
    <aside className={`activity-feed is-${status}`} aria-label="Read-only Solana activity feed">
      <div className="activity-feed__signal" aria-hidden="true"><i /><i /><i /></div>
      <div className="activity-feed__copy">
        <strong>{label}</strong>
        <span>{mode === 'demo' ? 'No real transactions shown' : `Vote program · ${shortSignature(lastSeen?.signature)}`}</span>
      </div>
      <button type="button" onClick={() => setMode((current) => current === 'demo' ? 'live' : 'demo')}>
        {mode === 'demo' ? 'TRY LIVE' : 'DEMO'}
      </button>
      <AnimatePresence>
        {active && (
          <motion.div
            className={`activity-event activity-event--${active.effect}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            role="status"
          >
            <b>{active.effect === 'wave' ? `${active.count} SIGNAL BURST` : active.effect === 'blast' ? 'DEMO MEGA BLAST' : active.effect === 'medium' ? 'MULTI-HIT' : 'PICKAXE HIT'}</b>
            <small>{active.demo ? 'FICTIONAL DEMO EVENT' : 'SESSION ACTIVITY'}</small>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}

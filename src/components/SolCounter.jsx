import { useEffect, useRef, useState } from 'react'
import { formatSOL } from '../utils/sol'

export default function SolCounter({ sol, reduced, onOpen }) {
  const [shown, setShown] = useState(sol.balance), [flight, setFlight] = useState(null), [shining, setShining] = useState(false)
  const previous = useRef(sol.balance), display = useRef(sol.balance)
  useEffect(() => {
    const delta = sol.balance - previous.current, from = display.current, total = sol.balance
    previous.current = total
    if (delta <= 0 || reduced) { display.current = total; setShown(total); setFlight(null); setShining(false); return }
    const start = performance.now()
    setFlight({ amount: delta, id: start }); setShining(false)
    let frame
    function animate(now) {
      const elapsed = now - start, fraction = Math.min(1, Math.max(0, (elapsed - 280) / 220))
      display.current = Math.round(from + (total - from) * fraction); setShown(display.current)
      if (elapsed >= 280) { setFlight(null); setShining(true) }
      if (elapsed < 850) frame = requestAnimationFrame(animate)
      else setShining(false)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [sol.balance, reduced])
  return <div className="sol-counter-wrap">
    <button className={`sol-counter ${shining ? 'sol-shine' : ''}`} onClick={onOpen} aria-label={`SOL balance: ${formatSOL(sol.balance)}. View SOL information.`}>
      <span className="sol-mark" aria-hidden="true"><i /><i /><i /></span>
      <span><small>SOL BALANCE · TAP FOR DETAILS</small><strong>{formatSOL(shown)}</strong></span>
    </button>
    <small className="sol-disclaimer">In-Game SOL — No Real Monetary Value</small>
    {flight && <span key={flight.id} className="sol-reward-flight" aria-hidden="true">+{formatSOL(flight.amount)}</span>}
  </div>
}

import { formatDepth } from '../utils/storage'

export default function DepthMeter({ depth, deepest, progress }) {
  return (
    <aside className="depth-meter" aria-label="Mine depth" style={{ '--meter-progress': `${progress * 100}%` }}>
      <div className="depth-meter__readout">
        <span>DEPTH</span>
        <strong>{formatDepth(depth)}</strong>
      </div>
      <div className="depth-meter__track" aria-hidden="true">
        <div className="depth-meter__fill" style={{ height: `${Math.max(1, progress * 100)}%` }} />
        <div className="depth-meter__cart" style={{ top: `${Math.min(96, progress * 96)}%` }}>▼</div>
      </div>
      <div className="depth-meter__best">
        <span>LOCAL BEST</span>
        <b>{formatDepth(deepest)}</b>
      </div>
    </aside>
  )
}

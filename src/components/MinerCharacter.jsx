import { motion, useReducedMotion } from 'motion/react'

const stateLabels = {
  walking: 'heading deeper',
  running: 'avoiding falling rocks',
  digging: 'mining',
  looking: 'looking back at you',
  tired: 'catching a breath',
  celebrate: 'celebrating a discovery',
  startled: 'reacting to the blast',
  inspect: 'inspecting the wall',
}

export default function MinerCharacter({ state = 'walking', visible = true }) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className="miner-wrap"
      data-state={state}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: state === 'celebrate' && !reducedMotion ? -12 : 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.22 }}
      aria-live="polite"
      aria-label={`Miner is ${stateLabels[state] || 'exploring'}`}
    >
      <div className="miner-shadow" />
      <div className="miner-sprite" aria-hidden="true">
        <span className="miner-lamp" />
        <span className="miner-helmet" />
        <span className="miner-head"><i className="miner-eye" /></span>
        <span className="miner-body" />
        <span className="miner-arm miner-arm--left" />
        <span className="miner-arm miner-arm--right" />
        <span className="miner-leg miner-leg--left" />
        <span className="miner-leg miner-leg--right" />
        <span className="miner-pick"><i /></span>
      </div>
      <span className="miner-status">{stateLabels[state] || 'exploring'}</span>
    </motion.div>
  )
}

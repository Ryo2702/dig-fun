import { AnimatePresence, motion } from 'motion/react'

export default function DiscoveryToast({ artifact }) {
  return (
    <AnimatePresence>
      {artifact && (
        <motion.aside
          className="discovery-toast"
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          role="status"
        >
          <span aria-hidden="true">{artifact.icon}</span>
          <div><small>ARTIFACT DISCOVERED</small><strong>{artifact.name}</strong></div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

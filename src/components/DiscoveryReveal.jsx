import { motion } from 'motion/react'

export default function DiscoveryReveal({ icon, title, text, visible }) {
  return (
    <motion.div
      className="discovery-reveal"
      initial={false}
      animate={visible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
      aria-hidden={!visible}
    >
      <span aria-hidden="true">{icon}</span>
      <div><b>{title}</b><small>{text}</small></div>
    </motion.div>
  )
}

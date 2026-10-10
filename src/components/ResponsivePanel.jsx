import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export default function ResponsivePanel({ isOpen, title, eyebrow = 'LOCAL MINE', onClose, panelRef, children }) {
  const reduced = useReducedMotion()

  return <AnimatePresence>
    {isOpen && <motion.div
      className="responsive-panel-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : .2 }}
      onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <motion.section
        ref={panelRef}
        className="responsive-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="responsive-panel-title"
        initial={reduced ? false : { opacity: 0, x: 22 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: 22 }}
        transition={{ duration: reduced ? 0 : .24, ease: 'steps(5)' }}
        onPointerDown={event => event.stopPropagation()}
      >
        <header className="responsive-panel__header">
          <div>
            <small>{eyebrow}</small>
            <h1 id="responsive-panel-title">{title}</h1>
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="responsive-panel__body">{children}</div>
      </motion.section>
    </motion.div>}
  </AnimatePresence>
}

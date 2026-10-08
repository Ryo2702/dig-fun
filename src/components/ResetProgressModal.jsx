import { AnimatePresence, motion } from 'motion/react'
import PixelButton from './PixelButton'
import useModalFocus from '../hooks/useModalFocus'

export default function ResetProgressModal({ open, onClose, onConfirm }) {
  const panelRef = useModalFocus(open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.section
            ref={panelRef}
            className="pixel-modal reset-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
          >
            <p className="modal-kicker">ABANDON THIS RUN?</p>
            <h2 id="reset-title">Reset local progress</h2>
            <p className="modal-copy">Your deepest point and artifact journal will be cleared from this browser.</p>
            <div className="reset-actions">
              <PixelButton variant="danger" onClick={onConfirm}>RESET EVERYTHING</PixelButton>
              <PixelButton variant="ghost" onClick={onClose}>KEEP DIGGING</PixelButton>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

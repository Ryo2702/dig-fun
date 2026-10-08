import { AnimatePresence, motion } from 'motion/react'
import { walletLinks } from '../data/mineData'
import useModalFocus from '../hooks/useModalFocus'

export default function WalletLinksModal({ open, onClose }) {
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
            className="pixel-modal wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-title"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
          >
            <button className="modal-close" type="button" onClick={onClose} aria-label="Close wallet links">×</button>
            <p className="modal-kicker">EXTERNAL LINKS</p>
            <h2 id="wallet-title">Choose a wallet to install</h2>
            <p className="modal-copy">
              DIG.FUN never connects to a wallet. These buttons only open each wallet’s official download page.
            </p>
            <div className="wallet-options">
              {walletLinks.map((wallet) => (
                <motion.a
                  className="wallet-option"
                  href={wallet.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={wallet.name}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="wallet-option__mark" aria-hidden="true">{wallet.mark}</span>
                  <span><b>{wallet.name}</b><small>{wallet.description}</small></span>
                  <i aria-hidden="true">↗</i>
                </motion.a>
              ))}
            </div>
            <p className="modal-note">NO SIGNING · NO BALANCES · NO WALLET ACCESS</p>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

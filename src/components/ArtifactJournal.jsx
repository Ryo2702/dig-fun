import { AnimatePresence, motion } from 'motion/react'
import { artifacts as artifactCatalog } from '../data/mineData'
import { formatDepth } from '../utils/storage'
import useModalFocus from '../hooks/useModalFocus'

function formatTimestamp(value) {
  if (!value) return 'Undiscovered'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function ArtifactJournal({ open, discoveries, onClose }) {
  const panelRef = useModalFocus(open, onClose)
  const found = new Map(discoveries.map((item) => [item.id, item]))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="journal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.aside
            ref={panelRef}
            className="artifact-journal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          >
            <header className="journal-header">
              <div>
                <p className="modal-kicker">LOCAL FIELD NOTES</p>
                <h2 id="journal-title">Artifact Journal</h2>
              </div>
              <button className="modal-close" type="button" onClick={onClose} aria-label="Close artifact journal">×</button>
            </header>
            <p className="journal-intro">
              {discoveries.length} / {Object.keys(artifactCatalog).length} objects recovered. Stored only in this browser.
            </p>
            <div className="journal-progress" aria-hidden="true">
              <span style={{ width: `${discoveries.length / Object.keys(artifactCatalog).length * 100}%` }} />
            </div>
            <div className="artifact-list">
              {Object.values(artifactCatalog).map((artifact, index) => {
                const discovery = found.get(artifact.id)
                return (
                  <motion.article
                    className={`artifact-card ${discovery ? 'is-found' : 'is-locked'}`}
                    key={artifact.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <span className="artifact-card__icon" aria-hidden="true">{discovery ? artifact.icon : '?'}</span>
                    <div>
                      <div className="artifact-card__meta">
                        <span>{discovery ? artifact.rarity : 'UNKNOWN'}</span>
                        <span>{discovery ? formatDepth(artifact.depth) : '— — —'}</span>
                      </div>
                      <h3>{discovery ? artifact.name : 'Undiscovered artifact'}</h3>
                      <p>{discovery ? artifact.description : 'Keep digging. It may be behind the next wall.'}</p>
                      <time>{formatTimestamp(discovery?.discoveredAt)}</time>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

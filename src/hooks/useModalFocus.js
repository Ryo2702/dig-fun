import { useEffect, useRef } from 'react'

export default function useModalFocus(open, onClose) {
  const panelRef = useRef(null)

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const panel = panelRef.current
    const focusable = panel?.querySelector(
      'button, a[href], input, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])',
      )].filter((item) => !item.disabled && item.getClientRects().length)
      if (!items.length) return
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
      previous?.focus?.()
    }
  }, [open])

  return panelRef
}

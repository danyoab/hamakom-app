import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'
export default function Sheet({ open, onClose, title, lang, children }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!open) return
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [open])
  return <dialog ref={ref} className="ui-sheet" dir={lang === 'he' ? 'rtl' : 'ltr'} aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="ui-sheet-surface">
      <header className="ui-sheet-header"><h2 id={titleId}>{title}</h2><button type="button" className="ui-icon-button" aria-label={lang === 'he' ? 'סגירה' : 'Close'} onClick={onClose}><Icon name="close" /></button></header>
      <div className="ui-sheet-body">{children}</div>
    </div>
  </dialog>
}

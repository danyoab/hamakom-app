import { useEffect, useState } from 'react'

export default function OfflineBanner({ lang }) {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const isHe = lang === 'he'

  useEffect(() => {
    const online = () => setOffline(false)
    const offlineEvt = () => setOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offlineEvt)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offlineEvt)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 'max(12px, var(--hm-sat, 0px))',
        left: 12,
        right: 12,
        zIndex: 9999,
        background: '#3D3528',
        color: '#F4ECD8',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 13,
        lineHeight: 1.45,
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(36,30,22,0.35)',
      }}
    >
      {isHe
        ? 'אין חיבור לאינטרנט. פריטים שמורים עדיין זמינים.'
        : "You're offline. Saved plans and places still work."}
    </div>
  )
}

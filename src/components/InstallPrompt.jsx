import { useEffect, useState } from 'react'
import { isNativeApp } from '../lib/native'

export default function InstallPrompt({ lang }) {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('hm-install-dismissed') === '1')
  const isHe = lang === 'he'

  useEffect(() => {
    if (isNativeApp() || dismissed) return undefined
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [dismissed])

  if (!prompt || dismissed) return null

  const install = async () => {
    await prompt.prompt()
    setPrompt(null)
    localStorage.setItem('hm-install-dismissed', '1')
    setDismissed(true)
  }

  const dismiss = () => {
    localStorage.setItem('hm-install-dismissed', '1')
    setDismissed(true)
    setPrompt(null)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(96px + var(--hm-sab, 0px))',
        maxWidth: 480,
        marginInline: 'auto',
        zIndex: 9998,
        background: 'var(--ui-surface)',
        border: '1px solid #EBE2D0',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ui-text)', marginBottom: 4 }}>
        {isHe ? 'הוסיפו את HaMakom למסך הבית' : 'Add HaMakom to your home screen'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ui-muted)', lineHeight: 1.45, marginBottom: 12 }}>
        {isHe ? 'גישה מהירה לתוכניות דייט — בלי סרגל דפדפן.' : 'Quick access to date plans — no browser bar.'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={install}
          style={{
            flex: 1,
            background: 'var(--ui-accent)',
            color: 'var(--ui-text)',
            border: 'none',
            borderRadius: 10,
            padding: '10px 12px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isHe ? 'התקנה' : 'Install'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          style={{
            background: 'transparent',
            color: 'var(--ui-muted)',
            border: '1px solid #EBE2D0',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isHe ? 'לא עכשיו' : 'Not now'}
        </button>
      </div>
    </div>
  )
}

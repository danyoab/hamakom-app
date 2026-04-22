import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResultsGateModal({ lang, font, plan, itemType = 'plan', itemTitle, itemSubtitle, onClose }) {
  const [mode, setMode] = useState('choose')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'
  const isPlace = itemType === 'place'

  const previewTitle = itemTitle || (plan ? (isHe ? plan.title_he : plan.title_en) : '')
  const previewSubtitle = itemSubtitle || (plan ? (isHe ? plan.start_time_text_he : plan.start_time_text_en) : '')

  const copy = isPlace
    ? {
        eyebrow: isHe ? 'שמרו את המקום' : 'Save This Place',
        title: isHe ? 'שמרו את המקום כדי לחזור אליו אחר כך' : 'Save this place so it is waiting for you later',
        body: isHe ? 'כבר מצאנו מקום ששווה לשמור. עכשיו רק צריך דרך לשמור אותו בשבילכם.' : 'You found a place worth keeping. We just need a way to save it for you.',
        previewLabel: isHe ? 'מקום לשמירה' : 'Place to Save',
      }
    : {
        eyebrow: isHe ? 'שמרו את התוכנית' : 'Save Your Plan',
        title: isHe ? 'שמרו את הדייט כדי לחזור אליו אחר כך' : 'Save this date so it is waiting for you later',
        body: isHe ? 'כבר בנינו את התוכנית. עכשיו רק צריך דרך לשמור אותה בשבילכם.' : 'The plan is already built. We just need a way to keep it for you.',
        previewLabel: isHe ? 'התוכנית שתישמר' : 'Plan to Save',
      }

  const handleGoogle = async () => {
    if (!supabase) {
      onClose()
      return
    }

    setError('')
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
    } catch {
      setError(isHe ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Please try again.')
    }
  }

  const handleEmail = async (event) => {
    event.preventDefault()

    if (!supabase) {
      onClose()
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
      })

      if (authError) throw authError
      setSent(true)
    } catch {
      setError(isHe ? 'לא הצלחנו לשלוח קישור. נסו שוב.' : 'We could not send the link. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      dir={dir}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        background: 'rgba(8,11,17,0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        fontFamily: font,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'linear-gradient(180deg,#141922 0%,#0D1117 100%)',
          border: '1px solid #2A2F3E',
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: '14px 22px 34px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: 36, height: 4, background: '#2A2F3E', borderRadius: 999, margin: '0 auto 18px' }} />

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>◍</div>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 8 }}>{copy.eyebrow}</div>
          <h2 style={{ fontSize: 24, lineHeight: 1.15, margin: '0 0 8px' }}>{copy.title}</h2>
          <p style={{ margin: 0, color: '#9CA3AF', fontSize: 14, lineHeight: 1.5 }}>{copy.body}</p>
        </div>

        {previewTitle ? (
          <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 16, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>{copy.previewLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{previewTitle}</div>
            {previewSubtitle ? <div style={{ fontSize: 13, color: '#9CA3AF' }}>{previewSubtitle}</div> : null}
          </div>
        ) : null}

        {!sent ? (
          <>
            {mode === 'choose' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <button
                  onClick={handleGoogle}
                  style={{
                    background: '#FFFFFF',
                    color: '#111827',
                    border: 'none',
                    borderRadius: 14,
                    padding: '14px 18px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isHe ? 'המשיכו עם Google' : 'Continue with Google'}
                </button>

                <button
                  onClick={() => setMode('email')}
                  style={{
                    background: '#161B27',
                    color: '#E8DCC8',
                    border: '1px solid #2A2F3E',
                    borderRadius: 14,
                    padding: '14px 18px',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isHe ? 'המשיכו עם אימייל' : 'Continue with Email'}
                </button>

                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', paddingTop: 4 }}
                >
                  {isHe ? 'לא עכשיו' : 'Not now'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmail} style={{ display: 'grid', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('choose')
                    setError('')
                  }}
                  style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', textAlign: isHe ? 'right' : 'left', fontFamily: 'inherit', padding: 0 }}
                >
                  {isHe ? 'חזרה' : 'Back'}
                </button>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={isHe ? 'כתובת האימייל שלכם' : 'Your email address'}
                  required
                  dir="ltr"
                  style={{
                    background: '#161B27',
                    border: '1px solid #2A2F3E',
                    borderRadius: 14,
                    padding: '14px 16px',
                    color: '#E8DCC8',
                    fontSize: 15,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#374151' : 'linear-gradient(135deg,#C9A84C 0%,#E8B84B 100%)',
                    color: '#0D1117',
                    border: 'none',
                    borderRadius: 14,
                    padding: '14px 18px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {loading ? (isHe ? 'שולחים...' : 'Sending...') : isHe ? 'שלחו לי קישור' : 'Send Me A Link'}
                </button>

                {error ? <div style={{ fontSize: 12, color: '#F87171', textAlign: 'center' }}>{error}</div> : null}
              </form>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 6 }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>✉</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{isHe ? 'בדקו את תיבת המייל' : 'Check your inbox'}</div>
            <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>{isHe ? `שלחנו קישור ל-${email}` : `We sent a link to ${email}`}</div>
          </div>
        )}
      </div>
    </div>
  )
}

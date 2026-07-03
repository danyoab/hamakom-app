import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAuthRedirectUrl } from '../lib/authRedirect'
import { isNativeApp } from '../lib/native'
import { signInWithGoogleNative } from '../lib/nativeAuth'

const OTP_COOLDOWN_MS = 60_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ResultsGateModal({ lang, font, plan, itemType = 'plan', itemTitle, itemSubtitle, onClose }) {
  const [mode, setMode] = useState('choose')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpCooldownUntil, setOtpCooldownUntil] = useState(0)
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'
  const isPlace = itemType === 'place'
  const authRedirectUrl = getAuthRedirectUrl()

  const previewTitle = itemTitle || (plan ? (isHe ? plan.title_he : plan.title_en) : '')
  const previewSubtitle = itemSubtitle || (plan ? (isHe ? plan.start_time_text_he : plan.start_time_text_en) : '')

  const copy = isPlace
    ? {
        eyebrow: isHe ? 'שמרו את המקום' : 'Save This Place',
        title: isHe ? 'שמרו את המקום כדי לחזור אליו אחר כך' : 'Save this place so it is waiting for you later',
        body: isHe ? 'צרו חשבון חינמי כדי לשמור את המקומות האהובים עליכם — לוקח כמה שניות.' : 'Create a free account to save your favorite places — it takes a few seconds.',
        previewLabel: isHe ? 'מקום לשמירה' : 'Place to Save',
      }
    : {
        eyebrow: isHe ? 'שמרו את התוכנית' : 'Save Your Plan',
        title: isHe ? 'שמרו את הדייט כדי לחזור אליו אחר כך' : 'Save this date so it is waiting for you later',
        body: isHe ? 'צרו חשבון חינמי כדי לשמור את רעיונות הדייט שלכם — לוקח כמה שניות.' : 'Create a free account to save your date ideas — it takes a few seconds.',
        previewLabel: isHe ? 'התוכנית שתישמר' : 'Plan to Save',
      }

  const authUnavailable = isHe
    ? 'ההתחברות אינה זמינה כרגע. נסו שוב מאוחר יותר.'
    : 'Sign-in is unavailable right now. Please try again later.'

  const handleGoogle = async () => {
    if (!supabase) {
      setError(authUnavailable)
      return
    }

    setError('')
    try {
      if (isNativeApp()) {
        await signInWithGoogleNative(supabase)
        return
      }
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: authRedirectUrl },
      })
    } catch {
      setError(isHe ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Please try again.')
    }
  }

  const handleEmail = async (event) => {
    event.preventDefault()

    if (!supabase) {
      setError(authUnavailable)
      return
    }

    if (!EMAIL_RE.test(email)) {
      setError(isHe ? 'כתובת אימייל לא תקינה.' : 'Please enter a valid email address.')
      return
    }

    if (Date.now() < otpCooldownUntil) {
      const seconds = Math.ceil((otpCooldownUntil - Date.now()) / 1000)
      setError(isHe ? `נסו שוב בעוד ${seconds} שניות` : `Try again in ${seconds} seconds`)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authRedirectUrl, shouldCreateUser: true },
      })

      if (authError) throw authError
      setOtpCooldownUntil(Date.now() + OTP_COOLDOWN_MS)
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
      role="dialog"
      aria-modal="true"
      aria-label={isHe ? 'התחברות לשמירה' : 'Sign in to save'}
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
          width: 'min(100%, 520px)',
          background: '#FFFFFF',
          border: '1px solid #EBE2D0',
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: '14px 22px 34px',
          boxSizing: 'border-box',
          color: '#241E16',
        }}
      >
        <div style={{ width: 36, height: 4, background: '#EBE2D0', borderRadius: 999, margin: '0 auto 18px' }} />

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8, color: '#9A7A28' }}>◍</div>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#9A7A28', textTransform: 'uppercase', marginBottom: 8 }}>{copy.eyebrow}</div>
          <h2 style={{ fontSize: 24, lineHeight: 1.15, margin: '0 0 8px', color: '#F5EBD8' }}>{copy.title}</h2>
          <p style={{ margin: 0, color: '#C8BDA8', fontSize: 15, lineHeight: 1.6 }}>{copy.body}</p>
        </div>

        {previewTitle ? (
          <div style={{ background: '#FBF7EE', border: '1px solid #EBE2D0', borderRadius: 16, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#8E97A8', textTransform: 'uppercase', marginBottom: 6 }}>{copy.previewLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#F3E7D1' }}>{previewTitle}</div>
            {previewSubtitle ? <div style={{ fontSize: 13, color: '#B6A88F' }}>{previewSubtitle}</div> : null}
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
                    borderRadius: 12,
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
                    background: '#FBF7EE',
                    color: '#241E16',
                    border: '1px solid #EBE2D0',
                    borderRadius: 12,
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
                  style={{ background: 'none', border: 'none', color: '#8A94A6', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', paddingTop: 4 }}
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
                  style={{ background: 'none', border: 'none', color: '#8A7F6C', fontSize: 13, cursor: 'pointer', textAlign: isHe ? 'right' : 'left', fontFamily: 'inherit', padding: 0 }}
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
                    background: '#FBF7EE',
                    border: '1px solid #EBE2D0',
                    borderRadius: 12,
                    padding: '14px 16px',
                    color: '#241E16',
                    fontSize: 15,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#E6DCC8' : '#241E16',
                    color: '#F4ECD8',
                    border: 'none',
                    borderRadius: 12,
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
            <div style={{ fontSize: 38, marginBottom: 10, color: '#9A7A28' }}>✉</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#F5EBD8' }}>{isHe ? 'בדקו את תיבת המייל' : 'Check your inbox'}</div>
            <div style={{ fontSize: 14, color: '#C8BDA8', lineHeight: 1.5 }}>{isHe ? `שלחנו קישור ל-${email}` : `We sent a link to ${email}`}</div>
          </div>
        )}
      </div>
    </div>
  )
}

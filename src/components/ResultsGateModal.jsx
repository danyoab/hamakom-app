import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORY_EMOJI } from '../lib/constants'

// Lightweight blurred preview card — no full tx dependency
function BlurCard({ loc, lang }) {
  const name = lang === 'he' ? (loc.name_he || loc.name) : loc.name
  const city = lang === 'he' ? (loc.city_he || loc.city) : loc.city
  return (
    <div style={{
      background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 12,
      padding: '14px 16px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 24 }}>{CATEGORY_EMOJI[loc.category] || '📍'}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#E8DCC8' }}>{name}</div>
        <div style={{ fontSize: 12, color: '#C9A84C', marginTop: 2 }}>{city}</div>
      </div>
    </div>
  )
}

export default function ResultsGateModal({ lang, font, results, personalityTags, onSkip }) {
  const [mode,    setMode]    = useState('choose') // choose | email
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const isHe = lang === 'he'
  const dir  = isHe ? 'rtl' : 'ltr'
  const tags = isHe ? personalityTags.he : personalityTags.en

  const handleGoogle = async () => {
    if (!supabase) { onSkip(); return }
    setError('')
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
    } catch {
      setError(isHe ? 'שגיאה. נסה שוב.' : 'Something went wrong. Try again.')
    }
  }

  const handleEmail = async (e) => {
    e.preventDefault()
    if (!supabase) { onSkip(); return }
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
      })
      if (err) throw err
      setSent(true)
    } catch {
      setError(isHe ? 'שגיאה בשליחת הקישור.' : 'Error sending link. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      dir={dir}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, fontFamily: font, overflow: 'hidden' }}
    >
      {/* ── Blurred results backdrop ─────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        filter: 'blur(5px)', transform: 'scale(1.03)',
        background: '#0D1117', padding: '20px', paddingTop: '70px',
      }}>
        {results.slice(0, 4).map(loc => (
          <BlurCard key={loc.id} loc={loc} lang={lang} />
        ))}
      </div>

      {/* ── Gradient overlay ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(13,17,23,0.98) 55%, rgba(13,17,23,0.55) 100%)',
      }} />

      {/* ── "Results ready" teaser ───────────────────────────────── */}
      <div style={{
        position: 'absolute', top: '10%', left: 0, right: 0,
        textAlign: 'center', padding: '0 24px',
      }}>
        <div style={{ fontSize: 13, letterSpacing: '0.14em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 8 }}>
          {isHe ? '👉 התוצאות שלך מוכנות' : '👉 Your results are ready'}
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#E8DCC8', lineHeight: 1.2, marginBottom: 6 }}>
          {isHe ? 'תוכנית הדייט האישית שלך' : 'Your personalized date plan'}
        </div>
        <div style={{ fontSize: 14, color: '#9CA3AF' }}>
          {isHe ? 'מצאנו את ההתאמות המושלמות בשבילך' : 'We found your perfect matches based on your vibe'}
        </div>
      </div>

      {/* ── Bottom sheet ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg, #141820 0%, #0D1117 100%)',
        borderTop: '1px solid #2A2F3E',
        borderRadius: '22px 22px 0 0',
        padding: '10px 24px 44px',
        maxWidth: 480,
        margin: '0 auto',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: '#2A2F3E', borderRadius: 2, margin: '10px auto 22px' }} />

        {/* Lock + headline */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔐</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E8DCC8', margin: '0 0 6px', lineHeight: 1.2 }}>
            {isHe ? 'פתח את תוכנית הדייט שלך' : 'Unlock your personalized date plan'}
          </h2>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            {isHe ? 'הדייט המושלם שלך מחכה' : 'Your perfect date is waiting'}
          </p>
        </div>

        {/* Personality tag pills */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
            {tags.map((tag, i) => (
              <span key={i} style={{
                background: '#161B27', border: '1px solid #C9A84C', borderRadius: 20,
                padding: '4px 11px', fontSize: 12, color: '#C9A84C', fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Scarcity nudge */}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#6B7280', marginBottom: 18 }}>
          💾&nbsp;{isHe ? 'שמורים רק בשבילך — אל תאבד את ההתאמות שלך' : "Saved just for you — don't lose your matches"}
        </div>

        {!sent ? (
          <>
            {mode === 'choose' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Google */}
                <button
                  onClick={handleGoogle}
                  style={{
                    background: '#fff', color: '#111', border: 'none', borderRadius: 12,
                    padding: '14px 20px', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}
                >
                  <GoogleIcon />
                  {isHe ? 'המשך עם Google' : 'Continue with Google'}
                </button>

                {/* Email */}
                <button
                  onClick={() => setMode('email')}
                  style={{
                    background: '#161B27', color: '#E8DCC8',
                    border: '1.5px solid #2A2F3E', borderRadius: 12,
                    padding: '14px 20px', fontSize: 15, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ✉️&nbsp;{isHe ? 'המשך עם אימייל' : 'Continue with email'}
                </button>

                {/* Skip */}
                <button
                  onClick={onSkip}
                  style={{
                    background: 'none', border: 'none', color: '#4B5563',
                    fontSize: 12, cursor: 'pointer', marginTop: 4,
                    fontFamily: 'inherit', padding: '4px 0',
                  }}
                >
                  {isHe ? 'המשך ללא שמירה →' : 'Continue without saving →'}
                </button>
              </div>
            )}

            {mode === 'email' && (
              <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setMode('choose'); setError('') }}
                  style={{
                    background: 'none', border: 'none', color: '#6B7280',
                    cursor: 'pointer', fontSize: 13, padding: 0,
                    textAlign: isHe ? 'right' : 'left', fontFamily: 'inherit',
                  }}
                >
                  {isHe ? '→ חזרה' : '← Back'}
                </button>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={isHe ? 'כתובת האימייל שלך' : 'Your email address'}
                  required
                  dir="ltr"
                  style={{
                    background: '#161B27', border: '1.5px solid #2A2F3E', borderRadius: 10,
                    padding: '13px 14px', color: '#E8DCC8', fontSize: 15,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#374151' : 'linear-gradient(135deg, #C9A84C, #E8B84B)',
                    color: '#0D1117', border: 'none', borderRadius: 10,
                    padding: '14px', fontSize: 15, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {loading
                    ? (isHe ? 'שולח…' : 'Sending…')
                    : (isHe ? 'שלח לי קישור קסם ✨' : 'Send me a magic link ✨')}
                </button>
                {error && <div style={{ fontSize: 12, color: '#F87171', textAlign: 'center' }}>{error}</div>}
              </form>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 17, color: '#E8DCC8', marginBottom: 6, fontWeight: 500 }}>
              {isHe ? 'בדוק את תיבת הדואר שלך!' : 'Check your inbox!'}
            </div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              {isHe
                ? `שלחנו קישור קסם ל-${email}`
                : `We sent a magic link to ${email}`}
            </div>
            <div style={{ fontSize: 12, color: '#4B5563', marginTop: 16 }}>
              {isHe ? 'לחץ על הקישור ותחזור לתוצאות שלך' : 'Click the link to return to your results'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.01 17.64 11.702 17.64 9.2z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

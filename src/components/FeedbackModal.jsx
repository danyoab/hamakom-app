import { useState } from 'react'
import { supabase } from '../lib/supabase'

const REPORT_TYPES_EN = [
  { value: 'wrong_info',   label: 'Wrong or outdated info' },
  { value: 'closed',       label: 'Place is closed / no longer exists' },
  { value: 'not_kosher',   label: 'Kashrus info is incorrect' },
  { value: 'bug',          label: 'App bug or technical problem' },
  { value: 'suggestion',   label: 'Feature suggestion' },
  { value: 'other',        label: 'Something else' },
]

const REPORT_TYPES_HE = [
  { value: 'wrong_info',   label: 'מידע שגוי או לא מעודכן' },
  { value: 'closed',       label: 'המקום סגור / לא קיים יותר' },
  { value: 'not_kosher',   label: 'מידע על כשרות שגוי' },
  { value: 'bug',          label: 'תקלה טכנית באפליקציה' },
  { value: 'suggestion',   label: 'הצעה לשיפור' },
  { value: 'other',        label: 'אחר' },
]

export default function FeedbackModal({ lang, font, locationName, locationId, onClose }) {
  const isHe = lang === 'he'
  const types = isHe ? REPORT_TYPES_HE : REPORT_TYPES_EN
  const [type, setType] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')

  const isLocation = Boolean(locationId)

  const handleSubmit = async () => {
    if (!type) return
    setStatus('submitting')

    if (supabase) {
      const { error } = await supabase.from('problem_reports').insert({
        type,
        message: message.trim() || null,
        email: email.trim() || null,
        location_id: locationId || null,
        location_name: locationName || null,
      })
      if (error) {
        setStatus('error')
        return
      }
    }
    setStatus('done')
  }

  const dir = isHe ? 'rtl' : 'ltr'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(8,11,17,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        fontFamily: font,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        dir={dir}
        style={{
          width: '100%', maxWidth: 520,
          background: 'linear-gradient(180deg,#141922 0%,#0D1117 100%)',
          border: '1px solid #2A2F3E', borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: '14px 22px 40px',
          boxSizing: 'border-box', color: '#E8DCC8',
        }}
      >
        <div style={{ width: 36, height: 4, background: '#2A2F3E', borderRadius: 999, margin: '0 auto 18px' }} />

        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h3 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 8px' }}>
              {isHe ? 'תודה!' : 'Thanks for the report!'}
            </h3>
            <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 24px' }}>
              {isHe ? 'נבדוק את זה בהקדם.' : "We'll look into it soon."}
            </p>
            <button onClick={onClose} style={btnStyle('#C9A84C', '#0D1117', font)}>
              {isHe ? 'סגור' : 'Close'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, letterSpacing: '0.14em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 6 }}>
                {isLocation
                  ? (isHe ? 'דיווח על מקום' : 'Report a location')
                  : (isHe ? 'משוב / דיווח על בעיה' : 'Feedback / Report a problem')}
              </div>
              {locationName ? (
                <div style={{ fontSize: 13, color: '#6B7280' }}>{locationName}</div>
              ) : null}
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {types.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    background: type === t.value ? '#1A2A1A' : '#161B27',
                    border: `1px solid ${type === t.value ? '#4ADE80' : '#2A2F3E'}`,
                    borderRadius: 10, padding: '11px 14px',
                    color: type === t.value ? '#4ADE80' : '#C8BDA8',
                    fontSize: 14, cursor: 'pointer', fontFamily: font,
                    textAlign: isHe ? 'right' : 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder={isHe ? 'פרטים נוספים (אופציונלי)' : 'More details (optional)'}
              rows={3}
              style={{
                width: '100%', background: '#161B27', border: '1px solid #2A2F3E',
                borderRadius: 10, padding: '11px 14px', color: '#E8DCC8',
                fontSize: 14, fontFamily: font, resize: 'none',
                outline: 'none', boxSizing: 'border-box', marginBottom: 10,
                direction: dir,
              }}
            />

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isHe ? 'אימייל לתגובה (אופציונלי)' : 'Your email for follow-up (optional)'}
              dir="ltr"
              style={{
                width: '100%', background: '#161B27', border: '1px solid #2A2F3E',
                borderRadius: 10, padding: '11px 14px', color: '#E8DCC8',
                fontSize: 14, fontFamily: font, outline: 'none',
                boxSizing: 'border-box', marginBottom: 14,
              }}
            />

            {status === 'error' ? (
              <div style={{ color: '#F87171', fontSize: 13, marginBottom: 10 }}>
                {isHe ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Please try again.'}
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={handleSubmit}
                disabled={!type || status === 'submitting'}
                style={{
                  ...btnStyle(type ? '#C9A84C' : '#374151', type ? '#0D1117' : '#6B7280', font),
                  opacity: status === 'submitting' ? 0.7 : 1,
                  cursor: type ? 'pointer' : 'default',
                }}
              >
                {status === 'submitting'
                  ? (isHe ? 'שולח...' : 'Sending…')
                  : (isHe ? 'שלח' : 'Send')}
              </button>
              <button onClick={onClose} style={ghostBtnStyle(font)}>
                {isHe ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg, color, font) {
  return {
    background: bg, color, border: 'none', borderRadius: 12,
    padding: '13px 0', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: font, width: '100%',
    transition: 'background 0.2s',
  }
}

function ghostBtnStyle(font) {
  return {
    background: '#161B27', color: '#9CA3AF',
    border: '1px solid #2A2F3E', borderRadius: 12,
    padding: '13px 0', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: font, width: '100%',
  }
}

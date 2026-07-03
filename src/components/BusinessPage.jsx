import { useState } from 'react'
import { supabase } from '../lib/supabase'

const BG = '#0D1117'
const PANEL = '#161B27'
const BORDER = '#2A2F3E'
const TEXT = '#E8DCC8'
const ACCENT = '#C9A84C'
const MUTED = '#9CA3AF'

const CONTACT_EMAIL = 'partners@hamakom.app'

const COPY = {
  en: {
    back: '← Back',
    title: 'For Businesses',
    subtitle: 'Get your restaurant, café, or venue in front of couples planning their next date.',
    pitchTitle: 'Why HaMakom?',
    pitch: [
      ['🎯', 'High-intent audience', 'Every visitor is actively planning a date — not browsing. When we recommend your venue, they show up.'],
      ['✡️', 'The right crowd', 'Observant Jewish singles across Israel who care about kashrut, atmosphere, and quality — and tell their friends.'],
      ['💎', 'Curated, not cluttered', 'We feature a small number of partners per city, clearly labeled. Your placement means something.'],
    ],
    offerTitle: 'Featured Partner placement',
    offer: 'Featured Partners appear at the top of city browsing, inside date plans, and with a Partner badge. Pricing is simple and month-to-month while we grow — early partners lock in founding rates.',
    formTitle: 'Get in touch',
    bizName: 'Business name',
    contactName: 'Your name',
    phone: 'Phone / WhatsApp',
    email: 'Email',
    message: 'Tell us about your venue (city, type, kashrut)',
    send: 'Send inquiry',
    sending: 'Sending…',
    sent: '✓ Thanks! We\'ll be in touch within 2 business days.',
    orEmail: 'Prefer email?',
    required: 'Business name and a way to reach you are required.',
  },
  he: {
    back: '→ חזרה',
    title: 'לעסקים',
    subtitle: 'הביאו את המסעדה, בית הקפה או המקום שלכם מול זוגות שמתכננים את הדייט הבא שלהם.',
    pitchTitle: 'למה המקום?',
    pitch: [
      ['🎯', 'קהל עם כוונה אמיתית', 'כל מבקר מתכנן דייט באופן פעיל — לא סתם גולש. כשאנחנו ממליצים על המקום שלכם, הם מגיעים.'],
      ['✡️', 'הקהל הנכון', 'רווקים ורווקות דתיים בכל הארץ שאכפת להם מכשרות, אווירה ואיכות — ומספרים לחברים.'],
      ['💎', 'אוצרות, לא עומס', 'אנחנו מציגים מספר קטן של שותפים בכל עיר, מסומנים בבירור. המיקום שלכם שווה משהו.'],
    ],
    offerTitle: 'מיקום שותף מומלץ',
    offer: 'שותפים מומלצים מופיעים בראש הדפדוף בעיר, בתוך תוכניות דייט, ועם תג שותף. התמחור פשוט וחודשי בזמן שאנחנו גדלים — שותפים מוקדמים נועלים מחירי היכרות.',
    formTitle: 'צרו קשר',
    bizName: 'שם העסק',
    contactName: 'השם שלכם',
    phone: 'טלפון / וואטסאפ',
    email: 'אימייל',
    message: 'ספרו לנו על המקום (עיר, סוג, כשרות)',
    send: 'שליחת פנייה',
    sending: 'שולח…',
    sent: '✓ תודה! נחזור אליכם תוך 2 ימי עסקים.',
    orEmail: 'מעדיפים אימייל?',
    required: 'שם העסק ודרך ליצור קשר הם שדות חובה.',
  },
}

export default function BusinessPage({ lang, font, onBack }) {
  const t = COPY[lang] || COPY.en
  const isHe = lang === 'he'
  const [form, setForm] = useState({ bizName: '', contactName: '', phone: '', email: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState('')

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.bizName.trim() || (!form.phone.trim() && !form.email.trim())) {
      setErrMsg(t.required)
      return
    }
    setErrMsg('')
    setStatus('sending')

    if (supabase) {
      const { error } = await supabase.from('partner_inquiries').insert({
        business_name: form.bizName.trim(),
        contact_name: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        message: form.message.trim() || null,
        lang,
      })
      if (!error) {
        setStatus('sent')
        return
      }
    }

    // No backend (or insert failed): fall back to a pre-filled mailto
    const body = [
      `Business: ${form.bizName}`,
      `Contact: ${form.contactName}`,
      `Phone: ${form.phone}`,
      `Email: ${form.email}`,
      '',
      form.message,
    ].join('\n')
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Partner inquiry — ${form.bizName}`)}&body=${encodeURIComponent(body)}`
    setStatus('sent')
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: BG, border: `1px solid ${BORDER}`,
    borderRadius: 10, padding: '11px 14px', color: TEXT, fontSize: 14, fontFamily: font,
    textAlign: isHe ? 'right' : 'left',
  }

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: font }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 60px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 14, fontFamily: font, padding: '4px 0', marginBottom: 18 }}
        >
          {t.back}
        </button>

        <h1 style={{ fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>{t.title}</h1>
        <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: '0 0 28px' }}>{t.subtitle}</p>

        <h2 style={{ fontSize: 13, color: ACCENT, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 14px' }}>{t.pitchTitle}</h2>
        <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
          {t.pitch.map(([emoji, heading, body]) => (
            <div key={heading} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{emoji} {heading}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#1A1608', border: `1px solid ${ACCENT}44`, borderRadius: 12, padding: '16px 18px', marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: ACCENT, marginBottom: 6 }}>💎 {t.offerTitle}</div>
          <div style={{ fontSize: 13, color: '#C8BDA8', lineHeight: 1.65 }}>{t.offer}</div>
        </div>

        <h2 style={{ fontSize: 13, color: ACCENT, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 14px' }}>{t.formTitle}</h2>

        {status === 'sent' ? (
          <div style={{ background: '#18261D', border: '1px solid #2E6E45', borderRadius: 12, padding: '16px 18px', color: '#4ADE80', fontSize: 14 }}>
            {t.sent}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <input style={inputStyle} placeholder={t.bizName} value={form.bizName} onChange={set('bizName')} />
            <input style={inputStyle} placeholder={t.contactName} value={form.contactName} onChange={set('contactName')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input style={inputStyle} placeholder={t.phone} value={form.phone} onChange={set('phone')} inputMode="tel" />
              <input style={inputStyle} placeholder={t.email} value={form.email} onChange={set('email')} inputMode="email" />
            </div>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} placeholder={t.message} value={form.message} onChange={set('message')} />
            {errMsg ? <div style={{ fontSize: 13, color: '#F87171' }}>{errMsg}</div> : null}
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                background: ACCENT, color: BG, border: 'none', borderRadius: 12, padding: '14px 0',
                fontSize: 15, fontWeight: 700, cursor: status === 'sending' ? 'wait' : 'pointer', fontFamily: font,
              }}
            >
              {status === 'sending' ? t.sending : t.send}
            </button>
            <div style={{ fontSize: 12, color: MUTED, textAlign: 'center' }}>
              {t.orEmail}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: ACCENT, textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

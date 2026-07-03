import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SUBMIT_COOLDOWN_MS = 5 * 60 * 1000
const PARTNER_EMAIL = 'partners@hamakom.app'

export default function BusinessesPage({ tx, font, onBack, onSubmitted }) {
  const [form, setForm] = useState({
    businessName: '', contactName: '', phone: '', email: '', city: '', message: '',
    _hp: '',
  })
  const [touched, setTouch] = useState({})
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const dir = tx.dir

  const set = (k, v) => { setForm(prev => ({ ...prev, [k]: v })); setTouch(prev => ({ ...prev, [k]: true })) }

  const fieldErr = (k) => {
    if (!touched[k]) return null
    if (k === 'businessName' && !form.businessName.trim()) return 'Required'
    return null
  }

  const mailtoHref = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent('HaMakom Partner Inquiry')}&body=${encodeURIComponent(
    `Business: ${form.businessName}\nContact: ${form.contactName}\nPhone: ${form.phone}\nEmail: ${form.email}\nCity: ${form.city}\n\n${form.message}`
  )}`

  const handleSubmit = async () => {
    setTouch({ businessName: true })
    const reachable = form.phone.trim() || form.email.trim()
    if (!form.businessName.trim() || !reachable) {
      setError(tx.bizRequired)
      return
    }
    if (Date.now() < cooldownUntil) {
      setError(tx.bizError)
      return
    }
    // Honeypot — silently succeed without inserting
    if (form._hp) {
      setStatus('success')
      return
    }

    setError('')
    setStatus('submitting')

    if (supabase) {
      const { error: sbError } = await supabase.from('partner_inquiries').insert([{
        business_name: form.businessName.trim().slice(0, 120),
        contact_name:  form.contactName.trim().slice(0, 120) || null,
        phone:         form.phone.trim().slice(0, 40) || null,
        email:         form.email.trim().slice(0, 200) || null,
        city:          form.city.trim().slice(0, 80) || null,
        message:       form.message.trim().slice(0, 2000) || null,
      }])
      if (sbError) {
        setError(tx.bizError)
        setStatus('error')
        return
      }
    } else {
      // No backend configured — hand off to email instead of dropping the lead
      window.location.href = mailtoHref
    }
    setCooldownUntil(Date.now() + SUBMIT_COOLDOWN_MS)
    setStatus('success')
    onSubmitted?.()
  }

  if (status === 'success') return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F2E8', color: '#241E16', fontFamily: font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🤝</div>
      <h2 style={{ fontSize: 26, fontWeight: 400, margin: '0 0 12px' }}>{tx.bizSuccess}</h2>
      <p style={{ color: '#8A7F6C', fontSize: 15, marginBottom: 40 }}>{tx.bizSuccessSub}</p>
      <button onClick={onBack} style={{ background: '#C9A84C', color: '#F7F2E8', border: 'none', borderRadius: 8, padding: '11px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
        {tx.back}
      </button>
    </div>
  )

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F2E8', color: '#241E16', fontFamily: font }}>
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #EBE2D0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>{tx.back}</button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{tx.forBusinesses}</span>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 48px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 10 }}>
          {tx.bizHeroEyebrow}
        </div>
        <h1 style={{ fontFamily: "'Spectral','Frank Ruhl Libre',Georgia,serif", fontSize: 'clamp(26px, 6vw, 34px)', fontWeight: 600, margin: '0 0 12px', lineHeight: 1.15 }}>
          {tx.bizHeroTitle}
        </h1>
        <p style={{ color: '#6E6450', fontSize: 15, lineHeight: 1.65, margin: '0 0 24px' }}>{tx.bizHeroText}</p>

        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {[
            [tx.bizBenefit1Title, tx.bizBenefit1Text, '📈'],
            [tx.bizBenefit2Title, tx.bizBenefit2Text, '✦'],
            [tx.bizBenefit3Title, tx.bizBenefit3Text, '📊'],
          ].map(([title, text, icon]) => (
            <div key={title} style={{ background: '#FFFFFF', border: '1px solid #EBE2D0', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, color: '#C9A84C', lineHeight: 1.2 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#8A7F6C', lineHeight: 1.5 }}>{text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#FBF7EE', border: '1px solid #EDE5D4', borderRadius: 12, padding: '12px 16px', marginBottom: 28 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: '#8A7F6C', lineHeight: 1.55 }}>{tx.bizIntegrityNote}</p>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>{tx.bizFormTitle}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Field label={tx.bizName} required error={fieldErr('businessName')}>
            <Input value={form.businessName} onChange={v => set('businessName', v)} placeholder={tx.bizNamePH} dir={dir} hasError={!!fieldErr('businessName')} />
          </Field>
          <Field label={tx.bizContact}>
            <Input value={form.contactName} onChange={v => set('contactName', v)} placeholder={tx.bizContactPH} dir={dir} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Field label={tx.bizPhone}>
            <Input value={form.phone} onChange={v => set('phone', v)} placeholder={tx.bizPhonePH} dir={dir} type="tel" />
          </Field>
          <Field label={tx.bizEmail}>
            <Input value={form.email} onChange={v => set('email', v)} placeholder={tx.bizEmailPH} dir={dir} type="email" />
          </Field>
        </div>

        <Field label={tx.bizCity} style={{ marginBottom: 14 }}>
          <Input value={form.city} onChange={v => set('city', v)} placeholder={tx.bizCityPH} dir={dir} />
        </Field>

        <Field label={tx.bizMessage} style={{ marginBottom: 24 }}>
          <textarea
            value={form.message}
            onChange={e => set('message', e.target.value.slice(0, 2000))}
            placeholder={tx.bizMessagePH}
            rows={4}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', direction: dir }}
          />
        </Field>

        {/* Honeypot — hidden from real users, catches bots */}
        <input
          name="website"
          value={form._hp}
          onChange={e => setForm(prev => ({ ...prev, _hp: e.target.value }))}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
        />

        {error && (
          <div style={{ color: '#F87171', fontSize: 13, marginBottom: 14 }}>
            {error}
            {status === 'error' ? (
              <>
                {' '}{tx.bizEmailUs}
                <a href={mailtoHref} style={{ color: '#9A7A28' }}>{PARTNER_EMAIL}</a>
              </>
            ) : null}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'submitting'}
          style={{ background: '#C9A84C', color: '#F7F2E8', border: 'none', borderRadius: 8, padding: '13px 20px', cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', width: '100%', opacity: status === 'submitting' ? 0.7 : 1 }}
        >
          {status === 'submitting' ? tx.bizSubmitting : tx.bizSubmit}
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, error, children, style }) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 11, letterSpacing: '0.1em', color: error ? '#F87171' : '#A99A85', textTransform: 'uppercase' }}>
          {label}{required && <span style={{ color: '#F87171' }}> *</span>}
        </label>
      </div>
      {children}
      {error && <div style={{ fontSize: 11, color: '#F87171', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

function Input({ value, onChange, placeholder, dir, hasError, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, width: '100%', textAlign: dir === 'rtl' ? 'right' : 'left', direction: dir, borderColor: hasError ? '#F87171' : '#EBE2D0' }}
    />
  )
}

const inputStyle = {
  background: '#FFFFFF', border: '1px solid #EBE2D0', borderRadius: 8,
  padding: '10px 12px', color: '#241E16', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

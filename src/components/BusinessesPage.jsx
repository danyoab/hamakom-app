import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const SUBMIT_COOLDOWN_MS = 5 * 60 * 1000
const PARTNER_EMAIL = 'partners@hamakom.app'

export default function BusinessesPage({ tx, font, onBack, source = 'direct_url', initialVenue = null, onEvent }) {
  const [form, setForm] = useState({
    businessName: initialVenue?.name || '', contactName: '', phone: '', email: '', city: initialVenue?.city || '', message: '',
    _hp: '',
  })
  const [touched, setTouch] = useState({})
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const dir = tx.dir
  const isHe = dir === 'rtl'
  const startedRef = useRef(false)
  const viewedRef = useRef(false)

  useEffect(() => {
    if (viewedRef.current) return
    viewedRef.current = true
    onEvent?.('business_page_viewed', { inquiry_type: initialVenue ? 'claim' : 'partner' })
  }, [initialVenue, onEvent])

  const set = (k, v) => {
    if (!startedRef.current) {
      startedRef.current = true
      onEvent?.('partner_form_started', { inquiry_type: initialVenue ? 'claim' : 'partner' })
    }
    setForm(prev => ({ ...prev, [k]: v }))
    setTouch(prev => ({ ...prev, [k]: true }))
  }

  const fieldErr = (k) => {
    if (!touched[k]) return null
    if (k === 'businessName' && !form.businessName.trim()) return 'Required'
    return null
  }

  const mailtoHref = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent('HaMakom Partner Inquiry')}&body=${encodeURIComponent(
    `Type: ${initialVenue ? 'Claim existing listing' : 'Partner inquiry'}\nBusiness: ${form.businessName}\nContact: ${form.contactName}\nPhone: ${form.phone}\nEmail: ${form.email}\nCity: ${form.city}\nLocation ID: ${initialVenue?.id || ''}\nSource: ${source}\n\n${form.message}`
  )}`

  const handleSubmit = async () => {
    setTouch({ businessName: true })
    const reachable = form.phone.trim() || form.email.trim()
    if (!form.businessName.trim() || !reachable) {
      setError(tx.bizRequired)
      onEvent?.('partner_form_failed', { reason: 'validation' })
      return
    }
    if (Date.now() < cooldownUntil) {
      setError(tx.bizError)
      onEvent?.('partner_form_failed', { reason: 'cooldown' })
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
      const params = new URLSearchParams(window.location.search)
      const rpcPayload = {
        p_business_name: form.businessName.trim().slice(0, 120),
        p_contact_name: form.contactName.trim().slice(0, 120) || null,
        p_phone: form.phone.trim().slice(0, 40) || null,
        p_email: form.email.trim().slice(0, 200) || null,
        p_city: form.city.trim().slice(0, 80) || null,
        p_message: form.message.trim().slice(0, 2000) || null,
        p_location_id: initialVenue?.id || null,
        p_inquiry_type: initialVenue ? 'claim' : 'partner',
        p_source: source,
        p_utm_source: params.get('utm_source'),
        p_utm_medium: params.get('utm_medium'),
        p_utm_campaign: params.get('utm_campaign'),
      }
      let { data: inquiryId, error: sbError } = await supabase.rpc('submit_partner_inquiry', rpcPayload)

      // Backwards-compatible during deployment: the form still works before
      // the monetization migration reaches production.
      if (sbError && /submit_partner_inquiry|schema cache/i.test(sbError.message || '')) {
        const fallback = await supabase.from('partner_inquiries').insert([{
          business_name: rpcPayload.p_business_name,
          contact_name: rpcPayload.p_contact_name,
          phone: rpcPayload.p_phone,
          email: rpcPayload.p_email,
          city: rpcPayload.p_city,
          message: rpcPayload.p_message,
        }])
        sbError = fallback.error
        inquiryId = null
      }
      if (sbError) {
        setError(tx.bizError)
        setStatus('error')
        onEvent?.('partner_form_failed', { reason: 'database', code: sbError.code || null })
        return
      }
      if (inquiryId) {
        void supabase.functions.invoke('notify-partner-inquiry', { body: { inquiryId } })
          .then(({ error: notifyError }) => {
            if (notifyError) console.warn('partner notification:', notifyError.message)
          })
      }
    } else {
      // No backend configured — hand off to email instead of dropping the lead
      window.location.href = mailtoHref
    }
    setCooldownUntil(Date.now() + SUBMIT_COOLDOWN_MS)
    setStatus('success')
    onEvent?.('partner_form_submitted', { inquiry_type: initialVenue ? 'claim' : 'partner' })
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
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #EBE2D0', padding: 'calc(16px + var(--hm-sat, 0px)) 20px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
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

        <div style={{ background: '#241E16', color: '#F7F2E8', borderRadius: 14, padding: '17px 18px', marginBottom: 20, border: '1px solid #4A3D29' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#E0BE58', marginBottom: 6 }}>
            {isHe ? 'פיילוט שותפים מייסדים' : 'Founding partner pilot'}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
            {initialVenue
              ? (isHe ? `תבעו את הרישום של ${initialVenue.name_he || initialVenue.name}` : `Claim the ${initialVenue.name} listing`)
              : (isHe ? '60 ימים ללא עלות לעשרת המקומות הראשונים' : '60 days free for the first ten venues')}
          </div>
          <p style={{ color: '#D7CDBB', fontSize: 13, lineHeight: 1.55, margin: '0 0 12px' }}>
            {isHe
              ? 'נבדוק את פרטי העסק, נוסיף קישור הזמנה ונשלח דוח עם צפיות, ניווטים והזמנות. תוצאות החידון לעולם אינן למכירה.'
              : 'We verify your listing, add a booking link, and report views, directions, and reservations. Quiz recommendations are never for sale.'}
          </p>
          <button
            type="button"
            onClick={() => { onEvent?.('business_offer_clicked'); document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' }) }}
            style={{ background: '#C9A84C', color: '#241E16', border: 'none', borderRadius: 8, padding: '9px 13px', fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' }}
          >
            {isHe ? 'הגישו מועמדות לפיילוט ←' : 'Apply for the pilot →'}
          </button>
        </div>

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

        <h2 id="partner-form" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', scrollMarginTop: 24 }}>
          {initialVenue ? (isHe ? 'אמתו שאתם מנהלים את המקום' : 'Verify that you manage this venue') : tx.bizFormTitle}
        </h2>

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

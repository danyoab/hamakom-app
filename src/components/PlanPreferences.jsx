import { useId, useRef, useState } from 'react'
import VenuePreferences from './VenuePreferences.jsx'
import { getPlanPreferences, planPreferenceLabels, PLAN_FOCUS_OPTIONS } from '../lib/planPreferences.js'

const buttonStyle = { border: '1px solid #D8CCB2', borderRadius: 10, padding: '11px 15px', background: '#fff', color: '#241E16', font: 'inherit', fontSize: 13, cursor: 'pointer' }

export default function PlanPreferences({ answers, lang, onApply }) {
  const value = getPlanPreferences(answers)
  // Reopen with the applied values after a result/recovery changes the filters.
  return <PreferencesEditor key={JSON.stringify(value)} value={value} lang={lang} onApply={onApply} />
}

function PreferencesEditor({ value, lang, onApply }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const panelId = useId()
  const toggleRef = useRef(null)
  const he = lang === 'he'
  const labels = planPreferenceLabels(value, lang)
  const close = () => { setDraft(value); setOpen(false); toggleRef.current?.focus() }
  return (
    <section dir={he ? 'rtl' : 'ltr'} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16, background: '#fff', border: '1px solid #E6DCC8', borderRadius: 14, textAlign: 'start' }}>
      <button ref={toggleRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => open ? close() : setOpen(true)}
        style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: 'none', border: 0, color: '#241E16', cursor: 'pointer', font: 'inherit', textAlign: 'start' }}>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{he ? 'התאמה אישית' : 'Fine-tune'}{labels.length > 0 ? ` · ${labels.length}` : ''}</span>
          <span style={{ display: 'block', fontSize: 12, color: '#6E6450', marginTop: 3 }}>{he ? 'תזונה, תקציב, זמן ועוד — לבחירתכם' : 'Food, budget, timing & more · Optional'}</span>
        </span>
        <span aria-hidden="true" style={{ fontSize: 20 }}>{open ? '−' : '+'}</span>
      </button>
      {labels.length > 0 && !open && <div aria-label={he ? 'העדפות פעילות' : 'Active preferences'} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 14px' }}>
        {labels.map(label => <span key={label} style={{ fontSize: 11, background: '#EDF2E8', color: '#35543D', borderRadius: 999, padding: '5px 9px' }}>{label}</span>)}
      </div>}
      {open && <form id={panelId} onSubmit={e => { e.preventDefault(); onApply(draft); setOpen(false) }} style={{ padding: '0 16px 16px', display: 'grid', gap: 18 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{he ? 'סוג הדייט' : 'Type of date'}
          <select value={draft.focus} onChange={e => setDraft({ ...draft, focus: e.target.value })} style={{ ...buttonStyle, width: '100%', textAlign: 'start' }}>
            {PLAN_FOCUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o[lang]}</option>)}
          </select>
        </label>
        <VenuePreferences value={draft} lang={lang} onChange={setDraft} planning />
        <p style={{ fontSize: 12, margin: 0, color: '#6E6450', lineHeight: 1.5 }}>{he ? 'הוסיפו תאריך ושעת התחלה כדי לבדוק התאמה לשעות הפתיחה שפורסמו, כשיש מידע זמין.' : 'Add a date and start time to check the visit against published opening hours, where available.'}</p>
        <button type="submit" style={{ ...buttonStyle, background: '#241E16', borderColor: '#241E16', color: '#fff', fontSize: 14, fontWeight: 700 }}>{he ? 'עדכון הרעיונות' : 'Update my ideas'}</button>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button type="button" onClick={close} style={buttonStyle}>{he ? 'ביטול' : 'Cancel'}</button>
          <button type="button" onClick={() => { onApply(getPlanPreferences()); setOpen(false) }} style={{ ...buttonStyle, borderColor: 'transparent', textDecoration: 'underline' }}>{he ? 'איפוס ההעדפות' : 'Reset preferences'}</button>
        </div>
      </form>}
    </section>
  )
}

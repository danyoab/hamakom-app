import { useState } from 'react'
import VenuePreferences from './VenuePreferences.jsx'
import { getPlanPreferences, planPreferenceLabels, PLAN_FOCUS_OPTIONS } from '../lib/planPreferences.js'
import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'

export default function PlanPreferences({ answers, lang, onApply }) {
  const value = getPlanPreferences(answers)
  return <PreferencesEditor key={JSON.stringify(value)} value={value} lang={lang} onApply={onApply} />
}
function PreferencesEditor({ value, lang, onApply }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const he = lang === 'he'
  const labels = planPreferenceLabels(value, lang)
  const close = () => { setDraft(value); setOpen(false) }
  return <div className="ui-preferences">
    <button type="button" className="ui-button ui-button-subtle" aria-haspopup="dialog" onClick={() => setOpen(true)}><Icon name="tune" size={18} />{he ? 'התאמה אישית' : 'Customize'}{labels.length > 0 && <span className="ui-count">{labels.length}</span>}</button>
    {labels.length > 0 && <div className="ui-filter-summary" aria-label={he ? 'העדפות פעילות' : 'Active preferences'}>{labels.join(' · ')}</div>}
    <Sheet open={open} onClose={close} title={he ? 'בדיוק בשבילכם' : 'Make it yours'} lang={lang}>
      <p className="ui-subtitle">{he ? 'שנו רק את מה שחשוב לכם.' : 'Adjust what matters. Leave the rest to us.'}</p>
      <form className="ui-form" onSubmit={e => { e.preventDefault(); onApply(draft); setOpen(false) }}>
        <label>{he ? 'סוג הדייט' : 'Type of date'}<select value={draft.focus} onChange={e => setDraft({ ...draft, focus: e.target.value })}>{PLAN_FOCUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o[lang]}</option>)}</select></label>
        <VenuePreferences value={draft} lang={lang} onChange={setDraft} planning />
        <p className="ui-footnote">{he ? 'תאריך ושעה מאפשרים לבדוק התאמה לשעות שפורסמו. יש לאשר זמינות עם המקום.' : 'Add a date and time to check published hours. Confirm availability with the venue.'}</p>
        <div className="ui-sheet-actions"><button type="submit" className="ui-button ui-button-primary">{he ? 'הצגת התוצאות' : 'Show my results'}</button><button type="button" className="ui-button ui-button-subtle" onClick={close}>{he ? 'ביטול' : 'Cancel'}</button></div>
        <button type="button" className="ui-text-button" onClick={() => { onApply(getPlanPreferences()); setOpen(false) }}>{he ? 'איפוס ההעדפות' : 'Reset preferences'}</button>
      </form>
    </Sheet>
  </div>
}

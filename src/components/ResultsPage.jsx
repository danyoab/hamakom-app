import { marketOf } from '../lib/markets.js'
import { lazy, Suspense, useState } from 'react'
import { getMapsUrl } from '../lib/constants'
import { sharePlanMessage } from '../lib/share'
import { sharedPlanPath } from '../lib/sharedPlans.js'
import { siteOrigin } from '../lib/seo.js'
import { isFoodVenue, safeExternalUrl } from '../lib/venuePreferences.js'
import PlanPreferences from './PlanPreferences.jsx'
import VenueFoodDetails from './VenueFoodDetails.jsx'
import Icon from './Icon.jsx'
import Sheet from './Sheet.jsx'
import VenueImage from './VenueImage.jsx'
import { venuePhoto } from '../lib/venueImages.js'

const PlanRouteMap = lazy(() => import('./PlanRouteMap'))
const vibes = { outdoors: ['Outdoors', 'בחוץ'], 'food-drink': ['Food & conversation', 'אוכל ושיחה'], atmosphere: ['Somewhere quiet', 'באווירה שקטה'], activity: ['Something to do', 'פעילות יחד'] }
const stopName = (s, he) => he ? s.name_he || s.name_en : s.name_en || s.name_he
const clock = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export default function ResultsPage({ lang, plan, plans = [], locations = [], planIndex = 0, onSelectPlan,
  backupLocations = [], answers = {}, saved, reminderSet, onBrowseAll, onToggleBackupOptions,
  onOpenBackupLocation, onOpenPlanMaps, onSavePlan, onSharePlan, onSetReminder, onRetakeQuiz,
  onBuildYourOwnPlan, onApplyPreferences, onSuggestPlace, cityLocationCount }) {
  const he = lang === 'he'
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyState, setCopyState] = useState('')
  const stops = plan.stops || []
  const city = he ? plan.city_he || plan.city : plan.city
  const minutes = plan._schedule?.totalMinutes
  const rows = stops.map(s => locations.find(l => String(l.id) === String(s.source_location_id ?? s._locationId)))
  const prices = rows.map(r => r?.price)
  const price = prices.length && prices.every(p => Number.isInteger(p) && p >= 0 && p <= 4) ? marketOf(plan).symbol.repeat(Math.max(...prices)) || (he ? 'ללא תשלום' : 'Free entry') : null
  const link = `${siteOrigin()}${sharedPlanPath(plan, lang)}`
  const share = () => setShareOpen(true)
  const systemShare = async () => {
    try { await navigator.share({ ...sharePlanMessage(plan, lang), url: link }); onSharePlan?.() }
    catch { /* The copyable link remains available if sharing is canceled or unsupported. */ }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopyState(link); onSharePlan?.() }
    catch { setCopyState('manual') }
  }
  return <div className="ui-results" dir={he ? 'rtl' : 'ltr'}>
    <div className="ui-results-topbar"><button className="ui-text-button" onClick={onRetakeQuiz}><Icon name="back" className="ui-direction" size={18} />{he ? 'שינוי הבחירות' : 'Change choices'}</button><span>HaMakom</span></div>
    <div className="ui-results-layout">
      <header className="ui-plan-header">
        <p className="ui-eyebrow">{he ? 'זמן לשניכם' : 'A little time for two'}</p>
        <h1>{stops.length === 1 ? stopName(stops[0], he) : he ? `הדייט שלכם ב${city}` : `Your date in ${city}`}</h1>
        {stops.length > 1 && <p className="ui-plan-subtitle">{stops.map(s => stopName(s, he)).join(' · ')}</p>}
        <div className="ui-plan-facts">
          <span><Icon name="clock" size={17} />{minutes ? (he ? `כ־${minutes} דקות` : `About ${minutes} min`) : he ? plan.duration_text_he : plan.duration_text_en}</span>
          <span>{stops.length} {he ? (stops.length === 1 ? 'מקום' : 'מקומות') : (stops.length === 1 ? 'place' : 'stops')}</span>
          {price && <span title={he ? 'רמת מחיר משוערת; יש לאשר עם המקום' : 'Catalog price level; confirm with the venue'}>{price}</span>}
          {stops.length === 1 && <span>{city}</span>}
        </div>
        {plan.planning_date && <p className="ui-footnote">{plan.planning_date}{plan.start_time ? ` · ${plan.start_time}` : ''} · {marketOf(plan).id === 'ny' ? (he ? 'שעון ניו יורק' : 'New York time') : (he ? 'שעון ישראל' : 'Israel time')}</p>}
        <div className="ui-plan-actions"><button className={`ui-button ${saved ? 'ui-button-saved' : 'ui-button-primary'}`} aria-pressed={saved} onClick={onSavePlan}><Icon name={saved ? 'check' : 'bookmark'} size={18} />{he ? saved ? 'נשמר' : 'שמירת הדייט' : saved ? 'Saved' : 'Save this date'}</button><button className="ui-button ui-button-secondary" onClick={share}><Icon name="share" size={18} />{he ? 'שיתוף' : 'Share'}</button></div>
      </header>
      <div className="ui-plan-controls">
        {plans.length > 1 && <div className="ui-plan-options" role="group" aria-label={he ? 'רעיונות לדייט' : 'Date ideas'}>{plans.map((p, i) => {
          const label = vibes[p.focus_tags?.[0]]?.[he ? 1 : 0]
          const duplicate = plans.filter(other => other.focus_tags?.[0] === p.focus_tags?.[0]).length > 1
          return <button key={p.id} aria-pressed={i === planIndex} onClick={() => onSelectPlan?.(i)}>{duplicate || !label ? stopName(p.stops[0], he) : label}</button>
        })}</div>}
        {onApplyPreferences && <PlanPreferences answers={answers} lang={lang} onApply={onApplyPreferences} />}
      </div>
      <aside className="ui-plan-map"><Suspense fallback={<div className="ui-map-loading" role="status">{he ? 'טוענים מפה…' : 'Loading your map…'}</div>}><PlanRouteMap stops={stops.map(s => ({ ...s, city: plan.city, city_he: plan.city_he }))} lang={lang} planCity={plan.city} travelMode={plan.travel_mode} onOpenMaps={onOpenPlanMaps} /></Suspense></aside>
      <main className="ui-itinerary">
        <div className="ui-section-heading"><h2>{he ? 'התוכנית שלכם' : 'Your itinerary'}</h2><span>{he ? 'בקצב שלכם' : 'At your pace'}</span></div>
        <ol className="ui-stop-list">{stops.map((stop, i) => <li key={`${plan.id}-${i}`}>
          <div className="ui-stop-number">{i + 1}</div>
          <div className="ui-stop-content">
            <div className="ui-stop-meta"><span>{stop.arrival != null ? `≈ ${clock(stop.arrival)}` : he ? i === 0 ? 'מתחילים כאן' : 'ממשיכים לכאן' : i === 0 ? 'Start here' : 'Then, head here'}</span>{stop.duration && <span>{stop.duration} {he ? 'דקות' : 'min'}</span>}</div>
            <h3>{stopName(stop, he)}</h3>
            {venuePhoto(rows[i]) && <VenueImage loc={rows[i]} size="stop" alt={stopName(stop, he)} className="ui-stop-photo" />}
            <p>{he ? stop.instruction_he : stop.instruction_en}</p>
            {rows[i]?.region === 'New York Metro' && <p className="ui-stop-practical">{he ? rows[i].description_he || rows[i].description : rows[i].description}</p>}
            <div className="ui-stop-links">{rows[i] && onOpenBackupLocation && <button className="ui-text-button" onClick={() => onOpenBackupLocation(rows[i])}>{he ? 'פרטי המקום' : 'Place details'}<Icon name="chevron" size={14} className="ui-direction" /></button>}{getMapsUrl(stop.maps_query) && <a className="ui-text-button" href={getMapsUrl(stop.maps_query)} target="_blank" rel="noopener noreferrer" onClick={onOpenPlanMaps}>{he ? 'הוראות הגעה' : 'Directions'}<Icon name="arrow" size={14} className="ui-direction" /></a>}</div>
            {rows[i] && (isFoodVenue(rows[i]) || safeExternalUrl(rows[i].menu_url)) && <details className="ui-stop-details"><summary>{he ? 'תפריט, תזונה וכשרות' : 'Menu, food & kashrut'}</summary><VenueFoodDetails loc={rows[i]} lang={lang} compact /><p className="ui-footnote">{he ? 'לפרטי הכשרות המעודכנים, פתחו את פרטי המקום ואשרו מולו.' : 'Open place details for available kashrut evidence, and confirm with the venue.'}</p></details>}
            {stop.hours === 'fits_regular_hours' && <p className="ui-footnote">{he ? 'מתאים לשעות הרגילות שפורסמו; יש לאשר ליום הביקור.' : 'Fits published regular hours; confirm for your date.'}</p>}
            {i < stops.length - 1 && <div className="ui-travel"><Icon name="arrow" size={15} className="ui-direction" />{he ? `כ־${stops[i + 1].travel ?? '—'} דקות ${plan.travel_mode === 'driving' ? 'נסיעה וחניה' : 'הליכה'}` : `About ${stops[i + 1].travel ?? '—'} min ${plan.travel_mode === 'driving' ? 'driving & parking' : 'walk'}`}</div>}
          </div>
        </li>)}</ol>
        <div className="ui-plan-note"><Icon name="info" size={18} /><p>{plan._availabilityUnconfirmed ? (he ? 'הפעילות הנוכחית לא אומתה. בדקו עם המקום לפני היציאה.' : 'Current operation is unconfirmed. Check with the venue before going.') : (he ? 'בדקו שעות, כשרות וזמינות לפני היציאה.' : 'Confirm hours, kashrut and availability before you go.')}{stops.length > 1 ? (he ? ' זמני המעבר משוערים — בדקו את המסלול במפות.' : ' Travel times are estimates; check the route in Maps.') : ''}{plan.planning_date ? (he ? ' שעות בחגים ובשבת עשויות להשתנות.' : ' Holiday and Shabbat hours may differ.') : ''}</p></div>
        <details className="ui-more-options"><summary>{he ? 'עוד אפשרויות' : 'More options'}</summary>
          {onSetReminder && <><button className="ui-text-button" onClick={onSetReminder}>{reminderSet ? (he ? 'ביטול בדיקה בביקור הבא' : 'Remove next-visit check-in') : (he ? 'בדיקה בביקור הבא' : 'Check in on my next visit')}</button><p className="ui-footnote">{he ? 'מופיע כשתחזרו לאתר. זו אינה התראה בטלפון.' : 'Appears when you return to the app. This is not a phone notification.'}</p></>}
          <button className="ui-text-button" onClick={onBuildYourOwnPlan}>{he ? 'בניית תוכנית בעצמכם' : 'Build your own plan'}</button>
        </details>
        {backupLocations.length > 0 && <section className="ui-alternatives"><button className="ui-row-button" aria-expanded={showAlternatives} onClick={() => { setShowAlternatives(!showAlternatives); if (!showAlternatives) onToggleBackupOptions?.() }}>{he ? 'עוד מקומות באזור' : 'More places nearby'}<span>{backupLocations.length}<Icon name="chevron" size={16} className="ui-direction" /></span></button>{showAlternatives && backupLocations.map(loc => <button key={loc.id} className="ui-row-button" onClick={() => onOpenBackupLocation?.(loc)}>{he ? loc.name_he || loc.name : loc.name}<Icon name="chevron" size={16} className="ui-direction" /></button>)}</section>}
        {cityLocationCount === 0 && onSuggestPlace && <button className="ui-text-button" onClick={onSuggestPlace}>{he ? 'מכירים מקום? ספרו לנו' : 'Know a place? Suggest it'}</button>}
        <button className="ui-text-button ui-browse-link" onClick={onBrowseAll}>{he ? 'לכל המקומות' : 'Explore all places'}<Icon name="arrow" size={17} className="ui-direction" /></button>
      </main>
    </div>
    <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title={he ? 'שתפו את הדייט' : 'Share your date'} lang={lang}><p className="ui-subtitle">{he ? 'שלחו את התוכנית, עם כל המקומות והמפה.' : 'Send the itinerary, places and map together.'}</p><label className="ui-share-link">{he ? 'קישור לדייט' : 'Link to your date'}<input readOnly value={link} onFocus={e => e.target.select()} /></label><button className="ui-button ui-button-primary" onClick={copy}>{copyState === link ? (he ? 'הקישור הועתק' : 'Link copied') : (he ? 'העתקת קישור' : 'Copy link')}</button><p><button className="ui-text-button" hidden={!navigator.share} onClick={systemShare}>{he ? 'אפשרויות שיתוף נוספות' : 'More sharing options'}</button></p><p className="ui-footnote" role="status">{copyState === 'manual' ? (he ? 'בחרו והעתיקו את הקישור למעלה.' : 'Select and copy the link above.') : copyState === link ? (he ? 'מוכן לשליחה.' : 'Ready to send.') : ''}</p></Sheet>
  </div>
}

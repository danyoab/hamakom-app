import { lazy, Suspense, useMemo, useState } from 'react'
import { getMapsUrl } from '../lib/constants'
import { buildPlanIdentity, getPlanFitSummary } from '../lib/quiz'
import { shareContent, sharePlanMessage } from '../lib/share'
import VenueFoodDetails from './VenueFoodDetails.jsx'
import { sharedPlanPath } from '../lib/sharedPlans.js'
import { siteOrigin } from '../lib/seo.js'
import PlanPreferences from './PlanPreferences.jsx'
import { getPlanNavigationUrl } from '../lib/planMap.js'

const PlanRouteMap = lazy(() => import('./PlanRouteMap'))

const BG       = '#F7F2E8'
const PANEL    = '#FFFFFF'
const BORDER   = '#EBE2D0'
const TEXT     = '#241E16'
const MUTED    = '#8A7F6C'
const ACCENT   = '#9A7A28'   // gold for eyebrows / links (readable on cream)
const GOLD     = '#C9A84C'   // bright gold for fills (stop numbers)
const INK      = '#241E16'   // dark pill / primary button
const SOFT     = '#6E6450'   // body copy
const SERIF    = "'Spectral','Frank Ruhl Libre',Georgia,serif"

// Short, friendly vibe labels for the plan tabs, keyed by a plan's primary
// focus tag. Falls back to the plan title when a focus has no mapping.
const VIBE_LABELS = {
  'outdoors':   { en: 'Outdoorsy',   he: 'בחוץ',       suben: 'Move & view',   subhe: 'תנועה ונוף' },
  'food-drink': { en: 'Food & talk', he: 'אוכל ושיחה', suben: 'Sit & savor',   subhe: 'לשבת ולטעום' },
  'atmosphere': { en: 'Intimate',    he: 'אווירה',     suben: 'Mood & place',  subhe: 'אווירה ומקום' },
  'activity':   { en: 'Playful',     he: 'שובב',       suben: 'Do something',  subhe: 'פעילות' },
}

function vibeLabel(plan, lang) {
  const v = VIBE_LABELS[plan?.focus_tags?.[0]]
  if (v) return { title: lang === 'he' ? v.he : v.en, sub: lang === 'he' ? v.subhe : v.suben }
  return { title: lang === 'he' ? plan?.title_he : plan?.title_en, sub: '' }
}

function getLocalizedPlanText(plan, lang) {
  const isHe = lang === 'he'
  return {
    title:        isHe ? plan.title_he        : plan.title_en,
    narrative:    isHe ? plan.narrative_he     : plan.narrative_en,
    startTime:    isHe ? plan.start_time_text_he : plan.start_time_text_en,
    duration:     isHe ? plan.duration_text_he : plan.duration_text_en,
    budget:       isHe ? plan.budget_text_he   : plan.budget_text_en,
    shareSummary: isHe ? plan.share_summary_he : plan.share_summary_en,
    routeReason:  isHe ? plan.route_reason_he  : plan.route_reason_en,
  }
}

// Role → short, human label shown above each stop title (RULE 1 hierarchy).
const ROLE_LABELS = {
  anchor:     { en: 'The anchor',        he: 'עוגן הערב' },
  transition: { en: 'Change of pace',    he: 'שינוי קצב' },
  extension:  { en: 'Optional extension', he: 'תוספת אופציונלית' },
}

// ── Itinerary timing (client-side, best-effort) ─────────────────────────────
// Turns "Best start: 5:30pm" + per-stop durations into approximate clock
// times per stop, so the plan scans like a real evening: 5:30 → 6:20 → 7:10.
// Every value is prefixed "≈" in the UI; if the start time can't be parsed
// we silently fall back to showing durations only.
const KIND_MINUTES = { food: 60, cafe: 40, dessert: 30, bar: 45, lounges: 45, winery: 45, outdoors: 35, activity: 60, culture: 60, other: 45 }

function parseStartMinutes(plan) {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(plan.start_time_text_en || '')
  if (!m) return null
  let h = parseInt(m[1], 10)
  const ap = (m[3] || '').toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + parseInt(m[2], 10)
}

function stopMinutes(stop) {
  if (stop.kind && KIND_MINUTES[stop.kind]) return KIND_MINUTES[stop.kind]
  const t = stop.duration_text_en || ''
  const hr = /(\d+(?:\.\d+)?)\s*hr/i.exec(t)
  if (hr) return Math.round(parseFloat(hr[1]) * 60)
  const range = /(\d+)\s*[–-]\s*(\d+)\s*min/i.exec(t)
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2)
  const single = /(\d+)\s*min/i.exec(t)
  if (single) return Number(single[1])
  return 45
}

function walkMinutesBetween(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  const km = 2 * 6371 * Math.asin(Math.sqrt(h))
  return Math.max(1, Math.round(km * 12)) // ~12 min per km on foot
}

function formatClock(mins, isHe) {
  const h24 = Math.floor(mins / 60) % 24
  const mm = String(mins % 60).padStart(2, '0')
  if (isHe) return `${h24}:${mm}`
  const h12 = h24 % 12 || 12
  return `${h12}:${mm}${h24 >= 12 ? 'pm' : 'am'}`
}

export default function ResultsPage({
  lang,
  font,
  plan,
  plans = [],
  locations = [],
  planIndex = 0,
  onSelectPlan,
  backupLocations = [],
  answers,
  saved,
  reminderSet,
  cityLocationCount = null,
  onBrowseAll,
  onToggleBackupOptions,
  onOpenBackupLocation,
  onOpenPlanMaps,
  onSavePlan,
  onSharePlan,
  onSetReminder,
  onRetakeQuiz,
  onBuildYourOwnPlan,
  onSuggestPlace,
  onApplyPreferences,
}) {
  const [showBackups, setShowBackups] = useState(false)
  const [copiedLink, setCopiedLink] = useState('')
  const [manualLink, setManualLink] = useState('')
  const planLink = `${siteOrigin()}${sharedPlanPath(plan, lang)}`
  const isHe  = lang === 'he'
  const cityLabel = isHe ? plan.city_he || plan.city : plan.city
  const dir   = isHe ? 'rtl' : 'ltr'
  const text  = getLocalizedPlanText(plan, lang)
  const identity   = buildPlanIdentity(answers)
  const fitSummary = getPlanFitSummary(plan, answers, lang)
  const isShortPlan = (answers.length || plan.length_tags?.[0]) === 'short'
  const primaryStops  = isShortPlan ? plan.stops.slice(0, 2) : plan.stops
  const optionalStops = isShortPlan ? plan.stops.slice(2) : []
  const planMapsUrl = getPlanNavigationUrl(plan.stops, plan.travel_mode)

  // Approximate clock time per stop + walking time between stops, so the
  // itinerary scans as a real evening instead of a list of paragraphs.
  const itinerary = useMemo(() => {
    if (plan._schedule) return plan._schedule.scheduled.map(s => ({ timeLabel: s.arrival == null ? null : formatClock(s.arrival, isHe), walk: s.travel }))
    const initial = { time: parseStartMinutes(plan), rows: [] }
    return primaryStops.reduce((state, stop, i) => {
      const walk = i > 0 ? walkMinutesBetween(primaryStops[i - 1], stop) : null
      const arrival = state.time != null ? state.time + (walk || 0) : null
      const timeLabel = arrival != null ? formatClock(arrival, isHe) : null
      return {
        time: arrival != null ? arrival + stopMinutes(stop) : null,
        rows: [...state.rows, { timeLabel, walk }],
      }
    }, initial).rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, isShortPlan, isHe])

  const handleShare = async () => {
    try {
      const shared = await shareContent(sharePlanMessage(plan, lang))
      if (shared) onSharePlan?.()
    } catch { /* cancelled */ }
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: font }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(165deg,#F7F2E8 0%,#F1EAD9 100%)', padding: 'calc(28px + var(--hm-sat, 0px)) 22px 22px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: ACCENT, textTransform: 'uppercase' }}>
              {(isHe ? plan.identity_label_he : plan.identity_label_en) || identity[lang]}
            </div>
            {planIndex === 0 ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4F7144', background: '#E9F0E4', borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {plan._lowConfidence
                  ? (isHe ? 'הכי קרוב שמצאנו' : 'Closest match')
                  : (isHe ? 'ההתאמה המובילה' : 'Top match')}
              </span>
            ) : plan.city ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: '#FBF4E1', borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {isHe ? `גם ב${plan.city}` : `Also in ${plan.city}`}
              </span>
            ) : null}
          </div>

          <h1 className="hm-reveal" style={{ animationDelay: '0.05s', fontFamily: SERIF, fontSize: 'clamp(26px, 7vw, 34px)', lineHeight: 1.08, margin: '0 0 12px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            {text.title}
          </h1>

          {/* Chips row — the at-a-glance facts */}
          <div className="hm-reveal" style={{ animationDelay: '0.14s', display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {text.startTime ? <Chip>🕐 {text.startTime}</Chip> : null}
            {text.duration  ? <Chip>{text.duration}</Chip>  : null}
            <Chip>{plan._singleVenue ? (isHe ? 'דייט במקום אחד' : 'One-place date') : `${primaryStops.length} ${isHe ? 'עצירות' : 'stops'}`}</Chip>
            {plan.planning_date && <Chip>{plan.planning_date}</Chip>}
            {text.budget    ? <Chip>{text.budget}</Chip>    : null}
            {plan.city      ? <Chip>📍 {cityLabel}</Chip>  : null}
          </div>

          <p className="hm-reveal" style={{ animationDelay: '0.2s', margin: 0, fontSize: 14, color: SOFT, lineHeight: 1.6, fontStyle: 'italic' }}>
            {fitSummary}
          </p>

          <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.6, color: SOFT }}>
            {plan._availabilityUnconfirmed
              ? (isHe ? 'רעיון מהמאגר שלנו; הפעילות הנוכחית עדיין לא אומתה. בדקו עם המקום לפני היציאה.' : 'A place from our catalog; current operation has not been confirmed. Check with the venue before going.')
              : (isHe ? 'שעות וזמינות אינן מובטחות. אישור הזמנה ופרטים עדכניים — ישירות מול המקום.' : 'Opening hours and availability are not guaranteed. Confirm reservations and current details with the venue.')}
            {plan.planning_date && (isHe ? ' זמני הביקור משוערים; חגים ושבת עשויים לשנות שעות.' : ' Visit times are estimates; holiday and Shabbat hours may differ.')}
          </p>

          {plan._cityMismatch && plan.city ? (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 12, color: '#F59E0B' }}>
              {isHe
                ? `שימו לב — התוכנית הזו ב${plan.city}, לא ב${answers.city || ''}.`
                : `Heads up — this plan is in ${plan.city}, not ${answers.city || 'your selected city'}.`}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '18px 18px 48px' }}>

        {onApplyPreferences && <PlanPreferences answers={answers} lang={lang} onApply={onApplyPreferences} />}

        {/* ── Vibe tabs (other plans in this city) ─────────────── */}
        {plans.length > 1 ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A99A78', textTransform: 'uppercase', marginBottom: 9 }}>
              {plan.city
                ? (isHe ? `${plans.length} תוכניות ב${cityLabel}` : `${plans.length} plans in ${plan.city}`)
                : (isHe ? 'וייבים נוספים' : 'Other vibes to try')}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              {plans.map((p, i) => {
                const active = i === planIndex
                const vl = vibeLabel(p, lang)
                const sameVibe = plans.filter(other => vibeLabel(other, lang).title === vl.title).length > 1
                const firstName = isHe ? p.stops?.[0]?.name_he || p.stops?.[0]?.name_en : p.stops?.[0]?.name_en
                const tabTitle = sameVibe ? firstName || (isHe ? `אפשרות ${i + 1}` : `Option ${i + 1}`) : vl.title
                const tabSubtitle = sameVibe ? vl.title : vl.sub
                return (
                  <button
                    key={p.id}
                    aria-pressed={active}
                    title={tabTitle}
                    onClick={() => onSelectPlan?.(i)}
                    style={{
                      flexShrink: 0, maxWidth: 220, borderRadius: 14, padding: '11px 15px', cursor: 'pointer',
                      fontFamily: font, textAlign: isHe ? 'right' : 'left', transition: 'all 0.18s',
                      background: active ? INK : PANEL,
                      border: `1.5px solid ${active ? INK : '#E6DCC8'}`,
                    }}
                  >
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 700, color: active ? '#F4ECD8' : '#3C342A' }}>
                      {tabTitle}
                    </span>
                    {tabSubtitle ? (
                      <span style={{ display: 'block', fontSize: 11, marginTop: 1, color: active ? 'rgba(244,236,216,0.7)' : '#A99A85' }}>
                        {tabSubtitle}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* A plan always has a map, including one-place and area-only ideas. */}
        {primaryStops.length > 0 ? (
          <div className="hm-reveal" style={{ animationDelay: '0.26s', marginBottom: 12, borderRadius: 16, overflow: 'hidden', height: 340, border: `1px solid ${BORDER}` }}>
            <Suspense fallback={<div role="status" style={{ height: '100%', background: '#EDE7D9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>{isHe ? 'טוענים מפה…' : 'Loading map…'}</div>}>
              <PlanRouteMap stops={primaryStops.map(s => ({ ...s, city: plan.city, city_he: plan.city_he }))} lang={lang} planCity={plan.city} travelMode={plan.travel_mode} onOpenMaps={onOpenPlanMaps} />
            </Suspense>
          </div>
        ) : null}

        {/* ── The night unfolds (the plan itself, stops first) ─────── */}
        <div className="hm-reveal" style={{ animationDelay: '0.34s', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase', marginBottom: 14 }}>
            {isHe ? 'איך הערב נבנה' : 'How the night unfolds'}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {primaryStops.map((stop, i) => (
              <StopCard
                key={`${plan.id}-${i}`}
                stop={stop}
                index={i}
                lang={lang}
                total={primaryStops.length}
                timeLabel={itinerary[i]?.timeLabel}
                walkToNext={itinerary[i + 1]?.walk ?? null}
                travelMode={plan.travel_mode}
                location={locations.find(l => String(l.id) === String(stop.source_location_id ?? stop._locationId))}
                onOpenLocation={onOpenBackupLocation}
              />
            ))}
          </div>

          {optionalStops.length ? (
            <div style={{ marginTop: 12, borderTop: `1px dashed ${BORDER}`, paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
                {isHe ? 'אם הערב זורם — אפשר להוסיף:' : 'If the night is flowing, add:'}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {optionalStops.map((stop, i) => (
                  <CompactStop key={`opt-${i}`} stop={stop} lang={lang} />
                ))}
              </div>
            </div>
          ) : null}

          {text.routeReason ? (
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: '#FBF4E1', border: `1px solid #EBDFC0`, borderRadius: 12, padding: '11px 13px', marginTop: 16 }}>
              <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.4 }}>✨</span>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: ACCENT, textTransform: 'uppercase', marginBottom: 3 }}>
                {plan._singleVenue ? (isHe ? 'למה המקום הזה מתאים' : 'Why this place works') : (isHe ? 'למה המסלול הזה עובד' : 'Why this route works')}
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: SOFT }}>{text.routeReason}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Narrative — hand-written curated copy only; generated
               narratives just restate the hero fit summary ─────── */}
        {text.narrative && plan.source_type !== 'generated-location' ? (
          <div style={{ padding: '14px 16px', background: '#FBF7EE', border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#6E6450', fontStyle: 'italic' }}>
              {text.narrative}
            </p>
          </div>
        ) : null}

        {/* ── Primary CTA (right after the plan) ───────────────── */}
        <div className="hm-reveal" style={{ animationDelay: '0.44s', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <button
            onClick={onSavePlan}
            style={{
              gridColumn: '1 / -1',
              background: saved ? '#E9F0E4' : INK,
              color: saved ? '#4F7144' : '#F4ECD8',
              border: saved ? '1px solid #C7DCBC' : 'none',
              borderRadius: 14, padding: '15px 0',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font,
              transition: 'all 0.2s',
            }}
          >
            {saved ? (isHe ? '✓ תוכנית שמורה' : '✓ Plan saved') : isHe ? 'שמור את התוכנית' : 'Save this plan'}
          </button>

          <button onClick={handleShare} style={secondaryBtn(font)}>
            {isHe ? 'שתף' : 'Share'}
          </button>

          <button onClick={async () => {
            try { await navigator.clipboard.writeText(planLink); setCopiedLink(planLink); setManualLink('') }
            catch { setManualLink(planLink) }
          }} style={secondaryBtn(font)}>
            {copiedLink === planLink ? (isHe ? '✓ הקישור הועתק' : '✓ Link copied') : (isHe ? 'העתקת קישור' : 'Copy link')}
          </button>
          {manualLink === planLink && <input aria-label={isHe ? 'קישור לשיתוף' : 'Link to share'} readOnly value={planLink} onFocus={e => e.target.select()} style={{ gridColumn: '1 / -1', width: '100%', boxSizing: 'border-box', padding: 12 }} />}

          <button
            onClick={onSetReminder}
            style={reminderSet ? { ...secondaryBtn(font), color: '#4F7144', borderColor: '#C7DCBC', background: '#E9F0E4' } : secondaryBtn(font)}
          >
            {reminderSet ? (isHe ? '✓ בדיקה בביקור הבא' : '✓ Check-in saved') : isHe ? 'בדיקה בביקור הבא' : 'Check in next visit'}
          </button>

          {planMapsUrl ? (
            <a
              href={planMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenPlanMaps?.()}
              style={{ ...secondaryBtn(font), gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              {isHe ? plan.stops.length > 1 ? 'ניווט למסלול' : 'פתח במפות' : plan.stops.length > 1 ? 'Navigate the route' : 'Open in Maps'} ↗
            </a>
          ) : null}
        </div>

        {/* ── Verification disclaimer (fine print, after the actions) ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 13px', background: '#FBF7EE', border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 13, lineHeight: 1.4, flexShrink: 0 }}>ℹ️</span>
          <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            {isHe
              ? 'בדקו שעות, כשרות וזמינות שולחן עם המקום. זמני המעבר הם הערכות לפי מרחק אווירי, לא ניווט. בדיקה בביקור הבא תופיע כשתחזרו לאתר; זו אינה התראה בטלפון.'
              : 'Check hours, kashrut and table availability with the venue. Travel estimates use straight-line distance, not a mapped route. Check-ins appear when you return to the app; they are not phone notifications.'}
          </p>
        </div>

        {/* ── Backup options ────────────────────────────────────── */}
        {backupLocations.length > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => {
                const next = !showBackups
                setShowBackups(next)
                if (next) onToggleBackupOptions?.()
              }}
              style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: font, padding: '8px 0', textDecoration: 'underline', textDecorationColor: 'rgba(107,114,128,0.35)', textUnderlineOffset: 3 }}
            >
              {showBackups
                ? (isHe ? 'הסתר חלופות' : 'Hide alternatives')
                : (isHe ? `עוד ${backupLocations.length} מקומות לשקול` : `${backupLocations.length} more places to consider`)}
            </button>

            {showBackups ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {backupLocations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => onOpenBackupLocation(loc)}
                    style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '13px 15px', textAlign: isHe ? 'right' : 'left', cursor: 'pointer', fontFamily: font, color: TEXT }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{isHe ? loc.name_he || loc.name : loc.name}</div>
                    <div style={{ fontSize: 12, color: ACCENT, marginBottom: 5 }}>{isHe ? loc.city_he || loc.city : loc.city}</div>
                    <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.45 }}>{isHe ? loc.description_he || loc.description : loc.description}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── Empty-city CTA: invite a recommendation ──────────── */}
        {onSuggestPlace && answers?.city && answers.city !== 'flexible' && cityLocationCount === 0 ? (
          <div style={{ background: '#FFFFFF', border: `1px dashed ${GOLD}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: SOFT, lineHeight: 1.5, marginBottom: 10 }}>
              {isHe
                ? `עוד אין לנו הרבה מקומות ב${answers.city} — מכירים מקום טוב?`
                : `We don't have many date spots in ${answers.city} yet — know one?`}
            </div>
            <button
              onClick={onSuggestPlace}
              style={{ background: ACCENT, color: BG, border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
            >
              {isHe ? 'הציעו מקום' : 'Recommend a place'} →
            </button>
          </div>
        ) : null}

        {/* ── Bottom links ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 8 }}>
          <button onClick={onRetakeQuiz} style={linkBtn(font)}>
            {isHe ? 'ענו שוב על השאלות' : 'Retake the quiz'}
          </button>
          <button onClick={onBrowseAll} style={linkBtn(font)}>
            {isHe ? 'דפדפו בכל המקומות' : 'Browse all places'}
          </button>
          <button onClick={onBuildYourOwnPlan} style={{ ...linkBtn(font), color: '#B0A48E' }}>
            {isHe ? 'בנו תוכנית בעצמכם' : 'Build your own plan'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ children }) {
  return (
    <span style={{ background: '#FFFFFF', border: `1px solid #E9E0CE`, borderRadius: 999, padding: '6px 11px', fontSize: 12.5, fontWeight: 600, color: '#5A5142', lineHeight: 1 }}>
      {children}
    </span>
  )
}

function StopCard({ stop, index, lang, total, timeLabel, walkToNext, travelMode, location, onOpenLocation }) {
  const isHe = lang === 'he'
  const title       = isHe ? stop.name_he        : stop.name_en
  const instruction = isHe ? stop.instruction_he  : stop.instruction_en
  const orderTip    = isHe ? stop.order_tip_he    : stop.order_tip_en
  const mapsUrl     = getMapsUrl(stop.maps_query)
  const isLast      = index === total - 1
  const roleLabel   = stop.role ? ROLE_LABELS[stop.role]?.[isHe ? 'he' : 'en'] : null
  const duration    = stop.duration ? `${stop.duration} ${isHe ? 'דקות' : 'min'}` : isHe ? stop.duration_text_he : stop.duration_text_en
  const isExtension = stop.role === 'extension'

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      {/* Number + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: isExtension ? 'transparent' : GOLD,
          border: isExtension ? `1.5px dashed ${GOLD}` : 'none',
          color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
        }}>
          {index + 1}
        </div>
        {!isLast ? <div style={{ width: 2, flex: 1, background: 'linear-gradient(#E4DAC4,#EFE7D6)', marginTop: 4, minHeight: 18 }} /> : null}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 6 }}>
        {/* Role + time row: clock time anchors the scan; duration is the fallback */}
        {(roleLabel || timeLabel || duration) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            {roleLabel ? (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: isExtension ? MUTED : ACCENT }}>
                {roleLabel}
              </span>
            ) : <span />}
            {timeLabel ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: '#FBF4E1', border: '1px solid #EBDFC0', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                ≈{timeLabel}
              </span>
            ) : duration ? (
              <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span aria-hidden style={{ opacity: 0.7 }}>◷</span>{duration}
              </span>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 600, color: TEXT }}>{title}</span>
          {timeLabel && duration ? (
            <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>◷ {duration}</span>
          ) : null}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#6E6450', marginBottom: orderTip ? 6 : 0 }}>{instruction}</div>
        {orderTip ? (
          <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, background: '#FAF6EC', borderRadius: 10, padding: '9px 12px', marginTop: 6, display: 'flex', gap: 7 }}>
            <span aria-hidden style={{ flexShrink: 0 }}>💡</span>
            <span>{orderTip}</span>
          </div>
        ) : null}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: ACCENT, textDecoration: 'none' }}>
            {isHe ? 'פתח במפות ←' : '→ Open in Maps'}
          </a>
        ) : null}
        {location && <>
          <VenueFoodDetails loc={location} lang={lang} compact />
          {onOpenLocation && <button onClick={() => onOpenLocation(location)} style={{ border: 0, background: 'none', padding: '6px 0', color: ACCENT, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>{isHe ? 'פרטים, שעות וכשרות ←' : 'Details, hours & kashrut →'}</button>}
        </>}
        {stop.hours === 'fits_regular_hours' && <div style={{ fontSize: 11, color: MUTED }}>{isHe ? 'מתאים לשעות הרגילות שפורסמו — יש לאשר ביום הביקור' : 'Fits published regular hours — confirm for your date'}</div>}

        {/* Walking connector to the next stop */}
        {!isLast && walkToNext != null ? (
          <div style={{ marginTop: 10, marginBottom: 4, fontSize: 11.5, color: '#A99A85', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden>{travelMode === 'driving' ? '🚗' : '🚶'}</span>
            {travelMode === 'driving'
              ? (isHe ? `כ־${walkToNext} דקות נסיעה וחניה` : `~${walkToNext} min for driving & parking`)
              : (isHe ? `כ־${walkToNext} דקות הליכה — בדקו מסלול במפה` : `~${walkToNext} min walk — check the route in Maps`)}
          </div>
        ) : !isLast ? (
          <div style={{ height: 8 }} />
        ) : null}
      </div>
    </div>
  )
}

function CompactStop({ stop, lang }) {
  const isHe = lang === 'he'
  const title   = isHe ? stop.name_he       : stop.name_en
  const instruction = isHe ? stop.instruction_he : stop.instruction_en
  const mapsUrl = getMapsUrl(stop.maps_query)

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: BORDER, marginTop: 7, flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{title}</span>
        {instruction ? <span style={{ fontSize: 13, color: MUTED, marginLeft: 6 }}>{instruction}</span> : null}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 4, fontSize: 12, color: ACCENT, textDecoration: 'none' }}>
            {isHe ? 'פתח במפות' : '→ Maps'}
          </a>
        ) : null}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

function secondaryBtn(font) {
  return {
    background: PANEL, color: '#3C342A', border: `1px solid #E6DCC8`,
    borderRadius: 16, padding: '14px 0', fontSize: 14.5, fontWeight: 700,
    cursor: 'pointer', fontFamily: font,
  }
}

function linkBtn(font) {
  return {
    background: 'none', border: 'none', color: MUTED, fontSize: 13,
    cursor: 'pointer', fontFamily: font, padding: '7px 0',
    textDecoration: 'underline', textDecorationColor: 'rgba(154,143,124,0.4)',
    textUnderlineOffset: 3,
  }
}

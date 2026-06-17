import { lazy, Suspense, useMemo, useState } from 'react'
import { getMapsUrl } from '../lib/constants'
import { buildPlanIdentity, getPlanFitSummary } from '../lib/quiz'

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

function getLocalizedPlanText(plan, lang) {
  const isHe = lang === 'he'
  return {
    title:        isHe ? plan.title_he        : plan.title_en,
    narrative:    isHe ? plan.narrative_he     : plan.narrative_en,
    startTime:    isHe ? plan.start_time_text_he : plan.start_time_text_en,
    duration:     isHe ? plan.duration_text_he : plan.duration_text_en,
    budget:       isHe ? plan.budget_text_he   : plan.budget_text_en,
    shareSummary: isHe ? plan.share_summary_he : plan.share_summary_en,
  }
}

export default function ResultsPage({
  lang,
  font,
  plan,
  planIndex = 0,
  planCount = 1,
  backupLocations = [],
  answers,
  saved,
  reminderSet,
  cityLocationCount = null,
  onBrowseAll,
  onNextPlan,
  onToggleBackupOptions,
  onOpenBackupLocation,
  onOpenPlanMaps,
  onSavePlan,
  onSharePlan,
  onSetReminder,
  onRetakeQuiz,
  onBuildYourOwnPlan,
  onSuggestPlace,
}) {
  const [showBackups, setShowBackups] = useState(false)
  const isHe  = lang === 'he'
  const dir   = isHe ? 'rtl' : 'ltr'
  const text  = getLocalizedPlanText(plan, lang)
  const identity   = buildPlanIdentity(answers)
  const fitSummary = getPlanFitSummary(plan, answers, lang)
  const isShortPlan = (answers.length || plan.length_tags?.[0]) === 'short'
  const primaryStops  = isShortPlan ? plan.stops.slice(0, 2) : plan.stops
  const optionalStops = isShortPlan ? plan.stops.slice(2) : []
  const firstStopMaps = useMemo(() => getMapsUrl(plan.stops?.[0]?.maps_query), [plan])

  const handleShare = async () => {
    const stopNames = (plan.stops || []).slice(0, 3)
      .map(s => isHe ? s.name_he : s.name_en).filter(Boolean)
    const stopsLine = stopNames.join(' → ') || plan.city
    const message = isHe
      ? `✨ תוכנית ערב מ-HaMakom:\n\n🌟 ${text.title}\n📍 ${plan.city} · ${text.duration || ''}\n\n${stopsLine}\n\n💛 תכננו את הדייט שלכם: hamakom.app`
      : `✨ Date night from HaMakom:\n\n🌟 ${text.title}\n📍 ${plan.city} · ${text.duration || ''}\n\n${stopsLine}\n\n💛 Plan yours: hamakom.app`
    try {
      if (navigator.share) await navigator.share({ title: text.title, text: message })
      else window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      onSharePlan?.()
    } catch { /* cancelled */ }
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: font }}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(165deg,#F7F2E8 0%,#F1EAD9 100%)', padding: '28px 22px 22px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: ACCENT, textTransform: 'uppercase', marginBottom: 10 }}>
            {identity[lang]}
          </div>

          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 7vw, 34px)', lineHeight: 1.08, margin: '0 0 12px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            {text.title}
          </h1>

          {/* Chips row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {text.startTime ? <Chip>{text.startTime}</Chip> : null}
            {text.duration  ? <Chip>{text.duration}</Chip>  : null}
            {text.budget    ? <Chip>{text.budget}</Chip>    : null}
            {plan.city      ? <Chip>📍 {plan.city}</Chip>  : null}
          </div>

          <p style={{ margin: 0, fontSize: 14, color: SOFT, lineHeight: 1.6, fontStyle: 'italic' }}>
            {fitSummary}
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

        {/* ── Route map (only when stops have coords) ──────────── */}
        {primaryStops.filter(s => s.lat && s.lng).length >= 2 ? (
          <div style={{ marginBottom: 12, borderRadius: 16, overflow: 'hidden', height: 240, border: `1px solid ${BORDER}` }}>
            <Suspense fallback={<div style={{ height: '100%', background: '#EDE7D9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>Loading map…</div>}>
              <PlanRouteMap stops={primaryStops.map(s => ({ id: s.maps_query || s.name_en, name: s.name_en, name_he: s.name_he, lat: s.lat, lng: s.lng, city: plan.city }))} lang={lang} />
            </Suspense>
          </div>
        ) : null}

        {/* ── The night unfolds (the plan itself) ─────── */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase', marginBottom: 14 }}>
            {isHe ? 'איך הערב נבנה' : 'How the night unfolds'}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {primaryStops.map((stop, i) => (
              <StopCard key={`${plan.id}-${i}`} stop={stop} index={i} lang={lang} total={primaryStops.length} />
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
        </div>

        {/* ── Narrative ─────────────────────────────────────────── */}
        {text.narrative ? (
          <div style={{ padding: '14px 16px', background: '#FBF7EE', border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#6E6450', fontStyle: 'italic' }}>
              {text.narrative}
            </p>
          </div>
        ) : null}

        {/* ── Primary CTA (AFTER plan is visible) ──────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
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

          <button
            onClick={onSetReminder}
            style={reminderSet ? { ...secondaryBtn(font), color: '#4F7144', borderColor: '#C7DCBC', background: '#E9F0E4' } : secondaryBtn(font)}
          >
            {reminderSet ? (isHe ? '✓ תזכורת' : '✓ Reminder') : isHe ? 'תזכורת' : 'Reminder'}
          </button>

          {firstStopMaps ? (
            <a
              href={firstStopMaps}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenPlanMaps?.()}
              style={{ ...secondaryBtn(font), gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              {isHe ? 'פתח במפות' : 'Open in Maps'} →
            </a>
          ) : null}
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
                : (isHe ? 'רוצים וייב אחר? ראו 3 חלופות' : 'Want a different vibe? See 3 alternatives')}
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

function StopCard({ stop, index, lang, total }) {
  const isHe = lang === 'he'
  const title       = isHe ? stop.name_he        : stop.name_en
  const instruction = isHe ? stop.instruction_he  : stop.instruction_en
  const orderTip    = isHe ? stop.order_tip_he    : stop.order_tip_en
  const mapsUrl     = getMapsUrl(stop.maps_query)
  const isLast      = index === total - 1

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* Number + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: GOLD, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
          {index + 1}
        </div>
        {!isLast ? <div style={{ width: 2, flex: 1, background: 'linear-gradient(#E4DAC4,#EFE7D6)', marginTop: 4, minHeight: 18 }} /> : null}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 14 }}>
        <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 600, marginBottom: 4, color: TEXT }}>{title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#6E6450', marginBottom: orderTip ? 6 : 0 }}>{instruction}</div>
        {orderTip ? (
          <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, background: '#FAF6EC', borderRadius: 10, padding: '9px 12px', marginTop: 6 }}>
            💡
            {orderTip}
          </div>
        ) : null}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: ACCENT, textDecoration: 'none' }}>
            {isHe ? 'פתח במפות ←' : '→ Open in Maps'}
          </a>
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

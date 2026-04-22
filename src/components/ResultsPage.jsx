import { useMemo, useState } from 'react'
import { getMapsUrl } from '../lib/constants'
import { buildPlanIdentity, getPlanFitSummary } from '../lib/quiz'

function getLocalizedPlanText(plan, lang) {
  const isHe = lang === 'he'
  return {
    title: isHe ? plan.title_he : plan.title_en,
    narrative: isHe ? plan.narrative_he : plan.narrative_en,
    startTime: isHe ? plan.start_time_text_he : plan.start_time_text_en,
    duration: isHe ? plan.duration_text_he : plan.duration_text_en,
    budget: isHe ? plan.budget_text_he : plan.budget_text_en,
    shareSummary: isHe ? plan.share_summary_he : plan.share_summary_en,
  }
}

function getPaceLabel(plan, answers, lang) {
  const pace = answers.length || plan.length_tags?.[0] || 'medium'
  const labels = {
    short: { en: 'Quick and light', he: 'קליל וקצר' },
    medium: { en: 'Balanced night', he: 'ערב מאוזן' },
    long: { en: 'Make a night of it', he: 'לעשות מזה ערב' },
  }

  return labels[pace]?.[lang] || labels.medium[lang]
}

export default function ResultsPage({
  lang,
  font,
  plan,
  backupLocations = [],
  answers,
  saved,
  reminderSet,
  onBrowseAll,
  onToggleBackupOptions,
  onOpenBackupLocation,
  onOpenPlanMaps,
  onSavePlan,
  onSharePlan,
  onSetReminder,
  onRetakeQuiz,
  onBuildYourOwnPlan,
}) {
  const [showBackups, setShowBackups] = useState(false)
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'
  const text = getLocalizedPlanText(plan, lang)
  const identity = buildPlanIdentity(answers)
  const fitSummary = getPlanFitSummary(plan, answers, lang)
  const paceLabel = getPaceLabel(plan, answers, lang)
  const firstStopMaps = useMemo(() => getMapsUrl(plan.stops?.[0]?.maps_query), [plan])
  const isShortPlan = (answers.length || plan.length_tags?.[0]) === 'short'
  const primaryStops = isShortPlan ? plan.stops.slice(0, 2) : plan.stops
  const optionalStops = isShortPlan ? plan.stops.slice(2) : []

  const handleShare = async () => {
    const message = isHe
      ? `הנה התוכנית שלנו: ${text.title}\n${text.startTime}\n${text.shareSummary}\nhamakom.app`
      : `Here is our plan: ${text.title}\n${text.startTime}\n${text.shareSummary}\nhamakom.app`

    try {
      if (navigator.share) {
        await navigator.share({ title: text.title, text: message })
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      }
      onSharePlan?.()
    } catch {
      // Ignore share cancellation.
    }
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font }}>
      <div
        style={{
          background: 'linear-gradient(180deg,#111827 0%,#131B17 100%)',
          borderBottom: '1px solid #2A2F3E',
          padding: '26px 24px 20px',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 8 }}>
            {isHe ? 'הבחירה החזקה שלך' : 'Your strongest pick'}
          </div>
          <h1 style={{ fontSize: 30, lineHeight: 1.08, margin: '0 0 8px' }}>{text.title}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Pill>{identity[lang]}</Pill>
            <Pill>{text.startTime}</Pill>
            <Pill>{text.duration}</Pill>
          </div>
          <p style={{ margin: '0 0 10px', color: '#B8A990', fontSize: 15, lineHeight: 1.55 }}>{text.narrative}</p>
          <div style={{ fontSize: 14, color: '#D8CCB3', lineHeight: 1.55 }}>
            {isHe
              ? 'זה המהלך הנכון למצב שבחרתם. לא עוד רשימה, אלא תוכנית שאפשר פשוט לצאת אליה.'
              : 'This is the right move for the context you picked. Not another list, just a plan you can actually commit to.'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 20px 40px' }}>
        <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 20, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>
            {isHe ? 'למה זה מתאים' : 'Why this fits'}
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.6, color: '#E8DCC8' }}>{fitSummary}</div>
        </section>

        <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 20, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            <FactCard label={isHe ? 'תקציב' : 'Budget'} value={text.budget} />
            <FactCard label={isHe ? 'קצב' : 'Pace'} value={paceLabel} />
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>
            {isHe ? 'איך הערב נבנה' : 'How the night unfolds'}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {primaryStops.map((stop, index) => (
              <StopCard key={`${plan.id}-${index}`} stop={stop} index={index} lang={lang} />
            ))}
          </div>

          {optionalStops.length ? (
            <div style={{ marginTop: 12, background: '#10151F', border: '1px dashed #374151', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>
                {isHe ? 'אם הערב זורם' : 'If the night is flowing'}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {optionalStops.map((stop, index) => (
                  <CompactStopCard key={`${plan.id}-optional-${index}`} stop={stop} lang={lang} />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 20, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>
            {isHe ? 'תתחייבו למהלך' : 'Commit to the plan'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <button onClick={onSavePlan} style={saved ? activeActionButtonStyle : actionButtonStyle}>
              {saved ? (isHe ? '✓ נשמר' : '✓ Saved') : isHe ? 'שמור תוכנית' : 'Save Plan'}
            </button>
            <button onClick={handleShare} style={actionButtonStyle}>
              {isHe ? 'שתף תוכנית' : 'Share Plan'}
            </button>
            {firstStopMaps ? (
              <a href={firstStopMaps} target="_blank" rel="noopener noreferrer" onClick={() => onOpenPlanMaps?.()} style={actionLinkStyle}>
                {isHe ? 'פתח במפות' : 'Open in Maps'}
              </a>
            ) : (
              <div style={{ ...actionButtonStyle, opacity: 0.45 }}>{isHe ? 'אין מפה זמינה' : 'Maps unavailable'}</div>
            )}
            <button onClick={onSetReminder} style={reminderSet ? activeActionButtonStyle : actionButtonStyle}>
              {reminderSet ? (isHe ? '✓ תזכורת נשמרה' : '✓ Reminder Set') : isHe ? 'קבע תזכורת' : 'Set Reminder'}
            </button>
          </div>
        </section>

        <section style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <button
            onClick={() =>
              setShowBackups((current) => {
                const next = !current
                if (next) onToggleBackupOptions?.()
                return next
              })
            }
            style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 0, width: '100%', textAlign: isHe ? 'right' : 'left' }}
          >
            {showBackups
              ? isHe
                ? 'סגור חלופות'
                : 'Hide backup options'
              : isHe
                ? 'רוצים וייב אחר? ראו עוד 3 חלופות'
                : 'Want a different vibe? See 3 more options'}
          </button>

          {showBackups ? (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {backupLocations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => onOpenBackupLocation(location)}
                  style={{
                    background: '#161B27',
                    border: '1px solid #2A2F3E',
                    borderRadius: 14,
                    padding: '14px 16px',
                    textAlign: isHe ? 'right' : 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: '#E8DCC8',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{isHe ? location.name_he || location.name : location.name}</div>
                  <div style={{ fontSize: 12, color: '#C9A84C', marginBottom: 6 }}>{isHe ? location.city_he || location.city : location.city}</div>
                  <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5 }}>{isHe ? location.description_he || location.description : location.description}</div>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={onRetakeQuiz} style={ghostButtonStyle}>
            {isHe ? 'ענו שוב על השאלות הקצרות' : 'Retake the quick questions'}
          </button>

          <button onClick={onBrowseAll} style={ghostButtonStyle}>
            {isHe ? 'עדיין לא בטוחים? דפדפו בחלופות' : 'Still unsure? Browse alternatives'}
          </button>

          <button onClick={onBuildYourOwnPlan} style={lowEmphasisButtonStyle}>
            {isHe ? 'רוצים שליטה מלאה? בנו בעצמכם' : 'Need more control? Build your own'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Pill({ children }) {
  return <span style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 999, padding: '6px 11px', fontSize: 12, color: '#C9A84C' }}>{children}</span>
}

function FactCard({ label, value }) {
  return (
    <div style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: '#E8DCC8' }}>{value}</div>
    </div>
  )
}

function StopCard({ stop, index, lang }) {
  const isHe = lang === 'he'
  const title = isHe ? stop.name_he : stop.name_en
  const instruction = isHe ? stop.instruction_he : stop.instruction_en
  const orderTip = isHe ? stop.order_tip_he : stop.order_tip_en
  const mapsUrl = getMapsUrl(stop.maps_query)

  return (
    <div style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: '#C9A84C', color: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{index + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 5 }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: '#D0D5DD' }}>{instruction}</div>
          {orderTip ? <div style={{ fontSize: 12, lineHeight: 1.5, color: '#9CA3AF', marginTop: 8 }}>{orderTip}</div> : null}
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: '#C9A84C', textDecoration: 'none' }}>
              {isHe ? 'פתח במפות' : 'Open in Maps'}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CompactStopCard({ stop, lang }) {
  const isHe = lang === 'he'
  const title = isHe ? stop.name_he : stop.name_en
  const instruction = isHe ? stop.instruction_he : stop.instruction_en
  const mapsUrl = getMapsUrl(stop.maps_query)

  return (
    <div style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#9CA3AF' }}>{instruction}</div>
      {mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#C9A84C', textDecoration: 'none' }}>
          {isHe ? 'פתח במפות' : 'Open in Maps'}
        </a>
      ) : null}
    </div>
  )
}

const actionButtonStyle = {
  background: '#1F2937',
  color: '#E8DCC8',
  border: '1px solid #374151',
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
}

const activeActionButtonStyle = {
  ...actionButtonStyle,
  background: '#18261D',
  color: '#4ADE80',
  border: '1px solid #2E6E45',
}

const actionLinkStyle = {
  ...actionButtonStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
}

const ghostButtonStyle = {
  background: 'transparent',
  color: '#9CA3AF',
  border: '1px dashed #374151',
  borderRadius: 14,
  padding: '13px 16px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const lowEmphasisButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#6B7280',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  paddingTop: 6,
}

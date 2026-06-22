import { getMapsUrl } from '../lib/constants'

// Role → short, human label (kept in sync with ResultsPage).
const ROLE_LABELS = {
  anchor:     { en: 'The anchor',         he: 'עוגן הערב' },
  transition: { en: 'Change of pace',     he: 'שינוי קצב' },
  extension:  { en: 'Optional extension', he: 'תוספת אופציונלית' },
}

export default function PlanPreviewPage({ lang, font, plan, title, onBack, onPlanMyOwnDate }) {
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'
  const routeReason = isHe ? plan.route_reason_he : plan.route_reason_en

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F2E8', color: '#241E16', fontFamily: font }}>
      <div style={{ background: 'linear-gradient(165deg,#F7F2E8 0%,#F1EAD9 100%)', borderBottom: '1px solid #EBE2D0', padding: '26px 24px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#9A7A28', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0, marginBottom: 12 }}
          >
            {isHe ? '→ חזרה' : '← Back'}
          </button>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#9A7A28', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
          <h1 style={{ fontSize: 28, lineHeight: 1.1, margin: '0 0 8px' }}>{isHe ? plan.title_he : plan.title_en}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Pill>{plan.city}</Pill>
            <Pill>{isHe ? plan.start_time_text_he : plan.start_time_text_en}</Pill>
            <Pill>{isHe ? plan.duration_text_he : plan.duration_text_en}</Pill>
          </div>
          <p style={{ margin: 0, color: '#6E6450', fontSize: 15, lineHeight: 1.55 }}>{isHe ? plan.narrative_he : plan.narrative_en}</p>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 20px 40px' }}>
        <section style={{ background: '#FFFFFF', border: '1px solid #EBE2D0', borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            <FactCard label={isHe ? 'תקציב' : 'Budget'} value={isHe ? plan.budget_text_he : plan.budget_text_en} />
            <FactCard label={isHe ? 'אזור' : 'Area'} value={plan.region || plan.city} />
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#8A7F6C', textTransform: 'uppercase', marginBottom: 10 }}>
            {isHe ? 'איך הערב בנוי' : 'How This Plan Flows'}
          </div>

          {routeReason ? (
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: '#FBF4E1', border: '1px solid #EBDFC0', borderRadius: 12, padding: '11px 13px', marginBottom: 14 }}>
              <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.4 }}>✨</span>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: '#9A7A28', textTransform: 'uppercase', marginBottom: 3 }}>
                  {isHe ? 'למה המסלול הזה עובד' : 'Why this route works'}
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#6E6450' }}>{routeReason}</p>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 12 }}>
            {plan.stops.map((stop, index) => (
              <StopCard key={`${plan.id}-${index}`} stop={stop} index={index} lang={lang} />
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 10 }}>
          <button
            onClick={onPlanMyOwnDate}
            style={{
              background: '#241E16',
              color: '#F4ECD8',
              border: 'none',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {isHe ? 'תנו לי תוכנית אישית אחרת' : 'Get My Own Personalized Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Pill({ children }) {
  return (
    <span style={{ background: '#FFFFFF', border: '1px solid #EBE2D0', borderRadius: 999, padding: '6px 11px', fontSize: 12, color: '#9A7A28' }}>
      {children}
    </span>
  )
}

function FactCard({ label, value }) {
  return (
    <div style={{ background: '#FBF7EE', border: '1px solid #EBE2D0', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#8A7F6C', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: '#241E16' }}>{value}</div>
    </div>
  )
}

function StopCard({ stop, index, lang }) {
  const isHe = lang === 'he'
  const title = isHe ? stop.name_he : stop.name_en
  const instruction = isHe ? stop.instruction_he : stop.instruction_en
  const orderTip = isHe ? stop.order_tip_he : stop.order_tip_en
  const mapsUrl = getMapsUrl(stop.maps_query)
  const roleLabel = stop.role ? ROLE_LABELS[stop.role]?.[isHe ? 'he' : 'en'] : null
  const duration = isHe ? stop.duration_text_he : stop.duration_text_en
  const isExtension = stop.role === 'extension'

  return (
    <div style={{
      background: isExtension ? '#FCF8EF' : '#FBF7EE',
      border: isExtension ? '1px dashed #D9C796' : '1px solid #EBE2D0',
      borderRadius: 16, padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: isExtension ? 'transparent' : '#C9A84C',
          border: isExtension ? '1.5px dashed #C9A84C' : 'none',
          color: '#241E16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {(roleLabel || duration) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
              {roleLabel ? (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: isExtension ? '#8A7F6C' : '#9A7A28' }}>
                  {roleLabel}
                </span>
              ) : <span />}
              {duration ? (
                <span style={{ fontSize: 11, color: '#8A7F6C', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span aria-hidden style={{ opacity: 0.7 }}>◷</span>{duration}
                </span>
              ) : null}
            </div>
          ) : null}
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 5, color: '#241E16' }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: '#6E6450' }}>{instruction}</div>
          {orderTip ? <div style={{ fontSize: 12, lineHeight: 1.5, color: '#8A7F6C', marginTop: 8 }}>{orderTip}</div> : null}
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: '#9A7A28', textDecoration: 'none' }}>
              {isHe ? 'פתח במפות' : 'Open in Maps'}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { getMapsUrl } from '../lib/constants'

export default function PlanPreviewPage({ lang, font, plan, title, onBack, onPlanMyOwnDate }) {
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font }}>
      <div style={{ background: 'linear-gradient(180deg,#111827 0%,#131B17 100%)', borderBottom: '1px solid #2A2F3E', padding: '26px 24px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0, marginBottom: 12 }}
          >
            {isHe ? '→ חזרה' : '← Back'}
          </button>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
          <h1 style={{ fontSize: 28, lineHeight: 1.1, margin: '0 0 8px' }}>{isHe ? plan.title_he : plan.title_en}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Pill>{plan.city}</Pill>
            <Pill>{isHe ? plan.start_time_text_he : plan.start_time_text_en}</Pill>
            <Pill>{isHe ? plan.duration_text_he : plan.duration_text_en}</Pill>
          </div>
          <p style={{ margin: 0, color: '#B8A990', fontSize: 15, lineHeight: 1.55 }}>{isHe ? plan.narrative_he : plan.narrative_en}</p>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 20px 40px' }}>
        <section style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 20, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            <FactCard label={isHe ? 'תקציב' : 'Budget'} value={isHe ? plan.budget_text_he : plan.budget_text_en} />
            <FactCard label={isHe ? 'אזור' : 'Area'} value={plan.region || plan.city} />
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 10 }}>
            {isHe ? 'איך הערב בנוי' : 'How This Plan Flows'}
          </div>

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
              background: 'linear-gradient(135deg,#C9A84C 0%,#E8B84B 100%)',
              color: '#0D1117',
              border: 'none',
              borderRadius: 14,
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
    <span style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 999, padding: '6px 11px', fontSize: 12, color: '#C9A84C' }}>
      {children}
    </span>
  )
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
        <div style={{ width: 28, height: 28, borderRadius: 999, background: '#C9A84C', color: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          {index + 1}
        </div>
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

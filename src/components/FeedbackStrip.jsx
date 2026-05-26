import { useMemo } from 'react'

// 8 chips matching the spec. Compact, low-friction, no required interaction.
const CHIPS = [
  { key: 'good',            en: '👍 good rec',          he: '👍 המלצה טובה' },
  { key: 'bad',             en: '👎 bad rec',           he: '👎 לא התאים' },
  { key: 'perfect-vibe',    en: 'perfect vibe',         he: 'וייב מושלם' },
  { key: 'would-go-again',  en: 'would go again',       he: 'אחזור' },
  { key: 'too-loud',        en: 'too loud',             he: 'רועש מדי' },
  { key: 'too-expensive',   en: 'too expensive',        he: 'יקר מדי' },
  { key: 'too-crowded',     en: 'too crowded',          he: 'צפוף מדי' },
  { key: 'not-date-worthy', en: 'not date-worthy',      he: 'לא לדייט' },
]

// Per-user/location upsert into localStorage feedback map.
// Shape preserved with existing code: { ts, tags, vibe_tags?, rating?, went?, again? }
// Tags toggle; everything else is preserved.
export default function FeedbackStrip({ lang, loc, dateFeedback, setDateFeedback, font }) {
  const key = `place:${loc.id}`
  const current = dateFeedback?.[key] || {}
  const selected = useMemo(() => new Set(current.tags || []), [current.tags])

  const toggle = (chipKey) => {
    const next = new Set(selected)
    if (next.has(chipKey)) next.delete(chipKey)
    else next.add(chipKey)
    setDateFeedback({
      ...dateFeedback,
      [key]: {
        ...current,
        tags: [...next],
        vibe_tags: loc.vibe_tags || current.vibe_tags || [],
        ts: Date.now(),
      },
    })
  }

  return (
    <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #1F2937' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase' }}>
        {lang === 'he' ? 'איך היה?' : 'How was this?'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CHIPS.map((c) => {
          const active = selected.has(c.key)
          return (
            <button
              key={c.key}
              onClick={() => toggle(c.key)}
              style={{
                background: active ? '#C9A84C' : '#1F2937',
                color: active ? '#0D1117' : '#9CA3AF',
                border: `1px solid ${active ? '#C9A84C' : '#374151'}`,
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: font || 'inherit',
                fontWeight: active ? 700 : 400,
              }}
            >
              {lang === 'he' ? c.he : c.en}
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: '#4B5563', marginTop: 8 }}>
        {lang === 'he'
          ? 'נשמר באופן פרטי כדי לשפר את ההמלצות שלכם.'
          : 'Saved privately to improve your recommendations.'}
      </div>
    </div>
  )
}

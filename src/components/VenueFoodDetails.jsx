import { DIETARY_OPTIONS, dietaryEvidence, isFoodVenue, safeExternalUrl } from '../lib/venuePreferences.js'

export default function VenueFoodDetails({ loc, lang, compact = false }) {
  const he = lang === 'he'
  const menu = safeExternalUrl(loc.menu_url)
  const website = safeExternalUrl(loc.website)
  const source = safeExternalUrl(loc.dietary_source_url)
  const dietary = dietaryEvidence(loc)
  if (!isFoodVenue(loc) && !menu) return null
  const linkStyle = { color: '#295A42', fontWeight: 700, textUnderlineOffset: 3 }
  return <section aria-label={he ? 'תפריט וצרכים תזונתיים' : 'Menu and dietary details'} style={{ padding: compact ? '12px 0' : 16, background: compact ? 'transparent' : '#F2F5EF', borderRadius: 14, marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
    {menu ? <a href={menu} target="_blank" rel="noopener noreferrer" style={linkStyle}>{he ? 'פתיחת התפריט' : 'View menu'} ↗</a>
      : <span style={{ color: '#6E6450' }}>{he ? 'עדיין אין קישור לתפריט.' : 'Menu link not yet available.'}{website && <> <a href={website} target="_blank" rel="noopener noreferrer" style={linkStyle}>{he ? 'אתר המקום' : 'Venue website'} ↗</a></>}</span>}
    {menu && <div style={{ fontSize: 11, color: '#6E6450' }}>{loc.menu_scope === 'chain' ? (he ? 'תפריט רשת — ההיצע משתנה בין הסניפים' : 'Chain menu — availability varies by branch') : (he ? 'תפריט הסניף' : 'Branch menu')}{loc.menu_checked_at ? ` · ${loc.menu_checked_at.slice(0, 10)}` : ''}</div>}
    {dietary.length ? <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{dietary.map(v => <span key={v} style={{ background: '#E4EDD9', color: '#295A42', padding: '3px 8px', borderRadius: 999, fontSize: 11 }}>{DIETARY_OPTIONS.find(o => o.value === v)?.[lang] || v}</span>)}</div>
      <div style={{ fontSize: 11, color: '#6E6450', marginTop: 6 }}><a href={source} target="_blank" rel="noopener noreferrer" style={linkStyle}>{he ? 'מקור מידע תזונתי' : 'Dietary source'}</a> · {loc.dietary_checked_at?.slice(0, 10)}{loc.dietary_scope === 'chain' ? (he ? ' · מידע רשת' : ' · chain information') : ''}</div>
    </> : !compact && <div style={{ color: '#6E6450', marginTop: 8 }}>{he ? 'התאמה תזונתית עדיין לא אומתה.' : 'Dietary options have not been verified yet.'}</div>}
    {!compact && <p style={{ fontSize: 12, marginBottom: 0, color: '#6E6450' }}>{he ? 'לצליאק ואלרגיות, בדקו מרכיבים והכנה נפרדת עם הסניף. שילוב צרכים דורש בדיקה של אותה מנה.' : 'For coeliac disease or allergies, confirm ingredients and cross-contact with the branch. Combined needs must be checked on the same dish.'}</p>}
  </section>
}

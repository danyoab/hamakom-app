import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getRecommendedLocations, scoreCuratedFit, buildFeedbackProfile, scoreFeedbackInfluence } from '../lib/locationRecommendations'

function readLocalFeedback() {
  try { return JSON.parse(localStorage.getItem('hamakom-date-feedback') || '{}') } catch { return {} }
}

const CITIES = ['flexible', 'Jerusalem', 'Tel Aviv', "Modi'in", 'Beit Shemesh', 'Petach Tikva', 'Rishon LeZion', 'Caesarea', 'Haifa']
const FOCUS  = ['atmosphere', 'food-drink', 'activity', 'outdoors']
const STAGE  = ['just-met', 'getting-to-know', 'getting-serious']
const LENGTH = ['short', 'medium', 'long']
const WHEN   = ['tonight', 'thursday-night', 'planning-ahead']

const PRESETS = [
  { label: 'Quiet romantic',  answers: { city: 'Jerusalem', focus: 'atmosphere', seriousness: 'getting-serious', length: 'long',   when: 'thursday-night' } },
  { label: 'High-energy fun', answers: { city: 'Tel Aviv',  focus: 'activity',   seriousness: 'getting-to-know', length: 'medium', when: 'tonight' } },
  { label: 'Casual food',     answers: { city: 'flexible',  focus: 'food-drink', seriousness: 'just-met',        length: 'short',  when: 'tonight' } },
]

function Badge({ color, children }) {
  return (
    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${color}22`, color, border: `1px solid ${color}44`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </span>
  )
}

function classifyRow(loc) {
  const enriched = loc.google_place_id != null
  const curated  = (loc.vibe_tags?.length || 0) > 0
  const partial  = !curated && (loc.romantic_score != null || loc.energy_score != null || loc.indoor_outdoor != null)
  const lowConf  = (loc.confidence_score ?? 0) < 60
  return { enriched, curated, partial, lowConf }
}

// Quality verdict per recommendation. Communicates *why* a row ranks where
// it does so the curator can decide whether the rank is real signal or
// an artifact of missing data.
function qualityLabel(loc) {
  const matched = loc._reasoning?.matched?.length || 0
  const caveats = loc._reasoning?.caveats || []
  const curated = (loc.vibe_tags?.length || 0) > 0
  const conf    = loc.confidence_score ?? 0

  if (caveats.some(c => c.includes('not very dateable') || c.includes('snack-style'))) {
    return { tone: '#F87171', label: 'guardrail suppressed' }
  }
  if (curated && matched >= 3) return { tone: '#4ADE80', label: 'strong curated match' }
  if (curated && matched >= 1) return { tone: '#C9A84C', label: 'curated match' }
  if (conf < 60)               return { tone: '#F87171', label: 'low-confidence' }
  if (!curated && matched === 0) return { tone: '#9CA3AF', label: 'weak — uncurated, no vibe signal' }
  return { tone: '#9CA3AF', label: 'fallback — auto-enrichment only' }
}

export default function RecommendDebug({ inputStyle, btnStyle }) {
  const [answers, setAnswers] = useState({ city: 'Jerusalem', focus: 'atmosphere', seriousness: 'getting-serious', length: 'medium', when: 'tonight' })
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    supabase
      .from('locations')
      .select('id, name, name_he, city, category, price, image_url, occasion, date_stage, kashrus, featured, lat, lng, google_place_id, business_status, confidence_score, vibe_tags, indoor_outdoor, best_time, weather_fit, romantic_score, conversation_score, energy_score, quietness_score, activity_vs_food_score, group_vs_intimate_score, duration_min, duration_max, last_curated_at')
      .eq('status', 'approved')
      .then(({ data }) => { setLocations(data || []); setLoading(false) })
  }, [])

  // Read the live localStorage feedback so the debug panel reflects exactly
  // what the public app would use for ranking.
  const feedbackByItem = useMemo(() => readLocalFeedback(), [])
  const feedbackProfile = useMemo(() => buildFeedbackProfile({ feedbackByItem }), [feedbackByItem])

  const recommended = useMemo(() => {
    if (!locations.length) return []
    return getRecommendedLocations(locations, answers, { limit: 10, feedbackByItem })
  }, [locations, answers, feedbackByItem])

  const feedbackSummary = useMemo(() => {
    const total = Object.keys(feedbackByItem).filter(k => (feedbackByItem[k]?.tags || []).length > 0).length
    const topTags = Object.entries(feedbackProfile.tagCount).sort((a,b) => b[1]-a[1]).slice(0, 5)
    return { total, topTags }
  }, [feedbackByItem, feedbackProfile])

  // Cohort stats for the diagnostic banner
  const stats = useMemo(() => {
    const enriched = locations.filter(l => l.google_place_id).length
    const curated  = locations.filter(l => (l.vibe_tags?.length || 0) > 0).length
    return { total: locations.length, enriched, curated }
  }, [locations])

  const update = (k, v) => setAnswers(prev => ({ ...prev, [k]: v }))

  const dataHealthWarning = stats.curated < 30
    ? `⚠ Only ${stats.curated} of ${stats.total} rows are curated. Recommendations are running on auto-enrichment + price/category signals — curated channel contributes ~0. Reasoning will be sparse until ~30 curated rows exist.`
    : null

  return (
    <div>
      {/* Stats banner */}
      <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', gap: 16, fontSize: 12 }}>
        <div><span style={{ color: '#6B7280' }}>Total:</span> <span style={{ color: '#E8DCC8', fontWeight: 700 }}>{stats.total}</span></div>
        <div><span style={{ color: '#6B7280' }}>Enriched:</span> <span style={{ color: '#4ADE80', fontWeight: 700 }}>{stats.enriched}</span></div>
        <div><span style={{ color: '#6B7280' }}>Curated:</span> <span style={{ color: stats.curated >= 30 ? '#4ADE80' : '#C9A84C', fontWeight: 700 }}>{stats.curated}</span></div>
        {dataHealthWarning && <div style={{ color: '#F87171', marginLeft: 'auto', maxWidth: 600 }}>{dataHealthWarning}</div>}
      </div>

      {/* Feedback summary banner */}
      <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div><span style={{ color: '#6B7280' }}>Your feedback rows:</span> <span style={{ color: '#E8DCC8', fontWeight: 700 }}>{feedbackSummary.total}</span></div>
        {feedbackSummary.total < 3 && (
          <div style={{ color: '#F59E0B' }}>⚠ feedback sparse — ranking is not yet adapting to your taste (need ≥ 2 same-tag events to influence)</div>
        )}
        {feedbackSummary.topTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#6B7280' }}>top tags:</span>
            {feedbackSummary.topTags.map(([tag, n]) => (
              <span key={tag} style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#9CA3AF' }}>{tag} ×{n}</span>
            ))}
          </div>
        )}
      </div>

      {/* Preset chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#6B7280', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Presets:</span>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => setAnswers(p.answers)} style={{ background: '#1F2937', color: '#9CA3AF', border: '1px solid #374151', borderRadius: 999, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Quiz dropdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[['city', CITIES], ['focus', FOCUS], ['seriousness', STAGE], ['length', LENGTH], ['when', WHEN]].map(([key, options]) => (
          <label key={key} style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{key}</span>
            <select value={answers[key]} onChange={(e) => update(key, e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }}>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Loading locations…</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {recommended.map((loc, i) => {
            const cls = classifyRow(loc)
            const curatedScore = scoreCuratedFit(loc, answers).score
            const quality = qualityLabel(loc)
            return (
              <div key={loc.id} style={{ background: '#161B27', border: `1px solid ${i === 0 ? '#C9A84C' : '#2A2F3E'}`, borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '32px 56px 1fr 200px', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: i === 0 ? '#C9A84C' : '#6B7280', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
                <div style={{ width: 56, height: 42, borderRadius: 4, overflow: 'hidden', background: '#0D1117', border: '1px solid #2A2F3E' }}>
                  {loc.image_url
                    ? <img src={loc.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} />
                    : null}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E8DCC8' }}>{loc.name}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{loc.city} · {loc.category}{loc.price ? ` · ${'$'.repeat(loc.price)}` : ''}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Badge color={quality.tone}>{quality.label}</Badge>
                    <Badge color={cls.enriched ? '#4ADE80' : '#6B7280'}>{cls.enriched ? 'enriched' : 'unenriched'}</Badge>
                    <Badge color={cls.curated ? '#C9A84C' : cls.partial ? '#F59E0B' : '#6B7280'}>{cls.curated ? 'curated' : cls.partial ? 'partial' : 'uncurated'}</Badge>
                    {cls.lowConf && <Badge color="#F87171">low-conf</Badge>}
                    {loc.business_status === 'CLOSED_PERMANENTLY' && <Badge color="#F87171">closed</Badge>}
                  </div>
                  {loc._reasoning?.matched?.length > 0 && (
                    <div style={{ fontSize: 10, color: '#4ADE80', lineHeight: 1.4 }}>+ {loc._reasoning.matched.join(', ')}</div>
                  )}
                  {loc._reasoning?.caveats?.length > 0 && (
                    <div style={{ fontSize: 10, color: '#F87171', lineHeight: 1.4 }}>⚠ {loc._reasoning.caveats.join(', ')}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontSize: 11 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#E8DCC8', fontVariantNumeric: 'tabular-nums' }}>{loc._score.toFixed(1)}</div>
                  <div style={{ color: '#6B7280', fontSize: 10 }}>total</div>
                  <div style={{ color: curatedScore > 0 ? '#C9A84C' : '#6B7280', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    curated: {curatedScore.toFixed(1)}
                  </div>
                  {(() => {
                    const adj = scoreFeedbackInfluence(loc, feedbackProfile).score
                    if (adj === 0) return null
                    return (
                      <div style={{ color: adj > 0 ? '#4ADE80' : '#F87171', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
                        feedback: {adj > 0 ? '+' : ''}{adj.toFixed(1)}
                      </div>
                    )
                  })()}
                  <div style={{ color: '#6B7280', fontSize: 10 }}>
                    conf: {loc.confidence_score ?? '—'}
                  </div>
                </div>
              </div>
            )
          })}
          {!recommended.length && <div style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>No results for this query.</div>}
        </div>
      )}
    </div>
  )
}

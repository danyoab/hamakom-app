import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Priority order: cities the engine treats as primary (most rows + most
// quiz traffic), then secondary cities. Bumps anything in these cities
// up the queue.
const CITY_PRIORITY = {
  'Jerusalem': 100,
  'Tel Aviv':  90,
  "Modi'in":   60,
  'Beit Shemesh': 55,
  'Petach Tikva': 50,
  'Tzur Hadassah': 45,
}

// Which categories the sequence templates lean on most. Lounges are scarce
// almost everywhere — curating them is the single highest-leverage action
// for atmosphere-focus plans.
const CATEGORY_PRIORITY = {
  'Hotels & Lounges':         100,
  'Cafes & Restaurants':       80,
  'Cafés & Restaurants':       80,
  'Parks & Outdoors':          70,
  'Activities & Experiences':  60,
  'Wineries':                  55,
  'Museums & Culture':         40,
}

// Field weights — ordered by impact on plan composition. energy_score and
// quietness_score drive flowCompatibility between stops; best_time gates
// time-of-day fit; romantic/intimacy drive intimacy-jump warnings;
// duration governs plan-too-long. Everything else is nice-to-have.
const FIELD_WEIGHTS = [
  { key: 'energy_score',            weight: 30, label: 'energy' },
  { key: 'quietness_score',         weight: 25, label: 'quiet' },
  { key: 'best_time',               weight: 20, label: 'best_time' },
  { key: 'romantic_score',          weight: 15, label: 'romantic' },
  { key: 'group_vs_intimate_score', weight: 12, label: 'intimacy' },
  { key: 'duration_min',            weight: 10, label: 'duration' },
  { key: 'vibe_tags',               weight:  8, label: 'vibe_tags' },
]

const MAX_FIELD_SCORE = FIELD_WEIGHTS.reduce((s, f) => s + f.weight, 0)

function fieldsMissing(loc) {
  return FIELD_WEIGHTS.filter(f => {
    const v = loc[f.key]
    if (Array.isArray(v)) return v.length === 0
    return v == null
  })
}

function priorityScore(loc) {
  const cityP = CITY_PRIORITY[loc.city] || 10
  const catP = CATEGORY_PRIORITY[loc.category] || 20
  // Missing-field score: more missing = bigger lift available
  const missing = fieldsMissing(loc).reduce((s, f) => s + f.weight, 0)
  const featuredBoost = loc.featured ? 25 : 0
  return cityP + catP + missing + featuredBoost
}

function Pill({ tone = '#9CA3AF', children }) {
  return (
    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${tone}22`, color: tone, border: `1px solid ${tone}44`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </span>
  )
}

export default function CuratorQueue() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [cityFilter, setCityFilter] = useState('all')

  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    supabase
      .from('locations')
      .select('id, name, city, category, featured, price, vibe_tags, energy_score, quietness_score, romantic_score, group_vs_intimate_score, best_time, duration_min, duration_max')
      .eq('status', 'approved')
      .then(({ data }) => { setLocations(data || []); setLoading(false) })
  }, [])

  const cities = useMemo(() => {
    const set = new Set(locations.map(l => l.city).filter(Boolean))
    return ['all', ...[...set].sort()]
  }, [locations])

  const queue = useMemo(() => {
    return locations
      .filter(l => cityFilter === 'all' || l.city === cityFilter)
      .map(l => ({ ...l, _priority: priorityScore(l), _missing: fieldsMissing(l) }))
      .sort((a, b) => b._priority - a._priority)
      .slice(0, 50)
  }, [locations, cityFilter])

  const fullyCurated = locations.filter(l => fieldsMissing(l).length === 0).length

  return (
    <div>
      <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', gap: 16, fontSize: 12, alignItems: 'center' }}>
        <div><span style={{ color: '#6B7280' }}>Locations:</span> <span style={{ color: '#E8DCC8', fontWeight: 700 }}>{locations.length}</span></div>
        <div><span style={{ color: '#6B7280' }}>Fully curated:</span> <span style={{ color: fullyCurated >= 30 ? '#4ADE80' : '#C9A84C', fontWeight: 700 }}>{fullyCurated}</span></div>
        <div style={{ color: '#9CA3AF', flex: 1 }}>
          Top 50 ranked by city priority × category priority × missing-field weight × featured. Curating the top of this list maximizes plan-quality lift per row.
        </div>
        <select
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          style={{ background: '#0D1117', color: '#E8DCC8', border: '1px solid #2A2F3E', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit' }}
        >
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Loading locations…</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {queue.map((loc, i) => {
            const cityP = CITY_PRIORITY[loc.city] || 10
            const catP = CATEGORY_PRIORITY[loc.category] || 20
            const missingScore = loc._missing.reduce((s, f) => s + f.weight, 0)
            const completeness = Math.round(100 * (1 - missingScore / MAX_FIELD_SCORE))
            return (
              <div key={loc.id} style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '32px 1fr 280px 80px', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', textAlign: 'center' }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E8DCC8' }}>{loc.name}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                    {loc.city} · {loc.category}{loc.price ? ` · ${'$'.repeat(loc.price)}` : ''}
                    {loc.featured ? ' · ⭐ featured' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {loc._missing.length === 0 ? (
                    <Pill tone="#4ADE80">fully curated</Pill>
                  ) : (
                    loc._missing.map(f => <Pill key={f.key} tone="#F59E0B">{f.label}</Pill>)
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#E8DCC8', fontVariantNumeric: 'tabular-nums' }}>
                    {loc._priority}
                  </div>
                  <div style={{ fontSize: 9, color: '#6B7280' }}>
                    city {cityP} · cat {catP}
                  </div>
                  <div style={{ fontSize: 9, color: completeness >= 70 ? '#4ADE80' : '#9CA3AF' }}>
                    {completeness}% curated
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getSmartMatchedPlans } from '../lib/planRecommendations'
import { assembleDynamicPlan } from '../lib/planBuilder'
import { formatWalkTime } from '../lib/distance'

const CITIES = ['flexible', 'Jerusalem', 'Tel Aviv', "Modi'in", 'Beit Shemesh', 'Tzur Hadassah', 'Givat Shmuel']
const FOCUS  = ['atmosphere', 'food-drink', 'activity', 'outdoors']
const STAGE  = ['just-met', 'getting-to-know', 'getting-serious']
const LENGTH = ['short', 'medium', 'long']
const WHEN   = ['tonight', 'thursday-night', 'planning-ahead']

const PRESETS = [
  { label: 'Quiet romantic',    answers: { city: 'Jerusalem', focus: 'atmosphere', seriousness: 'getting-serious', length: 'long',   when: 'thursday-night' } },
  { label: 'High-energy fun',   answers: { city: 'Tel Aviv',  focus: 'activity',   seriousness: 'getting-to-know', length: 'medium', when: 'tonight' } },
  { label: 'Casual first date', answers: { city: 'flexible',  focus: 'food-drink', seriousness: 'just-met',        length: 'short',  when: 'tonight' } },
  { label: 'Activity-focused',  answers: { city: "Modi'in",   focus: 'activity',   seriousness: 'getting-to-know', length: 'medium', when: 'planning-ahead' } },
  { label: 'Quick dessert stop',answers: { city: 'Jerusalem', focus: 'food-drink', seriousness: 'just-met',        length: 'short',  when: 'tonight' } },
]

function Pill({ tone = '#9CA3AF', children }) {
  return (
    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${tone}22`, color: tone, border: `1px solid ${tone}44`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </span>
  )
}

function VibeBar({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#9CA3AF' }}>
      <span style={{ width: 56, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#0D1117', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: tone }} />
      </div>
      <span style={{ width: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#E8DCC8' }}>{value}</span>
    </div>
  )
}

function legTone(km) {
  if (km == null) return '#6B7280'
  if (km <= 1.5) return '#4ADE80'
  if (km <= 3)   return '#C9A84C'
  if (km <= 6)   return '#F59E0B'
  return '#F87171'
}

function PlanCard({ plan }) {
  const compose = plan._compose || {}
  const warnings = plan._flowWarnings || []
  const stops = plan.stops || []
  const legs = compose.legs || []
  const vibes = compose.derivedVibes || []
  const flowDeltas = compose.flowDeltas || []

  return (
    <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 14, marginBottom: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#E8DCC8' }}>{plan.title_en || plan.id}</div>
        <Pill tone="#C9A84C">{compose.engine || plan.source_type || 'unknown'}</Pill>
        <Pill tone="#9CA3AF">📍 {plan.city}</Pill>
        <Pill tone="#9CA3AF">score {(plan._score || 0).toFixed(1)}</Pill>
        {plan._cityMismatch && <Pill tone="#F87171">city mismatch</Pill>}
        {compose.templateUsed && <Pill tone="#6B7280">{compose.templateUsed}</Pill>}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {warnings.map(w => <Pill key={w} tone="#F87171">{w}</Pill>)}
        </div>
      )}

      {/* Stops grid */}
      <div style={{ display: 'grid', gap: 8 }}>
        {stops.map((stop, i) => {
          const vibe = vibes[i]?.vibe || {}
          const fromCurator = vibes[i]?.fromCurator
          const leg = i > 0 ? legs[i - 1] : null
          const delta = i > 0 ? flowDeltas[i - 1] : null
          return (
            <div key={i}>
              {leg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 10 }}>
                  <span style={{ color: legTone(leg.kmFromPrev) }}>
                    {leg.kmFromPrev == null ? '? km' : `${leg.kmFromPrev.toFixed(1)} km · ${formatWalkTime(leg.kmFromPrev)}`}
                  </span>
                  {delta && (
                    <span style={{ color: delta.delta >= 0 ? '#4ADE80' : '#F87171' }}>
                      flow {delta.delta >= 0 ? '+' : ''}{delta.delta}
                      {delta.reasons?.length ? ` (${delta.reasons.join(', ')})` : ''}
                    </span>
                  )}
                </div>
              )}
              <div style={{ background: '#0D1117', border: '1px solid #2A2F3E', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '32px 1fr 200px', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#C9A84C', textAlign: 'center' }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#E8DCC8' }}>{stop.name_en}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{stop._city || ''}</div>
                  <div style={{ marginTop: 4 }}>
                    {!fromCurator && <Pill tone="#F59E0B">derived vibe</Pill>}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 3 }}>
                  <VibeBar label="energy"   value={vibe.energy   ?? 0} tone="#F59E0B" />
                  <VibeBar label="quiet"    value={vibe.quiet    ?? 0} tone="#60A5FA" />
                  <VibeBar label="romantic" value={vibe.romantic ?? 0} tone="#F472B6" />
                  <VibeBar label="intimate" value={vibe.intimate ?? 0} tone="#C9A84C" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PlanComposeDebug({ inputStyle, datePlans = [] }) {
  const [answers, setAnswers] = useState(PRESETS[0].answers)
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    supabase
      .from('locations')
      .select('id, name, name_he, slug, city, city_he, category, price, occasion, date_stage, featured, status, lat, lng, maps_query, vibe_tags, energy_score, quietness_score, romantic_score, group_vs_intimate_score, best_time, duration_min, duration_max, business_status')
      .eq('status', 'approved')
      .then(({ data }) => { setLocations(data || []); setLoading(false) })
  }, [])

  const update = (k, v) => setAnswers(prev => ({ ...prev, [k]: v }))

  const smartPlans = useMemo(() => {
    if (!locations.length && !datePlans.length) return []
    return getSmartMatchedPlans(datePlans, locations, answers, 4)
  }, [locations, datePlans, answers])

  const dynamicPlan = useMemo(() => {
    if (!locations.length) return null
    return assembleDynamicPlan(locations, { ...answers, _seed: 1 })
  }, [locations, answers])

  return (
    <div>
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

      {loading ? (
        <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Loading locations…</div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            getSmartMatchedPlans — top {smartPlans.length}
          </div>
          {smartPlans.length === 0 && <div style={{ color: '#9CA3AF', padding: 14, background: '#161B27', borderRadius: 8 }}>No plans returned.</div>}
          {smartPlans.map(plan => <PlanCard key={plan.id} plan={plan} />)}

          <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '20px 0 8px' }}>
            assembleDynamicPlan — single fresh assembly (seed=1)
          </div>
          {dynamicPlan ? <PlanCard plan={dynamicPlan} /> : (
            <div style={{ color: '#9CA3AF', padding: 14, background: '#161B27', borderRadius: 8, fontSize: 12 }}>
              No dynamic plan could be assembled for this city/focus — engine returned null (graceful degrade, no cross-city fallback).
            </div>
          )}
        </div>
      )}
    </div>
  )
}


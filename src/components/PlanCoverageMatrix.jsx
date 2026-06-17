import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getSmartMatchedPlans } from '../lib/planRecommendations'

// Same axes as the audit script, kept narrow for in-browser speed.
const CITIES = [
  'Jerusalem', 'Tel Aviv', 'Beit Shemesh', "Modi'in", 'Tzur Hadassah',
  'Haifa', 'Herzliya', "Ra'anana", 'Netanya', 'Petach Tikva', 'Givat Shmuel',
  'Zichron Yaakov', 'Caesarea', 'flexible',
]
const FOCUS = ['atmosphere', 'food-drink', 'activity', 'outdoors']
const SERIOUSNESS = ['just-met', 'getting-to-know', 'getting-serious']
const LENGTHS = ['short', 'medium', 'long', undefined]

function categoryHits(loc, focus) {
  const c = (loc.category || '').toLowerCase()
  if (focus === 'food-drink')  return c.includes('caf') || c.includes('restaurant') || c.includes('winer') || c.includes('lounge') || c.includes('hotel')
  if (focus === 'activity')    return c.includes('activ') || c.includes('experience') || c.includes('museum') || c.includes('culture')
  if (focus === 'outdoors')    return c.includes('park')
  if (focus === 'atmosphere')  return c.includes('lounge') || c.includes('hotel') || c.includes('winer')
  return false
}

function cellTone(passRate, hasInventory) {
  if (!hasInventory) return '#374151' // gray: inventory gap
  if (passRate >= 0.85) return '#16653480'
  if (passRate >= 0.6)  return '#854D0E80'
  return '#7F1D1D80'
}

export default function PlanCoverageMatrix({ datePlans = [] }) {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    supabase
      .from('locations')
      .select('id, name, city, category, price, occasion, date_stage, featured, status, lat, lng, vibe_tags, energy_score, quietness_score, romantic_score, group_vs_intimate_score, best_time, duration_min, duration_max, business_status')
      .eq('status', 'approved')
      .then(({ data }) => { setLocations(data || []); setLoading(false) })
  }, [])

  const inventory = useMemo(() => {
    const inv = {}
    for (const city of CITIES) {
      if (city === 'flexible') continue
      const pool = locations.filter(l => l.city === city)
      const counts = {}
      for (const f of FOCUS) counts[f] = pool.filter(l => categoryHits(l, f)).length
      inv[city] = { total: pool.length, ...counts }
    }
    return inv
  }, [locations])

  const run = () => {
    setRunning(true)
    // Defer to next frame so the spinner can paint before the heavy loop.
    setTimeout(() => {
      const out = {}
      for (const city of CITIES) {
        out[city] = {}
        for (const focus of FOCUS) {
          let pass = 0, total = 0, codeBugs = 0, emptyResult = 0
          const inFocus = city !== 'flexible' && (inventory[city]?.[focus] || 0) === 0
          for (const seriousness of SERIOUSNESS) {
            for (const length of LENGTHS) {
              total++
              const answers = { city, seriousness, focus }
              if (length) answers.length = length
              const plans = getSmartMatchedPlans(datePlans, locations, answers, 2)
              if (plans.length === 0) {
                emptyResult++
                continue
              }
              const top = plans[0]
              const sameCity = !top._cityMismatch
              const noSevere = (top._flowWarnings || []).filter(w => /energy_swing|cross_city|night_only|too_long|zigzag|intimacy/.test(w)).length < 2
              if (sameCity && noSevere) pass++
              else if (!sameCity || !noSevere) codeBugs++
            }
          }
          out[city][focus] = { pass, total, codeBugs, emptyResult, inFocusGap: inFocus }
        }
      }
      setResults(out)
      setRunning(false)
    }, 50)
  }

  const totalCells = CITIES.length * FOCUS.length
  const summary = useMemo(() => {
    if (!results) return null
    let cells = 0, healthy = 0, weak = 0, gaps = 0
    for (const c of CITIES) for (const f of FOCUS) {
      const r = results[c]?.[f]
      if (!r) continue
      cells++
      const pr = r.pass / Math.max(r.total, 1)
      if (r.inFocusGap || r.emptyResult === r.total) gaps++
      else if (pr >= 0.85) healthy++
      else weak++
    }
    return { cells, healthy, weak, gaps }
  }, [results])

  return (
    <div>
      <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
        <div style={{ color: '#9CA3AF', flex: 1, minWidth: 280 }}>
          Live coverage matrix across {CITIES.length} cities × {FOCUS.length} focuses × {SERIOUSNESS.length * LENGTHS.length} sub-paths = {totalCells * SERIOUSNESS.length * LENGTHS.length} combinations.
          Green = ≥85% pass · Amber = 60-85% · Red = &lt;60% · Gray = inventory gap.
        </div>
        <button
          onClick={run}
          disabled={loading || running || !locations.length}
          style={{ background: '#C9A84C', color: '#0D1117', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: running ? 'wait' : 'pointer', fontFamily: 'inherit' }}
        >
          {running ? 'Running…' : loading ? 'Loading…' : results ? 'Re-run' : 'Run coverage'}
        </button>
      </div>

      {summary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
          <span><span style={{ color: '#6B7280' }}>Cells:</span> <b style={{ color: '#E8DCC8' }}>{summary.cells}</b></span>
          <span><span style={{ color: '#6B7280' }}>Healthy:</span> <b style={{ color: '#4ADE80' }}>{summary.healthy}</b></span>
          <span><span style={{ color: '#6B7280' }}>Weak:</span> <b style={{ color: '#F59E0B' }}>{summary.weak}</b></span>
          <span><span style={{ color: '#6B7280' }}>Inventory gaps:</span> <b style={{ color: '#9CA3AF' }}>{summary.gaps}</b></span>
        </div>
      )}

      {results && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, color: '#E8DCC8' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>City</th>
                {FOCUS.map(f => (
                  <th key={f} style={{ padding: '6px 8px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, minWidth: 120 }}>{f}</th>
                ))}
                <th style={{ padding: '6px 8px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>Inventory</th>
              </tr>
            </thead>
            <tbody>
              {CITIES.map(city => (
                <tr key={city}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, borderBottom: '1px solid #2A2F3E' }}>{city}</td>
                  {FOCUS.map(focus => {
                    const r = results[city][focus]
                    const pr = r.pass / Math.max(r.total, 1)
                    const hasInv = !r.inFocusGap
                    return (
                      <td key={focus} style={{ padding: '6px 8px', background: cellTone(pr, hasInv), borderBottom: '1px solid #2A2F3E', textAlign: 'center' }}>
                        {r.inFocusGap ? (
                          <div>
                            <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>no anchors</div>
                            <div style={{ fontSize: 10, color: '#9CA3AF' }}>add inventory</div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700 }}>{r.pass}/{r.total}</div>
                            {r.codeBugs > 0 && <div style={{ fontSize: 9, color: '#F87171' }}>{r.codeBugs} code-bug</div>}
                            {r.emptyResult > 0 && <div style={{ fontSize: 9, color: '#9CA3AF' }}>{r.emptyResult} fallback</div>}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #2A2F3E', fontSize: 10, color: '#9CA3AF' }}>
                    {city === 'flexible' ? '—' : (
                      <>total {inventory[city]?.total ?? 0} · lounges {inventory[city]?.atmosphere ?? 0} · activities {inventory[city]?.activity ?? 0} · parks {inventory[city]?.outdoors ?? 0}</>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!results && !running && (
        <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 30, fontSize: 13 }}>
          Click "Run coverage" to score every quiz path against the live engine. Takes a couple of seconds.
        </div>
      )}
    </div>
  )
}

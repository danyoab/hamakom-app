// Plan coherence — shared heuristics used by both composition engines
// (planRecommendations.js buildSupportStops + planBuilder.js assembleDynamicPlan).
//
// Everything here is pure, deterministic, and inspectable. Curator fields
// (vibe_tags, energy_score, etc.) are used when present; sensible defaults
// are derived from category + occasion + price when they aren't. This is
// deliberate because curator coverage is <30 of total rows today.

import { CITY_COORDS } from './constants.js'

// ─── Geographic helpers ────────────────────────────────────────────────────

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function coordsOf(loc) {
  if (!loc) return null
  if (loc.lat && loc.lng) return [loc.lat, loc.lng]
  const c = CITY_COORDS[loc.city]
  return c || null
}

export function distanceKm(a, b) {
  const pa = coordsOf(a)
  const pb = coordsOf(b)
  if (!pa || !pb) return null
  return haversineKm(pa[0], pa[1], pb[0], pb[1])
}

export function isVariousChain(loc) {
  return loc?.city === 'Various' || !loc?.city
}

// Same locale = same real city AND (if coords present) within 6km.
// Used as a hard gate when relaxing other constraints — we'd rather return
// a shorter plan than mix cities.
export function sameLocale(a, b) {
  if (!a || !b) return false
  if (isVariousChain(a) || isVariousChain(b)) return true // chain rows can travel
  if (a.city !== b.city) return false
  const km = distanceKm(a, b)
  if (km === null) return true
  return km <= 6
}

// Proximity score on the same scale as the original planBuilder bonus.
// Returns 0 if either coord is missing (no signal, no penalty).
export function proximityScore(prev, next) {
  if (!prev || !next) return 0
  const km = distanceKm(prev, next)
  if (km === null) return 0
  if (km <= 0.5) return 6
  if (km <= 1.5) return 4
  if (km <= 3) return 2
  if (km <= 6) return 0
  return -2
}

// ─── Vibe derivation ───────────────────────────────────────────────────────
// Each location has a derived vibe vector with four 0-100 dimensions.
// Curator-provided scores win when present; otherwise we look up the
// (category, occasion) heuristic. We always return a vector — never null —
// so consumers don't need null-checks downstream.

// DB rows historically use "Cafes & Restaurants" (no accent) while the
// codebase constants use "Cafés". Normalize so both resolve.
function canonicalCategory(cat = '') {
  const c = cat.replace(/é/g, 'e').toLowerCase()
  if (c.includes('park'))     return 'Parks & Outdoors'
  if (c.includes('hotel') || c.includes('lounge'))  return 'Hotels & Lounges'
  if (c.includes('museum') || c.includes('culture')) return 'Museums & Culture'
  if (c.includes('activ') || c.includes('experience')) return 'Activities & Experiences'
  if (c.includes('caf') || c.includes('restaurant')) return 'Cafés & Restaurants'
  if (c.includes('winer')) return 'Wineries'
  return cat
}

const CATEGORY_VIBE_DEFAULTS = {
  'Parks & Outdoors':         { energy: 50, quiet: 70, romantic: 55, intimate: 55 },
  'Hotels & Lounges':         { energy: 45, quiet: 60, romantic: 75, intimate: 70 },
  'Museums & Culture':        { energy: 35, quiet: 80, romantic: 50, intimate: 55 },
  'Activities & Experiences': { energy: 75, quiet: 30, romantic: 40, intimate: 50 },
  'Cafés & Restaurants':      { energy: 50, quiet: 55, romantic: 55, intimate: 60 },
  'Wineries':                 { energy: 40, quiet: 70, romantic: 75, intimate: 70 },
}

function occasionAdjust(base, occasions = []) {
  const v = { ...base }
  const set = new Set((occasions || []).map(o => String(o).toLowerCase()))
  if (set.has('upscale')) { v.romantic += 10; v.intimate += 5; v.energy -= 5 }
  if (set.has('romantic')) { v.romantic += 15; v.intimate += 10; v.quiet += 5 }
  if (set.has('evening')) { v.romantic += 5; v.energy -= 5 }
  if (set.has('views')) { v.romantic += 8 }
  if (set.has('casual')) { v.energy += 5; v.intimate -= 5; v.romantic -= 5 }
  if (set.has('fun') || set.has('active')) { v.energy += 15; v.quiet -= 15 }
  if (set.has('first date')) { v.intimate -= 5; v.energy += 3 }
  if (set.has('unique') || set.has('adventurous')) { v.energy += 8 }
  if (set.has('coffee') || set.has('dairy') || set.has('light')) { v.energy -= 5; v.quiet += 5 }
  if (set.has('dessert')) { v.energy -= 3; v.intimate += 3 }
  return clampVibe(v)
}

function clampVibe(v) {
  const c = (n) => Math.max(0, Math.min(100, Math.round(n)))
  return { energy: c(v.energy), quiet: c(v.quiet), romantic: c(v.romantic), intimate: c(v.intimate) }
}

export function deriveVibe(loc) {
  if (!loc) return { energy: 50, quiet: 50, romantic: 50, intimate: 50, fromCurator: false }
  const hasCurator =
    loc.energy_score != null ||
    loc.quietness_score != null ||
    loc.romantic_score != null ||
    loc.group_vs_intimate_score != null
  const base = CATEGORY_VIBE_DEFAULTS[canonicalCategory(loc.category)] || { energy: 50, quiet: 50, romantic: 50, intimate: 50 }
  const derived = occasionAdjust(base, loc.occasion)
  const intimateFromGroup = loc.group_vs_intimate_score != null
    ? 100 - loc.group_vs_intimate_score
    : derived.intimate
  return clampVibe({
    energy:   loc.energy_score    ?? derived.energy,
    quiet:    loc.quietness_score ?? derived.quiet,
    romantic: loc.romantic_score  ?? derived.romantic,
    intimate: intimateFromGroup,
    fromCurator: hasCurator,
  })
}

// Per-pair compatibility delta, range roughly [-5, +3].
// Also returns reasons array so the debug surface can explain the verdict.
export function flowCompatibility(prev, next) {
  if (!prev || !next) return { delta: 0, reasons: [] }
  const a = deriveVibe(prev)
  const b = deriveVibe(next)
  let delta = 0
  const reasons = []

  const energySwing = Math.abs(a.energy - b.energy)
  if (energySwing > 50) { delta -= 3; reasons.push(`energy swing ${energySwing}`) }
  else if (energySwing > 30) { delta -= 1; reasons.push(`energy step ${energySwing}`) }
  else if (energySwing <= 15) { delta += 1; reasons.push('smooth energy') }

  if (b.intimate - a.intimate > 35) {
    delta -= 2
    reasons.push('intimacy jump up')
  }

  // Transition penalties for known-bad category combos
  const key = `${normalizeCategoryShort(prev)}:${normalizeCategoryShort(next)}`
  const tp = TRANSITION_PENALTIES[key]
  if (tp) { delta += tp.delta; reasons.push(tp.reason) }

  return { delta, reasons }
}

function normalizeCategoryShort(loc) {
  const c = loc?.category || ''
  if (c.includes('Park')) return 'outdoors'
  if (c.includes('Hotel') || c.includes('Lounge')) return 'lounges'
  if (c.includes('Museum') || c.includes('Culture')) return 'culture'
  if (c.includes('Activit') || c.includes('Experience')) return 'activity'
  if (c.includes('Caf') || c.includes('Restaurant')) return 'food'
  if (c.includes('Winer')) return 'winery'
  return 'other'
}

// Hand-curated penalty/bonus for transitions we already know feel wrong
// or right. Keep this list short — it's easier to debug a tight list than
// a sprawling matrix.
const TRANSITION_PENALTIES = {
  'activity:lounges':  { delta: -2, reason: 'high-energy → quiet lounge clash' },
  'activity:winery':   { delta: -2, reason: 'high-energy → quiet winery clash' },
  'lounges:activity':  { delta: -2, reason: 'quiet lounge → activity clash' },
  'culture:activity':  { delta: -1, reason: 'museum → activity feels mismatched' },
  'winery:food':       { delta: +1, reason: 'wine → dinner natural flow' },
  'food:outdoors':     { delta: +1, reason: 'meal → walk natural flow' },
  'outdoors:food':     { delta: +1, reason: 'walk → meal natural flow' },
  'food:food':         { delta: -1, reason: 'two food stops in a row' },
}

// ─── Time fit ──────────────────────────────────────────────────────────────

const CATEGORY_BEST_TIME_DEFAULT = {
  'Parks & Outdoors':         ['afternoon', 'evening'],
  'Hotels & Lounges':         ['evening', 'night'],
  'Museums & Culture':        ['afternoon', 'evening'],
  'Activities & Experiences': ['afternoon', 'evening'],
  'Cafés & Restaurants':      ['afternoon', 'evening', 'night'],
  'Wineries':                 ['evening', 'night'],
}

function bestTimeFor(loc) {
  if (Array.isArray(loc?.best_time) && loc.best_time.length) return loc.best_time
  return CATEGORY_BEST_TIME_DEFAULT[canonicalCategory(loc?.category)] || ['afternoon', 'evening', 'night']
}

// Soft scoring: stop 1 of an evening plan should not be 'night'-only,
// stop N can be. Returns a small delta in [-3, +1].
export function timeFitForStopIndex(loc, stopIndex, totalStops) {
  const bt = bestTimeFor(loc)
  const isFirst = stopIndex === 0
  const isLast = stopIndex === totalStops - 1
  const nightOnly = bt.length === 1 && bt[0] === 'night'
  const morningOnly = bt.length === 1 && bt[0] === 'morning'

  if (isFirst && nightOnly) return -3
  if (isFirst && bt.includes('afternoon')) return 1
  if (!isFirst && morningOnly) return -2
  if (isLast && (bt.includes('evening') || bt.includes('night'))) return 1
  return 0
}

// ─── Duration sanity ───────────────────────────────────────────────────────

const CATEGORY_DURATION_DEFAULT = {
  'Parks & Outdoors':         60,
  'Hotels & Lounges':         75,
  'Museums & Culture':        90,
  'Activities & Experiences': 90,
  'Cafés & Restaurants':      75,
  'Wineries':                 90,
}

function durationFor(loc) {
  if (loc?.duration_min && loc?.duration_max) {
    return (loc.duration_min + loc.duration_max) / 2
  }
  if (loc?.duration_min) return loc.duration_min
  return CATEGORY_DURATION_DEFAULT[canonicalCategory(loc?.category)] || 60
}

const LENGTH_TARGET_MINUTES = {
  short:  { min: 60,  max: 150 },
  medium: { min: 120, max: 210 },
  long:   { min: 180, max: 300 },
}

export function totalPlanMinutes(stops) {
  return (stops || []).reduce((sum, s) => sum + durationFor(s), 0)
}

// ─── Plan-level validator ──────────────────────────────────────────────────

export function validatePlanFlow(stops, { length = 'medium' } = {}) {
  const warnings = []
  if (!stops || stops.length < 2) return warnings

  // Per-pair checks
  for (let i = 0; i < stops.length - 1; i++) {
    const { delta, reasons } = flowCompatibility(stops[i], stops[i + 1])
    if (delta <= -2) {
      warnings.push(`flow_${reasons[0]?.replace(/[^a-z]+/gi, '_').toLowerCase()}_${i + 1}_${i + 2}`)
    }
  }

  // Zig-zag energy pattern across 3 stops
  if (stops.length >= 3) {
    const vibes = stops.map(deriveVibe)
    const zig = (vibes[0].energy - vibes[1].energy) * (vibes[1].energy - vibes[2].energy)
    if (zig < -400) warnings.push('flow_energy_zigzag')
  }

  // Stop 1 night-only
  if (stops[0] && timeFitForStopIndex(stops[0], 0, stops.length) <= -3) {
    warnings.push('time_stop1_night_only')
  }

  // Duration vs requested length
  const total = totalPlanMinutes(stops)
  const target = LENGTH_TARGET_MINUTES[length] || LENGTH_TARGET_MINUTES.medium
  if (total > target.max * 1.5) warnings.push('plan_too_long')
  if (total < target.min * 0.6) warnings.push('plan_too_short')

  // Cross-city / Various warning
  const cities = stops.map(s => s.city || s._city).filter(Boolean)
  const distinctReal = new Set(cities.filter(c => c !== 'Various'))
  if (distinctReal.size > 1) warnings.push('cross_city')

  return warnings
}

// ─── Compose metadata helper ───────────────────────────────────────────────
// Both engines call this once at the end of assembly to attach the _compose
// payload used by PlanComposeDebug.

export function buildComposeMetadata(stops, { engine, templateUsed, length }) {
  const legs = []
  for (let i = 1; i < stops.length; i++) {
    const km = distanceKm(stops[i - 1], stops[i])
    legs.push({
      kmFromPrev: km,
      proximityScore: proximityScore(stops[i - 1], stops[i]),
    })
  }
  const flowDeltas = []
  for (let i = 1; i < stops.length; i++) {
    flowDeltas.push({
      from: i - 1,
      to: i,
      ...flowCompatibility(stops[i - 1], stops[i]),
    })
  }
  const derivedVibes = stops.map((s, i) => {
    const v = deriveVibe(s)
    return { stopIndex: i, vibe: v, fromCurator: v.fromCurator }
  })
  const flowWarnings = validatePlanFlow(stops, { length })
  return { engine, templateUsed, legs, flowDeltas, derivedVibes, flowWarnings }
}

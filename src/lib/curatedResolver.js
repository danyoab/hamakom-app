// Curated-plan verification — links hand-written DATE_PLANS stops to real
// locations rows so the same hard gates that protect generated plans can
// cover curated ones.
//
// Matching is deliberately conservative: same canonical city, all name tokens
// of the DB venue present in the stop's name/maps_query, and (when both sides
// have coordinates) within 350m. A stop that doesn't match anything stays
// unresolved — that keeps walking segments ("Nachlaot Walk") and generic
// finales legal as connectors while never inventing a venue link.
//
// Outcomes:
// - A stop that resolves gains `_locationId`, so `isRealStop`/`isRealPlan`
//   (planGates.js) can pass and the plan becomes eligible for quiz results.
// - A stop that resolves to a CLOSED / non-operational venue marks the plan
//   unsafe (`curatedPlanSafe` → false) so Tonight's Pick / Surprise Me skip it.
import { canonicalCity, isOperational, isRealVenueRow } from './planGates'

const STOPWORDS = new Set(['and', 'the', 'at', 'of', 'in', 'a', 'an'])

function tokens(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function matchStopToLocation(stop, cityLocations) {
  const stopTokens = new Set([...tokens(stop.name_en), ...tokens(stop.name_he), ...tokens(stop.maps_query)])
  if (!stopTokens.size) return null

  let best = null
  for (const loc of cityLocations) {
    const nameTokens = tokens(loc.name)
    if (!nameTokens.length) continue
    if (!nameTokens.every((t) => stopTokens.has(t))) continue
    if (stop.lat != null && stop.lng != null && loc.lat != null && loc.lng != null) {
      if (haversineKm(stop.lat, stop.lng, loc.lat, loc.lng) > 0.35) continue
    }
    // Prefer the longest (most specific) name match.
    if (!best || nameTokens.length > tokens(best.name).length) best = loc
  }
  return best
}

export function resolveCuratedPlan(plan, locations) {
  if (!plan?.stops?.length || !locations?.length) return plan
  const planCity = canonicalCity(plan.city)
  const cityLocations = locations.filter((l) => canonicalCity(l.city) === planCity)
  if (!cityLocations.length) return plan

  let changed = false
  const stops = plan.stops.map((stop) => {
    if (stop.source_location_id != null || stop._locationId != null) return stop
    const match = matchStopToLocation(stop, cityLocations)
    if (!match) return stop
    changed = true
    return {
      ...stop,
      _locationId: match.id,
      lat: stop.lat ?? match.lat,
      lng: stop.lng ?? match.lng,
      _resolvedOperational: isRealVenueRow(match) && isOperational(match),
    }
  })
  return changed ? { ...plan, stops } : plan
}

export function resolveCuratedPlans(plans, locations) {
  return (plans || []).map((plan) => resolveCuratedPlan(plan, locations))
}

// Safe = no stop is KNOWN to point at a closed/unverifiable venue.
// Unresolved stops (undefined) are tolerated; resolved-but-closed is not.
export function curatedPlanSafe(plan) {
  return (plan?.stops || []).every((stop) => stop._resolvedOperational !== false)
}

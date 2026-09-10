import { marketOf } from './markets.js'
import { foodClassOf, isOperational, isRealVenueRow, sameCity, violatesFoodPairing } from './planGates.js'
import { distanceKm } from './planCoherence.js'
import { isDiscoverable } from './venueCatalog.js'
import { matchesVenuePreferences } from './venuePreferences.js'

export function maxLegKm(mode) { return mode === 'driving' ? 6 : 2 }

export function visitMinutes(loc) {
  if (Number.isFinite(loc.duration_min) && loc.duration_min > 0) return Math.min(240, loc.duration_min)
  const food = foodClassOf(loc)
  if (food.is_food) return food.meal_weight === 'heavy' ? 75 : food.food_type === 'dessert' ? 30 : 60
  if (/activ|museum|culture/i.test(loc.category || '')) return 90
  return 45
}

export function travelMinutes(a, b, mode = 'walking') {
  const km = distanceKm(a, b)
  if (km == null) return null
  // Straight-line coordinates are not a street route. Allow a detour factor
  // and parking time; maps remains the authority for the actual journey.
  return mode === 'driving' ? Math.max(10, Math.ceil(km * 1.4 * 3 + 8)) : Math.max(2, Math.ceil(km * 1.4 * 15))
}

export function clockMinutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function periodMinute(point) {
  if (!point || !Number.isInteger(point.day) || point.day < 0 || point.day > 6) return null
  const hm = point.time ? clockMinutes(`${point.time.slice(0, 2)}:${point.time.slice(2)}`) :
    Number.isInteger(point.hour) && point.hour >= 0 && point.hour < 24 && (point.minute ?? 0) >= 0 && (point.minute ?? 0) < 60 ? point.hour * 60 + (point.minute || 0) : null
  return hm == null ? null : point.day * 1440 + hm
}

// Google Places regular periods: handles overnight, week wrap, split shifts,
// and explicit 24/7. Unknown periods never become an "open" claim.
export function openingWindow(loc, date, arrival, duration) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || arrival == null) return 'unknown'
  const day = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return 'unknown'
  const hours = loc.opening_hours
  if (!Array.isArray(hours?.periods) || !hours.periods.length) return 'unknown'
  // Shabbat-relative / seasonal text cannot be expressed as a fixed period.
  if (hours.variable_days?.includes((day.getUTCDay() + Math.floor(arrival / 1440)) % 7)) return 'unknown'
  const start = day.getUTCDay() * 1440 + arrival
  const end = start + duration + 15
  let valid = false
  for (const period of hours.periods) {
    const open = periodMinute(period.open)
    let close = periodMinute(period.close)
    if (open == null) continue
    if (open === 0 && !period.close) return 'fits_regular_hours'
    if (close == null) continue
    valid = true
    if (close <= open) close += 7 * 1440
    for (const offset of [-10080, 0, 10080]) {
      if (start >= open + offset && end <= close + offset) return 'fits_regular_hours'
    }
  }
  return valid ? 'closed_for_visit' : 'unknown'
}

export function validatePlanLocations(rows, answers = {}) {
  const reasons = []
  const scheduled = []
  let arrival = clockMinutes(answers.startTime)
  const ids = new Set()
  const multi = rows.length > 1
  if (!rows.length || rows.length > 3) reasons.push('stop_count')
  for (let i = 0; i < rows.length; i++) {
    const loc = rows[i]
    if (!isDiscoverable(loc)) { reasons.push('unavailable_venue'); continue }
    if (ids.has(String(loc.id))) reasons.push('duplicate_venue')
    ids.add(String(loc.id))
    if (answers.city && answers.city !== 'flexible' && !sameCity(loc.city, answers.city)) reasons.push('wrong_city')
    if (multi && (!isRealVenueRow(loc) || !isOperational(loc))) reasons.push('unverified_route')
    if (!matchesVenuePreferences(loc, answers)) reasons.push('preferences')
    const previous = rows[i - 1]
    const travel = previous ? travelMinutes(previous, loc, answers.travelMode) : 0
    if (previous) {
      if (marketOf(previous).id !== marketOf(loc).id) reasons.push('cross_market')
      if (!sameCity(previous.city, loc.city)) reasons.push('cross_city')
      const distance = distanceKm(previous, loc)
      if (distance == null || distance > maxLegKm(answers.travelMode)) reasons.push('distance')
      if (violatesFoodPairing(rows.slice(0, i), loc, previous)) reasons.push('meal_sequence')
      if (arrival != null) arrival += travel || 0
    }
    const duration = visitMinutes(loc)
    const hours = openingWindow(loc, answers.date, arrival, duration)
    if (hours === 'closed_for_visit') reasons.push('closed_for_visit')
    scheduled.push({ arrival, duration, travel, hours })
    if (arrival != null) arrival += duration
  }
  const totalMinutes = scheduled.reduce((sum, s) => sum + s.duration + (s.travel || 0), 0)
  if (answers.length === 'short' && totalMinutes > 120) reasons.push('too_long')
  if (answers.length === 'medium' && totalMinutes > 180) reasons.push('too_long')
  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], scheduled, totalMinutes }
}

export function planLocationRows(plan, locations) {
  const index = new Map(locations.map(l => [String(l.id), l]))
  return (plan?.stops || []).map(s => index.get(String(s.source_location_id ?? s._locationId ?? s.location_id)))
}

export function finalizePlan(plan, rows, answers = {}) {
  const validation = validatePlanLocations(rows, answers)
  if (!validation.valid) return null
  const single = rows.length === 1
  const prices = rows.map(r => r.price)
  const priceLabel = prices.every(p => Number.isInteger(p) && p >= 0 && p <= 4)
    ? (marketOf(rows[0]).symbol.repeat(Math.max(...prices)) || (answers.lang === 'he' ? 'ללא תשלום' : 'Free entry')) : null
  return {
    ...plan,
    market: marketOf(rows[0]).id,
    region: rows[0].region,
    city: rows[0].city,
    city_he: rows[0].city_he || rows[0].city,
    source_location_ids: rows.map(l => l.id),
    stops: plan.stops.map((s, i) => ({ ...s, ...validation.scheduled[i], source_location_id: rows[i].id,
      city: rows[i].city, region: rows[i].region,
      lat: rows[i].lat, lng: rows[i].lng, name_en: rows[i].name, name_he: rows[i].name_he || rows[i].name,
      maps_query: rows[i].maps_query || `${rows[i].name} ${rows[i].city}` })),
    travel_mode: answers.travelMode || 'walking',
    planning_date: answers.date || null,
    start_time: answers.startTime || null,
    start_time_text_en: answers.startTime ? `Your start: ${answers.startTime}` : '',
    start_time_text_he: answers.startTime ? `שעת התחלה: ${answers.startTime}` : '',
    duration_text_en: `Allow about ${validation.totalMinutes} min${single ? '' : ', including travel'}`,
    duration_text_he: `כ־${validation.totalMinutes} דקות${single ? '' : ', כולל מעבר בין המקומות'}`,
    budget_text_en: priceLabel ? `Price level: ${priceLabel} · Confirm current prices` : 'Price not confirmed · Check with the venue',
    budget_text_he: priceLabel ? `רמת מחיר: ${priceLabel === 'Free entry' ? 'ללא תשלום' : priceLabel} · בדקו מחירים עדכניים` : 'מחיר לא מאומת · בדקו עם המקום',
    _singleVenue: single,
    _availabilityUnconfirmed: rows.some(l => !isOperational(l)),
    _schedule: validation,
  }
}

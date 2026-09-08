import test from 'node:test'
import assert from 'node:assert/strict'
import { SEED_LOCATIONS } from '../src/data/locations.js'
import { DATE_PLANS } from '../src/data/datePlans.js'
import { QUIZ_CITIES } from '../src/lib/constants.js'
import { enrichCatalog } from '../src/data/venueDetails.js'
import { canonicalCity, isRealVenueRow, sameCity, violatesFoodPairing } from '../src/lib/planGates.js'
import { catalogSearch, fetchLocationCatalog, isDiscoverable, normalizeLocation } from '../src/lib/venueCatalog.js'
import { dietaryEvidence, matchesVenuePreferences, safeExternalUrl } from '../src/lib/venuePreferences.js'
import { getSmartMatchedPlans } from '../src/lib/planRecommendations.js'
import { getRecommendedLocations } from '../src/lib/locationRecommendations.js'
import { distanceKm } from '../src/lib/planCoherence.js'
import { finalizePlan, openingWindow, planLocationRows, validatePlanLocations } from '../src/lib/planValidation.js'
import { resolveCuratedPlan } from '../src/lib/curatedResolver.js'
import { portablePlanId, restoreSavedPlan, restoreSharedPlan, sharedPlanPath } from '../src/lib/sharedPlans.js'
import { parseAppRoute } from '../src/lib/routes.js'
import { publicLocation } from '../src/lib/venueCatalog.js'
import { saveDelta } from '../src/lib/saveSync.js'

const catalog = enrichCatalog(SEED_LOCATIONS.map(normalizeLocation))
const venue = (id, extra = {}) => ({ id, name: `Place ${id}`, category: 'Parks & Outdoors', city: 'Beit Shemesh', status: 'approved', business_status: 'OPERATIONAL', lat: 31.75, lng: 34.99 + id * 0.001, price: 1, date_stage: [1, 2], occasion: ['first date', 'romantic'], ...extra })
const answers = { city: 'Beit Shemesh', seriousness: 'just-met', length: 'medium' }

test('every city with published inventory has date ideas without the database', () => {
  const offered = new Set(catalog.filter(isDiscoverable).map(l => l.city))
  assert.ok(offered.has('Beit Shemesh'))
  assert.ok(QUIZ_CITIES.filter(c => offered.has(c)).length >= 12)
  for (const city of offered) {
    const plans = getSmartMatchedPlans(DATE_PLANS, catalog, { ...answers, city }, 3)
    assert.ok(plans.length, `No ideas for ${city}`)
    for (const plan of plans) {
      assert.ok(validatePlanLocations(planLocationRows(plan, catalog), { ...answers, city }).valid)
      assert.ok(planLocationRows(plan, catalog).every(l => sameCity(l.city, city)))
    }
  }
})

test('Beit Shemesh aliases include Ramat Beit Shemesh and Hebrew', () => {
  for (const city of ['bet shemesh', 'Beit-Shemesh', 'Ramat Beit Shemesh', 'בית שמש', 'רמת בית שמש']) assert.equal(canonicalCity(city), 'Beit Shemesh')
  assert.ok(catalogSearch(catalog.find(l => l.id === 20), 'bet shemesh'))
  assert.ok(catalogSearch(catalog.find(l => l.id === 127), 'cafe'))
})

test('category and date-stage normalization makes DB rows filterable', () => {
  const row = normalizeLocation(venue(1, { category: 'Cafes & Restaurants', date_stage: '1' }))
  assert.equal(row.category, 'Cafés & Restaurants')
  assert.deepEqual(row.date_stage, [1])
})

test('known closures, unpublished venues and generic chains never enter discovery', () => {
  for (const extra of [{ business_status: 'CLOSED_PERMANENTLY' }, { business_status: 'CLOSED_TEMPORARILY' }, { status: 'pending' }, { city: 'Various' }]) {
    assert.equal(isDiscoverable(venue(1, extra)), false)
    assert.deepEqual(getSmartMatchedPlans([], [venue(1, extra)], answers), [])
  }
})

test('coordinates must be finite, geographic venue coordinates', () => {
  for (const extra of [{ lat: NaN }, { lng: Infinity }, { lat: 100 }, { lat: '', lng: '' }, { lat: 0, lng: 0 }]) assert.equal(isRealVenueRow(venue(1, extra)), false)
  assert.equal(distanceKm(venue(1, { lat: null }), venue(2, { lat: null })), null)
})

test('backup rankings scope the city before limiting results', () => {
  const pool = [venue(1, { city: 'Jerusalem', featured: true }), venue(2)]
  assert.deepEqual(getRecommendedLocations(pool, answers, { limit: 1 }).map(l => l.id), [2])
})

test('alternatives obey the requested visit window and single-place duration cap', () => {
  const closed = venue(1, { opening_hours: { periods: [{ open: { day: 2, time: '0800' }, close: { day: 2, time: '1200' } }] } })
  const longVisit = venue(2, { duration_min: 180 })
  assert.deepEqual(getRecommendedLocations([closed], { ...answers, date: '2026-09-08', startTime: '20:00' }), [])
  assert.equal(validatePlanLocations([longVisit], { ...answers, length: 'short' }).valid, false)
})

test('invalid kashrut check and expiry dates never count as verified', () => {
  const food = venue(1, { category: 'Cafés & Restaurants', kashrut_status: 'verified', kashrut_authority: 'Test authority', kashrut_last_verified_at: 'invalid' })
  assert.equal(matchesVenuePreferences(food, { kosher: 'verified' }), false)
  assert.equal(matchesVenuePreferences({ ...food, kashrut_last_verified_at: '2026-09-01', kashrut_certificate_expiry: 'invalid' }, { kosher: 'verified' }), false)
})

test('dietary evidence needs a safe source and check date; unknown never matches', () => {
  const food = venue(1, { category: 'Cafés & Restaurants', dietary_options: ['vegan'] })
  assert.deepEqual(dietaryEvidence(food), [])
  assert.equal(matchesVenuePreferences(food, { dietary: ['vegan'] }), false)
  const sourced = { ...food, dietary_source_url: 'https://example.com/menu', dietary_checked_at: '2026-09-08' }
  assert.equal(matchesVenuePreferences(sourced, { dietary: ['vegan'] }), true)
  assert.equal(matchesVenuePreferences(sourced, { dietary: ['vegan', 'gluten-free'] }), false)
  assert.equal(matchesVenuePreferences(venue(2), { dietary: ['vegan'] }), true)
})

test('Beit Shemesh vegan food results use published evidence', () => {
  const plans = getSmartMatchedPlans([], catalog, { ...answers, focus: 'food-drink', dietary: ['vegan'] }, 3)
  assert.ok(plans.length)
  for (const plan of plans) for (const l of planLocationRows(plan, catalog)) assert.ok(dietaryEvidence(l).includes('vegan'))
})

test('dietary constraints also gate every support stop and curated plan', () => {
  const food = venue(1, { category: 'Cafés & Restaurants' })
  const park = venue(2)
  const curated = { id: 'unsafe', city: 'Beit Shemesh', focus_tags: ['outdoors'], stops: [park, food].map(l => ({ source_location_id: l.id, lat: l.lat, lng: l.lng })) }
  const plans = getSmartMatchedPlans([curated], [food, park], { ...answers, dietary: ['vegan'] }, 5)
  assert.ok(plans.length)
  assert.ok(plans.every(p => !p.source_location_ids.includes(food.id)))
})

test('old kashrus text, expired and incomplete certification are not verified', () => {
  const food = venue(1, { category: 'Cafés & Restaurants', kashrus: 'Mehadrin' })
  assert.equal(matchesVenuePreferences(food, { kosher: 'verified' }), false)
  const verified = { ...food, kashrut_status: 'verified', kashrut_authority: 'Authority', kashrut_last_verified_at: '2026-09-08' }
  assert.equal(matchesVenuePreferences(verified, { kosher: 'verified' }), true)
  assert.equal(matchesVenuePreferences({ ...verified, kashrut_certificate_expiry: '2020-01-01' }, { kosher: 'verified' }), false)
  assert.equal(matchesVenuePreferences(verified, { kosher: 'mehadrin' }), false)
})

test('curated linked stops are rechecked when a venue closes', () => {
  const rows = [venue(1), venue(2, { business_status: 'CLOSED_PERMANENTLY' })]
  const p = resolveCuratedPlan({ city: 'Beit Shemesh', stops: rows.map(l => ({ source_location_id: l.id, lat: l.lat, lng: l.lng })) }, rows)
  assert.equal(p.stops[1]._resolvedOperational, false)
  assert.equal(finalizePlan(p, rows, answers), null)
})

test('first transition cannot pair two meals or dinner then cafe', () => {
  const dinner = venue(1, { name: 'Bistro', category: 'Cafés & Restaurants' })
  const cafe = venue(2, { name: 'Café Two', category: 'Cafés & Restaurants' })
  const dessert = venue(3, { name: 'Gelato', category: 'Cafés & Restaurants' })
  assert.equal(violatesFoodPairing([dinner], dinner, dinner), true)
  assert.equal(violatesFoodPairing([dinner], cafe, dinner), true)
  assert.equal(violatesFoodPairing([dinner], dessert, dinner), false)
  assert.equal(violatesFoodPairing([dessert, venue(4)], dinner, venue(4)), true)
})

test('walking versus driving is a hard route constraint', () => {
  const rows = [venue(1), venue(2, { lat: 31.775 })]
  assert.ok(distanceKm(...rows) > 2)
  assert.equal(validatePlanLocations(rows, { ...answers, travelMode: 'walking' }).valid, false)
  assert.equal(validatePlanLocations(rows, { ...answers, travelMode: 'driving' }).valid, true)
})

test('route duration includes actual visits and transit, short dates stay short', () => {
  const rows = [venue(1, { duration_min: 90 }), venue(2, { duration_min: 90 })]
  assert.ok(validatePlanLocations(rows, answers).totalMinutes > 180)
  assert.equal(validatePlanLocations(rows, { ...answers, length: 'short' }).valid, false)
})

test('regular hours cover the entire visit plus a 15-minute buffer', () => {
  const loc = venue(1, { opening_hours: { periods: [{ open: { day: 2, hour: 8 }, close: { day: 2, hour: 22 } }] } })
  assert.equal(openingWindow(loc, '2026-09-08', 20 * 60, 60), 'fits_regular_hours')
  assert.equal(openingWindow(loc, '2026-09-08', 21 * 60, 60), 'closed_for_visit')
  assert.equal(openingWindow(loc, '2026-09-09', 12 * 60, 60), 'closed_for_visit')
  assert.equal(openingWindow(loc, '2026-09-31', 12 * 60, 60), 'unknown')
})

test('hours handle overnight and week boundaries, split shifts, 24/7 and missing data', () => {
  const loc = venue(1, { opening_hours: { periods: [{ open: { day: 6, time: '2200' }, close: { day: 0, time: '0200' } }] } })
  assert.equal(openingWindow(loc, '2026-09-13', 30, 60), 'fits_regular_hours')
  const split = venue(2, { opening_hours: { periods: [{ open: { day: 2, hour: 8 }, close: { day: 2, hour: 12 } }, { open: { day: 2, hour: 16 }, close: { day: 2, hour: 22 } }] } })
  assert.equal(openingWindow(split, '2026-09-08', 11 * 60, 120), 'closed_for_visit')
  assert.equal(openingWindow(venue(3, { opening_hours: { periods: [{ open: { day: 0, hour: 0 } }] } }), '2026-09-08', 12 * 60, 60), 'fits_regular_hours')
  assert.equal(openingWindow(venue(4), '2026-09-08', 12 * 60, 60), 'unknown')
})

test('branch-specific Shabbat-relative hours stay unconfirmed', () => {
  assert.equal(openingWindow(catalog.find(l => l.id === 127), '2026-09-12', 20 * 60, 60), 'unknown')
})

test('shared and saved plans preserve stop order, mode and start time', () => {
  const rows = [venue(1), venue(2)]
  const route = { ids: ['1', '2'], mode: 'driving', date: '2026-09-08', time: '19:30' }
  const plan = restoreSharedPlan(route, rows)
  assert.ok(plan)
  const parsed = parseAppRoute(sharedPlanPath(plan, 'he'))
  assert.deepEqual(parsed.ids, route.ids)
  assert.equal(parsed.time, route.time)
  assert.equal(parsed.lang, 'he')
  const saved = restoreSavedPlan(portablePlanId([1, 2], { travelMode: route.mode, date: route.date, startTime: route.time }), rows)
  assert.deepEqual(saved.source_location_ids, [1, 2])
  assert.equal(saved.start_time, route.time)
  assert.equal(restoreSharedPlan(route, [rows[0]]), null)
  assert.equal(restoreSharedPlan({ ids: ['1', '1'] }, rows), null)
  assert.equal(parseAppRoute('/location/%E0%A4%A'), null)
})

test('external links cannot execute scripts or hide credentials', () => {
  for (const s of ['javascript:alert(1)', 'data:text/html,hi', 'https://user:password@example.com']) assert.equal(safeExternalUrl(s), null)
  assert.equal(safeExternalUrl('https://example.com/menu'), 'https://example.com/menu')
})

test('catalog loader paginates, returns authoritative empty data and rejects failures', async () => {
  const rows = Array.from({ length: 7 }, (_, i) => venue(i + 1))
  const requested = []
  const fake = { from() { return { select() { return this }, eq() { return this }, order() { return this }, range(a, b) { requested.push([a, b]); return Promise.resolve({ data: rows.slice(a, b + 1) }) } } } }
  assert.equal((await fetchLocationCatalog(fake, { pageSize: 3 })).length, 7)
  assert.deepEqual(requested, [[0, 2], [3, 5], [6, 8]])
  rows.length = 0
  assert.deepEqual(await fetchLocationCatalog(fake), [])
  const fail = { from() { return { select() { return this }, eq() { return this }, order() { return this }, range() { return Promise.resolve({ error: { message: 'offline' } }) } } } }
  await assert.rejects(fetchLocationCatalog(fail), /offline/)
})

test('catalog source additions preserve curator corrections and never restore closures', () => {
  const loc = { ...catalog.find(l => l.id === 127), menu_url: '', dietary_options: [], business_status: 'CLOSED_PERMANENTLY' }
  const [updated] = enrichCatalog([loc])
  assert.equal(updated.menu_url, '')
  assert.deepEqual(updated.dietary_options, [])
  assert.equal(isDiscoverable(updated), false)
})

test('public catalog sanitization excludes internal notes and business contacts', () => {
  const data = publicLocation({ ...venue(1), partner_contact: 'private', notes_internal: 'private', manual_edits: { secret: true }, phone: 'public' })
  assert.equal(data.partner_contact, undefined)
  assert.equal(data.notes_internal, undefined)
  assert.equal(data.manual_edits, undefined)
  assert.equal(data.phone, 'public')
})

test('save sync preserves additions made on a different device', () => {
  assert.deepEqual(saveDelta(['new'], ['old', 'other-device'], ['old']), { insert: ['new'], remove: ['old'] })
  assert.deepEqual(saveDelta([1], ['1'], [1]), { insert: [], remove: [] })
})

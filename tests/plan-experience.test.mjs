import test from 'node:test'
import assert from 'node:assert/strict'
import { getPlanMapData, getPlanNavigationUrl } from '../src/lib/planMap.js'
import { getPlanPreferences, preferencesFromPlan } from '../src/lib/planPreferences.js'
import { getSmartMatchedPlans } from '../src/lib/planRecommendations.js'
import { enrichCatalog } from '../src/data/venueDetails.js'
import { SEED_LOCATIONS } from '../src/data/locations.js'
import { normalizeLocation, isDiscoverable } from '../src/lib/venueCatalog.js'
import { shouldClearAccountData } from '../src/lib/saveSync.js'

const place = { name_en: 'Test cafe', city: 'Beit Shemesh', lat: 31.74, lng: 34.99 }

test('account changes cannot inherit another account’s local saves', () => {
  assert.equal(shouldClearAccountData(null, 'account-a'), false)
  assert.equal(shouldClearAccountData('account-a', 'account-a'), false)
  assert.equal(shouldClearAccountData('account-a', 'account-b'), true)
  assert.equal(shouldClearAccountData('account-a', null), true)
})

test('a single place has a map; missing coordinates give an area without a fake pin', () => {
  const exact = getPlanMapData([place])
  assert.equal(exact.markers.length, 1)
  assert.deepEqual(exact.center, [31.74, 34.99])
  assert.deepEqual(exact.route, [])
  const area = getPlanMapData([{ ...place, lat: null, lng: null }], 'Bet Shemesh')
  assert.equal(area.areaKnown, true)
  assert.equal(area.city, 'Beit Shemesh')
  assert.deepEqual(area.markers, [])
  assert.equal(area.distanceKm, null)
  assert.equal(area.complete, false)
})

test('partial map data preserves stop numbers and cannot draw a misleading route', () => {
  const partial = getPlanMapData([{ ...place, lat: NaN }, place, { ...place, lng: 35 }])
  assert.deepEqual(partial.markers.map(m => m.number), [2, 3])
  assert.deepEqual(partial.route, [])
  const complete = getPlanMapData([place, { ...place, lng: 35 }])
  assert.equal(complete.route.length, 2)
  assert.ok(complete.distanceKm > 0)
})

test('navigation covers all stops in order with the selected travel mode', () => {
  const url = new URL(getPlanNavigationUrl([place, { ...place, lng: 35 }, { ...place, lng: 35.01 }], 'driving'))
  assert.equal(url.searchParams.get('origin'), '31.74,34.99')
  assert.equal(url.searchParams.get('waypoints'), '31.74,35')
  assert.equal(url.searchParams.get('destination'), '31.74,35.01')
  assert.equal(url.searchParams.get('travelmode'), 'driving')
  const query = 'Cafe & Garden #2 בית שמש'
  const single = new URL(getPlanNavigationUrl([{ ...place, maps_query: query }]))
  assert.equal(single.searchParams.get('query'), query)
  assert.equal(getPlanNavigationUrl([]), null)
})

test('resetting advanced preferences clears every restriction while keeping quiz context', () => {
  const old = { city: 'Beit Shemesh', seriousness: 'just-met', _seed: 123,
    focus: 'food-drink', length: 'short', dietary: ['vegan'], kosher: 'mehadrin', budget: 'budget', travelMode: 'driving', date: '2026-09-10', startTime: '18:00', menuOnly: true }
  const reset = { ...old, ...getPlanPreferences() }
  assert.deepEqual(reset, { city: old.city, seriousness: old.seriousness, _seed: old._seed, focus: '', length: '', dietary: [], kosher: 'any', budget: 'any', travelMode: 'walking', date: '', startTime: '', menuOnly: false })
})

test('fine-tuning a shared or saved plan preserves its date, time, and mode', () => {
  const p = getPlanPreferences(preferencesFromPlan({ city: 'Beit Shemesh', travel_mode: 'driving', planning_date: '2026-09-10', start_time: '18:00' }))
  assert.equal(p.travelMode, 'driving')
  assert.equal(p.date, '2026-09-10')
  assert.equal(p.startTime, '18:00')
})

test('two-choice quiz produces ideas in every catalog city without optional answers', () => {
  const catalog = enrichCatalog(SEED_LOCATIONS.map(normalizeLocation))
  const cities = new Set(catalog.filter(isDiscoverable).map(l => l.city))
  for (const city of cities) {
    for (const seriousness of ['just-met', 'getting-to-know', 'getting-serious']) {
      const plans = getSmartMatchedPlans([], catalog, { city, seriousness }, 3)
      assert.ok(plans.length, `${city}, ${seriousness}: no results after two choices`)
      assert.ok(plans.every(p => p.city === city))
    }
  }
})

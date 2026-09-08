// Offline by default. --live audits the actual public database, with no fallback.
import { writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { SEED_LOCATIONS } from '../src/data/locations.js'
import { DATE_PLANS } from '../src/data/datePlans.js'
import { enrichCatalog } from '../src/data/venueDetails.js'
import { fetchLocationCatalog, normalizeLocation, isDiscoverable } from '../src/lib/venueCatalog.js'
import { resolveCuratedPlans } from '../src/lib/curatedResolver.js'
import { getSmartMatchedPlans } from '../src/lib/planRecommendations.js'
import { validatePlanLocations, planLocationRows } from '../src/lib/planValidation.js'
import { hasVenueCoordinates, isOperational } from '../src/lib/planGates.js'
import { dietaryEvidence, safeExternalUrl, isFoodVenue } from '../src/lib/venuePreferences.js'

const live = process.argv.includes('--live')
let rows = SEED_LOCATIONS.map(normalizeLocation)
if (live) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Live audit requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  rows = await fetchLocationCatalog(createClient(url, key), { signal: AbortSignal.timeout(15000) })
}
const locations = enrichCatalog(rows)
const published = locations.filter(isDiscoverable)
const cities = [...new Set(published.map(l => l.city))].sort()
const curated = resolveCuratedPlans(DATE_PLANS, locations)
const failures = []
let scenarios = 0, plansChecked = 0, emptyScenarios = 0
const coverage = cities.map(city => {
  const inventory = published.filter(l => l.city === city)
  let returned = 0, empty = 0
  for (const seriousness of ['just-met', 'getting-to-know', 'getting-serious']) {
    for (const focus of [undefined, 'food-drink', 'outdoors', 'activity', 'atmosphere']) {
      for (const length of ['short', 'medium', 'long']) {
        const answers = { city, seriousness, focus, length }
        const plans = getSmartMatchedPlans(curated, locations, answers, 3)
        scenarios++
        if (!plans.length) { empty++; emptyScenarios++ }
        for (const plan of plans) {
          const checked = validatePlanLocations(planLocationRows(plan, locations), answers)
          plansChecked++; returned++
          if (!checked.valid) failures.push({ answers, plan: plan.id, reasons: checked.reasons })
        }
      }
    }
  }
  return { city, venues: inventory.length, routeReady: inventory.filter(l => isOperational(l) && hasVenueCoordinates(l)).length,
    menus: inventory.filter(l => safeExternalUrl(l.menu_url)).length, dietary: inventory.filter(l => dietaryEvidence(l).length).length,
    scenarios: 45, returned, empty }
})
const duplicateIds = rows.filter((r, i) => rows.findIndex(l => String(l.id) === String(r.id)) !== i).map(r => r.id)
const report = {
  checkedAt: new Date().toISOString(), source: live ? 'live-public-database' : 'bundled-fallback',
  inventory: { total: rows.length, discoverable: published.length, excluded: rows.length - published.length,
    foodVenues: published.filter(isFoodVenue).length, cities: cities.length,
    coordinateCoverage: published.filter(hasVenueCoordinates).length, operational: published.filter(isOperational).length,
    menus: published.filter(l => safeExternalUrl(l.menu_url)).length, dietary: published.filter(l => dietaryEvidence(l).length).length },
  scenarios, plansChecked, emptyScenarios, invalidPlans: failures, duplicateIds, cities: coverage,
}
mkdirSync('reports', { recursive: true })
const target = `reports/system-audit-${live ? 'live' : 'fallback'}.json`
writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, cities: undefined, invalidPlans: failures.slice(0, 5), report: target }, null, 2))
if (failures.length || duplicateIds.length) process.exitCode = 1

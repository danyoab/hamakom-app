import test from 'node:test'
import assert from 'node:assert/strict'
import { NEW_YORK_LOCATIONS as ny } from '../src/data/newYorkLocations.js'
import { SEED_LOCATIONS } from '../src/data/locations.js'
import { marketOf, initialMarket, priceLevel } from '../src/lib/markets.js'
import { parseAppRoute } from '../src/lib/routes.js'
import { getSmartMatchedPlans } from '../src/lib/planRecommendations.js'
import { finalizePlan, validatePlanLocations, planLocationRows } from '../src/lib/planValidation.js'
import { foodService, hasVerifiedKashrut, matchesVenuePreferences, isFoodVenue } from '../src/lib/venuePreferences.js'
import { restoreSharedPlan, sharedPlanPath } from '../src/lib/sharedPlans.js'
import { getPlanMapData, getPlanNavigationUrl } from '../src/lib/planMap.js'

test('explicit area links override remembered areas; New York trailing slash works', () => {
  assert.equal(initialMarket('/new-york/','israel'),'ny')
  assert.equal(initialMarket('/?area=israel','ny'),'israel')
  assert.equal(initialMarket('/','ny'),'ny')
  assert.deepEqual(parseAppRoute('/new-york'),{type:'market',market:'ny'})
})
test('New York catalog has unique IDs, supported regions, sourced details and real US coordinates', () => {
  assert.equal(new Set(SEED_LOCATIONS.map(r=>r.id)).size,SEED_LOCATIONS.length)
  for(const r of ny){
    assert.equal(marketOf(r).id,'ny',r.name)
    assert.ok(r.details_source_url?.startsWith('https://'),r.name)
    if(r.lat!=null){assert.ok(r.lat>40 && r.lat<42,r.name);assert.ok(r.lng>-75 && r.lng<-72,r.name)}
    if(r.kashrut_status==='verified')assert.ok(r.kashrut_authority && r.kashrut_verification_source,r.name)
  }
})
test('every New York area returns valid local ideas with default kosher preferences', () => {
  for(const city of new Set(ny.map(r=>r.city)))for(const seriousness of ['just-met','getting-to-know','getting-serious']){
    const answers={city,seriousness,kosher:'verified',market:'ny'}
    const plans=getSmartMatchedPlans([],ny,answers,4)
    assert.ok(plans.length,`${city}: no ideas`)
    for(const p of plans){assert.equal(p.city,city);assert.equal(p.market,'ny');assert.ok(validatePlanLocations(planLocationRows(p,ny),answers).valid)}
  }
  const plans=getSmartMatchedPlans([],ny,{city:'flexible',seriousness:'just-met'},8)
  assert.ok(plans.every(p=>p.source_location_ids.every(id=>ny.some(r=>r.id===id))))
})
test('meat and dairy never share a short itinerary, even with another stop between', () => {
  const meat={...ny.find(r=>foodService(r)==='meat'),lat:40.75,lng:-73.98}
  const dairy={...ny.find(r=>r.food_type==='dessert'),lat:40.7501,lng:-73.98}
  const park={...ny.find(r=>r.name==='Bryant Park'),lat:40.75005,lng:-73.98}
  assert.ok(validatePlanLocations([meat,park,dairy]).reasons.includes('meal_sequence'))
  assert.equal(matchesVenuePreferences(meat,{foodService:'dairy'}),false)
})
test('kosher and dietary gates include cooking classes and exclude uncertified lounges', () => {
  assert.equal(matchesVenuePreferences(ny.find(r=>r.name==='Westlight'),{kosher:'verified'}),false)
  const cooking=ny.find(r=>r.name==='Apron Masters Kitchen')
  assert.equal(isFoodVenue(cooking),true)
  assert.equal(matchesVenuePreferences(cooking,{dietary:['vegan']}),false)
  const gf=ny.filter(r=>isFoodVenue(r)&&matchesVenuePreferences(r,{kosher:'verified',dietary:['vegan','gluten-free']}))
  assert.ok(gf.some(r=>r.name.startsWith('Modern Bread')))
})
test('certificate expiration uses venue local date and respects a future visit', () => {
  const row={...ny[0],kashrut_status:'verified',kashrut_authority:'Test',kashrut_last_verified_at:'2026-09-01',kashrut_certificate_expiry:'2026-09-30'}
  const instant=Date.parse('2026-10-01T02:00:00Z')
  assert.equal(hasVerifiedKashrut(row,instant),true)
  assert.equal(hasVerifiedKashrut({...row,region:null,city:'Jerusalem'},instant),false)
  assert.equal(matchesVenuePreferences(row,{kosher:'verified',date:'2026-10-02'}),false)
  assert.equal(hasVerifiedKashrut({...row,kashrut_certificate_expiry:'2026-99-99'},instant),false)
})
test('NY saved/shared plans retain region, currency and a US map fallback', () => {
  const row={...ny[0],price:3}
  const plan=finalizePlan({stops:[{}]},[row],{date:'2026-09-14',startTime:'18:00'})
  assert.match(plan.budget_text_en,/\$\$\$/)
  assert.equal(priceLevel(row),'$$$')
  const restored=restoreSharedPlan(parseAppRoute(sharedPlanPath(plan)),SEED_LOCATIONS)
  assert.equal(restored.market,'ny');assert.equal(restored.start_time,'18:00')
  const missing={...row,lat:null,lng:null,maps_query:null}
  assert.ok(getPlanMapData([missing]).center[1]<-70)
  assert.match(decodeURIComponent(getPlanNavigationUrl([missing])),/USA/)
  assert.doesNotMatch(decodeURIComponent(getPlanNavigationUrl([missing])),/Israel/)
})

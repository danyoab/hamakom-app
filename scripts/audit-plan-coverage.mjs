// Full coverage audit — runs every meaningful quiz combination through the
// real getSmartMatchedPlans engine, classifies the result, and writes a
// markdown + JSON report. Use this to find code bugs and inventory gaps;
// the existing audit-plan-coherence.mjs is a narrower smoke test.
//
// Usage:
//   npm run plans:audit:full
//   node scripts/audit-plan-coverage.mjs --verbose

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Shim browser storage so the engine's recency-tracking helpers don't blow up.
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
}

// Stable RNG / no exploration during audit
Math.random = () => 0.0
const __dirname = dirname(fileURLToPath(import.meta.url))

const { getSmartMatchedPlans } = await import('../src/lib/planRecommendations.js')
const { DATE_PLANS } = await import('../src/data/datePlans.js')
const { distanceKm } = await import('../src/lib/planCoherence.js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const ANON_KEY     = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZW5icGtneG5qcmtuZWJiaXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDU3NzIsImV4cCI6MjA5MjE4MTc3Mn0.qm-_69lIl9YN8-Ecrpj0Vd3LaxFbnCklNodcT2kJwCY'

const verbose = process.argv.includes('--verbose')

// Quiz axes — kept in sync with QuizStepper's options.
const CITIES_TO_TEST = [
  'Jerusalem', 'Tel Aviv', 'Beit Shemesh', "Modi'in", 'Tzur Hadassah',
  'Haifa', 'Herzliya', "Ra'anana", 'Netanya', 'Petach Tikva', 'Givat Shmuel',
  'Zichron Yaakov', 'Caesarea', 'flexible',
]
const FOCUS = ['atmosphere', 'food-drink', 'activity', 'outdoors']
const SERIOUSNESS = ['just-met', 'getting-to-know', 'getting-serious']
const LENGTHS = ['short', 'medium', 'long', undefined] // undefined = skipped in quiz

// ── Fetch live data ────────────────────────────────────────────────────────

console.log('Fetching approved locations…')
const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
const { data: locations, error } = await client
  .from('locations')
  .select('id, name, name_he, slug, city, city_he, region, category, price, occasion, date_stage, kashrus, featured, status, lat, lng, maps_query, vibe_tags, energy_score, quietness_score, romantic_score, group_vs_intimate_score, conversation_score, best_time, duration_min, duration_max, business_status, confidence_score')
  .eq('status', 'approved')
if (error) { console.error('Supabase error:', error.message); process.exit(2) }
console.log(`  ${locations.length} approved locations\n`)

// ── Helpers ────────────────────────────────────────────────────────────────

const FOOD_CATS = new Set(['Cafes & Restaurants', 'Cafés & Restaurants'])
const ACTIVITY_CATS = new Set(['Activities & Experiences'])
const OUTDOORS_CATS = new Set(['Parks & Outdoors'])
const ATMOSPHERE_CATS = new Set(['Hotels & Lounges', 'Wineries'])
const CULTURE_CATS = new Set(['Museums & Culture'])

function stopCategory(stop) {
  return stop?.category || stop?._category || stop?._cat || null
}

// Stops on generated plans don't carry category — look it up by source_location_id.
function inflateStops(plan, locationsById) {
  return (plan.stops || []).map(s => {
    const src = s.source_location_id ? locationsById.get(s.source_location_id) : null
    return {
      name: s.name_en,
      city: s._city || src?.city || plan.city,
      category: src?.category || null,
      lat: s.lat ?? src?.lat ?? null,
      lng: s.lng ?? src?.lng ?? null,
      id: src?.id ?? null,
    }
  })
}

function classifyPlan(plan, answers, locationsById) {
  const stops = inflateStops(plan, locationsById)
  const reasons = []
  const checks = {
    cityOk: true,
    flowOk: true,
    distOk: true,
    dupOk: true,
    focusOk: true,
    dataOk: true,
  }

  // 1. City coherence (only when user picked a real city)
  if (answers.city && answers.city !== 'flexible') {
    const wrongCity = stops.find(s => s.city && s.city !== 'Various' && s.city !== answers.city)
    if (wrongCity) { checks.cityOk = false; reasons.push(`stop in ${wrongCity.city} not ${answers.city}`) }
  }

  // 2. Flow warnings — anything in compose.flowWarnings is a soft fail
  const warns = plan._flowWarnings || []
  const severe = warns.filter(w => /energy_swing|intimacy|cross_city|night_only|too_long|zigzag/.test(w))
  if (severe.length >= 2) { checks.flowOk = false; reasons.push(`severe flow: ${severe.join(',')}`) }

  // 3. Leg distances — anything >6km is suspicious for an evening date
  const legs = (plan._compose?.legs) || []
  const farLeg = legs.find(l => l.kmFromPrev != null && l.kmFromPrev > 6)
  if (farLeg) { checks.distOk = false; reasons.push(`leg ${farLeg.kmFromPrev.toFixed(1)}km > 6`) }

  // 4. Duplicate / near-duplicate stops (same id OR same name)
  const idSet = new Set()
  const nameSet = new Set()
  for (const s of stops) {
    if (s.id != null) {
      if (idSet.has(s.id)) { checks.dupOk = false; reasons.push(`dup stop id`); break }
      idSet.add(s.id)
    }
    if (s.name) {
      const key = s.name.trim().toLowerCase()
      if (nameSet.has(key)) { checks.dupOk = false; reasons.push(`dup stop name`); break }
      nameSet.add(key)
    }
  }

  // 5. Focus alignment — does ANY stop honor the user's stated focus?
  const cats = stops.map(stopCategory)
  const matchesFocus = (focus) => {
    if (focus === 'food-drink')   return cats.some(c => FOOD_CATS.has(c))
    if (focus === 'activity')     return cats.some(c => ACTIVITY_CATS.has(c) || CULTURE_CATS.has(c))
    if (focus === 'outdoors')     return cats.some(c => OUTDOORS_CATS.has(c))
    if (focus === 'atmosphere')   return cats.some(c => ATMOSPHERE_CATS.has(c) || FOOD_CATS.has(c)) // food can carry atmosphere
    return true
  }
  if (plan.source_type === 'generated-location' && !matchesFocus(answers.focus)) {
    checks.focusOk = false
    reasons.push(`stops [${cats.filter(Boolean).join(',')}] don't match focus=${answers.focus}`)
  }

  // 6. Data integrity — names present, coords present where claimed
  if (stops.some(s => !s.name)) { checks.dataOk = false; reasons.push('empty stop name') }
  if (plan.city && stops.some(s => s.city === 'Various') && plan.city !== 'Various') {
    // Plan claims a city but contains a Various row — already filtered by buildSupportStops,
    // but check anyway in case curated plans embed Various stops.
    if (plan.source_type !== 'curated') {
      checks.dataOk = false
      reasons.push(`plan city=${plan.city} but stop tagged Various`)
    }
  }

  const pass = Object.values(checks).every(Boolean)
  return { pass, checks, reasons, stopCount: stops.length, stops, legs, warns }
}

// ── Inventory health per city ──────────────────────────────────────────────

function inventoryProfile(city) {
  const pool = locations.filter(l => l.city === city)
  const byCat = {}
  pool.forEach(l => { byCat[l.category] = (byCat[l.category] || 0) + 1 })
  return {
    total: pool.length,
    food:       (byCat['Cafes & Restaurants'] || 0) + (byCat['Cafés & Restaurants'] || 0),
    lounges:    byCat['Hotels & Lounges'] || 0,
    outdoors:   byCat['Parks & Outdoors'] || 0,
    activities: byCat['Activities & Experiences'] || 0,
    culture:    byCat['Museums & Culture'] || 0,
    wineries:   byCat['Wineries'] || 0,
  }
}

function focusFloor(inv, focus) {
  // The bare minimum a focus needs to even compose a plan
  if (focus === 'food-drink')  return inv.food >= 2
  if (focus === 'activity')    return inv.activities + inv.culture >= 1 && inv.food >= 1
  if (focus === 'outdoors')    return inv.outdoors >= 1 && (inv.food + inv.outdoors >= 2)
  if (focus === 'atmosphere')  return (inv.lounges + inv.wineries) >= 1 || inv.food >= 2
  return true
}

// ── Run the matrix ─────────────────────────────────────────────────────────

const locationsById = new Map(locations.map(l => [l.id, l]))
const results = []
let processed = 0

for (const city of CITIES_TO_TEST) {
  const inv = city === 'flexible' ? null : inventoryProfile(city)
  for (const seriousness of SERIOUSNESS) {
    for (const focus of FOCUS) {
      for (const length of LENGTHS) {
        processed++
        const answers = { city, seriousness, focus }
        if (length) answers.length = length

        const plans = getSmartMatchedPlans(DATE_PLANS, locations, answers, 2)
        const planCount = plans.length
        const inventoryWeak = inv && !focusFloor(inv, focus)

        if (!planCount) {
          results.push({
            answers,
            planCount: 0,
            inventoryWeak,
            verdict: inventoryWeak ? 'inventory-gap' : 'no-plans',
            reasons: inventoryWeak ? ['inventory below floor for focus'] : ['engine returned 0 plans'],
          })
          continue
        }

        const top = plans[0]
        const cls = classifyPlan(top, answers, locationsById)
        let verdict
        if (cls.pass) {
          verdict = top._cityMismatch ? 'pass-with-fallback' : 'pass'
        } else if (inventoryWeak && !cls.checks.cityOk) {
          verdict = 'inventory-gap'
        } else if (!cls.checks.cityOk || !cls.checks.distOk || !cls.checks.dupOk || !cls.checks.focusOk || !cls.checks.dataOk) {
          verdict = 'code-bug'
        } else {
          verdict = 'soft-fail'
        }

        results.push({
          answers,
          planCount,
          inventoryWeak,
          verdict,
          stopCount: cls.stopCount,
          city: top.city,
          source: top._compose?.engine || top.source_type,
          mismatch: Boolean(top._cityMismatch),
          warns: cls.warns,
          reasons: cls.reasons,
          stops: verbose ? cls.stops.map(s => `${s.name} [${s.city}/${s.category}]`) : undefined,
        })
      }
    }
  }
}

// ── Summarize ──────────────────────────────────────────────────────────────

const tally = {}
for (const r of results) tally[r.verdict] = (tally[r.verdict] || 0) + 1

console.log(`Processed ${processed} quiz combinations.\n`)
console.log('Verdict tally:')
Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v}`))

// Worst city × focus combinations
const cf = {}
for (const r of results) {
  const k = `${r.answers.city} × ${r.answers.focus}`
  if (!cf[k]) cf[k] = { total: 0, pass: 0, codeBug: 0, inventory: 0 }
  cf[k].total++
  if (r.verdict === 'pass' || r.verdict === 'pass-with-fallback') cf[k].pass++
  if (r.verdict === 'code-bug') cf[k].codeBug++
  if (r.verdict === 'inventory-gap' || r.verdict === 'no-plans') cf[k].inventory++
}
const worst = Object.entries(cf)
  .map(([k, v]) => ({ k, ...v, passRate: v.pass / v.total }))
  .sort((a, b) => a.passRate - b.passRate)
console.log('\nWorst (city × focus) combinations:')
worst.slice(0, 15).forEach(w => console.log(`  ${w.k.padEnd(36)} pass ${w.pass}/${w.total}  code ${w.codeBug}  inventory ${w.inventory}`))

// Code bug detail (most actionable)
const codeBugs = results.filter(r => r.verdict === 'code-bug')
if (codeBugs.length) {
  console.log(`\nCode bugs (${codeBugs.length}):`)
  // group by reason fingerprint
  const grouped = {}
  for (const b of codeBugs) {
    const key = b.reasons.join(' | ').slice(0, 80)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }
  Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([key, list]) => {
      console.log(`  [${list.length}] ${key}`)
      list.slice(0, 3).forEach(b => console.log(`        ${JSON.stringify(b.answers)}`))
    })
}

// ── Write reports ──────────────────────────────────────────────────────────

const outDir = resolve(__dirname, '..', 'reports')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const jsonPath = resolve(outDir, `plan-coverage-${stamp}.json`)
const mdPath   = resolve(outDir, `plan-coverage-latest.md`)

writeFileSync(jsonPath, JSON.stringify({ tally, results, worst, codeBugs }, null, 2))

const md = []
md.push(`# Plan coverage audit\n`)
md.push(`Generated: ${new Date().toISOString()}\n`)
md.push(`Locations in DB: ${locations.length}\n`)
md.push(`Combinations tested: ${processed}\n\n`)
md.push(`## Verdict tally\n`)
md.push('| Verdict | Count |\n| --- | --- |')
Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => md.push(`| ${k} | ${v} |`))
md.push(`\n## Worst city × focus combinations (lowest pass rate)\n`)
md.push('| Combo | Pass | Code bugs | Inventory | Total |\n| --- | --- | --- | --- | --- |')
worst.slice(0, 20).forEach(w => md.push(`| ${w.k} | ${w.pass} | ${w.codeBug} | ${w.inventory} | ${w.total} |`))
md.push(`\n## Code bugs\n`)
if (codeBugs.length === 0) md.push('_None._')
else {
  const grouped = {}
  for (const b of codeBugs) {
    const key = b.reasons.join(' | ')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }
  Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).forEach(([key, list]) => {
    md.push(`### ${key} (${list.length})`)
    list.slice(0, 5).forEach(b => md.push(`- \`${JSON.stringify(b.answers)}\` — top city=${b.city}, stops=${b.stopCount}`))
  })
}
writeFileSync(mdPath, md.join('\n'))

console.log(`\nReports written:\n  ${jsonPath}\n  ${mdPath}`)

// Exit code: non-zero only on code bugs (inventory is data work, not CI failure)
if (codeBugs.length > 0) process.exit(1)

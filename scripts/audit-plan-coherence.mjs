// Plan-coherence regression check.
//
// The composition engines (planRecommendations.js, planBuilder.js) use
// extensionless imports that Vite resolves but Node does not, so this
// script tests the *heuristics* directly via planCoherence.js. That's
// where every new rule lives (derived vibes, flow compatibility, time
// fit, validatePlanFlow), so regressions show up here.
//
// For each of the five Phase-6 persona presets, we:
//   1. Pull the same approved locations the app would see.
//   2. Filter to that persona's city/focus.
//   3. Build a representative 3-stop sequence from the top-scoring
//      locations per stop slot.
//   4. Run validatePlanFlow and report warnings.
//
// Usage:
//   node scripts/audit-plan-coherence.mjs
//   node scripts/audit-plan-coherence.mjs --verbose

import { createClient } from '@supabase/supabase-js'
import {
  deriveVibe,
  flowCompatibility,
  validatePlanFlow,
  buildComposeMetadata,
  distanceKm,
} from '../src/lib/planCoherence.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const ANON_KEY     = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZW5icGtneG5qcmtuZWJiaXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDU3NzIsImV4cCI6MjA5MjE4MTc3Mn0.qm-_69lIl9YN8-Ecrpj0Vd3LaxFbnCklNodcT2kJwCY'

const verbose = process.argv.includes('--verbose')

const PRESETS = [
  { label: 'Quiet romantic evening',  city: 'Jerusalem', sequence: ['Parks & Outdoors', 'Cafes & Restaurants', 'Hotels & Lounges'], length: 'long'   },
  { label: 'High-energy fun night',   city: 'Tel Aviv',  sequence: ['Activities & Experiences', 'Cafes & Restaurants', 'Hotels & Lounges'], length: 'medium' },
  { label: 'Casual first date',       city: 'flexible',  sequence: ['Cafes & Restaurants', 'Parks & Outdoors'], length: 'short' },
  { label: 'Activity-focused date',   city: "Modi'in",   sequence: ['Activities & Experiences', 'Cafes & Restaurants', 'Cafes & Restaurants'], length: 'medium' },
  { label: 'Quick dessert stop',      city: 'Jerusalem', sequence: ['Cafes & Restaurants', 'Cafes & Restaurants'], length: 'short' },
]

const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })

console.log('Fetching approved locations…')
const { data: locations, error } = await client
  .from('locations')
  .select('id, name, city, category, price, occasion, date_stage, lat, lng, vibe_tags, energy_score, quietness_score, romantic_score, group_vs_intimate_score, best_time, duration_min, duration_max')
  .eq('status', 'approved')

if (error) {
  console.error('Failed to fetch locations:', error.message)
  process.exit(2)
}
console.log(`  ${locations.length} approved locations`)

const curatorCovered = locations.filter(l =>
  l.energy_score != null || l.quietness_score != null || l.romantic_score != null || (l.vibe_tags || []).length
).length
console.log(`  curator coverage: ${curatorCovered}/${locations.length} rows (${Math.round(100 * curatorCovered / locations.length)}%)\n`)

function pickStops(city, sequence) {
  const cityPool = city && city !== 'flexible'
    ? locations.filter(l => l.city === city)
    : locations
  const used = new Set()
  const picked = []
  for (const cat of sequence) {
    const cand = cityPool.find(l => l.category === cat && !used.has(l.id))
    if (!cand) return picked
    used.add(cand.id)
    picked.push(cand)
  }
  return picked
}

let regressed = 0

for (const preset of PRESETS) {
  console.log(`── ${preset.label} (${preset.city})`)
  const stops = pickStops(preset.city, preset.sequence)
  if (stops.length < 2) {
    console.log(`   skipped — only ${stops.length} candidate location(s) for the desired sequence`)
    console.log('')
    continue
  }
  const warnings = validatePlanFlow(stops, { length: preset.length })
  const compose = buildComposeMetadata(stops, { engine: 'audit', templateUsed: preset.sequence.join('→'), length: preset.length })

  console.log(`   stops: ${stops.map(s => `${s.name} [${s.city}]`).join(' → ')}`)
  for (let i = 1; i < stops.length; i++) {
    const km = distanceKm(stops[i - 1], stops[i])
    const flow = flowCompatibility(stops[i - 1], stops[i])
    console.log(`     leg ${i}: ${km == null ? '?' : km.toFixed(1)} km · flow ${flow.delta >= 0 ? '+' : ''}${flow.delta} ${flow.reasons.length ? `(${flow.reasons.join(', ')})` : ''}`)
  }
  if (warnings.length === 0) {
    console.log('   ✓ no flow warnings')
  } else {
    console.log(`   ✗ warnings: ${warnings.join(', ')}`)
    regressed++
  }
  if (verbose) {
    compose.derivedVibes.forEach(v => {
      const tag = v.fromCurator ? 'CURATED' : 'derived'
      console.log(`     stop ${v.stopIndex + 1} vibe [${tag}]: ${JSON.stringify(v.vibe)}`)
    })
  }
  console.log('')
}

if (regressed > 0) {
  console.log(`\n${regressed} preset(s) produced flow warnings. Open AdminView → Plan Compose to inspect interactively.`)
  process.exit(1)
}
console.log('All presets produced warning-free synthetic plans.')

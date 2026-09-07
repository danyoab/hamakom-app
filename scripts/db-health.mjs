#!/usr/bin/env node
/**
 * One-command diagnosis of the production locations table.
 *
 *   node --env-file=.env scripts/db-health.mjs
 *
 * Uses the public anon key (same one the app ships), so it sees exactly what
 * users see. Reports row counts, enrichment fill rates (the hard gates depend
 * on business_status + lat/lng), and which bundled seed rows are missing.
 * If the request itself fails, the most common cause on the free tier is a
 * paused project — the app then silently falls back to bundled seed data.
 */
import { createClient } from '@supabase/supabase-js'
import { SEED_LOCATIONS } from '../src/data/locations.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!ANON_KEY) {
  console.error('Set VITE_SUPABASE_ANON_KEY in .env (Supabase → Settings → API → anon public)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')

console.log(`Project: ${SUPABASE_URL}\n`)

const started = Date.now()
const { data, error } = await supabase
  .from('locations')
  .select('id, name, city, status, lat, lng, business_status, kashrus, image_url, last_enriched_at, google_rating')
const ms = Date.now() - started

if (error) {
  console.error(`✗ Fetch failed after ${ms} ms: ${error.message}`)
  console.error('\nLikely causes:')
  console.error('  • Free-tier project PAUSED after inactivity → Supabase dashboard → Restore project')
  console.error('  • RLS policy changed so anon can no longer read approved rows')
  console.error('  • Wrong URL / anon key in .env')
  console.error('\nWhile this fails, the app runs on bundled seed data only.')
  process.exit(1)
}

const rows = data || []
const approved = rows.filter((r) => r.status === 'approved')
const enriched = approved.filter((r) => r.business_status === 'OPERATIONAL' && r.lat != null && r.lng != null)
const stale = approved.filter((r) => {
  const ts = r.last_enriched_at ? Date.parse(r.last_enriched_at) : NaN
  return Number.isNaN(ts) || Date.now() - ts > 35 * 24 * 60 * 60 * 1000
})

console.log(`✓ Fetched ${rows.length} rows in ${ms} ms (anon can see these statuses: ${[...new Set(rows.map((r) => r.status))].join(', ') || 'none'})`)
console.log(`\nApproved rows:                ${approved.length}`)
console.log(`  passing strict gates:       ${enriched.length} (${pct(enriched.length, approved.length)})  ← OPERATIONAL + coords`)
console.log(`  business_status null:       ${approved.filter((r) => r.business_status == null).length}`)
console.log(`  closed (temp/perm):         ${approved.filter((r) => /CLOSED/.test(r.business_status || '')).length}`)
console.log(`  missing coords:             ${approved.filter((r) => r.lat == null || r.lng == null).length}`)
console.log(`  enrichment older than 35d:  ${stale.length}`)
console.log(`  with kashrus:               ${approved.filter((r) => r.kashrus).length} (${pct(approved.filter((r) => r.kashrus).length, approved.length)})`)
console.log(`  with image_url:             ${approved.filter((r) => r.image_url).length} (${pct(approved.filter((r) => r.image_url).length, approved.length)})`)
console.log(`  with google_rating:         ${approved.filter((r) => r.google_rating != null).length}`)

const dbIds = new Set(rows.map((r) => r.id))
const dbNameCity = new Set(rows.map((r) => `${(r.name || '').toLowerCase()}|${(r.city || '').toLowerCase()}`))
const missing = SEED_LOCATIONS.filter(
  (s) => !dbIds.has(s.id) && !dbNameCity.has(`${s.name.toLowerCase()}|${(s.city || '').toLowerCase()}`)
)
console.log(`\nBundled seed rows:            ${SEED_LOCATIONS.length}`)
console.log(`  missing from the database:  ${missing.length}`)
if (missing.length) {
  for (const m of missing.slice(0, 15)) console.log(`    #${m.id}  ${m.name} (${m.city})`)
  if (missing.length > 15) console.log(`    … and ${missing.length - 15} more`)
  console.log('\nTo add them safely (never overwrites existing rows):')
  console.log('  node --env-file=.env scripts/sync-missing-locations.mjs')
}

if (enriched.length < approved.length * 0.8) {
  console.log('\n⚠ Fewer than 80% of approved rows pass the strict gates. Run enrichment:')
  console.log('  npm run enrich')
}

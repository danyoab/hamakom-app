#!/usr/bin/env node
/**
 * Adds bundled seed locations that are missing from the database — and
 * nothing else. Existing rows are never touched, so admin curation
 * (kashrut, photos, partner flags, enrichment) is preserved.
 *
 *   node --env-file=.env scripts/sync-missing-locations.mjs            # apply
 *   node --env-file=.env scripts/sync-missing-locations.mjs --dry-run  # preview
 *
 * Requires SUPABASE_SERVICE_KEY (Settings → API → service_role). After it
 * runs, `npm run enrich` fills coordinates + business_status for the new
 * rows so they pass the strict recommendation gates.
 *
 * (scripts/seed-locations.mjs is the older full upsert — it overwrites every
 * column of every row and will wipe curated data; prefer this script.)
 */
import { createClient } from '@supabase/supabase-js'
import { SEED_LOCATIONS } from '../src/data/locations.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const dryRun = process.argv.includes('--dry-run')

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY in .env (Settings → API → service_role — keep it secret)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const { data: existing, error } = await supabase.from('locations').select('id, name, city, status')
if (error) {
  console.error('Could not read locations:', error.message)
  process.exit(1)
}

const dbIds = new Set(existing.map((r) => r.id))
const dbNameCity = new Set(existing.map((r) => `${(r.name || '').toLowerCase()}|${(r.city || '').toLowerCase()}`))
const missing = SEED_LOCATIONS.filter(
  (s) => !dbIds.has(s.id) && !dbNameCity.has(`${s.name.toLowerCase()}|${(s.city || '').toLowerCase()}`)
)

console.log(`Database has ${existing.length} rows; bundled seed has ${SEED_LOCATIONS.length}.`)
console.log(`Missing from database: ${missing.length}`)
for (const m of missing) console.log(`  #${m.id}  ${m.name} (${m.city})`)

if (!missing.length) {
  console.log('\nNothing to do.')
  process.exit(0)
}
if (dryRun) {
  console.log('\n--dry-run: no changes made.')
  process.exit(0)
}

// A seed id can collide with a DB row that has the same id but a different
// venue (rows the admin added by hand). Those insert without an id so the
// sequence assigns a fresh one.
const rows = missing.map(({ id, ...rest }) => (dbIds.has(id) ? rest : { id, ...rest }))

let inserted = 0
for (let i = 0; i < rows.length; i += 50) {
  const batch = rows.slice(i, i + 50)
  const { error: insertError } = await supabase.from('locations').insert(batch)
  if (insertError) {
    console.error(`\nBatch ${i / 50 + 1} failed: ${insertError.message}`)
    console.error('Rows inserted before the failure are kept; re-run to continue.')
    process.exit(1)
  }
  inserted += batch.length
  console.log(`  inserted ${inserted}/${rows.length}`)
}

console.log(`\n✓ Added ${inserted} locations. Next: npm run enrich   (coords + business_status for the new rows)`)

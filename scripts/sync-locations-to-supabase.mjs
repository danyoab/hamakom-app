#!/usr/bin/env node
/**
 * Upserts every location from src/data/locations.json into Supabase.
 * Run after applying supabase/migrations/20260614000000_hamakom_core.sql.
 *
 *   node --env-file=.env scripts/sync-locations-to-supabase.mjs
 *
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
 * Safe to re-run: upserts by id, never deletes.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const locations = JSON.parse(readFileSync(join(root, 'src/data/locations.json'), 'utf8'))

const rows = locations.map((l) => ({
  id: l.id,
  name: l.name,
  name_he: l.name_he ?? null,
  city: l.city,
  city_he: l.city_he ?? null,
  category: l.category,
  occasion: l.occasion ?? [],
  price: l.price ?? null,
  date_stage: l.date_stage ?? [1],
  description: l.description ?? null,
  description_he: l.description_he ?? null,
  maps_query: l.maps_query ?? null,
  kashrus: l.kashrus ?? null,
  featured: l.featured ?? false,
  status: l.status ?? 'approved',
  image_url: l.image_url ?? null,
  rating: l.rating ?? null,
  hidden_gem: l.hidden_gem ?? false,
  notes: l.notes || null,
  lat: l.lat ?? null,
  lng: l.lng ?? null,
}))

console.log(`Upserting ${rows.length} locations…`)

const BATCH = 100
let done = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const { error } = await supabase.from('locations').upsert(batch, { onConflict: 'id' })
  if (error) {
    console.error(`Batch ${i}-${i + batch.length} failed:`, error.message)
    process.exit(1)
  }
  done += batch.length
  console.log(`  ${done}/${rows.length}`)
}

console.log('\n✓ Done. Run this once in the SQL editor so app-created rows get fresh ids:')
console.log("  select setval(pg_get_serial_sequence('public.locations','id'), (select max(id) from public.locations));")

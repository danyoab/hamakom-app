import { createClient } from '@supabase/supabase-js'
import { SEED_LOCATIONS } from '../src/data/locations.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var (Settings → API → service_role)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

console.log(`Seeding ${SEED_LOCATIONS.length} locations…`)

const { error } = await supabase
  .from('locations')
  .upsert(SEED_LOCATIONS, { onConflict: 'id' })

if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}

const { count } = await supabase
  .from('locations')
  .select('*', { count: 'exact', head: true })

console.log(`Done. ${count} rows in locations table.`)

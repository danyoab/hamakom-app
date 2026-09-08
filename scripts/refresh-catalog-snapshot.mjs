// Keep fallback venue IDs identical to the live public catalog. No service
// credential or internal location fields belong in this exported file.
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { fetchLocationCatalog, isDiscoverable } from '../src/lib/venueCatalog.js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const rows = await fetchLocationCatalog(db, { signal: AbortSignal.timeout(20000) })
if (!rows.length || !rows.some(isDiscoverable)) throw new Error('Refusing to replace the fallback with an empty catalog')
if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Duplicate catalog IDs')
console.log({ rows: rows.length, discoverable: rows.filter(isDiscoverable).length, write: process.argv.includes('--write') })
if (process.argv.includes('--write')) {
  const date = new Date().toISOString().slice(0, 10)
  writeFileSync('src/data/locations.js', `// Public catalog snapshot exported ${date}. IDs match the live database.\n// Export time is not a new venue-verification date; preserve last_enriched_at.\nexport const CATALOG_SNAPSHOT_DATE = '${date}'\nexport const SEED_LOCATIONS = ${JSON.stringify(rows, null, 2)}\n`)
}

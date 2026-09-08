// Populate researched public details without replacing curator edits.
// Dry-run by default. --apply writes only missing fields and the researched
// Beit Shemesh Greg branch if it does not already exist.
import { createClient } from '@supabase/supabase-js'
import { SEED_LOCATIONS } from '../src/data/locations.js'
import { enrichCatalog } from '../src/data/venueDetails.js'
import { normalizeLocation, PUBLIC_LOCATION_FIELDS } from '../src/lib/venueCatalog.js'

const apply = process.argv.includes('--apply')
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const result = await db.from('locations').select('*').order('id')
if (result.error) throw new Error(result.error.code)
const rows = result.data
const greg = rows.find(r => normalizeLocation(r).city === 'Beit Shemesh' && /greg/i.test(r.name))
if (!greg) {
  const source = SEED_LOCATIONS.find(r => r.city === 'Beit Shemesh' && /greg/i.test(r.name))
  if (!source) throw new Error('The researched Greg branch is missing from the local catalog')
  const candidate = Object.fromEntries(Object.entries(enrichCatalog([source])[0]).filter(([key]) => key !== 'id' && PUBLIC_LOCATION_FIELDS.includes(key)))
  candidate.slug = 'cafe-greg-beit-shemesh'
  console.log(`${apply ? 'Adding' : 'Would add'} ${candidate.name} with a database-assigned ID`)
  if (apply) {
    const added = await db.from('locations').insert(candidate).select('id,name,city')
    if (added.error) throw new Error(`Insert failed: ${added.error.code}`)
    console.log(added.data)
  }
}
for (const row of rows) {
  const enriched = enrichCatalog([normalizeLocation(row)])[0]
  const patch = Object.fromEntries(Object.entries(enriched).filter(([key, value]) => PUBLIC_LOCATION_FIELDS.includes(key) && row[key] == null && value != null))
  if (!Object.keys(patch).length) continue
  console.log(`${apply ? 'Filling' : 'Would fill'} ${row.id} ${row.name}: ${Object.keys(patch).join(', ')}`)
  if (apply) {
    const saved = await db.from('locations').update(patch).eq('id', row.id)
    if (saved.error) throw new Error(`Update ${row.id} failed: ${saved.error.code}`)
  }
}

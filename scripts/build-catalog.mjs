import { createClient } from '@supabase/supabase-js'
import { SEED_LOCATIONS } from '../src/data/locations.js'
import { enrichCatalog } from '../src/data/venueDetails.js'
import { fetchLocationCatalog, isDiscoverable, normalizeLocation } from '../src/lib/venueCatalog.js'

export async function loadBuildCatalog() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (url && key) {
    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      const rows = await fetchLocationCatalog(client, { signal: AbortSignal.timeout(12000) })
      return enrichCatalog(rows).filter(isDiscoverable)
    } catch (error) {
      console.warn(`Catalog refresh unavailable; building with bundled public places. ${error.message}`)
    }
  }
  return enrichCatalog(SEED_LOCATIONS.map(normalizeLocation)).filter(isDiscoverable)
}

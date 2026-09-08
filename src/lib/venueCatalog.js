import { canonicalCity } from './planGates.js'

// This allowlist also defines the database view. Internal notes, business
// contacts, manual-edit records and curator identities are never public data.
export const PUBLIC_LOCATION_FIELDS = 'id,slug,name,name_he,city,city_he,region,category,occasion,price,date_stage,description,description_he,maps_query,kashrus,featured,status,image_url,lat,lng,business_status,formatted_address,phone,website,opening_hours,last_enriched_at,google_rating,google_place_id,avg_rating,review_count,is_partner,partner_tier,reservation_url,kashrut_status,kashrut_authority,kashrut_certificate_expiry,kashrut_last_verified_at,kashrut_verification_source,kashrut_level,vibe_tags,indoor_outdoor,best_time,weather_fit,romantic_score,conversation_score,energy_score,quietness_score,activity_vs_food_score,group_vs_intimate_score,duration_min,duration_max,confidence_score,menu_url,menu_scope,menu_checked_at,dietary_options,dietary_source_url,dietary_scope,dietary_checked_at,food_type,details_source_url,details_checked_at'.split(',')

export function publicLocation(loc) {
  return Object.fromEntries(PUBLIC_LOCATION_FIELDS.filter(k => Object.hasOwn(loc, k)).map(k => [k, loc[k]]))
}

export function canonicalCategory(value = '') {
  const c = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (/caf|restaurant/.test(c)) return 'Cafés & Restaurants'
  return value.trim()
}

export function normalizeLocation(loc) {
  return {
    ...loc,
    city: canonicalCity(loc.city),
    category: canonicalCategory(loc.category),
    occasion: Array.isArray(loc.occasion) ? loc.occasion : [],
    date_stage: (Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]).filter(Boolean).map(Number),
  }
}

// Discovery needs a named, approved place, not routing coordinates. Unknown
// availability is disclosed in the UI; a known closure is never recommended.
export function isDiscoverable(loc) {
  return Boolean(loc?.id != null && loc.name?.trim() && loc.city && !['Various', 'Home'].includes(loc.city)
    && loc.category && loc.status === 'approved'
    && !['CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(loc.business_status))
}

export function catalogSearch(loc, query) {
  const normalize = (v) => String(v || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’'-]/g, '').replace(/\s+/g, ' ').trim()
  const q = normalize(query)
  if (!q) return true
  return [loc.name, loc.name_he, loc.city, loc.city_he, loc.formatted_address, loc.category,
    canonicalCity(query) === loc.city ? query : ''].some(v => normalize(v).includes(q))
}

// Fetch all pages; a single select silently truncates at the server's row cap.
// Do not merge seed rows into a successful response: that can resurrect removed
// or rejected venues. An empty successful response is authoritative too.
export async function fetchLocationCatalog(client, { signal, pageSize = 500 } = {}) {
  const rows = []
  let table = 'public_location_catalog'
  for (let from = 0; ; from += pageSize) {
    let query = client.from(table).select('*')
    if (table === 'locations') query = query.eq('status', 'approved')
    query = query.order('id').range(from, from + pageSize - 1)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    // Compatibility until the public-view migration is deployed. Never fall
    // back for permission failures or network errors.
    if (from === 0 && table === 'public_location_catalog' && ['PGRST205', '42P01'].includes(error?.code)) {
      table = 'locations'; from = -pageSize; continue
    }
    if (error) throw new Error(error.message || 'Could not refresh places')
    if (!Array.isArray(data)) throw new Error('Invalid catalog response')
    rows.push(...data.map(row => publicLocation(table === 'public_location_catalog' ? row.venue || row : row)))
    if (data.length < pageSize) break
  }
  return rows.map(normalizeLocation)
}

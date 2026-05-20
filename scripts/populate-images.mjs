/**
 * populate-images.mjs
 *
 * Fetches a photo from Google Places API for every location that has no image_url,
 * uploads it to Supabase Storage, and writes the public URL back to the database.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=<service_role_key> GOOGLE_PLACES_KEY=<api_key> node scripts/populate-images.mjs
 *
 * Optional flags:
 *   --dry-run       Print what would happen without making any changes
 *   --limit=50      Only process the first N locations (useful for testing)
 *   --city=Jerusalem  Only process locations in a specific city
 *
 * Requirements:
 *   - Google Places API (New) enabled on your Google Cloud project
 *   - Supabase Storage bucket named "location-images" (public)
 *   - npm install node-fetch (or Node 18+ built-in fetch)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMIT = (() => { const f = args.find(a => a.startsWith('--limit=')); return f ? parseInt(f.split('=')[1]) : null })()
const CITY_FILTER = (() => { const f = args.find(a => a.startsWith('--city=')); return f ? f.split('=')[1] : null })()
const DELAY_MS = 200  // polite delay between API calls

// ── Validation ──────────────────────────────────────────────────────────────
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_SERVICE_KEY')
  console.error('    Get it from: Supabase dashboard → Settings → API → service_role')
  process.exit(1)
}
if (!GOOGLE_KEY) {
  console.error('❌  Missing GOOGLE_PLACES_KEY')
  console.error('    Get one at: console.cloud.google.com → APIs → Places API (New)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function searchPlace(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.photos,places.displayName',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'en',
      maxResultCount: 1,
    }),
  })
  if (!res.ok) throw new Error(`Places search failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.places?.[0] || null
}

async function fetchPhoto(photoName) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Photo fetch failed: ${res.status}`)
  const data = await res.json()
  // Returns { photoUri: "https://..." }
  if (!data.photoUri) throw new Error('No photoUri in response')
  // Fetch the actual image bytes
  const imgRes = await fetch(data.photoUri)
  if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`)
  const buffer = await imgRes.arrayBuffer()
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  return { buffer, contentType }
}

async function uploadToStorage(locationId, buffer, contentType) {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const path = `${locationId}.${ext}`
  const { error } = await supabase.storage
    .from('location-images')
    .upload(path, buffer, { upsert: true, contentType })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from('location-images').getPublicUrl(path)
  return publicUrl
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`\n🌟 HaMakom image populator${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

// Fetch locations without images
let query = supabase
  .from('locations')
  .select('id, name, city, maps_query, image_url')
  .is('image_url', null)
  .eq('status', 'approved')
  .order('featured', { ascending: false })

if (CITY_FILTER) query = query.eq('city', CITY_FILTER)
if (LIMIT) query = query.limit(LIMIT)

const { data: locations, error: fetchError } = await query

if (fetchError) {
  console.error('❌  Failed to fetch locations:', fetchError.message)
  process.exit(1)
}

if (!locations?.length) {
  console.log('✅  All locations already have images.')
  process.exit(0)
}

console.log(`Found ${locations.length} locations without images${CITY_FILTER ? ` in ${CITY_FILTER}` : ''}.\n`)

let success = 0, skipped = 0, failed = 0

for (const loc of locations) {
  const searchQuery = loc.maps_query || `${loc.name}, ${loc.city}, Israel`
  process.stdout.write(`  ${loc.name} (${loc.city}) ... `)

  if (DRY_RUN) {
    console.log(`would search: "${searchQuery}"`)
    continue
  }

  try {
    // 1. Search for the place
    const place = await searchPlace(searchQuery)
    if (!place?.photos?.length) {
      console.log('⚠  no photos found')
      skipped++
      await sleep(DELAY_MS)
      continue
    }

    // 2. Fetch the first photo
    const { buffer, contentType } = await fetchPhoto(place.photos[0].name)

    // 3. Upload to Supabase Storage
    const publicUrl = await uploadToStorage(loc.id, buffer, contentType)

    // 4. Update the location record
    const { error: updateError } = await supabase
      .from('locations')
      .update({ image_url: publicUrl })
      .eq('id', loc.id)

    if (updateError) throw new Error(updateError.message)

    console.log(`✅  done`)
    success++
  } catch (err) {
    console.log(`❌  ${err.message}`)
    failed++
  }

  await sleep(DELAY_MS)
}

console.log(`
── Results ──────────────────────────────
  ✅  Success:  ${success}
  ⚠   Skipped:  ${skipped}  (no photo found on Google)
  ❌  Failed:   ${failed}
─────────────────────────────────────────
`)

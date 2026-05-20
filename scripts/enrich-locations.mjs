/**
 * enrich-locations.mjs
 *
 * For each location, calls Google Places API (New) to pull:
 *   - lat / lng (precise coordinates)
 *   - opening_hours (weekly schedule + "open now" data)
 *   - phone number
 *   - website
 *   - google_rating (1–5)
 *   - google_price_level (1–4)
 *   - slug (generated from name if missing)
 *   - name_he / city_he (Hebrew from Google if missing)
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-locations.mjs
 *
 * Optional flags:
 *   --dry-run          Print results without writing to DB
 *   --limit=20         Only process N locations
 *   --city=Jerusalem   Only process a specific city
 *   --missing-only     Only update locations missing lat/lng (default behaviour)
 *   --force            Re-fetch even locations that already have coordinates
 *   --slugs-only       Only generate missing slugs, skip API calls
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY
const DELAY_MS = 250

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN     = args.includes('--dry-run')
const FORCE       = args.includes('--force')
const SLUGS_ONLY  = args.includes('--slugs-only')
const LIMIT       = (() => { const f = args.find(a => a.startsWith('--limit='));  return f ? parseInt(f.split('=')[1]) : null })()
const CITY_FILTER = (() => { const f = args.find(a => a.startsWith('--city='));   return f ? f.split('=')[1] : null })()

// ── Validation ────────────────────────────────────────────────────────────────
if (!SUPABASE_SERVICE_KEY) { console.error('❌  Missing SUPABASE_SERVICE_KEY'); process.exit(1) }
if (!SLUGS_ONLY && !GOOGLE_KEY) { console.error('❌  Missing GOOGLE_PLACES_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[''״׳]/g, '')
    .replace(/[^a-z0-9֐-׿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function fetchPlaceData(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': [
        'places.location',
        'places.regularOpeningHours',
        'places.internationalPhoneNumber',
        'places.websiteUri',
        'places.rating',
        'places.priceLevel',
        'places.displayName',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'he',
      maxResultCount: 1,
    }),
  })

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.places?.[0] || null
}

function parsePriceLevel(level) {
  const map = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4,
  }
  return map[level] ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n🌟 HaMakom location enricher${DRY_RUN ? ' (DRY RUN)' : ''}${SLUGS_ONLY ? ' — slugs only' : ''}\n`)

let query = supabase
  .from('locations')
  .select('id, name, name_he, city, city_he, maps_query, slug, lat, status')
  .eq('status', 'approved')
  .order('featured', { ascending: false })

if (!FORCE && !SLUGS_ONLY) query = query.is('lat', null)
if (CITY_FILTER) query = query.eq('city', CITY_FILTER)
if (LIMIT) query = query.limit(LIMIT)

const { data: locations, error } = await query
if (error) { console.error('❌  Fetch failed:', error.message); process.exit(1) }

if (!locations?.length) {
  console.log('✅  Nothing to enrich.')
  process.exit(0)
}

console.log(`Found ${locations.length} locations to process.\n`)

const stats = { success: 0, skipped: 0, failed: 0, slugsAdded: 0 }

for (const loc of locations) {
  const searchQuery = loc.maps_query || `${loc.name}, ${loc.city}, Israel`
  process.stdout.write(`  ${loc.name} (${loc.city}) ... `)

  const patch = {}

  // Generate slug if missing
  if (!loc.slug) {
    patch.slug = slugify(`${loc.name}-${loc.city}`)
    stats.slugsAdded++
  }

  if (SLUGS_ONLY) {
    if (Object.keys(patch).length) {
      if (!DRY_RUN) await supabase.from('locations').update(patch).eq('id', loc.id)
      console.log(`slug → ${patch.slug}`)
    } else {
      console.log('slug ok')
    }
    continue
  }

  // Fetch from Google Places
  try {
    const place = await fetchPlaceData(searchQuery)

    if (!place) {
      console.log('⚠  not found on Google')
      if (Object.keys(patch).length && !DRY_RUN) {
        await supabase.from('locations').update(patch).eq('id', loc.id)
      }
      stats.skipped++
      await sleep(DELAY_MS)
      continue
    }

    // Coordinates
    if (place.location) {
      patch.lat = place.location.latitude
      patch.lng = place.location.longitude
    }

    // Opening hours — store full structured data
    if (place.regularOpeningHours) {
      patch.opening_hours = {
        periods: place.regularOpeningHours.periods || [],
        weekday_text: place.regularOpeningHours.weekdayDescriptions || [],
      }
    }

    // Contact
    if (place.internationalPhoneNumber) patch.phone = place.internationalPhoneNumber
    if (place.websiteUri) patch.website = place.websiteUri

    // Ratings
    if (place.rating) patch.google_rating = Math.round(place.rating * 10) / 10
    if (place.priceLevel) {
      const parsed = parsePriceLevel(place.priceLevel)
      if (parsed !== null) patch.google_price_level = parsed
    }

    // Hebrew name from Google if missing (search was in Hebrew mode)
    if (!loc.name_he && place.displayName?.text) {
      patch.name_he = place.displayName.text
    }

    const summary = [
      patch.lat ? `📍 ${patch.lat.toFixed(4)},${patch.lng.toFixed(4)}` : null,
      patch.opening_hours ? `🕐 hours` : null,
      patch.phone ? `📞` : null,
      patch.website ? `🌐` : null,
      patch.google_rating ? `⭐ ${patch.google_rating}` : null,
      patch.name_he && !loc.name_he ? `🔤 he` : null,
    ].filter(Boolean).join(' ')

    if (!DRY_RUN) {
      const { error: updateError } = await supabase.from('locations').update(patch).eq('id', loc.id)
      if (updateError) throw new Error(updateError.message)
    }

    console.log(`✅  ${summary || 'no new data'}`)
    stats.success++
  } catch (err) {
    console.log(`❌  ${err.message}`)
    stats.failed++
  }

  await sleep(DELAY_MS)
}

console.log(`
── Results ──────────────────────────────
  ✅  Enriched: ${stats.success}
  ⚠   Skipped:  ${stats.skipped}  (not found on Google)
  ❌  Failed:   ${stats.failed}
  🔤  Slugs:    ${stats.slugsAdded} generated
─────────────────────────────────────────
`)

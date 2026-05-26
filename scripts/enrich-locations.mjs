/**
 * enrich-locations.mjs — Google Places enrichment pipeline
 *
 * For each location, calls Google Places API (New) to populate:
 *   - google_place_id, business_status, formatted_address
 *   - lat / lng
 *   - opening_hours, phone, website
 *   - google_rating, google_price_level
 *   - photo_refs (Places API photo names — resolve to URLs in app)
 *   - name_he / city_he (when missing)
 *   - confidence_score, verification_status, missing_fields, last_enriched_at
 *
 * Manual edits are respected: any field name listed in `manual_edits.fields`
 * is preserved and NOT overwritten by the API. Admin UI should append to that
 * array whenever a curator edits a field.
 *
 * Resilience:
 *   - checkpoint file at logs/enrichment-checkpoint.json — resumes after crash
 *   - exponential backoff retry on 429 / 5xx (3 attempts)
 *   - writes run summary to enrichment_runs + failures to enrichment_failures
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-locations.mjs
 *
 * Flags:
 *   --dry-run              Print results without writing
 *   --limit=20             Cap how many rows to process
 *   --city=Jerusalem       Filter to a city
 *   --stale-days=30        Re-enrich rows whose last_enriched_at is older than N days
 *   --force                Re-enrich even rows with fresh data
 *   --reset-checkpoint     Ignore prior checkpoint and start over
 *   --slugs-only           Only generate missing slugs, skip API calls
 *   --ids=1,2,3            Restrict to specific location ids
 */

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

const SUPABASE_URL = 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY
const DELAY_MS = 250
const MAX_RETRIES = 3
const CHECKPOINT_PATH = 'logs/enrichment-checkpoint.json'

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN          = args.includes('--dry-run')
const FORCE            = args.includes('--force')
const SLUGS_ONLY       = args.includes('--slugs-only')
const RESET_CHECKPOINT = args.includes('--reset-checkpoint')
const flag = (name) => { const f = args.find(a => a.startsWith(`--${name}=`)); return f ? f.split('=')[1] : null }
const LIMIT       = flag('limit') ? parseInt(flag('limit')) : null
const CITY_FILTER = flag('city')
const STALE_DAYS  = flag('stale-days') ? parseInt(flag('stale-days')) : 30
const IDS_FILTER  = flag('ids') ? flag('ids').split(',').map(n => parseInt(n.trim())) : null

if (!SUPABASE_SERVICE_KEY) { console.error('❌  Missing SUPABASE_SERVICE_KEY'); process.exit(1) }
if (!SLUGS_ONLY && !GOOGLE_KEY) { console.error('❌  Missing GOOGLE_PLACES_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[''״׳]/g, '')
    .replace(/[^a-z0-9֐-׿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function parsePriceLevel(level) {
  return { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[level] ?? null
}

async function loadCheckpoint() {
  if (RESET_CHECKPOINT || !existsSync(CHECKPOINT_PATH)) return { processed: [], runId: null }
  try { return JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8')) }
  catch { return { processed: [], runId: null } }
}

async function saveCheckpoint(state) {
  if (DRY_RUN) return
  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true })
  await writeFile(CHECKPOINT_PATH, JSON.stringify(state, null, 2))
}

async function fetchPlaceData(query) {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': [
            'places.id',
            'places.businessStatus',
            'places.formattedAddress',
            'places.location',
            'places.regularOpeningHours',
            'places.internationalPhoneNumber',
            'places.websiteUri',
            'places.rating',
            'places.priceLevel',
            'places.displayName',
            'places.photos',
          ].join(','),
        },
        body: JSON.stringify({ textQuery: query, languageCode: 'he', maxResultCount: 1 }),
      })

      if (res.status === 429 || res.status >= 500) {
        const backoff = 500 * 2 ** (attempt - 1)
        await sleep(backoff)
        lastError = new Error(`API ${res.status} (attempt ${attempt})`)
        continue
      }
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
      const data = await res.json()
      return data.places?.[0] || null
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) await sleep(500 * 2 ** (attempt - 1))
    }
  }
  throw lastError
}

function computeConfidence(row) {
  let s = 40
  if (row.lat != null && row.lng != null)                  s += 15
  if (row.image_url || row.photo_refs?.length)              s += 15
  if (row.google_rating != null)                            s += 10
  if (row.description && row.description.length >= 60)      s += 10
  if (row.slug)                                              s += 5
  if (row.name_he && row.city_he)                            s += 5
  if (row.business_status === 'CLOSED_PERMANENTLY')         s -= 40
  return Math.max(0, Math.min(100, s))
}

function computeMissing(row) {
  return [
    row.lat == null && 'lat',
    row.lng == null && 'lng',
    (!row.image_url && !row.photo_refs?.length) && 'image_url',
    row.google_rating == null && 'google_rating',
    !row.phone && 'phone',
    !row.website && 'website',
    !row.opening_hours && 'opening_hours',
    !row.google_place_id && 'google_place_id',
    !row.business_status && 'business_status',
    (!row.description || row.description.length < 60) && 'description_weak',
  ].filter(Boolean)
}

// `manual_edits.fields` lists field names the curator has set by hand.
// Strip those from the patch so we never overwrite manual work.
function respectManualEdits(patch, manualEdits) {
  const locked = new Set(manualEdits?.fields || [])
  if (!locked.size) return patch
  const filtered = {}
  for (const [k, v] of Object.entries(patch)) {
    if (!locked.has(k)) filtered[k] = v
  }
  return filtered
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(`\n🌟 HaMakom enrichment${DRY_RUN ? ' (DRY RUN)' : ''}${SLUGS_ONLY ? ' — slugs only' : ''}\n`)

const checkpoint = await loadCheckpoint()
if (checkpoint.processed.length) console.log(`↩  Resuming — ${checkpoint.processed.length} already done`)

// Build query
let q = supabase
  .from('locations')
  .select('id, name, name_he, city, city_he, maps_query, slug, lat, lng, image_url, photo_refs, description, status, google_rating, google_place_id, business_status, phone, website, opening_hours, last_enriched_at, manual_edits')
  .eq('status', 'approved')
  .order('featured', { ascending: false })
  .order('id', { ascending: true })

if (IDS_FILTER) {
  q = q.in('id', IDS_FILTER)
} else if (!FORCE && !SLUGS_ONLY) {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString()
  // pull rows never enriched OR stale
  q = q.or(`last_enriched_at.is.null,last_enriched_at.lt.${cutoff}`)
}
if (CITY_FILTER) q = q.eq('city', CITY_FILTER)
if (LIMIT) q = q.limit(LIMIT)

const { data: locations, error } = await q
if (error) { console.error('❌  Fetch failed:', error.message); process.exit(1) }

const todo = locations.filter(l => !checkpoint.processed.includes(l.id))
if (!todo.length) { console.log('✅  Nothing to enrich.'); process.exit(0) }
console.log(`Found ${todo.length} location(s) to process.\n`)

// Open run row
let runId = checkpoint.runId
if (!DRY_RUN && !runId) {
  const { data: run } = await supabase.from('enrichment_runs')
    .insert({ source: SLUGS_ONLY ? 'slugs' : 'google_places' })
    .select('id').single()
  runId = run?.id
  checkpoint.runId = runId
}

const stats = { success: 0, skipped: 0, failed: 0, closed: 0, slugsAdded: 0 }

for (const loc of todo) {
  const query = loc.maps_query || `${loc.name}, ${loc.city}, Israel`
  process.stdout.write(`  [${loc.id}] ${loc.name} (${loc.city}) ... `)

  let patch = {}
  if (!loc.slug) { patch.slug = slugify(`${loc.name}-${loc.city}`); stats.slugsAdded++ }

  if (SLUGS_ONLY) {
    if (Object.keys(patch).length) {
      if (!DRY_RUN) await supabase.from('locations').update(patch).eq('id', loc.id)
      console.log(`slug → ${patch.slug}`)
    } else { console.log('slug ok') }
    checkpoint.processed.push(loc.id); await saveCheckpoint(checkpoint); continue
  }

  try {
    const place = await fetchPlaceData(query)
    if (!place) {
      console.log('⚠  not found on Google')
      patch.verification_status = 'unverified'
      patch.last_enriched_at = new Date().toISOString()
      if (!DRY_RUN) {
        await supabase.from('locations').update(respectManualEdits(patch, loc.manual_edits)).eq('id', loc.id)
        if (runId) await supabase.from('enrichment_failures').insert({ run_id: runId, location_id: loc.id, reason: 'not_found_on_google' })
      }
      stats.skipped++
      checkpoint.processed.push(loc.id); await saveCheckpoint(checkpoint)
      await sleep(DELAY_MS); continue
    }

    // Identity / verification
    if (place.id)                patch.google_place_id    = place.id
    if (place.businessStatus)    patch.business_status    = place.businessStatus
    if (place.formattedAddress)  patch.formatted_address  = place.formattedAddress

    // Coordinates
    if (place.location) { patch.lat = place.location.latitude; patch.lng = place.location.longitude }

    // Hours
    if (place.regularOpeningHours) {
      patch.opening_hours = {
        periods: place.regularOpeningHours.periods || [],
        weekday_text: place.regularOpeningHours.weekdayDescriptions || [],
      }
    }

    // Contact
    if (place.internationalPhoneNumber) patch.phone = place.internationalPhoneNumber
    if (place.websiteUri)               patch.website = place.websiteUri

    // Ratings
    if (place.rating)     patch.google_rating = Math.round(place.rating * 10) / 10
    if (place.priceLevel) { const p = parsePriceLevel(place.priceLevel); if (p !== null) patch.google_price_level = p }

    // Photos — store names, app resolves via /v1/{name}/media?key=...&maxHeightPx=...
    if (place.photos?.length) {
      patch.photo_refs = place.photos.slice(0, 5).map(p => p.name)
      if (place.photos[0]?.authorAttributions?.[0]) {
        const a = place.photos[0].authorAttributions[0]
        patch.image_attribution = `${a.displayName || ''}${a.uri ? ' (' + a.uri + ')' : ''}`.trim()
      }
    }

    // Hebrew name fallback
    if (!loc.name_he && place.displayName?.text) patch.name_he = place.displayName.text

    // Derived fields
    const merged = { ...loc, ...patch }
    patch.confidence_score    = computeConfidence(merged)
    patch.missing_fields      = computeMissing(merged)
    patch.verification_status = patch.business_status === 'CLOSED_PERMANENTLY' ? 'closed' : 'auto'
    patch.enrichment_source   = 'google_places'
    patch.last_enriched_at    = new Date().toISOString()

    if (patch.business_status === 'CLOSED_PERMANENTLY') stats.closed++

    const summary = [
      patch.google_place_id ? '🆔' : null,
      patch.business_status === 'CLOSED_PERMANENTLY' ? '🚫 CLOSED' : patch.business_status === 'OPERATIONAL' ? '🟢' : null,
      patch.lat ? `📍${patch.lat.toFixed(3)},${patch.lng.toFixed(3)}` : null,
      patch.photo_refs ? `📷×${patch.photo_refs.length}` : null,
      patch.google_rating ? `⭐${patch.google_rating}` : null,
      patch.opening_hours ? '🕐' : null,
      `conf:${patch.confidence_score}`,
    ].filter(Boolean).join(' ')

    if (!DRY_RUN) {
      const safePatch = respectManualEdits(patch, loc.manual_edits)
      const { error: upErr } = await supabase.from('locations').update(safePatch).eq('id', loc.id)
      if (upErr) throw new Error(upErr.message)
    }
    console.log(`✅ ${summary}`)
    stats.success++
  } catch (err) {
    console.log(`❌ ${err.message}`)
    stats.failed++
    if (!DRY_RUN && runId) {
      await supabase.from('enrichment_failures').insert({ run_id: runId, location_id: loc.id, reason: err.message.slice(0, 500) })
    }
  }

  checkpoint.processed.push(loc.id)
  await saveCheckpoint(checkpoint)
  await sleep(DELAY_MS)
}

// Close run row
if (!DRY_RUN && runId) {
  await supabase.from('enrichment_runs').update({
    finished_at: new Date().toISOString(),
    total_attempted: todo.length,
    succeeded: stats.success,
    failed: stats.failed,
    skipped: stats.skipped,
    closed_found: stats.closed,
  }).eq('id', runId)
}

console.log(`
── Results ──────────────────────────────
  ✅  Enriched:        ${stats.success}
  ⚠   Not found:       ${stats.skipped}
  🚫  Closed permanently: ${stats.closed}
  ❌  Failed:          ${stats.failed}
  🔤  Slugs:           ${stats.slugsAdded}
  Run ID: ${runId ?? '(dry-run)'}
─────────────────────────────────────────
Checkpoint: ${CHECKPOINT_PATH}
Tip: re-run to retry failures, or pass --reset-checkpoint to start over.
`)

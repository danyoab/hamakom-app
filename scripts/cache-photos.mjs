/**
 * cache-photos.mjs — resolve photo_refs[0] → cache to Supabase Storage → save image_url
 *
 * For every approved location that:
 *   - has photo_refs[0]
 *   - has no image_url yet (NULL or empty)
 *   - is not flagged CLOSED_PERMANENTLY
 *   - does not have 'image_url' in manual_edits.fields
 *
 * Calls the Google Places media endpoint server-side, downloads the bytes,
 * uploads them to the existing `location-images` bucket under the `cached/`
 * prefix (so admin uploads at `{id}.{ext}` are never overwritten), and
 * writes the public Storage URL back into image_url.
 *
 * Manual uploads at `location-images/{id}.{ext}` and externally curated URLs
 * are NEVER touched (filtered out by the SQL query).
 *
 * Usage:
 *   node --env-file=.env scripts/cache-photos.mjs               # full pass
 *   node --env-file=.env scripts/cache-photos.mjs --dry-run     # preview only, no writes
 *   node --env-file=.env scripts/cache-photos.mjs --limit=10
 *   node --env-file=.env scripts/cache-photos.mjs --ids=217,218
 *   node --env-file=.env scripts/cache-photos.mjs --reset-checkpoint
 *   node --env-file=.env scripts/cache-photos.mjs --max-height=1200
 *
 * Or via npm scripts:
 *   npm run cache:photos
 *   npm run cache:photos:dry
 */

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

const SUPABASE_URL         = 'https://kyenbpkgxnjrknebbiyr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_KEY           = process.env.GOOGLE_PLACES_KEY
const BUCKET               = 'location-images'
const PREFIX               = 'cached/'
const DELAY_MS             = 200
const MAX_RETRIES          = 3
const CHECKPOINT_PATH      = 'logs/photo-cache-checkpoint.json'

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN          = args.includes('--dry-run')
const RESET_CHECKPOINT = args.includes('--reset-checkpoint')
const flag = (name) => { const f = args.find(a => a.startsWith(`--${name}=`)); return f ? f.split('=')[1] : null }
const LIMIT      = flag('limit') ? parseInt(flag('limit')) : null
const MAX_HEIGHT = flag('max-height') ? parseInt(flag('max-height')) : 800
const IDS_FILTER = flag('ids') ? flag('ids').split(',').map(n => parseInt(n.trim())) : null

if (!SUPABASE_SERVICE_KEY) { console.error('❌  Missing SUPABASE_SERVICE_KEY'); process.exit(1) }
if (!GOOGLE_KEY)           { console.error('❌  Missing GOOGLE_PLACES_KEY');   process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

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

// Resolve a Places photo `name` (places/.../photos/...) to a real CDN URL.
// `skipHttpRedirect=true` makes the endpoint return JSON instead of 302ing.
async function resolvePhotoUri(photoName) {
  let lastErr
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `https://places.googleapis.com/v1/${encodeURI(photoName)}/media?maxHeightPx=${MAX_HEIGHT}&skipHttpRedirect=true&key=${GOOGLE_KEY}`
      const res = await fetch(url)
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * 2 ** (attempt - 1))
        lastErr = new Error(`media ${res.status}`)
        continue
      }
      if (!res.ok) throw new Error(`media ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      if (!data.photoUri) throw new Error('no photoUri in response')
      return data.photoUri
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES) await sleep(500 * 2 ** (attempt - 1))
    }
  }
  throw lastErr
}

async function downloadBytes(url) {
  let lastErr
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          await sleep(500 * 2 ** (attempt - 1))
          lastErr = new Error(`download ${res.status}`)
          continue
        }
        throw new Error(`download ${res.status}`)
      }
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      const buf = Buffer.from(await res.arrayBuffer())
      return { buf, contentType }
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES) await sleep(500 * 2 ** (attempt - 1))
    }
  }
  throw lastErr
}

function extFromMime(mime) {
  if (mime.includes('png'))  return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'jpg'
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(`\n📸 HaMakom photo cache${DRY_RUN ? ' (DRY RUN)' : ''} — maxHeight=${MAX_HEIGHT}\n`)

const checkpoint = await loadCheckpoint()
if (checkpoint.processed.length) console.log(`↩  Resuming — ${checkpoint.processed.length} already done`)

// Target query: only rows with empty image_url AND a photo_ref available.
// We do NOT update rows that already have any image_url — those are admin
// uploads or hand-curated external URLs, all considered locked.
let q = supabase
  .from('locations')
  .select('id, name, city, slug, image_url, photo_refs, manual_edits, business_status, missing_fields, confidence_score')
  .eq('status', 'approved')
  .or('image_url.is.null,image_url.eq.')
  .not('photo_refs', 'is', null)
  .order('id', { ascending: true })

if (IDS_FILTER) q = q.in('id', IDS_FILTER)
if (LIMIT)      q = q.limit(LIMIT)

const { data: rows, error } = await q
if (error) { console.error('❌  Fetch failed:', error.message); process.exit(1) }

// Filter in JS for things SQL can't easily express
const todo = rows.filter(r =>
  Array.isArray(r.photo_refs) && r.photo_refs.length > 0 &&
  r.business_status !== 'CLOSED_PERMANENTLY' &&
  !(r.manual_edits?.fields || []).includes('image_url') &&
  !checkpoint.processed.includes(r.id)
)

if (!todo.length) { console.log('✅  Nothing to cache.'); process.exit(0) }
console.log(`Found ${todo.length} location(s) to cache.\n`)

// Open run row in enrichment_runs (reuse existing log infrastructure)
let runId = checkpoint.runId
if (!DRY_RUN && !runId) {
  const { data: run, error: runErr } = await supabase
    .from('enrichment_runs')
    .insert({ source: 'photo_cache', notes: `maxHeight=${MAX_HEIGHT}` })
    .select('id').single()
  if (runErr) { console.error('⚠  Could not create run row:', runErr.message) }
  runId = run?.id
  checkpoint.runId = runId
  await saveCheckpoint(checkpoint)
}

const stats = { success: 0, skipped: 0, failed: 0 }

for (const loc of todo) {
  process.stdout.write(`  [${loc.id}] ${loc.name} (${loc.city}) ... `)
  const photoName = loc.photo_refs[0]

  try {
    const photoUri = await resolvePhotoUri(photoName)
    const { buf, contentType } = await downloadBytes(photoUri)
    const ext  = extFromMime(contentType)
    const path = `${PREFIX}${loc.id}.${ext}`

    if (DRY_RUN) {
      console.log(`would upload ${buf.length} bytes (${contentType}) → ${BUCKET}/${path}`)
      stats.success++
      continue
    }

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
      upsert: true,
      contentType,
      cacheControl: '604800', // 7 days at the edge; immutable in practice
    })
    if (upErr) throw new Error(`storage upload: ${upErr.message}`)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const patch = {
      image_url:        publicUrl,
      missing_fields:   (loc.missing_fields || []).filter(f => f !== 'image_url'),
      confidence_score: Math.min(100, (loc.confidence_score ?? 0) + 15),
    }
    const { error: dbErr } = await supabase.from('locations').update(patch).eq('id', loc.id)
    if (dbErr) throw new Error(`db update: ${dbErr.message}`)

    console.log(`✅ ${(buf.length / 1024).toFixed(0)}kb → ${path}`)
    stats.success++
    // Only checkpoint on success — failures stay out so a plain re-run retries them.
    checkpoint.processed.push(loc.id)
    await saveCheckpoint(checkpoint)
  } catch (err) {
    console.log(`❌ ${err.message}`)
    stats.failed++
    if (!DRY_RUN && runId) {
      await supabase.from('enrichment_failures').insert({
        run_id: runId,
        location_id: loc.id,
        reason: `photo_cache: ${err.message.slice(0, 400)}`,
      })
    }
  }

  await sleep(DELAY_MS)
}

if (!DRY_RUN && runId) {
  await supabase.from('enrichment_runs').update({
    finished_at: new Date().toISOString(),
    total_attempted: todo.length,
    succeeded: stats.success,
    failed: stats.failed,
    skipped: stats.skipped,
  }).eq('id', runId)
}

console.log(`
── Results ──────────────────────────────
  ✅  Cached:   ${stats.success}
  ❌  Failed:   ${stats.failed}
  Run ID: ${runId ?? '(dry-run)'}
─────────────────────────────────────────
Checkpoint: ${CHECKPOINT_PATH}
Tip: re-run to retry only the rows that failed (they're not in the checkpoint).
     Or run with --reset-checkpoint to recache everything that's still empty.
`)

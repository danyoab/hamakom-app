/**
 * geocode-plan-stops.mjs
 *
 * For every stop in src/data/datePlans.js that lacks lat/lng, geocode its
 * maps_query via Google Places Text Search and rewrite the file in place
 * with `lat` and `lng` fields injected next to maps_query.
 *
 * Usage:
 *   node --env-file=.env scripts/geocode-plan-stops.mjs
 *   node --env-file=.env scripts/geocode-plan-stops.mjs --force   # re-geocode even existing coords
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLANS_PATH = join(__dirname, '..', 'src', 'data', 'datePlans.js')
const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY

if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_PLACES_KEY')
  process.exit(1)
}

const FORCE = process.argv.includes('--force')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function geocode(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.location,places.displayName',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  })
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  const data = await res.json()
  const loc = data.places?.[0]?.location
  if (!loc) return null
  return { lat: loc.latitude, lng: loc.longitude }
}

const src = readFileSync(PLANS_PATH, 'utf8')

// Find every stop block (matches `{ ... maps_query: '...' ... }`) and inject lat/lng
// We do this with a regex on the maps_query line.

const stopRegex = /maps_query:\s*'([^']+)',?/g
const matches = [...src.matchAll(stopRegex)]
console.log(`Found ${matches.length} stops with maps_query`)

let edited = src
let success = 0, failed = 0, skipped = 0

for (const m of matches) {
  const query = m[1]
  const fullMatch = m[0]
  // Find the surrounding stop object to check if lat already present
  const idx = edited.indexOf(fullMatch)
  if (idx === -1) continue
  // Check only AFTER maps_query up to next stop boundary
  const after = edited.slice(idx + fullMatch.length, idx + fullMatch.length + 120)
  if (!FORCE && /^\s*lat:\s*[-0-9]/m.test(after)) {
    skipped++
    continue
  }

  process.stdout.write(`  ${query} ... `)
  try {
    const coords = await geocode(query)
    if (!coords) { console.log('no result'); failed++; await sleep(250); continue }
    const replacement = `maps_query: '${query}',\n        lat: ${coords.lat},\n        lng: ${coords.lng},`
    edited = edited.replace(fullMatch, replacement)
    console.log(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
    success++
  } catch (err) {
    console.log(`failed: ${err.message}`)
    failed++
  }
  await sleep(250)
}

writeFileSync(PLANS_PATH, edited)
console.log(`\nDone: ${success} geocoded, ${skipped} skipped (already had coords), ${failed} failed`)

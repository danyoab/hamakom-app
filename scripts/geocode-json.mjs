#!/usr/bin/env node
/**
 * Geocodes all locations in src/data/locations.json that are missing lat/lng.
 * Uses OpenStreetMap Nominatim (free, no API key required).
 *
 * Run from the project root:
 *   node scripts/geocode-json.mjs
 *
 * Then regenerate the fallback:
 *   node scripts/generate-fallback.mjs
 *
 * Nominatim rate limit: 1 req/sec — ~341 locations takes about 6 minutes.
 * Re-run to retry any that came back NOT FOUND.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const jsonPath = join(root, 'src/data/locations.json')

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=il`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HaMakomGeocoderScript/1.0 (admin@hamakom.app)' },
  })
  const data = await res.json()
  if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  return null
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const locations = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const missing = locations.filter(l => l.lat == null)
  console.log(`${missing.length} locations need geocoding (${locations.length - missing.length} already have coords)\n`)

  let success = 0, failed = 0

  for (const loc of missing) {
    const query = loc.maps_query || `${loc.name} ${loc.city} Israel`
    process.stdout.write(`[${loc.id}] ${loc.name} (${loc.city}) … `)

    const coords = await geocode(query)

    if (coords) {
      loc.lat = coords.lat
      loc.lng = coords.lng
      console.log(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
      success++
    } else {
      console.log('NOT FOUND')
      failed++
    }

    await sleep(1100) // Nominatim requires ≥1 sec between requests
  }

  writeFileSync(jsonPath, JSON.stringify(locations, null, 2) + '\n')
  console.log(`\n✓ Saved ${jsonPath}`)
  console.log(`Success: ${success} | Failed: ${failed}`)
  if (failed > 0) console.log('Re-run to retry failed entries (still have lat=null).')
  console.log('\nNext: node scripts/generate-fallback.mjs')
}

main().catch(e => { console.error(e); process.exit(1) })

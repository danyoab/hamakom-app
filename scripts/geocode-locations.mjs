#!/usr/bin/env node
/**
 * Geocodes all locations in Supabase that are missing lat/lng.
 * Uses OpenStreetMap Nominatim (free, no API key).
 *
 * Run once after the schema migration adds lat/lng columns:
 *   node scripts/geocode-locations.mjs
 *
 * Nominatim rate limit: 1 request/second.
 * With ~326 locations this takes about 6 minutes to complete.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY  // needs write access

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function geocode(mapsQuery) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapsQuery)}&format=json&limit=1&countrycodes=il`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HaMakomGeocoderScript/1.0 (admin@hamakom.app)' },
  })
  const data = await res.json()
  if (data?.[0]) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  }
  return null
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, city, maps_query, lat, lng')
    .is('lat', null)
    .order('id')

  if (error) { console.error('Fetch failed:', error.message); process.exit(1) }

  console.log(`Found ${locations.length} locations without coordinates`)

  let success = 0, failed = 0

  for (const loc of locations) {
    const query = loc.maps_query || `${loc.name} ${loc.city} Israel`
    process.stdout.write(`[${loc.id}] ${loc.name} (${loc.city}) ... `)

    const coords = await geocode(query)

    if (coords) {
      const { error: updateError } = await supabase
        .from('locations')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('id', loc.id)

      if (updateError) {
        console.log(`UPDATE FAILED: ${updateError.message}`)
        failed++
      } else {
        console.log(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        success++
      }
    } else {
      console.log('NOT FOUND')
      failed++
    }

    // Nominatim requires at least 1 second between requests
    await sleep(1100)
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`)
  console.log('Re-run to retry failed locations (they still have lat=null).')
}

main()

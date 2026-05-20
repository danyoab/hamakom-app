/**
 * download-city-images.mjs
 *
 * Downloads one hero photo per city from Google Places API
 * and saves them as static assets in public/city-images/
 *
 * Usage:
 *   node --env-file=.env scripts/download-city-images.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'city-images')
const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY

if (!GOOGLE_KEY) {
  console.error('❌  Missing GOOGLE_PLACES_KEY')
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })

function slugify(city) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Cities that actually have date plans — the ones shown in the quiz
const CITIES = [
  { name: 'Jerusalem',     query: 'Jerusalem Old City Israel beautiful' },
  { name: 'Tel Aviv',      query: 'Tel Aviv Rothschild Boulevard Israel' },
  { name: "Modi'in",       query: "Modi'in Israel city park" },
  { name: 'Beit Shemesh',  query: 'Beit Shemesh Israel' },
  { name: 'Tzur Hadassah', query: 'Tzur Hadassah Israel landscape' },
  { name: 'Haifa',         query: 'Haifa Bahai Gardens Israel' },
  { name: 'Herzliya',      query: 'Herzliya Marina Israel' },
  { name: 'Netanya',       query: 'Netanya beach Israel' },
  { name: "Ra'anana",      query: "Ra'anana park Israel" },
  { name: 'Eilat',         query: 'Eilat Red Sea Israel' },
  { name: 'Tiberias',      query: 'Tiberias Sea of Galilee Israel' },
  { name: 'Zichron Yaakov',query: 'Zichron Yaakov winery Israel' },
  { name: 'Caesarea',      query: 'Caesarea ancient harbour Israel' },
  { name: 'Mitzpe Ramon',  query: 'Mitzpe Ramon crater Israel' },
  { name: 'Dead Sea',      query: 'Dead Sea Israel floating' },
  { name: 'Beer Sheva',    query: 'Beer Sheva Israel' },
]

async function searchPlace(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.photos,places.displayName',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  })
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  const data = await res.json()
  return data.places?.[0] || null
}

async function downloadPhoto(photoName) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${GOOGLE_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Photo ref failed: ${res.status}`)
  const data = await res.json()
  if (!data.photoUri) throw new Error('No photoUri')
  const imgRes = await fetch(data.photoUri)
  if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`)
  return Buffer.from(await imgRes.arrayBuffer())
}

console.log(`\n🌆 Downloading city hero images\n`)

let success = 0, failed = 0

for (const city of CITIES) {
  const slug = slugify(city.name)
  const outPath = join(OUT_DIR, `${slug}.jpg`)
  process.stdout.write(`  ${city.name} ... `)

  try {
    const place = await searchPlace(city.query)
    if (!place?.photos?.length) { console.log('⚠  no photos'); failed++; continue }

    const buffer = await downloadPhoto(place.photos[0].name)
    writeFileSync(outPath, buffer)
    console.log(`✅  saved → city-images/${slug}.jpg`)
    success++
  } catch (err) {
    console.log(`❌  ${err.message}`)
    failed++
  }

  await sleep(300)
}

console.log(`\n── Done: ${success} saved, ${failed} failed ──\n`)

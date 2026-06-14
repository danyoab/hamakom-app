#!/usr/bin/env node
// Reads src/data/locations.json and writes src/data/locations.js (fallback).
// Strips the `notes` field (curator-only) before writing.
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src  = join(root, 'src/data/locations.json')
const dest = join(root, 'src/data/locations.js')

const locations = JSON.parse(readFileSync(src, 'utf8'))

const stripped = locations.map(({ notes: _notes, ...rest }) => rest)

const lines = stripped.map(loc => '  ' + JSON.stringify(loc) + ',')

const out = `// Auto-generated from src/data/locations.json — do not edit directly.
// Run: node scripts/generate-fallback.mjs

export const SEED_LOCATIONS = [
${lines.join('\n')}
]
`

writeFileSync(dest, out, 'utf8')
console.log(`✓ Written ${dest} (${stripped.length} locations)`)

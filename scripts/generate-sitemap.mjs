// Generates public/sitemap.xml with a URL per approved location.
// Run: node --env-file=.env scripts/generate-sitemap.mjs
// Falls back to the bundled seed data when Supabase env vars are absent.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadBuildCatalog } from './build-catalog.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://hamakom.app'

const locations = await loadBuildCatalog()

const staticUrls = [
  { loc: `${SITE}/new-york`, changefreq: 'weekly', priority: '0.9' },
  { loc: `${SITE}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE}/privacy`, changefreq: 'monthly', priority: '0.5' },
  { loc: `${SITE}/terms`, changefreq: 'monthly', priority: '0.5' },
  { loc: `${SITE}/delete-account`, changefreq: 'yearly', priority: '0.3' },
  { loc: `${SITE}/for-businesses`, changefreq: 'monthly', priority: '0.8' },
]

const locationUrls = locations.map((l) => ({
  loc: `${SITE}/location/${encodeURIComponent(l.slug || l.id)}`,
  changefreq: 'monthly',
  priority: '0.7',
  lastmod: l.last_enriched_at ? l.last_enriched_at.slice(0, 10) : undefined,
}))

const entries = [...staticUrls, ...locationUrls]
  .map((u) => [
    '  <url>',
    `    <loc>${u.loc}</loc>`,
    u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>` : null,
    `    <changefreq>${u.changefreq}</changefreq>`,
    `    <priority>${u.priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n'))
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`

writeFileSync(join(ROOT, 'public/sitemap.xml'), xml)
console.log(`Wrote public/sitemap.xml with ${entries.length ? staticUrls.length + locationUrls.length : 0} URLs`)

// Prerenders static HTML for each /location/<slug> page after vite build.
// Crawlers get real title, description, canonical, JSON-LD, and visible text
// without waiting for React. The SPA still boots from the same bundle.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SITE = 'https://hamakom.app'

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function loadApprovedLocations() {
  const url = (process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()

  if (url && key) {
    const fields = 'id,slug,name,name_he,city,city_he,description,description_he,category,image_url,kashrus'
    const res = await fetch(`${url}/rest/v1/locations?select=${fields}&status=eq.approved&order=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
    const locations = await res.json()
    console.log(`Prerender: fetched ${locations.length} approved locations from Supabase`)
    return locations
  }

  const { SEED_LOCATIONS } = await import(`file://${join(ROOT, 'src/data/locations.js').replace(/\\/g, '/')}`)
  const locations = SEED_LOCATIONS.filter((l) => l.status === 'approved')
  console.log(`Prerender: using ${locations.length} seed locations`)
  return locations
}

function locationCanonical(loc) {
  const key = loc.slug || loc.id
  return `${SITE}/location/${encodeURIComponent(key)}`
}

function buildJsonLd(loc, canonical) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: loc.name,
    description: loc.description || '',
    address: {
      '@type': 'PostalAddress',
      addressLocality: loc.city,
      addressCountry: 'IL',
    },
    url: canonical,
    ...(loc.image_url ? { image: loc.image_url } : {}),
  })
}

function buildLocationHtml(template, loc) {
  const canonical = locationCanonical(loc)
  const title = `${loc.name} · HaMakom`
  const desc = (loc.description || 'Date ideas for Jewish singles in Israel.').slice(0, 300)
  const jsonLd = buildJsonLd(loc, canonical)

  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${escapeHtml(desc)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${escapeHtml(desc)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`,
  )
  if (loc.image_url) {
    html = html.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:image" content="${escapeHtml(loc.image_url)}" />`,
    )
  }

  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
  }

  const headExtras = `    <script type="application/ld+json">${jsonLd}</script>`
  html = html.replace('</head>', `${headExtras}\n  </head>`)

  const kashrusLine = loc.kashrus
    ? `<p>${escapeHtml(loc.kashrus)}</p>`
    : ''
  const staticRoot = `<div id="root">
    <main style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:system-ui,sans-serif;color:#241E16;background:#F7F2E8;min-height:100vh">
      <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#9A7A28">${escapeHtml(loc.category || '')}</p>
      <h1 style="font-size:28px;font-weight:600;margin:8px 0 4px">${escapeHtml(loc.name)}</h1>
      <p style="font-size:15px;color:#9A7A28;font-style:italic;margin:0 0 16px">${escapeHtml(loc.city)}</p>
      <p style="font-size:15px;line-height:1.6;color:#6E6450">${escapeHtml(loc.description || '')}</p>
      ${kashrusLine}
      <p style="margin-top:24px"><a href="/" style="color:#9A7A28">HaMakom</a></p>
    </main>
  </div>`

  html = html.replace('<div id="root"></div>', staticRoot)
  return html
}

function buildStaticPageHtml(template, { title, desc, canonical, bodyHtml }) {
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${escapeHtml(desc)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${escapeHtml(desc)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`,
  )
  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
  }
  const staticRoot = `<div id="root"><main style="max-width:680px;margin:0 auto;padding:32px 20px;font-family:system-ui,sans-serif;color:#241E16;background:#F7F2E8;min-height:100vh">${bodyHtml}<p style="margin-top:24px"><a href="/" style="color:#9A7A28">HaMakom</a></p></main></div>`
  html = html.replace('<div id="root"></div>', staticRoot)
  return html
}

const template = readFileSync(join(DIST, 'index.html'), 'utf8')
const locations = await loadApprovedLocations()

let written = 0
for (const loc of locations) {
  const slug = String(loc.slug || loc.id)
  const dir = join(DIST, 'location', slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), buildLocationHtml(template, loc))
  written += 1
}

console.log(`Prerender: wrote ${written} location pages to dist/location/<slug>/index.html`)

const staticPages = [
  {
    slug: 'privacy',
    title: 'Privacy Policy · HaMakom',
    desc: 'How HaMakom collects, uses, and protects your data.',
    body: '<h1>Privacy Policy</h1><p>HaMakom respects your privacy. Open the app for the full policy in English and Hebrew.</p>',
  },
  {
    slug: 'terms',
    title: 'Terms of Service · HaMakom',
    desc: 'Terms of use for the HaMakom date planning app.',
    body: '<h1>Terms of Service</h1><p>By using HaMakom you agree to our terms. Open the app for the full terms in English and Hebrew.</p>',
  },
  {
    slug: 'delete-account',
    title: 'Delete Your Account · HaMakom',
    desc: 'Request deletion of your HaMakom account and all associated personal data.',
    body: `<h1>Delete Your Account</h1>
<p>You can permanently delete your HaMakom account and all associated data at any time.</p>
<h2>What gets deleted</h2>
<ul>
  <li>Your account (email address and user ID)</li>
  <li>Saved date plans and saved places</li>
  <li>Quiz answers stored on your profile</li>
  <li>Feedback and ratings you submitted</li>
  <li>Analytics events linked to your session ID</li>
</ul>
<p>Anonymous, aggregated data that is not linked to your identity may be retained for up to 24 months for product improvement.</p>
<h2>Retention</h2>
<p>Personal data is deleted immediately when you use the in-app delete button. Backups are purged within 30 days.</p>
<h2>How to request deletion</h2>
<p><strong>Option 1 (fastest — instant):</strong> Sign in to HaMakom and use the "Delete my account permanently" button on this page.</p>
<p><strong>Option 2 (email):</strong> Send an email to <a href="mailto:privacy@hamakom.app?subject=Delete%20my%20HaMakom%20account">privacy@hamakom.app</a> from the address you signed up with. We will confirm and delete your account within 30 days.</p>
<h2>Contact</h2>
<p>Questions? Contact <a href="mailto:privacy@hamakom.app">privacy@hamakom.app</a>.</p>`,
  },
  {
    slug: 'for-businesses',
    title: 'Partner with HaMakom · Reach Religious Daters',
    desc: 'List your venue on HaMakom and reach religious couples actively deciding where to go on a date.',
    body: `<p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#9A7A28">Founding partner pilot</p>
<h1>Put your venue in front of daters ready to go out</h1>
<p>HaMakom plans complete dates for religious singles in Israel. Founding partners receive a verified listing, reservation link, clearly labeled Browse placement, and reporting on views, directions, calls, and reservations.</p>
<h2>What partners receive</h2>
<ul><li>Verified venue and kashrut details</li><li>A visible partner badge</li><li>Priority placement in Browse</li><li>Monthly performance reporting</li></ul>
<p><strong>Quiz recommendations are never sold.</strong></p>
<p><a href="mailto:partners@hamakom.app?subject=HaMakom%20founding%20partner">Contact partners@hamakom.app</a> or open the app to apply for the free 60-day founding pilot.</p>`,
  },
]

for (const page of staticPages) {
  const dir = join(DIST, page.slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.html'),
    buildStaticPageHtml(template, {
      title: page.title,
      desc: page.desc,
      canonical: `${SITE}/${page.slug}`,
      bodyHtml: page.body,
    }),
  )
}

console.log(`Prerender: wrote ${staticPages.length} static pages: ${staticPages.map((p) => p.slug).join(', ')}`)

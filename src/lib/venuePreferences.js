export const DIETARY_OPTIONS = [
  { value: 'vegan', en: 'Vegan options', he: 'אפשרויות טבעוניות' },
  { value: 'vegetarian', en: 'Vegetarian options', he: 'אפשרויות צמחוניות' },
  { value: 'gluten-free', en: 'Gluten-free options', he: 'אפשרויות ללא גלוטן' },
  { value: 'dairy-free', en: 'Dairy-free options', he: 'אפשרויות ללא חלב' },
]

export function safeExternalUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function isFoodVenue(loc) {
  return /caf|restaurant|winer|hotel|lounge/i.test(loc?.category || '')
}

export function dietaryEvidence(loc) {
  // Tags alone are not evidence. Never infer suitability from a venue's name,
  // cuisine, kashrut, or AI-written description.
  const source = safeExternalUrl(loc?.dietary_source_url)
  const date = loc?.dietary_checked_at
  if (!source || !date || !Number.isFinite(Date.parse(date))) return []
  return (Array.isArray(loc.dietary_options) ? loc.dietary_options : []).filter(v => DIETARY_OPTIONS.some(o => o.value === v))
}

export function hasVerifiedKashrut(loc, now = Date.now()) {
  const checked = Date.parse(loc?.kashrut_last_verified_at)
  const expiry = loc?.kashrut_certificate_expiry ? Date.parse(`${String(loc.kashrut_certificate_expiry).slice(0, 10)}T23:59:59+03:00`) : null
  return loc?.kashrut_status === 'verified' && Boolean(loc.kashrut_authority)
    && Number.isFinite(checked) && checked <= now
    && (expiry == null || (Number.isFinite(expiry) && expiry >= now))
}

export function matchesVenuePreferences(loc, preferences = {}) {
  const maxPrice = { budget: 2, moderate: 3 }[preferences.budget]
  if (maxPrice && (!Number.isFinite(loc.price) || loc.price > maxPrice)) return false
  if (preferences.menuOnly && !safeExternalUrl(loc.menu_url)) return false
  if (isFoodVenue(loc)) {
    const dietary = Array.isArray(preferences.dietary) ? preferences.dietary : []
    const evidence = dietaryEvidence(loc)
    if (!dietary.every(v => evidence.includes(v))) return false
    if (preferences.kosher && preferences.kosher !== 'any') {
      if (!hasVerifiedKashrut(loc)) return false
      if (preferences.kosher === 'mehadrin' && loc.kashrut_level !== 'mehadrin') return false
    }
  }
  return true
}

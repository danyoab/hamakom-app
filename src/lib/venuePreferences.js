import { marketOf } from './markets.js'
export function foodService(loc) {
  const type = String(loc?.kashrus || '').split(' · ')[0].toLowerCase()
  return ['meat', 'dairy', 'pareve'].includes(type) ? type : null
}

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
  return loc?.food_type === 'restaurant' || /caf|restaurant|winer|hotel|lounge/i.test(loc?.category || '')
}

export function dietaryEvidence(loc) {
  // Tags alone are not evidence. Never infer suitability from a venue's name,
  // cuisine, kashrut, or AI-written description.
  const source = safeExternalUrl(loc?.dietary_source_url)
  const date = loc?.dietary_checked_at
  if (!source || !date || !Number.isFinite(Date.parse(date))) return []
  return (Array.isArray(loc.dietary_options) ? loc.dietary_options : []).filter(v => DIETARY_OPTIONS.some(o => o.value === v))
}

const localDateFormats = Object.fromEntries(['Asia/Jerusalem', 'America/New_York'].map(timeZone => [timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })]))
export function certificateExpired(loc, now = Date.now()) {
  const expiry = loc?.kashrut_certificate_expiry?.slice(0, 10)
  if (!expiry) return false
  const parsed = new Date(`${expiry}T12:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== expiry) return true
  return expiry < localDateFormats[marketOf(loc).timezone].format(new Date(now))
}
export function hasVerifiedKashrut(loc, now = Date.now()) {
  const checked = Date.parse(loc?.kashrut_last_verified_at)
  return loc?.kashrut_status === 'verified' && Boolean(loc.kashrut_authority)
    && Number.isFinite(checked) && checked <= now && !certificateExpired(loc, now)
}

export function matchesVenuePreferences(loc, preferences = {}) {
  const maxPrice = { budget: 2, moderate: 3 }[preferences.budget]
  if (maxPrice && (!Number.isFinite(loc.price) || loc.price > maxPrice)) return false
  if (preferences.menuOnly && !safeExternalUrl(loc.menu_url)) return false
  if (isFoodVenue(loc)) {
    if (preferences.foodService && foodService(loc) !== preferences.foodService) return false
    const dietary = Array.isArray(preferences.dietary) ? preferences.dietary : []
    const evidence = dietaryEvidence(loc)
    if (!dietary.every(v => evidence.includes(v))) return false
    if (preferences.kosher && preferences.kosher !== 'any') {
      if (!hasVerifiedKashrut(loc)) return false
      if (preferences.date && loc.kashrut_certificate_expiry && preferences.date > loc.kashrut_certificate_expiry.slice(0, 10)) return false
      if (preferences.kosher === 'mehadrin' && loc.kashrut_level !== 'mehadrin') return false
    }
  }
  return true
}

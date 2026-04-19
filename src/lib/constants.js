export const CATEGORIES = [
  'All',
  'Parks & Outdoors',
  'Hotels & Lounges',
  'Museums & Culture',
  'Activities & Experiences',
  'Cafés & Restaurants',
]

export const CITIES = [
  'All Cities',
  'Jerusalem',
  'Tel Aviv',
  'Beit Shemesh',
  "Modi'in",
  'Herzliya',
  'Netanya',
  "Ra'anana",
  'Ashdod',
  'Holon',
  'Ein Gedi',
  'Various',
]

export const OCCASION_KEYS = [
  'All',
  'first date',
  'romantic',
  'casual',
  'fun',
  'active',
  'unique',
  'upscale',
  'frum-friendly',
  'views',
  'creative',
  'adventurous',
  'evening',
]

export const CATEGORY_EMOJI = {
  'Parks & Outdoors': '🌿',
  'Hotels & Lounges': '✨',
  'Museums & Culture': '🏛',
  'Activities & Experiences': '🎯',
  'Cafés & Restaurants': '☕',
}

export const DATE_STAGE_BADGE = {
  1: { bg: '#1A3A2A', text: '#4ADE80' },
  2: { bg: '#1A2A3A', text: '#60A5FA' },
  3: { bg: '#3A1A2A', text: '#F472B6' },
}

export const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234'

export function getCategoryColor(cat) {
  return (
    {
      'Parks & Outdoors': '#2D6A4F',
      'Hotels & Lounges': '#C9A84C',
      'Museums & Culture': '#7B6FBF',
      'Activities & Experiences': '#C25B3A',
      'Cafés & Restaurants': '#4A90D9',
    }[cat] || '#6B7280'
  )
}

export function getMapsUrl(query) {
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function getWhatsAppUrl(name, city, lang) {
  const msg =
    lang === 'he'
      ? `הייתי ב${name} ב${city} — מומלץ מאוד לדייט! 🌟 מצאתי דרך HaMakom`
      : `Check out ${name} in ${city} — great for a date! 🌟 Found it on HaMakom · hamakom.app`
  return `https://wa.me/?text=${encodeURIComponent(msg)}`
}

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

export const CITY_COORDS = {
  'Jerusalem':          [31.7683, 35.2137],
  'Tel Aviv':           [32.0853, 34.7818],
  'Beit Shemesh':       [31.7458, 34.9942],
  'Ramat Beit Shemesh': [31.7208, 35.0056],
  "Modi'in":            [31.8969, 35.0095],
  'Herzliya':           [32.1663, 34.8437],
  'Netanya':            [32.3215, 34.8532],
  "Ra'anana":           [32.1840, 34.8709],
  'Ashdod':             [31.8044, 34.6553],
  'Holon':              [32.0108, 34.7732],
  'Ein Gedi':           [31.4581, 35.3862],
  'Petach Tikva':       [32.0870, 34.8878],
  'Ramat Gan':          [32.0701, 34.8238],
  'Mitzpe Yericho':     [31.8483, 35.3893],
  'Kfar Daniel':        [31.9369, 34.9356],
  'Latrun':             [31.8383, 34.9786],
  'Kibbutz Tzuba':      [31.7791, 35.1064],
  'Mevaseret':          [31.7967, 35.1543],
  'Gush Etzion':        [31.6500, 35.1167],
  'Beit Nekofa':        [31.7800, 35.1083],
  'Beit Zayit':         [31.7992, 35.1139],
  'Eshtaol':            [31.7817, 34.9783],
  'Moshav Uriyah':      [31.7706, 34.9544],
}

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

export function getInviteUrl(name, city, lang) {
  const msg = lang === 'he'
    ? `יאללה, נסיין את ${name} ב${city}? 😊`
    : `Want to try ${name} in ${city} for a date? 😊`
  return `https://wa.me/?text=${encodeURIComponent(msg)}`
}

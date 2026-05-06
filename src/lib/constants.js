export const CATEGORIES = [
  'All',
  'Parks & Outdoors',
  'Hotels & Lounges',
  'Museums & Culture',
  'Activities & Experiences',
  'Cafés & Restaurants',
  'Wineries',
]

export const CITIES = [
  'All Cities',
  'Jerusalem',
  'Tel Aviv',
  'Haifa',
  'Beit Shemesh',
  "Modi'in",
  'Herzliya',
  'Netanya',
  "Ra'anana",
  'Ashdod',
  'Holon',
  'Ein Gedi',
  'Eilat',
  'Tiberias',
  'Caesarea',
  'Akko',
  'Zichron Yaakov',
  'Mitzpe Ramon',
  'Dead Sea',
  'Beer Sheva',
  'Rehovot',
  'Eshtaol',
  'Tzora',
  'Nes Harim',
  'Netiv HaLamed-Heh',
  'Mata',
  'Tzur Hadassah',
  'Zekharia',
  'Yad HaShmona',
  'Yiron',
  'Ein Zivan',
  'Mitzpe Netofa',
  'Kibbutz Tzuba',
  'Rishon LeZion',
  'Petah Tikva',
  'Ramat Gan',
  'Or Yehuda',
  'Bat Yam',
  'Hod HaSharon',
  'Binyamina',
  'Savyon',
  "Givat Ko'ah",
  "Sha'arei Tikva",
  'Yehud',
  'Shefayim',
  'Tzoffit',
  'Tzur Yigal',
  'Ganey Tal',
  'Ein Carmel',
  'Binyamina',
  'Moshav Hamad',
  'Beer Yaakov',
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
  'Wineries': '🍷',
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
  'Haifa':              [32.7940, 34.9896],
  'Eilat':              [29.5577, 34.9519],
  'Tiberias':           [32.7940, 35.5300],
  'Caesarea':           [32.5000, 34.9000],
  'Akko':               [32.9233, 35.0686],
  'Zichron Yaakov':     [32.5700, 34.9456],
  'Mitzpe Ramon':       [30.6100, 34.8010],
  'Dead Sea':           [31.5000, 35.4500],
  'Masada':             [31.3156, 35.3536],
  'Beer Sheva':         [31.2518, 34.7915],
  'Rehovot':            [31.8928, 34.8113],
  'Beit Guvrin':        [31.6069, 34.8989],
  'Rosh Hanikra':       [33.0833, 35.1000],
  'Hula Valley':        [33.0600, 35.6100],
  'Sataf':              [31.7767, 35.1367],
  'Ein Hemed':          [31.7944, 35.1061],
  'Banias':             [33.2480, 35.6950],
  'Tzora':              [31.7800, 34.9833],
  'Nes Harim':          [31.7417, 35.0750],
  'Netiv HaLamed-Heh':  [31.6778, 34.9583],
  'Mata':               [31.7583, 35.0583],
  'Tzur Hadassah':      [31.7195, 35.1185],
  'Zekharia':           [31.6639, 34.9556],
  'Yad HaShmona':       [31.7917, 35.1083],
  'Yiron':              [33.0583, 35.4167],
  'Ein Zivan':          [32.9833, 35.7667],
  'Mitzpe Netofa':      [32.7583, 35.3833],
  'Rishon LeZion':      [31.9730, 34.7925],
  'Petah Tikva':        [32.0870, 34.8878],
  'Ramat Gan':          [32.0701, 34.8238],
  'Or Yehuda':          [32.0289, 34.8615],
  'Bat Yam':            [32.0233, 34.7511],
  'Hod HaSharon':       [32.1500, 34.8900],
  'Binyamina':          [32.5167, 34.9500],
  'Savyon':             [31.9969, 34.8511],
  "Givat Ko'ah":        [32.2000, 34.9500],
  "Sha'arei Tikva":     [32.1083, 34.9617],
  'Moshav Hamad':       [31.9725, 34.8864],
  'Shefayim':           [32.2381, 34.8264],
  'Yehud':              [31.9947, 34.8878],
  'Kfar Yona':          [32.3153, 34.9314],
  'Tzoffit':            [32.1900, 34.9500],
  'Tzur Yigal':         [32.1900, 34.9833],
  'Ganey Tal':          [31.7200, 34.7500],
  'Ein Carmel':         [32.6000, 35.0167],
  'Sede Moshe':         [31.6900, 34.8600],
  'Beer Yaakov':        [31.9350, 34.8350],
}

const CATEGORY_COLOR_MAP = {
  'Parks & Outdoors': '#2D6A4F',
  'Hotels & Lounges': '#C9A84C',
  'Museums & Culture': '#7B6FBF',
  'Activities & Experiences': '#C25B3A',
  'Cafés & Restaurants': '#4A90D9',
  'Wineries': '#722F37',
}

export function getCategoryColor(cat) {
  if (!cat) return '#6B7280'
  // Exact match first, then fallback to substring for encoding variants
  return (
    CATEGORY_COLOR_MAP[cat] ||
    (cat.includes('Caf') ? '#4A90D9' : '#6B7280')
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

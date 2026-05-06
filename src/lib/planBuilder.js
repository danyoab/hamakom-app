// XorShift32 — reproducible randomness from a seed
function seededRng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
}

function pickFromTop(items, rng, topN = 6) {
  if (!items.length) return null
  const pool = items.slice(0, Math.min(topN, items.length))
  return pool[Math.floor(rng() * pool.length)]
}

// ─── Proximity ─────────────────────────────────────────────────────────────

import { CITY_COORDS } from './constants.js'

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function coordsOf(loc) {
  if (loc.lat && loc.lng) return [loc.lat, loc.lng]
  const c = CITY_COORDS[loc.city]
  return c || null
}

function proximityBonus(loc, anchor) {
  if (!anchor) return 0
  const a = coordsOf(anchor)
  const b = coordsOf(loc)
  if (!a || !b) return 0
  const km = haversineKm(a[0], a[1], b[0], b[1])
  if (km <= 0.5) return 6   // same block / 5-min walk
  if (km <= 1.5) return 4   // 10-15 min walk
  if (km <= 3)   return 2   // short drive / rideshare
  if (km <= 6)   return 0
  return -2                  // clearly different part of city
}

// ─── Stop slot definitions ─────────────────────────────────────────────────
// Each slot has: allowed categories, optional price bounds, preferred occasions.
// Stops are picked in sequence so the night has a logical narrative.

const SLOT_DEFS = {
  'food-drink': [
    {
      // Stop 1: light opener — coffee, small plates, casual drinks
      categories: ['Cafés & Restaurants'],
      maxPrice: 2,
      preferOccasions: ['coffee', 'casual', 'first date', 'dairy', 'light'],
    },
    {
      // Stop 2: main meal
      categories: ['Cafés & Restaurants', 'Hotels & Lounges'],
      minPrice: 2,
      preferOccasions: ['dinner', 'evening', 'romantic', 'upscale', 'fun'],
    },
    {
      // Stop 3: dessert or brief walk
      categories: ['Parks & Outdoors', 'Cafés & Restaurants'],
      maxPrice: 2,
      preferOccasions: ['dessert', 'casual', 'nature', 'unique', 'fun'],
    },
  ],
  atmosphere: [
    {
      // Stop 1: cocktail bar, lounge, or view spot with drinks
      categories: ['Hotels & Lounges', 'Cafés & Restaurants'],
      minPrice: 2,
      preferOccasions: ['evening', 'romantic', 'upscale', 'views', 'vibe'],
    },
    {
      // Stop 2: dinner with ambiance
      categories: ['Cafés & Restaurants'],
      minPrice: 2,
      preferOccasions: ['dinner', 'romantic', 'upscale', 'scenic', 'classic'],
    },
    {
      // Stop 3: end the night — scenic walk or wine bar
      categories: ['Parks & Outdoors', 'Hotels & Lounges', 'Cafés & Restaurants'],
      maxPrice: 3,
      preferOccasions: ['romantic', 'views', 'evening', 'unique'],
    },
  ],
  outdoors: [
    {
      // Stop 1: outdoor spot — park, tayelet, nature
      categories: ['Parks & Outdoors', 'Activities & Experiences'],
      preferOccasions: ['nature', 'casual', 'active', 'first date', 'views', 'outdoors', 'unique'],
    },
    {
      // Stop 2: café or light bite nearby
      categories: ['Cafés & Restaurants'],
      maxPrice: 2,
      preferOccasions: ['casual', 'coffee', 'first date', 'unique'],
    },
    {
      // Stop 3: optional dinner or second activity
      categories: ['Cafés & Restaurants', 'Activities & Experiences', 'Wineries'],
      minPrice: 2,
      preferOccasions: ['dinner', 'evening', 'romantic', 'adventurous'],
    },
  ],
}

// ─── Scoring ───────────────────────────────────────────────────────────────

function scoreForSlot(loc, slotDef, preferOccasions, anchor) {
  let score = 0

  // Category match — hard filter baked into pool selection, but soft-boost too
  if (slotDef.categories.includes(loc.category)) score += 2

  // Price bounds
  if (slotDef.minPrice && loc.price < slotDef.minPrice) score -= 3
  if (slotDef.maxPrice && loc.price > slotDef.maxPrice) score -= 3

  // Preferred occasions
  const locOccasions = loc.occasion || []
  const matched = (slotDef.preferOccasions || []).filter(o => locOccasions.includes(o))
  score += matched.length * 1.5

  // Featured boost
  if (loc.featured) score += 1.5

  // Proximity to anchor stop
  score += proximityBonus(loc, anchor)

  return score
}

function filterForSlot(locs, slotDef) {
  return locs.filter(l => {
    if (!slotDef.categories.includes(l.category)) return false
    return true
  })
}

// ─── Budget ────────────────────────────────────────────────────────────────

const PRICE_RANGES = { 1: [35, 55], 2: [70, 110], 3: [130, 180], 4: [190, 260] }

function budgetText(stops) {
  let lo = 0, hi = 0
  stops.forEach(s => {
    const [a, b] = PRICE_RANGES[s._price] || [70, 110]
    lo += a; hi += b
  })
  return {
    en: `₪${lo}–${hi} per person`,
    he: `₪${lo}–${hi} לאדם`,
  }
}

// ─── Copy ──────────────────────────────────────────────────────────────────

const TITLES = {
  'food-drink:just-met':         { en: 'Easy Evening, Great Food',           he: 'ערב קל, אוכל טוב' },
  'food-drink:getting-to-know':  { en: 'Good Food, Real Conversation',        he: 'אוכל טוב, שיחה אמיתית' },
  'food-drink:getting-serious':  { en: 'A Night Worth Dressing Up For',       he: 'ערב שכדאי להתלבש אליו' },
  'atmosphere:just-met':         { en: 'The Right Setting',                   he: 'המקום הנכון' },
  'atmosphere:getting-to-know':  { en: 'Good Vibe, Better Conversation',      he: 'אווירה טובה, שיחה טובה יותר' },
  'atmosphere:getting-serious':  { en: 'A Deliberately Good Night',           he: 'ערב טוב במכוון' },
  'outdoors:just-met':           { en: 'Out of the Restaurant',               he: 'מחוץ למסעדה' },
  'outdoors:getting-to-know':    { en: 'Move First, Sit Second',              he: 'קודם לזוז, אחר כך לשבת' },
  'outdoors:getting-serious':    { en: "An Evening You'll Both Remember",     he: 'ערב שתזכרו שניכם' },
}

const NARRATIVES = {
  'food-drink:just-met': {
    en: 'A relaxed evening built around the food. Low pressure, easy flow, nothing to figure out.',
    he: 'ערב רגוע שנבנה סביב האוכל. בלי לחץ, זרימה קלה, כלום לפתור.',
  },
  'food-drink:getting-to-know': {
    en: 'Good food makes time disappear. Two stops and enough room to actually talk.',
    he: 'אוכל טוב גורם לזמן לחלוף. שתי תחנות ומספיק מקום לדבר באמת.',
  },
  'food-drink:getting-serious': {
    en: 'Thoughtfully picked spots, good taste, the kind of evening that feels considered.',
    he: 'מקומות שנבחרו בקפידה, טעם טוב, הסוג של ערב שמרגיש שחשבו עליו.',
  },
  'atmosphere:just-met': {
    en: 'The right setting does half the work. Somewhere with real character.',
    he: 'המקום הנכון עושה חצי מהעבודה. איפשהו עם אופי אמיתי.',
  },
  'atmosphere:getting-to-know': {
    en: 'Mood first. A place that creates the backdrop for the conversation to go deeper.',
    he: 'קודם כל אווירה. מקום שיוצר את הרקע לשיחה שתתעמק.',
  },
  'atmosphere:getting-serious': {
    en: 'Intentional from the first stop. The kind of night that communicates without saying it.',
    he: 'מכוון מהתחנה הראשונה. הסוג של ערב שמתקשר בלי לומר את זה.',
  },
  'outdoors:just-met': {
    en: 'Skip the table. Air, movement, and space makes early dates easier.',
    he: 'לדלג על השולחן. אוויר, תנועה ומרחב הופכים דייטים ראשונים לקלים יותר.',
  },
  'outdoors:getting-to-know': {
    en: 'Walking and talking reveals more than sitting across a table ever will.',
    he: 'הליכה ושיחה חושפת יותר מאשר לשבת מול שולחן.',
  },
  'outdoors:getting-serious': {
    en: 'A shared experience, not just a meal. Something to look back on together.',
    he: 'חוויה משותפת, לא רק ארוחה. משהו להביט אחורה אליו ביחד.',
  },
}

const START_TIMES = {
  short:  { en: 'Start around 7:30 PM',  he: 'התחילו בערך ב-19:30' },
  medium: { en: 'Start around 7:00 PM',  he: 'התחילו בערך ב-19:00' },
  long:   { en: 'Start around 6:30 PM',  he: 'התחילו בערך ב-18:30' },
}

const DURATIONS = {
  short:  { en: '1.5–2 hours',   he: '1.5–2 שעות' },
  medium: { en: '2.5–3 hours',   he: '2.5–3 שעות' },
  long:   { en: '3.5–4 hours',   he: '3.5–4 שעות' },
}

// ─── Stop instructions ─────────────────────────────────────────────────────

const SLOT_INSTRUCTIONS = {
  'food-drink': [
    { en: 'Start light — order drinks or a small plate. No rush.', he: 'מתחילים קל — הזמינו שתייה או מנה קטנה. בלי מהירות.' },
    { en: 'This is the main stop. Take your time here.', he: 'זו התחנה המרכזית. קחו את הזמן.' },
    { en: 'Wind down here — dessert or a walk to close the night.', he: 'מסיימים כאן — קינוח או טיול לסיום הערב.' },
  ],
  atmosphere: [
    { en: 'Order drinks and settle in. Let the place do the work.', he: 'הזמינו שתייה והתרווחו. תנו למקום לעשות את העבודה.' },
    { en: 'Dinner here. The atmosphere carries the conversation.', he: 'ארוחת ערב כאן. האווירה מוביל את השיחה.' },
    { en: 'A quiet close to the night.', he: 'סיום שקט לערב.' },
  ],
  outdoors: [
    { en: 'Start outside — walk, look around, no agenda.', he: 'מתחילים בחוץ — מטיילים, מסתכלים סביב, בלי לוח זמנים.' },
    { en: 'Grab a drink or something to eat nearby.', he: 'לוקחים שתייה או משהו לאכול בקרבת מקום.' },
    { en: 'Round off the evening here.', he: 'מסיימים את הערב כאן.' },
  ],
}

function toStop(loc, slotIndex, focus) {
  const instructions = SLOT_INSTRUCTIONS[focus] || SLOT_INSTRUCTIONS['food-drink']
  const fallback = instructions[slotIndex] || instructions[0]
  return {
    name_en:        loc.name,
    name_he:        loc.name_he || loc.name,
    instruction_en: loc.description || fallback.en,
    instruction_he: loc.description_he || loc.description || fallback.he,
    maps_query:     loc.maps_query || `${loc.name} ${loc.city} Israel`,
    _price:         loc.price || 2,
  }
}

// ─── Main export ───────────────────────────────────────────────────────────

const SERIOUSNESS_STAGES = {
  'just-met':        [1],
  'getting-to-know': [1, 2],
  'getting-serious': [2, 3],
}

export function assembleDynamicPlan(locations, answers) {
  const seed = answers._seed || Date.now()
  const rng = seededRng(seed)
  const focus = answers.focus || 'food-drink'

  // 1. Filter by city
  const cityPool =
    answers.city && answers.city !== 'flexible'
      ? locations.filter(l => l.city === answers.city || l.city === 'Various')
      : locations

  // 2. Filter by seriousness / date_stage
  const stages = SERIOUSNESS_STAGES[answers.seriousness] || [1, 2]
  const eligible = cityPool.filter(
    l => l.status === 'approved' && (l.date_stage || []).some(s => stages.includes(s))
  )

  if (eligible.length < 2) return null

  const slotDefs = SLOT_DEFS[focus] || SLOT_DEFS['food-drink']
  const length = answers.length || 'medium'
  const stopCount = length === 'short' ? 2 : 3

  const usedIds = new Set()
  const selectedLocs = []

  // 3. Pick each stop in sequence, using the previous stop as proximity anchor
  for (let i = 0; i < stopCount; i++) {
    const slotDef = slotDefs[i]
    if (!slotDef) break

    const anchor = selectedLocs[selectedLocs.length - 1] || null
    const pool = filterForSlot(eligible, slotDef).filter(l => !usedIds.has(l.id))

    if (!pool.length) {
      // Fallback: relax category constraint
      const relaxed = eligible.filter(l => !usedIds.has(l.id))
      if (!relaxed.length) break
      const scored = relaxed
        .map(l => ({ ...l, _s: scoreForSlot(l, slotDef, slotDef.preferOccasions, anchor) }))
        .sort((a, b) => b._s - a._s)
      const picked = pickFromTop(scored, rng, 6)
      if (!picked) break
      usedIds.add(picked.id)
      selectedLocs.push(picked)
      continue
    }

    const scored = pool
      .map(l => ({ ...l, _s: scoreForSlot(l, slotDef, slotDef.preferOccasions, anchor) }))
      .sort((a, b) => b._s - a._s)

    const picked = pickFromTop(scored, rng, 6)
    if (!picked) break
    usedIds.add(picked.id)
    selectedLocs.push(picked)
  }

  if (selectedLocs.length < 2) return null

  const stops = selectedLocs.map((loc, i) => toStop(loc, i, focus))
  const budget = budgetText(stops)

  const city =
    selectedLocs[0].city !== 'Various' ? selectedLocs[0].city :
    selectedLocs[1]?.city !== 'Various' ? selectedLocs[1].city :
    (answers.city || 'flexible')

  const key = `${focus}:${answers.seriousness}`
  const titleObj    = TITLES[key]    || { en: 'Your Evening Plan',            he: 'תוכנית הערב שלכם' }
  const narrativeObj = NARRATIVES[key] || { en: 'A plan built for your answers.', he: 'תוכנית שנבנתה לתשובות שלכם.' }

  return {
    id:                 `dynamic-${seed}`,
    city,
    featured:           false,
    _dynamic:           true,
    title_en:           titleObj.en,
    title_he:           titleObj.he,
    narrative_en:       narrativeObj.en,
    narrative_he:       narrativeObj.he,
    start_time_text_en: START_TIMES[length].en,
    start_time_text_he: START_TIMES[length].he,
    duration_text_en:   DURATIONS[length].en,
    duration_text_he:   DURATIONS[length].he,
    budget_text_en:     budget.en,
    budget_text_he:     budget.he,
    share_summary_en:   stops.map(s => s.name_en).join(' → '),
    share_summary_he:   stops.map(s => s.name_he).join(' → '),
    length_tags:        [length],
    focus_tags:         [focus],
    seriousness_tags:   [answers.seriousness],
    when_tags:          [],
    stops,
  }
}

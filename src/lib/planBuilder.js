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

const FOCUS_OCCASIONS = {
  'food-drink': ['first date', 'casual', 'coffee', 'evening', 'fun', 'romantic', 'upscale'],
  atmosphere:   ['romantic', 'upscale', 'views', 'evening', 'intimate', 'unique'],
  outdoors:     ['outdoors', 'active', 'views', 'nature', 'adventurous', 'unique'],
}

const SERIOUSNESS_STAGES = {
  'just-met':          [1],
  'getting-to-know':   [1, 2],
  'getting-serious':   [2, 3],
}

function scoreForRole(loc, focusOccasions, role) {
  let score = 0
  const occasions = loc.occasion || []
  if (focusOccasions.some(o => occasions.includes(o))) score += 3
  if (loc.featured) score += 1.5

  if (role === 'open') {
    if (loc.price <= 2) score += 2
    if (loc.category === 'Parks & Outdoors') score += 1
  } else if (role === 'main') {
    if (loc.price >= 2) score += 2
    if (['Activities & Experiences', 'Wineries'].includes(loc.category)) score += 1
  } else if (role === 'close') {
    if (loc.price <= 2) score += 2
    if (loc.category === 'Parks & Outdoors') score += 1.5
  }

  return score
}

function budgetText(stops) {
  const priceMap = { 1: 45, 2: 85, 3: 150, 4: 220 }
  const perStop = stops.map(s => priceMap[s._price] || 85)
  const lo = perStop.reduce((a, b) => a + b, 0)
  const hi = Math.round(lo * 1.35 / 10) * 10
  return {
    en: `₪${lo}–${hi} per person`,
    he: `₪${lo}–${hi} לאדם`,
  }
}

const TITLES = {
  'food-drink:just-met':         { en: 'Easy Evening, Great Food',           he: 'ערב קל, אוכל טוב' },
  'food-drink:getting-to-know':  { en: 'Good Food, Real Conversation',        he: 'אוכל טוב, שיחה אמיתית' },
  'food-drink:getting-serious':  { en: 'A Night Worth Dressing Up For',       he: 'ערב שכדאי להתלבש אליו' },
  'atmosphere:just-met':         { en: 'The Right Setting',                   he: 'המקום הנכון' },
  'atmosphere:getting-to-know':  { en: 'Good Vibe, Better Conversation',      he: 'אווירה טובה, שיחה טובה יותר' },
  'atmosphere:getting-serious':  { en: 'A Deliberately Good Night',           he: 'ערב טוב במכוון' },
  'outdoors:just-met':           { en: 'Out of the Restaurant',               he: 'מחוץ למסעדה' },
  'outdoors:getting-to-know':    { en: 'Move First, Sit Second',              he: 'קודם לזוז, אחר כך לשבת' },
  'outdoors:getting-serious':    { en: 'An Evening You\'ll Both Remember',    he: 'ערב שתזכרו שניכם' },
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

function toStop(loc) {
  return {
    name_en:        loc.name,
    name_he:        loc.name_he || loc.name,
    instruction_en: loc.description || `${loc.category} in ${loc.city}`,
    instruction_he: loc.description_he || loc.description || loc.name_he || loc.name,
    maps_query:     loc.maps_query || `${loc.name} ${loc.city} Israel`,
    _price:         loc.price || 2,
  }
}

export function assembleDynamicPlan(locations, answers) {
  const seed = answers._seed || Date.now()
  const rng = seededRng(seed)

  const cityPool =
    answers.city && answers.city !== 'flexible'
      ? locations.filter(l => l.city === answers.city || l.city === 'Various')
      : locations

  const stages = SERIOUSNESS_STAGES[answers.seriousness] || [1, 2]
  const eligible = cityPool.filter(
    l => l.status === 'approved' && (l.date_stage || []).some(s => stages.includes(s))
  )

  if (eligible.length < 2) return null

  const focusOccasions = FOCUS_OCCASIONS[answers.focus] || FOCUS_OCCASIONS['food-drink']

  const ranked = (role) =>
    eligible
      .map(l => ({ ...l, _s: scoreForRole(l, focusOccasions, role) }))
      .sort((a, b) => b._s - a._s)

  const stop1Loc = pickFromTop(ranked('open'), rng, 6)
  if (!stop1Loc) return null

  const stop2Loc = pickFromTop(
    ranked('main').filter(l => l.id !== stop1Loc.id),
    rng, 6
  )
  if (!stop2Loc) return null

  const length = answers.length || 'medium'
  let stop3Loc = null
  if (length !== 'short') {
    stop3Loc = pickFromTop(
      ranked('close').filter(l => l.id !== stop1Loc.id && l.id !== stop2Loc.id),
      rng, 6
    )
  }

  const stops = [stop1Loc, stop2Loc, stop3Loc].filter(Boolean).map(toStop)
  const budget = budgetText(stops)

  const city =
    stop1Loc.city !== 'Various' ? stop1Loc.city :
    stop2Loc.city !== 'Various' ? stop2Loc.city :
    (answers.city || 'flexible')

  const key = `${answers.focus}:${answers.seriousness}`
  const titleObj    = TITLES[key]    || { en: 'Your Evening Plan',       he: 'תוכנית הערב שלכם' }
  const narrativeObj = NARRATIVES[key] || { en: 'A plan built for your answers.', he: 'תוכנית שנבנתה לתשובות שלכם.' }

  return {
    id:                   `dynamic-${seed}`,
    city,
    featured:             false,
    _dynamic:             true,
    title_en:             titleObj.en,
    title_he:             titleObj.he,
    narrative_en:         narrativeObj.en,
    narrative_he:         narrativeObj.he,
    start_time_text_en:   START_TIMES[length].en,
    start_time_text_he:   START_TIMES[length].he,
    duration_text_en:     DURATIONS[length].en,
    duration_text_he:     DURATIONS[length].he,
    budget_text_en:       budget.en,
    budget_text_he:       budget.he,
    share_summary_en:     stops.map(s => s.name_en).join(' → '),
    share_summary_he:     stops.map(s => s.name_he).join(' → '),
    length_tags:          [length],
    focus_tags:           [answers.focus],
    seriousness_tags:     [answers.seriousness],
    when_tags:            [],
    stops,
  }
}

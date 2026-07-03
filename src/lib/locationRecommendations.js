import { CITY_COORDS } from './constants.js'

function normalizeCategory(category = '') {
  if (category.includes('Park')) return 'outdoors'
  if (category.includes('Hotel') || category.includes('Lounge')) return 'lounges'
  if (category.includes('Museum') || category.includes('Culture')) return 'culture'
  if (category.includes('Activity') || category.includes('Experience')) return 'activity'
  if (category.includes('Caf') || category.includes('Restaurant')) return 'food'
  if (category.includes('Winer')) return 'winery'
  return 'other'
}

function normalizeOccasions(occasion = []) {
  return new Set((occasion || []).map((item) => String(item).toLowerCase()))
}

function targetDateStage(seriousness) {
  if (seriousness === 'just-met') return 1
  if (seriousness === 'getting-to-know') return 2
  if (seriousness === 'getting-serious') return 3
  return null
}

function focusSignals(focus) {
  switch (focus) {
    case 'atmosphere':
      return { categories: ['lounges', 'winery', 'food'], occasions: ['romantic', 'views', 'upscale', 'evening'] }
    case 'food-drink':
      return { categories: ['food', 'winery', 'lounges'], occasions: ['casual', 'upscale', 'evening'] }
    case 'activity':
      return { categories: ['activity', 'culture', 'outdoors'], occasions: ['fun', 'active', 'unique', 'creative'] }
    case 'outdoors':
      return { categories: ['outdoors'], occasions: ['nature', 'views', 'active', 'romantic'] }
    default:
      return { categories: [], occasions: [] }
  }
}

function paceSignals(length) {
  switch (length) {
    case 'short':
      return { maxPrice: 2, occasions: ['casual', 'first date'], travelToleranceKm: 20 }
    case 'medium':
      return { maxPrice: 3, occasions: ['casual', 'romantic', 'evening'], travelToleranceKm: 40 }
    case 'long':
      return { maxPrice: 4, occasions: ['unique', 'adventurous', 'romantic', 'upscale'], travelToleranceKm: 90 }
    default:
      return { maxPrice: 4, occasions: [], travelToleranceKm: 40 }
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distanceKm(location, userCity) {
  // Venue-level coordinates take priority over city-level
  if (location.lat && location.lng && CITY_COORDS[userCity]) {
    const [cityLat, cityLng] = CITY_COORDS[userCity]
    return haversineKm(location.lat, location.lng, cityLat, cityLng)
  }
  const a = CITY_COORDS[location.city]
  const b = CITY_COORDS[userCity]
  if (!a || !b) return null
  return haversineKm(a[0], a[1], b[0], b[1])
}

function buildPreferenceProfile({ locations, savedPlaceIds = [], clickedLocationCounts = {}, feedbackByItem = {} }) {
  const cityWeights = {}
  const categoryWeights = {}

  const addWeight = (bucket, key, weight) => {
    if (!key) return
    bucket[key] = (bucket[key] || 0) + weight
  }

  const locationIndex = new Map((locations || []).map((location) => [String(location.id), location]))

  savedPlaceIds.forEach((id) => {
    const location = locationIndex.get(String(id))
    if (!location) return
    addWeight(cityWeights, location.city, 1.5)
    addWeight(categoryWeights, normalizeCategory(location.category), 1)
  })

  Object.entries(clickedLocationCounts || {}).forEach(([id, count]) => {
    const location = locationIndex.get(String(id))
    if (!location) return
    addWeight(cityWeights, location.city, Math.min(Number(count) || 0, 3) * 0.35)
    addWeight(categoryWeights, normalizeCategory(location.category), Math.min(Number(count) || 0, 3) * 0.2)
  })

  Object.entries(feedbackByItem || {}).forEach(([key, feedback]) => {
    if (!key.startsWith('place:') || !feedback?.went || !feedback?.rating) return
    const location = locationIndex.get(key.replace('place:', ''))
    if (!location) return
    const weight = feedback.rating >= 4 && feedback.again ? 1.6 : feedback.rating >= 4 ? 0.9 : feedback.rating <= 2 ? -0.6 : 0
    addWeight(cityWeights, location.city, weight)
    addWeight(categoryWeights, normalizeCategory(location.category), weight)
  })

  return { cityWeights, categoryWeights }
}

function scoreBehaviorBoost(location, profile) {
  const cityBoost = profile.cityWeights[location.city] || 0
  const categoryBoost = profile.categoryWeights[normalizeCategory(location.category)] || 0
  return cityBoost + categoryBoost
}

// ── Layer 1: hard filters ─────────────────────────────────────────────────────
// Cheap, absolute. Removes rows that can't possibly fit the query.
// Each filter is a single function so future ones (weather, hours, dietary)
// slot in without touching call sites.

const HARD_FILTERS = [
  function rejectClosed(loc) {
    if (loc.business_status === 'CLOSED_PERMANENTLY') return 'closed_permanently'
    return null
  },
]

export function applyHardFilters(locations, ctx = {}) {
  const reasons = []
  const kept = []
  for (const loc of locations || []) {
    let rejection = null
    for (const filter of HARD_FILTERS) {
      const why = filter(loc, ctx)
      if (why) { rejection = why; break }
    }
    if (rejection) reasons.push({ id: loc.id, name: loc.name, reason: rejection })
    else kept.push(loc)
  }
  return { kept, rejected: reasons }
}

// ── Layer 2/3: curated vibe fit ───────────────────────────────────────────────
// Reads curator-owned fields only. Returns 0 (and an empty matched[]) when the
// row is uncurated — preserves existing behavior for unscored locations.
// Curator data is intentionally weighted heavier than API data: a romantic_score
// hit is worth more than an `occasion: 'romantic'` tag match.

function vibeAlignment(locVibes, focus, seriousness) {
  // Map quiz axes → vibe tags the curator may have set.
  const wanted = new Set()
  if (focus === 'atmosphere')       { wanted.add('romantic'); wanted.add('cozy'); wanted.add('intimate'); wanted.add('scenic') }
  if (focus === 'food-drink')       { wanted.add('cozy'); wanted.add('intimate'); wanted.add('upscale') }
  if (focus === 'activity')         { wanted.add('activity-based'); wanted.add('lively'); wanted.add('hidden-gem') }
  if (focus === 'outdoors')         { wanted.add('scenic'); wanted.add('activity-based') }
  if (seriousness === 'just-met')        { wanted.add('first-date'); wanted.add('casual') }
  if (seriousness === 'getting-to-know') { wanted.add('cozy'); wanted.add('quiet') }
  if (seriousness === 'getting-serious') { wanted.add('romantic'); wanted.add('upscale'); wanted.add('intimate') }
  const hits = (locVibes || []).filter(t => wanted.has(t))
  return hits
}

export function scoreCuratedFit(location, answers) {
  const matched = []
  const caveats = []
  let score = 0

  const vibes = location.vibe_tags
  if (vibes && vibes.length > 0) {
    const hits = vibeAlignment(vibes, answers.focus, answers.seriousness)
    if (hits.length) {
      score += hits.length * 2.5  // curator data weighted heavier than occasion[]
      hits.forEach(tag => matched.push(`vibe:${tag}`))
    }
  }

  // Stage-of-date axis: romantic_score / energy_score map directly to seriousness.
  if (answers.seriousness === 'getting-serious' && location.romantic_score != null) {
    if (location.romantic_score >= 70)      { score += 4; matched.push(`romantic ${location.romantic_score}`) }
    else if (location.romantic_score <= 30) { score -= 4; caveats.push('not very romantic') }
  }
  if (answers.seriousness === 'just-met' && location.energy_score != null) {
    // First dates: medium-high energy beats dead-quiet rooms; very high energy gets too loud.
    if (location.energy_score >= 40 && location.energy_score <= 75) { score += 2; matched.push('comfortable energy') }
    if (location.energy_score > 90) { score -= 2; caveats.push('might be too loud for a first date') }
  }

  // Length ↔ duration sanity check
  if (location.duration_min != null && answers.length) {
    const wantedMin = answers.length === 'short' ? 30 : answers.length === 'long' ? 120 : 60
    const wantedMax = answers.length === 'short' ? 90 : answers.length === 'long' ? 240 : 150
    if (location.duration_min <= wantedMax && (location.duration_max ?? location.duration_min) >= wantedMin) {
      score += 1.5; matched.push('duration fits')
    }
  }

  // Time-of-day fit
  if (location.best_time?.length && answers.when) {
    const tonightWindow = answers.when === 'tonight' || answers.when === 'thursday-night'
    if (tonightWindow && (location.best_time.includes('evening') || location.best_time.includes('night'))) {
      score += 2; matched.push('good at this time')
    }
  }

  // Indoor/outdoor weather fit (only when ctx provides weather; safe no-op otherwise)
  // (kept here for the future ctx.weather wiring; doesn't fire today)

  // Fix 2 (emotional guardrails): suppress "cheap = good first date" false positives.
  // A bagel shop or ice-cream counter scoring high on a casual first-date query is
  // technically correct on price+occasion but emotionally wrong. Two layered checks:
  //
  //   a) Curator-stated: if romantic_score < 25 on a first-date query, trust the curator.
  //   b) Heuristic for uncurated rows: snack-style names + price=1 + no evening/romantic
  //      occasion = "better as a quick stop than a date anchor."
  if (answers.seriousness === 'just-met') {
    if (location.romantic_score != null && location.romantic_score < 25) {
      score -= 3
      caveats.push('curator: not very dateable')
    } else if (
      location.romantic_score == null &&
      location.price === 1 &&
      isSnackStyleName(location) &&
      !hasOccasion(location, ['evening', 'romantic', 'upscale'])
    ) {
      score -= 3
      caveats.push('snack-style spot — better as a quick stop than a date anchor')
    }
  }

  // Confidence multiplier — curated rows we trust contribute more.
  if (location.confidence_score != null && location.confidence_score < 60) {
    score *= 0.6
    caveats.push('low-confidence data')
  }

  return { score, matched, caveats }
}

// Explicit heuristic list. Inspectable, easy to tune, easy to delete once
// enough rows are curated with romantic_score.
const SNACK_NAME_PATTERNS = [
  /bagel/i, /\bice\b/i, /ice cream/i, /gelato/i, /frozen yogurt/i,
  /muffin/i, /cookie/i, /donut/i, /pastr/i, /bakery/i, /\bcandy\b/i,
  /\bkiosk\b/i, /smoothie/i, /\bjuice\b/i,
]
function isSnackStyleName(loc) {
  const name = `${loc.name || ''} ${loc.name_he || ''}`
  return SNACK_NAME_PATTERNS.some(re => re.test(name))
}
function hasOccasion(loc, list) {
  const set = normalizeOccasions(loc.occasion)
  return list.some(o => set.has(o))
}

export function scoreLocation(location, answers, behavior = {}) {
  let score = 0
  const occasions = normalizeOccasions(location.occasion)
  const category = normalizeCategory(location.category)
  const preferredStage = targetDateStage(answers.seriousness)
  const focus = focusSignals(answers.focus)
  const pace = paceSignals(answers.length)
  const behaviorProfile = behavior.profile || buildPreferenceProfile(behavior)

  if (answers.city && answers.city !== 'flexible') {
    if (location.city === answers.city) {
      score += 8
    } else {
      // Cross-city is a real penalty now, not just neutral. Without this,
      // a perfectly-curated location in another city out-scores the local
      // option that the plan composer will actually use.
      score -= 4
      const distance = distanceKm(location, answers.city)
      if (distance !== null && distance <= pace.travelToleranceKm) score += 2 // partial credit for short hops
    }
  }

  if (preferredStage && (location.date_stage || []).includes(preferredStage)) score += 3

  // Fix 3 (activity ≠ museum): differentiated category boost. Same intent as the
  // old +2.5 flat boost, but museums get demoted under 'activity' focus unless
  // a curator has explicitly tagged them as lively/activity-based (handled in
  // scoreCuratedFit). Outdoor → activity still gets credit (parks, hikes).
  const FOCUS_CATEGORY_BOOST = {
    atmosphere: { lounges: 2.5, winery: 2.5, food: 2.5 },
    'food-drink': { food: 2.5, winery: 2.5, lounges: 2.5 },
    activity:    { activity: 3.0, outdoors: 2.0, culture: 1.0 },  // culture lowered
    outdoors:    { outdoors: 3.0 },
  }
  score += (FOCUS_CATEGORY_BOOST[answers.focus]?.[category] ?? 0)

  focus.occasions.forEach((signal) => {
    if (occasions.has(signal)) score += 1
  })

  pace.occasions.forEach((signal) => {
    if (occasions.has(signal)) score += 0.8
  })

  if (answers.length === 'short') {
    if (location.price <= 2) score += 1.2
    if (occasions.has('first date') || occasions.has('casual')) score += 1
  }

  if (answers.length === 'long') {
    if (location.price >= 3) score += 0.6
    if (occasions.has('unique') || occasions.has('romantic') || occasions.has('adventurous')) score += 1
  }

  if (location.kashrus || occasions.has('frum-friendly')) score += 1

  if (answers.seriousness === 'just-met') {
    if (occasions.has('first date') || occasions.has('casual')) score += 1.3
    if (location.price >= 4) score -= 0.7
  }

  if (answers.seriousness === 'getting-serious') {
    if (occasions.has('romantic') || occasions.has('upscale')) score += 1.1
  }

  score += scoreBehaviorBoost(location, behaviorProfile)

  // Layer 2/3: curated fit. No-op when the row isn't curated; preserves
  // existing rankings for rows still relying on occasion[]/category/price.
  const curated = scoreCuratedFit(location, answers)
  score += curated.score

  const isColdStart = !Object.keys(behaviorProfile.cityWeights).length && !Object.keys(behaviorProfile.categoryWeights).length
  if (location.featured) score += isColdStart ? 2 : 1.5

  return score
}

// ── Phase 3: feedback-driven influence ────────────────────────────────────────
// Aggregates the user's *own* past feedback tags and applies soft, capped
// adjustments to scoring. Per-user only — does NOT crowd-source ranking,
// because one popular bad rec must not drag a good one down for everyone.
//
// Invariants:
//   - Caps total influence at ±2 per row (curator data still dominates)
//   - Requires a tag to appear ≥ 2× before it counts (no single rage-click)
//   - Ignores feedback older than 90 days (stale signal)
//   - Always returns the per-row adjustment + matched/caveat strings so the
//     debug panel can show *why* a row was nudged.

const FEEDBACK_RECENCY_MS = 90 * 24 * 60 * 60 * 1000
const FEEDBACK_MIN_COUNT  = 2
const FEEDBACK_CAP        = 2

export function buildFeedbackProfile(behavior = {}) {
  const entries = Object.entries(behavior.feedbackByItem || {})
  const now = Date.now()
  const tagCount = {}            // 'too loud' → 2
  const positiveVibeCount = {}    // 'romantic' → 3 (vibe tags of items user loved)
  const negativeVibeCount = {}    // 'lively'   → 2 (vibe tags of items user disliked)

  for (const [, fb] of entries) {
    if (!fb || (fb.ts && (now - fb.ts) > FEEDBACK_RECENCY_MS)) continue
    const tags = fb.tags || []
    for (const t of tags) tagCount[t] = (tagCount[t] || 0) + 1

    // Vibe affinity: if the user loved a place, lean toward its vibes; vice versa.
    const positive = tags.includes('perfect-vibe') || tags.includes('would-go-again') || tags.includes('good') || (fb.rating >= 4 && fb.again)
    const negative = tags.includes('not-date-worthy') || tags.includes('bad') || (fb.rating != null && fb.rating <= 2)
    if (positive && fb.vibe_tags?.length) for (const v of fb.vibe_tags) positiveVibeCount[v] = (positiveVibeCount[v] || 0) + 1
    if (negative && fb.vibe_tags?.length) for (const v of fb.vibe_tags) negativeVibeCount[v] = (negativeVibeCount[v] || 0) + 1
  }

  return { tagCount, positiveVibeCount, negativeVibeCount }
}

export function scoreFeedbackInfluence(location, profile) {
  let score = 0
  const matched = []
  const caveats = []

  const energetic = (location.energy_score ?? 0) >= 70 || (location.vibe_tags || []).includes('lively')
  const expensive = (location.price ?? 0) >= 3
  const popular   = location.featured || (location.google_rating ?? 0) >= 4.5

  // Aversion signals — only fire when the tag is repeated.
  if ((profile.tagCount['too-loud'] || 0) >= FEEDBACK_MIN_COUNT && energetic) {
    score -= 1.0; caveats.push('your past feedback: too loud')
  }
  if ((profile.tagCount['too-expensive'] || 0) >= FEEDBACK_MIN_COUNT && expensive) {
    score -= 1.0; caveats.push('your past feedback: too expensive')
  }
  if ((profile.tagCount['too-crowded'] || 0) >= FEEDBACK_MIN_COUNT && popular) {
    score -= 0.8; caveats.push('your past feedback: too crowded')
  }

  // Vibe affinity — positive
  for (const v of (location.vibe_tags || [])) {
    const pos = profile.positiveVibeCount[v] || 0
    const neg = profile.negativeVibeCount[v] || 0
    if (pos >= FEEDBACK_MIN_COUNT) { score += 0.5; matched.push(`you've liked '${v}' before`) }
    if (neg >= FEEDBACK_MIN_COUNT) { score -= 0.5; caveats.push(`you've disliked '${v}' before`) }
  }

  // Hard cap — feedback should nudge, not override curation.
  if (score >  FEEDBACK_CAP) score =  FEEDBACK_CAP
  if (score < -FEEDBACK_CAP) score = -FEEDBACK_CAP

  return { score, matched, caveats }
}

// Diagnostic version — same scoring, but returns the breakdown so the UI
// can show "matched because X". Used by getRecommendedLocations for reasoning.
export function explainLocation(location, answers, behavior = {}) {
  const baseScore   = scoreLocation(location, answers, behavior)
  const curated     = scoreCuratedFit(location, answers)
  const feedbackP   = behavior.feedbackProfile || buildFeedbackProfile(behavior)
  const fbInfluence = scoreFeedbackInfluence(location, feedbackP)
  return {
    score:    baseScore + fbInfluence.score,
    matched:  [...curated.matched, ...fbInfluence.matched],
    caveats:  [...curated.caveats, ...fbInfluence.caveats],
    confidence: location.confidence_score ?? null,
    feedbackAdjust: fbInfluence.score,
  }
}

export function getRecommendedLocations(locations, answers, options = {}) {
  if (!locations?.length) return []

  const excluded = new Set((options.excludeIds || []).map(String))
  const behavior = {
    ...options,
    profile: buildPreferenceProfile(options),
    feedbackProfile: buildFeedbackProfile(options),
  }

  // Layer 1: hard filters. Closed-permanently rows are dropped before scoring
  // so they cannot leak into the output even if they outrank.
  const { kept } = applyHardFilters(locations.filter(l => !excluded.has(String(l.id))))

  const scored = kept.map((location) => {
    const explained = explainLocation(location, answers, behavior)
    return {
      ...location,
      _score: explained.score,
      _reasoning: {
        matched: explained.matched,
        caveats: explained.caveats,
        confidence: explained.confidence,
      },
    }
  }).sort((a, b) => b._score - a._score)

  const limit = options.limit || 3

  // Fix 1 (city='flexible' diversification): without this, the city with the
  // largest row count dominates. Greedy progressive penalty: each additional
  // row from a city already in the result subtracts 2.0 from its effective
  // score. Deterministic, debuggable, preserves strong-margin winners (a row
  // beating the next by >2 still wins despite being from a repeat city).
  if (answers.city === 'flexible' && scored.length > limit) {
    return diversifyByCity(scored, limit)
  }

  return scored.slice(0, limit)
}

function diversifyByCity(sorted, limit) {
  const result = []
  const cityCount = {}
  const remaining = [...sorted]
  while (result.length < limit && remaining.length) {
    let bestIdx = 0
    let bestAdj = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]
      const adj = c._score - 2.0 * (cityCount[c.city] || 0)
      if (adj > bestAdj) { bestAdj = adj; bestIdx = i }
    }
    const pick = remaining.splice(bestIdx, 1)[0]
    cityCount[pick.city] = (cityCount[pick.city] || 0) + 1
    result.push(pick)
  }
  return result
}

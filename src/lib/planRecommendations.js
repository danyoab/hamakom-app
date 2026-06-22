import { getMatchedPlans } from './quiz.js'
import { scoreLocation } from './locationRecommendations.js'
import {
  proximityScore,
  flowCompatibility,
  timeFitForStopIndex,
  buildComposeMetadata,
  sameLocale,
  distanceKm,
} from './planCoherence.js'
import { plannableLocations, isRealPlan, sameCity, violatesFoodPairing, foodClassOf, MAX_LEG_KM } from './planGates.js'

// Variety knobs — see /plans/the-plans-feel-limited-quiet-moon.md
const SCORE_BAND_WIDTH = 2.5
const RECENCY_PENALTIES = [2.0, 1.5, 1.0, 0.5, 0.25]
const RECENT_STORAGE_KEY = 'hamakom-recent-plans'
const RECENT_MAX_STORED = 15
const EXPLORATION_RATE = 0.2
const MIN_ELIGIBLE_SCORE = 0
const TAIL_SOFTMAX_TEMP = 2

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export function getRecentPlanIds() {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.id) : []
  } catch { return [] }
}

export function recordPlanImpression(planId) {
  if (!planId) return
  try {
    const list = getRecentPlanIds().filter((entry) => entry.id !== planId)
    list.unshift({ id: planId, ts: Date.now() })
    const trimmed = list.slice(0, RECENT_MAX_STORED)
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(trimmed))
  } catch { /* ignore */ }
}

function recencyPenalty(planId, recentIds) {
  const idx = recentIds.findIndex((entry) => entry.id === planId)
  if (idx < 0 || idx >= RECENCY_PENALTIES.length) return 0
  return RECENCY_PENALTIES[idx]
}

function pickWeighted(candidates) {
  if (!candidates.length) return null
  const weights = candidates.map((plan) => Math.exp((plan._score || 0) / TAIL_SOFTMAX_TEMP))
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)]
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

const CITY_SEQUENCE_PROFILES = {
  Jerusalem: {
    atmosphere: {
      primaryBoost: ['food', 'lounges', 'culture'],
      sequence: [['outdoors', 'culture'], ['food', 'lounges'], ['food', 'dessert']],
    },
    'food-drink': {
      primaryBoost: ['food', 'winery'],
      sequence: [['food'], ['outdoors', 'culture'], ['food', 'dessert']],
    },
    activity: {
      primaryBoost: ['activity', 'culture'],
      sequence: [['activity', 'culture'], ['food'], ['outdoors', 'dessert']],
    },
    outdoors: {
      primaryBoost: ['outdoors'],
      sequence: [['outdoors'], ['food', 'lounges'], ['dessert']],
    },
  },
  'Tel Aviv': {
    atmosphere: {
      primaryBoost: ['lounges', 'food', 'outdoors'],
      sequence: [['outdoors', 'lounges'], ['food'], ['dessert', 'lounges']],
    },
    'food-drink': {
      primaryBoost: ['food', 'lounges'],
      sequence: [['food'], ['outdoors'], ['dessert', 'lounges']],
    },
    activity: {
      primaryBoost: ['activity', 'outdoors'],
      sequence: [['activity', 'outdoors'], ['food'], ['lounges', 'dessert']],
    },
    outdoors: {
      primaryBoost: ['outdoors'],
      sequence: [['outdoors'], ['food', 'lounges'], ['dessert']],
    },
  },
  "Modi'in": {
    atmosphere: {
      primaryBoost: ['food'],
      sequence: [['food'], ['outdoors'], ['dessert']],
    },
    'food-drink': {
      primaryBoost: ['food'],
      sequence: [['food'], ['outdoors'], ['dessert']],
    },
    activity: {
      primaryBoost: ['activity'],
      sequence: [['activity'], ['food'], ['dessert']],
    },
    outdoors: {
      primaryBoost: ['outdoors'],
      sequence: [['outdoors'], ['food'], ['dessert']],
    },
  },
  'Beit Shemesh': {
    atmosphere: {
      primaryBoost: ['outdoors', 'food'],
      sequence: [['outdoors'], ['food'], ['dessert']],
    },
    'food-drink': {
      primaryBoost: ['food'],
      sequence: [['food'], ['outdoors'], ['dessert']],
    },
    activity: {
      primaryBoost: ['activity', 'outdoors'],
      sequence: [['activity', 'outdoors'], ['food'], ['dessert']],
    },
    outdoors: {
      primaryBoost: ['outdoors'],
      sequence: [['outdoors'], ['food'], ['dessert']],
    },
  },
  'Tzur Hadassah': {
    atmosphere: {
      primaryBoost: ['outdoors', 'food'],
      sequence: [['outdoors'], ['food'], ['dessert']],
    },
    'food-drink': {
      primaryBoost: ['food'],
      sequence: [['food'], ['outdoors'], ['dessert']],
    },
    activity: {
      primaryBoost: ['activity', 'outdoors'],
      sequence: [['activity'], ['food'], ['dessert']],
    },
    outdoors: {
      primaryBoost: ['outdoors'],
      sequence: [['outdoors'], ['food'], ['dessert']],
    },
  },
}

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

function deriveFocusTags(location) {
  const category = normalizeCategory(location.category)
  const occasions = normalizeOccasions(location.occasion)
  const tags = new Set()

  if (category === 'food' || category === 'winery' || category === 'lounges') tags.add('food-drink')
  if (category === 'activity' || category === 'culture') tags.add('activity')
  if (category === 'outdoors') tags.add('outdoors')
  if (occasions.has('romantic') || occasions.has('views') || occasions.has('evening') || category === 'lounges') tags.add('atmosphere')

  if (!tags.size) tags.add('atmosphere')
  return [...tags]
}

function deriveSeriousnessTags(location) {
  const stages = Array.isArray(location.date_stage) ? location.date_stage : [location.date_stage].filter(Boolean)
  const tags = new Set()
  if (stages.includes(1)) tags.add('just-met')
  if (stages.includes(2)) tags.add('getting-to-know')
  if (stages.includes(3)) tags.add('getting-serious')
  if (!tags.size) tags.add('getting-to-know')
  return [...tags]
}

function deriveWhenTags(location) {
  const occasions = normalizeOccasions(location.occasion)
  const tags = new Set(['planning-ahead'])

  if (occasions.has('evening') || occasions.has('first date') || occasions.has('casual') || occasions.has('romantic')) {
    tags.add('tonight')
    tags.add('thursday-night')
  }

  return [...tags]
}

function deriveLengthTags(location) {
  const category = normalizeCategory(location.category)
  const occasions = normalizeOccasions(location.occasion)
  const tags = new Set()

  if (location.price <= 2 && (occasions.has('first date') || occasions.has('casual') || category === 'food')) {
    tags.add('short')
  }

  if (category === 'activity' || category === 'outdoors' || category === 'culture' || occasions.has('evening') || occasions.has('romantic')) {
    tags.add('medium')
  }

  if (location.price >= 3 || category === 'winery' || category === 'lounges' || occasions.has('upscale') || occasions.has('unique')) {
    tags.add('long')
  }

  if (!tags.size) tags.add('medium')
  return [...tags]
}

function buildBudgetText(price, lang) {
  const map = {
    1: { en: '₪60-100 per person', he: '60-100 ₪ לאדם' },
    2: { en: '₪90-140 per person', he: '90-140 ₪ לאדם' },
    3: { en: '₪140-210 per person', he: '140-210 ₪ לאדם' },
    4: { en: '₪200-320 per person', he: '200-320 ₪ לאדם' },
  }

  return map[price]?.[lang] || map[2][lang]
}

function buildDurationText(length, lang) {
  const map = {
    short: { en: 'About 2 hours', he: 'בערך שעתיים' },
    medium: { en: 'About 3 hours', he: 'בערך 3 שעות' },
    long: { en: 'About 4 hours', he: 'בערך 4 שעות' },
  }

  return map[length]?.[lang] || map.medium[lang]
}

function buildStartTimeText(when, lang) {
  const map = {
    tonight: { en: 'Best start: 6:45pm', he: 'הזמן הכי טוב להתחיל: 18:45' },
    'thursday-night': { en: 'Best start: 7:00pm', he: 'הזמן הכי טוב להתחיל: 19:00' },
    'planning-ahead': { en: 'Best start: 5:30pm', he: 'הזמן הכי טוב להתחיל: 17:30' },
  }

  return map[when]?.[lang] || map.tonight[lang]
}

function buildIdentity(focus, seriousness, lang) {
  const key = `${focus}:${seriousness}`
  const map = {
    'food-drink:just-met': { en: 'The Easy Charmer', he: 'הכובש בקלות' },
    'food-drink:getting-to-know': { en: 'The Warm Conversationalist', he: 'איש השיחה החם' },
    'food-drink:getting-serious': { en: 'The Intentional Romantic', he: 'הרומנטיקן המכוון' },
    'activity:just-met': { en: 'The Playful Connector', he: 'המחבר המשחקי' },
    'activity:getting-to-know': { en: 'The Energetic Explorer', he: 'החוקר האנרגטי' },
    'activity:getting-serious': { en: 'The Intentional Explorer', he: 'החוקר המכוון' },
    'outdoors:just-met': { en: 'The Calm Starter', he: 'המתחיל הרגוע' },
    'outdoors:getting-to-know': { en: 'The Calm Adventurer', he: 'ההרפתקן הרגוע' },
    'outdoors:getting-serious': { en: 'The Gentle Planner', he: 'המתכנן העדין' },
    'atmosphere:just-met': { en: 'The Easy Romantic', he: 'הרומנטיקן הקליל' },
    'atmosphere:getting-to-know': { en: 'The Thoughtful Explorer', he: 'החוקר המתחשב' },
    'atmosphere:getting-serious': { en: 'The Quiet Romantic', he: 'הרומנטיקן השקט' },
  }

  return map[key]?.[lang] || (lang === 'he' ? 'הדייטר המכוון' : 'The Intentional Dater')
}

function buildLocationUsageProfile(behavior = {}) {
  const locationWeights = {}

  const add = (locationId, amount) => {
    if (!locationId && locationId !== 0) return
    const key = String(locationId)
    locationWeights[key] = (locationWeights[key] || 0) + amount
  }

  ;(behavior.savedPlaceIds || []).forEach((id) => add(id, 1.4))

  Object.entries(behavior.clickedLocationCounts || {}).forEach(([id, count]) => {
    add(id, Math.min(Number(count) || 0, 5) * 0.25)
  })

  Object.entries(behavior.feedbackByItem || {}).forEach(([key, feedback]) => {
    if (!feedback) return

    if (key.startsWith('place:')) {
      const locationId = key.replace('place:', '')
      if (feedback.went === false) add(locationId, -2)
      if ((feedback.rating || 0) >= 4) add(locationId, feedback.again ? 2.4 : 1.2)
      if ((feedback.rating || 0) <= 2) add(locationId, -3.2)
    }

    if (key.startsWith('plan:generated-location-plan-')) {
      const locationId = key.replace('plan:generated-location-plan-', '')
      if (feedback.went === false) add(locationId, -1.8)
      if ((feedback.rating || 0) >= 4) add(locationId, feedback.again ? 2 : 1)
      if ((feedback.rating || 0) <= 2) add(locationId, -3)
    }
  })

  return { locationWeights }
}

function getCitySequenceProfile(city, focus) {
  return CITY_SEQUENCE_PROFILES[city]?.[focus] || {
    primaryBoost: focus === 'activity' ? ['activity', 'culture'] : focus === 'outdoors' ? ['outdoors'] : ['food', 'lounges', 'winery'],
    sequence:
      focus === 'activity'
        ? [['activity', 'culture'], ['food'], ['dessert', 'outdoors']]
        : focus === 'outdoors'
          ? [['outdoors'], ['food', 'lounges'], ['dessert']]
          : [['food', 'lounges'], ['outdoors', 'culture'], ['dessert']],
  }
}

function getDesiredStopCount(length) {
  // We always *try* for 3 stops. If the data can't support it the loop in
  // buildSupportStops breaks gracefully at score>1 and we return 2 stops.
  // 'short' used to mechanically cap to 2 even when a great third stop
  // existed — that's the "felt random" failure mode. Length now flows into
  // scoring + copy only.
  if (length === 'short') return 2
  return 3
}

function inferLength(answers) {
  if (answers.length) return answers.length
  // No user-provided length → infer from focus + seriousness so downstream
  // copy and scoring still get a coherent value.
  if (answers.seriousness === 'just-met') return 'short'
  if (answers.seriousness === 'getting-serious') return 'long'
  if (answers.focus === 'food-drink' || answers.focus === 'outdoors') return 'medium'
  return 'medium'
}

function isVeryDisliked(location, usageProfile) {
  return (usageProfile.locationWeights[String(location.id)] || 0) <= -3
}

function scorePrimaryBoost(location, answers, usageProfile) {
  const category = normalizeCategory(location.category)
  const cityProfile = getCitySequenceProfile(location.city, answers.focus)
  const occasions = normalizeOccasions(location.occasion)
  let score = usageProfile.locationWeights[String(location.id)] || 0

  if (cityProfile.primaryBoost.includes(category)) score += 2.5
  if (answers.focus === 'atmosphere' && (occasions.has('romantic') || occasions.has('views') || occasions.has('evening'))) score += 1.6
  if (answers.focus === 'food-drink' && (category === 'food' || category === 'winery' || category === 'lounges')) score += 1.4
  if (answers.focus === 'activity' && (category === 'activity' || category === 'culture')) score += 1.6
  if (answers.focus === 'outdoors' && category === 'outdoors') score += 1.8

  if (answers.seriousness === 'just-met' && location.price <= 2) score += 1
  if (answers.seriousness === 'getting-serious' && location.price >= 3) score += 0.8

  return score
}

function scoreSupportStop(primary, candidate, answers, usageProfile, stopIndex, selectedIds = [], totalStops = 3, prevStop = null, selectedStops = []) {
  if (candidate.id === primary.id) return -Infinity
  if (candidate.city !== primary.city) return -Infinity
  if (selectedIds.includes(candidate.id)) return -Infinity
  if (isVeryDisliked(candidate, usageProfile)) return -Infinity
  // Same-city is necessary but not sufficient: 'Various' chain rows or rows
  // with bad coord data can be in the same city label yet 30km apart. Reject
  // anything outside walkable/short-drive radius of the anchor we're chaining
  // off (previous stop, or primary for stop 2).
  const anchor = prevStop || primary
  if (!sameLocale(anchor, candidate)) return -Infinity

  // H7 (DATE_PLANNING_RULES): hard distance cap. A leg over MAX_LEG_KM from the
  // previous stop is rejected outright — we return a shorter plan rather than
  // drag the user across town (kills the proven 2.96–5.69 km legs).
  const leg = distanceKm(anchor, candidate)
  if (leg != null && leg > MAX_LEG_KM) return -Infinity

  // H6: no two dinners / heavy-food stops. Reject a candidate that would create
  // a second heavy meal, or a food→food adjacency that isn't a light follow-on
  // (dessert/bar). Blocks restaurant→restaurant and café→restaurant.
  if (violatesFoodPairing(selectedStops, candidate, prevStop)) return -Infinity

  const candidateCategory = normalizeCategory(candidate.category)
  const primaryCategory = normalizeCategory(primary.category)
  const candidateOccasions = normalizeOccasions(candidate.occasion)
  const cityProfile = getCitySequenceProfile(primary.city, answers.focus)
  const preferredCategories = cityProfile.sequence[stopIndex] || cityProfile.sequence[cityProfile.sequence.length - 1] || []
  const candidateStages = Array.isArray(candidate.date_stage) ? candidate.date_stage : [candidate.date_stage].filter(Boolean)
  const primaryStages = Array.isArray(primary.date_stage) ? primary.date_stage : [primary.date_stage].filter(Boolean)
  let score = usageProfile.locationWeights[String(candidate.id)] || 0

  if (preferredCategories.includes(candidateCategory)) score += 5
  if (candidateCategory !== primaryCategory) score += 1.8
  score += candidateStages.filter((stage) => primaryStages.includes(stage)).length * 1.3

  // Anti-repetition (RULE 2): a date is not three sit-down food/café spots in a
  // row. Each additional sit-down food stop after the first takes a heavy
  // penalty, so a walk / activity / dessert / bar wins whenever one is viable.
  // It only survives when nothing else clears the bar ("unless no better option").
  const isSitDownFood = (loc) => {
    const w = foodClassOf(loc).meal_weight
    return w === 'heavy' || w === 'medium'
  }
  const sitDownSoFar = (selectedStops || []).filter(isSitDownFood).length
  if (isSitDownFood(candidate) && sitDownSoFar >= 1) score -= 4

  // Change-of-energy (RULE 1): the middle stop should reset the pace, so reward
  // a broad category change specifically at the transition slot.
  if (stopIndex === 1 && candidateCategory !== primaryCategory) score += 2

  if (answers.length === 'short' && candidate.price <= 2) score += 1
  if (answers.length === 'long' && candidate.price >= 3) score += 0.9
  if (candidateOccasions.has('romantic') || candidateOccasions.has('views') || candidateOccasions.has('evening')) score += 0.75
  if (candidateOccasions.has('first date') && answers.seriousness === 'just-met') score += 0.9
  if (candidateOccasions.has('upscale') && answers.seriousness === 'getting-serious') score += 0.75

  // Coherence: proximity, emotional flow, time-of-day fit relative to the
  // immediately previous stop (or the primary anchor if this is stop 2).
  score += proximityScore(anchor, candidate)
  score += flowCompatibility(anchor, candidate).delta
  score += timeFitForStopIndex(candidate, stopIndex, totalStops)

  return score
}

function buildSupportStops(primary, locations, answers, usageProfile) {
  const desiredCount = getDesiredStopCount(answers.length)
  const chosen = []
  const selectedIds = [primary.id]

  while (chosen.length < desiredCount - 1) {
    const prevStop = chosen.length ? chosen[chosen.length - 1] : null
    const selectedStops = [primary, ...chosen]
    const next = [...locations]
      .map((candidate) => ({
        candidate,
        score: scoreSupportStop(
          primary, candidate, answers, usageProfile,
          chosen.length + 1, selectedIds, desiredCount, prevStop, selectedStops,
        ),
      }))
      .filter((entry) => entry.score > 1)
      .sort((left, right) => right.score - left.score)[0]

    if (!next) break

    chosen.push(next.candidate)
    selectedIds.push(next.candidate.id)
  }

  return chosen
}

// Finer-grained stop type than normalizeCategory: splits food into
// restaurant / café / dessert / bar so copy and timing can differ.
function stopKind(location) {
  const category = normalizeCategory(location.category)
  if (category === 'food') {
    const ftype = foodClassOf(location).food_type
    if (ftype === 'dessert') return 'dessert'
    if (ftype === 'cafe') return 'cafe'
    if (ftype === 'bar') return 'bar'
    return 'food' // sit-down restaurant
  }
  return category // outdoors | activity | culture | lounges | winery | other
}

// Rough, honest per-stop time estimate (RULE 5). Deliberately fuzzy ("about")
// since real dwell time varies — it's for pacing expectation, not a schedule.
function stopDurationText(kind, lang) {
  const map = {
    food:     { en: 'about 1 hr',   he: 'כשעה' },
    cafe:     { en: 'about 40 min', he: 'כ-40 דק׳' },
    dessert:  { en: 'about 30 min', he: 'כ-30 דק׳' },
    bar:      { en: 'about 45 min', he: 'כ-45 דק׳' },
    lounges:  { en: 'about 45 min', he: 'כ-45 דק׳' },
    winery:   { en: 'about 45 min', he: 'כ-45 דק׳' },
    outdoors: { en: '30–40 min',    he: '30–40 דק׳' },
    activity: { en: 'about 1 hr',   he: 'כשעה' },
    culture:  { en: 'about 1 hr',   he: 'כשעה' },
    other:    { en: 'about 45 min', he: 'כ-45 דק׳' },
  }
  return (map[kind] || map.other)[lang]
}

// Role-aware stop copy (RULE 4). Each role has a distinct purpose:
//   anchor     → easy start / food / conversation
//   transition → reset the energy / short walk / dessert / lighter activity
//   extension  → optional, only if the night is going well
function buildStop(location, role) {
  const kind = stopKind(location)
  let instruction_en = ''
  let instruction_he = ''
  let order_tip_en = ''
  let order_tip_he = ''

  if (role === 'anchor') {
    if (kind === 'food' || kind === 'cafe') {
      instruction_en = 'Start here and settle in — keep the first stop easy and conversational.'
      instruction_he = 'מתחילים כאן ומתמקמים — שומרים על התחנה הראשונה קלה ונעימה לשיחה.'
      order_tip_en = 'Don’t over-order at the start — leave room for the rest of the night.'
      order_tip_he = 'אל תזמינו יותר מדי בהתחלה — תשאירו מקום להמשך.'
    } else if (kind === 'outdoors') {
      instruction_en = 'Begin outside — a little movement makes the first conversation easy.'
      instruction_he = 'מתחילים בחוץ — קצת תנועה עושה את השיחה הראשונה קלה.'
    } else if (kind === 'activity' || kind === 'culture') {
      instruction_en = 'Open with one thing to do together — it takes the pressure off talking.'
      instruction_he = 'פותחים בפעילות משותפת אחת — זה מוריד את הלחץ מהשיחה.'
    } else {
      instruction_en = 'Start here and let this set the tone for the night.'
      instruction_he = 'מתחילים כאן ונותנים לזה לקבוע את הטון של הערב.'
    }
  } else if (role === 'transition') {
    if (kind === 'outdoors') {
      instruction_en = 'Walk it off here — a change of scene resets the energy and keeps things moving.'
      instruction_he = 'עושים הליכה כאן — שינוי תפאורה מאפס את האנרגיה ושומר על תנועה.'
    } else if (kind === 'dessert') {
      instruction_en = 'Switch to something sweet — a lighter beat after sitting down.'
      instruction_he = 'עוברים למשהו מתוק — תחנה קלילה אחרי הישיבה.'
    } else if (kind === 'cafe') {
      instruction_en = 'Move to a calmer table to shift gears and keep the conversation going.'
      instruction_he = 'עוברים לשולחן רגוע יותר כדי להחליף הילוך ולהמשיך בשיחה.'
    } else if (kind === 'activity' || kind === 'culture') {
      instruction_en = 'Do something together here — it changes the rhythm of the date.'
      instruction_he = 'עושים משהו יחד כאן — זה משנה את הקצב של הדייט.'
    } else if (kind === 'bar' || kind === 'lounges' || kind === 'winery') {
      instruction_en = 'Move somewhere with a bit more mood and let the pace slow down.'
      instruction_he = 'עוברים למקום עם קצת יותר אווירה ונותנים לקצב להאט.'
    } else {
      instruction_en = 'Change the scene here to give the night a natural second beat.'
      instruction_he = 'מחליפים תפאורה כאן כדי לתת לערב פעימה שנייה טבעית.'
    }
  } else { // extension
    if (kind === 'dessert') {
      instruction_en = 'End on something sweet — only if the night still has momentum.'
      instruction_he = 'מסיימים במשהו מתוק — רק אם הערב עדיין זורם.'
    } else if (kind === 'outdoors') {
      instruction_en = 'A last stroll to stretch the evening — only if it’s going well.'
      instruction_he = 'סיבוב אחרון להאריך את הערב — רק אם הולך טוב.'
    } else if (kind === 'bar' || kind === 'lounges' || kind === 'winery') {
      instruction_en = 'A relaxed nightcap to round things off — if you’re both still into it.'
      instruction_he = 'כוסית רגועה לסיום — אם בא לשניכם להמשיך.'
    } else {
      instruction_en = 'A relaxed last stop to round off the night — if the timing feels right.'
      instruction_he = 'תחנה אחרונה רגועה לסיום הערב — אם העיתוי מרגיש נכון.'
    }
    order_tip_en = 'Totally optional — end earlier with zero guilt if it feels right.'
    order_tip_he = 'אופציונלי לגמרי — אפשר לסיים מוקדם בלי שום אשמה.'
  }

  return {
    name_en: location.name,
    name_he: location.name_he || location.name,
    role,
    kind,
    duration_text_en: stopDurationText(kind, 'en'),
    duration_text_he: stopDurationText(kind, 'he'),
    instruction_en,
    instruction_he,
    order_tip_en,
    order_tip_he,
    maps_query: location.maps_query,
    lat: location.lat,
    lng: location.lng,
    source_location_id: location.id,
  }
}

// "Why this route works" (RULE 5) — built from the actual stop roles + types,
// plus a positive framing when the stops form a tight walkable cluster (RULE 3).
function buildRouteReason(stops, walkCluster, lang) {
  const kinds = stops.map((s) => s.kind)
  const hasExtension = stops.some((s) => s.role === 'extension')
  const allFood = kinds.every((k) => ['food', 'cafe', 'dessert', 'bar'].includes(k))

  if (lang === 'he') {
    let base = hasExtension
      ? 'מקום מרכזי אחד להתמקם בו, שינוי קצב באמצע, וסיום אופציונלי אם הערב זורם.'
      : 'מקום מרכזי אחד להתמקם בו ואז שינוי קצב — מספיק כדי שהערב ירגיש מתוכנן בלי להעמיס.'
    if (allFood) base = 'כל העצירות סביב אוכל ושתייה, אבל בנויות לעלות בהדרגה מקליל לסיום מתוק — לא אותו דבר שלוש פעמים.'
    if (walkCluster) base += ' הכול במרחק כמה דקות הליכה, כך שאף פעם לא רצים בין המקומות.'
    return base
  }

  let base = hasExtension
    ? 'One main spot to settle into, a change of pace in the middle, and an optional finish if the night’s going well.'
    : 'One main spot to settle into, then a change of pace — enough to feel planned without overloading the night.'
  if (allFood) base = 'These all center on food and drink, but they’re sequenced to build from easy to a sweeter finish — not the same thing three times.'
  if (walkCluster) base += ' Everything’s within a couple of minutes’ walk, so you’re never rushing between stops.'
  return base
}

function buildGeneratedNarrative(primary, answers, lang) {
  const category = normalizeCategory(primary.category)
  const city = lang === 'he' ? primary.city_he || primary.city : primary.city
  const focusMap = {
    atmosphere: lang === 'he' ? 'אווירה טובה' : 'strong atmosphere',
    'food-drink': lang === 'he' ? 'אוכל ושתייה טובים' : 'good food and drink',
    activity: lang === 'he' ? 'משהו לעשות יחד' : 'something to do together',
    outdoors: lang === 'he' ? 'אוויר, תנועה ומרחב' : 'air, movement, and space',
  }
  const seriousnessMap = {
    'just-met': lang === 'he' ? 'בלי לחץ מיותר' : 'without unnecessary pressure',
    'getting-to-know': lang === 'he' ? 'עם מקום לשיחה אמיתית' : 'with room for real conversation',
    'getting-serious': lang === 'he' ? 'בצורה יותר מכוונת' : 'in a more intentional way',
  }

  if (lang === 'he') {
    if (category === 'food') return `בנינו סביב ${primary.name_he || primary.name} תוכנית ב${city} עם ${focusMap[answers.focus]}, ${seriousnessMap[answers.seriousness]}, וקצב ${answers.length === 'short' ? 'קליל' : answers.length === 'long' ? 'ארוך יותר' : 'מאוזן'}.`
    if (category === 'outdoors') return `${primary.name_he || primary.name} הופך לעוגן של ערב ב${city} עם מרחב, שיחה טובה, והמשך שמסתדר עם הוייב שבחרתם.`
    if (category === 'activity' || category === 'culture') return `${primary.name_he || primary.name} נותן פתיחה עם אנרגיה, ואז הערב מתארגן סביב זה בצורה טבעית יותר.`
    return `התוכנית הזו נבנתה סביב ${primary.name_he || primary.name} ב${city} כדי לתת לכם דייט שנראה מתוכנן, אבל עדיין מרגיש זורם.`
  }

  if (category === 'food') return `We built this around ${primary.name} in ${city} so you get ${focusMap[answers.focus]}, a pace that feels right, and a date that works ${seriousnessMap[answers.seriousness]}.`
  if (category === 'outdoors') return `${primary.name} becomes the anchor for a ${city} date with space, movement, and a smoother flow after the first stop.`
  if (category === 'activity' || category === 'culture') return `${primary.name} gives the date an easy opening activity, then the rest of the night settles in naturally around it.`
  return `This plan is built around ${primary.name} in ${city} to feel considered, executable, and matched to the tone you picked.`
}

function buildGeneratedTitle(primary, answers, lang) {
  const city = lang === 'he' ? primary.city_he || primary.city : primary.city
  const category = normalizeCategory(primary.category)

  if (lang === 'he') {
    if (answers.focus === 'food-drink' && answers.seriousness === 'just-met') return `${city} - ${primary.name_he || primary.name} והמשך קל`
    if (answers.focus === 'outdoors') return `${city} - נוף, הליכה ו${primary.name_he || primary.name}`
    if (answers.focus === 'activity') return `${city} - ${primary.name_he || primary.name} ואז ארוחה`
    if (category === 'food') return `${city} - ${primary.name_he || primary.name} ודייט זורם`
    return `${city} - ערב סביב ${primary.name_he || primary.name}`
  }

  if (answers.focus === 'food-drink' && answers.seriousness === 'just-met') return `${city} - ${primary.name} and an Easy Flow`
  if (answers.focus === 'outdoors') return `${city} - View, Walk, and ${primary.name}`
  if (answers.focus === 'activity') return `${city} - ${primary.name} Then Dinner`
  if (category === 'food') return `${city} - ${primary.name} and a Smooth Date`
  return `${city} - An Evening Around ${primary.name}`
}

function buildGeneratedShareSummary(primary, supportStops, lang) {
  const stopTwo = supportStops[0]

  if (lang === 'he') {
    if (stopTwo) {
      return `מתחילים ב${primary.name_he || primary.name}, ואז ממשיכים ל${stopTwo.name_he || stopTwo.name} כדי לתת לערב מבנה טבעי.`
    }

    return `מתחילים ב${primary.name_he || primary.name} ומשם נותנים לערב להמשיך בקצב נכון ופשוט.`
  }

  if (stopTwo) {
    return `Start at ${primary.name}, then continue to ${stopTwo.name} so the date has a natural second beat.`
  }

  return `Start at ${primary.name} and let the night unfold from one strong first move.`
}

function buildGeneratedPlan(location, locations, answers, behavior, usageProfile) {
  if (isVeryDisliked(location, usageProfile)) return null

  // Length is optional in the quiz now; infer when missing.
  const effectiveAnswers = answers.length ? answers : { ...answers, length: inferLength(answers) }
  answers = effectiveAnswers

  const locationScore = scoreLocation(location, answers, behavior)
  const focusTags = deriveFocusTags(location)
  const seriousnessTags = deriveSeriousnessTags(location)
  const whenTags = deriveWhenTags(location)
  const lengthTags = deriveLengthTags(location)
  const supportLocations = buildSupportStops(location, locations, answers, usageProfile)
  // A one-stop "plan" is not a plan — it's a place. Drop so the caller can
  // either pick the next anchor or, if every anchor fails, surface an
  // explicit "not enough strong options yet" fallback.
  if (supportLocations.length === 0) return null
  const focus = focusTags.includes(answers.focus) ? answers.focus : focusTags[0]
  const seriousness = seriousnessTags.includes(answers.seriousness) ? answers.seriousness : seriousnessTags[0]
  const chosenLength = lengthTags.includes(answers.length) ? answers.length : lengthTags[0]
  const when = whenTags.includes(answers.when) ? answers.when : whenTags[0]
  const title_en = buildGeneratedTitle(location, { ...answers, focus }, 'en')
  const title_he = buildGeneratedTitle(location, { ...answers, focus }, 'he')
  const narrative_en = buildGeneratedNarrative(location, { ...answers, focus, seriousness, length: chosenLength }, 'en')
  const narrative_he = buildGeneratedNarrative(location, { ...answers, focus, seriousness, length: chosenLength }, 'he')
  // Role-based composition (RULE 1): anchor → transition → optional extension.
  // 2-stop plans are anchor + transition; the 3rd (when present) is the extension.
  const stopLocations = [location, ...supportLocations]
  const lastIndex = stopLocations.length - 1
  const stops = stopLocations.map((loc, index) => {
    const role = index === 0
      ? 'anchor'
      : index === lastIndex && stopLocations.length >= 3
        ? 'extension'
        : 'transition'
    return buildStop(loc, role)
  })

  // Leg distances → "walkable cluster" framing (RULE 3) + route reason (RULE 5).
  const legKms = []
  for (let i = 1; i < stopLocations.length; i += 1) {
    const d = distanceKm(stopLocations[i - 1], stopLocations[i])
    if (d != null) legKms.push(d)
  }
  const walkCluster = legKms.length > 0 && legKms.every((d) => d <= 0.4)
  const route_reason_en = buildRouteReason(stops, walkCluster, 'en')
  const route_reason_he = buildRouteReason(stops, walkCluster, 'he')

  const supportScore = supportLocations.reduce((sum, stop) => sum + Math.max(usageProfile.locationWeights[String(stop.id)] || 0, 0), 0)

  // Coherence metadata: same source rows the engine actually scored against
  // so the debug surface reflects reality.
  const composeStops = [location, ...supportLocations]
  const cityProfile = getCitySequenceProfile(location.city, answers.focus)
  const _compose = buildComposeMetadata(composeStops, {
    engine: 'generated-location',
    templateUsed: `CITY_SEQUENCE_PROFILES.${location.city}.${answers.focus}`,
    length: chosenLength,
    sequence: cityProfile.sequence,
  })
  const flowPenalty = _compose.flowWarnings.length * 1.5

  return {
    id: `generated-location-plan-${location.id}`,
    slug: `generated-location-plan-${location.id}`,
    title_en,
    title_he,
    identity_label_en: buildIdentity(focus, seriousness, 'en'),
    identity_label_he: buildIdentity(focus, seriousness, 'he'),
    when_tags: whenTags,
    focus_tags: focusTags,
    seriousness_tags: seriousnessTags,
    length_tags: lengthTags,
    city: location.city,
    region: location.region || '',
    narrative_en,
    narrative_he,
    start_time_text_en: buildStartTimeText(when, 'en'),
    start_time_text_he: buildStartTimeText(when, 'he'),
    duration_text_en: buildDurationText(chosenLength, 'en'),
    duration_text_he: buildDurationText(chosenLength, 'he'),
    budget_text_en: buildBudgetText(location.price, 'en'),
    budget_text_he: buildBudgetText(location.price, 'he'),
    share_summary_en: buildGeneratedShareSummary(location, supportLocations, 'en'),
    share_summary_he: buildGeneratedShareSummary(location, supportLocations, 'he'),
    route_reason_en,
    route_reason_he,
    walk_cluster: walkCluster,
    featured: Boolean(location.featured),
    tonight_pick_weight: 0,
    stops,
    source_type: 'generated-location',
    source_location_ids: [location.id, ...supportLocations.map((item) => item.id)],
    _compose,
    _flowWarnings: _compose.flowWarnings,
    _cityMismatch: Boolean(
      answers.city && answers.city !== 'flexible' && location.city !== answers.city
    ),
    _score:
      locationScore +
      scorePrimaryBoost(location, answers, usageProfile) +
      supportScore +
      supportLocations.length * 0.9 -
      flowPenalty,
  }
}

export function getSmartMatchedPlans(curatedPlans, locations, answers, count = 2, behavior = {}) {
  const usageProfile = buildLocationUsageProfile(behavior)

  // Venue-level hard gates (DATE_PLANNING_RULES H1/H2/H3): only OPERATIONAL,
  // real venues are eligible — as anchors AND as support stops. Closed/temp-
  // closed/unknown rows are removed before any composition happens.
  const pool = plannableLocations(locations)

  const wantsCity = answers.city && answers.city !== 'flexible'
  const curated = getMatchedPlans(curatedPlans, answers, curatedPlans.length, behavior)
    // H5: drop placeholder/generic plans — every stop must link to a real venue.
    // H4: a curated plan must match the chosen city (no cross-city fallback).
    .filter((plan) => isRealPlan(plan) && (!wantsCity || sameCity(plan.city, answers.city)))
    .map((plan) => ({
      ...plan,
      source_type: plan.source_type || 'curated',
      _compose: plan._compose || { engine: 'curated', flowWarnings: [], legs: [], flowDeltas: [], derivedVibes: [] },
      _flowWarnings: plan._flowWarnings || [],
    }))

  // City-scoped anchor pool: when the user picked a real city, only that
  // city's rows can anchor a generated plan. Prevents cross-city anchors
  // from competing with same-city plans on raw score. Curated plans still
  // flow through getMatchedPlans above with their existing soft penalty so
  // a thoughtful Tel Aviv plan can still show for a Jerusalem user if no
  // generated plan beats it.
  let anchorPool = wantsCity
    ? pool.filter((l) => sameCity(l.city, answers.city))
    : pool

  // Focus-scoped anchor pool: prefer anchors that carry the user's stated
  // focus. Without this, a high-curation cafe can out-score the city's only
  // park even when the user picked focus=outdoors.
  //
  // If the user picked a specific city AND that city has zero in-focus
  // anchors, return no generated plans. A wrong-category "plan" is worse
  // than an honest "not enough options yet" fallback. (Flexible city still
  // falls through because globally we always have in-focus anchors.)
  if (answers.focus) {
    const focusMatched = anchorPool.filter((l) => deriveFocusTags(l).includes(answers.focus))
    if (focusMatched.length > 0) {
      anchorPool = focusMatched
    } else if (answers.city && answers.city !== 'flexible') {
      anchorPool = []
    }
  }

  const generated = anchorPool
    .map((location) => buildGeneratedPlan(location, pool, answers, behavior, usageProfile))
    .filter(Boolean)

  const recentIds = getRecentPlanIds()
  const adjusted = [...curated, ...generated].map((plan) => ({
    ...plan,
    _score: (plan._score || 0) - recencyPenalty(plan.id, recentIds),
  }))
  const combined = adjusted.sort((left, right) => (right._score || 0) - (left._score || 0))
  const seenKeys = new Set()
  const deduped = []

  combined.forEach((plan) => {
    const key = `${plan.city}:${plan.title_en}`
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    deduped.push(plan)
  })

  if (!deduped.length) return []

  const topScore = deduped[0]._score || 0
  const bandThreshold = topScore - SCORE_BAND_WIDTH
  const band = []
  const tail = []
  deduped.forEach((plan) => {
    if ((plan._score || 0) >= bandThreshold) band.push(plan)
    else tail.push(plan)
  })

  shuffleInPlace(band)
  const result = [...band, ...tail].slice(0, count)

  if (count > 0 && Math.random() < EXPLORATION_RATE) {
    const selectedIds = new Set(result.map((plan) => plan.id))
    const tailEligible = tail.filter(
      (plan) => (plan._score || 0) >= MIN_ELIGIBLE_SCORE && !selectedIds.has(plan.id)
    )
    const pick = pickWeighted(tailEligible)
    if (pick) result[result.length - 1] = pick
  }

  return result
}

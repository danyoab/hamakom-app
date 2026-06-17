import { getMatchedPlans } from './quiz.js'
import { scoreLocation } from './locationRecommendations.js'
import {
  proximityScore,
  flowCompatibility,
  timeFitForStopIndex,
  buildComposeMetadata,
  sameLocale,
} from './planCoherence.js'

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

function scoreSupportStop(primary, candidate, answers, usageProfile, stopIndex, selectedIds = [], totalStops = 3, prevStop = null) {
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
    const next = [...locations]
      .map((candidate) => ({
        candidate,
        score: scoreSupportStop(
          primary, candidate, answers, usageProfile,
          chosen.length + 1, selectedIds, desiredCount, prevStop,
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

function buildPrimaryStop(location) {
  const category = normalizeCategory(location.category)
  let instructionEn = `Start at ${location.name}. Let this be the anchor of the night.`
  let instructionHe = `מתחילים ב${location.name_he || location.name}. זה העוגן של הערב.`
  let orderTipEn = ''
  let orderTipHe = ''

  if (category === 'food') {
    instructionEn = `Start at ${location.name} and keep the first stop easy and conversational.`
    instructionHe = `מתחילים ב${location.name_he || location.name} ושומרים על התחנה הראשונה קלה ונעימה לשיחה.`
    orderTipEn = 'Do not over-order at the beginning of the date.'
    orderTipHe = 'אל תזמינו יותר מדי בתחילת הדייט.'
  } else if (category === 'outdoors') {
    instructionEn = `Start outdoors at ${location.name} and let the movement open the conversation naturally.`
    instructionHe = `מתחילים בחוץ ב${location.name_he || location.name} ונותנים לתנועה לפתוח את השיחה טבעי.`
  } else if (category === 'activity' || category === 'culture') {
    instructionEn = `Open the night at ${location.name} with one shared activity, not a marathon.`
    instructionHe = `פותחים את הערב ב${location.name_he || location.name} עם פעילות אחת משותפת, לא מרתון.`
  } else if (category === 'lounges' || category === 'winery') {
    instructionEn = `Begin at ${location.name} and keep this part refined but not too heavy.`
    instructionHe = `מתחילים ב${location.name_he || location.name} ושומרים על החלק הזה מוקפד אבל לא כבד מדי.`
  }

  return {
    name_en: location.name,
    name_he: location.name_he || location.name,
    instruction_en: instructionEn,
    instruction_he: instructionHe,
    order_tip_en: orderTipEn,
    order_tip_he: orderTipHe,
    maps_query: location.maps_query,
    lat: location.lat,
    lng: location.lng,
    source_location_id: location.id,
  }
}

function buildFollowUpStop(location, index) {
  const category = normalizeCategory(location.category)
  let instructionEn = `Continue at ${location.name} so the night has a natural second beat.`
  let instructionHe = `ממשיכים ל${location.name_he || location.name} כדי לתת לערב תחנה שנייה טבעית.`

  if (category === 'food') {
    instructionEn = `Move to ${location.name} once you are ready to sit down and keep talking.`
    instructionHe = `עוברים ל${location.name_he || location.name} כשמוכנים לשבת ולהמשיך לדבר.`
  } else if (category === 'outdoors') {
    instructionEn = `Take a short stretch at ${location.name} before deciding how much longer to stay out.`
    instructionHe = `עושים מקטע קצר ב${location.name_he || location.name} לפני שמחליטים כמה עוד נשארים בחוץ.`
  } else if (category === 'activity' || category === 'culture') {
    instructionEn = `Use ${location.name} as the playful middle beat of the date.`
    instructionHe = `השתמשו ב${location.name_he || location.name} כתחנת האמצע המשחקית של הדייט.`
  } else if (category === 'lounges' || category === 'winery') {
    instructionEn = `Let ${location.name} be the refined second half of the night.`
    instructionHe = `תנו ל${location.name_he || location.name} להיות החצי היותר מוקפד של הערב.`
  }

  return {
    name_en: location.name,
    name_he: location.name_he || location.name,
    instruction_en: instructionEn,
    instruction_he: instructionHe,
    order_tip_en: index > 2 ? 'Only add this if the night still feels good.' : '',
    order_tip_he: index > 2 ? 'מוסיפים את זה רק אם הערב עדיין מרגיש טוב.' : '',
    maps_query: location.maps_query,
    lat: location.lat,
    lng: location.lng,
    source_location_id: location.id,
  }
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
  const stops = [buildPrimaryStop(location), ...supportLocations.map((stop, index) => buildFollowUpStop(stop, index + 2))]
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
  const curated = getMatchedPlans(curatedPlans, answers, curatedPlans.length, behavior).map((plan) => ({
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
  let anchorPool = (answers.city && answers.city !== 'flexible')
    ? (locations || []).filter((l) => l.city === answers.city)
    : (locations || [])

  // Focus-scoped anchor pool: prefer anchors that carry the user's stated
  // focus. Without this, a high-curation cafe can out-score the city's only
  // park even when the user picked focus=outdoors.
  //
  // If the user picked a specific city AND that city has zero in-focus
  // anchors, return no generated plans. A wrong-category "plan" is worse
  // than an honest "not enough options yet" fallback. (Flexible city still
  // falls through because globally we always have in-focus anchors.)
  let focusGap = false
  if (answers.focus) {
    const focusMatched = anchorPool.filter((l) => deriveFocusTags(l).includes(answers.focus))
    if (focusMatched.length > 0) {
      anchorPool = focusMatched
    } else if (answers.city && answers.city !== 'flexible') {
      focusGap = true
      anchorPool = []
    }
  }

  const generated = anchorPool
    .map((location) => buildGeneratedPlan(location, locations || [], answers, behavior, usageProfile))
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

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
      score += 5
    } else {
      const distance = distanceKm(location, answers.city)
      if (distance !== null) {
        if (distance <= pace.travelToleranceKm) score += 1.5
        else if (distance > pace.travelToleranceKm * 2) score -= 1
      }
    }
  }

  if (preferredStage && (location.date_stage || []).includes(preferredStage)) score += 3

  if (focus.categories.includes(category)) score += 2.5
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

  if (answers.when === 'tonight' || answers.when === 'thursday-night') {
    if (occasions.has('evening')) score += 1
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

  const isColdStart = !Object.keys(behaviorProfile.cityWeights).length && !Object.keys(behaviorProfile.categoryWeights).length
  if (location.featured) score += isColdStart ? 2 : 1.5

  return score
}

export function getRecommendedLocations(locations, answers, options = {}) {
  if (!locations?.length) return []

  const excluded = new Set((options.excludeIds || []).map(String))
  const behavior = {
    ...options,
    profile: buildPreferenceProfile(options),
  }

  return [...locations]
    .filter((location) => !excluded.has(String(location.id)))
    .map((location) => ({ ...location, _score: scoreLocation(location, answers, behavior) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, options.limit || 3)
}

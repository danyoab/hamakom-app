import { supabase } from './supabase'

const SESSION_KEY = 'hamakom-analytics-session-id'

function getSessionId() {
  if (typeof window === 'undefined') return 'server'

  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) return existing

  const nextId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  window.localStorage.setItem(SESSION_KEY, nextId)
  return nextId
}

function getUserId(userId) {
  if (userId) return userId
  return null
}

export async function trackEvent(eventName, { userId = null, itemType = null, itemId = null, properties = {} } = {}) {
  if (!supabase || !eventName) return null

  const payload = {
    session_id: getSessionId(),
    user_id: getUserId(userId),
    event_name: eventName,
    item_type: itemType,
    item_id: itemId,
    properties,
  }

  const { error } = await supabase.from('analytics_events').insert(payload)
  if (error) {
    console.warn(`analytics ${eventName}:`, error.message)
    return null
  }

  return payload
}

export async function createRecommendationImpression({
  userId = null,
  quizAnswers = {},
  primaryPlanId = null,
  backupLocationIds = [],
} = {}) {
  if (!supabase || !primaryPlanId) return null

  const payload = {
    session_id: getSessionId(),
    user_id: getUserId(userId),
    quiz_answers: quizAnswers,
    primary_plan_id: primaryPlanId,
    backup_location_ids: backupLocationIds,
  }

  const { data, error } = await supabase
    .from('recommendation_impressions')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.warn('recommendation impression:', error.message)
    return null
  }

  return data?.id || null
}

export async function upsertRecommendationOutcome(recommendationImpressionId, patch = {}) {
  if (!supabase || !recommendationImpressionId || !Object.keys(patch).length) return null

  const payload = {
    recommendation_impression_id: recommendationImpressionId,
    ...patch,
  }

  const { error } = await supabase.from('recommendation_outcomes').upsert(payload, {
    onConflict: 'recommendation_impression_id',
  })

  if (error) {
    console.warn('recommendation outcome:', error.message)
    return null
  }

  return payload
}

export async function saveUserFeedback({ userId = null, itemType, itemId, feedback }) {
  if (!supabase || !userId || !itemType || !itemId || !feedback) return null

  const payload = {
    user_id: userId,
    item_type: itemType,
    item_id: itemId,
    went: feedback.went ?? null,
    rating: feedback.rating ?? null,
    would_do_again: feedback.again ?? null,
    notes: feedback.notes ?? null,
  }

  const { error } = await supabase.from('user_feedback').upsert(payload, {
    onConflict: 'user_id,item_type,item_id',
  })

  if (error) {
    console.warn('user feedback:', error.message)
    return null
  }

  return payload
}

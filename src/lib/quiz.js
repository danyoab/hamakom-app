function scoreOverlap(tags, selected) {
  if (!selected) return 0
  return tags.includes(selected) ? 4 : 0
}

function scoreLengthMatch(plan, selectedLength) {
  if (!selectedLength) return 0
  const tags = plan.length_tags || []
  if (!tags.length) return 0
  return tags.includes(selectedLength) ? 3 : 0
}

export function scorePlan(plan, answers) {
  let score = 0

  score += scoreOverlap(plan.when_tags || [], answers.when)
  score += scoreLengthMatch(plan, answers.length)
  score += scoreOverlap(plan.focus_tags || [], answers.focus)
  if (answers.city && answers.city !== 'flexible' && plan.city === answers.city) score += 3
  score += scoreOverlap(plan.seriousness_tags || [], answers.seriousness)

  if (plan.featured) score += 0.5
  if (answers.when === 'tonight') score += plan.tonight_pick_weight || 0

  return score
}

function scorePlanBehaviorBoost(plan, behavior = {}) {
  const entries = Object.entries(behavior.feedbackByItem || {})
  if (!entries.length) return 0

  const planIndex = behavior.planIndex || {}
  let score = 0

  entries.forEach(([key, feedback]) => {
    if (!key.startsWith('plan:') || !feedback?.went || (feedback.rating || 0) < 4) return
    const pastPlan = planIndex[key.replace('plan:', '')]
    if (!pastPlan) return

    if (pastPlan.city === plan.city) score += 0.5
    if ((pastPlan.focus_tags || []).some((tag) => (plan.focus_tags || []).includes(tag))) score += 0.75
    if ((pastPlan.seriousness_tags || []).some((tag) => (plan.seriousness_tags || []).includes(tag))) score += 0.35
  })

  return Math.min(score, 2)
}

export function getMatchedPlans(plans, answers, count = 2, behavior = {}) {
  const planIndex = Object.fromEntries((plans || []).map((plan) => [String(plan.id), plan]))

  return [...plans]
    .map((plan) => ({ ...plan, _score: scorePlan(plan, answers) + scorePlanBehaviorBoost(plan, { ...behavior, planIndex }) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, count)
}

export function buildPlanIdentity(answers) {
  const map = {
    'atmosphere:getting-serious': {
      en: 'The Quiet Romantic',
      he: 'הרומנטיקן השקט',
    },
    'atmosphere:getting-to-know': {
      en: 'The Thoughtful Explorer',
      he: 'החוקר המתחשב',
    },
    'food-drink:just-met': {
      en: 'The Easy Charmer',
      he: 'הכובש בקלות',
    },
    'food-drink:getting-serious': {
      en: 'The Intentional Romantic',
      he: 'הרומנטיקן המכוון',
    },
    'activity:just-met': {
      en: 'The Playful Connector',
      he: 'המחבר המשחקי',
    },
    'activity:getting-to-know': {
      en: 'The Energetic Explorer',
      he: 'החוקר האנרגטי',
    },
    'outdoors:getting-serious': {
      en: 'The Gentle Planner',
      he: 'המתכנן העדין',
    },
    'outdoors:getting-to-know': {
      en: 'The Calm Adventurer',
      he: 'ההרפתקן הרגוע',
    },
  }

  const direct = map[`${answers.focus}:${answers.seriousness}`]
  if (direct) return direct

  return {
    en: 'The Intentional Dater',
    he: 'הדייטר המכוון',
  }
}

export function getPlanFitSummary(plan, answers, lang) {
  const isHe = lang === 'he'
  const whenText = {
    tonight: { en: 'a low-friction plan for tonight', he: 'תוכנית זורמת לערב הקרוב' },
    'thursday-night': { en: 'something that works well before Shabbat', he: 'משהו שעובד טוב לפני שבת' },
    'planning-ahead': { en: 'a plan worth setting aside time for', he: 'תוכנית ששווה לפנות לה זמן' },
  }
  const lengthText = {
    short: { en: 'a lighter evening', he: 'ערב קליל יותר' },
    medium: { en: 'a balanced pace', he: 'קצב מאוזן' },
    long: { en: 'room to make a full night of it', he: 'מקום להפוך את זה לערב מלא' },
  }
  const focusText = {
    atmosphere: { en: 'strong atmosphere', he: 'אווירה חזקה' },
    'food-drink': { en: 'great food and drink', he: 'אוכל ושתייה טובים' },
    activity: { en: 'something to do together', he: 'משהו לעשות יחד' },
    outdoors: { en: 'space, air, and movement', he: 'מרחב, אוויר ותנועה' },
  }
  const cityText = {
    Jerusalem: { en: 'near Jerusalem', he: 'ליד ירושלים' },
    'Tel Aviv': { en: 'near Tel Aviv', he: 'ליד תל אביב' },
    "Modi'in": { en: "near Modi'in", he: 'ליד מודיעין' },
    'Beit Shemesh': { en: 'near Beit Shemesh', he: 'ליד בית שמש' },
    'Tzur Hadassah': { en: 'near Tzur Hadassah', he: 'ליד צור הדסה' },
  }
  const seriousnessText = {
    'just-met': { en: 'without too much pressure', he: 'בלי יותר מדי לחץ' },
    'getting-to-know': { en: 'with room for longer conversation', he: 'עם מקום לשיחה ארוכה יותר' },
    'getting-serious': { en: 'that feels more intentional', he: 'שמרגישה יותר מכוונת' },
  }

  const whenPart = whenText[answers.when]
  const lengthPart = answers.length ? lengthText[answers.length] : null
  const focusPart = focusText[answers.focus]
  const cityPart = answers.city && answers.city !== 'flexible' ? cityText[answers.city] : null
  const seriousnessPart = seriousnessText[answers.seriousness]

  if (!whenPart || !focusPart || !seriousnessPart) {
    return isHe ? 'התוכנית הזאת מתאימה לקצב ולאווירה שבחרתם.' : 'This plan fits the pace and energy you picked.'
  }

  if (cityPart && lengthPart) {
    return isHe
      ? `בחרנו תוכנית עם ${focusPart.he}, שמתאימה ל${whenPart.he}, ${lengthPart.he}, ${cityPart.he}, ו${seriousnessPart.he}.`
      : `We picked a plan built around ${focusPart.en}, giving you ${whenPart.en}, ${lengthPart.en}, ${cityPart.en}, and a flow that works ${seriousnessPart.en}.`
  }

  if (cityPart) {
    return isHe
      ? `בחרנו תוכנית עם ${focusPart.he}, שמתאימה ל${whenPart.he}, ${cityPart.he}, ו${seriousnessPart.he}.`
      : `We picked a plan built around ${focusPart.en}, giving you ${whenPart.en}, ${cityPart.en}, and a flow that works ${seriousnessPart.en}.`
  }

  if (lengthPart) {
    return isHe
      ? `בחרנו תוכנית עם ${focusPart.he}, שמתאימה ל${whenPart.he}, ${lengthPart.he}, ו${seriousnessPart.he}.`
      : `We picked a plan built around ${focusPart.en}, giving you ${whenPart.en}, ${lengthPart.en}, and a flow that works ${seriousnessPart.en}.`
  }

  return isHe
    ? `בחרנו תוכנית עם ${focusPart.he}, שמתאימה ל${whenPart.he} ו${seriousnessPart.he}.`
    : `We picked a plan built around ${focusPart.en}, giving you ${whenPart.en} and a flow that works ${seriousnessPart.en}.`
}

export function saveAnswersToSession(answers) {
  try {
    sessionStorage.setItem('hamakom-quiz', JSON.stringify(answers))
  } catch {
    // ignore
  }
}

export function loadAnswersFromSession() {
  try {
    const raw = sessionStorage.getItem('hamakom-quiz')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearAnswersFromSession() {
  try {
    sessionStorage.removeItem('hamakom-quiz')
  } catch {
    // ignore
  }
}

export function savePendingSaveToSession(item) {
  try {
    sessionStorage.setItem('hamakom-pending-save', JSON.stringify(item))
  } catch {
    // ignore
  }
}

export function loadPendingSaveFromSession() {
  try {
    const raw = sessionStorage.getItem('hamakom-pending-save')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearPendingSaveFromSession() {
  try {
    sessionStorage.removeItem('hamakom-pending-save')
  } catch {
    // ignore
  }
}

export function savePendingPlanToSession(planId) {
  savePendingSaveToSession({ type: 'plan', id: planId })
}

export function loadPendingPlanFromSession() {
  const pending = loadPendingSaveFromSession()
  return pending?.type === 'plan' ? pending.id : null
}

export function clearPendingPlanFromSession() {
  clearPendingSaveFromSession()
}

export function savePendingPlaceToSession(placeId) {
  savePendingSaveToSession({ type: 'place', id: placeId })
}

export function loadPendingPlaceFromSession() {
  const pending = loadPendingSaveFromSession()
  return pending?.type === 'place' ? pending.id : null
}

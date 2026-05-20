// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Returns a score for a tag match, rewarding specialist plans over generalist ones.
 * A plan with 1 matching tag is more relevant than one with 4 tags that happen to match.
 */
function scoreOverlap(tags, selected) {
  if (!selected || !tags?.length) return 0
  if (!tags.includes(selected)) return 0
  if (tags.length === 1) return 5  // specialist exact match
  if (tags.length === 2) return 4  // focused match
  return 3                          // generalist — matches anything
}

function scoreMismatch(tags, selected, penalty) {
  if (!selected || !tags?.length) return 0
  return tags.includes(selected) ? 0 : penalty
}

function scoreLengthMatch(plan, selectedLength) {
  if (!selectedLength) return 0
  const tags = plan.length_tags || []
  if (!tags.length) return 0
  if (!tags.includes(selectedLength)) return 0
  // Length specificity bonus (same principle)
  return tags.length === 1 ? 5 : tags.length === 2 ? 4 : 3
}

// ── Main plan scorer ──────────────────────────────────────────────────────────

export function scorePlan(plan, answers, ctx = {}) {
  let score = 0

  // Length — now equal weight to other dimensions
  score += scoreLengthMatch(plan, answers.length)
  score += scoreMismatch(plan.length_tags || [], answers.length, -3)

  // Focus
  score += scoreOverlap(plan.focus_tags || [], answers.focus)
  score += scoreMismatch(plan.focus_tags || [], answers.focus, -2)

  // City — penalty scales with how much coverage the chosen city has.
  // Why: if the chosen city only has 1–2 plans, a hard -12 buries every
  // alternative and leaves users staring at a single mediocre match.
  if (answers.city && answers.city !== 'flexible') {
    if (plan.city === answers.city) {
      score += 6
    } else {
      const coverage = ctx.cityPlanCount ?? 99
      const penalty = coverage >= 3 ? -12 : coverage === 2 ? -7 : -4
      score += penalty
    }
  }

  // Seriousness — strong filter, wrong stage is a serious mismatch
  score += scoreOverlap(plan.seriousness_tags || [], answers.seriousness)
  score += scoreMismatch(plan.seriousness_tags || [], answers.seriousness, -6)

  // Featured boost (minor)
  if (plan.featured) score += 0.5

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
    if ((pastPlan.focus_tags || []).some(tag => (plan.focus_tags || []).includes(tag))) score += 0.75
    if ((pastPlan.seriousness_tags || []).some(tag => (plan.seriousness_tags || []).includes(tag))) score += 0.35
  })

  return Math.min(score, 2)
}

// ── Plan matching ─────────────────────────────────────────────────────────────

export function getMatchedPlans(plans, answers, count = 2, behavior = {}) {
  const planIndex = Object.fromEntries((plans || []).map(plan => [String(plan.id), plan]))

  const cityPlanCount = answers.city && answers.city !== 'flexible'
    ? (plans || []).filter(p => p.city === answers.city).length
    : null

  const scored = [...plans]
    .map(plan => ({
      ...plan,
      _score: scorePlan(plan, answers, { cityPlanCount }) + scorePlanBehaviorBoost(plan, { ...behavior, planIndex }),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, Math.max(count, 3))

  if (scored[0]) {
    scored[0]._cityMismatch = Boolean(
      answers.city && answers.city !== 'flexible' && scored[0].city !== answers.city
    )
    // Low confidence: less than 8 points (needs at least 2 strong dimension matches)
    scored[0]._lowConfidence = scored[0]._score < 8
  }

  return scored
}

// ── Plan identity labels ──────────────────────────────────────────────────────

export function buildPlanIdentity(answers) {
  const map = {
    'atmosphere:getting-serious':  { en: 'The Quiet Romantic',       he: 'הרומנטיקן השקט' },
    'atmosphere:getting-to-know':  { en: 'The Thoughtful Explorer',   he: 'החוקר המתחשב' },
    'food-drink:just-met':         { en: 'The Easy Charmer',          he: 'הכובש בקלות' },
    'food-drink:getting-serious':  { en: 'The Intentional Romantic',  he: 'הרומנטיקן המכוון' },
    'activity:just-met':           { en: 'The Playful Connector',     he: 'המחבר המשחקי' },
    'activity:getting-to-know':    { en: 'The Energetic Explorer',    he: 'החוקר האנרגטי' },
    'outdoors:getting-serious':    { en: 'The Gentle Planner',        he: 'המתכנן העדין' },
    'outdoors:getting-to-know':    { en: 'The Calm Adventurer',       he: 'ההרפתקן הרגוע' },
  }

  const direct = map[`${answers.focus}:${answers.seriousness}`]
  if (direct) return direct
  return { en: 'The Intentional Dater', he: 'הדייטר המכוון' }
}

// ── Fit summary ───────────────────────────────────────────────────────────────

export function getPlanFitSummary(plan, answers, lang) {
  const isHe = lang === 'he'

  const lengthText = {
    short:  { en: 'a lighter evening',        he: 'ערב קליל יותר' },
    medium: { en: 'a balanced pace',           he: 'קצב מאוזן' },
    long:   { en: 'room to make a full night of it', he: 'מקום להפוך את זה לערב מלא' },
  }
  const focusText = {
    atmosphere: { en: 'strong atmosphere',         he: 'אווירה חזקה' },
    'food-drink': { en: 'great food and drink',    he: 'אוכל ושתייה טובים' },
    activity:   { en: 'something to do together',  he: 'משהו לעשות יחד' },
    outdoors:   { en: 'space, air, and movement',  he: 'מרחב, אוויר ותנועה' },
  }
  const cityText = {
    'Jerusalem':       { en: 'near Jerusalem',      he: 'ליד ירושלים' },
    'Tel Aviv':        { en: 'near Tel Aviv',       he: 'ליד תל אביב' },
    "Modi'in":         { en: "near Modi'in",        he: 'ליד מודיעין' },
    'Beit Shemesh':    { en: 'near Beit Shemesh',   he: 'ליד בית שמש' },
    'Tzur Hadassah':   { en: 'near Tzur Hadassah',  he: 'ליד צור הדסה' },
    'Haifa':           { en: 'near Haifa',          he: 'ליד חיפה' },
    'Herzliya':        { en: 'near Herzliya',       he: 'ליד הרצליה' },
    "Ra'anana":        { en: "near Ra'anana",       he: 'ליד רעננה' },
    'Netanya':         { en: 'near Netanya',        he: 'ליד נתניה' },
    'Zichron Yaakov':  { en: 'near Zichron Yaakov', he: 'ליד זכרון יעקב' },
    'Caesarea':        { en: 'near Caesarea',       he: 'ליד קיסריה' },
  }
  const seriousnessText = {
    'just-met':         { en: 'without too much pressure',          he: 'בלי יותר מדי לחץ' },
    'getting-to-know':  { en: 'with room for longer conversation',  he: 'עם מקום לשיחה ארוכה יותר' },
    'getting-serious':  { en: 'that feels more intentional',        he: 'שמרגישה יותר מכוונת' },
  }

  const lengthPart      = answers.length ? lengthText[answers.length] : null
  const focusPart       = focusText[answers.focus]
  const cityPart        = answers.city && answers.city !== 'flexible' ? cityText[answers.city] : null
  const seriousnessPart = seriousnessText[answers.seriousness]

  if (!focusPart || !seriousnessPart) {
    return isHe
      ? 'התוכנית הזאת מתאימה לקצב ולאווירה שבחרתם.'
      : 'This plan fits the pace and energy you picked.'
  }

  if (cityPart && lengthPart) {
    return isHe
      ? `בחרנו תוכנית עם ${focusPart.he}, ${lengthPart.he}, ${cityPart.he}, ו${seriousnessPart.he}.`
      : `We picked a plan built around ${focusPart.en}, giving you ${lengthPart.en}, ${cityPart.en}, and a flow ${seriousnessPart.en}.`
  }
  if (cityPart) {
    return isHe
      ? `בחרנו תוכנית עם ${focusPart.he}, ${cityPart.he}, ו${seriousnessPart.he}.`
      : `We picked a plan built around ${focusPart.en}, ${cityPart.en}, and a flow ${seriousnessPart.en}.`
  }
  if (lengthPart) {
    return isHe
      ? `בחרנו תוכנית עם ${focusPart.he}, ${lengthPart.he}, ו${seriousnessPart.he}.`
      : `We picked a plan built around ${focusPart.en}, giving you ${lengthPart.en} and a flow ${seriousnessPart.en}.`
  }
  return isHe
    ? `בחרנו תוכנית עם ${focusPart.he} ו${seriousnessPart.he}.`
    : `We picked a plan built around ${focusPart.en} and a flow ${seriousnessPart.en}.`
}

// ── Session storage helpers ───────────────────────────────────────────────────

export function saveAnswersToSession(answers) {
  try { sessionStorage.setItem('hamakom-quiz', JSON.stringify(answers)) } catch { /* ignore */ }
}

export function loadAnswersFromSession() {
  try {
    const raw = sessionStorage.getItem('hamakom-quiz')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearAnswersFromSession() {
  try { sessionStorage.removeItem('hamakom-quiz') } catch { /* ignore */ }
}

export function savePendingSaveToSession(item) {
  try { sessionStorage.setItem('hamakom-pending-save', JSON.stringify(item)) } catch { /* ignore */ }
}

export function loadPendingSaveFromSession() {
  try {
    const raw = sessionStorage.getItem('hamakom-pending-save')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearPendingSaveFromSession() {
  try { sessionStorage.removeItem('hamakom-pending-save') } catch { /* ignore */ }
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

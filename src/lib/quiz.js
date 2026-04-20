// Score a single location against quiz answers (0–16 pts)
export function scoreLocation(loc, answers) {
  let score = 0

  // Date stage match (0–4 pts)
  if (answers.stage != null) {
    const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
    if (stages.includes(answers.stage)) score += 4
    else if (stages.some(s => Math.abs(s - answers.stage) === 1)) score += 1
  }

  // Vibe/occasion match (0–3 pts)
  if (answers.vibe && loc.occasion?.includes(answers.vibe)) score += 3

  // Ambiance match (0–2 pts)
  if (answers.ambiance && loc.occasion?.includes(answers.ambiance)) score += 2

  // Price match (0–3 pts)
  if (answers.budget != null) {
    const diff = Math.abs(loc.price - answers.budget)
    if (diff === 0) score += 3
    else if (diff === 1) score += 1
  }

  // City match (0–2 pts)
  if (answers.city && answers.city !== 'other' && loc.city === answers.city) score += 2

  // Kashrus match (0–2 pts)
  if (answers.kashrus === 'strict' && loc.kashrus) score += 2
  if (answers.kashrus === 'prefer' && (loc.kashrus || loc.occasion?.includes('frum-friendly'))) score += 1

  return score
}

// Get top N personalized results sorted by score
export function getPersonalizedResults(locations, answers, n = 5) {
  return [...locations]
    .map(loc => ({ ...loc, _score: scoreLocation(loc, answers) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, n)
}

// Build bilingual personality tag pills from answers
export function buildPersonalityTags(answers) {
  const tags = { en: [], he: [] }

  const vibeMap = {
    romantic:    { en: '🌹 Romantic',    he: '🌹 רומנטי' },
    fun:         { en: '😄 Fun',         he: '😄 כיפי' },
    casual:      { en: '🌿 Chill',       he: '🌿 נינוח' },
    adventurous: { en: '🏔️ Adventurous', he: '🏔️ הרפתקני' },
  }
  const stageMap = {
    1: { en: '💫 First Date',      he: '💫 דייט ראשון' },
    2: { en: '😊 Few Dates In',    he: '😊 כמה דייטים' },
    3: { en: '🔥 Getting Serious', he: '🔥 רציניים' },
  }
  const kashrusMap = {
    strict: { en: '✡️ Strictly Kosher',  he: '✡️ כשר מהדרין' },
    prefer: { en: '🙂 Kosher-Friendly',  he: '🙂 כשר-ידידותי' },
  }
  const budgetMap = {
    1: { en: '🤌 Budget-Friendly', he: '🤌 חסכוני' },
    2: { en: '😌 Mid-Range',       he: '😌 בינוני' },
    3: { en: '✨ Premium',         he: '✨ פרמיום' },
    4: { en: '🎉 Splurge',        he: '🎉 יוקרה' },
  }

  ;[
    [answers.vibe,    vibeMap],
    [answers.stage,   stageMap],
    [answers.kashrus, kashrusMap],
    [answers.budget,  budgetMap],
  ].forEach(([key, map]) => {
    if (key != null && map[key]) {
      tags.en.push(map[key].en)
      tags.he.push(map[key].he)
    }
  })

  return tags
}

// Get up to 2 "why it matches you" reasons for a result card
export function getMatchReasons(loc, answers, lang) {
  const reasons = []
  const isHe = lang === 'he'

  const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
  if (answers.stage != null && stages.includes(answers.stage)) {
    const lbl = { 1: { en: 'first dates', he: 'דייט ראשון' }, 2: { en: 'second dates', he: 'דייט שני' }, 3: { en: 'deeper connection', he: 'קשר עמוק' } }
    const l = lbl[answers.stage]
    if (l) reasons.push(isHe ? `מושלם ל${l.he}` : `Perfect for ${l.en}`)
  }

  if (answers.vibe && loc.occasion?.includes(answers.vibe)) {
    const lbl = {
      romantic:    { en: 'romantic atmosphere', he: 'אווירה רומנטית' },
      fun:         { en: 'fun & playful energy', he: 'אנרגיה כיפית' },
      casual:      { en: 'relaxed chill vibe', he: 'ויב נינוח' },
      adventurous: { en: 'adventurous spirit', he: 'רוח הרפתקנית' },
    }
    const l = lbl[answers.vibe]
    if (l) reasons.push(isHe ? `${l.he} ✓` : `${l.en} ✓`)
  }

  if (answers.ambiance && loc.occasion?.includes(answers.ambiance)) {
    const lbl = {
      views:    { en: 'stunning views',       he: 'נוף מרהיב' },
      creative: { en: 'creative experience',  he: 'חוויה יצירתית' },
      upscale:  { en: 'upscale feel',         he: 'תחושה יוקרתית' },
      unique:   { en: 'unique experience',    he: 'חוויה ייחודית' },
    }
    const l = lbl[answers.ambiance]
    if (l) reasons.push(isHe ? l.he : l.en)
  }

  if (answers.kashrus === 'strict' && loc.kashrus) {
    reasons.push(isHe ? `כשרות: ${loc.kashrus}` : `Kosher: ${loc.kashrus}`)
  }

  if (answers.city && answers.city !== 'other' && loc.city === answers.city) {
    const city = isHe ? (loc.city_he || loc.city) : loc.city
    reasons.push(isHe ? `ב${city}` : `In ${city}`)
  }

  return reasons.slice(0, 2)
}

// Persist quiz answers across OAuth page redirects
export function saveAnswersToSession(answers) {
  try { sessionStorage.setItem('hamakom-quiz', JSON.stringify(answers)) } catch {}
}

export function loadAnswersFromSession() {
  try {
    const raw = sessionStorage.getItem('hamakom-quiz')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearAnswersFromSession() {
  try { sessionStorage.removeItem('hamakom-quiz') } catch {}
}

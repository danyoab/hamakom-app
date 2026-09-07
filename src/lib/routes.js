/** Path-based routes shared by web boot and native deep links. */
export function parseAppRoute(pathname, search = '') {
  // Native deep links arrive as one string; web boot passes pathname + search.
  const [rawPath, rawQuery] = String(pathname || '/').split('?')
  const path = rawPath.replace(/\/+$/, '') || '/'
  const query = new URLSearchParams(rawQuery || (search || '').replace(/^\?/, ''))
  const locMatch = path.match(/^\/location\/([^/]+)$/)
  if (locMatch) return { type: 'location', key: decodeURIComponent(locMatch[1]) }
  if (path === '/plan') {
    const answers = parsePlanQuery(query)
    return answers ? { type: 'plan', answers } : null
  }
  if (path === '/privacy') return { type: 'privacy' }
  if (path === '/terms') return { type: 'terms' }
  if (path === '/delete-account') return { type: 'delete-account' }
  if (path === '/for-businesses' || path === '/businesses') return { type: 'businesses' }
  return null
}

// Shareable plan links carry the quiz answers, not a plan id: the engine is
// deterministic for a given answers+seed, so the recipient rebuilds the same
// plan from the same (bundled or DB) data without any server round-trip.
const PLAN_PARAMS = { city: 'c', seriousness: 's', focus: 'f', length: 'l', when: 'w', _seed: 'seed' }

export function planShareQuery(answers) {
  if (!answers?.city) return null
  const params = new URLSearchParams()
  for (const [key, short] of Object.entries(PLAN_PARAMS)) {
    if (answers[key] != null && answers[key] !== '') params.set(short, String(answers[key]))
  }
  return params.toString()
}

function parsePlanQuery(query) {
  const answers = {}
  for (const [key, short] of Object.entries(PLAN_PARAMS)) {
    const value = query.get(short)
    if (value) answers[key] = key === '_seed' ? Number(value) || value : value
  }
  if (!answers.city) return null
  if (!answers.when) answers.when = 'planning-ahead'
  return answers
}

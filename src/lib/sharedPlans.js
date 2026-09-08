import { finalizePlan } from './planValidation.js'

export function sharedPlanPath(plan, lang = 'en') {
  const ids = (plan.stops || []).map(s => s.source_location_id ?? s._locationId ?? s.location_id)
  if (!ids.length || ids.some(id => id == null)) return '/'
  const params = new URLSearchParams({ places: ids.join(','), mode: plan.travel_mode || 'walking', lang })
  if (plan.planning_date) params.set('date', plan.planning_date)
  if (plan.start_time) params.set('time', plan.start_time)
  return `/plan?${params}`
}

export function portablePlanId(ids, answers = {}) {
  return ['date-v2', ids.join('.'), answers.travelMode || 'walking', answers.date || '', answers.startTime || ''].join('~')
}

export function restoreSharedPlan(route, locations) {
  const ids = route.ids || []
  if (!ids.length || ids.length > 3 || ids.some(id => !/^\d+$/.test(String(id)))) return null
  const rows = ids.map(id => locations.find(l => String(l.id) === String(id)))
  if (rows.some(r => !r)) return null
  const answers = { city: rows[0].city, travelMode: route.mode === 'driving' ? 'driving' : 'walking', date: route.date, startTime: route.time }
  const single = rows.length === 1
  const plan = {
    id: portablePlanId(ids, answers), city: rows[0].city,
    title_en: single ? `A date at ${rows[0].name}` : `Your date in ${rows[0].city}`,
    title_he: single ? `דייט ב${rows[0].name_he || rows[0].name}` : `הדייט שלכם ב${rows[0].city_he || rows[0].city}`,
    source_type: 'shared', focus_tags: [],
    stops: rows.map((r, i) => ({ source_location_id: r.id, role: i === 0 ? 'anchor' : 'transition',
      instruction_en: i === 0 ? 'Meet here and take time to settle in.' : 'Continue here when you are ready.',
      instruction_he: i === 0 ? 'נפגשים כאן ומתמקמים בנחת.' : 'ממשיכים לכאן כשמתאים לכם.' })),
  }
  return finalizePlan(plan, rows, answers)
}

export function restoreSavedPlan(id, locations) {
  if (!String(id).startsWith('date-v2~')) return null
  const [, places, mode, date, time] = id.split('~')
  return restoreSharedPlan({ ids: places.split('.'), mode, date, time }, locations)
}

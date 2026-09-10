import { marketOf } from './markets.js'
import { DIETARY_OPTIONS } from './venuePreferences.js'

export const PLAN_FOCUS_OPTIONS = [
  { value: '', en: 'Show me different ideas', he: 'הציגו לי רעיונות מגוונים' },
  { value: 'food-drink', en: 'Food & conversation', he: 'אוכל ושיחה' },
  { value: 'outdoors', en: 'Outdoors', he: 'בחוץ' },
  { value: 'atmosphere', en: 'Atmosphere', he: 'אווירה' },
  { value: 'activity', en: 'An activity together', he: 'פעילות יחד' },
]

// Only editable preferences belong in the panel. Reset keeps city, date stage,
// and recommendation seed intact; it must also clear old menu/focus filters.
export function getPlanPreferences(answers = {}) {
  return {
    foodService: answers.foodService || '',
    focus: answers.focus || '',
    length: answers.length || '',
    dietary: answers.dietary || [],
    kosher: answers.kosher || 'any',
    budget: answers.budget || 'any',
    travelMode: answers.travelMode || 'walking',
    date: answers.date || '',
    startTime: answers.startTime || '',
    menuOnly: Boolean(answers.menuOnly),
  }
}

export function planPreferenceLabels(answers, lang = 'en') {
  const symbol = marketOf(answers).symbol
  const p = getPlanPreferences(answers)
  const he = lang === 'he'
  return [
    ({ meat: he ? 'בשרי' : 'Meat', dairy: he ? 'חלבי' : 'Dairy', pareve: he ? 'פרווה' : 'Pareve' })[p.foodService],
    PLAN_FOCUS_OPTIONS.find(o => o.value && o.value === p.focus)?.[lang],
    ...DIETARY_OPTIONS.filter(o => p.dietary.includes(o.value)).map(o => o[lang]),
    p.kosher === 'verified' ? (he ? 'כשרות מאומתת' : 'Verified kosher') : null,
    p.kosher === 'mehadrin' ? (he ? 'מהדרין מאומת' : 'Verified mehadrin') : null,
    p.budget === 'budget' ? (he ? `עד ${symbol.repeat(2)}` : `Up to ${symbol.repeat(2)}`) : null,
    p.budget === 'moderate' ? (he ? `עד ${symbol.repeat(3)}` : `Up to ${symbol.repeat(3)}`) : null,
    ({ short: he ? 'עד שעתיים' : 'Up to 2 hours', medium: he ? 'עד 3 שעות' : 'Up to 3 hours', long: he ? 'ללא הגבלת זמן' : 'No time limit' })[p.length],
    p.travelMode === 'driving' ? (he ? 'נסיעה קצרה' : 'Short drive okay') : null,
    p.date,
    p.startTime,
    p.menuOnly ? (he ? 'עם תפריט' : 'With menus') : null,
  ].filter(Boolean)
}

export function preferencesFromPlan(plan) {
  return { city: plan.city, travelMode: plan.travel_mode || 'walking', date: plan.planning_date || '', startTime: plan.start_time || '' }
}

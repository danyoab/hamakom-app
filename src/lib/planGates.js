// Plan safety gates — the hard rules from DATE_PLANNING_RULES.md (Priority 1).
//
// Pure and deterministic. No DOM / no network. These are HARD gates: a venue or
// plan that fails is removed entirely, never "penalized but still shown".
//
// Priority 1 (enforced here): operational-status gate (incl. CLOSED_TEMPORARILY
// and unknown), city normalization, real-venue / no-placeholder check.
// Distance, no-two-dinners, opening-hours, kosher and budget gates are scaffolded
// for Priority 2/3 and documented in DATE_PLANNING_RULES.md.

// ── City normalization (H4 / T6) ─────────────────────────────────────────────
// Spelling variants collapse to one canonical city so matching can't leak across
// near-duplicate names (e.g. the real "Petach Tikva" vs "Petah Tikva" split).
const CITY_ALIASES = {
  'petah tikva': 'Petach Tikva',
  'petah tikvah': 'Petach Tikva',
  'petach tikvah': 'Petach Tikva',
  "modi'in": "Modi'in",
  'modiin': "Modi'in",
  'modi in': "Modi'in",
  "ra'anana": "Ra'anana",
  'raanana': "Ra'anana",
  'tel-aviv': 'Tel Aviv',
  'tel aviv-yafo': 'Tel Aviv',
  'tel aviv yafo': 'Tel Aviv',
  'beit shemesh': 'Beit Shemesh',
  'bet shemesh': 'Beit Shemesh',
  'zikhron yaakov': 'Zichron Yaakov',
  "zichron ya'akov": 'Zichron Yaakov',
}

export function canonicalCity(city) {
  if (!city) return city
  const key = String(city).trim().toLowerCase().replace(/\s+/g, ' ')
  return CITY_ALIASES[key] || String(city).trim()
}

export function sameCity(a, b) {
  return canonicalCity(a) === canonicalCity(b)
}

// ── Operational-status gate (H2 / H3 — T1, T2, T3) ───────────────────────────
// Only OPERATIONAL venues may appear. CLOSED_TEMPORARILY, CLOSED_PERMANENTLY and
// unknown/null status are all excluded. This must run INSIDE the plan generator
// (anchors AND support stops), which was the #1 proven bug.
//
// Freshness: with the monthly-refresh model we trust stored status while
// last_enriched_at is recent. `freshnessDays = null` disables the freshness check
// (used today, since the dataset is enriched within the window and no date input
// exists yet). Set e.g. 35 once a monthly cron is in place.
export function isOperational(loc, { now = Date.now(), freshnessDays = null } = {}) {
  if (!loc) return false
  if (loc.business_status !== 'OPERATIONAL') return false
  if (freshnessDays != null) {
    const ts = loc.last_enriched_at ? Date.parse(loc.last_enriched_at) : NaN
    if (Number.isNaN(ts)) return false
    if (now - ts > freshnessDays * 24 * 60 * 60 * 1000) return false
  }
  return true
}

// ── Real-venue / no-placeholder gate (H1 / H5 — T5, T14) ─────────────────────
// A plannable venue row must have a real id and coordinates.
export function isRealVenueRow(loc) {
  return Boolean(loc && (loc.id != null) && loc.lat != null && loc.lng != null)
}

// A rendered plan stop must resolve to a real DB venue: it carries a source
// location id (generated-plan stops do; curated placeholder stops do not).
export function isRealStop(stop) {
  if (!stop) return false
  const id = stop.source_location_id ?? stop._locationId ?? stop.location_id
  if (id == null) return false
  return stop.lat != null && stop.lng != null
}

// A plan is real only if every stop resolves to a real venue.
export function isRealPlan(plan) {
  const stops = plan?.stops || []
  return stops.length >= 2 && stops.every(isRealStop)
}

// ── Distance limits (H7 — T7) ────────────────────────────────────────────────
// Travel mode isn't collected yet, so use a safe default cap. This kills the
// proven 2.96–5.69 km legs while keeping dense-city plans intact. When a
// travel-mode input lands (Priority 2B), swap MAX_LEG_KM for a mode lookup.
export const IDEAL_LEG_KM = 1.0
export const MAX_LEG_KM = 2.0

// ── Food classification (H6 — T8) ────────────────────────────────────────────
// Derived at runtime from category + name (no stored column yet), same approach
// the engine already uses for vibe/focus tags.
//   meal_weight: 'heavy' = sit-down restaurant (a real dinner / meal anchor)
//                'medium' = café
//                'light'  = dessert · bar · winery · lounge · bakery · ice-cream
//   can_be_meal_anchor: only heavy meals anchor a "dinner"
//   can_follow_dinner: light food that can legitimately follow a meal
const DESSERT_RE = /dessert|ice ?cream|gelato|frozen yogurt|froyo|bakery|patisserie|boulanger|cookie|donut|doughnut|knafeh|kanafeh|kunafa|sweets?|candy|waffle|crepe|cr[êe]pe|chocolat|churro|muffin|cupcake|konditorei|gelateria/i
const CAFE_RE = /\bcaf[ée]\b|coffee|espresso|roaster|kafe|קפה/i
const BAR_RE = /\bbar\b|wine|winery|yayin|lounge|\bpub\b|speakeasy|cocktail|brewery|\bbeer\b|taproom|distiller/i

export function foodClassOf(loc) {
  const cat = loc?.category || ''
  const name = `${loc?.name || ''} ${loc?.name_he || ''}`
  const isFoodCat = /caf|restaurant|winer|hotel|lounge/i.test(cat)
  if (!isFoodCat) {
    return { is_food: false, food_type: 'none', meal_weight: 'none', can_be_meal_anchor: false, can_follow_dinner: false }
  }
  // Non-restaurant food categories are light by default.
  if (/winer/i.test(cat)) return mk('winery', 'light', false, true)
  if (/hotel|lounge/i.test(cat)) return mk('bar', 'light', false, true)
  // Cafés & Restaurants: split by name signal.
  if (DESSERT_RE.test(name)) return mk('dessert', 'light', false, true)
  if (BAR_RE.test(name))     return mk('bar', 'light', false, true)
  if (CAFE_RE.test(name))    return mk('cafe', 'medium', false, true)
  // Default: a sit-down restaurant = the one allowed heavy meal anchor.
  return mk('restaurant', 'heavy', true, false)
}
function mk(food_type, meal_weight, can_be_meal_anchor, can_follow_dinner) {
  return { is_food: true, food_type, meal_weight, can_be_meal_anchor, can_follow_dinner }
}

export function isHeavyMeal(loc) {
  return foodClassOf(loc).meal_weight === 'heavy'
}

// True if adding `candidate` to a plan that already holds `selectedStops`
// (and whose previous stop is `prevStop`) would break the food rules:
//   - more than one heavy meal in the plan (no two dinners / two restaurants), or
//   - two adjacent food stops where the second is not a legitimate light follow-on
//     (blocks restaurant→restaurant, café→restaurant; allows dinner→dessert, etc.)
export function violatesFoodPairing(selectedStops, candidate, prevStop) {
  const cand = foodClassOf(candidate)
  const heavyCount = (selectedStops || []).filter(isHeavyMeal).length + (cand.meal_weight === 'heavy' ? 1 : 0)
  if (heavyCount > 1) return true
  if (prevStop && foodClassOf(prevStop).is_food && cand.is_food && !cand.can_follow_dinner) return true
  return false
}

// ── Plannable pool (single entry point used by the generator) ────────────────
// Applies the venue-level hard gates (operational + real venue) before any
// scoring or composition happens.
export function plannableLocations(locations, opts = {}) {
  return (locations || []).filter((l) => isRealVenueRow(l) && isOperational(l, opts))
}

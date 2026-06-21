// Curation completeness + recommendation-readiness helpers.
// Lives in lib (not the CurateCard component file) so both the curator UI and
// the admin stats panel can import them without tripping react-refresh.

export function curationCompleteness(loc) {
  const checks = [
    loc.vibe_tags?.length > 0,
    loc.indoor_outdoor != null,
    loc.best_time?.length > 0,
    loc.weather_fit?.length > 0,
    loc.romantic_score != null,
    loc.conversation_score != null,
    loc.energy_score != null,
    loc.quietness_score != null,
    loc.activity_vs_food_score != null,
    loc.group_vs_intimate_score != null,
    loc.duration_min != null,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function isRecommendationReady(loc) {
  return loc.vibe_tags?.length > 0
    && loc.indoor_outdoor != null
    && loc.romantic_score != null
    && loc.energy_score != null
}

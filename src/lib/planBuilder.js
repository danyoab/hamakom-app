// Legacy inspector entry point. All routes now use the production planner's gates.
import { getSmartMatchedPlans } from './planRecommendations.js'

export function assembleDynamicPlan(locations, answers) {
  return getSmartMatchedPlans([], locations, answers, 1)[0] || null
}

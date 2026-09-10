import Icon from './components/Icon.jsx'
import Sheet from './components/Sheet.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from './lib/translations'
import { useLocations } from './hooks/useLocations'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useSyncSaves } from './hooks/useSyncSaves'
import { shouldClearAccountData } from './lib/saveSync.js'
import { useViewportBottomGap } from './hooks/useViewportBottomGap'
import { supabase } from './lib/supabase'
import { getAuthRedirectUrl } from './lib/authRedirect'
import { isNativeApp } from './lib/native'
import { initNativeAuth, signInWithGoogleNative } from './lib/nativeAuth'
import { initNativeShell, setNativeBackHandler } from './lib/nativeShell'
import { parseAppRoute } from './lib/routes'
import { shareContent, sharePlanMessage } from './lib/share'
import { DATE_PLANS } from './data/datePlans'
import { QUIZ_CITIES } from './lib/constants'
import { isAdminUser } from './lib/appConfig'
import { locationCanonical, siteOrigin } from './lib/seo'
import {
  createRecommendationImpression,
  grantAnalyticsConsent,
  hasAnalyticsConsent,
  hasAnalyticsDecision,
  revokeAnalyticsConsent,
  saveUserFeedback,
  trackEvent,
  upsertRecommendationOutcome,
} from './lib/analytics'
import { getRecommendedLocations } from './lib/locationRecommendations'
import { getSmartMatchedPlans, recordPlanImpression } from './lib/planRecommendations'
import { isRealVenueRow, isOperational, sameCity, foodClassOf } from './lib/planGates'
import { resolveCuratedPlans, curatedPlanSafe } from './lib/curatedResolver'
import { catalogSearch, isDiscoverable } from './lib/venueCatalog.js'
import { matchesVenuePreferences } from './lib/venuePreferences.js'
import { finalizePlan, planLocationRows } from './lib/planValidation.js'
import VenuePreferences from './components/VenuePreferences.jsx'
import PlanPreferences from './components/PlanPreferences.jsx'
import { getPlanPreferences, planPreferenceLabels, preferencesFromPlan } from './lib/planPreferences.js'
import { restoreSavedPlan, restoreSharedPlan } from './lib/sharedPlans.js'
import {
  clearAnswersFromSession,
  clearPendingSaveFromSession,
  loadAnswersFromSession,
  loadPendingSaveFromSession,
  saveAnswersToSession,
} from './lib/quiz'
import { lazy, Suspense } from 'react'
import Card from './components/Card'
import { SkeletonCardGrid } from './components/Skeleton'
import DetailView from './components/DetailView'
import SuggestView from './components/SuggestView'
import FilterBar from './components/FilterBar'
import QuizStepper from './components/QuizStepper'
import ResultsGateModal from './components/ResultsGateModal'
import ResultsPage from './components/ResultsPage'
import CustomPlanBuilder from './components/CustomPlanBuilder'
import PrivacyPage from './components/PrivacyPage'
import DeleteAccountPage from './components/DeleteAccountPage'
import OfflineBanner from './components/OfflineBanner'
import InstallPrompt from './components/InstallPrompt'
import TermsPage from './components/TermsPage'
import BusinessesPage from './components/BusinessesPage'
import FeedbackModal from './components/FeedbackModal'
const AdminView = lazy(() => import('./components/AdminView'))
const MapView = lazy(() => import('./components/MapView'))

const PRIMARY_TABS = ['home', 'explore', 'saved', 'profile']
// Shared product tokens keep legacy surfaces aligned with the main screens.
const APP_BG = 'var(--ui-bg)'      // app background
const APP_PANEL = 'var(--ui-surface)'   // cards / surfaces
const APP_BORDER = 'var(--ui-border)'  // hairline borders
const APP_TEXT = 'var(--ui-text)'    // primary ink
const APP_ACCENT = 'var(--ui-accent)'  // links and interactive accents
const APP_MUTED = 'var(--ui-muted)'   // muted text
const APP_SOFT = 'var(--ui-muted)'    // body copy
const APP_INK = 'var(--ui-text)'     // dark pill / primary button background

// System typography with Hebrew fallback.
const SERIF = "var(--ui-font)"
const NAV_HEIGHT = 82
const INITIAL_FILTERS = {
  cityFilter: 'All Cities',
  categoryFilter: 'All',
  occasionFilter: 'All',
  priceFilter: 0,
  dateFilter: 'all',
  dietary: [], kosher: 'any', budget: 'any', menuOnly: false,
}

function areFiltersDefault(filters) { return Object.keys(INITIAL_FILTERS).every(key => JSON.stringify(filters[key]) === JSON.stringify(INITIAL_FILTERS[key])) }

function getTonightPlan(plans) {
  const weighted = plans.flatMap((plan) => Array.from({ length: plan.tonight_pick_weight || 1 }, () => plan))
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  return weighted[dayOfYear % weighted.length] || plans[0]
}

function mergeDatePlansWithDefaults(currentPlans) {
  const current = Array.isArray(currentPlans) ? currentPlans : []
  const currentMap = new Map(current.map((plan) => [plan.id, plan]))
  const merged = [...current]
  let changed = false

  DATE_PLANS.forEach((defaultPlan) => {
    if (!currentMap.has(defaultPlan.id)) {
      merged.push(defaultPlan)
      changed = true
    }
  })

  return changed ? merged : current
}

// Human label for a single-spot "simple date", derived from the same food
// classification + category signals the engine already uses (no new data).
// Returns { en, he } so the fallback can name the date honestly: a café is a
// "coffee date", a park is a "scenic walk", etc. — never a fabricated route.
function singleSpotKind(loc) {
  const fc = foodClassOf(loc)
  if (fc.is_food) {
    if (fc.food_type === 'cafe') return { en: 'A simple coffee date', he: 'דייט קפה פשוט' }
    if (fc.food_type === 'dessert') return { en: 'An easy dessert date', he: 'דייט קינוח קליל' }
    if (fc.food_type === 'bar' || fc.food_type === 'winery') return { en: 'A relaxed drinks date', he: 'דייט משקאות רגוע' }
    if (fc.food_type === 'restaurant') return { en: 'A one-stop dinner date', he: 'דייט ארוחת ערב במקום אחד' }
  }
  const cat = `${loc?.category || ''}`.toLowerCase()
  if (/park|garden|beach|promenade|tayelet|trail|nature|outdoor|view|scenic|forest|reserve/.test(cat)) {
    return { en: 'A scenic walk date', he: 'דייט טיול נופי' }
  }
  if (/museum|gallery|art|culture|theat|cinema|activit|experience|escape|bowling|workshop/.test(cat)) {
    return { en: 'An activity date', he: 'דייט פעילות' }
  }
  return { en: 'A simple one-stop date', he: 'דייט פשוט במקום אחד' }
}

export default function App() {
  const [lang, setLang] = useState('en')
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
  }, [lang])
  const [tab, setTab] = useState('home')
  const [overlay, setOverlay] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [detailReturnOverlay, setDetailReturnOverlay] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState(null)
  const [resultIndex, setResultIndex] = useState(0)
  const [suggestPrefillCity, setSuggestPrefillCity] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const savedOwner = useRef(null)
  const [savedPlanIds, setSavedPlanIds] = useLocalStorage('hamakom-saved-plans', [])
  const [savedPlanSnapshots, setSavedPlanSnapshots] = useLocalStorage('hamakom-saved-plan-details-v2', {})
  const [savedPlaceIds, setSavedPlaceIds] = useLocalStorage('hamakom-saved-places', [])
  const [clickedLocationCounts, setClickedLocationCounts] = useLocalStorage('hamakom-clicked-locations', {})
  const [planReminderIds, setPlanReminderIds] = useLocalStorage('hamakom-plan-reminders', [])
  const [reminderTimestamps, setReminderTimestamps] = useLocalStorage('hamakom-reminder-timestamps', {})
  const [dateFeedback, setDateFeedback] = useLocalStorage('hamakom-date-feedback', {})
  const [datePlans, setDatePlans] = useLocalStorage('hamakom-date-plans', DATE_PLANS)
  const [exploreMode, setExploreMode] = useState('list')
  const [browseSearch, setBrowseSearch] = useState('')
  const [browseFilters, setBrowseFilters] = useState(INITIAL_FILTERS)
  const [saveGateItem, setSaveGateItem] = useState(null)
  const [previewPlan, setPreviewPlan] = useState(null)
  const [exploreExpanded, setExploreExpanded] = useState(true)
  const [currentRecommendationId, setCurrentRecommendationId] = useState(null)
  const [showConsentBanner, setShowConsentBanner] = useState(() => !hasAnalyticsDecision())
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => hasAnalyticsConsent())
  const [feedbackNudgePlanId, setFeedbackNudgePlanId] = useState(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [businessLeadContext, setBusinessLeadContext] = useState({ source: 'direct_url', location: null })

  const tx = t[lang]
  const font = "var(--ui-font)"

  const { locations, loading, error: locError } = useLocations()

  useSyncSaves({ authUser, savedPlanIds, setSavedPlanIds, savedPlaceIds, setSavedPlaceIds })

  // Check if any reminder is 24h+ old and no feedback yet — trigger nudge once
  useEffect(() => {
    if (!Object.keys(reminderTimestamps).length) return
    const TWENTY_FOUR_H = 24 * 60 * 60 * 1000
    for (const [planId, ts] of Object.entries(reminderTimestamps)) {
      if (Date.now() - ts >= TWENTY_FOUR_H && !dateFeedback[`plan:${planId}`]) {
        setFeedbackNudgePlanId(planId)
        return
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setDatePlans((current) => mergeDatePlansWithDefaults(current))
  }, [setDatePlans])

  // Vibe-diverse match set. The quiz no longer asks for a vibe (it duplicated
  // the results vibe tabs), so we lead with the objectively strongest plan
  // across ALL vibes, then surface one plan per *other* vibe in the same city
  // so the results page can offer real "3 plans in this city" tabs (not three
  // near-identical plans). Generated plans are built per-focus, so each carries
  // real focus_tags for the tab labels. Empty => the single-spot/honest
  // fallback screen takes over.
  // Curated plans with stops linked to real DB venues where a confident match
  // exists — lets verified curated plans pass the same hard gates as generated
  // plans, and flags plans whose venues have since closed.
  const resolvedDatePlans = useMemo(() => resolveCuratedPlans(datePlans, locations), [datePlans, locations])

  const matchedPlans = useMemo(() => {
    if (!quizAnswers) return []
    const opts = { feedbackByItem: dateFeedback, savedPlaceIds, clickedLocationCounts }
    const FOCI = quizAnswers.focus ? [quizAnswers.focus] : ['outdoors', 'food-drink', 'atmosphere', 'activity']
    const perVibe = FOCI.flatMap((focus) =>
      getSmartMatchedPlans(resolvedDatePlans, locations, { ...quizAnswers, focus }, 4, opts),
    )
    if (!perVibe.length) return []
    perVibe.sort((a, b) => Number(a._singleVenue) - Number(b._singleVenue) || (b._score || 0) - (a._score || 0))
    const primary = perVibe[0]
    const out = [primary]
    const seenIds = new Set([primary.id])
    const seenVibes = new Set([primary.focus_tags?.[0]])
    for (const plan of perVibe) {
      if (out.length >= 3) break
      if (seenIds.has(plan.id) || plan.city !== primary.city) continue
      const vibe = plan.focus_tags?.[0]
      if (seenVibes.has(vibe)) continue
      seenIds.add(plan.id)
      seenVibes.add(vibe)
      out.push(plan)
    }
    // Cities with several good cafés should still have alternatives, even
    // when those dates share a category.
    for (const plan of perVibe) {
      if (out.length >= 3) break
      if (seenIds.has(plan.id) || !sameCity(plan.city, primary.city)) continue
      seenIds.add(plan.id)
      out.push(plan)
    }
    return out
  }, [clickedLocationCounts, dateFeedback, resolvedDatePlans, locations, quizAnswers, savedPlaceIds])

  useEffect(() => {
    if (!quizAnswers || !matchedPlans.length) return
    matchedPlans.forEach((plan) => recordPlanImpression(plan.id))
  }, [matchedPlans, quizAnswers])

  const currentPlan = matchedPlans[resultIndex] || null
  const alternatePlan = matchedPlans.find((_, index) => index !== resultIndex) || null
  // Tonight's Pick / Surprise Me pool: exclude any curated plan with a stop
  // that resolved to a venue we KNOW is closed. Falls back to the full list
  // if verification empties the pool (e.g. locations still loading).
  const tonightPool = useMemo(() => {
    const safe = resolvedDatePlans.filter(curatedPlanSafe)
      .map(p => finalizePlan(p, planLocationRows(p, locations))).filter(Boolean)
    return safe.length ? safe : getSmartMatchedPlans([], locations, { city: 'flexible', seriousness: 'just-met', length: 'short' }, 8)
  }, [resolvedDatePlans, locations])
  const tonightPlan = useMemo(() => getTonightPlan(tonightPool), [tonightPool])
  const savedPlans = useMemo(() => savedPlanIds.map(id => {
    const plan = savedPlanSnapshots[id] || resolvedDatePlans.find(p => p.id === id) || restoreSavedPlan(id, locations)
    return plan ? finalizePlan(plan, planLocationRows(plan, locations), { travelMode: plan.travel_mode, date: plan.planning_date, startTime: plan.start_time }) : null
  }).filter(Boolean), [resolvedDatePlans, savedPlanIds, savedPlanSnapshots, locations])
  const savedPlaces = useMemo(() => locations.filter((location) => savedPlaceIds.includes(location.id)), [locations, savedPlaceIds])
  const savedCount = savedPlans.length + savedPlaces.length
  const availablePlanCities = useMemo(() => {
    const cities = new Set(locations.filter(isDiscoverable).map(l => l.city))
    return [...QUIZ_CITIES.filter(c => cities.has(c)), ...[...cities].filter(c => !QUIZ_CITIES.includes(c)).sort()]
  }, [locations])
  const backupLocations = useMemo(() => {
    if (!quizAnswers) return []
    return getRecommendedLocations(locations, quizAnswers, {
      limit: 3,
      excludeIds: currentPlan?.source_location_ids || [],
      savedPlaceIds,
      clickedLocationCounts,
      feedbackByItem: dateFeedback,
    })
  }, [clickedLocationCounts, currentPlan?.source_location_ids, dateFeedback, locations, quizAnswers, savedPlaceIds])

  // Single-spot date fallback (#6): when no full 2–3 stop plan can be built for
  // the chosen city/vibe, offer the strongest single VERIFIED venue as an
  // explicit one-stop "simple date" rather than dead-ending. Ranking reuses
  // getRecommendedLocations (same city/operational/rating/category/vibe/stage/
  // price/recency signals), but every candidate is then re-checked against the
  // hard gates: real DB venue, operational only, known status only, and the
  // correct city. No placeholder, no closed/temp-closed, no unknown status.
  const singleSpot = useMemo(() => {
    if (!quizAnswers || matchedPlans.length > 0) return null
    const targetCity = quizAnswers.city && quizAnswers.city !== 'flexible' ? quizAnswers.city : null
    const ranked = getRecommendedLocations(locations, quizAnswers, {
      limit: 24,
      savedPlaceIds,
      clickedLocationCounts,
      feedbackByItem: dateFeedback,
    })
    const eligible = ranked.filter(
      (l) => isRealVenueRow(l) && isOperational(l) && (!targetCity || sameCity(l.city, targetCity)),
    )
    return eligible[0] || null
  }, [clickedLocationCounts, dateFeedback, locations, matchedPlans.length, quizAnswers, savedPlaceIds])

  // Proven recovery (#5): only options we can verify right now — never invented.
  // `vibes`: other foci that DO yield a full plan in the same city.
  // `cities`: other quiz cities that DO yield a full plan for the chosen vibe.
  const recovery = useMemo(() => {
    const empty = { vibes: [], cities: [] }
    if (!quizAnswers || matchedPlans.length > 0) return empty
    const opts = { feedbackByItem: dateFeedback, savedPlaceIds, clickedLocationCounts }
    const FOCI = ['outdoors', 'food-drink', 'atmosphere', 'activity']
    const city = quizAnswers.city
    const vibes = []
    if (city && city !== 'flexible') {
      for (const f of FOCI) {
        if (f === quizAnswers.focus) continue
        const p = getSmartMatchedPlans(resolvedDatePlans, locations, { ...quizAnswers, focus: f }, 1, opts)[0]
        if (p && sameCity(p.city, city)) vibes.push(f)
      }
    }
    const cities = []
    for (const c of availablePlanCities) {
      if (!c || c === 'flexible' || (city && sameCity(c, city))) continue
      if (cities.length >= 3) break
      const p = getSmartMatchedPlans(resolvedDatePlans, locations, { ...quizAnswers, city: c }, 1, opts)[0]
      if (p && sameCity(p.city, c)) cities.push(c)
    }
    return { vibes, cities }
  }, [availablePlanCities, clickedLocationCounts, resolvedDatePlans, dateFeedback, locations, matchedPlans.length, quizAnswers, savedPlaceIds])

  const curatedExploreSections = useMemo(
    () => [
      {
        id: 'low-pressure',
        title: lang === 'he' ? 'התחלות קלות' : 'Low-pressure starts',
        text: lang === 'he' ? 'מקומות רגועים כשאתם רוצים משהו קל, בטוח וזורם.' : 'Calm picks when you want something easy, low-risk, and smooth.',
        items: getRecommendedLocations(locations, { seriousness: 'just-met', focus: 'food-drink', length: 'short', when: 'tonight', city: 'flexible' }, { limit: 3, savedPlaceIds, clickedLocationCounts, feedbackByItem: dateFeedback }),
      },
      {
        id: 'thoughtful',
        title: lang === 'he' ? 'יותר מכוון' : 'More intentional nights',
        text: lang === 'he' ? 'כשבא לכם משהו שמרגיש מושקע יותר בלי להיות כבד.' : 'When you want something more thoughtful without making it feel heavy.',
        items: getRecommendedLocations(locations, { seriousness: 'getting-to-know', focus: 'atmosphere', length: 'medium', when: 'thursday-night', city: 'flexible' }, { limit: 3, savedPlaceIds, clickedLocationCounts, feedbackByItem: dateFeedback }),
      },
      {
        id: 'outdoors',
        title: lang === 'he' ? 'אוויר ומרחב' : 'Air and movement',
        text: lang === 'he' ? 'למי שחושב יותר טוב תוך כדי הליכה, נוף או קצת מרחב.' : 'For people who think better with a walk, a view, or a little breathing room.',
        items: getRecommendedLocations(locations, { seriousness: 'getting-to-know', focus: 'outdoors', length: 'medium', when: 'planning-ahead', city: 'flexible' }, { limit: 3, savedPlaceIds, clickedLocationCounts, feedbackByItem: dateFeedback }),
      },
    ],
    [clickedLocationCounts, dateFeedback, lang, locations, savedPlaceIds]
  )
  const filteredLocations = useMemo(() => {
    const { cityFilter, categoryFilter, occasionFilter, priceFilter, dateFilter } = browseFilters
    const query = browseSearch.trim().toLowerCase()

    return locations.filter((location) => {
      if (!isDiscoverable(location) || !matchesVenuePreferences(location, browseFilters)) return false
      const displayName = lang === 'he' ? location.name_he || location.name : location.name
      const displayCity = lang === 'he' ? location.city_he || location.city : location.city
      const searchableFields = [
        displayName,
        displayCity,
        location.name,
        location.name_he,
        location.city,
        location.city_he,
      ]
      const matchesSearch = !query || catalogSearch(location, query) || searchableFields.some((value) => (value || '').toLowerCase().includes(query))
      if (!matchesSearch) return false

      if (cityFilter !== 'All Cities' && !sameCity(location.city, cityFilter)) return false
      if (categoryFilter !== 'All' && location.category !== categoryFilter) return false
      if (occasionFilter !== 'All' && !location.occasion?.includes(occasionFilter)) return false
      if (priceFilter > 0 && location.price !== priceFilter) return false

      if (dateFilter !== 'all') {
        const stages = Array.isArray(location.date_stage) ? location.date_stage : [location.date_stage]
        if (!stages.includes(Number(dateFilter))) return false
      }

      return true
      // Partners surface first in browse only — quiz recommendations are never
      // influenced by partner status (that ranking is not for sale).
    }).sort((a, b) => (b.is_partner === true) - (a.is_partner === true))
  }, [browseFilters, browseSearch, lang, locations])

  useEffect(() => {
    if (!quizAnswers || !currentPlan) return

    void trackEvent('plan_result_viewed', {
      userId: authUser?.id,
      itemType: 'plan',
      itemId: currentPlan.id,
      properties: {
        quiz_answers: quizAnswers,
        plan_city: currentPlan.city,
        plan_length: currentPlan.length_tags?.[0] || null,
      },
    })

    let active = true

    createRecommendationImpression({
      userId: authUser?.id,
      quizAnswers,
      primaryPlanId: currentPlan.id,
      backupLocationIds: backupLocations.map((location) => location.id),
    }).then((id) => {
      if (active) setCurrentRecommendationId(id)
    })

    return () => {
      active = false
    }
  }, [authUser?.id, backupLocations, currentPlan, quizAnswers])

  useEffect(() => {
    if (tab !== 'explore') return
    if (!browseSearch && areFiltersDefault(browseFilters)) return

    void trackEvent('explore_filters_changed', {
      userId: authUser?.id,
      properties: {
        search: browseSearch || '',
        filters: browseFilters,
      },
    })
  }, [authUser?.id, browseFilters, browseSearch, tab])

  // Partner-card impressions in browse — the numbers shown to venues. Each
  // partner is counted at most once per session, however often filters change.
  const seenPartnerImpressions = useRef(new Set())
  useEffect(() => {
    if (tab !== 'explore') return
    const freshIds = filteredLocations
      .filter((location) => location.is_partner && !seenPartnerImpressions.current.has(location.id))
      .map((location) => location.id)
    if (freshIds.length === 0) return
    freshIds.forEach((id) => {
      seenPartnerImpressions.current.add(id)
      void trackEvent('partner_impression', {
        userId: authUser?.id,
        itemType: 'place',
        itemId: id,
        properties: { source: 'explore' },
      })
    })
  }, [authUser?.id, filteredLocations, tab])

  useEffect(() => {
    if (!supabase) return undefined

    const applyAccount = (user) => {
      let previous = savedOwner.current
      try { previous ||= localStorage.getItem('hamakom-saves-owner') } catch { /* Private browsing. */ }
      const next = user?.id || null
      if (shouldClearAccountData(previous, next)) {
        setSavedPlanIds([])
        setSavedPlaceIds([])
        setSavedPlanSnapshots({})
        setPlanReminderIds([])
        setReminderTimestamps({})
        setDateFeedback({})
        setClickedLocationCounts({})
        setQuizAnswers(null)
        clearAnswersFromSession()
        clearPendingSaveFromSession()
      }
      savedOwner.current = next
      try {
        if (next) localStorage.setItem('hamakom-saves-owner', next)
        else localStorage.removeItem('hamakom-saves-owner')
      } catch { /* In-memory isolation still applies. */ }
      setAuthUser(user)
    }

    const restoreQuiz = () => {
      const pendingAnswers = loadAnswersFromSession()
      if (pendingAnswers) {
        setQuizAnswers(pendingAnswers)
        setResultIndex(0)
        setOverlay('quiz-results')
        clearAnswersFromSession()
      }
    }

    const commitPendingSave = () => {
      const pendingSave = loadPendingSaveFromSession()
      if (!pendingSave?.id) return

      if (pendingSave.type === 'plan') {
        setSavedPlanIds((prev) => (prev.includes(pendingSave.id) ? prev : [...prev, pendingSave.id]))
      }

      if (pendingSave.type === 'place') {
        setSavedPlaceIds((prev) => (prev.includes(pendingSave.id) ? prev : [...prev, pendingSave.id]))
      }

      clearPendingSaveFromSession()
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      applyAccount(session?.user || null)
      if (!session?.user) return
      commitPendingSave()
      restoreQuiz()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null
      applyAccount(user)

      if (user && event === 'SIGNED_IN') {
        void trackEvent('signup_completed', { userId: user.id })
        commitPendingSave()
        restoreQuiz()
        setOverlay((current) => (current === 'save-gate' ? saveGateItem?.returnOverlay ?? 'quiz-results' : current))
        setSaveGateItem(null)
      }
    })

    const disposeNativeAuth = initNativeAuth(supabase)

    return () => {
      subscription.unsubscribe()
      disposeNativeAuth()
    }
  }, [saveGateItem, setSavedPlaceIds, setSavedPlanIds, setSavedPlanSnapshots, setPlanReminderIds, setReminderTimestamps, setDateFeedback, setClickedLocationCounts])

  useEffect(() => {
    if (!authUser || !quizAnswers || !supabase) return

    supabase
      .from('user_quiz_results')
      .insert({ user_id: authUser.id, answers: quizAnswers })
      .then(({ error }) => {
        if (error) console.warn('quiz save:', error.message)
      })
  }, [authUser, quizAnswers])

  useEffect(() => {
    const base = 'HaMakom · המקום'
    let title = base
    let desc = 'Date ideas for Jewish singles in Israel.'
    let canonical = `${siteOrigin()}/`

    if (overlay === 'detail' && selectedLocation) {
      title = `${selectedLocation.name} · HaMakom`
      desc = selectedLocation.description || desc
      canonical = locationCanonical(selectedLocation)
    } else if ((overlay === 'quiz-results' || overlay === 'results') && currentPlan) {
      title = `${currentPlan.title_en} · HaMakom`
      desc = currentPlan.narrative_en?.slice(0, 140) || desc
    } else if (overlay === 'privacy') {
      title = 'Privacy Policy · HaMakom'
      canonical = `${siteOrigin()}/privacy`
    } else if (overlay === 'terms') {
      title = 'Terms of Service · HaMakom'
      canonical = `${siteOrigin()}/terms`
    } else if (overlay === 'businesses') {
      title = 'Partner with HaMakom · Reach Religious Daters'
      desc = 'List your venue on HaMakom and reach religious couples actively deciding where to go on a date.'
      canonical = `${siteOrigin()}/for-businesses`
    }

    document.title = title
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', desc)
    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute('content', title)
    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc) ogDesc.setAttribute('content', desc)
    const ogUrl = document.querySelector('meta[property="og:url"]')
    if (ogUrl) ogUrl.setAttribute('content', canonical)

    let canonicalLink = document.querySelector('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.rel = 'canonical'
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.href = canonical

    // JSON-LD structured data for location detail pages
    let ldScript = document.getElementById('ld-json')
    if (overlay === 'detail' && selectedLocation) {
      if (!ldScript) {
        ldScript = document.createElement('script')
        ldScript.id = 'ld-json'
        ldScript.type = 'application/ld+json'
        document.head.appendChild(ldScript)
      }
      ldScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: selectedLocation.name,
        description: selectedLocation.description || '',
        address: {
          '@type': 'PostalAddress',
          addressLocality: selectedLocation.city,
          addressCountry: 'IL',
        },
        url: canonical,
        ...(selectedLocation.image_url ? { image: selectedLocation.image_url } : {}),
      })
    } else if (ldScript) {
      ldScript.remove()
    }
  }, [overlay, selectedLocation, currentPlan])

  const openRoute = useCallback((route) => {
    if (!route) return
    if (route.type === 'plan') {
      const shared = restoreSharedPlan(route, locations)
      if (route.lang === 'he' || route.lang === 'en') setLang(route.lang)
      setPreviewPlan(shared)
      setOverlay(shared ? 'shared-plan' : 'unavailable-plan')
      return
    }
    if (route.type === 'location') {
      const loc = locations.find((l) => l.slug === route.key || String(l.id) === route.key)
      if (!loc) {
        window.history.replaceState({}, '', '/')
        return
      }
      setDetailReturnOverlay(null)
      setSelectedLocation(loc)
      setOverlay('detail')
      void trackEvent('location_detail_viewed', {
        userId: authUser?.id,
        itemType: 'place',
        itemId: loc.id,
        properties: { source: 'deep-link' },
      })
      return
    }
    if (route.type === 'privacy') {
      setOverlay('privacy')
      return
    }
    if (route.type === 'terms') {
      setOverlay('terms')
      return
    }
    if (route.type === 'delete-account') {
      setOverlay('delete-account')
      return
    }
    if (route.type === 'businesses') {
      setBusinessLeadContext({ source: 'direct_url', location: null })
      setOverlay('businesses')
    }
  }, [authUser?.id, locations, setLang])

  const handleAppBack = useCallback(() => {
    if (overlay === 'detail') {
      setOverlay(detailReturnOverlay)
      setSelectedLocation(null)
      setDetailReturnOverlay(null)
      window.history.pushState({}, '', '/')
      return true
    }
    if (overlay === 'save-gate' && saveGateItem) {
      clearPendingSaveFromSession()
      setOverlay(saveGateItem.returnOverlay ?? null)
      setSaveGateItem(null)
      return true
    }
    if (overlay === 'suggest') {
      setSuggestPrefillCity('')
      setOverlay(null)
      return true
    }
    if (overlay === 'businesses' || overlay === 'privacy' || overlay === 'terms' || overlay === 'delete-account') {
      window.history.pushState({}, '', '/')
      setOverlay(null)
      return true
    }
    if (overlay) {
      setOverlay(null)
      return true
    }
    if (tab !== 'home') {
      setTab('home')
      setOverlay(null)
      setSelectedLocation(null)
      setDetailReturnOverlay(null)
      return true
    }
    return false
  }, [overlay, detailReturnOverlay, saveGateItem, tab])

  useEffect(() => {
    setNativeBackHandler(handleAppBack)
  }, [handleAppBack])

  useEffect(() => {
    const disposeNativeShell = initNativeShell({
      onRoute: (path) => openRoute(parseAppRoute(path)),
    })
    return disposeNativeShell
  }, [openRoute])

  // ── Shared deep links ───────────────────────────────────────────────────
  // /location/<slug>, /privacy, and /terms open directly (no login required).
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current) return
    const route = parseAppRoute(window.location.pathname + window.location.search)
    if (!route) return
    if (loading && ['plan', 'location'].includes(route.type)) return
    if (route.type === 'location' && !locations.length) return
    deepLinkHandled.current = true
    openRoute(route)
  }, [loading, locations, openRoute])

  useEffect(() => {
    const onPop = () => {
      const route = parseAppRoute(window.location.pathname + window.location.search)
      if (route) {
        openRoute(route)
        return
      }
      setOverlay((cur) => (['detail', 'privacy', 'terms', 'delete-account', 'businesses', 'shared-plan', 'unavailable-plan'].includes(cur) ? null : cur))
      setSelectedLocation(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [openRoute])

  // ── Beta funnel analytics ───────────────────────────────────────────────
  // Which result screen is showing. Drives the funnel events without firing on
  // vibe-tab swaps (resultView is stable while a full plan stays shown).
  const resultView =
    currentPlan && (overlay === 'quiz-results' || (overlay === 'save-gate' && saveGateItem?.type !== 'place'))
      ? 'full_plan'
      : overlay === 'quiz-results' && !currentPlan && quizAnswers
        ? (singleSpot ? 'single_spot' : 'no_plan')
        : null

  useEffect(() => {
    if (!resultView) return
    const shown = {
      full_plan: 'full_plan_shown',
      single_spot: 'single_spot_fallback_shown',
      no_plan: 'no_plan_fallback_shown',
    }[resultView]
    const properties = {
      city: quizAnswers?.city || null,
      seriousness: quizAnswers?.seriousness || null,
      length: quizAnswers?.length || null,
      outcome: resultView,
    }
    void trackEvent('plan_generated', { userId: authUser?.id, properties })
    void trackEvent(shown, { userId: authUser?.id, properties })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultView, quizAnswers])

  useEffect(() => {
    if (tab === 'home' && !overlay) void trackEvent('landing_page_view', { userId: authUser?.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, overlay])

  useEffect(() => {
    if (overlay === 'save-gate') {
      void trackEvent('signup_started', {
        userId: authUser?.id,
        properties: { source: saveGateItem?.type || 'save-gate' },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay])

  const selectTab = (nextTab) => {
    if (!PRIMARY_TABS.includes(nextTab)) return
    setTab(nextTab)
    setOverlay(null)
    setSelectedLocation(null)
    setDetailReturnOverlay(null)
    if (nextTab === 'explore') {
      void trackEvent('explore_opened', {
        userId: authUser?.id,
        properties: { source: tab },
      })
    }
    if (nextTab === 'explore') {
      setExploreMode('list')
      setExploreExpanded(false)
    }
  }

  const handleQuizComplete = (answers) => {
    const seeded = { ...answers, _seed: Date.now() }
    setQuizAnswers(seeded)
    setResultIndex(0)
    saveAnswersToSession(seeded)
    setOverlay('quiz-results')
    void trackEvent('quiz_completed', {
      userId: authUser?.id,
      properties: { ...answers, lang },
    })
  }

  const applyPlanPreferences = (preferences, base = quizAnswers) => {
    const next = { ...base, ...getPlanPreferences(preferences), _seed: base?._seed || Date.now(), when: 'planning-ahead' }
    setQuizAnswers(next)
    setResultIndex(0)
    saveAnswersToSession(next)
    setPreviewPlan(null)
    window.history.replaceState({}, '', '/')
    setOverlay('quiz-results')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  }

  // Re-run the results flow with patched answers (proven recovery actions:
  // keep the city + change the vibe, or keep the vibe + change the city).
  const applyRecovery = (patch) => {
    if (!quizAnswers) return
    // No re-seed needed: a recovery patch always changes the focus or city, so
    // the answers object identity changes and the match memo recomputes.
    const next = { ...quizAnswers, ...patch }
    setQuizAnswers(next)
    setResultIndex(0)
    saveAnswersToSession(next)
    setOverlay('quiz-results')
    void trackEvent('quiz_recovery_applied', {
      userId: authUser?.id,
      properties: { ...patch, lang },
    })
  }

  const handleSavePlan = () => {
    if (!currentPlan) return
    setSavedPlanSnapshots(prev => ({ ...prev, [currentPlan.id]: currentPlan }))

    void trackEvent('save_clicked', {
      userId: authUser?.id,
      itemType: 'plan',
      itemId: currentPlan.id,
      properties: { signed_in: Boolean(authUser) },
    })

    setSavedPlanIds((prev) => (prev.includes(currentPlan.id) ? prev : [...prev, currentPlan.id]))
    void trackEvent('plan_saved', { userId: authUser?.id, itemType: 'plan', itemId: currentPlan.id })
    void upsertRecommendationOutcome(currentRecommendationId, { saved: true })
  }

  const handleRemovePlan = (planId) => {
    setSavedPlanIds((prev) => prev.filter((id) => id !== planId))
  }

  const handleTogglePlanReminder = (planId) => {
    const enabled = !planReminderIds.includes(planId)
    setPlanReminderIds((prev) => (prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]))
    if (enabled) {
      setReminderTimestamps((prev) => ({ ...prev, [planId]: Date.now() }))
    } else {
      setReminderTimestamps((prev) => { const next = { ...prev }; delete next[planId]; return next })
    }
    void trackEvent('plan_reminder_toggled', {
      userId: authUser?.id,
      itemType: 'plan',
      itemId: planId,
      properties: { enabled },
    })
    if (enabled) {
      void upsertRecommendationOutcome(currentRecommendationId, { reminder_set: true })
    }
  }

  const handleSubmitFeedback = (itemKey, feedback) => {
    const nextFeedback = {
      ...feedback,
      updatedAt: new Date().toISOString(),
    }

    setDateFeedback((prev) => ({
      ...prev,
      [itemKey]: nextFeedback,
    }))

    const [itemType, itemId] = itemKey.split(':')
    void trackEvent('feedback_submitted', {
      userId: authUser?.id,
      itemType,
      itemId,
      properties: {
        went: nextFeedback.went ?? null,
        rating: nextFeedback.rating ?? null,
        again: nextFeedback.again ?? null,
      },
    })
    void saveUserFeedback({ userId: authUser?.id, itemType, itemId, feedback: nextFeedback })
    if (itemType === 'plan') {
      void upsertRecommendationOutcome(currentRecommendationId, {
        went: nextFeedback.went ?? null,
        rating: nextFeedback.rating ?? null,
        would_do_again: nextFeedback.again ?? null,
      })
    }
  }

  const handleToggleSavePlace = (location) => {
    if (!location) return

    void trackEvent('save_clicked', {
      userId: authUser?.id,
      itemType: 'place',
      itemId: location.id,
      properties: { signed_in: Boolean(authUser) },
    })

    const willSave = !savedPlaceIds.includes(location.id)
    setSavedPlaceIds((prev) => (prev.includes(location.id) ? prev.filter((id) => id !== location.id) : [...prev, location.id]))
    void trackEvent('saved_place_toggled', { userId: authUser?.id, itemType: 'place', itemId: location.id, properties: { saved: willSave } })
  }

  const openDetail = (location) => {
    setClickedLocationCounts((prev) => ({
      ...prev,
      [location.id]: (prev[location.id] || 0) + 1,
    }))
    void trackEvent('location_detail_viewed', {
      userId: authUser?.id,
      itemType: 'place',
      itemId: location.id,
      properties: { source: overlay || tab },
    })
    setDetailReturnOverlay(overlay)
    setSelectedLocation(location)
    setOverlay('detail')
    const slug = location.slug || location.id
    window.history.pushState({}, '', `/location/${encodeURIComponent(slug)}`)
  }

  const openLocationFromResults = (location) => {
    setClickedLocationCounts((prev) => ({
      ...prev,
      [location.id]: (prev[location.id] || 0) + 1,
    }))
    void trackEvent('backup_location_opened', {
      userId: authUser?.id,
      itemType: 'place',
      itemId: location.id,
      properties: { source_plan_id: currentPlan?.id || null },
    })
    setDetailReturnOverlay('quiz-results')
    setSelectedLocation(location)
    setOverlay('detail')
    const slug = location.slug || location.id
    window.history.pushState({}, '', `/location/${slug}`)
  }

  const openQuiz = () => {
    setOverlay('quiz')
    void trackEvent('quiz_started', {
      userId: authUser?.id,
      properties: { source: tab },
    })
  }

  const openPlanPreview = () => {
    setPreviewPlan(null)
    setOverlay('plan-preview')
  }

  const openCustomPlanBuilder = () => {
    setOverlay('build-plan')
  }

  const trackBusinessCtaViewed = useCallback((source, location = null) => {
    void trackEvent('business_cta_viewed', {
      userId: authUser?.id,
      itemType: location ? 'place' : null,
      itemId: location?.id ?? null,
      properties: { source },
    })
  }, [authUser?.id])

  const openBusinesses = useCallback((source = 'direct_url', location = null) => {
    void trackEvent(location ? 'listing_claim_started' : 'business_cta_clicked', {
      userId: authUser?.id,
      itemType: location ? 'place' : null,
      itemId: location?.id ?? null,
      properties: { source },
    })
    setBusinessLeadContext({ source, location })
    window.history.pushState({}, '', '/for-businesses')
    setOverlay('businesses')
  }, [authUser?.id])

  if (overlay === 'quiz') {
    return <QuizStepper lang={lang} font={font} cityOptions={availablePlanCities} onComplete={handleQuizComplete} onBack={() => setOverlay(null)} />
  }

  if (overlay === 'detail' && selectedLocation) {
    return (
      <DetailView
        loc={selectedLocation}
        lang={lang}
        tx={tx}
        font={font}
        saved={savedPlaceIds.includes(selectedLocation.id)}
        onToggleSave={() => handleToggleSavePlace(selectedLocation, { returnOverlay: 'detail' })}
        showSave
        dateFeedback={dateFeedback}
        setDateFeedback={setDateFeedback}
        onMapOpen={(loc) => void trackEvent('map_opened', {
          userId: authUser?.id,
          itemType: 'place',
          itemId: loc.id,
          properties: { is_partner: Boolean(loc.is_partner) },
        })}
        onReserve={(loc) => void trackEvent('partner_reserve_clicked', {
          userId: authUser?.id,
          itemType: 'place',
          itemId: loc.id,
        })}
        onPhone={(loc) => void trackEvent('partner_phone_clicked', {
          userId: authUser?.id,
          itemType: 'place',
          itemId: loc.id,
          properties: { is_partner: Boolean(loc.is_partner) },
        })}
        onShare={(loc) => void trackEvent('venue_shared', {
          userId: authUser?.id,
          itemType: 'place',
          itemId: loc.id,
          properties: { is_partner: Boolean(loc.is_partner) },
        })}
        onClaim={(loc) => openBusinesses('venue_detail_claim', loc)}
        onClaimViewed={(loc) => trackBusinessCtaViewed('venue_detail_claim', loc)}
        onBack={() => {
          setOverlay(detailReturnOverlay)
          setSelectedLocation(null)
          setDetailReturnOverlay(null)
          window.history.pushState({}, '', '/')
        }}
      />
    )
  }

  if (overlay === 'suggest') {
    return <SuggestView lang={lang} tx={tx} font={font} initialCity={suggestPrefillCity} onBack={() => { setSuggestPrefillCity(''); setOverlay(null) }} />
  }

  if (overlay === 'privacy') {
    return <PrivacyPage lang={lang} font={font} onBack={() => { window.history.pushState({}, '', '/'); setOverlay(null) }} />
  }

  if (overlay === 'businesses') {
    return (
      <BusinessesPage
        tx={tx}
        font={font}
        source={businessLeadContext.source}
        initialVenue={businessLeadContext.location}
        onBack={() => { window.history.pushState({}, '', '/'); setOverlay(null) }}
        onEvent={(eventName, properties = {}) => void trackEvent(eventName, {
          userId: authUser?.id,
          itemType: businessLeadContext.location ? 'place' : null,
          itemId: businessLeadContext.location?.id ?? null,
          properties: { source: businessLeadContext.source, ...properties },
        })}
      />
    )
  }

  if (overlay === 'terms') {
    return <TermsPage lang={lang} font={font} onBack={() => { window.history.pushState({}, '', '/'); setOverlay(null) }} />
  }

  if (overlay === 'delete-account') {
    return <DeleteAccountPage lang={lang} font={font} onBack={() => { window.history.pushState({}, '', '/'); setOverlay(null) }} />
  }

  if (overlay === 'admin') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--ui-bg)' }} />}>
      <AdminView
        lang={lang}
        font={font}
        onBack={() => setOverlay(null)}
        authUser={authUser}
        totalLocations={locations.length}
        locations={locations}
        datePlans={datePlans}
        onSaveDatePlans={setDatePlans}
        onResetDatePlans={() => setDatePlans(DATE_PLANS)}
      />
      </Suspense>
    )
  }

  if (loading && !overlay && /^\/(?:plan(?:\?|$)|location\/)/.test(window.location.pathname + window.location.search)) {
    return <div role="status" style={{ padding: '60px 24px', textAlign: 'center', color: APP_TEXT, fontFamily: font }}>{lang === 'he' ? 'פותחים את פרטי המקום והשעות…' : 'Opening the place and checking its details…'}</div>
  }

  if (overlay === 'unavailable-plan') {
    return <EmptyState title={lang === 'he' ? 'צריך לעדכן את התוכנית הזו' : 'This plan needs an update'} text={lang === 'he' ? 'חלק מהמקומות או המעברים כבר לא ניתנים לאימות. בחרו תוכנית חדשה.' : 'A place or route in this shared plan is no longer available or verifiable. Find a fresh date idea.'} actionLabel={tx.planHeroAction} onAction={openQuiz} />
  }

  if (overlay === 'shared-plan' && previewPlan) {
    return <ResultsPage lang={lang} font={font} plan={previewPlan} locations={locations}
      answers={preferencesFromPlan(previewPlan)} onApplyPreferences={p => applyPlanPreferences(p, preferencesFromPlan(previewPlan))} onRetakeQuiz={openQuiz} onBrowseAll={() => { setOverlay(null); setTab('explore'); window.history.pushState({}, '', '/') }}
      onOpenBackupLocation={loc => openDetail(loc, 'shared-plan')} onBuildYourOwnPlan={() => setOverlay('build-plan')}
      onSavePlan={() => { setSavedPlanSnapshots(prev => ({ ...prev, [previewPlan.id]: previewPlan })); setSavedPlanIds(prev => [...new Set([...prev, previewPlan.id])]) }}
      saved={savedPlanIds.includes(previewPlan.id)} onSetReminder={() => handleTogglePlanReminder(previewPlan.id)}
      reminderSet={planReminderIds.includes(previewPlan.id)} onSuggestPlace={() => setOverlay('suggest')} />
  }

  if (overlay === 'plan-preview' && (previewPlan || tonightPlan)) {
    const plan = previewPlan || tonightPlan
    return <ResultsPage lang={lang} font={font} plan={plan} locations={locations} answers={preferencesFromPlan(plan)}
      onApplyPreferences={p => applyPlanPreferences(p, preferencesFromPlan(plan))}
      onRetakeQuiz={openQuiz} onBrowseAll={() => { setPreviewPlan(null); setOverlay(null); selectTab('explore') }}
      onBuildYourOwnPlan={openCustomPlanBuilder} onOpenBackupLocation={openDetail}
      onSavePlan={() => { setSavedPlanSnapshots(prev => ({ ...prev, [plan.id]: plan })); setSavedPlanIds(prev => [...new Set([...prev, plan.id])]) }}
      saved={savedPlanIds.includes(plan.id)} onSetReminder={() => handleTogglePlanReminder(plan.id)}
      reminderSet={planReminderIds.includes(plan.id)} />
  }

  if (overlay === 'build-plan') {
    return (
      <CustomPlanBuilder
        lang={lang}
        font={font}
        tx={tx}
        locations={locations}
        onBack={() => setOverlay(null)}
        onOpenDetail={openDetail}
      />
    )
  }

  // Empty-state fallback: the user finished the quiz but the engine found no
  // full 2–3 stop plan that meets the geographic + focus bar for their answers.
  // Rather than dead-end, we (1) try the strongest single VERIFIED venue as an
  // explicit one-stop "simple date" (#6) and (2) offer only PROVEN recovery
  // (vibes/cities we just confirmed yield a plan) (#5). Nothing fabricated.
  if (overlay === 'quiz-results' && !currentPlan && quizAnswers) {
    const isHe = lang === 'he'
    const cityLabel = quizAnswers.city && quizAnswers.city !== 'flexible' ? quizAnswers.city : null
    const FOCUS_LABELS = {
      'outdoors': { en: 'something outdoorsy', he: 'משהו בחוץ' },
      'food-drink': { en: 'food & drinks', he: 'אוכל ושתייה' },
      'atmosphere': { en: 'a more intimate vibe', he: 'אווירה אינטימית' },
      'activity': { en: 'something to do together', he: 'פעילות משותפת' },
    }
    const hasRecovery = recovery.vibes.length > 0 || recovery.cities.length > 0
    const hasPreferences = planPreferenceLabels(quizAnswers, lang).length > 0
    const preferencePanel = <div style={{ width: '100%', maxWidth: 460, marginTop: 18 }}><PlanPreferences answers={quizAnswers} lang={lang} onApply={applyPlanPreferences} /></div>

    const chipStyle = { background: 'var(--ui-surface)', color: 'var(--ui-text)', border: '1px solid #E6DCC8', borderRadius: 999, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }

    const recoveryBlock = hasRecovery ? (
        <div style={{ marginTop: 22, width: '100%', maxWidth: 460 }}>
          <div style={{ fontSize: 12.5, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--ui-muted)', fontWeight: 700, marginBottom: 10 }}>
            {isHe ? 'אפשרויות שכן עובדות' : 'Options that do work'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {recovery.vibes.map((f) => (
              <button key={`v-${f}`} onClick={() => applyRecovery({ focus: f })} style={chipStyle}>
                {isHe
                  ? `${cityLabel ? `להישאר ב${cityLabel}, ` : ''}${FOCUS_LABELS[f]?.he || f}`
                  : `${cityLabel ? `Keep ${cityLabel} — ` : ''}${FOCUS_LABELS[f]?.en || f}`}
              </button>
            ))}
            {recovery.cities.map((c) => (
              <button key={`c-${c}`} onClick={() => applyRecovery({ city: c })} style={chipStyle}>
                {isHe ? `לנסות ב${c}` : `Try ${c} instead`}
              </button>
            ))}
          </div>
        </div>
    ) : null

    // (A) Strong single verified venue exists → one-stop "simple date".
    if (singleSpot) {
      const kind = singleSpotKind(singleSpot)
      const name = isHe ? singleSpot.name_he || singleSpot.name : singleSpot.name
      const placeCity = isHe ? singleSpot.city_he || singleSpot.city : singleSpot.city
      const blurb = isHe ? singleSpot.description_he || singleSpot.description : singleSpot.description
      const saved = savedPlaceIds.includes(singleSpot.id)
      return (
        <div style={{ minHeight: '100dvh', background: 'var(--ui-bg)', color: 'var(--ui-text)', fontFamily: font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center' }}>
          {/* Honest banner: this is one stop, not a route. */}
          <div style={{ background: '#FBF4DF', border: '1px solid #E7D9A8', color: '#7A5E12', borderRadius: 12, padding: '11px 16px', fontSize: 13, lineHeight: 1.5, maxWidth: 460, marginBottom: 18 }}>
            {isHe
              ? 'אין מספיק עצירות קרובות למסלול מלא, אבל זו אופציה חזקה לדייט פשוט.'
              : 'Not enough nearby stops for a full route, but this is a strong simple date option.'}
          </div>
          <div style={{ background: 'var(--ui-surface)', border: '1px solid #EBE2D0', borderRadius: 18, padding: '22px 22px 20px', width: '100%', maxWidth: 460, textAlign: isHe ? 'right' : 'left' }}>
            <div style={{ fontSize: 12.5, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--ui-accent)', fontWeight: 700, marginBottom: 8 }}>
              {isHe ? kind.he : kind.en}
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: '0 0 6px', lineHeight: 1.2 }}>{name}</h1>
            {placeCity ? <div style={{ fontSize: 14, color: 'var(--ui-muted)', marginBottom: blurb ? 12 : 0 }}>{placeCity}</div> : null}
            {blurb ? <p style={{ fontSize: 14, color: 'var(--ui-muted)', lineHeight: 1.55, margin: 0 }}>{blurb}</p> : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button
                onClick={() => openLocationFromResults(singleSpot)}
                style={{ background: 'var(--ui-text)', color: '#ffffff', border: 'none', borderRadius: 12, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flex: 1 }}
              >
                {isHe ? 'לפרטים ולמפה' : 'See details & map'}
              </button>
              <button
                onClick={() => handleToggleSavePlace(singleSpot, { returnOverlay: 'quiz-results' })}
                style={{ background: 'transparent', color: 'var(--ui-text)', border: '1px solid #E6DCC8', borderRadius: 12, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {saved ? (isHe ? '✓ נשמר' : '✓ Saved') : (isHe ? 'שמירה' : 'Save')}
              </button>
            </div>
          </div>
          {preferencePanel}
          {recoveryBlock}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 22 }}>
            <button onClick={() => setOverlay('quiz')} style={chipStyle}>
              {isHe ? 'לשנות תשובות' : 'Change answers'}
            </button>
            <button onClick={() => { setOverlay(null); setTab('explore'); setExploreExpanded(true) }} style={chipStyle}>
              {isHe ? 'לעיין במקומות מאומתים' : 'Browse verified places'}
            </button>
            <button onClick={openCustomPlanBuilder} style={chipStyle}>
              {isHe ? 'לבנות מסלול משלכם' : 'Build your own plan'}
            </button>
          </div>
        </div>
      )
    }

    // (B) No full plan and no single strong venue → honest fallback + proven recovery.
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--ui-bg)', color: 'var(--ui-text)', fontFamily: font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🌒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px', maxWidth: 420, lineHeight: 1.25 }}>
          {hasPreferences
            ? (isHe ? 'אין כרגע רעיונות שמתאימים לכל ההעדפות' : 'No ideas match all these preferences yet')
            : isHe
            ? cityLabel ? `אין לנו עדיין מספיק אופציות חזקות ב${cityLabel}` : 'אין לנו עדיין מספיק אופציות חזקות לדייט הזה'
            : cityLabel ? `Not enough strong options in ${cityLabel} yet` : 'Not enough strong options for this date yet'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ui-muted)', maxWidth: 420, lineHeight: 1.55, margin: '0 0 4px' }}>
          {isHe
            ? 'אפשר לעדכן את ההעדפות כאן או לעיין במקומות באזור.'
            : 'Adjust your preferences below or browse places in the area.'}
        </p>
        {preferencePanel}
        {recoveryBlock}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 22 }}>
          <button
            onClick={() => setOverlay('quiz')}
            style={{ background: 'var(--ui-text)', color: '#ffffff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isHe ? 'נסו שוב' : 'Try different answers'}
          </button>
          <button
            onClick={() => { setOverlay(null); setTab('explore'); setExploreExpanded(true) }}
            style={{ background: 'transparent', color: 'var(--ui-text)', border: '1px solid #EBE2D0', borderRadius: 10, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isHe ? 'עיינו במקומות' : 'Browse all locations'}
          </button>
        </div>
      </div>
    )
  }

  if ((overlay === 'quiz-results' || (overlay === 'save-gate' && saveGateItem?.type !== 'place')) && currentPlan) {
    return (
      <>
        <div style={{ paddingBottom: 76 }}>
        <ResultsPage
          locations={locations}
          lang={lang}
          font={font}
          plan={currentPlan}
          plans={matchedPlans}
          planIndex={resultIndex}
          onSelectPlan={(i) => setResultIndex(i)}
          userId={authUser?.id}
          planCount={matchedPlans.length}
          alternatePlan={alternatePlan}
          backupLocations={backupLocations}
          answers={quizAnswers || {}}
          onApplyPreferences={applyPlanPreferences}
          saved={savedPlanIds.includes(currentPlan.id)}
          reminderSet={planReminderIds.includes(currentPlan.id)}
          onBrowseAll={() => {
            void trackEvent('explore_opened', {
              userId: authUser?.id,
              properties: { source: 'results' },
            })
            setOverlay(null)
            setTab('explore')
            setExploreExpanded(true)
          }}
          onToggleBackupOptions={() =>
            void trackEvent('backup_options_opened', {
              userId: authUser?.id,
              itemType: 'plan',
              itemId: currentPlan.id,
              properties: { count: backupLocations.length },
            })
          }
          onNextPlan={matchedPlans.length > 1 ? () => setResultIndex((i) => (i + 1) % matchedPlans.length) : undefined}
          onOpenBackupLocation={openLocationFromResults}
          onOpenPlanMaps={() => {
            void trackEvent('map_opened', {
              userId: authUser?.id,
              itemType: 'plan',
              itemId: currentPlan.id,
              properties: { stop_index: 0 },
            })
            void trackEvent('plan_maps_opened', {
              userId: authUser?.id,
              itemType: 'plan',
              itemId: currentPlan.id,
              properties: { stop_index: 0 },
            })
            void upsertRecommendationOutcome(currentRecommendationId, { maps_opened: true })
          }}
          onSavePlan={handleSavePlan}
          onSharePlan={() => {
            void trackEvent('share_clicked', {
              userId: authUser?.id,
              itemType: 'plan',
              itemId: currentPlan.id,
              properties: { channel: 'native-or-whatsapp' },
            })
            void trackEvent('plan_shared', {
              userId: authUser?.id,
              itemType: 'plan',
              itemId: currentPlan.id,
              properties: { channel: 'native-or-whatsapp' },
            })
            void upsertRecommendationOutcome(currentRecommendationId, { shared: true })
          }}
          onSetReminder={() => handleTogglePlanReminder(currentPlan.id)}
          onRetakeQuiz={openQuiz}
          onBuildYourOwnPlan={openCustomPlanBuilder}
          cityLocationCount={
            quizAnswers?.city && quizAnswers.city !== 'flexible'
              ? locations.filter((l) => l.city === quizAnswers.city).length
              : null
          }
          onSuggestPlace={() => {
            setSuggestPrefillCity(quizAnswers?.city && quizAnswers.city !== 'flexible' ? quizAnswers.city : '')
            setOverlay('suggest')
          }}
        />
        </div>
        <BottomNav tx={tx} tab={tab} savedCount={savedCount} onSelect={selectTab} />
        {overlay === 'save-gate' ? (
          <ResultsGateModal
            lang={lang}
            font={font}
            itemType={saveGateItem?.type || 'plan'}
            itemTitle={saveGateItem?.title}
            itemSubtitle={saveGateItem?.subtitle}
            plan={saveGateItem?.type === 'plan' ? currentPlan : null}
            onClose={() => {
              clearPendingSaveFromSession()
              setOverlay('quiz-results')
              setSaveGateItem(null)
            }}
          />
        ) : null}
      </>
    )
  }

  if (overlay === 'save-gate' && saveGateItem?.type === 'place') {
    return (
      <ResultsGateModal
        lang={lang}
        font={font}
        itemType="place"
        itemTitle={saveGateItem.title}
        itemSubtitle={saveGateItem.subtitle}
        onClose={() => {
          clearPendingSaveFromSession()
          setOverlay(saveGateItem.returnOverlay ?? null)
          setSaveGateItem(null)
        }}
      />
    )
  }

  return (
    <div className="hm-app-shell" dir={tx.dir} style={{ background: APP_BG, color: APP_TEXT, fontFamily: font }}>
      <OfflineBanner lang={lang} />
      <InstallPrompt lang={lang} />
      <div
        className="hm-app-shell"
        style={{
          paddingBottom: NAV_HEIGHT + 20,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          ...(tab === 'explore'
            ? {
                height: '100dvh',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        <AppHeader
          tx={tx}
          lang={lang}
          onToggleLang={() => setLang((current) => (current === 'en' ? 'he' : 'en'))}
        />

        <main
          style={{
            maxWidth: 960,
            margin: '0 auto',
            width: '100%',
            padding: '16px 16px 12px',
            boxSizing: 'border-box',
            ...(tab === 'explore'
              ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
              : {}),
          }}
        >
          {tab === 'home' ? (
            <HomePage
              lang={lang}
              tx={tx}
              tonightPlan={tonightPlan}
              loading={loading}
              error={locError}
              onStartQuiz={openQuiz}
              onSurpriseMe={() => {
                const cityKeys = [...new Set(tonightPool.map((p) => p.city).filter(Boolean))]
                const randomCity = cityKeys[Math.floor(Math.random() * cityKeys.length)] || 'flexible'
                const pool = tonightPool.filter((p) => p.city === randomCity)
                const pick = pool[Math.floor(Math.random() * pool.length)] || tonightPool[0]
                if (!pick) return
                void trackEvent('surprise_me_clicked', { userId: authUser?.id, properties: { city: randomCity } })
                setPreviewPlan(pick)
                setOverlay('plan-preview')
              }}
              onOpenTonightPlan={openPlanPreview}
              onOpenBusinesses={() => openBusinesses('homepage_footer')}
              onBusinessCtaViewed={() => trackBusinessCtaViewed('homepage_footer')}
            />
          ) : null}

          {tab === 'explore' ? (
            <ExplorePage
              lang={lang}
              tx={tx}
              font={font}
              locations={locations}
              filteredLocations={filteredLocations}
              curatedSections={curatedExploreSections}
              loading={loading}
              exploreMode={exploreMode}
              setExploreMode={setExploreMode}
              exploreExpanded={exploreExpanded}
              setExploreExpanded={setExploreExpanded}
              browseSearch={browseSearch}
              setBrowseSearch={setBrowseSearch}
              browseFilters={browseFilters}
              setBrowseFilters={setBrowseFilters}
              onOpenDetail={openDetail}
              onOpenBusinesses={() => openBusinesses('browse_banner')}
              onBusinessCtaViewed={() => trackBusinessCtaViewed('browse_banner')}
              savedPlaceIds={savedPlaceIds}
              onToggleSavePlace={handleToggleSavePlace}
              bottomOffset={NAV_HEIGHT + 16}
            />
          ) : null}

          {tab === 'saved' ? (
            <div className="hm-tab-fade">
            <SavedPage
              lang={lang}
              tx={tx}
              authUser={authUser}
              plans={savedPlans}
              places={savedPlaces}
              reminderIds={planReminderIds}
              feedbackByItem={dateFeedback}
              onRemovePlan={handleRemovePlan}
              onRemovePlace={(placeId) => setSavedPlaceIds((prev) => prev.filter((id) => id !== placeId))}
              onTogglePlanReminder={handleTogglePlanReminder}
              onSubmitFeedback={handleSubmitFeedback}
              onOpenPlace={openDetail}
              onOpenPlan={plan => { setPreviewPlan(plan); setOverlay('plan-preview') }}
              onGoHome={() => selectTab('home')}
            />
            </div>
          ) : null}

          {tab === 'profile' ? (
            <div className="hm-tab-fade">
            <ProfilePage
              lang={lang}
              tx={tx}
              authUser={authUser}
              savedCount={savedCount}
              savedPlansCount={savedPlans.length}
              savedPlacesCount={savedPlaces.length}
              onOpenSaved={() => selectTab('saved')}
              onToggleLang={() => setLang((current) => (current === 'en' ? 'he' : 'en'))}
              onOpenQuiz={openQuiz}
              onOpenSuggest={() => setOverlay('suggest')}
              onOpenAdmin={() => setOverlay('admin')}
              onOpenFeedback={() => {
                void trackEvent('report_issue_clicked', { userId: authUser?.id })
                setShowFeedbackModal(true)
              }}
              onOpenPrivacy={() => { window.history.pushState({}, '', '/privacy'); setOverlay('privacy') }}
              onOpenTerms={() => { window.history.pushState({}, '', '/terms'); setOverlay('terms') }}
              onOpenDeleteAccount={() => { window.history.pushState({}, '', '/delete-account'); setOverlay('delete-account') }}
              onOpenBusinesses={() => openBusinesses('profile')}
              analyticsEnabled={analyticsEnabled}
              onSignOut={async () => {
                const { error } = await supabase.auth.signOut({ scope: 'local' })
                if (error) alert(lang === 'he' ? 'ההתנתקות נכשלה. נסו שוב.' : 'Could not sign out. Please try again.')
              }}
              onDeleteAccount={async () => {
                const confirmed = window.confirm(
                  lang === 'he'
                    ? 'האם אתם בטוחים? פעולה זו תמחק את החשבון ואת כל הנתונים שלכם לצמיתות.'
                    : 'Are you sure? This will permanently delete your account and all your data.'
                )
                if (!confirmed) return
                try {
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session) return
                  const { error } = await supabase.functions.invoke('delete-account', { body: {} })
                  if (!error) {
                    await supabase.auth.signOut()
                    localStorage.clear()
                    window.location.reload()
                  } else throw new Error('Account deletion failed')
                } catch {
                  alert(lang === 'he' ? 'שגיאה במחיקת החשבון. נסו שוב.' : 'Error deleting account. Please try again.')
                }
              }}
              onToggleAnalytics={() => {
                if (analyticsEnabled) {
                  revokeAnalyticsConsent()
                  setAnalyticsEnabled(false)
                } else {
                  grantAnalyticsConsent()
                  setAnalyticsEnabled(true)
                  setShowConsentBanner(false)
                }
              }}
            />
            </div>
          ) : null}
        </main>
      </div>

      <BottomNav tx={tx} tab={tab} savedCount={savedCount} onSelect={selectTab} />

      {showConsentBanner ? (
        <ConsentBanner
          lang={lang}
          font={font}
          onAccept={() => {
            grantAnalyticsConsent()
            setAnalyticsEnabled(true)
            setShowConsentBanner(false)
          }}
          onDecline={() => { revokeAnalyticsConsent(); setAnalyticsEnabled(false); setShowConsentBanner(false) }}
          onOpenPrivacy={() => { window.history.pushState({}, '', '/privacy'); setOverlay('privacy') }}
        />
      ) : showFeedbackModal ? (
        <FeedbackModal lang={lang} font={font} onClose={() => setShowFeedbackModal(false)} />
      ) : feedbackNudgePlanId && !showConsentBanner ? (
        <FeedbackNudge
          lang={lang}
          font={font}
          plan={datePlans.find((p) => p.id === feedbackNudgePlanId)}
          onRespond={(feedback) => {
            const key = `plan:${feedbackNudgePlanId}`
            setDateFeedback((prev) => ({ ...prev, [key]: { ...feedback, ts: Date.now() } }))
            setFeedbackNudgePlanId(null)
          }}
          onDismiss={() => setFeedbackNudgePlanId(null)}
        />
      ) : null}
    </div>
  )
}

function AppHeader({ lang, onToggleLang }) {
  return <header className="ui-app-header"><div><a className="ui-wordmark" href="/" aria-label="HaMakom home"><img src="/logo-icon.svg" alt="" />HaMakom<span>המקום</span></a><button className="ui-language" onClick={onToggleLang}>{lang === 'en' ? 'עברית' : 'English'}</button></div></header>
}

function HomePage({ lang, tonightPlan, loading, error, onStartQuiz, onSurpriseMe, onOpenTonightPlan, onOpenBusinesses, onBusinessCtaViewed }) {
  const he = lang === 'he'
  const businessViewed = useRef(false)
  useEffect(() => { if (!businessViewed.current) { businessViewed.current = true; onBusinessCtaViewed?.() } }, [onBusinessCtaViewed])
  return <div className="ui-home">
    <section className="ui-home-hero">
      <div className="ui-home-copy"><p className="ui-eyebrow">{he ? 'מקום טוב להתחיל' : 'Good places. Better company.'}</p><h1>{he ? <>פחות לתכנן.<br /><span>יותר להיות יחד.</span></> : <>Less planning.<br /><span>More connection.</span></>}</h1><p className="ui-home-intro">{he ? 'מצאו מקום שמתאים לשניכם. אנחנו נדאג לרעיונות, אתם תביאו את השיחה.' : 'Find somewhere that feels right for both of you. We’ll bring the ideas. You bring the conversation.'}</p><button className="ui-button ui-button-primary ui-home-cta" onClick={onStartQuiz}>{he ? 'בואו נמצא את הדייט שלכם' : 'Find your date'}<Icon name="arrow" className="ui-direction" size={18} /></button><p className="ui-footnote">{he ? 'שתי בחירות. בלי צורך בחשבון.' : 'Two choices. No account needed.'}</p></div>
      <div className="ui-home-photo"><img src="/city-images/jerusalem.jpg" alt={he ? 'ירושלים' : 'Jerusalem'} fetchPriority="high" /><div><Icon name="pin" size={16} />{he ? 'ירושלים, ישראל' : 'Jerusalem, Israel'}</div></div>
    </section>
    <section className="ui-home-discover"><div className="ui-section-heading"><h2>{he ? 'קצת השראה' : 'A little inspiration'}</h2><button className="ui-text-button" onClick={onSurpriseMe}><Icon name="sparkle" size={17} />{he ? 'הפתיעו אותי' : 'Surprise me'}</button></div><TonightPlanCard lang={lang} plan={tonightPlan} onOpenPlan={onOpenTonightPlan} /></section>
    <section className="ui-home-benefits">{[
      ['map', he ? 'קרוב ונוח' : 'Close. Considered.', he ? 'מקום אחד או מסלול קצר שמתאים לקצב שלכם.' : 'One good place or a short route, at your pace.'],
      ['menu', he ? 'אוכל שמתאים לכם' : 'Your kind of place.', he ? 'תפריטים וצרכים תזונתיים כשיש מקור מידע.' : 'Menu links and food preferences, where sourced.'],
      ['share', he ? 'מוכנים לשיתוף' : 'Ready for two.', he ? 'שמרו רעיון ושלחו אותו בקישור אחד.' : 'Save an idea. Send the whole plan in one link.'],
    ].map(([icon,title,body]) => <div key={icon}><Icon name={icon} size={24} /><h3>{title}</h3><p>{body}</p></div>)}</section>
    {error && <p className="ui-plan-note" role="status">{he ? 'מוצג הקטלוג השמור. לא ניתן לרענן כרגע; בדקו פרטים עם המקום.' : 'Showing the saved catalog. We couldn’t refresh just now; confirm details with the venue.'}</p>}
    {loading && <p className="ui-footnote" role="status">{he ? 'מרעננים מקומות…' : 'Refreshing places…'}</p>}
    <footer className="ui-home-footer"><span>HaMakom · {he ? 'מקום לשניכם' : 'Somewhere for two'}</span><button className="ui-text-button" onClick={onOpenBusinesses}>{he ? 'לבעלי מקומות' : 'For venues'}<Icon name="arrow" size={16} className="ui-direction" /></button></footer>
  </div>
}

function ExplorePage({ lang, tx, font, locations, filteredLocations, loading, exploreMode, setExploreMode, browseSearch, setBrowseSearch, browseFilters, setBrowseFilters, onOpenDetail, onOpenBusinesses, onBusinessCtaViewed, savedPlaceIds, onToggleSavePlace, bottomOffset }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const he = lang === 'he'
  return <div className="ui-explore">
    <div className="ui-section-heading ui-page-heading"><div><h1>{he ? 'מקומות' : 'Explore'}</h1><p className="ui-subtitle">{he ? 'המקום הנכון, בדרך שלכם.' : 'Find your kind of somewhere.'}</p></div><div className="ui-segmented"><button aria-pressed={exploreMode === 'list'} onClick={() => setExploreMode('list')}>{he ? 'רשימה' : 'List'}</button><button aria-pressed={exploreMode === 'map'} onClick={() => setExploreMode('map')}>{he ? 'מפה' : 'Map'}</button></div></div>
    <div className="ui-search"><Icon name="search" /><input value={browseSearch} onChange={e => setBrowseSearch(e.target.value)} placeholder={he ? 'חפשו מקום או עיר' : 'Search places or cities'} aria-label={he ? 'חיפוש מקומות' : 'Search places'} />{browseSearch && <button className="ui-icon-button" aria-label={he ? 'ניקוי החיפוש' : 'Clear search'} onClick={() => setBrowseSearch('')}><Icon name="close" size={16} /></button>}</div>
    <div className="ui-explore-filters"><FilterBar tx={tx} locations={locations} filters={browseFilters} setFilters={setBrowseFilters} /><button className="ui-button ui-button-subtle" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog"><Icon name="tune" size={18} />{he ? 'סינון' : 'Filters'}</button></div>
    <p className="ui-footnote" aria-live="polite">{filteredLocations.length} {he ? 'מקומות' : 'places'}</p>
    <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={he ? 'המקומות שלכם' : 'Find your fit'} lang={lang}><VenuePreferences lang={lang} value={browseFilters} onChange={setBrowseFilters} /><div className="ui-sheet-actions"><button className="ui-button ui-button-primary" onClick={() => setFiltersOpen(false)}>{he ? `הצגת ${filteredLocations.length} מקומות` : `Show ${filteredLocations.length} places`}</button><button className="ui-text-button" onClick={() => setBrowseFilters({ ...INITIAL_FILTERS })}>{he ? 'איפוס' : 'Reset filters'}</button></div></Sheet>
    {exploreMode === 'map' ? <div className="ui-explore-map"><Suspense fallback={<div className="ui-map-loading">{tx.loading}</div>}><MapView locations={filteredLocations} lang={lang} tx={tx} font={font} onOpenDetail={onOpenDetail} showHeader={false} embedded bottomOffset={bottomOffset} /></Suspense></div> : <div className="ui-explore-scroll">{loading && !locations.length ? <SkeletonCardGrid count={6} label={tx.loading} /> : filteredLocations.length ? <div className="ui-place-grid">{filteredLocations.map(location => <Card key={location.id} loc={location} lang={lang} tx={tx} saved={savedPlaceIds.includes(location.id)} onToggleSave={() => onToggleSavePlace(location, { returnOverlay: null })} onClick={() => onOpenDetail(location)} />)}</div> : <EmptyState icon="⌕" title={he ? 'אין עדיין התאמה' : 'No matches just yet'} text={he ? 'נסו עיר אחרת או התאימו את המסננים.' : 'Try another city or loosen a filter.'} actionLabel={he ? 'איפוס החיפוש' : 'Reset search'} onAction={() => { setBrowseSearch(''); setBrowseFilters({ ...INITIAL_FILTERS }) }} />}<BusinessCta lang={lang} source="browse_banner" onView={onBusinessCtaViewed} onOpen={onOpenBusinesses} /></div>}
  </div>
}

function BusinessCta({ lang, source, onView, onOpen }) {
  const viewed = useRef(false)
  useEffect(() => {
    if (viewed.current) return
    viewed.current = true
    onView?.(source)
  }, [onView, source])

  const isHe = lang === 'he'
  return (
    <aside
      style={{
        marginTop: 4,
        background: 'linear-gradient(135deg, #241E16, #403523)',
        color: 'var(--ui-bg)',
        borderRadius: 18,
        padding: '18px 20px',
        border: '1px solid #5B4C31',
        boxShadow: '0 14px 32px -24px rgba(36,30,22,0.9)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4e7ff', marginBottom: 7 }}>
        {isHe ? 'לבעלי מקומות' : 'For venue owners'}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, lineHeight: 1.2, marginBottom: 7 }}>
        {isHe ? 'יש לכם מקום שמתאים לדייטים?' : 'Own a date-friendly venue?'}
      </div>
      <p style={{ margin: '0 0 14px', color: '#D7CDBB', fontSize: 13.5, lineHeight: 1.55 }}>
        {isHe
          ? 'הציגו את העסק מול זוגות דתיים שבוחרים עכשיו לאן לצאת, וקבלו נתוני ביצועים אמיתיים.'
          : 'Reach religious couples actively deciding where to go, with clear reporting on views, directions, and reservations.'}
      </p>
      <button
        type="button"
        onClick={onOpen}
        style={{
          border: 'none', borderRadius: 9, padding: '10px 14px', background: 'var(--ui-accent)', color: 'var(--ui-text)',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer',
        }}
      >
        {isHe ? 'הצטרפו כפיילוט מייסד ←' : 'Join the founding pilot →'}
      </button>
    </aside>
  )
}

function TonightPlanCard({ lang, plan, onOpenPlan }) {
  if (!plan) return null
  const he = lang === 'he'
  return <button className="ui-inspiration" onClick={() => onOpenPlan(plan)}><div className="ui-inspiration-icon"><Icon name="pin" size={26} /></div><div><p className="ui-eyebrow">{he ? plan.city_he || plan.city : plan.city}</p><h3>{plan.stops.map(s => he ? s.name_he || s.name_en : s.name_en).join(' + ')}</h3><p>{he ? plan.duration_text_he : plan.duration_text_en}</p></div><Icon name="arrow" className="ui-direction" /></button>
}

function SavedPage({ lang, tx, plans, places, reminderIds, feedbackByItem, onRemovePlan, onRemovePlace, onTogglePlanReminder, onSubmitFeedback, onOpenPlace, onOpenPlan, onGoHome }) {
  if (!plans.length && !places.length) {
    return <div className="ui-saved-empty"><div className="ui-empty-symbol"><Icon name="bookmark" size={38} /></div><h1>{lang === 'he' ? 'רעיונות ששווה לשמור' : 'Good ideas, kept close.'}</h1><p>{lang === 'he' ? 'שמרו מקומות ודייטים שתרצו לחזור אליהם. בלי צורך בחשבון.' : 'Save places and dates you’d like to come back to. No account needed.'}</p><button className="ui-button ui-button-primary" onClick={onGoHome}>{lang === 'he' ? 'מצאו את הדייט שלכם' : 'Find your date'}</button></div>
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header className="ui-page-heading"><h1>{lang === 'he' ? 'שמורים' : 'Saved'}</h1><p className="ui-subtitle">{lang === 'he' ? 'המקומות והדייטים שתרצו לחזור אליהם.' : 'Places and dates to come back to.'}</p></header>
      <SavedSection title={tx.savedPlansSectionTitle}>
        {plans.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {plans.map((plan) => (
              <SavedPlanCard
                key={plan.id}
                lang={lang}
                tx={tx}
                plan={plan}
                reminderSet={reminderIds.includes(plan.id)}
                feedback={feedbackByItem[`plan:${plan.id}`]}
                onToggleReminder={() => onTogglePlanReminder(plan.id)}
                onSubmitFeedback={(feedback) => onSubmitFeedback(`plan:${plan.id}`, feedback)}
                onRemove={() => onRemovePlan(plan.id)}
                onOpen={() => onOpenPlan(plan)}
              />
            ))}
          </div>
        ) : (
          <SavedSectionEmpty text={tx.savedPlansEmptyText} />
        )}
      </SavedSection>

      <SavedSection title={tx.savedPlacesSectionTitle}>
        {places.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {places.map((place) => (
              <Card
                key={place.id}
                loc={place}
                lang={lang}
                tx={tx}
                saved
                onToggleSave={() => onRemovePlace(place.id)}
                onClick={() => onOpenPlace(place)}
              />
            ))}
          </div>
        ) : (
          <SavedSectionEmpty text={tx.savedPlacesEmptyText} />
        )}
      </SavedSection>
    </div>
  )
}

function SavedSignInCard({ lang, onGoHome }) {
  const isHe = lang === 'he'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmail, setShowEmail] = useState(false)

  const handleGoogle = async () => {
    if (!supabase) return
    setError('')
    try {
      if (isNativeApp()) {
        await signInWithGoogleNative(supabase)
        return
      }
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getAuthRedirectUrl() },
      })
      if (err) setError(err.message)
    } catch {
      setError(isHe ? 'שגיאה בהתחברות' : 'Sign-in failed')
    }
  }

  const handleEmailSend = async () => {
    if (!email.trim() || !supabase) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: getAuthRedirectUrl() },
      })
      if (err) setError(err.message)
      else setSent(true)
    } catch {
      setError(isHe ? 'שגיאה בשליחה' : 'Failed to send')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section
        style={{
          background: APP_PANEL,
          border: `1px solid ${APP_BORDER}`,
          borderRadius: 16,
          padding: 24,
          display: 'grid',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: APP_ACCENT, marginBottom: 10 }}>
            {isHe ? 'שמור מקומות ותוכניות' : 'Save plans & places'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 10 }}>
            {isHe ? 'הדייטים שלכם, בכל מכשיר' : 'Your dates, on every device'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ui-muted)', lineHeight: 1.65 }}>
            {isHe
              ? 'כשתמצאו תוכנית שמרגישה נכונה, תוכלו לשמור אותה ולחזור אליה מכל מכשיר.'
              : 'When you find a plan that feels right, save it and come back to it from any device.'}
          </div>
        </div>

        {sent ? (
          <div style={{ background: '#0F1F10', border: '1px solid #2D5A30', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: '#86EFAC', lineHeight: 1.55 }}>
            {isHe ? `שלחנו קישור לכניסה אל ${email}. בדקו את תיבת הדואר.` : `We sent a sign-in link to ${email}. Check your inbox.`}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <button
              onClick={handleGoogle}
              style={{
                ...secondaryButtonStyle,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              {isHe ? 'כניסה עם Google' : 'Continue with Google'}
            </button>

            {!showEmail ? (
              <button onClick={() => setShowEmail(true)} style={textLinkButtonStyle}>
                {isHe ? 'כניסה עם אימייל' : 'Sign in with email instead'}
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailSend()}
                  aria-label={isHe ? 'כתובת אימייל' : 'Email address'} placeholder={isHe ? 'האימייל שלכם' : 'Your email'}
                  style={{
                    width: '100%',
                    background: APP_BG,
                    border: `1px solid ${APP_BORDER}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: APP_TEXT,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: isHe ? 'right' : 'left',
                  }}
                />
                <button
                  onClick={handleEmailSend}
                  disabled={!email.trim() || loading}
                  style={{ ...primaryButtonStyle, width: '100%', opacity: !email.trim() || loading ? 0.55 : 1 }}
                >
                  {loading ? (isHe ? 'שולח...' : 'Sending…') : (isHe ? 'שלחו קישור כניסה' : 'Send sign-in link')}
                </button>
              </div>
            )}

            {error ? (
              <div style={{ fontSize: 13, color: '#F87171' }}>{error}</div>
            ) : null}
          </div>
        )}
      </section>

      <button onClick={onGoHome} style={textLinkButtonStyle}>
        {isHe ? 'המשיכו בלי כניסה' : 'Continue without signing in'}
      </button>
    </div>
  )
}

function SavedSection({ title, children }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.14em', color: APP_MUTED, textTransform: 'uppercase' }}>{title}</div>
      {children}
    </section>
  )
}

function SavedSectionEmpty({ text }) {
  return (
    <div style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 16, padding: 16, color: 'var(--ui-muted)', fontSize: 14, lineHeight: 1.5 }}>
      {text}
    </div>
  )
}

function SavedPlanCard({ lang, tx, plan, reminderSet, feedback, onToggleReminder, onSubmitFeedback, onRemove, onOpen }) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [rating, setRating] = useState(feedback?.rating || 0)
  const [again, setAgain] = useState(feedback?.again ?? null)
  const he = lang === 'he'
  return <section className="ui-saved-plan"><button className="ui-saved-plan-open" onClick={onOpen}><div className="ui-inspiration-icon"><Icon name="bookmark" size={23} /></div><div><p className="ui-eyebrow">{he ? plan.city_he || plan.city : plan.city}</p><h3>{plan.stops?.map(s => he ? s.name_he || s.name_en : s.name_en).join(' + ') || (he ? plan.title_he : plan.title_en)}</h3><p className="ui-footnote">{he ? plan.duration_text_he : plan.duration_text_en}</p></div><Icon name="chevron" size={18} className="ui-direction" /></button><details className="ui-saved-options"><summary>{he ? 'אפשרויות' : 'Options'}</summary><div className="ui-saved-options-content"><button className="ui-text-button" onClick={() => shareContent(sharePlanMessage(plan, lang))}><Icon name="share" size={17} />{tx.shareSavedPlan}</button><button className="ui-text-button" onClick={onToggleReminder}>{reminderSet ? (he ? 'ביטול בדיקה בביקור הבא' : 'Remove next-visit check-in') : (he ? 'בדיקה בביקור הבא באתר' : 'Check in on my next visit')}</button><p className="ui-footnote">{he ? 'מופיע בביקור הבא באתר, לא כהתראה בטלפון.' : 'Appears when you return here, not as a phone notification.'}</p>{feedback ? <p className="ui-footnote">{he ? 'המשוב שלכם נשמר' : 'Your feedback is saved'}{feedback.rating ? ` · ${feedback.rating}/5` : ''}</p> : <button className="ui-text-button" onClick={() => setShowFeedback(!showFeedback)}>{he ? 'איך היה הדייט?' : 'How did it go?'}</button>}{showFeedback && <FeedbackComposer lang={lang} rating={rating} again={again} onSetWent={went => { if (!went) { onSubmitFeedback({ went:false }); setShowFeedback(false) } }} onSetRating={setRating} onSetAgain={setAgain} onSubmit={() => { onSubmitFeedback({ went:true,rating,again }); setShowFeedback(false) }} />}<button className="ui-text-button ui-destructive" onClick={onRemove}>{tx.removeSavedPlan}</button></div></details></section>
}

function FeedbackComposer({ lang, rating, again, onSetWent, onSetRating, onSetAgain, onSubmit }) {
  const isHe = lang === 'he'
  return (
    <div style={{ background: '#f5f5f7', border: '1px solid #e5e5e9', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--ui-text)', fontWeight: 600 }}>{isHe ? 'עזרו לנו לדייק את ההמלצה הבאה' : 'Help us sharpen the next recommendation'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onSetWent(true)} style={compactButtonStyle}>{isHe ? 'כן, הלכנו' : 'Yes, we went'}</button>
        <button onClick={() => onSetWent(false)} style={compactButtonStyle}>{isHe ? 'לא בסוף' : 'Not in the end'}</button>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--ui-muted)', marginBottom: 6 }}>{isHe ? 'איך היה?' : 'How was it?'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} onClick={() => onSetRating(value)} style={rating === value ? primaryCompactButtonStyle : compactButtonStyle}>
              {value}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--ui-muted)', marginBottom: 6 }}>{isHe ? 'הייתם בוחרים משהו כזה שוב?' : 'Would you do something like this again?'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onSetAgain(true)} style={again === true ? primaryCompactButtonStyle : compactButtonStyle}>{isHe ? 'כן' : 'Yes'}</button>
          <button onClick={() => onSetAgain(false)} style={again === false ? primaryCompactButtonStyle : compactButtonStyle}>{isHe ? 'לא' : 'No'}</button>
        </div>
      </div>
      <button onClick={onSubmit} disabled={!rating || again === null} style={{ ...primaryButtonStyle, opacity: !rating || again === null ? 0.55 : 1, cursor: !rating || again === null ? 'not-allowed' : 'pointer' }}>
        {isHe ? 'שמרו פידבק' : 'Save Feedback'}
      </button>
    </div>
  )
}

function ProfilePage({ lang, tx, authUser, savedCount, savedPlansCount, savedPlacesCount, onOpenSaved, onToggleLang, onOpenQuiz, onOpenSuggest, onOpenAdmin, onOpenPrivacy, onOpenTerms, onOpenDeleteAccount, onOpenBusinesses, analyticsEnabled, onToggleAnalytics, onDeleteAccount, onSignOut, onOpenFeedback }) {
  const [signInOpen, setSignInOpen] = useState(false)
  const isHe = lang === 'he'
  const name = authUser?.email?.split('@')[0] || (isHe ? 'ברוכים הבאים' : 'Make yourself at home')
  return <div className="ui-profile"><div className="ui-page-heading"><h1>{isHe ? 'החשבון שלכם' : 'Your space'}</h1><p className="ui-subtitle">{isHe ? 'העדפות, שמורים וכל השאר.' : 'Your preferences. Your possibilities.'}</p></div><section className="ui-account-card"><div className="ui-account-avatar"><Icon name="profile" size={28} /></div><div><h2>{name}</h2><p>{authUser?.email || (isHe ? 'התחברו כדי לסנכרן שמורים בין מכשירים.' : 'Sign in to keep your saves across devices.')}</p>{!authUser && <button className="ui-text-button" onClick={() => setSignInOpen(true)}>{isHe ? 'כניסה לחשבון' : 'Sign in'}<Icon name="chevron" size={15} className="ui-direction" /></button>}</div></section>
    <section className="ui-settings-group"><ProfileMenuRow title={isHe ? `השמורים שלכם (${savedCount})` : `Your saves (${savedCount})`} subtitle={isHe ? `${savedPlansCount} דייטים · ${savedPlacesCount} מקומות` : `${savedPlansCount} dates · ${savedPlacesCount} places`} onClick={onOpenSaved} isHe={isHe} /><ProfileMenuRow title={isHe ? 'תכנון דייט חדש' : 'Plan a new date'} onClick={onOpenQuiz} isHe={isHe} borderTop /><ProfileMenuRow title={tx.profileActionLanguage} subtitle={isHe ? 'עברית' : 'English'} onClick={onToggleLang} isHe={isHe} borderTop /><ProfileToggleRow title={isHe ? 'נתוני שימוש' : 'Usage analytics'} subtitle={isHe ? 'שיתוף נתוני שימוש כדי לעזור לנו להשתפר.' : 'Share usage data to help improve HaMakom.'} enabled={analyticsEnabled} onToggle={onToggleAnalytics} /></section>
    <h2 className="ui-settings-label">{isHe ? 'עזרה ומידע' : 'Help & information'}</h2><section className="ui-settings-group">{[
      [isHe ? 'הצעת מקום' : 'Suggest a place',onOpenSuggest], [isHe ? 'משוב ודיווח על בעיה' : 'Feedback & support',onOpenFeedback], [tx.forBusinesses,onOpenBusinesses], [isHe ? 'מדיניות פרטיות' : 'Privacy policy',onOpenPrivacy], [isHe ? 'תנאי שימוש' : 'Terms of service',onOpenTerms],
    ].map(([title,action],i) => <ProfileMenuRow key={title} title={title} onClick={action} isHe={isHe} borderTop={i>0} compact />)}{isAdminUser(authUser) && <ProfileMenuRow title={tx.profileActionAdmin} onClick={onOpenAdmin} isHe={isHe} borderTop />}</section>
    {authUser ? <div className="ui-account-actions"><button className="ui-text-button" onClick={onSignOut}>{isHe ? 'התנתקות' : 'Sign out'}</button><details className="ui-more-options"><summary>{isHe ? 'מחיקת חשבון' : 'Delete account'}</summary><p className="ui-footnote">{isHe ? 'המחיקה קבועה ומסירה את השמורים ואת נתוני החשבון.' : 'Permanently removes your account and its saved data.'}</p><button className="ui-text-button ui-destructive" onClick={onDeleteAccount}>{isHe ? 'מחיקת החשבון והנתונים' : 'Delete account and data'}</button></details></div> : <button className="ui-text-button" onClick={onOpenDeleteAccount}>{isHe ? 'על מחיקת נתונים' : 'About deleting your data'}</button>}
    <p className="ui-profile-footer">HaMakom · {isHe ? 'מקום לשניכם' : 'Somewhere for two'}</p><Sheet open={signInOpen} onClose={() => setSignInOpen(false)} title={isHe ? 'ברוכים הבאים' : 'Welcome to HaMakom'} lang={lang}><SavedSignInCard lang={lang} onGoHome={() => setSignInOpen(false)} /></Sheet>
  </div>
}

function ProfileMenuRow({ title, subtitle, onClick, isHe, featured = false, compact = false, borderTop = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={featured ? 'hm-lift' : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: isHe ? 'right' : 'left',
        background: featured ? APP_INK : APP_PANEL,
        color: featured ? '#ffffff' : APP_TEXT,
        border: featured ? 'none' : 'none',
        borderTop: borderTop ? `1px solid ${APP_BORDER}` : 'none',
        borderRadius: featured ? 18 : 0,
        padding: compact ? '13px 16px' : '15px 16px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: featured ? '0 14px 26px -14px rgba(36,30,22,0.55)' : 'none',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 14 : 15, fontWeight: 700, lineHeight: 1.25 }}>{title}</div>
        {subtitle ? (
          <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.4, color: featured ? '#D8C89A' : APP_MUTED }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <span style={{ fontSize: 15, color: featured ? '#d4e7ff' : APP_ACCENT, flexShrink: 0, fontWeight: 700 }}>
        {isHe ? '←' : '→'}
      </span>
    </button>
  )
}

function ProfileToggleRow({ title, subtitle, enabled, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 16px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: APP_TEXT }}>{title}</div>
        <div style={{ fontSize: 12.5, color: APP_MUTED, marginTop: 3, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: 46,
          height: 26,
          borderRadius: 13,
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          background: enabled ? APP_ACCENT : 'var(--ui-border)',
          position: 'relative',
          transition: 'background 0.2s',
        }}
        role="switch"
        aria-checked={enabled}
        aria-label={title}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'inset-inline-start 0.2s',
            insetInlineStart: enabled ? 23 : 3,
          }}
        />
      </button>
    </div>
  )
}

function MiniPill({ children }) {
  return (
    <span style={{ background: 'var(--ui-surface)', border: '1px solid #EBE2D0', borderRadius: 999, padding: '5px 10px', fontSize: 12, color: 'var(--ui-accent)' }}>
      {children}
    </span>
  )
}

function BottomNav({ tx, tab, savedCount, onSelect }) {
  const gap = useViewportBottomGap()
  const items = [['home', 'home', tx.home], ['explore', 'search', tx.dir === 'rtl' ? 'מקומות' : 'Browse'], ['saved', 'bookmark', tx.saved], ['profile', 'profile', tx.profile]]
  return <nav className="ui-tabbar" aria-label={tx.dir === 'rtl' ? 'ניווט ראשי' : 'Main navigation'} style={{ bottom: `calc(12px + var(--hm-sab, 0px) + ${gap}px)` }}>{items.map(([key,icon,label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => onSelect(key)}><Icon name={icon} size={22} /><span>{label}</span>{key === 'saved' && savedCount > 0 && <span className="ui-nav-dot" aria-label={`${savedCount} ${label}`} />}</button>)}</nav>
}

function EmptyState({ icon, title, text, actionLabel, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: APP_MUTED, background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 16 }}>
      <div style={{ fontSize: 34, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ color: APP_TEXT, margin: '0 0 8px', fontSize: 20 }}>{title}</h3>
      <p style={{ margin: '0 auto', maxWidth: 360, fontStyle: 'italic' }}>{text}</p>
      {actionLabel ? (
        <button onClick={onAction} style={{ ...primaryButtonStyle, width: 'auto', marginTop: 18, paddingInline: 20 }}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

const primaryButtonStyle = {
  background: APP_INK,
  color: '#ffffff',
  border: 'none',
  borderRadius: 16,
  padding: '16px 18px',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 700,
  fontFamily: 'inherit',
  boxShadow: '0 14px 26px -14px rgba(36,30,22,0.55)',
}

const secondaryButtonStyle = {
  background: APP_PANEL,
  color: 'var(--ui-text)',
  border: `1px solid #E6DCC8`,
  borderRadius: 16,
  padding: '14px 16px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const compactButtonStyle = {
  background: APP_PANEL,
  color: 'var(--ui-text)',
  border: `1px solid #E6DCC8`,
  borderRadius: 10,
  padding: '9px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const primaryCompactButtonStyle = {
  background: APP_INK,
  color: '#ffffff',
  border: 'none',
  borderRadius: 10,
  padding: '9px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
}


const textLinkButtonStyle = {
  background: 'transparent',
  color: APP_MUTED,
  border: 'none',
  borderRadius: 0,
  padding: '10px 4px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(107,114,128,0.4)',
  textUnderlineOffset: 3,
}

function ConsentBanner({ lang, font, onAccept, onDecline, onOpenPrivacy }) {
  const isHe = lang === 'he'
  return (
    <div
      dir={isHe ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        bottom: `calc(${NAV_HEIGHT + 8}px + max(12px, var(--hm-sab, 0px)))`,
        left: 16,
        right: 16,
        maxWidth: 480,
        marginInline: 'auto',
        background: 'var(--ui-surface)',
        border: '1px solid #EBE2D0',
        borderRadius: 16,
        padding: '14px 16px',
        zIndex: 9000,
        fontFamily: font,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: APP_SOFT, lineHeight: 1.55 }}>
        {isHe
          ? 'אנחנו משתמשים בנתוני שימוש אנונימיים לשיפור ההמלצות.'
          : 'We use anonymous usage data to improve recommendations.'}
        {' '}
        <button onClick={onOpenPrivacy} style={{ background: 'none', border: 'none', color: 'var(--ui-accent)', cursor: 'pointer', fontSize: 13, fontFamily: font, padding: 0, textDecoration: 'underline' }}>
          {isHe ? 'מדיניות פרטיות' : 'Privacy Policy'}
        </button>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onAccept}
          style={{ flex: 1, background: 'var(--ui-text)', color: '#ffffff', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}
        >
          {isHe ? 'אישור' : 'Accept'}
        </button>
        <button
          onClick={onDecline}
          style={{ flex: 1, background: '#F2EBDB', color: 'var(--ui-muted)', border: '1px solid #E6DCC8', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
        >
          {isHe ? 'דחייה' : 'Decline'}
        </button>
      </div>
    </div>
  )
}

function FeedbackNudge({ lang, font, plan, onRespond, onDismiss }) {
  const isHe = lang === 'he'
  const [step, setStep] = useState('ask')
  const [rating, setRating] = useState(null)
  const planTitle = plan ? (isHe ? plan.title_he : plan.title_en) : ''

  if (!plan) return null

  return (
    <div
      dir={isHe ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', left: 16, right: 16, maxWidth: 480, marginInline: 'auto',
        bottom: `calc(${NAV_HEIGHT + 8}px + max(12px, var(--hm-sab, 0px)))`,
        background: 'var(--ui-surface)', border: '1px solid #EBE2D0', borderRadius: 16,
        padding: '16px', zIndex: 8500, fontFamily: font,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}
    >
      {step === 'ask' ? (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: APP_SOFT, lineHeight: 1.5 }}>
            {isHe ? `הלכתם ל"${planTitle}"?` : `Did you go on "${planTitle}"? 🌟`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('rate')} style={{ flex: 1, background: 'var(--ui-text)', color: '#ffffff', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
              {isHe ? 'כן!' : 'Yes!'}
            </button>
            <button onClick={() => onRespond({ went: false })} style={{ flex: 1, background: '#F2EBDB', color: 'var(--ui-muted)', border: '1px solid #E6DCC8', borderRadius: 10, padding: '10px 0', fontSize: 13, cursor: 'pointer', fontFamily: font }}>
              {isHe ? 'לא עדיין' : 'Not yet'}
            </button>
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--ui-muted)', cursor: 'pointer', padding: '10px 6px', fontSize: 13, fontFamily: font }}>✕</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: APP_SOFT }}>
            {isHe ? 'כמה כיפי היה?' : 'How was it?'}
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)} style={{ background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', opacity: rating && star > rating ? 0.35 : 1, transition: 'opacity 0.15s' }}>
                {star <= (rating || 0) ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          <button
            onClick={() => rating && onRespond({ went: true, rating, again: rating >= 4 })}
            disabled={!rating}
            style={{ width: '100%', background: rating ? 'var(--ui-text)' : 'var(--ui-border)', color: rating ? '#ffffff' : 'var(--ui-muted)', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: rating ? 'pointer' : 'default', fontFamily: font, transition: 'all 0.2s' }}
          >
            {isHe ? 'שמרו' : 'Save'}
          </button>
        </>
      )}
    </div>
  )
}

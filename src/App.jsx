import { useEffect, useMemo, useState } from 'react'
import { t } from './lib/translations'
import { useLocations } from './hooks/useLocations'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useSyncSaves } from './hooks/useSyncSaves'
import { supabase } from './lib/supabase'
import { getAuthRedirectUrl } from './lib/authRedirect'
import { DATE_PLANS } from './data/datePlans'
import { QUIZ_CITIES } from './lib/constants'
import {
  createRecommendationImpression,
  grantAnalyticsConsent,
  hasAnalyticsConsent,
  revokeAnalyticsConsent,
  saveUserFeedback,
  trackEvent,
  upsertRecommendationOutcome,
} from './lib/analytics'
import { getRecommendedLocations } from './lib/locationRecommendations'
import { getSmartMatchedPlans, recordPlanImpression } from './lib/planRecommendations'
import {
  clearAnswersFromSession,
  clearPendingSaveFromSession,
  loadAnswersFromSession,
  loadPendingSaveFromSession,
  saveAnswersToSession,
  savePendingSaveToSession,
} from './lib/quiz'
import { lazy, Suspense } from 'react'
import Card from './components/Card'
import DetailView from './components/DetailView'
import SuggestView from './components/SuggestView'
import FilterBar from './components/FilterBar'
import QuizStepper from './components/QuizStepper'
import ResultsGateModal from './components/ResultsGateModal'
import ResultsPage from './components/ResultsPage'
import PlanPreviewPage from './components/PlanPreviewPage'
import CustomPlanBuilder from './components/CustomPlanBuilder'
import PrivacyPage from './components/PrivacyPage'
import TermsPage from './components/TermsPage'
import FeedbackModal from './components/FeedbackModal'
const AdminView = lazy(() => import('./components/AdminView'))
const MapView = lazy(() => import('./components/MapView'))

const PRIMARY_TABS = ['home', 'explore', 'saved', 'profile']
// Cream "editorial" palette (matches the HaMakom redesign prototype).
const APP_BG = '#F7F2E8'      // app background
const APP_PANEL = '#FFFFFF'   // cards / surfaces
const APP_BORDER = '#EBE2D0'  // hairline borders
const APP_TEXT = '#241E16'    // primary ink
const APP_ACCENT = '#9A7A28'  // gold for eyebrows / links (readable on cream)
const APP_MUTED = '#8A7F6C'   // muted text
const APP_SOFT = '#6E6450'    // body copy
const APP_INK = '#241E16'     // dark pill / primary button background

// Per-glyph fallback covers both languages from one stack:
// Hanken Grotesk (Latin) + Heebo (Hebrew) for UI, Spectral (Latin) +
// Frank Ruhl Libre (Hebrew) for headlines.
const SERIF = "'Spectral','Frank Ruhl Libre',Georgia,serif"
const NAV_HEIGHT = 82
const INITIAL_FILTERS = {
  cityFilter: 'All Cities',
  categoryFilter: 'All',
  occasionFilter: 'All',
  priceFilter: 0,
  dateFilter: 'all',
}

function areFiltersDefault(filters) {
  return (
    filters.cityFilter === INITIAL_FILTERS.cityFilter &&
    filters.categoryFilter === INITIAL_FILTERS.categoryFilter &&
    filters.occasionFilter === INITIAL_FILTERS.occasionFilter &&
    filters.priceFilter === INITIAL_FILTERS.priceFilter &&
    filters.dateFilter === INITIAL_FILTERS.dateFilter
  )
}

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
  const [savedPlanIds, setSavedPlanIds] = useLocalStorage('hamakom-saved-plans', [])
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
  const [exploreExpanded, setExploreExpanded] = useState(false)
  const [currentRecommendationId, setCurrentRecommendationId] = useState(null)
  const [showConsentBanner, setShowConsentBanner] = useState(() => !hasAnalyticsConsent())
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => hasAnalyticsConsent())
  const [feedbackNudgePlanId, setFeedbackNudgePlanId] = useState(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  const tx = t[lang]
  const font = "'Hanken Grotesk','Heebo',system-ui,-apple-system,sans-serif"

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

  // Vibe-diverse match set: the user's chosen vibe is the primary plan, then
  // we surface the strongest plan for *other* vibes in the same city so the
  // results page can offer real "3 plans in this city" tabs (not three
  // near-identical plans of the same focus). Falls back to the plain top-N
  // when the vibe approach yields nothing (sparse cities still get a plan).
  const matchedPlans = useMemo(() => {
    if (!quizAnswers) return []
    const opts = { feedbackByItem: dateFeedback, savedPlaceIds, clickedLocationCounts }
    const primary = getSmartMatchedPlans(datePlans, locations, quizAnswers, 1, opts)[0]
    if (!primary) return getSmartMatchedPlans(datePlans, locations, quizAnswers, 2, opts)
    const FOCI = ['outdoors', 'food-drink', 'atmosphere', 'activity']
    const chosen = quizAnswers.focus
    const order = chosen ? FOCI.filter((f) => f !== chosen) : FOCI
    const seen = new Set([primary.id])
    const out = [primary]
    for (const focus of order) {
      if (out.length >= 3) break
      const candidates = getSmartMatchedPlans(datePlans, locations, { ...quizAnswers, focus }, 4, opts)
      const pick = candidates.find((p) => p.city === primary.city && !seen.has(p.id))
      if (pick) { seen.add(pick.id); out.push(pick) }
    }
    return out
  }, [clickedLocationCounts, dateFeedback, datePlans, locations, quizAnswers, savedPlaceIds])

  useEffect(() => {
    if (!quizAnswers || !matchedPlans.length) return
    matchedPlans.forEach((plan) => recordPlanImpression(plan.id))
  }, [matchedPlans, quizAnswers])

  const currentPlan = matchedPlans[resultIndex] || null
  const alternatePlan = matchedPlans.find((_, index) => index !== resultIndex) || null
  const tonightPlan = useMemo(() => getTonightPlan(datePlans), [datePlans])
  const savedPlans = useMemo(() => datePlans.filter((plan) => savedPlanIds.includes(plan.id)), [datePlans, savedPlanIds])
  const savedPlaces = useMemo(() => locations.filter((location) => savedPlaceIds.includes(location.id)), [locations, savedPlaceIds])
  const savedCount = savedPlans.length + savedPlaces.length
  const availablePlanCities = useMemo(() => {
    const planCities = new Set(datePlans.map((plan) => plan.city).filter(Boolean))
    const merged = [...QUIZ_CITIES, ...[...planCities].filter((c) => !QUIZ_CITIES.includes(c))]
    return merged
  }, [datePlans])
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
      const matchesSearch = !query || searchableFields.some((value) => (value || '').toLowerCase().includes(query))
      if (!matchesSearch) return false

      if (cityFilter !== 'All Cities' && location.city !== cityFilter) return false
      if (categoryFilter !== 'All' && location.category !== categoryFilter) return false
      if (occasionFilter !== 'All' && !location.occasion?.includes(occasionFilter)) return false
      if (priceFilter > 0 && location.price !== priceFilter) return false

      if (dateFilter !== 'all') {
        const stages = Array.isArray(location.date_stage) ? location.date_stage : [location.date_stage]
        if (!stages.includes(Number(dateFilter))) return false
      }

      return true
    })
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

  useEffect(() => {
    if (!supabase) return undefined

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
      if (!session?.user) return
      setAuthUser(session.user)
      commitPendingSave()
      restoreQuiz()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null
      setAuthUser(user)

      if (user && event === 'SIGNED_IN') {
        commitPendingSave()
        restoreQuiz()
        setOverlay((current) => (current === 'save-gate' ? saveGateItem?.returnOverlay ?? 'quiz-results' : current))
        setSaveGateItem(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [saveGateItem, setSavedPlaceIds, setSavedPlanIds])

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

    if (overlay === 'detail' && selectedLocation) {
      title = `${selectedLocation.name} · HaMakom`
      desc = selectedLocation.description || desc
    } else if ((overlay === 'quiz-results' || overlay === 'results') && currentPlan) {
      title = `${currentPlan.title_en} · HaMakom`
      desc = currentPlan.narrative_en?.slice(0, 140) || desc
    } else if (overlay === 'privacy') {
      title = 'Privacy Policy · HaMakom'
    } else if (overlay === 'terms') {
      title = 'Terms of Service · HaMakom'
    }

    document.title = title
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', desc)
    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute('content', title)
    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc) ogDesc.setAttribute('content', desc)
    const ogUrl = document.querySelector('meta[property="og:url"]')
    if (ogUrl) ogUrl.setAttribute('content', window.location.href)

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
        url: window.location.href,
      })
    } else if (ldScript) {
      ldScript.remove()
    }
  }, [overlay, selectedLocation, currentPlan])

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

  const handleSavePlan = () => {
    if (!currentPlan) return

    if (authUser) {
      setSavedPlanIds((prev) => (prev.includes(currentPlan.id) ? prev : [...prev, currentPlan.id]))
      void trackEvent('plan_saved', {
        userId: authUser.id,
        itemType: 'plan',
        itemId: currentPlan.id,
      })
      void upsertRecommendationOutcome(currentRecommendationId, { saved: true })
      return
    }

    saveAnswersToSession(quizAnswers)
    savePendingSaveToSession({ type: 'plan', id: currentPlan.id })
    setSaveGateItem({
      type: 'plan',
      title: lang === 'he' ? currentPlan.title_he : currentPlan.title_en,
      subtitle: lang === 'he' ? currentPlan.start_time_text_he : currentPlan.start_time_text_en,
      returnOverlay: 'quiz-results',
    })
    setOverlay('save-gate')
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

  const handleToggleSavePlace = (location, options = {}) => {
    if (!location) return

    if (authUser) {
      const willSave = !savedPlaceIds.includes(location.id)
      setSavedPlaceIds((prev) => (prev.includes(location.id) ? prev.filter((id) => id !== location.id) : [...prev, location.id]))
      void trackEvent('saved_place_toggled', {
        userId: authUser.id,
        itemType: 'place',
        itemId: location.id,
        properties: { saved: willSave },
      })
      return
    }

    if (savedPlaceIds.includes(location.id)) return

    savePendingSaveToSession({ type: 'place', id: location.id })
    setSaveGateItem({
      type: 'place',
      title: lang === 'he' ? location.name_he || location.name : location.name,
      subtitle: lang === 'he' ? location.city_he || location.city : location.city,
      returnOverlay: options.returnOverlay ?? overlay ?? null,
    })
    setOverlay('save-gate')
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
    window.history.pushState({}, '', `/location/${slug}`)
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
    setOverlay('plan-preview')
  }

  const openCustomPlanBuilder = () => {
    setOverlay('build-plan')
  }

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
    return <PrivacyPage lang={lang} font={font} onBack={() => setOverlay(null)} />
  }

  if (overlay === 'terms') {
    return <TermsPage lang={lang} font={font} onBack={() => setOverlay(null)} />
  }

  if (overlay === 'admin') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F7F2E8' }} />}>
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

  if (overlay === 'plan-preview' && tonightPlan) {
    return (
      <PlanPreviewPage
        lang={lang}
        font={font}
        plan={tonightPlan}
        title={tx.tonightsPick}
        onBack={() => setOverlay(null)}
        onPlanMyOwnDate={openQuiz}
      />
    )
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

  // Empty-state fallback: the user finished the quiz but the engine found
  // no plan that meets the geographic + focus bar for their answers. We'd
  // rather say "not enough strong options yet" than fabricate a plan that
  // ignores what they asked for.
  if (overlay === 'quiz-results' && !currentPlan && quizAnswers) {
    const isHe = lang === 'he'
    const cityLabel = quizAnswers.city && quizAnswers.city !== 'flexible' ? quizAnswers.city : null
    return (
      <div style={{ minHeight: '100dvh', background: '#F7F2E8', color: '#241E16', fontFamily: font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🌒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px', maxWidth: 420, lineHeight: 1.25 }}>
          {isHe
            ? cityLabel ? `אין לנו עדיין מספיק אופציות חזקות ב${cityLabel}` : 'אין לנו עדיין מספיק אופציות חזקות לדייט הזה'
            : cityLabel ? `Not enough strong options in ${cityLabel} yet` : 'Not enough strong options for this date yet'}
        </h1>
        <p style={{ fontSize: 14, color: '#8A7F6C', maxWidth: 420, lineHeight: 1.55, margin: '0 0 22px' }}>
          {isHe
            ? 'עדיין אין לנו מספיק אופציות מאומתות בעיר הזו. נסו אזור קרוב או הקלו על ההעדפות שלכם.'
            : 'We don’t have enough verified options in this city yet. Try a nearby area or loosen your preferences.'}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => setOverlay('quiz')}
            style={{ background: '#241E16', color: '#F4ECD8', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isHe ? 'נסו שוב' : 'Try different answers'}
          </button>
          <button
            onClick={() => { setOverlay(null); setTab('explore'); setExploreExpanded(true) }}
            style={{ background: 'transparent', color: '#241E16', border: '1px solid #EBE2D0', borderRadius: 10, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
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
    <div dir={tx.dir} style={{ minHeight: '100vh', background: APP_BG, color: APP_TEXT, fontFamily: font }}>
      <div
        style={{
          minHeight: '100vh',
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
                const cityKeys = [...new Set(datePlans.map((p) => p.city).filter(Boolean))]
                const randomCity = cityKeys[Math.floor(Math.random() * cityKeys.length)] || 'flexible'
                const pool = datePlans.filter((p) => p.city === randomCity)
                const pick = pool[Math.floor(Math.random() * pool.length)] || datePlans[0]
                if (!pick) return
                void trackEvent('surprise_me_clicked', { userId: authUser?.id, properties: { city: randomCity } })
                setOverlay('plan-preview')
              }}
              onBuildYourOwnPlan={openCustomPlanBuilder}
              onOpenTonightPlan={openPlanPreview}
              onOpenExplore={() => selectTab('explore')}
              onBrowseByCategory={(cat) => {
                setBrowseFilters((prev) => ({ ...prev, categoryFilter: cat }))
                setExploreExpanded(true)
                selectTab('explore')
              }}
              onBrowseByCity={(city) => {
                setBrowseFilters((prev) => ({ ...prev, cityFilter: city }))
                setExploreExpanded(true)
                selectTab('explore')
              }}
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
              savedPlaceIds={savedPlaceIds}
              onToggleSavePlace={handleToggleSavePlace}
              bottomOffset={NAV_HEIGHT + 16}
            />
          ) : null}

          {tab === 'saved' ? (
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
              onGoHome={() => selectTab('home')}
            />
          ) : null}

          {tab === 'profile' ? (
            <ProfilePage
              lang={lang}
              tx={tx}
              authUser={authUser}
              savedCount={savedCount}
              onToggleLang={() => setLang((current) => (current === 'en' ? 'he' : 'en'))}
              onOpenQuiz={openQuiz}
              onOpenSuggest={() => setOverlay('suggest')}
              onOpenAdmin={() => setOverlay('admin')}
              onOpenFeedback={() => setShowFeedbackModal(true)}
              onOpenPrivacy={() => setOverlay('privacy')}
              onOpenTerms={() => setOverlay('terms')}
              analyticsEnabled={analyticsEnabled}
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
                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  })
                  if (res.ok) {
                    await supabase.auth.signOut()
                    localStorage.clear()
                    window.location.reload()
                  }
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
          onDecline={() => setShowConsentBanner(false)}
          onOpenPrivacy={() => setOverlay('privacy')}
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
  return (
    <div
      style={{
        background: APP_BG,
        borderBottom: `1px solid ${APP_BORDER}`,
        padding: '12px 16px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img
            src="/logo-icon.svg"
            alt="HaMakom"
            style={{ width: 28, height: 28, objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
          <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: APP_TEXT, letterSpacing: '-0.01em' }}>
            HaMakom
          </span>
          <span style={{ fontSize: 13, color: APP_ACCENT, marginInlineStart: 2 }}>המקום</span>
        </div>

        <button
          onClick={onToggleLang}
          style={{
            background: 'transparent',
            border: `1px solid ${APP_BORDER}`,
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            color: APP_ACCENT,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {lang === 'en' ? 'עבר' : 'EN'}
        </button>
      </div>
    </div>
  )
}

const HOME_CATEGORY_TILES = [
  { cat: 'Hotels & Lounges',        emoji: '✨', label_en: 'Hotels & Lounges',  label_he: 'מלונות ולאונג\'' },
  { cat: 'Cafés & Restaurants',     emoji: '☕', label_en: 'Cafés & Dining',    label_he: 'קפה ומסעדות'    },
  { cat: 'Parks & Outdoors',        emoji: '🌿', label_en: 'Parks & Outdoors',  label_he: 'פארקים וטבע'    },
  { cat: 'Activities & Experiences',emoji: '🎯', label_en: 'Activities',         label_he: 'פעילויות'       },
  { cat: 'Museums & Culture',       emoji: '🏛', label_en: 'Museums & Culture', label_he: 'תרבות'           },
  { cat: 'Wineries',                emoji: '🍷', label_en: 'Wineries',          label_he: 'יקבים'          },
]

const HOME_CITY_CHIPS = [
  { city: 'Jerusalem',    label_en: 'Jerusalem',    label_he: 'ירושלים'   },
  { city: 'Beit Shemesh', label_en: 'Beit Shemesh', label_he: 'בית שמש'   },
  { city: 'Tel Aviv',     label_en: 'Tel Aviv',     label_he: 'תל אביב'   },
  { city: "Modi'in",      label_en: "Modi'in",      label_he: 'מודיעין'   },
  { city: 'Tzur Hadassah',label_en: 'Tzur Hadassah',label_he: 'צור הדסה'  },
]

function HomePage({
  lang,
  tx,
  tonightPlan,
  loading,
  error,
  onStartQuiz,
  onSurpriseMe,
  onBuildYourOwnPlan,
  onOpenTonightPlan,
  onOpenExplore,
  onBrowseByCategory,
  onBrowseByCity,
}) {
  const isHe = lang === 'he'
  return (
    <div style={{ display: 'grid', gap: 24 }}>

      {/* Hero — open section, no panel box */}
      <section style={{ padding: '8px 0 4px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: APP_ACCENT, textTransform: 'uppercase', marginBottom: 14 }}>
          {tx.planHeroEyebrow}
        </div>
        <h1 style={{ fontFamily: SERIF, margin: '0 0 14px', fontSize: 'clamp(30px, 8vw, 40px)', lineHeight: 1.08, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {tx.planHeroTitle}
        </h1>
        <p style={{ margin: '0 0 22px', color: APP_SOFT, fontSize: 15.5, lineHeight: 1.6, maxWidth: '32ch' }}>{tx.planHeroText}</p>

        {/* Trust chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {(isHe
            ? ['חידון של 60 שניות', 'מסלולים מובחרים', 'מודע לכשרות']
            : ['60-second quiz', 'Curated routes', 'Kosher-aware']
          ).map((label) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 999, padding: '7px 13px' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C9A84C', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#5A5142' }}>{label}</span>
            </span>
          ))}
        </div>

        <button onClick={onStartQuiz} style={{ ...primaryButtonStyle, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          {tx.planHeroAction} <span style={{ color: '#E0BE58' }}>→</span>
        </button>
        <div style={{ textAlign: 'center', margin: '15px 0 4px' }}>
          <span style={{ fontSize: 13.5, color: '#9A8F7C' }}>
            {isHe ? 'בערך דקה · 4 הקשות מהירות' : 'Takes about a minute · 4 quick taps'}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={onSurpriseMe} style={{ ...textLinkButtonStyle, fontSize: 13 }}>
            {isHe ? '🎲 הפתיעו אותי הלילה' : '🎲 Surprise me tonight'}
          </button>
        </div>
      </section>

      {/* Tonight's Pick — standalone card, no outer panel wrapper */}
      <section>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: APP_MUTED, textTransform: 'uppercase', marginBottom: 10 }}>
          {tx.tonightsPick}
        </div>
        <TonightPlanCard lang={lang} tx={tx} plan={tonightPlan} onOpenPlan={onOpenTonightPlan} onStartQuiz={onStartQuiz} />
      </section>

      {/* Browse by type — open section */}
      <section>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: APP_MUTED, textTransform: 'uppercase', marginBottom: 10 }}>
          {isHe ? 'לפי סוג' : 'Browse by type'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {HOME_CATEGORY_TILES.map(({ cat, emoji, label_en, label_he }) => (
            <button
              key={cat}
              onClick={() => onBrowseByCategory(cat)}
              style={{
                background: APP_PANEL,
                border: `1px solid ${APP_BORDER}`,
                borderRadius: 12,
                padding: '14px 8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 7,
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <span style={{ fontSize: 11, color: APP_TEXT, lineHeight: 1.25, textAlign: 'center' }}>
                {isHe ? label_he : label_en}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Browse by city — open section */}
      <section>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: APP_MUTED, textTransform: 'uppercase', marginBottom: 10 }}>
          {isHe ? 'לפי עיר' : 'Browse by city'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {HOME_CITY_CHIPS.map(({ city, label_en, label_he }) => (
            <button
              key={city}
              onClick={() => onBrowseByCity(city)}
              style={{
                background: APP_PANEL,
                border: `1px solid ${APP_BORDER}`,
                borderRadius: 16,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 13,
                color: APP_TEXT,
                fontFamily: 'inherit',
              }}
            >
              {isHe ? label_he : label_en}
            </button>
          ))}
        </div>
      </section>

      {/* Explore footer — minimal */}
      <section style={{ paddingBottom: 8 }}>
        {error ? (
          <div style={{ background: '#1A1010', border: '1px solid #5A2020', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#F87171' }}>
            {isHe ? 'לא ניתן להתחבר לשרת, מוצגים נתוני גיבוי.' : 'Could not reach the server, showing cached data.'}
          </div>
        ) : null}
        {loading ? <div style={{ padding: '10px 0', color: APP_MUTED, fontSize: 13 }}>{tx.loading}</div> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={onOpenExplore} style={{ ...secondaryButtonStyle, width: '100%' }}>
            {tx.openExplore}
          </button>
          <button onClick={onBuildYourOwnPlan} style={textLinkButtonStyle}>
            {tx.buildYourOwnPlan}
          </button>
        </div>
      </section>

    </div>
  )
}

function ExplorePage({
  lang,
  tx,
  font,
  locations,
  filteredLocations,
  curatedSections,
  loading,
  exploreMode,
  setExploreMode,
  exploreExpanded,
  setExploreExpanded,
  browseSearch,
  setBrowseSearch,
  browseFilters,
  setBrowseFilters,
  onOpenDetail,
  savedPlaceIds,
  onToggleSavePlace,
  bottomOffset,
}) {
  const showCurated = !browseSearch && !exploreExpanded && areFiltersDefault(browseFilters)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 0', minHeight: 0, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          flexShrink: 0,
          padding: '2px 0',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <div style={{ fontSize: 'clamp(16px, 4.2vw, 19px)', fontWeight: 600, lineHeight: 1.35 }}>{tx.exploreChooserTitle}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setExploreMode('list')} style={exploreMode === 'list' ? primaryCompactButtonStyle : compactButtonStyle}>
            {tx.listView}
          </button>
          <button onClick={() => setExploreMode('map')} style={exploreMode === 'map' ? primaryCompactButtonStyle : compactButtonStyle}>
            {tx.map}
          </button>
        </div>
      </div>

      {exploreMode === 'map' ? (
        <div
          style={{
            flex: '1 1 0',
            minHeight: 0,
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            border: `1px solid ${APP_BORDER}`,
            background: '#EDE7D9',
          }}
        >
          <Suspense fallback={<div style={{ flex: 1, background: '#EDE7D9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A99A85', fontSize: 13 }}>Loading map…</div>}>
            <MapView
              locations={locations}
              lang={lang}
              tx={tx}
              font={font}
              onOpenDetail={onOpenDetail}
              showHeader={false}
              embedded
              bottomOffset={bottomOffset}
            />
          </Suspense>
        </div>
      ) : (
        <section
          style={{
            flex: '1 1 0',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '4px 0 16px',
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              value={browseSearch}
              onChange={(event) => {
                setBrowseSearch(event.target.value)
                if (event.target.value) setExploreExpanded(true)
              }}
              placeholder={tx.searchPlaceholder}
              style={{
                width: '100%',
                background: '#FBF7EE',
                border: `1px solid ${APP_BORDER}`,
                borderRadius: 12,
                padding: '12px 14px',
                color: APP_TEXT,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                textAlign: tx.dir === 'rtl' ? 'right' : 'left',
              }}
            />

            <FilterBar
              tx={tx}
              filters={browseFilters}
              setFilters={(updater) => {
                setExploreExpanded(true)
                setBrowseFilters(updater)
              }}
            />

            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: APP_MUTED }}>{tx.loading}</div>
            ) : showCurated ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {curatedSections.map((section) => (
                  <section key={section.id} style={{ display: 'grid', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{section.title}</div>
                      <div style={{ fontSize: 13, color: '#8E97A8', lineHeight: 1.5 }}>{section.text}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                      {section.items.map((location) => (
                        <Card
                          key={`${section.id}-${location.id}`}
                          loc={location}
                          lang={lang}
                          tx={tx}
                          saved={savedPlaceIds.includes(location.id)}
                          onToggleSave={() => onToggleSavePlace(location, { returnOverlay: null })}
                          onClick={() => onOpenDetail(location)}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                <button onClick={() => setExploreExpanded(true)} style={textLinkButtonStyle}>
                  {lang === 'he' ? 'עדיין לא בטוחים? פתחו את כל החלופות' : 'Still unsure? Open the full alternative list'}
                </button>
              </div>
            ) : filteredLocations.length === 0 ? (
              <EmptyState icon="⌕" title={lang === 'he' ? 'לא נמצאו מקומות' : 'No places found'} text={tx.noResults} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {filteredLocations.map((location) => (
                  <Card
                    key={location.id}
                    loc={location}
                    lang={lang}
                    tx={tx}
                    saved={savedPlaceIds.includes(location.id)}
                    onToggleSave={() => onToggleSavePlace(location, { returnOverlay: null })}
                    onClick={() => onOpenDetail(location)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function TonightPlanCard({ lang, tx, plan, onOpenPlan }) {
  if (!plan) return null
  const isHe = lang === 'he'
  const meta = [
    isHe ? plan.start_time_text_he : plan.start_time_text_en,
    isHe ? plan.duration_text_he : plan.duration_text_en,
    `${(plan.stops || []).length} ${isHe ? 'תחנות' : 'stops'}`,
  ].filter(Boolean)

  return (
    <button
      onClick={onOpenPlan}
      style={{
        display: 'block', width: '100%', textAlign: isHe ? 'right' : 'left',
        background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 22,
        padding: 18, cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 10px 30px -20px rgba(40,30,12,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: APP_ACCENT, textTransform: 'uppercase' }}>
          {plan.city ? `${isHe ? 'בחירת הערב' : "Tonight's pick"} · ${plan.city}` : (isHe ? 'בחירת הערב' : "Tonight's pick")}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4F7144', background: '#E9F0E4', borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap' }}>
          {isHe ? 'התאמה חזקה' : 'Strong match'}
        </span>
      </div>

      <div style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 600, lineHeight: 1.12, marginBottom: 6, color: APP_TEXT }}>
        {isHe ? plan.title_he : plan.title_en}
      </div>
      <div style={{ color: APP_SOFT, fontSize: 13.5, lineHeight: 1.5, marginBottom: 14 }}>
        {isHe ? plan.narrative_he : plan.narrative_en}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderTop: '1px solid #F0E9DA', paddingTop: 13 }}>
        {meta.map((m, i) => (
          <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, color: '#7E7361', fontWeight: 600 }}>{m}</span>
            {i < meta.length - 1 ? <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D8CCB2' }} /> : null}
          </span>
        ))}
        <span style={{ marginInlineStart: 'auto', fontSize: 13, color: APP_ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {isHe ? '← צפייה' : 'View →'}
        </span>
      </div>
    </button>
  )
}

function SavedPage({ lang, tx, authUser, plans, places, reminderIds, feedbackByItem, onRemovePlan, onRemovePlace, onTogglePlanReminder, onSubmitFeedback, onOpenPlace, onGoHome }) {
  if (!authUser && !plans.length && !places.length) {
    return <SavedSignInCard lang={lang} onGoHome={onGoHome} />
  }

  if (!plans.length && !places.length) {
    return <EmptyState icon="○" title={tx.savedEmptyTitle} text={tx.savedPlansEmptyText} actionLabel={tx.goHome} onAction={onGoHome} />
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
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
            {isHe ? 'היכנסו כדי לשמור את הדייטים שלכם' : 'Sign in to keep your dates'}
          </div>
          <div style={{ fontSize: 14, color: '#6E6450', lineHeight: 1.65 }}>
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
                  placeholder={isHe ? 'האימייל שלכם' : 'Your email'}
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
    <div style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 16, padding: 16, color: '#8A7F6C', fontSize: 14, lineHeight: 1.5 }}>
      {text}
    </div>
  )
}

function SavedPlanCard({ lang, tx, plan, reminderSet, feedback, onToggleReminder, onSubmitFeedback, onRemove }) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [draftRating, setDraftRating] = useState(feedback?.rating || 0)
  const [draftAgain, setDraftAgain] = useState(feedback?.again ?? null)
  const isHe = lang === 'he'
  const shareText = isHe
    ? `התוכנית ששמרתי: ${plan.title_he}\n${plan.start_time_text_he}\n${plan.share_summary_he}\nhamakom.app`
    : `Saved plan: ${plan.title_en}\n${plan.start_time_text_en}\n${plan.share_summary_en}\nhamakom.app`

  const handleShare = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.08, marginBottom: 6 }}>{isHe ? plan.title_he : plan.title_en}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <MiniPill>{isHe ? plan.start_time_text_he : plan.start_time_text_en}</MiniPill>
        <MiniPill>{isHe ? plan.duration_text_he : plan.duration_text_en}</MiniPill>
        <MiniPill>{isHe ? plan.budget_text_he : plan.budget_text_en}</MiniPill>
        {reminderSet ? <MiniPill>{isHe ? 'תזכורת נשמרה' : 'Reminder set'}</MiniPill> : null}
      </div>
      <div style={{ color: '#6E6450', fontSize: 15, lineHeight: 1.55, marginBottom: 12 }}>{isHe ? plan.narrative_he : plan.narrative_en}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <button onClick={onToggleReminder} style={secondaryButtonStyle}>
          {reminderSet ? (isHe ? 'הסירו תזכורת' : 'Remove Reminder') : isHe ? 'קבעו תזכורת' : 'Set Reminder'}
        </button>
        <button onClick={handleShare} style={secondaryButtonStyle}>
          {tx.shareSavedPlan}
        </button>
        {!feedback ? (
          <button onClick={() => setShowFeedback((current) => !current)} style={textLinkButtonStyle}>
            {isHe ? 'הייתם בדייט הזה?' : 'Did you go?'}
          </button>
        ) : (
          <div style={{ background: '#FBF7EE', border: '1px solid #EDE5D4', borderRadius: 12, padding: 14, color: '#8A7F6C', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ color: '#241E16', fontWeight: 600, marginBottom: 4 }}>{isHe ? 'נשמר פידבק לדייט הזה' : 'Feedback saved for this date'}</div>
            <div>
              {isHe
                ? `הלכתם: ${feedback.went ? 'כן' : 'לא'}${feedback.rating ? ` · דירוג: ${feedback.rating}/5` : ''}${feedback.again !== undefined ? ` · שוב: ${feedback.again ? 'כן' : 'לא'}` : ''}`
                : `Went: ${feedback.went ? 'Yes' : 'No'}${feedback.rating ? ` · Rating: ${feedback.rating}/5` : ''}${feedback.again !== undefined ? ` · Again: ${feedback.again ? 'Yes' : 'No'}` : ''}`}
            </div>
          </div>
        )}
        {showFeedback ? (
          <FeedbackComposer
            lang={lang}
            rating={draftRating}
            again={draftAgain}
            onSetWent={(went) => {
              if (!went) {
                onSubmitFeedback({ went: false })
                setShowFeedback(false)
                return
              }
            }}
            onSetRating={setDraftRating}
            onSetAgain={setDraftAgain}
            onSubmit={() => {
              onSubmitFeedback({ went: true, rating: draftRating, again: draftAgain })
              setShowFeedback(false)
            }}
          />
        ) : null}
        <button onClick={onRemove} style={textLinkButtonStyle}>
          {tx.removeSavedPlan}
        </button>
      </div>
    </section>
  )
}

function FeedbackComposer({ lang, rating, again, onSetWent, onSetRating, onSetAgain, onSubmit }) {
  const isHe = lang === 'he'
  return (
    <div style={{ background: '#FBF7EE', border: '1px solid #EDE5D4', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, color: '#241E16', fontWeight: 600 }}>{isHe ? 'עזרו לנו לדייק את ההמלצה הבאה' : 'Help us sharpen the next recommendation'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onSetWent(true)} style={compactButtonStyle}>{isHe ? 'כן, הלכנו' : 'Yes, we went'}</button>
        <button onClick={() => onSetWent(false)} style={compactButtonStyle}>{isHe ? 'לא בסוף' : 'Not in the end'}</button>
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#8A7F6C', marginBottom: 6 }}>{isHe ? 'איך היה?' : 'How was it?'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} onClick={() => onSetRating(value)} style={rating === value ? primaryCompactButtonStyle : compactButtonStyle}>
              {value}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#8A7F6C', marginBottom: 6 }}>{isHe ? 'הייתם בוחרים משהו כזה שוב?' : 'Would you do something like this again?'}</div>
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

function ProfilePage({ lang, tx, authUser, savedCount, onToggleLang, onOpenQuiz, onOpenSuggest, onOpenAdmin, onOpenPrivacy, onOpenTerms, analyticsEnabled, onToggleAnalytics, onDeleteAccount, onOpenFeedback }) {
  const cards = [
    { label: tx.profileStatsSaved, value: savedCount },
    { label: lang === 'he' ? 'כרגע' : 'Right now', value: lang === 'he' ? 'תוכנית אחת' : 'One strong plan' },
    { label: tx.profileStatsLanguage, value: lang === 'he' ? 'HE' : 'EN' },
  ]

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ background: '#FFFFFF', border: `1px solid ${APP_BORDER}`, borderRadius: 20, padding: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: APP_MUTED }}>{tx.profileCardEyebrow}</div>
        <h2 style={{ fontSize: 26, margin: '6px 0 8px', lineHeight: 1.08 }}>{tx.profileCardTitle}</h2>
        <p style={{ margin: 0, color: '#6E6450', fontSize: 14 }}>{authUser?.email ? authUser.email : tx.profileGuest}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginTop: 18 }}>
          {cards.map((card) => (
            <div key={card.label} style={{ background: '#FBF7EE', border: '1px solid #EDE5D4', borderRadius: 12, padding: '14px 12px' }}>
              <div style={{ fontSize: 24, color: APP_ACCENT, lineHeight: 1.1 }}>{card.value}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: APP_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.label}</div>
            </div>
          ))}
        </div>
      </section>

      <ActionCard title={tx.profileActionsTitle} text={tx.profileActionsText}>
        <button onClick={onOpenQuiz} style={primaryButtonStyle}>
          {tx.profileActionQuiz}
        </button>
        <button onClick={onOpenSuggest} style={secondaryButtonStyle}>
          {tx.profileActionSuggest}
        </button>
        <button onClick={onOpenFeedback} style={secondaryButtonStyle}>
          {lang === 'he' ? 'דווח על בעיה / משוב' : 'Report a problem / Feedback'}
        </button>
        <button onClick={onToggleLang} style={secondaryButtonStyle}>
          {tx.profileActionLanguage}
        </button>
        <button onClick={onOpenAdmin} style={textLinkButtonStyle}>
          {tx.profileActionAdmin}
        </button>
      </ActionCard>

      <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 16, padding: 18 }}>
        <h3 style={{ fontSize: 18, margin: '0 0 14px' }}>{lang === 'he' ? 'הגדרות' : 'Settings'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${APP_BORDER}` }}>
          <div>
            <div style={{ fontSize: 14, color: APP_TEXT }}>{lang === 'he' ? 'נתוני שימוש' : 'Usage analytics'}</div>
            <div style={{ fontSize: 12, color: APP_MUTED, marginTop: 2 }}>{lang === 'he' ? 'עוזר לנו לשפר את ההמלצות' : 'Helps us improve recommendations'}</div>
          </div>
          <button
            onClick={onToggleAnalytics}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
              background: analyticsEnabled ? APP_ACCENT : '#E6DCC8',
              position: 'relative', transition: 'background 0.2s',
            }}
            aria-label={analyticsEnabled ? 'Disable analytics' : 'Enable analytics'}
          >
            <span style={{
              position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
              left: analyticsEnabled ? 23 : 3,
            }} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 16, paddingTop: 14 }}>
          <button onClick={onOpenPrivacy} style={{ ...textLinkButtonStyle, padding: '4px 0', fontSize: 12 }}>
            {lang === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy'}
          </button>
          <button onClick={onOpenTerms} style={{ ...textLinkButtonStyle, padding: '4px 0', fontSize: 12 }}>
            {lang === 'he' ? 'תנאי שירות' : 'Terms of Service'}
          </button>
        </div>

        {authUser ? (
          <div style={{ paddingTop: 18, borderTop: `1px solid ${APP_BORDER}`, marginTop: 14 }}>
            <button
              onClick={onDeleteAccount}
              style={{ background: 'none', border: '1px solid #7F1D1D', color: '#F87171', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}
            >
              {lang === 'he' ? 'מחיקת חשבון' : 'Delete Account'}
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: APP_MUTED }}>
              {lang === 'he' ? 'פעולה בלתי הפיכה. כל הנתונים יימחקו.' : 'Permanent. All your data will be deleted.'}
            </p>
          </div>
        ) : null}
      </section>

      <ActionCard title={tx.profileNotesTitle} text={tx.profileNotesText} />
    </div>
  )
}

function ActionCard({ title, text, children }) {
  return (
    <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 16, padding: 18 }}>
      <h3 style={{ fontSize: 18, margin: '0 0 6px' }}>{title}</h3>
      <p style={{ margin: children ? '0 0 16px' : 0, color: '#8A7F6C', fontSize: 14 }}>{text}</p>
      {children ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : null}
    </section>
  )
}

function MiniPill({ children }) {
  return (
    <span style={{ background: '#FFFFFF', border: '1px solid #EBE2D0', borderRadius: 999, padding: '5px 10px', fontSize: 12, color: '#9A7A28' }}>
      {children}
    </span>
  )
}

function BottomNavIcon({ name, active }) {
  const stroke = active ? APP_ACCENT : '#A99A85'
  const sw = 1.85
  const svgProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'home':
      return (
        <svg {...svgProps}>
          <path d="M3 11 L12 4 L21 11 V19.5 H15 V12 H9 V19.5 H3 Z" />
        </svg>
      )
    case 'explore':
      return (
        <svg {...svgProps}>
          <circle cx="11" cy="11" r="6.25" />
          <path d="m20 20-3.35-3.35" />
        </svg>
      )
    case 'saved':
      return (
        <svg {...svgProps}>
          <path d="M19 21l-7-4.5L5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
      )
    case 'profile':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M6.5 20.25c0-3 2.9-5.25 5.5-5.25s5.5 2.25 5.5 5.25" />
        </svg>
      )
    default:
      return null
  }
}

function BottomNav({ tx, tab, savedCount, onSelect }) {
  const items = [
    { key: 'home', icon: 'home', label: tx.home },
    { key: 'explore', icon: 'explore', label: tx.explore },
    { key: 'saved', icon: 'saved', label: tx.saved, badge: savedCount > 0 ? savedCount : null },
    { key: 'profile', icon: 'profile', label: tx.profile },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        left: 14,
        right: 14,
        bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        height: NAV_HEIGHT,
        background: APP_PANEL,
        border: `1px solid ${APP_BORDER}`,
        borderRadius: 18,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        boxShadow: '0 12px 30px -14px rgba(40,30,12,0.4)',
        zIndex: 8000,
        isolation: 'isolate',
        overflow: 'hidden',
      }}
    >
      {items.map((item) => {
        const active = tab === item.key
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            style={{
              background: 'transparent',
              border: 'none',
              color: active ? APP_ACCENT : APP_MUTED,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              position: 'relative',
              paddingTop: 4,
            }}
          >
            {/* Top accent bar for active tab */}
            {active ? (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '20%',
                  right: '20%',
                  height: 2,
                  background: APP_ACCENT,
                  borderRadius: '0 0 2px 2px',
                }}
              />
            ) : null}
            <BottomNavIcon name={item.icon} active={active} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: active ? '0.01em' : 0 }}>
              {item.label}
            </span>
            {item.badge ? (
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: '18%',
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: APP_ACCENT,
                  color: APP_BG,
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
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
  color: '#F4ECD8',
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
  color: '#3C342A',
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
  color: '#3C342A',
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
  color: '#F4ECD8',
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
        bottom: 90,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 480,
        background: '#FFFFFF',
        border: '1px solid #EBE2D0',
        borderRadius: 16,
        padding: '14px 16px',
        zIndex: 9000,
        fontFamily: font,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: '#C8BDA8', lineHeight: 1.55 }}>
        {isHe
          ? 'אנחנו משתמשים בנתוני שימוש אנונימיים לשיפור ההמלצות.'
          : 'We use anonymous usage data to improve recommendations.'}
        {' '}
        <button onClick={onOpenPrivacy} style={{ background: 'none', border: 'none', color: '#9A7A28', cursor: 'pointer', fontSize: 13, fontFamily: font, padding: 0, textDecoration: 'underline' }}>
          {isHe ? 'מדיניות פרטיות' : 'Privacy Policy'}
        </button>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onAccept}
          style={{ flex: 1, background: '#241E16', color: '#F4ECD8', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}
        >
          {isHe ? 'אישור' : 'Accept'}
        </button>
        <button
          onClick={onDecline}
          style={{ flex: 1, background: '#F2EBDB', color: '#8A7F6C', border: '1px solid #E6DCC8', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
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
        position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: 480,
        background: '#FFFFFF', border: '1px solid #EBE2D0', borderRadius: 16,
        padding: '16px', zIndex: 8500, fontFamily: font,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {step === 'ask' ? (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: '#C8BDA8', lineHeight: 1.5 }}>
            {isHe ? `הלכתם ל"${planTitle}"?` : `Did you go on "${planTitle}"? 🌟`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('rate')} style={{ flex: 1, background: '#241E16', color: '#F4ECD8', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
              {isHe ? 'כן!' : 'Yes!'}
            </button>
            <button onClick={() => onRespond({ went: false })} style={{ flex: 1, background: '#F2EBDB', color: '#8A7F6C', border: '1px solid #E6DCC8', borderRadius: 10, padding: '10px 0', fontSize: 13, cursor: 'pointer', fontFamily: font }}>
              {isHe ? 'לא עדיין' : 'Not yet'}
            </button>
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#A99A85', cursor: 'pointer', padding: '10px 6px', fontSize: 13, fontFamily: font }}>✕</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: '#C8BDA8' }}>
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
            style={{ width: '100%', background: rating ? '#241E16' : '#E6DCC8', color: rating ? '#F4ECD8' : '#A99A85', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: rating ? 'pointer' : 'default', fontFamily: font, transition: 'all 0.2s' }}
          >
            {isHe ? 'שמרו' : 'Save'}
          </button>
        </>
      )}
    </div>
  )
}

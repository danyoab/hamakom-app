import { useEffect, useMemo, useState } from 'react'
import { t } from './lib/translations'
import { useLocations } from './hooks/useLocations'
import { useLocalStorage } from './hooks/useLocalStorage'
import { supabase } from './lib/supabase'
import { DATE_PLANS } from './data/datePlans'
import {
  createRecommendationImpression,
  saveUserFeedback,
  trackEvent,
  upsertRecommendationOutcome,
} from './lib/analytics'
import { getRecommendedLocations } from './lib/locationRecommendations'
import {
  clearAnswersFromSession,
  clearPendingSaveFromSession,
  getMatchedPlans,
  loadAnswersFromSession,
  loadPendingSaveFromSession,
  saveAnswersToSession,
  savePendingSaveToSession,
} from './lib/quiz'
import Card from './components/Card'
import DetailView from './components/DetailView'
import SuggestView from './components/SuggestView'
import AdminView from './components/AdminView'
import MapView from './components/MapView'
import FilterBar from './components/FilterBar'
import QuizStepper from './components/QuizStepper'
import ResultsGateModal from './components/ResultsGateModal'
import ResultsPage from './components/ResultsPage'
import PlanPreviewPage from './components/PlanPreviewPage'
import CustomPlanBuilder from './components/CustomPlanBuilder'

const PRIMARY_TABS = ['home', 'explore', 'saved', 'profile']
const APP_BG = '#0D1117'
const APP_PANEL = '#161B27'
const APP_BORDER = '#2A2F3E'
const APP_TEXT = '#E8DCC8'
const APP_ACCENT = '#C9A84C'
const APP_MUTED = '#6B7280'
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

export default function App() {
  const [lang, setLang] = useState('en')
  const [tab, setTab] = useState('home')
  const [overlay, setOverlay] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [detailReturnOverlay, setDetailReturnOverlay] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState(null)
  const [resultIndex, setResultIndex] = useState(0)
  const [authUser, setAuthUser] = useState(null)
  const [savedPlanIds, setSavedPlanIds] = useLocalStorage('hamakom-saved-plans', [])
  const [savedPlaceIds, setSavedPlaceIds] = useLocalStorage('hamakom-saved-places', [])
  const [clickedLocationCounts, setClickedLocationCounts] = useLocalStorage('hamakom-clicked-locations', {})
  const [planReminderIds, setPlanReminderIds] = useLocalStorage('hamakom-plan-reminders', [])
  const [dateFeedback, setDateFeedback] = useLocalStorage('hamakom-date-feedback', {})
  const [datePlans, setDatePlans] = useLocalStorage('hamakom-date-plans', DATE_PLANS)
  const [exploreMode, setExploreMode] = useState('list')
  const [browseSearch, setBrowseSearch] = useState('')
  const [browseFilters, setBrowseFilters] = useState(INITIAL_FILTERS)
  const [saveGateItem, setSaveGateItem] = useState(null)
  const [exploreExpanded, setExploreExpanded] = useState(false)
  const [currentRecommendationId, setCurrentRecommendationId] = useState(null)

  const tx = t[lang]
  const font =
    lang === 'he'
      ? "'David','Frank Ruhl Libre',Georgia,serif"
      : "'Palatino Linotype',Palatino,Georgia,serif"

  const { locations, loading, error: locError } = useLocations()

  const matchedPlans = useMemo(() => {
    if (!quizAnswers) return []
    return getMatchedPlans(datePlans, quizAnswers, 2, { feedbackByItem: dateFeedback })
  }, [dateFeedback, datePlans, quizAnswers])

  const currentPlan = matchedPlans[resultIndex] || null
  const alternatePlan = matchedPlans.find((_, index) => index !== resultIndex) || null
  const tonightPlan = useMemo(() => getTonightPlan(datePlans), [datePlans])
  const savedPlans = useMemo(() => datePlans.filter((plan) => savedPlanIds.includes(plan.id)), [datePlans, savedPlanIds])
  const savedPlaces = useMemo(() => locations.filter((location) => savedPlaceIds.includes(location.id)), [locations, savedPlaceIds])
  const savedCount = savedPlans.length + savedPlaces.length
  const availablePlanCities = useMemo(() => [...new Set(datePlans.map((plan) => plan.city).filter(Boolean))], [datePlans])
  const backupLocations = useMemo(() => {
    if (!quizAnswers) return []
    return getRecommendedLocations(locations, quizAnswers, {
      limit: 3,
      savedPlaceIds,
      clickedLocationCounts,
      feedbackByItem: dateFeedback,
    })
  }, [clickedLocationCounts, dateFeedback, locations, quizAnswers, savedPlaceIds])
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
    setQuizAnswers(answers)
    setResultIndex(0)
    saveAnswersToSession(answers)
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
        onBack={() => {
          setOverlay(detailReturnOverlay)
          setSelectedLocation(null)
          setDetailReturnOverlay(null)
        }}
      />
    )
  }

  if (overlay === 'suggest') {
    return <SuggestView lang={lang} tx={tx} font={font} onBack={() => setOverlay(null)} />
  }

  if (overlay === 'admin') {
    return (
      <AdminView
        lang={lang}
        font={font}
        onBack={() => setOverlay(null)}
        totalLocations={locations.length}
        locations={locations}
        datePlans={datePlans}
        onSaveDatePlans={setDatePlans}
        onResetDatePlans={() => setDatePlans(DATE_PLANS)}
      />
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

  if ((overlay === 'quiz-results' || (overlay === 'save-gate' && saveGateItem?.type !== 'place')) && currentPlan) {
    return (
      <>
        <ResultsPage
          lang={lang}
          font={font}
          plan={currentPlan}
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
        />
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
          tab={tab}
          savedCount={savedCount}
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
              onBuildYourOwnPlan={openCustomPlanBuilder}
              onOpenTonightPlan={openPlanPreview}
              onOpenExplore={() => selectTab('explore')}
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
            />
          ) : null}
        </main>
      </div>

      <BottomNav tx={tx} tab={tab} savedCount={savedCount} onSelect={selectTab} />
    </div>
  )
}

function AppHeader({ tx, lang, tab, savedCount, onToggleLang }) {
  const titleMap = {
    home: tx.home,
    explore: tx.explore,
    saved: tx.saved,
    profile: tx.profile,
  }

  const subtitleMap = {
    home: tx.homeSubtitle,
    explore: tx.exploreSubtitle,
    saved: tx.savedSubtitle(savedCount),
    profile: tx.profileSubtitle,
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg,#0C111A 0%,#131B2B 60%,#101827 100%)',
        borderBottom: `1px solid ${APP_BORDER}`,
        padding: '14px 16px 12px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                background: 'linear-gradient(180deg,#131B2B 0%,#0F1725 100%)',
                border: '1px solid #263247',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
              }}
            >
              <img
                src="/logo-icon.svg"
                alt="HaMakom"
                style={{
                  width: 28,
                  height: 28,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 'clamp(20px, 5.2vw, 28px)',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: APP_TEXT,
                    whiteSpace: 'nowrap',
                  }}
                >
                  HaMakom
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#8E97A8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  המקום
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#7B8496', marginTop: 4, lineHeight: 1.2 }}>{tx.tagline}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onToggleLang}
              style={{
                background: '#253145',
                border: '1px solid #3A475F',
                borderRadius: 14,
                padding: '10px 12px',
                cursor: 'pointer',
                color: APP_ACCENT,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'inherit',
                minWidth: 54,
              }}
            >
              {lang === 'en' ? 'עבר' : 'EN'}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 4,
            paddingTop: 10,
            borderTop: '1px solid rgba(42,47,62,0.9)',
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: APP_MUTED }}>
            {titleMap[tab]}
          </div>
          <div style={{ fontSize: 14, color: '#CDBD9F', lineHeight: 1.35, maxWidth: 520 }}>{subtitleMap[tab]}</div>
        </div>
      </div>
    </div>
  )
}

function HomePage({
  lang,
  tx,
  tonightPlan,
  loading,
  error,
  onStartQuiz,
  onBuildYourOwnPlan,
  onOpenTonightPlan,
  onOpenExplore,
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section
        style={{
          background: 'linear-gradient(145deg,#171E2B 0%,#111A10 100%)',
          border: `1px solid ${APP_BORDER}`,
          borderRadius: 22,
          padding: 22,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: '0.16em', color: APP_ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>
          {tx.planHeroEyebrow}
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: 32, lineHeight: 1.04 }}>{tx.planHeroTitle}</h1>
        <p style={{ margin: '0 0 18px', color: '#B8A990', fontSize: 15, lineHeight: 1.6 }}>{tx.planHeroText}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={onStartQuiz} style={primaryButtonStyle}>
            {tx.planHeroAction}
          </button>
        </div>
      </section>

      <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 20, padding: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.16em', color: APP_MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
          {tx.tonightsPick}
        </div>
        <TonightPlanCard lang={lang} tx={tx} plan={tonightPlan} onOpenPlan={onOpenTonightPlan} onStartQuiz={onStartQuiz} />
      </section>

      <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 20, padding: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.16em', color: APP_MUTED, textTransform: 'uppercase', marginBottom: 5 }}>{tx.browseSecondaryEyebrow}</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{tx.browseSecondaryTitle}</div>
        <div style={{ color: '#9CA3AF', fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
          {lang === 'he' ? 'כל המקומות עדיין כאן אם אתם רוצים יותר שליטה. פשוט לא צריך להתחיל משם.' : 'Every place is still here if you want more control. You just do not need to start there.'}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '18px 0', color: APP_MUTED }}>{tx.loading}</div> : null}

        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={onOpenExplore} style={{ ...ghostButtonStyle, whiteSpace: 'nowrap' }}>
            {tx.openExplore}
          </button>
          <button onClick={onBuildYourOwnPlan} style={secondaryButtonStyle}>
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
      <section
        style={{
          background: APP_PANEL,
          border: `1px solid ${APP_BORDER}`,
          borderRadius: 16,
          padding: '12px 14px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 160px' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: APP_MUTED, textTransform: 'uppercase', marginBottom: 4 }}>
              {tx.explore}
            </div>
            <div style={{ fontSize: 'clamp(16px, 4.2vw, 19px)', fontWeight: 600, lineHeight: 1.35 }}>{tx.exploreChooserTitle}</div>
            <div style={{ fontSize: 13, color: '#8E97A8', lineHeight: 1.5, marginTop: 6 }}>
              {lang === 'he' ? 'כל המקומות עדיין זמינים, אבל נתחיל בכמה חלופות רגועות במקום ברשימה ענקית.' : 'Every place is still available, but we will start with a few calm alternatives instead of a giant list.'}
            </div>
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
      </section>

      {exploreMode === 'map' ? (
        <div
          style={{
            flex: '1 1 0',
            minHeight: 0,
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            border: `1px solid ${APP_BORDER}`,
            background: '#0B0F17',
          }}
        >
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
        </div>
      ) : (
        <section
          style={{
            background: APP_PANEL,
            border: `1px solid ${APP_BORDER}`,
            borderRadius: 20,
            padding: 14,
            flex: '1 1 0',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
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
                background: '#121722',
                border: `1px solid ${APP_BORDER}`,
                borderRadius: 14,
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
                    <div style={{ display: 'grid', gap: 8 }}>
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

                <button onClick={() => setExploreExpanded(true)} style={ghostButtonStyle}>
                  {lang === 'he' ? 'עדיין לא בטוחים? פתחו את כל החלופות' : 'Still unsure? Open the full alternative list'}
                </button>
              </div>
            ) : filteredLocations.length === 0 ? (
              <EmptyState icon="⌕" title={lang === 'he' ? 'לא נמצאו מקומות' : 'No places found'} text={tx.noResults} />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
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

function TonightPlanCard({ lang, tx, plan, onOpenPlan, onStartQuiz }) {
  if (!plan) return null

  const isHe = lang === 'he'
  return (
    <div
      style={{
        background: 'linear-gradient(145deg,#121722 0%,#151C12 100%)',
        border: '1px solid #232A39',
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, marginBottom: 8 }}>{isHe ? plan.title_he : plan.title_en}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <MiniPill>{plan.city}</MiniPill>
        <MiniPill>{isHe ? plan.start_time_text_he : plan.start_time_text_en}</MiniPill>
        <MiniPill>{isHe ? plan.duration_text_he : plan.duration_text_en}</MiniPill>
      </div>
      <div style={{ color: '#B8A990', fontSize: 15, lineHeight: 1.6, marginBottom: 14 }}>{isHe ? plan.narrative_he : plan.narrative_en}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <button onClick={onOpenPlan} style={primaryButtonStyle}>
          {tx.viewTonightsPick}
        </button>
        <button onClick={onStartQuiz} style={secondaryButtonStyle}>
          {tx.getPersonalPlan}
        </button>
      </div>
    </div>
  )
}

function SavedPage({ lang, tx, plans, places, reminderIds, feedbackByItem, onRemovePlan, onRemovePlace, onTogglePlanReminder, onSubmitFeedback, onOpenPlace, onGoHome }) {
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
          <div style={{ display: 'grid', gap: 8 }}>
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
    <div style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 16, padding: 16, color: '#9CA3AF', fontSize: 14, lineHeight: 1.5 }}>
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
    <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.08, marginBottom: 6 }}>{isHe ? plan.title_he : plan.title_en}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <MiniPill>{isHe ? plan.start_time_text_he : plan.start_time_text_en}</MiniPill>
        <MiniPill>{isHe ? plan.duration_text_he : plan.duration_text_en}</MiniPill>
        <MiniPill>{isHe ? plan.budget_text_he : plan.budget_text_en}</MiniPill>
        {reminderSet ? <MiniPill>{isHe ? 'תזכורת נשמרה' : 'Reminder set'}</MiniPill> : null}
      </div>
      <div style={{ color: '#B8A990', fontSize: 15, lineHeight: 1.55, marginBottom: 12 }}>{isHe ? plan.narrative_he : plan.narrative_en}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <button onClick={onToggleReminder} style={secondaryButtonStyle}>
          {reminderSet ? (isHe ? 'הסירו תזכורת' : 'Remove Reminder') : isHe ? 'קבעו תזכורת' : 'Set Reminder'}
        </button>
        <button onClick={handleShare} style={secondaryButtonStyle}>
          {tx.shareSavedPlan}
        </button>
        {!feedback ? (
          <button onClick={() => setShowFeedback((current) => !current)} style={ghostButtonStyle}>
            {isHe ? 'הייתם בדייט הזה?' : 'Did you go?'}
          </button>
        ) : (
          <div style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 14, padding: 14, color: '#9CA3AF', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ color: '#E8DCC8', fontWeight: 600, marginBottom: 4 }}>{isHe ? 'נשמר פידבק לדייט הזה' : 'Feedback saved for this date'}</div>
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
        <button onClick={onRemove} style={ghostButtonStyle}>
          {tx.removeSavedPlan}
        </button>
      </div>
    </section>
  )
}

function FeedbackComposer({ lang, rating, again, onSetWent, onSetRating, onSetAgain, onSubmit }) {
  const isHe = lang === 'he'
  return (
    <div style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, color: '#E8DCC8', fontWeight: 600 }}>{isHe ? 'עזרו לנו לדייק את ההמלצה הבאה' : 'Help us sharpen the next recommendation'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onSetWent(true)} style={compactButtonStyle}>{isHe ? 'כן, הלכנו' : 'Yes, we went'}</button>
        <button onClick={() => onSetWent(false)} style={compactButtonStyle}>{isHe ? 'לא בסוף' : 'Not in the end'}</button>
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>{isHe ? 'איך היה?' : 'How was it?'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} onClick={() => onSetRating(value)} style={rating === value ? primaryCompactButtonStyle : compactButtonStyle}>
              {value}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>{isHe ? 'הייתם בוחרים משהו כזה שוב?' : 'Would you do something like this again?'}</div>
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

function ProfilePage({ lang, tx, authUser, savedCount, onToggleLang, onOpenQuiz, onOpenSuggest, onOpenAdmin }) {
  const cards = [
    { label: tx.profileStatsSaved, value: savedCount },
    { label: lang === 'he' ? 'כרגע' : 'Right now', value: lang === 'he' ? 'תוכנית אחת' : 'One strong plan' },
    { label: tx.profileStatsLanguage, value: lang === 'he' ? 'HE' : 'EN' },
  ]

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ background: 'linear-gradient(145deg,#161B27 0%,#111A10 100%)', border: `1px solid ${APP_BORDER}`, borderRadius: 20, padding: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: APP_MUTED }}>{tx.profileCardEyebrow}</div>
        <h2 style={{ fontSize: 26, margin: '6px 0 8px', lineHeight: 1.08 }}>{tx.profileCardTitle}</h2>
        <p style={{ margin: 0, color: '#B8A990', fontSize: 14 }}>{authUser?.email ? authUser.email : tx.profileGuest}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginTop: 18 }}>
          {cards.map((card) => (
            <div key={card.label} style={{ background: '#121722', border: '1px solid #232A39', borderRadius: 14, padding: '14px 12px' }}>
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
        <button onClick={onToggleLang} style={secondaryButtonStyle}>
          {tx.profileActionLanguage}
        </button>
        <button onClick={onOpenAdmin} style={ghostButtonStyle}>
          {tx.profileActionAdmin}
        </button>
      </ActionCard>

      <ActionCard title={tx.profileNotesTitle} text={tx.profileNotesText} />
    </div>
  )
}

function ActionCard({ title, text, children }) {
  return (
    <section style={{ background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 18, padding: 18 }}>
      <h3 style={{ fontSize: 18, margin: '0 0 6px' }}>{title}</h3>
      <p style={{ margin: children ? '0 0 16px' : 0, color: '#9CA3AF', fontSize: 14 }}>{text}</p>
      {children ? <div style={{ display: 'grid', gap: 10 }}>{children}</div> : null}
    </section>
  )
}

function MiniPill({ children }) {
  return (
    <span style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 999, padding: '5px 10px', fontSize: 12, color: '#C9A84C' }}>
      {children}
    </span>
  )
}

function BottomNavIcon({ name, active }) {
  const stroke = active ? APP_ACCENT : '#9CA3AF'
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
        background: APP_BG,
        border: `1px solid ${APP_BORDER}`,
        borderRadius: 22,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)',
        zIndex: 8000,
        isolation: 'isolate',
      }}
    >
      {items.map((item) => {
        const active = tab === item.key
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            style={{
              background: active ? '#171F2E' : 'transparent',
              border: 'none',
              borderRadius: 20,
              margin: 6,
              color: active ? APP_ACCENT : '#9CA3AF',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              position: 'relative',
            }}
          >
            <BottomNavIcon name={item.icon} active={active} />
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            {item.badge ? (
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: '24%',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: APP_ACCENT,
                  color: APP_BG,
                  fontSize: 10,
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
    <div style={{ textAlign: 'center', padding: '60px 24px', color: APP_MUTED, background: APP_PANEL, border: `1px solid ${APP_BORDER}`, borderRadius: 18 }}>
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
  background: 'linear-gradient(135deg,#C9A84C 0%,#E8B84B 100%)',
  color: APP_BG,
  border: 'none',
  borderRadius: 14,
  padding: '13px 16px',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const secondaryButtonStyle = {
  background: '#1F2937',
  color: APP_TEXT,
  border: '1px solid #374151',
  borderRadius: 14,
  padding: '13px 16px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const compactButtonStyle = {
  background: '#1F2937',
  color: APP_TEXT,
  border: '1px solid #374151',
  borderRadius: 12,
  padding: '10px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const primaryCompactButtonStyle = {
  background: 'linear-gradient(135deg,#C9A84C 0%,#E8B84B 100%)',
  color: APP_BG,
  border: 'none',
  borderRadius: 12,
  padding: '10px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const ghostButtonStyle = {
  background: 'transparent',
  color: '#9CA3AF',
  border: '1px dashed #374151',
  borderRadius: 14,
  padding: '13px 16px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
}

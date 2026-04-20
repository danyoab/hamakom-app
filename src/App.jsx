import { useState, useMemo, useEffect, useRef } from 'react'
import { t } from './lib/translations'
import { useLocations } from './hooks/useLocations'
import { useLocalStorage } from './hooks/useLocalStorage'
import { ADMIN_PIN, CATEGORY_EMOJI, getCategoryColor } from './lib/constants'
import { supabase } from './lib/supabase'
import {
  getPersonalizedResults, buildPersonalityTags,
  saveAnswersToSession, loadAnswersFromSession, clearAnswersFromSession,
} from './lib/quiz'
import FilterBar       from './components/FilterBar'
import Card            from './components/Card'
import DetailView      from './components/DetailView'
import SuggestView     from './components/SuggestView'
import AdminView       from './components/AdminView'
import MapView         from './components/MapView'
import QuizStepper     from './components/QuizStepper'
import LoadingScreen   from './components/LoadingScreen'
import ResultsGateModal from './components/ResultsGateModal'
import ResultsPage     from './components/ResultsPage'

function getTonightsPicks(locations) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const featured  = locations.filter(l => l.featured)
  const others    = locations.filter(l => !l.featured)
  const picks   = []
  const usedIds = new Set()
  for (let i = 0; picks.length < 3 && i < featured.length; i++) {
    const loc = featured[(dayOfYear + i) % featured.length]
    if (!usedIds.has(loc.id)) { picks.push(loc); usedIds.add(loc.id) }
  }
  for (let i = 0; picks.length < 3 && i < others.length; i++) {
    const loc = others[(dayOfYear + i * 37) % others.length]
    if (!usedIds.has(loc.id)) { picks.push(loc); usedIds.add(loc.id) }
  }
  return picks
}

const INITIAL_FILTERS = {
  cityFilter:     'All Cities',
  categoryFilter: 'All',
  occasionFilter: 'All',
  priceFilter:    0,
  dateFilter:     'all',
}

export default function App() {
  const [lang, setLang]         = useState('en')
  const [search, setSearch]     = useState('')
  const [filters, setFilters]   = useState(INITIAL_FILTERS)
  const [savedIds, setSavedIds] = useLocalStorage('hamakom-saved', [])
  const [view, setView]         = useState('browse') // browse | saved | suggest | detail | admin | map | quiz | quiz-loading | quiz-gate | quiz-results
  const [selected, setSelected] = useState(null)

  // Quiz state
  const [quizAnswers,  setQuizAnswers]  = useState(null)
  const [quizResults,  setQuizResults]  = useState([])
  const [personalTags, setPersonalTags] = useState({ en: [], he: [] })
  const [authUser,     setAuthUser]     = useState(null)

  // viewRef lets auth callback read current view without stale closure
  const viewRef = useRef('browse')
  const setViewSync = (v) => { viewRef.current = v; setView(v) }

  const tx   = t[lang]
  const font = lang === 'he'
    ? "'David','Frank Ruhl Libre',Georgia,serif"
    : "'Palatino Linotype',Palatino,Georgia,serif"

  const { locations, loading, error: locError } = useLocations()

  // ── Auth listener + OAuth redirect recovery ──────────────────────────
  useEffect(() => {
    if (!supabase) return

    // Check for existing session (handles OAuth redirect back to app)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user)
        const pending = loadAnswersFromSession()
        if (pending) {
          setQuizAnswers(pending)
          setPersonalTags(buildPersonalityTags(pending))
          clearAnswersFromSession()
          // Will set quiz-results once locations load (handled in separate effect)
          setViewSync('quiz-results')
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setAuthUser(user)
      if (user && _event === 'SIGNED_IN') {
        const pending = loadAnswersFromSession()
        if (pending) {
          setQuizAnswers(pending)
          setPersonalTags(buildPersonalityTags(pending))
          clearAnswersFromSession()
        }
        // If currently in gate, advance to results
        setView(prev => prev === 'quiz-gate' ? 'quiz-results' : prev)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist quiz results to Supabase after auth ───────────────────────
  useEffect(() => {
    if (!authUser || !quizAnswers || !supabase) return
    supabase.from('user_quiz_results')
      .insert({ user_id: authUser.id, answers: quizAnswers })
      .then(({ error }) => { if (error) console.warn('quiz save:', error.message) })
  }, [authUser, quizAnswers])

  // ── Recompute quiz results once locations arrive ───────────────────────
  useEffect(() => {
    if (quizAnswers && locations.length > 0 && quizResults.length === 0) {
      setQuizResults(getPersonalizedResults(locations, quizAnswers, 5))
    }
  }, [quizAnswers, locations]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const { cityFilter, categoryFilter, occasionFilter, priceFilter, dateFilter } = filters
    return locations.filter(loc => {
      const name = lang === 'he' ? (loc.name_he || loc.name) : loc.name
      const city = lang === 'he' ? (loc.city_he || loc.city) : loc.city
      if (search && !name.toLowerCase().includes(search.toLowerCase()) && !city.toLowerCase().includes(search.toLowerCase())) return false
      if (cityFilter !== 'All Cities' && loc.city !== cityFilter) return false
      if (categoryFilter !== 'All' && loc.category !== categoryFilter) return false
      if (occasionFilter !== 'All' && !loc.occasion?.includes(occasionFilter)) return false
      if (priceFilter > 0 && loc.price !== priceFilter) return false
      if (dateFilter !== 'all') {
        const stages = Array.isArray(loc.date_stage) ? loc.date_stage : [loc.date_stage]
        if (!stages.includes(Number(dateFilter))) return false
      }
      return true
    })
  }, [locations, search, filters, lang])

  const tonightsPicks = useMemo(() => getTonightsPicks(locations), [locations])

  const saved = locations.filter(l => savedIds.includes(l.id))
  const toggleSave = (id) =>
    setSavedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const surprise = () => {
    const pool = filtered.length > 0 ? filtered : locations
    if (!pool.length) return
    setSelected(pool[Math.floor(Math.random() * pool.length)])
    setViewSync('detail')
  }
  const openDetail = (loc) => { setSelected(loc); setViewSync('detail') }

  // ── Quiz handlers ─────────────────────────────────────────────────────
  const handleQuizComplete = (answers) => {
    const results = getPersonalizedResults(locations, answers, 5)
    const tags    = buildPersonalityTags(answers)
    setQuizAnswers(answers)
    setQuizResults(results)
    setPersonalTags(tags)
    saveAnswersToSession(answers) // survives OAuth redirect
    setViewSync('quiz-loading')
  }

  const handleLoadingDone = () => {
    setViewSync(authUser ? 'quiz-results' : 'quiz-gate')
  }

  const handleGateSkip = () => {
    setViewSync('quiz-results')
  }

  const handleRetakeQuiz = () => {
    setQuizAnswers(null)
    setQuizResults([])
    setPersonalTags({ en: [], he: [] })
    setViewSync('quiz')
  }

  // ── Routed views ──────────────────────────────────────────────────────
  if (view === 'quiz')
    return <QuizStepper lang={lang} font={font} onComplete={handleQuizComplete} onBack={() => setViewSync('browse')} />

  if (view === 'quiz-loading')
    return <LoadingScreen lang={lang} font={font} onComplete={handleLoadingDone} />

  if (view === 'quiz-gate')
    return (
      <ResultsGateModal
        lang={lang}
        font={font}
        results={quizResults}
        personalityTags={personalTags}
        onSkip={handleGateSkip}
      />
    )

  if (view === 'quiz-results')
    return (
      <ResultsPage
        lang={lang}
        font={font}
        results={quizResults}
        answers={quizAnswers || {}}
        personalityTags={personalTags}
        onBrowseAll={() => setViewSync('browse')}
        onRetakeQuiz={handleRetakeQuiz}
      />
    )

  if (view === 'detail' && selected)
    return <DetailView loc={selected} lang={lang} tx={tx} font={font} saved={savedIds.includes(selected.id)} onToggleSave={() => toggleSave(selected.id)} onBack={() => { setViewSync('browse'); setSelected(null) }} />
  if (view === 'suggest')
    return <SuggestView lang={lang} tx={tx} font={font} onBack={() => setViewSync('browse')} />
  if (view === 'admin')
    return <AdminView lang={lang} font={font} onBack={() => setViewSync('browse')} totalLocations={locations.length} />
  if (view === 'map')
    return <MapView locations={locations} lang={lang} tx={tx} font={font} onBack={() => setViewSync('browse')} onOpenDetail={openDetail} />

  return (
    <div dir={tx.dir} style={{ minHeight: '100vh', background: '#0D1117', color: '#E8DCC8', fontFamily: font }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#0D1117 0%,#1A1F2E 100%)', borderBottom: '1px solid #2A2F3E', padding: '0 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/logo-icon.svg" alt="" style={{ height: 54, width: 'auto', flexShrink: 0 }} />
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.1, letterSpacing: '-0.5px', color: '#E8DCC8' }}>
                  HaMakom
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#9CA3AF', marginLeft: 10 }}>המקום</span>
                </h1>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>{tx.tagline}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 300, color: '#C9A84C' }}>{locations.length}</div>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tx.locations}</div>
              </div>
              <button
                onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
                style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: '#C9A84C', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
              >
                {lang === 'en' ? 'עב' : 'EN'}
              </button>
            </div>
          </div>

          {/* Nav tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {[['browse', tx.browse], ['saved', `${tx.saved} (${savedIds.length})`], ['suggest', `➕ ${tx.suggest}`], ['map', `🗺 ${tx.map}`]].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setViewSync(v)}
                style={{
                  background: view === v ? '#C9A84C' : 'transparent',
                  color: view === v ? '#0D1117' : '#9CA3AF',
                  border: 'none', padding: '9px 16px', cursor: 'pointer',
                  fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
            {/* Hidden admin dot */}
            <button
              onClick={() => setViewSync('admin')}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#2A2F3E', fontSize: 10, padding: '0 8px', alignSelf: 'center' }}
              title="Admin"
            >
              ●
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>

        {/* Saved tab */}
        {view === 'saved' && (
          saved.length === 0
            ? <Empty icon="🤍" text={tx.noSaved} />
            : <div style={{ display: 'grid', gap: 8 }}>
                {saved.map(loc => (
                  <Card key={loc.id} loc={loc} lang={lang} tx={tx} saved onToggleSave={() => toggleSave(loc.id)} onClick={() => openDetail(loc)} />
                ))}
              </div>
        )}

        {/* Browse tab */}
        {view === 'browse' && (
          <>
            {/* Search + Surprise */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tx.searchPlaceholder}
                style={{
                  flex: 1, background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 8,
                  padding: '11px 14px', color: '#E8DCC8', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  textAlign: tx.dir === 'rtl' ? 'right' : 'left',
                }}
              />
              <button
                onClick={surprise}
                style={{ background: '#C9A84C', color: '#0D1117', border: 'none', borderRadius: 8, padding: '11px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                {tx.surpriseMe}
              </button>
            </div>

            {/* ── Quiz CTA ────────────────────────────────────────────────── */}
            <QuizCTA lang={lang} tx={tx} font={font} onStart={() => setViewSync('quiz')} />

            <TonightsPicks picks={tonightsPicks} lang={lang} tx={tx} onOpen={openDetail} />
            <FilterBar tx={tx} filters={filters} setFilters={setFilters} />

            {locError && (
              <div style={{ background:'#1A1010', border:'1px solid #5A2020', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#F87171' }}>
                ⚠️ {lang === 'he' ? 'לא ניתן להתחבר לשרת — מציג נתוני גיבוי' : 'Could not reach server — showing cached data'}
              </div>
            )}

            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>{tx.found(filtered.length)}</div>

            {loading
              ? <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280', fontStyle: 'italic' }}>{tx.loading}</div>
              : filtered.length === 0
                ? <EmptyWithSuggest tx={tx} onSuggest={() => setViewSync('suggest')} lang={lang} />
                : <div style={{ display: 'grid', gap: 8 }}>
                    {filtered.map(loc => (
                      <Card key={loc.id} loc={loc} lang={lang} tx={tx} saved={savedIds.includes(loc.id)} onToggleSave={() => toggleSave(loc.id)} onClick={() => openDetail(loc)} />
                    ))}
                  </div>
            }
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1F2430', padding: '16px 20px', textAlign: 'center', color: '#4B5563', fontSize: 11 }}>
        {lang === 'he'
          ? 'יש לבדוק כשרות באופן עצמאי · אמתו שעות לפני הביקור'
          : 'Always check kashrus independently · Verify hours before going'}
        {' · '}
        <a href="https://hamakom.app" style={{ color: '#C9A84C', textDecoration: 'none' }}>hamakom.app</a>
      </div>
    </div>
  )
}

// ── Quiz CTA banner ──────────────────────────────────────────────────────────
function QuizCTA({ lang, tx, onStart }) {
  const isHe = lang === 'he'
  return (
    <button
      onClick={onStart}
      style={{
        width: '100%', marginBottom: 12,
        background: '#111A10',
        border: '1px solid #C9A84C33',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: isHe ? 'right' : 'left',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#C9A84C' }}>
          ✦ {tx.quizCta}
        </div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
          {tx.quizCtaSub}
        </div>
      </div>
      <div style={{ fontSize: 20, flexShrink: 0, marginInlineStart: 12 }}>🎯</div>
    </button>
  )
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontStyle: 'italic' }}>{text}</p>
    </div>
  )
}

function EmptyWithSuggest({ tx, onSuggest, lang }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#6B7280' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <p style={{ fontStyle: 'italic', marginBottom: 20 }}>{tx.noResults}</p>
      <button
        onClick={onSuggest}
        style={{ background: '#C9A84C', color: '#0D1117', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
      >
        ➕ {lang === 'he' ? 'הצע מקום חדש' : 'Suggest a Place'}
      </button>
    </div>
  )
}

function TonightsPicks({ picks, lang, tx, onOpen }) {
  if (!picks.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>
        {tx.tonightsPicks}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {picks.map(pick => {
          const name = lang === 'he' ? (pick.name_he || pick.name) : pick.name
          const city = lang === 'he' ? (pick.city_he || pick.city) : pick.city
          const color = getCategoryColor(pick.category)
          return (
            <div
              key={pick.id}
              onClick={() => onOpen(pick)}
              style={{
                flex: '1 1 0', minWidth: 100,
                background: '#161B27',
                border: `1px solid #2A2F3E`,
                borderTop: `2px solid ${color}`,
                borderRadius: 8, padding: '10px 10px 8px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 4 }}>{CATEGORY_EMOJI[pick.category]}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#E8DCC8', marginBottom: 1 }}>{name}</div>
              <div style={{ fontSize: 10, color: '#C9A84C' }}>{city}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

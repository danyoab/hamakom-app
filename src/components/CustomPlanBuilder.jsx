import { lazy, Suspense, useMemo, useState } from 'react'
import { CATEGORY_EMOJI, getCategoryColor, getMapsUrl } from '../lib/constants'
import { getDistanceKm } from '../lib/distance'
import { catalogSearch, isDiscoverable } from '../lib/venueCatalog.js'
import { travelMinutes, validatePlanLocations } from '../lib/planValidation.js'
import { matchesVenuePreferences } from '../lib/venuePreferences.js'
import VenuePreferences from './VenuePreferences.jsx'
import VenueFoodDetails from './VenueFoodDetails.jsx'
import { restoreSharedPlan } from '../lib/sharedPlans.js'
import { shareContent, sharePlanMessage } from '../lib/share.js'

const PlanRouteMap = lazy(() => import('./PlanRouteMap'))

const SURFACE = 'var(--ui-surface)'
const PANEL = '#f5f5f7'
const BORDER = 'var(--ui-border)'
const ACCENT = 'var(--ui-accent)'
const TEXT = 'var(--ui-text)'
const MUTED = 'var(--ui-muted)'

function normalizeCategory(category) {
  if (category === 'CafÃ©s & Restaurants') return 'Cafés & Restaurants'
  return category
}

function getLocalizedLocation(location, lang) {
  const isHe = lang === 'he'
  return {
    name: isHe ? location.name_he || location.name : location.name,
    city: isHe ? location.city_he || location.city : location.city,
    description: isHe ? location.description_he || location.description : location.description,
  }
}

function getOverlapScore(left = [], right = []) {
  const leftItems = Array.isArray(left) ? left : [left].filter(Boolean)
  const rightItems = Array.isArray(right) ? right : [right].filter(Boolean)
  return leftItems.filter((item) => rightItems.includes(item)).length
}

function getCompatibilityScore(firstStop, candidate) {
  let score = 0

  if (candidate.id === firstStop.id) return -1

  // Distance-based scoring (overrides city match when coords available)
  if (firstStop.lat && firstStop.lng && candidate.lat && candidate.lng) {
    const km = getDistanceKm(firstStop.lat, firstStop.lng, candidate.lat, candidate.lng)
    if (km < 0.5) score += 10       // same block — ideal
    else if (km < 1.5) score += 7   // walkable
    else if (km < 3) score += 4     // nearby
    else if (km > 5) score -= 5     // too far apart
  } else if (candidate.city === firstStop.city) {
    score += 4                       // fallback: same city
  }

  if (normalizeCategory(candidate.category) !== normalizeCategory(firstStop.category)) score += 3
  score += getOverlapScore(firstStop.occasion, candidate.occasion) * 2
  score += getOverlapScore(firstStop.date_stage, candidate.date_stage) * 2

  if (typeof candidate.price === 'number' && typeof firstStop.price === 'number') {
    score += Math.max(0, 2 - Math.abs(candidate.price - firstStop.price))
  }

  return score
}

function buildCollection(locations, firstStop, selectedCity, scope, preferences) {
  const pool = locations.filter((location) => {
    if (location.id === firstStop.id) return false
    return validatePlanLocations([firstStop, location], { ...preferences, city: selectedCity || firstStop.city, travelMode: scope === 'nearby' ? 'walking' : 'driving' }).valid
  })

  return pool
    .map((location) => ({
      location,
      score: getCompatibilityScore(firstStop, location),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.location.name.localeCompare(right.location.name))
    .map((entry) => entry.location)
}

export default function CustomPlanBuilder({ lang, font, tx, locations, onBack, onOpenDetail }) {
  const isHe = lang === 'he'
  const [selectedCity, setSelectedCity] = useState('')
  const [firstSearch, setFirstSearch] = useState('')
  const [firstStop, setFirstStop] = useState(null)
  const [builderMode, setBuilderMode] = useState('nearby')
  const [secondSearch, setSecondSearch] = useState('')
  const [secondStop, setSecondStop] = useState(null)
  const [preferences, setPreferences] = useState({})

  const availableCities = useMemo(
    () => [...new Set(locations.filter(isDiscoverable).map((location) => location.city).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [locations]
  )

  const firstStopChoices = useMemo(() => {
    const query = firstSearch.trim().toLowerCase()

    return locations.filter((location) => {
      if (!isDiscoverable(location) || !matchesVenuePreferences(location, preferences)) return false
      if (selectedCity && location.city !== selectedCity) return false
      if (!query) return true

      return catalogSearch(location, query)
    })
  }, [firstSearch, locations, selectedCity, preferences])

  const secondStopChoices = useMemo(() => {
    if (!firstStop) return []

    const query = secondSearch.trim().toLowerCase()
    const source = buildCollection(locations, firstStop, selectedCity || firstStop.city, builderMode, preferences)

    return source.filter((location) => {
      if (!query) return true
      const { name, city, description } = getLocalizedLocation(location, lang)
      return [name, city, description].some((value) => value?.toLowerCase().includes(query))
    })
  }, [builderMode, firstStop, lang, locations, secondSearch, selectedCity, preferences])

  const summaryText = useMemo(() => {
    if (!firstStop) return ''

    const first = getLocalizedLocation(firstStop, lang)
    const second = secondStop ? getLocalizedLocation(secondStop, lang) : null

    if (isHe) {
      if (!second) return `נפגשים ב${first.name} ב${first.city}. אפשר לשתף כבר עכשיו כדייט במקום אחד.`
      return `מתחילים ב${first.name} ב${first.city} ואז ממשיכים ל${second.name} ב${second.city}. זה נותן ערב מסודר עם התחלה ברורה והמשך שמתאים לווייב.`
    }

    if (!second) return `Meet at ${first.name} in ${first.city}. You can share this as a one-place date now.`
    return `Start at ${first.name} in ${first.city}, then continue to ${second.name} in ${second.city}. It gives you a clear opening and a second stop that fits the vibe.`
  }, [firstStop, isHe, lang, secondStop])

  const handleShare = async () => {
    if (!firstStop) return

    const plan = restoreSharedPlan({ ids: [firstStop, secondStop].filter(Boolean).map(l => String(l.id)), mode: builderMode === 'nearby' ? 'walking' : 'driving' }, locations)
    if (plan) await shareContent(sharePlanMessage(plan, lang))
  }

  return (
    <div dir={tx.dir} style={{ minHeight: '100vh', background: 'var(--ui-bg)', color: TEXT, fontFamily: font }}>
      <div
        style={{
          background: 'var(--ui-bg)',
          borderBottom: `1px solid ${BORDER}`,
          padding: 'calc(20px + var(--hm-sat, 0px)) 20px 18px',
        }}
      >
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 12, fontFamily: 'inherit' }}
          >
            {tx.back}
          </button>
          <div style={{ fontSize: 12, letterSpacing: '0.14em', color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>{tx.buildYourOwnPlanEyebrow}</div>
          <h1 style={{ fontSize: 30, lineHeight: 1.08, margin: '0 0 8px' }}>{isHe ? 'דייט בדרך שלכם' : 'A date, your way'}</h1>
          <p style={{ margin: 0, maxWidth: 720, color: 'var(--ui-muted)', fontSize: 15, lineHeight: 1.6 }}>{tx.buildYourOwnPlanText}</p>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', padding: '20px 20px 40px', display: 'grid', gap: 16 }}>
        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ui-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{tx.buildPlanStepArea}</div>
          <select aria-label={isHe ? 'עיר' : 'City'} value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setFirstStop(null); setSecondStop(null) }} style={inputStyle(tx.dir)}>
            <option value="">{tx.buildPlanFlexibleCity}</option>
            {availableCities.map(city => <option key={city} value={city}>{tx.cities?.[city] || city}</option>)}
          </select>
        </section>

        <details style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }}>
          <summary style={{ cursor: 'pointer', marginBottom: 12 }}>{isHe ? 'אוכל, כשרות ותקציב' : 'Food, kashrut & budget'}</summary>
          <VenuePreferences lang={lang} value={preferences} onChange={next => { setPreferences(next); setFirstStop(null); setSecondStop(null) }} />
        </details>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}>
          <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ui-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{tx.buildPlanStepOne}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{tx.buildPlanFirstStop}</div>
            <input
              aria-label={isHe ? 'חיפוש מקום ראשון' : 'Search first stop'}
              value={firstSearch}
              onChange={(event) => setFirstSearch(event.target.value)}
              placeholder={tx.buildPlanSearchFirst}
              style={inputStyle(tx.dir)}
            />
            <div style={{ display: 'grid', gap: 10, marginTop: 14, maxHeight: 480, overflowY: 'auto' }}>
              {firstStopChoices.length === 0 ? (
                <div style={{ color: MUTED, fontSize: 13, padding: '20px 0', textAlign: 'center', lineHeight: 1.6 }}>
                  {tx.noLocationsFound}
                </div>
              ) : firstStopChoices.map((location) => (
                <SelectableLocationCard
                  key={location.id}
                  location={location}
                  lang={lang}
                  tx={tx}
                  selected={firstStop?.id === location.id}
                  actionLabel={tx.chooseThisPlace}
                  onSelect={() => {
                    setFirstStop(location)
                    setSecondStop(null)
                    if (!selectedCity) setSelectedCity(location.city)
                  }}
                  onOpenDetail={() => onOpenDetail(location)}
                />
              ))}
            </div>
          </section>

          <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ui-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{tx.buildPlanStepTwo}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{tx.buildPlanSecondStop}</div>

            {!firstStop ? (
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18, color: MUTED, lineHeight: 1.6 }}>
                {tx.buildPlanPickFirstPrompt}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button onClick={() => { setBuilderMode('nearby'); setSecondStop(null) }} style={builderMode === 'nearby' ? selectedChipStyle : chipStyle}>
                    {isHe ? 'מרחק הליכה' : 'Walking distance'}
                  </button>
                  <button onClick={() => { setBuilderMode('anywhere'); setSecondStop(null) }} style={builderMode === 'anywhere' ? selectedChipStyle : chipStyle}>
                    {isHe ? 'נסיעה קצרה' : 'Short drive'}
                  </button>
                </div>

                <input
                  aria-label={isHe ? 'חיפוש מקום נוסף' : 'Search next stop'}
              value={secondSearch}
                  onChange={(event) => setSecondSearch(event.target.value)}
                  placeholder={builderMode === 'nearby' ? tx.buildPlanSearchNearby : tx.buildPlanSearchAnywhere}
                  style={inputStyle(tx.dir)}
                />

                <div style={{ display: 'grid', gap: 10, marginTop: 14, maxHeight: 480, overflowY: 'auto' }}>
                  {secondStopChoices.length === 0 ? (
                    <div style={{ color: MUTED, fontSize: 13, padding: '20px 0', textAlign: 'center', lineHeight: 1.6 }}>
                      {isHe ? 'אין כרגע תחנה נוספת עם מספיק מידע לתכנון מסלול מתאים. אפשר לשתף דייט במקום אחד.' : 'There isn’t enough verified route information for a suitable second stop. You can share a one-place date.'}
                    </div>
                  ) : null}
                  {secondStopChoices.map((location) => (
                    <SelectableLocationCard
                      key={location.id}
                      location={location}
                      lang={lang}
                      tx={tx}
                      selected={secondStop?.id === location.id}
                      actionLabel={tx.addThisStop}
                      onSelect={() => setSecondStop(location)}
                      onOpenDetail={() => onOpenDetail(location)}
                      distanceFrom={firstStop}
                      travelMode={builderMode === 'nearby' ? 'walking' : 'driving'}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ui-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{tx.buildPlanPreview}</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <PlanSummaryStop index={1} label={tx.buildPlanFirstStop} location={firstStop} lang={lang} />
            <PlanSummaryStop index={2} label={tx.buildPlanSecondStop} location={secondStop} lang={lang} />
          </div>
          <p style={{ margin: '14px 0 0', color: 'var(--ui-muted)', lineHeight: 1.6 }}>{summaryText || tx.buildPlanPreviewPrompt}</p>

          {firstStop ? (
            <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', height: 340, border: `1px solid ${BORDER}` }}>
              <Suspense fallback={<div style={{ height: '100%', background: '#ededf0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>Loading map…</div>}>
                <PlanRouteMap stops={[firstStop, secondStop].filter(Boolean)} lang={lang} travelMode={builderMode === 'nearby' ? 'walking' : 'driving'} />
              </Suspense>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <button onClick={handleShare} disabled={!firstStop} style={!firstStop ? disabledButtonStyle : primaryButtonStyle}>
              {tx.shareCustomPlan}
            </button>
            <button onClick={() => {
              setFirstStop(null)
              setSecondStop(null)
              setFirstSearch('')
              setSecondSearch('')
              setBuilderMode('nearby')
            }} style={secondaryButtonStyle}>
              {tx.startOverBuildPlan}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function SelectableLocationCard({ location, lang, tx, selected, actionLabel, onSelect, onOpenDetail, distanceFrom, travelMode = 'walking' }) {
  const text = getLocalizedLocation(location, lang)
  const category = normalizeCategory(location.category)
  const color = getCategoryColor(category)
  const mapsUrl = getMapsUrl(location.maps_query)

  const walkLabel = distanceFrom?.lat && distanceFrom?.lng && location.lat && location.lng
    ? (() => {
        const km = getDistanceKm(distanceFrom.lat, distanceFrom.lng, location.lat, location.lng)
        const dist = km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
        return `${dist} · ≈${travelMinutes(distanceFrom, location, travelMode)} ${lang === 'he' ? 'דקות' : 'min'} ${travelMode === 'driving' ? (lang === 'he' ? 'נסיעה' : 'drive') : (lang === 'he' ? 'הליכה' : 'walk')}`
      })()
    : null

  return (
    <div style={{ background: PANEL, border: `1px solid ${selected ? ACCENT : BORDER}`, borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `${color}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {CATEGORY_EMOJI[category] || '•'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{text.name}</div>
              <div style={{ fontSize: 12, color: ACCENT, marginTop: 3 }}>
                {text.city}
                {walkLabel ? <span style={{ color: MUTED, marginLeft: 8 }}>{walkLabel}</span> : null}
              </div>
            </div>
            {selected ? <span style={{ fontSize: 12, color: '#4ADE80' }}>{tx.selectedLabel}</span> : null}
          </div>

          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, marginTop: 8 }}>{text.description}</div>
          <VenueFoodDetails loc={location} lang={lang} compact />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button onClick={onSelect} style={selected ? secondaryMiniButtonStyle : primaryMiniButtonStyle}>
              {selected ? tx.selectedLabel : actionLabel}
            </button>
            <button onClick={onOpenDetail} style={secondaryMiniButtonStyle}>
              {tx.details}
            </button>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {tx.openMaps}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanSummaryStop({ index, label, location, lang }) {
  const text = location ? getLocalizedLocation(location, lang) : null

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: ACCENT,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {index}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ui-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        {text ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{text.name}</div>
            <div style={{ fontSize: 13, color: ACCENT, marginTop: 4 }}>{text.city}</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, marginTop: 8 }}>{text.description}</div>
          </>
        ) : (
          <div style={{ color: MUTED, lineHeight: 1.6 }}>{lang === 'he' ? 'עדיין לא נבחר.' : 'Not chosen yet.'}</div>
        )}
      </div>
    </div>
  )
}

const chipStyle = {
  background: '#F2EBDB',
  color: TEXT,
  border: '1px solid #E6DCC8',
  borderRadius: 999,
  padding: '10px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const selectedChipStyle = {
  background: 'var(--ui-text)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 999,
  padding: '10px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const primaryButtonStyle = {
  background: 'var(--ui-text)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  padding: '14px 16px',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const disabledButtonStyle = {
  ...primaryButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
}

const secondaryButtonStyle = {
  background: '#F2EBDB',
  color: TEXT,
  border: '1px solid #E6DCC8',
  borderRadius: 12,
  padding: '14px 16px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const primaryMiniButtonStyle = {
  background: 'var(--ui-text)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  padding: '9px 12px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const secondaryMiniButtonStyle = {
  background: '#F2EBDB',
  color: TEXT,
  border: '1px solid #E6DCC8',
  borderRadius: 12,
  padding: '9px 12px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const linkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ACCENT,
  textDecoration: 'none',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: '9px 12px',
  fontSize: 12,
  fontWeight: 600,
}

function inputStyle(dir) {
  return {
    width: '100%',
    background: PANEL,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: '12px 14px',
    color: TEXT,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    textAlign: dir === 'rtl' ? 'right' : 'left',
  }
}

import { CATEGORIES, CITIES, CATEGORY_EMOJI } from '../lib/constants'

const ACCENT = '#C9A84C'
const PANEL  = '#161B27'
const BORDER = '#2A2F3E'
const MUTED  = '#9CA3AF'

const DEFAULTS = {
  cityFilter: 'All Cities',
  categoryFilter: 'All',
  occasionFilter: 'All',
  priceFilter: 0,
  dateFilter: 'all',
}

function chipStyle(active) {
  return {
    background: active ? ACCENT : PANEL,
    color: active ? '#0D1117' : MUTED,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    borderRadius: 999,
    padding: '7px 13px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }
}

export default function FilterBar({ tx, filters, setFilters }) {
  const { cityFilter, categoryFilter, priceFilter, dateFilter } = filters
  const set = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))

  const cityOptions = CITIES.filter(c => c !== 'All Cities')
  const categoryOptions = CATEGORIES.filter(c => c !== 'All')

  const stageChips = [
    { val: '1', label: `💬 ${tx.date1}` },
    { val: '2', label: `😊 ${tx.date2}` },
    { val: '3', label: `🔥 ${tx.date3}` },
  ]

  const priceChips = [
    { val: 1, label: '₪' },
    { val: 2, label: '₪₪' },
    { val: 3, label: '₪₪₪' },
    { val: 4, label: '₪₪₪₪' },
  ]

  const hasActiveFilter =
    cityFilter !== DEFAULTS.cityFilter ||
    categoryFilter !== DEFAULTS.categoryFilter ||
    dateFilter !== DEFAULTS.dateFilter ||
    priceFilter !== DEFAULTS.priceFilter

  const clearAll = () => setFilters(prev => ({ ...prev, ...DEFAULTS }))

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 6,
        scrollbarWidth: 'none',
        alignItems: 'center',
      }}
    >
      {hasActiveFilter ? (
        <button onClick={clearAll} style={{ ...chipStyle(false), color: ACCENT, borderColor: ACCENT }}>
          {tx.dir === 'rtl' ? 'נקה' : 'Clear'} ✕
        </button>
      ) : null}

      {stageChips.map(({ val, label }) => (
        <button
          key={`stage-${val}`}
          onClick={() => set('dateFilter', dateFilter === val ? 'all' : val)}
          style={chipStyle(dateFilter === val)}
        >
          {label}
        </button>
      ))}

      {cityOptions.map(city => (
        <button
          key={`city-${city}`}
          onClick={() => set('cityFilter', cityFilter === city ? 'All Cities' : city)}
          style={chipStyle(cityFilter === city)}
        >
          📍 {tx.cities?.[city] || city}
        </button>
      ))}

      {categoryOptions.map(cat => (
        <button
          key={`cat-${cat}`}
          onClick={() => set('categoryFilter', categoryFilter === cat ? 'All' : cat)}
          style={chipStyle(categoryFilter === cat)}
        >
          {CATEGORY_EMOJI[cat]} {tx.categories[cat]?.split(' & ')[0]}
        </button>
      ))}

      {priceChips.map(({ val, label }) => (
        <button
          key={`price-${val}`}
          onClick={() => set('priceFilter', priceFilter === val ? 0 : val)}
          style={chipStyle(priceFilter === val)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

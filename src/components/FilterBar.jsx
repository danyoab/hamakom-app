import { CATEGORIES, CITIES, OCCASION_KEYS, CATEGORY_EMOJI } from '../lib/constants'

export default function FilterBar({ tx, filters, setFilters }) {
  const { cityFilter, categoryFilter, occasionFilter, priceFilter, dateFilter } = filters
  const set = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))

  const dateOptions = [
    { val: 'all', label: tx.allDates },
    { val: '1',   label: `💬 ${tx.date1}` },
    { val: '2',   label: `😊 ${tx.date2}` },
    { val: '3',   label: `🔥 ${tx.date3}` },
  ]

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Row 1: Date stage pills + dropdowns */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8, alignItems: 'center' }}>
        {dateOptions.map(({ val, label }) => (
          <button
            key={val}
            onClick={() => set('dateFilter', val)}
            style={{
              background:   dateFilter === val ? '#C9A84C' : '#161B27',
              color:        dateFilter === val ? '#0D1117' : '#9CA3AF',
              border:       '1px solid ' + (dateFilter === val ? '#C9A84C' : '#2A2F3E'),
              borderRadius: 20, padding: '6px 13px', cursor: 'pointer',
              fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap',
              fontWeight: dateFilter === val ? 600 : 400, flexShrink: 0,
            }}
          >
            {label}
          </button>
        ))}

        <div style={{ width: 1, height: 18, background: '#2A2F3E', flexShrink: 0, margin: '0 2px' }} />

        <FilterSelect
          value={cityFilter}
          onChange={v => set('cityFilter', v)}
          options={CITIES}
          labels={{ 'All Cities': tx.allCities }}
          dir={tx.dir}
        />
        <FilterSelect
          value={occasionFilter}
          onChange={v => set('occasionFilter', v)}
          options={OCCASION_KEYS}
          labels={Object.fromEntries(OCCASION_KEYS.map(k => [k, tx.occasions[k] || k]))}
          dir={tx.dir}
        />
        <FilterSelect
          value={priceFilter === 0 ? 'all' : String(priceFilter)}
          onChange={v => set('priceFilter', v === 'all' ? 0 : Number(v))}
          options={['all', '1', '2', '3', '4']}
          labels={tx.prices}
          dir={tx.dir}
        />
      </div>

      {/* Row 2: Category chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => set('categoryFilter', categoryFilter === cat ? 'All' : cat)}
            style={{
              background:   categoryFilter === cat ? '#C9A84C' : '#161B27',
              color:        categoryFilter === cat ? '#0D1117' : '#9CA3AF',
              border:       '1px solid ' + (categoryFilter === cat ? '#C9A84C' : '#2A2F3E'),
              borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
              fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {cat === 'All' ? tx.allCategories : (CATEGORY_EMOJI[cat] + ' ' + tx.categories[cat]?.split(' & ')[0])}
          </button>
        ))}
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, options, labels = {}, dir }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 8,
        padding: '6px 10px', color: '#E8DCC8', fontSize: 11,
        fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
        direction: dir, flexShrink: 0,
      }}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{labels[opt] || opt}</option>
      ))}
    </select>
  )
}

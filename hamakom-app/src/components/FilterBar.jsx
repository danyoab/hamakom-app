import { CATEGORIES, CITIES, OCCASION_KEYS, CATEGORY_EMOJI, DATE_STAGE_BADGE } from '../lib/constants'

export default function FilterBar({ tx, filters, setFilters }) {
  const { cityFilter, categoryFilter, occasionFilter, priceFilter, dateFilter } = filters

  const set = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))

  return (
    <div>
      {/* Date stage */}
      <div style={{ background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>
          {tx.dateStage}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <StageBtn active={dateFilter === 'all'} gold onClick={() => set('dateFilter', 'all')}>{tx.allDates}</StageBtn>
          {[['1','💬'], ['2','😊'], ['3','🔥']].map(([s, emoji]) => (
            <StageBtn key={s} active={dateFilter === s} stage={Number(s)} onClick={() => set('dateFilter', s)}>
              {emoji} {tx[`date${s}`]}
              {dateFilter === s && (
                <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.75 }}>— {tx.dateDesc[s]}</span>
              )}
            </StageBtn>
          ))}
        </div>
      </div>

      {/* Dropdowns */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
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

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => set('categoryFilter', cat)}
            style={{
              background: categoryFilter === cat ? '#C9A84C' : '#161B27',
              color: categoryFilter === cat ? '#0D1117' : '#9CA3AF',
              border: '1px solid ' + (categoryFilter === cat ? '#C9A84C' : '#2A2F3E'),
              borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 11,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {cat === 'All' ? tx.allCategories : (CATEGORY_EMOJI[cat] + ' ' + tx.categories[cat]?.split(' & ')[0])}
          </button>
        ))}
      </div>
    </div>
  )
}

function StageBtn({ children, active, stage, gold, onClick }) {
  const c = stage ? DATE_STAGE_BADGE[stage] : null
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? (gold ? '#C9A84C' : c.bg) : '#1F2937',
        color: active ? (gold ? '#0D1117' : c.text) : '#9CA3AF',
        border: '1px solid ' + (active ? (gold ? '#C9A84C' : c.text) : '#374151'),
        borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
        fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {children}
    </button>
  )
}

function FilterSelect({ value, onChange, options, labels = {}, dir }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#161B27', border: '1px solid #2A2F3E', borderRadius: 8,
        padding: '7px 10px', color: '#E8DCC8', fontSize: 11,
        fontFamily: 'inherit', cursor: 'pointer', outline: 'none', direction: dir,
      }}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{labels[opt] || opt}</option>
      ))}
    </select>
  )
}

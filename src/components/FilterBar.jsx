import { CATEGORIES } from '../lib/constants'
import { isDiscoverable } from '../lib/venueCatalog.js'
export default function FilterBar({ tx, filters, setFilters, locations = [] }) {
  const counts = new Map()
  for (const loc of locations.filter(isDiscoverable)) counts.set(loc.city, (counts.get(loc.city) || 0) + 1)
  const cities = [...counts.keys()].sort((a,b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b))
  return <div className="ui-quick-filters"><select aria-label={tx.dir === 'rtl' ? 'עיר' : 'City'} value={filters.cityFilter} onChange={e => setFilters(prev => ({ ...prev, cityFilter: e.target.value }))}><option value="All Cities">{tx.dir === 'rtl' ? 'כל הערים' : 'All cities'}</option>{cities.map(c => <option key={c} value={c}>{tx.cities?.[c] || c}</option>)}</select><select aria-label={tx.dir === 'rtl' ? 'סוג מקום' : 'Place type'} value={filters.categoryFilter} onChange={e => setFilters(prev => ({ ...prev, categoryFilter: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? (tx.dir === 'rtl' ? 'כל הסוגים' : 'All places') : tx.categories?.[c] || c}</option>)}</select></div>
}

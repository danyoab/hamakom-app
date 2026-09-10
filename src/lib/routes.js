/** Path-based routes shared by web boot and native deep links. */
export function parseAppRoute(pathname) {
  let url
  try { url = new URL(pathname, 'https://hamakom.app') } catch { return null }
  const path = url.pathname.replace(/\/+$/, '') || '/'
  if (path === '/new-york' || (path === '/' && url.searchParams.get('area') === 'ny')) return { type: 'market', market: 'ny' }
  if (path === '/' && url.searchParams.get('area') === 'israel') return { type: 'market', market: 'israel' }
  if (path === '/plan') return { type: 'plan', ids: (url.searchParams.get('places') || '').split(','), mode: url.searchParams.get('mode'), date: url.searchParams.get('date'), time: url.searchParams.get('time'), lang: url.searchParams.get('lang') }
  const locMatch = path.match(/^\/location\/([^/]+)$/)
  if (locMatch) {
    try { return { type: 'location', key: decodeURIComponent(locMatch[1]) } } catch { return null }
  }
  if (path === '/privacy') return { type: 'privacy' }
  if (path === '/terms') return { type: 'terms' }
  if (path === '/delete-account') return { type: 'delete-account' }
  if (path === '/for-businesses' || path === '/businesses') return { type: 'businesses' }
  return null
}

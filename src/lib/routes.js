/** Path-based routes shared by web boot and native deep links. */
export function parseAppRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const locMatch = path.match(/^\/location\/([^/]+)$/)
  if (locMatch) return { type: 'location', key: decodeURIComponent(locMatch[1]) }
  if (path === '/privacy') return { type: 'privacy' }
  if (path === '/terms') return { type: 'terms' }
  if (path === '/delete-account') return { type: 'delete-account' }
  if (path === '/for-businesses' || path === '/businesses') return { type: 'businesses' }
  return null
}

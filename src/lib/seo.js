const SITE = 'https://hamakom.app'

/** Crawlable path for a location detail page. */
export function locationPath(loc) {
  const key = loc?.slug || loc?.id
  if (key == null) return '/'
  return `/location/${encodeURIComponent(key)}`
}

/** Absolute canonical URL for a location detail page. */
export function locationCanonical(loc) {
  return `${SITE}${locationPath(loc)}`
}

export function siteOrigin() {
  return SITE
}

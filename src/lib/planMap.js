import { CITY_COORDS, getMapsUrl } from './constants.js'
import { canonicalCity, hasVenueCoordinates } from './planGates.js'
import { getDistanceKm } from './distance.js'

function placeQuery(stop) {
  return stop.maps_query || [stop.name_en || stop.name, stop.city || stop._city, 'Israel'].filter(Boolean).join(' ')
}

export function getPlanNavigationUrl(stops = [], mode = 'walking') {
  if (!stops.length) return null
  if (stops.length === 1) return getMapsUrl(placeQuery(stops[0]))
  const query = stop => hasVenueCoordinates(stop) ? `${stop.lat},${stop.lng}` : placeQuery(stop)
  const params = new URLSearchParams({ api: '1', origin: query(stops[0]), destination: query(stops.at(-1)), travelmode: mode === 'driving' ? 'driving' : 'walking' })
  if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).map(query).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}

export function getPlanMapData(stops = [], planCity) {
  const markers = stops.flatMap((stop, index) => hasVenueCoordinates(stop)
    ? [{ stop, number: index + 1, position: [stop.lat, stop.lng] }] : [])
  const complete = stops.length > 0 && markers.length === stops.length
  const city = canonicalCity(planCity || stops[0]?.city || stops[0]?._city || '')
  const areaCenter = CITY_COORDS[city]
  return {
    markers, complete, city,
    center: markers[0]?.position || areaCenter || [31.7683, 35.2137],
    zoom: markers.length ? 15 : areaCenter ? 12 : 7,
    areaKnown: Boolean(areaCenter),
    // A city center is a viewport only. It must never become a venue marker.
    route: complete && markers.length > 1 ? markers.map(m => m.position) : [],
    distanceKm: complete && markers.length > 1
      ? markers.slice(1).reduce((sum, m, i) => sum + getDistanceKm(...markers[i].position, ...m.position), 0) : null,
  }
}

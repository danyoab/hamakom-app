import { useEffect, useRef } from 'react'
import { CITY_COORDS } from '../lib/constants'
import 'leaflet/dist/leaflet.css'

// ~300 m offset per stop so city-fallback pins don't all stack on each other
const JITTER = [[0, 0], [0.0027, 0], [-0.0013, 0.0023]]

// Numbered marker SVG — gold circle with stop index
function markerSvg(n) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path fill="#C9A84C" d="M16 0C7.164 0 0 7.164 0 16c0 10 16 24 16 24S32 26 32 16C32 7.164 24.836 0 16 0z"/>
    <circle fill="#0D1117" cx="16" cy="16" r="10"/>
    <text fill="#C9A84C" font-family="system-ui,sans-serif" font-size="11" font-weight="700"
          text-anchor="middle" dominant-baseline="central" x="16" y="16.5">${n}</text>
  </svg>`
}

export default function PlanStopsMap({ stops = [], lang, planCity }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)

  // Resolve coords for each stop: exact venue → stop's own city → planCity fallback
  const stopsWithCoords = stops.map((s, i) => {
    if (s.lat && s.lng) return s
    const fallbackCity = s._city || planCity
    const fallback = fallbackCity ? CITY_COORDS[fallbackCity] : null
    if (!fallback) return null
    const [dlat, dlng] = JITTER[i] || [0, 0]
    return { ...s, lat: fallback[0] + dlat, lng: fallback[1] + dlng, _approx: true }
  }).filter(Boolean)

  if (stopsWithCoords.length < 2) return null

  useEffect(() => {
    if (instanceRef.current) return

    import('leaflet').then(L => {
      const el = mapRef.current
      if (!el) return

      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' })

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: true,
        touchZoom: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      const bounds = []

      stopsWithCoords.forEach((stop, i) => {
        const svg = markerSvg(i + 1)
        const icon = L.divIcon({
          html: svg,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -42],
          className: '',
        })

        const name = lang === 'he' ? (stop.name_he || stop.name_en) : stop.name_en
        const mapsUrl = stop.maps_query
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.maps_query)}`
          : null

        const popup = L.popup({ className: 'hamakom-popup', offset: [0, -2] }).setContent(
          `<div style="font-family:system-ui,sans-serif;font-size:13px;color:#E8DCC8;min-width:120px">
            <span style="color:#C9A84C;font-weight:700;margin-right:6px">${i + 1}</span>${name}
            ${mapsUrl ? `<br/><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
              style="color:#C9A84C;font-size:11px;text-decoration:none;display:block;margin-top:4px">
              Open in Maps →</a>` : ''}
          </div>`
        )

        L.marker([stop.lat, stop.lng], { icon }).addTo(map).bindPopup(popup)
        bounds.push([stop.lat, stop.lng])
      })

      // invalidateSize before fitBounds so Leaflet knows the container's real dimensions
      map.invalidateSize()

      if (bounds.length >= 2) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      } else {
        map.setView(bounds[0], 14)
      }

      instanceRef.current = map
    })

    return () => {
      instanceRef.current?.remove()
      instanceRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
      <div ref={mapRef} style={{ height: 220, width: '100%', background: '#0D1117' }} />
      <style>{`
        .hamakom-popup .leaflet-popup-content-wrapper {
          background: #161B27; border: 1px solid #2A2F3E; border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5); padding: 0;
        }
        .hamakom-popup .leaflet-popup-tip { background: #161B27; }
        .hamakom-popup .leaflet-popup-content { margin: 10px 14px; }
        .leaflet-popup-close-button { color: #6B7280 !important; }
      `}</style>
    </div>
  )
}

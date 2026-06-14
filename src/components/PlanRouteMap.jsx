import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { CITY_COORDS } from '../lib/constants'
import { getDistanceKm, formatWalkTime } from '../lib/distance'

// eslint-disable-next-line react-refresh/only-export-components
export { getDistanceKm, formatWalkTime }

const ACCENT = '#C9A84C'
const BG = '#0D1117'

function stopIcon(index, isFirst) {
  return L.divIcon({
    html: `<div style="
      background: ${isFirst ? ACCENT : '#E8DCC8'};
      color: ${BG};
      border: 2px solid ${isFirst ? '#E8B84B' : '#9CA3AF'};
      border-radius: 50%;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.7);
    ">${index}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function getCoords(location) {
  if (location.lat && location.lng) return [location.lat, location.lng]
  const city = location.city
  return CITY_COORDS[city] || null
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length >= 2) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [48, 48] })
    } else if (positions.length === 1) {
      map.setView(positions[0], 14)
    }
  }, [map, positions])
  return null
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(t)
  }, [map])
  return null
}


export default function PlanRouteMap({ stops, lang }) {
  const coords = stops.map(getCoords).filter(Boolean)
  const hasCoords = coords.length === stops.length && coords.length >= 2

  const dist = hasCoords
    ? getDistanceKm(coords[0][0], coords[0][1], coords[1][0], coords[1][1])
    : null

  const distLabel = dist !== null
    ? `${dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`} · ${formatWalkTime(dist)}`
    : null

  const isHe = lang === 'he'

  if (!coords.length) return null

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={coords[0] || [31.8, 35.0]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />
        <InvalidateSize />
        <FitBounds positions={coords} />

        {coords.map((pos, i) => (
          <Marker key={i} position={pos} icon={stopIcon(i + 1, i === 0)} />
        ))}

        {coords.length >= 2 ? (
          <Polyline
            positions={coords}
            pathOptions={{ color: ACCENT, weight: 3, dashArray: '8 6', opacity: 0.85 }}
          />
        ) : null}
      </MapContainer>

      {/* Distance badge */}
      {distLabel ? (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(13,17,23,0.88)', border: '1px solid #2A2F3E',
          borderRadius: 999, padding: '5px 14px', fontSize: 12, color: '#E8DCC8',
          zIndex: 1000, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)',
          fontWeight: 500,
        }}>
          {distLabel}
        </div>
      ) : null}

      {/* Stop labels */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        display: 'flex', gap: 6, zIndex: 1000, flexWrap: 'wrap',
      }}>
        {stops.map((stop, i) => {
          const name = isHe ? stop.name_he || stop.name : stop.name
          return (
            <div key={stop.id} style={{
              background: 'rgba(13,17,23,0.88)', border: `1px solid ${i === 0 ? ACCENT : '#2A2F3E'}`,
              borderRadius: 999, padding: '4px 10px', fontSize: 11, color: i === 0 ? ACCENT : '#E8DCC8',
              backdropFilter: 'blur(4px)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: i === 0 ? ACCENT : '#E8DCC8', color: BG, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>{i + 1}</span>
              {name}
            </div>
          )
        })}
      </div>
    </div>
  )
}

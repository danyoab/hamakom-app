import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { CATEGORY_EMOJI, CITY_COORDS, getCategoryColor } from '../lib/constants'

function cityIcon(count, active) {
  return L.divIcon({
    html: `<div style="background:${active ? '#C9A84C' : '#1A2035'};color:${active ? '#0D1117' : '#E8DCC8'};border:2px solid ${active ? '#C9A84C' : '#3A4055'};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,0.6);">${count}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

const YOU_ICON = L.divIcon({
  html: `<div style="background:#4ADE80;border-radius:50%;width:14px;height:14px;border:3px solid #fff;box-shadow:0 0 0 2px #4ADE80,0 0 14px rgba(74,222,128,0.7);"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 13, { duration: 0.8 })
  }, [target, map])
  return null
}

export default function MapView({ locations, lang, tx, font, onBack, onOpenDetail }) {
  const [selectedCity, setSelectedCity] = useState(null)
  const [flyTarget, setFlyTarget]       = useState(null)
  const [userPos, setUserPos]           = useState(null)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => {}
    )
  }, [])

  const cityGroups = {}
  for (const loc of locations) {
    if (CITY_COORDS[loc.city]) {
      if (!cityGroups[loc.city]) cityGroups[loc.city] = []
      cityGroups[loc.city].push(loc)
    }
  }

  const selectCity = (city) => {
    setSelectedCity(city)
    setFlyTarget([...CITY_COORDS[city]])
  }

  const panelLocs = selectedCity ? (cityGroups[selectedCity] || []) : []
  const PANEL_H   = 280

  return (
    <div dir={tx.dir} style={{ fontFamily: font, color: '#E8DCC8' }}>
      {/* Fixed header */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: '#161B27', borderBottom: '1px solid #2A2F3E', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 2000 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          {tx.back}
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>🗺 {tx.map}</span>
        <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 'auto' }}>
          {locations.length} {tx.locations}
        </span>
      </div>

      {/* Map fills remaining viewport */}
      <div style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 0 }}>
        <MapContainer
          center={[31.8, 35.0]}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />
          <FlyTo target={flyTarget} />

          {Object.entries(cityGroups).map(([city, locs]) => (
            <Marker
              key={city}
              position={CITY_COORDS[city]}
              icon={cityIcon(locs.length, selectedCity === city)}
              eventHandlers={{ click: () => selectCity(city) }}
            />
          ))}

          {userPos && <Marker position={userPos} icon={YOU_ICON} />}
        </MapContainer>
      </div>

      {/* Bottom sheet */}
      {selectedCity && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: PANEL_H, background: '#161B27',
          borderTop: '2px solid #2A2F3E',
          display: 'flex', flexDirection: 'column',
          zIndex: 2000,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        }}>
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px', flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {selectedCity}
              <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 8 }}>
                {panelLocs.length} {lang === 'he' ? 'מקומות' : `place${panelLocs.length !== 1 ? 's' : ''}`}
              </span>
            </span>
            <button
              onClick={() => setSelectedCity(null)}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px' }}
            >
              ×
            </button>
          </div>

          {/* Scrollable location list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 10px 12px' }}>
            {panelLocs.map(loc => {
              const name = lang === 'he' ? (loc.name_he || loc.name) : loc.name
              const desc = lang === 'he' ? (loc.description_he || loc.description) : loc.description
              return (
                <div
                  key={loc.id}
                  onClick={() => onOpenDetail(loc)}
                  style={{
                    background: '#1F2937',
                    border: '1px solid #2A2F3E',
                    borderLeft: lang === 'en' ? `3px solid ${getCategoryColor(loc.category)}` : undefined,
                    borderRight: lang === 'he' ? `3px solid ${getCategoryColor(loc.category)}` : undefined,
                    borderRadius: 8,
                    padding: '9px 12px',
                    marginBottom: 6,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13 }}>{CATEGORY_EMOJI[loc.category]}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#E8DCC8' }}>{name}</span>
                    {loc.kashrus && (
                      <span style={{ fontSize: 10, color: '#4ADE80', marginLeft: 'auto' }}>✓ {loc.kashrus}</span>
                    )}
                  </div>
                  {desc && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {desc}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

import { marketOf } from '../lib/markets.js'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { getPlanMapData, getPlanNavigationUrl } from '../lib/planMap.js'

function stopIcon(number) {
  return L.divIcon({
    html: `<div style="background:${number === 1 ? 'var(--ui-accent)' : 'var(--ui-text)'};color:#fff;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:0 2px 8px #0005">${number}</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 16],
  })
}

function UpdateViewport({ data }) {
  const map = useMap()
  useEffect(() => {
    const update = () => {
      map.invalidateSize()
      if (data.markers.length > 1) map.fitBounds(data.markers.map(m => m.position), { padding: [42, 42], maxZoom: 15 })
      else map.setView(data.center, data.zoom)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map, data])
  return null
}

export default function PlanRouteMap({ stops = [], lang, planCity, travelMode = 'walking', onOpenMaps }) {
  const data = useMemo(() => getPlanMapData(stops, planCity), [stops, planCity])
  const [tileError, setTileError] = useState(false)
  const he = lang === 'he'
  const cityName = he ? stops[0]?.city_he || data.city : data.city
  const navUrl = getPlanNavigationUrl(stops, travelMode)
  const title = data.complete
    ? (he ? stops.length > 1 ? 'המסלול על המפה' : 'המקום על המפה' : stops.length > 1 ? 'Your route on the map' : 'Your place on the map')
    : data.markers.length
      ? (he ? 'המיקומים הידועים על המפה' : 'Known locations on the map')
      : data.areaKnown ? (he ? `מפת אזור ${cityName}` : `${cityName} area map`) : (he ? 'מפת האזור' : 'Area map')
  return (
    <section aria-label={title} dir={he ? 'rtl' : 'ltr'} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#fff' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #EBE2D0' }}>
        <h2 style={{ font: 'inherit', fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--ui-text)' }}>{title}</h2>
        {!data.complete && <p style={{ fontSize: 12, lineHeight: 1.45, margin: '4px 0 0', color: 'var(--ui-muted)' }}>
          {he ? 'מיקום מדויק חסר בחלק מהפרטים. פתחו במפות כדי לבדוק את המקום והכניסה.' : 'Exact pins are missing from our records. Open in Maps to check the venue and entrance.'}
        </p>}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 140, isolation: 'isolate' }}>
        <MapContainer center={data.center} zoom={data.zoom} scrollWheelZoom={false} zoomControl={false} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            eventHandlers={{ tileerror: () => setTileError(true) }} />
          <ZoomControl position="bottomright" />
          <UpdateViewport data={data} />
          {data.markers.map(({ stop, position, number }) => {
            const name = he ? stop.name_he || stop.name_en || stop.name : stop.name_en || stop.name
            return <Marker key={`${number}-${position.join(',')}`} position={position} icon={stopIcon(number)} alt={`${number}. ${name}`}>
              <Popup><strong>{number}. {name}</strong><br /><a href={getPlanNavigationUrl([stop])} target="_blank" rel="noopener noreferrer" onClick={onOpenMaps}>{he ? 'פתיחה במפות' : 'Open in Maps'}</a></Popup>
            </Marker>
          })}
          {data.route.length > 1 && <Polyline positions={data.route} pathOptions={{ color: 'var(--ui-accent)', weight: 3, dashArray: '8 6', opacity: 0.85 }} />}
        </MapContainer>
        {tileError && <div role="status" style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 1000, padding: 8, borderRadius: 8, background: '#fff', color: 'var(--ui-muted)', fontSize: 12 }}>{he ? 'המפה לא נטענה במלואה. אפשר לפתוח במפות.' : 'Some map tiles could not load. You can still open in Maps.'}</div>}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid #EBE2D0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {data.distanceKm != null && <span style={{ fontSize: 11, color: 'var(--ui-muted)' }}>{marketOf(stops[0]).id === 'ny' ? `${(data.distanceKm / 1.609344).toFixed(1)} mi` : `${data.distanceKm.toFixed(1)} km`} · {he ? 'קו אווירי' : 'Straight line'}</span>}
        {navUrl && <a href={navUrl} target="_blank" rel="noopener noreferrer" onClick={onOpenMaps} style={{ color: 'var(--ui-accent)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          {he ? stops.length > 1 ? 'ניווט לכל המסלול ↗' : 'פתיחת המקום במפות ↗' : stops.length > 1 ? 'Navigate the full route ↗' : 'Open this place in Maps ↗'}
        </a>}
        {data.route.length > 1 && <span style={{ fontSize: 11, color: 'var(--ui-muted)' }}>{he ? travelMode === 'driving' ? 'ברכב' : 'ברגל' : travelMode === 'driving' ? 'Driving' : 'Walking'}</span>}
      </div>
    </section>
  )
}

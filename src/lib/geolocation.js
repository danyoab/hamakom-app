import { Geolocation } from '@capacitor/geolocation'
import { isNativeApp } from './native'

/** Returns { lat, lng } or null if unavailable / denied. */
export async function getUserPosition() {
  if (isNativeApp()) {
    try {
      let perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        perm = await Geolocation.requestPermissions()
        if (perm.location !== 'granted') return null
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      return null
    }
  }

  if (!navigator.geolocation) return null

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  })
}

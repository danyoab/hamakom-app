import { VENUE_PHOTOS } from '../data/venuePhotos.js'
import { safeExternalUrl } from './venuePreferences.js'

export function venuePhoto(loc) {
  const curated = VENUE_PHOTOS[loc?.id]
  // A venue owner's uploaded image always takes precedence over this snapshot.
  const existing = safeExternalUrl(loc?.image_url)
  if (existing) return { src: existing }
  return curated || null
}

export function imageProps(photo, size = 'card') {
  if (!photo) return {}
  const widths = photo.widths || []
  return {
    src: photo.src,
    ...(widths.length ? {
      srcSet: widths.map(w => `${photo.base}-${w}.webp ${w}w`).join(', '),
      sizes: size === 'detail' ? '(max-width: 720px) 100vw, 900px' : size === 'stop' ? '(max-width: 720px) calc(100vw - 88px), 500px' : '(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) 45vw, 350px',
      width: photo.width,
      height: photo.height,
    } : {}),
  }
}

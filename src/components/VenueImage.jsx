import { useState } from 'react'
import { imageProps, venuePhoto } from '../lib/venueImages.js'

export default function VenueImage({ loc, alt = '', size = 'card', className, style, fallback = null }) {
  const photo = venuePhoto(loc)
  const [failedSrc, setFailedSrc] = useState(null)
  if (!photo || failedSrc === photo.src) return fallback
  return <img {...imageProps(photo, size)} alt={alt} className={className} style={style}
    loading={size === 'detail' ? 'eager' : 'lazy'} decoding="async"
    fetchPriority={size === 'detail' ? 'high' : 'auto'}
    onError={() => setFailedSrc(photo.src)} />
}

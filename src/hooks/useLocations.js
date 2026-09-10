import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLocationCatalog, normalizeLocation, publicLocation } from '../lib/venueCatalog.js'
import { enrichCatalog } from '../data/venueDetails.js'

const CACHE_KEY = 'hamakom-catalog-v3'
const EMPTY = []
function initialCatalog() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (Array.isArray(cache?.rows) && Date.now() - cache.savedAt < 7 * 86400000) return enrichCatalog(cache.rows.map(publicLocation).map(normalizeLocation))
  } catch { /* Storage can be disabled. */ }
  return null
}

export function useLocations() {
  const [cached] = useState(initialCatalog)
  const [catalog, setLocations] = useState(cached)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let liveResolved = false
    // Render the app shell first. The offline catalog must not block its JS entry.
    const fallback = cached !== null ? Promise.resolve() : import('../data/locations').then(({ SEED_LOCATIONS }) => {
      if (active && !liveResolved) setLocations(current => current ?? enrichCatalog(SEED_LOCATIONS.map(normalizeLocation)))
    }).catch(() => {
      if (active && !liveResolved) setError('Could not load offline places. Please refresh to try again.')
    })
    const timeout = setTimeout(() => controller.abort(), 6000)
    const refresh = supabase ? fetchLocationCatalog(supabase, { signal: controller.signal }).then(rows => {
      if (!active) return
      liveResolved = true
      setLocations(enrichCatalog(rows))
      setError(null)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, savedAt: Date.now() })) } catch { /* Quota / private browsing. */ }
    }) : Promise.resolve()
    refresh.catch(err => {
      if (active) setError(err.message)
    }).then(() => {
      if (!liveResolved) return fallback
    }).finally(() => {
      clearTimeout(timeout)
      if (active) setLoading(false)
    })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [cached])

  return { locations: catalog ?? EMPTY, loading, error }
}

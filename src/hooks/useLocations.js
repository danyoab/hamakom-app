import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEED_LOCATIONS } from '../data/locations'
import { fetchLocationCatalog, normalizeLocation, publicLocation } from '../lib/venueCatalog.js'
import { enrichCatalog } from '../data/venueDetails.js'

const CACHE_KEY = 'hamakom-catalog-v2'
function initialCatalog() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (Array.isArray(cache?.rows) && Date.now() - cache.savedAt < 7 * 86400000) return enrichCatalog(cache.rows.map(publicLocation).map(normalizeLocation))
  } catch { /* Storage can be disabled. */ }
  return enrichCatalog(SEED_LOCATIONS.map(normalizeLocation))
}

export function useLocations() {
  const [locations, setLocations] = useState(initialCatalog)
  const [loading, setLoading]     = useState(Boolean(supabase))
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!supabase) return

    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 12000)
    fetchLocationCatalog(supabase, { signal: controller.signal }).then(rows => {
      if (!active) return
      setLocations(enrichCatalog(rows))
      setError(null)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, savedAt: Date.now() })) } catch { /* Quota / private browsing. */ }
    }).catch(err => {
      if (active) setError(err.message)
    }).finally(() => {
      clearTimeout(timeout)
      if (active) setLoading(false)
    })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [])

  return { locations, loading, error }
}

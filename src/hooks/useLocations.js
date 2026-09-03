import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEED_LOCATIONS } from '../data/locations'

// DB rows are canonical (admin curation — kashrut, partners, images — lives
// there), but a sparse or partially-seeded database must never make the app
// show FEWER places than the bundled seed. Overlay DB rows onto the seed:
// a DB row wins for its id (or same name+city under a different id), and any
// seed entry the DB doesn't know about is kept. Deliberate removals should be
// made in src/data/locations.js too, or the entry resurfaces from the seed.
function mergeWithSeed(dbRows) {
  const dbIds = new Set(dbRows.map((row) => row.id))
  const dbNameCity = new Set(
    dbRows.map((row) => `${(row.name || '').toLowerCase()}|${(row.city || '').toLowerCase()}`)
  )
  const seedOnly = SEED_LOCATIONS.filter(
    (seed) =>
      !dbIds.has(seed.id) &&
      !dbNameCity.has(`${(seed.name || '').toLowerCase()}|${(seed.city || '').toLowerCase()}`)
  )
  if (seedOnly.length > 0) {
    console.info(`useLocations: DB returned ${dbRows.length} rows; filled ${seedOnly.length} from bundled seed`)
  }
  return [...dbRows, ...seedOnly].sort(
    (a, b) => (b.featured === true) - (a.featured === true) || (a.name || '').localeCompare(b.name || '')
  )
}

export function useLocations() {
  const [locations, setLocations] = useState(SEED_LOCATIONS)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!supabase) return

    let cancelled = false
    let retryTimer = null

    const fetchLocations = (attempt = 0) => {
      setLoading(true)
      supabase
        .from('locations')
        .select('*')
        .eq('status', 'approved')
        .order('featured', { ascending: false })
        .order('name')
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            console.error('Supabase fetch error:', error)
            setError(error.message)
            // One quiet retry — a transient blip shouldn't leave a permanent
            // error banner over perfectly good seed data
            if (attempt === 0) retryTimer = setTimeout(() => fetchLocations(1), 4000)
          } else if (data && data.length > 0) {
            setLocations(mergeWithSeed(data))
            setError(null)
          }
          setLoading(false)
        })
    }

    fetchLocations()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  return { locations, loading, error }
}

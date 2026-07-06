import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEED_LOCATIONS } from '../data/locations'

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
            // One quiet retry — transient network blips shouldn't leave a
            // permanent error banner over perfectly good seed data
            if (attempt === 0) retryTimer = setTimeout(() => fetchLocations(1), 4000)
          } else if (data && data.length > 0) {
            setLocations(data)
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

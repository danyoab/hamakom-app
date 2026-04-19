import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEED_LOCATIONS } from '../data/locations'

export function useLocations() {
  const [locations, setLocations] = useState(SEED_LOCATIONS)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!supabase) return

    setLoading(true)
    supabase
      .from('locations')
      .select('*')
      .eq('status', 'approved')
      .order('featured', { ascending: false })
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase fetch error:', error)
          setError(error.message)
        } else if (data && data.length > 0) {
          setLocations(data)
        }
        setLoading(false)
      })
  }, [])

  return { locations, loading, error }
}

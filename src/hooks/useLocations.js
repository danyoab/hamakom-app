import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEED_LOCATIONS } from '../data/locations'

export function useLocations() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    async function fetch() {
      // No Supabase configured — use seed data
      if (!supabase) {
        setLocations(SEED_LOCATIONS)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('status', 'approved')
        .order('featured', { ascending: false })
        .order('name')

      if (error) {
        console.error('Supabase fetch error:', error)
        setError(error.message)
        // Fall back to seed data so the app still works
        setLocations(SEED_LOCATIONS)
      } else {
        setLocations(data || [])
      }
      setLoading(false)
    }
    fetch()
  }, [])

  return { locations, loading, error }
}

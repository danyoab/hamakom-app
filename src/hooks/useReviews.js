import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useLocationReviews(locationId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase || !locationId) return
    setLoading(true)
    supabase
      .from('location_reviews')
      .select('id, rating, body, created_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setReviews(data || [])
        setLoading(false)
      })
  }, [locationId])

  return { reviews, loading }
}

export async function upsertReview({ locationId, userId, rating, body }) {
  if (!supabase || !userId) return { error: 'not authenticated' }
  const { error } = await supabase
    .from('location_reviews')
    .upsert(
      { location_id: locationId, user_id: userId, rating, body: body?.trim() || null },
      { onConflict: 'location_id,user_id' }
    )
  return { error: error?.message || null }
}

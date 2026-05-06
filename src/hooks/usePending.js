import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

async function geocodeQuery(mapsQuery) {
  if (!mapsQuery) return {}
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapsQuery)}&format=json&limit=1&countrycodes=il`
    const res = await fetch(url, { headers: { 'User-Agent': 'HaMakomApp/1.0' } })
    const data = await res.json()
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    // geocoding is best-effort — don't block approval on network failure
  }
  return {}
}

export function usePending() {
  const [pending, setPending]   = useState([])
  const [approved, setApproved] = useState([])
  const [loading, setLoading]   = useState(true)

  const fetchPending = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data } = await supabase
      .from('pending_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
    setPending(data || [])
    setLoading(false)
  }, [])

  const fetchApproved = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('pending_submissions')
      .select('*')
      .eq('status', 'approved')
      .order('submitted_at', { ascending: false })
      .limit(50)
    setApproved(data || [])
  }, [])

  useEffect(() => {
    fetchPending()
    fetchApproved()
  }, [fetchPending, fetchApproved])

  const approveSub = async (sub) => {
    if (!supabase) return { error: 'Supabase unavailable' }
    const coords = await geocodeQuery(sub.maps_query || `${sub.name} ${sub.city} Israel`)
    const { error: insertError } = await supabase.from('locations').insert([{
      name: sub.name,
      city: sub.city,
      category: sub.category,
      occasion: sub.occasion || ['casual'],
      date_stage: sub.date_stage || [1, 2],
      price: sub.price || 2,
      kashrus: sub.kashrus || null,
      description: sub.why || null,
      maps_query: sub.maps_query || null,
      status: 'approved',
      lat: coords.lat || null,
      lng: coords.lng || null,
    }])
    if (insertError) return { error: insertError.message }

    const { error: updateError } = await supabase
      .from('pending_submissions')
      .update({ status: 'approved' })
      .eq('id', sub.id)
    if (updateError) return { error: updateError.message }

    await fetchPending()
    await fetchApproved()
    return { error: null }
  }

  const rejectSub = async (id) => {
    if (!supabase) return { error: 'Supabase unavailable' }
    const { error } = await supabase
      .from('pending_submissions')
      .update({ status: 'rejected' })
      .eq('id', id)
    if (error) return { error: error.message }
    await fetchPending()
    return { error: null }
  }

  return { pending, approved, loading, approveSub, rejectSub }
}

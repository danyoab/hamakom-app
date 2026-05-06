import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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
    const { error: insertError } = await supabase.from('locations').insert([{
      name: sub.name,
      city: sub.city,
      category: sub.category,
      occasion: sub.occasion || ['casual'],
      date_stage: sub.date_stage || [1, 2],
      price: sub.price || 2,
      kashrus: sub.kashrus || null,
      description: sub.why || null,
      status: 'approved',
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

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
    if (!supabase) return
    // Insert into locations
    await supabase.from('locations').insert([{
      name: sub.name,
      city: sub.city,
      category: sub.category,
      occasion: ['casual'],
      date_stage: sub.date_stage || [1, 2],
      price: sub.price || 2,
      kashrus: sub.kashrus || null,
      description: sub.why || null,
      status: 'approved',
    }])
    // Mark submission approved
    await supabase
      .from('pending_submissions')
      .update({ status: 'approved' })
      .eq('id', sub.id)
    await fetchPending()
    await fetchApproved()
  }

  const rejectSub = async (id) => {
    if (!supabase) return
    await supabase
      .from('pending_submissions')
      .update({ status: 'rejected' })
      .eq('id', id)
    await fetchPending()
  }

  return { pending, approved, loading, approveSub, rejectSub }
}

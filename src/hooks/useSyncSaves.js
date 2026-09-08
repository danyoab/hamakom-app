import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveDelta } from '../lib/saveSync.js'

// A remote refresh never deletes another device's unseen saves. Cancel pending
// work on sign-out/unmount and don't sync until the initial merge is complete.
export function useSyncSaves({ authUser, savedPlanIds, setSavedPlanIds, savedPlaceIds, setSavedPlaceIds }) {
  const userId = authUser?.id || null
  const [readyFor, setReadyFor] = useState(null)
  const knownPlans = useRef([])
  const knownPlaces = useRef([])

  useEffect(() => {
    let active = true
    setReadyFor(null)
    if (!userId || !supabase) return
    Promise.all([
      supabase.from('saved_plans').select('plan_id').eq('user_id', userId),
      supabase.from('saved_places').select('location_id').eq('user_id', userId),
    ]).then(([plans, places]) => {
      if (!active || plans.error || places.error) return
      knownPlans.current = (plans.data || []).map(r => r.plan_id)
      knownPlaces.current = (places.data || []).map(r => r.location_id)
      setSavedPlanIds(local => [...new Set([...local, ...knownPlans.current])])
      setSavedPlaceIds(local => [...new Set([...local, ...knownPlaces.current])])
      setReadyFor(userId)
    }).catch(() => { /* Local saves remain available while offline. */ })
    return () => { active = false }
  }, [userId, setSavedPlanIds, setSavedPlaceIds])

  useEffect(() => {
    if (!userId || !supabase || readyFor !== userId) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        for (const [table, column, ids, known] of [
          ['saved_plans', 'plan_id', savedPlanIds, knownPlans],
          ['saved_places', 'location_id', savedPlaceIds, knownPlaces],
        ]) {
          const { data, error } = await supabase.from(table).select(column).eq('user_id', userId)
          if (!active || error || !data) return
          const delta = saveDelta(ids, data.map(r => r[column]), known.current)
          if (delta.insert.length) {
            const result = await supabase.from(table).upsert(delta.insert.map(id => ({ user_id: userId, [column]: id })), { onConflict: `user_id,${column}` })
            if (!active || result.error) return
          }
          if (delta.remove.length) {
            const result = await supabase.from(table).delete().eq('user_id', userId).in(column, delta.remove)
            if (!active || result.error) return
          }
          known.current = [...ids]
        }
      } catch { /* Retry on the next local change or sign-in. */ }
    }, 1200)
    return () => { active = false; clearTimeout(timer) }
  }, [userId, readyFor, savedPlanIds, savedPlaceIds])
}

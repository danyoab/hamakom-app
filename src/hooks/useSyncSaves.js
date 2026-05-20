import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 1200

/**
 * Syncs savedPlanIds and savedPlaceIds to Supabase when the user is signed in.
 *
 * On sign-in: fetches remote saves and merges them (union) with local state.
 * On every change to saved lists: upserts/deletes in Supabase (debounced).
 * On sign-out: local state is preserved; no remote sync.
 */
export function useSyncSaves({ authUser, savedPlanIds, setSavedPlanIds, savedPlaceIds, setSavedPlaceIds }) {
  const prevUserIdRef = useRef(null)
  const planSyncTimerRef = useRef(null)
  const placeSyncTimerRef = useRef(null)
  const isMerging = useRef(false)

  // On sign-in: fetch remote and merge with local (union)
  useEffect(() => {
    if (!authUser || !supabase) return
    if (prevUserIdRef.current === authUser.id) return
    prevUserIdRef.current = authUser.id

    isMerging.current = true
    Promise.all([
      supabase.from('saved_plans').select('plan_id').eq('user_id', authUser.id),
      supabase.from('saved_places').select('location_id').eq('user_id', authUser.id),
    ]).then(([plansRes, placesRes]) => {
      if (!plansRes.error && plansRes.data?.length) {
        const remotePlanIds = plansRes.data.map((r) => r.plan_id)
        setSavedPlanIds((local) => {
          const merged = [...new Set([...local, ...remotePlanIds])]
          return merged.length === local.length && merged.every((id) => local.includes(id)) ? local : merged
        })
      }
      if (!placesRes.error && placesRes.data?.length) {
        const remotePlaceIds = placesRes.data.map((r) => r.location_id)
        setSavedPlaceIds((local) => {
          const merged = [...new Set([...local, ...remotePlaceIds])]
          return merged.length === local.length && merged.every((id) => local.includes(id)) ? local : merged
        })
      }
      isMerging.current = false
    })
  }, [authUser, setSavedPlanIds, setSavedPlaceIds])

  // On sign-out: reset tracked user
  useEffect(() => {
    if (!authUser) {
      prevUserIdRef.current = null
      isMerging.current = false
    }
  }, [authUser])

  // Sync plan saves to Supabase (debounced)
  useEffect(() => {
    if (!authUser || !supabase || isMerging.current) return

    clearTimeout(planSyncTimerRef.current)
    planSyncTimerRef.current = setTimeout(async () => {
      const userId = authUser.id

      // Fetch current remote state
      const { data: remote } = await supabase.from('saved_plans').select('plan_id').eq('user_id', userId)
      if (!remote) return

      const remoteSet = new Set(remote.map((r) => r.plan_id))
      const localSet = new Set(savedPlanIds)

      // Insert newly saved
      const toInsert = savedPlanIds.filter((id) => !remoteSet.has(id))
      if (toInsert.length) {
        await supabase.from('saved_plans').upsert(
          toInsert.map((plan_id) => ({ user_id: userId, plan_id })),
          { onConflict: 'user_id,plan_id' }
        )
      }

      // Delete removed
      const toDelete = [...remoteSet].filter((id) => !localSet.has(id))
      if (toDelete.length) {
        await supabase.from('saved_plans').delete().eq('user_id', userId).in('plan_id', toDelete)
      }
    }, DEBOUNCE_MS)
  }, [authUser, savedPlanIds])

  // Sync place saves to Supabase (debounced)
  useEffect(() => {
    if (!authUser || !supabase || isMerging.current) return

    clearTimeout(placeSyncTimerRef.current)
    placeSyncTimerRef.current = setTimeout(async () => {
      const userId = authUser.id

      const { data: remote } = await supabase.from('saved_places').select('location_id').eq('user_id', userId)
      if (!remote) return

      const remoteSet = new Set(remote.map((r) => r.location_id))
      const localSet = new Set(savedPlaceIds)

      const toInsert = savedPlaceIds.filter((id) => !remoteSet.has(id))
      if (toInsert.length) {
        await supabase.from('saved_places').upsert(
          toInsert.map((location_id) => ({ user_id: userId, location_id })),
          { onConflict: 'user_id,location_id' }
        )
      }

      const toDelete = [...remoteSet].filter((id) => !localSet.has(id))
      if (toDelete.length) {
        await supabase.from('saved_places').delete().eq('user_id', userId).in('location_id', toDelete)
      }
    }, DEBOUNCE_MS)
  }, [authUser, savedPlaceIds])
}

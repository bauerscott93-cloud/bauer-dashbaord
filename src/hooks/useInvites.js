import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/** Pending spouse/household invites for the current household. */
export function useInvites(householdId) {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('household_invites')
      .select('*')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
    setInvites(data ?? [])
    setError(queryError ?? null)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    reload()
  }, [reload])

  const invite = useCallback(
    async (email, displayName) => {
      const { error: insertError } = await supabase.from('household_invites').insert({
        household_id: householdId,
        email: email.trim().toLowerCase(),
        display_name: displayName?.trim() || null,
      })
      if (insertError) throw insertError
      await reload()
    },
    [householdId, reload],
  )

  const revoke = useCallback(
    async (id) => {
      const { error: deleteError } = await supabase
        .from('household_invites')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (deleteError) throw deleteError
      await reload()
    },
    [reload],
  )

  return { invites, loading, error, invite, revoke, reload }
}

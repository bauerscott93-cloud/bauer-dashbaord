import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * The people in the household — used for an item's "owner". These are plain
 * records, not logins: everyone shares one password.
 */
export function useMembers(householdId) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .order('created_at')
    setMembers(data ?? [])
    setError(queryError ?? null)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    reload()
  }, [reload])

  const add = useCallback(
    async (displayName) => {
      const { error: insertError } = await supabase.from('household_members').insert({
        household_id: householdId,
        display_name: displayName.trim(),
        role: 'member',
      })
      if (insertError) throw insertError
      await reload()
    },
    [householdId, reload],
  )

  const rename = useCallback(
    async (id, displayName) => {
      const { error: updateError } = await supabase
        .from('household_members')
        .update({ display_name: displayName.trim() })
        .eq('id', id)
      if (updateError) throw updateError
      await reload()
    },
    [reload],
  )

  // Soft delete, so anything already pointing at this person keeps its label.
  const remove = useCallback(
    async (id) => {
      const { error: deleteError } = await supabase
        .from('household_members')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (deleteError) throw deleteError
      await reload()
    },
    [reload],
  )

  return { members, loading, error, add, rename, remove, reload }
}

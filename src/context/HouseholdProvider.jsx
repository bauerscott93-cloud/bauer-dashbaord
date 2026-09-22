import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthProvider.jsx'

const HouseholdContext = createContext(null)

/**
 * Resolves the shared account to its household. On a first sign-in the
 * bootstrap_household() RPC creates the household, links this login to it,
 * and fills it with the starter items.
 */
export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const [householdId, setHouseholdId] = useState(null)
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) {
      setHouseholdId(null)
      setHousehold(null)
      setMembers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: id, error: rpcError } = await supabase.rpc('bootstrap_household')
      if (rpcError) throw rpcError

      const [householdResult, membersResult] = await Promise.all([
        supabase.from('households').select('*').eq('id', id).single(),
        supabase
          .from('household_members')
          .select('*')
          .eq('household_id', id)
          .is('deleted_at', null)
          .order('created_at'),
      ])
      if (householdResult.error) throw householdResult.error
      if (membersResult.error) throw membersResult.error

      setHouseholdId(id)
      setHousehold(householdResult.data)
      setMembers(membersResult.data ?? [])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo(
    () => ({ householdId, household, members, loading, error, reload: load }),
    [householdId, household, members, loading, error, load],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>')
  return ctx
}

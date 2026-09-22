import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/medicalApi.js'
import { triageBills, summarize } from '../lib/triage.js'

/**
 * Loads the whole medical module for a household in one pass.
 *
 * Everything loads together on purpose: the duplicate check has to compare a
 * bill against every other bill, so triage can't run on a page at a time. A
 * household's bills are a small dataset — this stays cheap.
 */
export function useMedicalData(householdId) {
  const [raw, setRaw] = useState({
    patients: [], providers: [], plans: [], bills: [], eobs: [], links: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!householdId) return
    setError(null)
    try {
      setRaw(await api.fetchMedicalData(householdId))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  // --- derived ------------------------------------------------------------
  const eobsById = useMemo(
    () => new Map(raw.eobs.map((eob) => [eob.id, eob])),
    [raw.eobs],
  )

  /** bill id -> its linked EOBs */
  const eobsByBillId = useMemo(() => {
    const map = new Map()
    for (const link of raw.links) {
      const eob = eobsById.get(link.eob_id)
      if (!eob) continue
      if (!map.has(link.bill_id)) map.set(link.bill_id, [])
      map.get(link.bill_id).push(eob)
    }
    return map
  }, [raw.links, eobsById])

  const bills = useMemo(
    () =>
      triageBills(raw.bills, {
        providers: raw.providers,
        // triage only needs one EOB per bill; the drawer shows all of them.
        eobsByBillId: new Map(
          [...eobsByBillId].map(([billId, list]) => [billId, list[0]]),
        ),
      }),
    [raw.bills, raw.providers, eobsByBillId],
  )

  const summary = useMemo(() => summarize(bills), [bills])

  const patientsById = useMemo(
    () => new Map(raw.patients.map((p) => [p.id, p])),
    [raw.patients],
  )
  const providersById = useMemo(
    () => new Map(raw.providers.map((p) => [p.id, p])),
    [raw.providers],
  )
  const plansById = useMemo(() => new Map(raw.plans.map((p) => [p.id, p])), [raw.plans])

  /**
   * Wrap a mutation so the caller gets a promise that resolves after the
   * refetch — components can await it and know the UI is settled.
   */
  const mutate = useCallback(
    (fn) =>
      async (...args) => {
        const result = await fn(...args)
        await reload()
        return result
      },
    [reload],
  )

  const actions = useMemo(
    () => ({
      createBill: mutate((values) => api.createBill(householdId, values)),
      updateBill: mutate(api.updateBill),
      deleteBill: mutate(api.softDeleteBill),
      restoreBill: mutate(api.restoreBill),
      setBillAction: mutate(api.setBillAction),
      markPaid: mutate((bill, payment) => api.markBillPaid(householdId, bill, payment)),

      logActivity: mutate((billId, values) => api.logActivity(householdId, billId, values)),

      createEob: mutate((values) => api.createEob(householdId, values)),
      updateEob: mutate(api.updateEob),
      deleteEob: mutate(api.softDeleteEob),
      linkEob: mutate((billId, eob) => api.linkEobToBill(householdId, billId, eob)),
      unlinkEob: mutate(api.unlinkEobFromBill),

      createPatient: mutate((name) => api.createPatient(householdId, name)),
      updatePatient: mutate(api.updatePatient),
      deletePatient: mutate(api.softDeletePatient),

      createProvider: mutate((values) => api.createProvider(householdId, values)),
      updateProvider: mutate(api.updateProvider),
      deleteProvider: mutate(api.softDeleteProvider),

      createPlan: mutate((values) => api.createPlan(householdId, values)),
      updatePlan: mutate(api.updatePlan),
      deletePlan: mutate(api.softDeletePlan),
    }),
    [householdId, mutate],
  )

  return {
    loading,
    error,
    reload,
    bills,
    summary,
    patients: raw.patients,
    providers: raw.providers,
    plans: raw.plans,
    eobs: raw.eobs,
    eobsByBillId,
    patientsById,
    providersById,
    plansById,
    actions,
  }
}

/** The activity log for one bill, loaded when a drawer opens. */
export function useBillActivity(billId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!billId) {
      setEntries([])
      return
    }
    setLoading(true)
    try {
      setEntries(await api.fetchActivity(billId))
    } finally {
      setLoading(false)
    }
  }, [billId])

  useEffect(() => {
    reload()
  }, [reload])

  return { entries, loading, reload }
}

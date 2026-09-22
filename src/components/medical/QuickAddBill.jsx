import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button.jsx'
import { Card, CardHeader } from '../ui/Card.jsx'
import { INSURANCE_STATUSES } from '../../lib/constants.js'
import { isValidISO, todayISO } from '../../lib/dates.js'
import { findByName } from '../../lib/medicalApi.js'

/**
 * Built for sitting down with a stack of paper bills: after saving, the form
 * clears but keeps provider and patient selected, and focus returns to the
 * amount, so the next bill from the same provider is three keystrokes away.
 */
const BLANK = {
  date_of_service: '',
  statement_date: '',
  due_date: '',
  amount_billed: '',
  insurance_status: 'not_submitted',
  account_number_on_bill: '',
  claim_number: '',
  notes: '',
}

export function QuickAddBill({ patients, providers, plans, actions, onSaved }) {
  const [providerName, setProviderName] = useState('')
  const [patientName, setPatientName] = useState('')
  const [planId, setPlanId] = useState('')
  const [values, setValues] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [savedCount, setSavedCount] = useState(0)
  const amountRef = useRef(null)

  // Default to the newest plan so it doesn't have to be picked every time.
  useEffect(() => {
    if (!planId && plans.length > 0) setPlanId(plans[0].id)
  }, [plans, planId])

  const set = (patch) => setValues((v) => ({ ...v, ...patch }))

  function validate() {
    if (!providerName.trim()) return 'Provider is required.'
    if (!values.amount_billed || Number.isNaN(Number(values.amount_billed))) {
      return 'Amount billed must be a number.'
    }
    for (const [field, label] of [
      ['date_of_service', 'Date of service'],
      ['statement_date', 'Statement date'],
      ['due_date', 'Due date'],
    ]) {
      if (values[field] && !isValidISO(values[field])) return `${label} isn’t a real date.`
    }
    return null
  }

  async function onSubmit(event) {
    event.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    setError(null)
    try {
      // Match existing names case-insensitively so "scripps clinic" doesn't
      // create a second Scripps Clinic.
      let provider = findByName(providers, providerName)
      if (!provider) provider = await actions.createProvider({ name: providerName.trim() })

      let patient = patientName.trim() ? findByName(patients, patientName, 'full_name') : null
      if (patientName.trim() && !patient) patient = await actions.createPatient(patientName)

      await actions.createBill({
        provider_id: provider.id,
        patient_id: patient?.id ?? null,
        insurance_plan_id: planId || null,
        date_of_service: values.date_of_service || null,
        statement_date: values.statement_date || null,
        due_date: values.due_date || null,
        amount_billed: Number(values.amount_billed),
        insurance_status: values.insurance_status,
        account_number_on_bill: values.account_number_on_bill.trim() || null,
        claim_number: values.claim_number.trim() || null,
        notes: values.notes.trim() || null,
      })

      // Keep provider, patient and plan; clear the rest.
      setValues(BLANK)
      setSavedCount((n) => n + 1)
      amountRef.current?.focus()
      onSaved?.()
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Quick add"
        subtitle="Provider and patient stay selected so you can work through a stack."
        action={
          savedCount > 0 ? (
            <span className="shrink-0 text-xs text-teal-600 dark:text-teal-400">
              {savedCount} added
            </span>
          ) : null
        }
      />
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="qa-provider" className="hh-label">Provider *</label>
            <input
              id="qa-provider" list="qa-providers" required value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="Scripps Clinic" className="hh-input mt-1"
            />
            <datalist id="qa-providers">
              {providers.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>
          <div>
            <label htmlFor="qa-patient" className="hh-label">Patient</label>
            <input
              id="qa-patient" list="qa-patients" value={patientName}
              onChange={(e) => setPatientName(e.target.value)} className="hh-input mt-1"
            />
            <datalist id="qa-patients">
              {patients.map((p) => <option key={p.id} value={p.full_name} />)}
            </datalist>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="qa-amount" className="hh-label">Amount billed *</label>
            <input
              id="qa-amount" ref={amountRef} required inputMode="decimal" type="number"
              step="0.01" min="0" value={values.amount_billed}
              onChange={(e) => set({ amount_billed: e.target.value })}
              placeholder="0.00" className="hh-input mt-1"
            />
          </div>
          <div>
            <label htmlFor="qa-dos" className="hh-label">Date of service</label>
            <input id="qa-dos" type="date" max={todayISO()} value={values.date_of_service}
                   onChange={(e) => set({ date_of_service: e.target.value })} className="hh-input mt-1" />
          </div>
          <div>
            <label htmlFor="qa-due" className="hh-label">Due date</label>
            <input id="qa-due" type="date" value={values.due_date}
                   onChange={(e) => set({ due_date: e.target.value })} className="hh-input mt-1" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="qa-status" className="hh-label">Insurance</label>
            <select id="qa-status" value={values.insurance_status}
                    onChange={(e) => set({ insurance_status: e.target.value })} className="hh-input mt-1">
              {INSURANCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="qa-statement" className="hh-label">Statement date</label>
            <input id="qa-statement" type="date" value={values.statement_date}
                   onChange={(e) => set({ statement_date: e.target.value })} className="hh-input mt-1" />
          </div>
          <div>
            <label htmlFor="qa-plan" className="hh-label">Plan</label>
            <select id="qa-plan" value={planId} onChange={(e) => setPlanId(e.target.value)}
                    className="hh-input mt-1">
              <option value="">None</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.plan_year}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="qa-acct" className="hh-label">Account ref on the bill</label>
            <input id="qa-acct" value={values.account_number_on_bill}
                   onChange={(e) => set({ account_number_on_bill: e.target.value })}
                   placeholder="acct ending 5510" className="hh-input mt-1" />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Last few digits only — never the full number.
            </p>
          </div>
          <div>
            <label htmlFor="qa-claim" className="hh-label">Claim number</label>
            <input id="qa-claim" value={values.claim_number}
                   onChange={(e) => set({ claim_number: e.target.value })} className="hh-input mt-1" />
          </div>
        </div>

        <div>
          <label htmlFor="qa-notes" className="hh-label">Notes</label>
          <textarea id="qa-notes" rows={2} value={values.notes}
                    onChange={(e) => set({ notes: e.target.value })} className="hh-input mt-1" />
        </div>

        {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save and add another'}</Button>
          <button type="button"
                  onClick={() => { setValues(BLANK); setProviderName(''); setPatientName(''); setError(null) }}
                  className="text-xs text-slate-500 underline dark:text-slate-400">
            Clear everything
          </button>
        </div>
      </form>
    </Card>
  )
}

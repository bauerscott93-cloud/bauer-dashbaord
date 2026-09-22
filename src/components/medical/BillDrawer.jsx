import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn.js'
import { money } from '../../lib/format.js'
import { formatDate, relativeDay, todayISO } from '../../lib/dates.js'
import {
  BILL_ACTIONS, INSURANCE_STATUSES, INSURANCE_STATUS_LABELS, REIMBURSEMENT_STATUSES,
} from '../../lib/constants.js'
import { useBillActivity } from '../../hooks/useMedicalData.js'
import { Button } from '../ui/Button.jsx'
import { ActionBadge, FlagBadges, Badge, CollectionsBadge } from './Badges.jsx'

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm">{children ?? '—'}</dd>
    </div>
  )
}

/** Billed vs allowed vs insurance paid vs what we owe, side by side. */
function EobComparison({ bill, eobs }) {
  if (!eobs || eobs.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No EOB linked. Until one is, the statement amount is all we have to go on.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {eobs.map((eob) => {
        const owed = Number(eob.patient_responsibility ?? 0)
        const billed = Number(bill.amount_billed ?? 0)
        const gap = billed - owed

        return (
          <div key={eob.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              <p className="text-xs font-medium">
                Claim {eob.claim_number || '(no number)'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Processed {formatDate(eob.processed_date)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4 dark:bg-slate-800">
              {[
                ['Provider billed', eob.amount_billed],
                ['Plan allowed', eob.allowed_amount],
                ['Insurance paid', eob.insurance_paid],
                ['You owe', eob.patient_responsibility],
              ].map(([label, value], i) => (
                <div key={label} className="bg-white px-3 py-2 dark:bg-slate-900">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                  <p className={cn('mt-0.5 text-sm font-semibold tabular-nums',
                    i === 3 && 'text-teal-700 dark:text-teal-400')}>
                    {money(value)}
                  </p>
                </div>
              ))}
            </div>
            {gap > 0.01 && (
              <p className="border-t border-slate-200 px-3 py-2 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-400">
                The statement asks for {money(billed)} but this EOB says you owe {money(owed)} —
                a {money(gap)} gap. Ask the provider for a corrected statement before paying.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActivityLog({ billId, householdActions, onLogged }) {
  const { entries, loading, reload } = useBillActivity(billId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    activity_type: 'call', occurred_on: todayISO(), spoke_with: '', reference_number: '',
    outcome: '', body: '',
  })
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await householdActions.logActivity(billId, {
        ...form,
        spoke_with: form.spoke_with.trim() || null,
        reference_number: form.reference_number.trim() || null,
        outcome: form.outcome.trim() || null,
        body: form.body.trim() || null,
      })
      setForm((f) => ({ ...f, spoke_with: '', reference_number: '', outcome: '', body: '' }))
      setOpen(false)
      await reload()
      onLogged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {!open && (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Log a call</Button>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="hh-label" htmlFor="act-type">Type</label>
              <select id="act-type" value={form.activity_type} className="hh-input mt-1"
                      onChange={(e) => setForm({ ...form, activity_type: e.target.value })}>
                <option value="call">Call</option>
                <option value="note">Note</option>
                <option value="status_change">Status change</option>
              </select>
            </div>
            <div>
              <label className="hh-label" htmlFor="act-date">Date</label>
              <input id="act-date" type="date" value={form.occurred_on} className="hh-input mt-1"
                     onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} />
            </div>
            <div>
              <label className="hh-label" htmlFor="act-who">Spoke with</label>
              <input id="act-who" value={form.spoke_with} className="hh-input mt-1"
                     onChange={(e) => setForm({ ...form, spoke_with: e.target.value })} />
            </div>
            <div>
              <label className="hh-label" htmlFor="act-ref">Reference number</label>
              <input id="act-ref" value={form.reference_number} className="hh-input mt-1"
                     onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="hh-label" htmlFor="act-outcome">Outcome</label>
            <input id="act-outcome" value={form.outcome} className="hh-input mt-1"
                   placeholder="They said they'd re-issue the statement"
                   onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
          </div>
          <div>
            <label className="hh-label" htmlFor="act-body">Notes</label>
            <textarea id="act-body" rows={2} value={form.body} className="hh-input mt-1"
                      onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nothing logged yet. Record calls here so you have dates and reference numbers later.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Badge tone="slate">{entry.activity_type.replace('_', ' ')}</Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(entry.occurred_on)}
                </span>
              </div>
              {entry.outcome && <p className="mt-1.5 font-medium">{entry.outcome}</p>}
              {entry.body && <p className="mt-1 text-slate-600 dark:text-slate-400">{entry.body}</p>}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {entry.spoke_with && <>Spoke with {entry.spoke_with}</>}
                {entry.spoke_with && entry.reference_number && ' · '}
                {entry.reference_number && <>Ref {entry.reference_number}</>}
                {entry.amount != null && <> · {money(entry.amount)}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function BillDrawer({ bill, eobs, provider, patient, plan, allEobs, actions, onClose }) {
  const [tab, setTab] = useState('details')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payingOpen, setPayingOpen] = useState(false)
  const [linkingOpen, setLinkingOpen] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUp, setFollowUp] = useState(bill?.follow_up_date ?? todayISO())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTab('details')
    setConfirmDelete(false)
    setPayingOpen(false)
    setLinkingOpen(false)
    setFollowUpOpen(false)
    setPayAmount(bill ? String(Number(bill.balance || 0).toFixed(2)) : '')
    setFollowUp(bill?.follow_up_date ?? todayISO())
  }, [bill])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!bill) return null

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Bill details"
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl dark:bg-slate-900"
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{provider?.name ?? 'Unknown provider'}</h2>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {patient?.full_name ?? 'No patient'}
                {bill.date_of_service && <> · service {formatDate(bill.date_of_service)}</>}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close"
                    className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              ✕
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ActionBadge action={bill.effectiveAction} suggested={!bill.action} />
            <CollectionsBadge bill={bill} />
            <FlagBadges flags={bill.flags} />
            <span className="ml-auto text-lg font-semibold tabular-nums">{money(bill.balance)}</span>
          </div>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {bill.action_reason || bill.suggestion.reason}
          </p>
          {bill.isOverridden && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Suggested: {bill.suggestion.reason}
            </p>
          )}

          <nav className="mt-3 flex gap-1">
            {[['details', 'Details'], ['eob', 'EOB'], ['activity', 'Activity']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                      className={cn('rounded-lg px-3 py-1.5 text-sm font-medium',
                        tab === key
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                          : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50')}>
                {label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 space-y-4 p-4">
          {/* quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setPayingOpen((v) => !v)}>Mark paid</Button>
            <Button size="sm" variant="secondary" onClick={() => setLinkingOpen((v) => !v)}>Link EOB</Button>
            <Button size="sm" variant="secondary" onClick={() => setFollowUpOpen((v) => !v)}>Set follow-up</Button>
          </div>

          {payingOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  await actions.markPaid(bill, { amount: Number(payAmount), paidOn: todayISO() })
                  setPayingOpen(false)
                  onClose()
                })
              }}
              className="flex items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex-1">
                <label htmlFor="pay-amount" className="hh-label">Amount paid</label>
                <input id="pay-amount" type="number" step="0.01" min="0" value={payAmount}
                       onChange={(e) => setPayAmount(e.target.value)} className="hh-input mt-1" />
              </div>
              <Button size="sm" type="submit" disabled={busy}>Record</Button>
            </form>
          )}

          {linkingOpen && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="hh-label">Link an EOB</p>
              {allEobs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No EOBs recorded yet. Add one under the EOBs tab first.
                </p>
              ) : (
                <ul className="space-y-1">
                  {allEobs.map((eob) => (
                    <li key={eob.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">
                        {eob.claim_number || 'No claim #'} · {formatDate(eob.date_of_service)} ·{' '}
                        you owe {money(eob.patient_responsibility)}
                      </span>
                      <Button size="sm" variant="secondary" disabled={busy}
                              onClick={() => run(async () => {
                                await actions.linkEob(bill.id, eob)
                                setLinkingOpen(false)
                              })}>
                        Link
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Linking copies the EOB’s patient responsibility onto this bill and marks it processed.
              </p>
            </div>
          )}

          {followUpOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  await actions.updateBill(bill.id, { follow_up_date: followUp || null })
                  setFollowUpOpen(false)
                })
              }}
              className="flex items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex-1">
                <label htmlFor="follow-up" className="hh-label">Follow up on</label>
                <input id="follow-up" type="date" value={followUp}
                       onChange={(e) => setFollowUp(e.target.value)} className="hh-input mt-1" />
              </div>
              <Button size="sm" type="submit" disabled={busy}>Save</Button>
            </form>
          )}

          {tab === 'details' && (
            <>
              <div>
                <label htmlFor="drawer-action" className="hh-label">Action</label>
                <select
                  id="drawer-action" value={bill.effectiveAction} className="hh-input mt-1"
                  onChange={(e) => run(() => actions.setBillAction(bill.id, e.target.value))}
                >
                  {BILL_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                {bill.isOverridden && (
                  <button
                    onClick={() => run(() => actions.setBillAction(bill.id, null, null))}
                    className="mt-1 text-xs text-slate-500 underline dark:text-slate-400"
                  >
                    Go back to the suggested action
                  </button>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <Field label="Amount billed">{money(bill.amount_billed)}</Field>
                <Field label="Amount paid">{money(bill.amount_paid)}</Field>
                <Field label="Per EOB you owe">
                  {bill.patient_responsibility_per_eob == null ? '—' : money(bill.patient_responsibility_per_eob)}
                </Field>
                <Field label="Balance">{money(bill.balance)}</Field>
                <Field label="Statement date">{formatDate(bill.statement_date)}</Field>
                <Field label="Due date">
                  {bill.due_date ? <>{formatDate(bill.due_date)} <span className="text-xs text-slate-500">({relativeDay(bill.due_date)})</span></> : '—'}
                </Field>
                <Field label="Insurance">{INSURANCE_STATUS_LABELS[bill.insurance_status]}</Field>
                <Field label="EOB received">{bill.eob_received ? 'Yes' : 'No'}</Field>
                <Field label="Claim number">{bill.claim_number}</Field>
                <Field label="Account ref">{bill.account_number_on_bill}</Field>
                <Field label="Plan">{plan ? `${plan.name} · ${plan.plan_year}` : '—'}</Field>
                <Field label="Follow up">{formatDate(bill.follow_up_date)}</Field>
                <Field label="Collection agency">{bill.collector_name}</Field>
                <Field label="Their reference">{bill.collector_reference}</Field>
                <Field label="HSA/FSA eligible">{bill.hsa_fsa_eligible ? 'Yes' : 'No'}</Field>
                <Field label="Reimbursement">
                  {REIMBURSEMENT_STATUSES.find((r) => r.value === bill.reimbursement_status)?.label}
                </Field>
              </dl>

              {bill.notes && (
                <div>
                  <p className="hh-label">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{bill.notes}</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="drawer-insurance" className="hh-label">Change insurance status</label>
                  <select id="drawer-insurance" value={bill.insurance_status} className="hh-input mt-1"
                          onChange={(e) => run(() => actions.updateBill(bill.id, { insurance_status: e.target.value }))}>
                    {INSURANCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="drawer-reimb" className="hh-label">Reimbursement</label>
                  <select id="drawer-reimb" value={bill.reimbursement_status} className="hh-input mt-1"
                          onChange={(e) => run(() => actions.updateBill(bill.id, { reimbursement_status: e.target.value }))}>
                    {REIMBURSEMENT_STATUSES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                {confirmDelete ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Delete this bill? You can restore it for 30 days.
                    </span>
                    <Button size="sm" variant="danger" disabled={busy}
                            onClick={() => run(async () => { await actions.deleteBill(bill.id); onClose() })}>
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                    Delete bill
                  </Button>
                )}
              </div>
            </>
          )}

          {tab === 'eob' && <EobComparison bill={bill} eobs={eobs} />}

          {tab === 'activity' && (
            <ActivityLog billId={bill.id} householdActions={actions} />
          )}
        </div>
      </aside>
    </div>
  )
}

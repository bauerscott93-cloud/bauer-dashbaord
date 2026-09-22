import { useCallback, useEffect, useState } from 'react'
import { cn } from '../lib/cn.js'
import { useHousehold } from '../context/HouseholdProvider.jsx'
import { useMedicalData } from '../hooks/useMedicalData.js'
import { Button } from '../components/ui/Button.jsx'
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx'
import { Card } from '../components/ui/Card.jsx'
import { SummaryBar } from '../components/medical/SummaryBar.jsx'
import { TriageBoard } from '../components/medical/TriageBoard.jsx'
import { BillsTable } from '../components/medical/BillsTable.jsx'
import { BillDrawer } from '../components/medical/BillDrawer.jsx'
import { QuickAddBill } from '../components/medical/QuickAddBill.jsx'

const TABS = [
  { key: 'board', label: 'Triage board' },
  { key: 'table', label: 'Table' },
  { key: 'add',   label: 'Quick add' },
]

export default function MedicalBills() {
  const { householdId } = useHousehold()
  const data = useMedicalData(householdId)
  const [tab, setTab] = useState('board')
  const [openBillId, setOpenBillId] = useState(null)

  const openBill = data.bills.find((b) => b.id === openBillId) ?? null

  // `n` opens quick add on desktop, as long as you're not typing in a field.
  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
      const el = event.target
      if (el instanceof HTMLElement &&
          (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (openBillId) return
      event.preventDefault()
      setTab('add')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openBillId])

  const setAction = useCallback(
    (bill, action) => data.actions.setBillAction(bill.id, action),
    [data.actions],
  )

  if (data.loading) return <Spinner label="Loading medical bills…" />
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />

  const hasBills = data.bills.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Medical Bills</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            What to do about each bill, and why.
          </p>
        </div>
        <Button onClick={() => setTab('add')}>Add a bill</Button>
      </div>

      <SummaryBar summary={data.summary} plans={data.plans} />

      <nav className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab === t.key
                ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'board' && (
        hasBills ? (
          <>
            <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
              Drag a card to change its action, or use the menu on the card. A ◇ marks an action
              the rules suggested rather than one you set.
            </p>
            <TriageBoard
              bills={data.bills}
              providersById={data.providersById}
              patientsById={data.patientsById}
              onOpen={(bill) => setOpenBillId(bill.id)}
              onSetAction={setAction}
            />
          </>
        ) : (
          <Card>
            <EmptyState
              title="No bills yet"
              hint="Add one by hand, or import a stack from CSV once that lands."
              action={<Button onClick={() => setTab('add')}>Add a bill</Button>}
            />
          </Card>
        )
      )}

      {tab === 'table' && (
        <BillsTable
          bills={data.bills}
          providersById={data.providersById}
          patientsById={data.patientsById}
          onOpen={(bill) => setOpenBillId(bill.id)}
        />
      )}

      {tab === 'add' && (
        <QuickAddBill
          patients={data.patients}
          providers={data.providers}
          plans={data.plans}
          actions={data.actions}
        />
      )}

      <BillDrawer
        bill={openBill}
        eobs={openBill ? data.eobsByBillId.get(openBill.id) ?? [] : []}
        allEobs={data.eobs}
        provider={openBill ? data.providersById.get(openBill.provider_id) : null}
        patient={openBill ? data.patientsById.get(openBill.patient_id) : null}
        plan={openBill ? data.plansById.get(openBill.insurance_plan_id) : null}
        actions={data.actions}
        onClose={() => setOpenBillId(null)}
      />
    </div>
  )
}

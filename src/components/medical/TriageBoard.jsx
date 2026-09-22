import { useState } from 'react'
import { cn } from '../../lib/cn.js'
import { money } from '../../lib/format.js'
import { formatDate, formatDateShort, relativeDay } from '../../lib/dates.js'
import { TRIAGE_COLUMNS, COLUMN_DEFAULT_ACTION, columnForAction } from '../../lib/triage.js'
import { BILL_ACTIONS } from '../../lib/constants.js'
import { FlagBadges, CollectionsBadge } from './Badges.jsx'

function BillCard({ bill, providerName, patientName, onOpen, onMove, dragging, onDragStart, onDragEnd }) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', bill.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(bill.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(bill)}
      className={cn(
        'w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm',
        'hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
        dragging && 'opacity-40',
        bill.flags.overdue && 'border-l-4 border-l-rose-500',
        !bill.flags.overdue && bill.flags.urgent && 'border-l-4 border-l-amber-500',
      )}
    >
      {/* The provider name is how you recognise the bill, and real ones are
          long ("Valley Medical Group - Pediatric Specialty"), so it gets the
          full width of the card and the amount drops to the line below. */}
      <p className="text-sm font-medium leading-snug [overflow-wrap:anywhere] line-clamp-2">
        {providerName}
      </p>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
          {patientName}
          {bill.date_of_service && <> · {formatDateShort(bill.date_of_service)}</>}
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums">{money(bill.balance)}</p>
      </div>

      {bill.due_date && (
        <p
          className={cn(
            'mt-1 text-xs',
            bill.flags.overdue
              ? 'font-medium text-rose-600 dark:text-rose-400'
              : bill.flags.urgent
                ? 'font-medium text-amber-600 dark:text-amber-400'
                : 'text-slate-500 dark:text-slate-400',
          )}
        >
          Due {formatDate(bill.due_date)} · {relativeDay(bill.due_date)}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <CollectionsBadge bill={bill} />
        <FlagBadges flags={bill.flags} />
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
        {bill.action_reason || bill.suggestion.reason}
      </p>

      {bill.isOverridden && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          You overrode the suggestion
        </p>
      )}

      {/* Touch devices can't drag a card, so every card also has a menu. */}
      <select
        aria-label={`Move ${providerName} bill to another column`}
        value={bill.effectiveAction}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation()
          onMove(bill, e.target.value)
        }}
        className="mt-2 w-full rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
      >
        {BILL_ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>
    </article>
  )
}

export function TriageBoard({ bills, providersById, patientsById, onOpen, onSetAction }) {
  const [draggingId, setDraggingId] = useState(null)
  const [overColumn, setOverColumn] = useState(null)

  const byColumn = Object.fromEntries(TRIAGE_COLUMNS.map((c) => [c.key, []]))
  for (const bill of bills) {
    byColumn[columnForAction(bill.effectiveAction)].push(bill)
  }

  function drop(columnKey) {
    const bill = bills.find((b) => b.id === draggingId)
    setDraggingId(null)
    setOverColumn(null)
    if (!bill) return
    const action = COLUMN_DEFAULT_ACTION[columnKey]
    if (action && action !== bill.effectiveAction) onSetAction(bill, action)
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-3 lg:grid-cols-6">
        {TRIAGE_COLUMNS.map((column) => {
          const columnBills = byColumn[column.key]
          const total = columnBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)

          return (
            <section
              key={column.key}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setOverColumn(column.key)
              }}
              onDragLeave={() => setOverColumn((c) => (c === column.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault()
                drop(column.key)
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border bg-slate-100/60 md:w-auto dark:bg-slate-900/40',
                overColumn === column.key
                  ? 'border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/30'
                  : 'border-slate-200 dark:border-slate-800',
              )}
            >
              <header className="flex items-baseline justify-between gap-2 px-3 py-2">
                <h3 className="text-sm font-semibold">{column.title}</h3>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {columnBills.length}
                </span>
              </header>
              {total > 0 && (
                <p className="px-3 pb-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {money(total)}
                </p>
              )}

              <div className="flex-1 space-y-2 p-2 pt-0">
                {columnBills.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-slate-600">
                    Nothing here
                  </p>
                ) : (
                  columnBills.map((bill) => (
                    <BillCard
                      key={bill.id}
                      bill={bill}
                      providerName={providersById.get(bill.provider_id)?.name ?? 'Unknown provider'}
                      patientName={patientsById.get(bill.patient_id)?.full_name ?? '—'}
                      onOpen={onOpen}
                      onMove={onSetAction}
                      dragging={draggingId === bill.id}
                      onDragStart={setDraggingId}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setOverColumn(null)
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

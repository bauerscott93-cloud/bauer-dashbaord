import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn.js'
import { money } from '../../lib/format.js'
import { formatDate, relativeDay, isBetween } from '../../lib/dates.js'
import { BILL_ACTIONS } from '../../lib/constants.js'
import { ActionBadge, FlagBadges, CollectionsBadge } from './Badges.jsx'
import { EmptyState } from '../ui/States.jsx'

const COLUMNS = [
  { key: 'provider',    label: 'Provider' },
  { key: 'patient',     label: 'Patient' },
  { key: 'date_of_service', label: 'Service' },
  { key: 'due_date',    label: 'Due' },
  { key: 'amount_billed', label: 'Billed', numeric: true },
  { key: 'balance',     label: 'Balance', numeric: true },
  { key: 'action',      label: 'Action' },
]

const BLANK_FILTERS = {
  search: '', patient: '', provider: '', action: '',
  from: '', to: '', withBalance: false, flagged: '',
}

export function BillsTable({ bills, providersById, patientsById, onOpen }) {
  const [sort, setSort] = useState({ key: 'due_date', dir: 'asc' })
  const [filters, setFilters] = useState(BLANK_FILTERS)

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))

  const rows = useMemo(() => {
    const value = (bill, key) => {
      switch (key) {
        case 'provider': return providersById.get(bill.provider_id)?.name ?? ''
        case 'patient':  return patientsById.get(bill.patient_id)?.full_name ?? ''
        case 'action':   return bill.effectiveAction
        case 'balance':  return Number(bill.balance || 0)
        case 'amount_billed': return Number(bill.amount_billed || 0)
        default: return bill[key] ?? ''
      }
    }

    const needle = filters.search.trim().toLowerCase()

    const filtered = bills.filter((bill) => {
      if (filters.patient && bill.patient_id !== filters.patient) return false
      if (filters.provider && bill.provider_id !== filters.provider) return false
      if (filters.action && bill.effectiveAction !== filters.action) return false
      if (filters.withBalance && Number(bill.balance || 0) <= 0) return false

      if (filters.flagged === 'mismatch' && !bill.flags.mismatch) return false
      if (filters.flagged === 'duplicate' && !bill.flags.duplicate) return false
      if (filters.flagged === 'overdue' && !bill.flags.overdue) return false

      if (filters.from || filters.to) {
        const date = bill.date_of_service
        if (!date) return false
        if (!isBetween(date, filters.from || '0000-01-01', filters.to || '9999-12-31')) return false
      }

      if (needle) {
        const haystack = [
          value(bill, 'provider'), value(bill, 'patient'),
          bill.claim_number, bill.account_number_on_bill, bill.notes, bill.action_reason,
        ].join(' ').toLowerCase()
        if (!haystack.includes(needle)) return false
      }

      return true
    })

    return filtered.sort((a, b) => {
      const av = value(a, sort.key)
      const bv = value(b, sort.key)
      let result
      if (typeof av === 'number' && typeof bv === 'number') result = av - bv
      else result = String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? result : -result
    })
  }, [bills, filters, sort, providersById, patientsById])

  const totalBalance = rows.reduce((sum, b) => sum + Number(b.balance || 0), 0)
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(BLANK_FILTERS)

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  return (
    <div className="space-y-3">
      {/* filters */}
      <div className="hh-card grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search provider, claim #, notes…"
          className="hh-input sm:col-span-2"
          aria-label="Search bills"
        />
        <select value={filters.patient} onChange={(e) => set({ patient: e.target.value })}
                className="hh-input" aria-label="Filter by patient">
          <option value="">All patients</option>
          {[...patientsById.values()].map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
        <select value={filters.provider} onChange={(e) => set({ provider: e.target.value })}
                className="hh-input" aria-label="Filter by provider">
          <option value="">All providers</option>
          {[...providersById.values()].map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={filters.action} onChange={(e) => set({ action: e.target.value })}
                className="hh-input" aria-label="Filter by action">
          <option value="">Any action</option>
          {BILL_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select value={filters.flagged} onChange={(e) => set({ flagged: e.target.value })}
                className="hh-input" aria-label="Filter by flag">
          <option value="">Any flag</option>
          <option value="mismatch">EOB mismatch</option>
          <option value="duplicate">Possible duplicate</option>
          <option value="overdue">Overdue</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })}
                 className="hh-input" aria-label="Service date from" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })}
                 className="hh-input" aria-label="Service date to" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={filters.withBalance}
                 onChange={(e) => set({ withBalance: e.target.checked })}
                 className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
          Balance over $0
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {rows.length} {rows.length === 1 ? 'bill' : 'bills'} · {money(totalBalance)} outstanding
        </span>
        {isFiltered && (
          <button onClick={() => setFilters(BLANK_FILTERS)} className="font-medium underline">
            Clear filters
          </button>
        )}
      </div>

      {/* table */}
      <div className="hh-card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState
            title="No bills match these filters"
            hint={isFiltered ? 'Try clearing a filter.' : 'Add one with Quick add, or import a CSV.'}
          />
        ) : (
          <table className="w-full min-w-max text-sm">
            <thead className="border-b border-slate-200 text-left dark:border-slate-800">
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} scope="col"
                      className={cn('px-3 py-2 font-medium', col.numeric && 'text-right')}>
                    <button onClick={() => toggleSort(col.key)}
                            className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                      {col.label}
                      {sort.key === col.key && <span aria-hidden="true">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((bill) => (
                <tr key={bill.id} onClick={() => onOpen(bill)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2">
                    <span className="font-medium">
                      {providersById.get(bill.provider_id)?.name ?? '—'}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <CollectionsBadge bill={bill} />
                      <FlagBadges flags={bill.flags} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {patientsById.get(bill.patient_id)?.full_name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {formatDate(bill.date_of_service)}
                  </td>
                  <td className={cn('px-3 py-2',
                    bill.flags.overdue ? 'font-medium text-rose-600 dark:text-rose-400'
                      : bill.flags.urgent ? 'font-medium text-amber-600 dark:text-amber-400'
                      : 'text-slate-600 dark:text-slate-400')}>
                    {bill.due_date ? (
                      <>
                        {formatDate(bill.due_date)}
                        <span className="block text-xs opacity-75">{relativeDay(bill.due_date)}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    {money(bill.amount_billed)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {money(bill.balance)}
                  </td>
                  <td className="px-3 py-2">
                    <ActionBadge action={bill.effectiveAction} suggested={!bill.action} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

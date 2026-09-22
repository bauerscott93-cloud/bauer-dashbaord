import { money } from '../../lib/format.js'
import { cn } from '../../lib/cn.js'

function Stat({ label, value, hint, tone = 'default' }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-lg font-semibold tabular-nums',
          tone === 'danger' && 'text-rose-600 dark:text-rose-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400',
          tone === 'muted' && 'text-slate-500 dark:text-slate-400',
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

function Progress({ label, met, max }) {
  const metNum = Number(met ?? 0)
  const maxNum = Number(max ?? 0)
  if (!maxNum) return null
  const pct = Math.min(100, Math.round((metNum / maxNum) * 100))

  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{pct}%</p>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={metNum}
        aria-valuemin={0}
        aria-valuemax={maxNum}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-teal-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs tabular-nums text-slate-400 dark:text-slate-500">
        {money(metNum)} of {money(maxNum)}
      </p>
    </div>
  )
}

export function SummaryBar({ summary, plans = [] }) {
  return (
    <div className="space-y-3">
      <div className="hh-card grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0 dark:divide-slate-800">
        <Stat
          label="Due now"
          value={money(summary.dueNow)}
          hint="Marked to pay"
          tone={summary.dueNow > 0 ? 'danger' : 'default'}
        />
        <Stat
          label="In limbo"
          value={money(summary.inLimbo)}
          hint="Waiting on insurance or an EOB"
          tone="muted"
        />
        <Stat
          label="Under dispute"
          value={money(summary.underDispute)}
          tone={summary.underDispute > 0 ? 'warn' : 'default'}
        />
        <Stat label="Total outstanding" value={money(summary.outstanding)} />
        <Stat label="Paid this year" value={money(summary.paidYtd)} />
      </div>

      {(summary.needsCall > 0 || summary.followUpsDue > 0 || summary.mismatches > 0 ||
        summary.duplicates > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-500 dark:text-slate-400">
          {summary.needsCall > 0 && <span>{summary.needsCall} need a call</span>}
          {summary.followUpsDue > 0 && <span>{summary.followUpsDue} follow-up due</span>}
          {summary.mismatches > 0 && <span>{summary.mismatches} EOB mismatch</span>}
          {summary.duplicates > 0 && <span>{summary.duplicates} possible duplicate</span>}
        </div>
      )}

      {plans.length > 0 && (
        <div className="hh-card divide-y divide-slate-200 dark:divide-slate-800">
          {plans.map((plan) => (
            <div key={plan.id} className="p-1">
              <p className="px-3 pt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                {plan.name} · {plan.plan_year}
              </p>
              {Number(plan.deductible ?? 0) > 0 || Number(plan.out_of_pocket_max ?? 0) > 0 ? (
                <div className="grid gap-1 sm:grid-cols-2">
                  <Progress
                    label="Deductible"
                    met={plan.deductible_met}
                    max={plan.deductible}
                  />
                  <Progress
                    label="Out-of-pocket max"
                    met={plan.out_of_pocket_met}
                    max={plan.out_of_pocket_max}
                  />
                </div>
              ) : (
                <p className="px-3 pb-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                  No deductible or out-of-pocket figures yet — add them under Plans once the
                  insurer confirms them, and the progress bars appear here.
                </p>
              )}
            </div>
          ))}
          <p className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">
            Deductible and out-of-pocket amounts are updated by hand — edit them under Plans.
          </p>
        </div>
      )}
    </div>
  )
}

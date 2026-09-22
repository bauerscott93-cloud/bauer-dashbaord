import { cn } from '../../lib/cn.js'
import { BILL_ACTION_LABELS } from '../../lib/constants.js'

const TONES = {
  rose:    'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
  amber:   'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300',
  violet:  'bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
  slate:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

/** red = pay, amber = needs a call, gray = waiting/ignored, green = done. */
const ACTION_TONE = {
  pay: 'rose',
  call_provider: 'amber',
  dispute: 'violet',
  wait_for_eob: 'slate',
  wait_for_insurance: 'slate',
  ignore: 'slate',
  paid: 'emerald',
  resolved: 'emerald',
}

export function Badge({ tone = 'slate', className, children, title }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function ActionBadge({ action, suggested = false }) {
  return (
    <Badge
      tone={ACTION_TONE[action] ?? 'slate'}
      title={suggested ? 'Suggested by the triage rules' : 'You set this'}
    >
      {suggested && <span aria-hidden="true">◇</span>}
      {BILL_ACTION_LABELS[action] ?? action}
    </Badge>
  )
}

/** The flags that change what you should do about a bill. */
export function FlagBadges({ flags, className }) {
  if (!flags) return null
  const shown = []
  if (flags.overdue) shown.push(['rose', 'Overdue', 'Past its due date and marked to pay'])
  else if (flags.urgent) shown.push(['amber', 'Due soon', 'Due within 14 days and marked to pay'])
  if (flags.mismatch) {
    shown.push(['amber', 'Mismatch', 'The EOB says you owe less than the statement asks for'])
  }
  if (flags.duplicate) {
    shown.push(['violet', 'Possible duplicate', 'Same provider, date of service and amount as another bill'])
  }
  if (shown.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {shown.map(([tone, label, title]) => (
        <Badge key={label} tone={tone} title={title}>{label}</Badge>
      ))}
    </div>
  )
}

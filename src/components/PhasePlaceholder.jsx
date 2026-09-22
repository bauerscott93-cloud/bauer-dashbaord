import { Card } from './ui/Card.jsx'

/**
 * Honest placeholder for a page whose build phase hasn't landed yet, so the
 * nav is complete without pretending the feature exists.
 */
export function PhasePlaceholder({ title, phase, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Arriving in build phase {phase}.
        </p>
      </div>
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Planned for this page
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          {children}
        </ul>
      </Card>
    </div>
  )
}

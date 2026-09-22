import { Card } from './Card.jsx'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600 dark:border-slate-700 dark:border-t-teal-400"
      />
      {label}
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const message = error?.message || String(error || 'Something went wrong.')
  return (
    <Card className="border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/40">
      <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
        Something went wrong
      </p>
      <p className="mt-1 break-words text-xs text-rose-700 dark:text-rose-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-xs font-medium text-rose-800 underline dark:text-rose-200"
        >
          Try again
        </button>
      )}
    </Card>
  )
}

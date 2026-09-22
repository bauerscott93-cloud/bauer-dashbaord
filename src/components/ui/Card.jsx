import { cn } from '../../lib/cn.js'

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('hh-card', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

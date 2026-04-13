import { cn } from '../../lib/utils'

export function Spinner({ className }) {
  return (
    <svg className={cn('animate-spin h-5 w-5 text-brand-800', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-400">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description && <p className="text-xs text-ink-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorAlert({ children }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5"
    >
      {children}
    </div>
  )
}

export function SuccessAlert({ children }) {
  if (!children) return null
  return (
    <div
      role="status"
      className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5"
    >
      {children}
    </div>
  )
}

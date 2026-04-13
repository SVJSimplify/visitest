import { cn } from '../../lib/utils'

export default function Card({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-ink-200 shadow-card',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...rest }) {
  return (
    <div
      className={cn('px-5 py-4 border-b border-ink-200/70 flex items-center justify-between gap-3', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitle({ className, children }) {
  return (
    <h2 className={cn('text-[15px] font-semibold text-ink-900 tracking-tight', className)}>
      {children}
    </h2>
  )
}

export function CardBody({ className, children }) {
  return <div className={cn('p-5', className)}>{children}</div>
}

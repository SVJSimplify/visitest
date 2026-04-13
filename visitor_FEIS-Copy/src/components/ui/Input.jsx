import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const Input = forwardRef(function Input(
  { className, error, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full h-11 px-3.5 rounded-lg bg-white text-ink-900 placeholder:text-ink-400',
        'border border-ink-200 transition-all',
        'focus:outline-none focus:border-brand-800 focus:ring-4 focus:ring-brand-800/8',
        'disabled:bg-ink-50 disabled:text-ink-500 disabled:cursor-not-allowed',
        '[&[data-autofilled]]:bg-emerald-50/40 [&[data-autofilled]]:border-emerald-200',
        error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10',
        className
      )}
      {...rest}
    />
  )
})

export default Input

export const Textarea = forwardRef(function Textarea(
  { className, error, rows = 3, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full px-3.5 py-3 rounded-lg bg-white text-ink-900 placeholder:text-ink-400',
        'border border-ink-200 transition-all resize-y',
        'focus:outline-none focus:border-brand-800 focus:ring-4 focus:ring-brand-800/8',
        error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10',
        className
      )}
      {...rest}
    />
  )
})

export const Select = forwardRef(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full h-11 px-3 rounded-lg bg-white text-ink-900',
        'border border-ink-200 transition-all',
        'focus:outline-none focus:border-brand-800 focus:ring-4 focus:ring-brand-800/8',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
})

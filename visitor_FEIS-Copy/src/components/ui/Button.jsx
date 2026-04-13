import { cn } from '../../lib/utils'

const VARIANTS = {
  primary:   'bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900 disabled:bg-brand-300 shadow-subtle',
  secondary: 'bg-white text-ink-900 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100',
  ghost:     'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200',
  danger:    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
  gold:      'bg-gold-400 text-brand-900 hover:bg-gold-500 active:brightness-95 font-semibold',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
  xl: 'h-14 px-8 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  children,
  ...rest
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight',
        'transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'select-none touch-manipulation',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

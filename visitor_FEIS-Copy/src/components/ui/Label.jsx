import { cn } from '../../lib/utils'

export default function Label({ htmlFor, children, className, required, ...rest }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'block text-xs font-semibold text-ink-700 mb-1.5 tracking-wide',
        className
      )}
      {...rest}
    >
      {children}
      {required && <span className="text-brand-800 ml-0.5">*</span>}
    </label>
  )
}

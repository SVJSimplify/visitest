import { useEffect } from 'react'
import { cn } from '../../lib/utils'

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', className }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      role="dialog"
      aria-modal="true"
    >
      <div className={cn(
        'w-full bg-white rounded-2xl shadow-modal border border-ink-200 animate-slide-up overflow-hidden',
        sizes[size],
        className
      )}>
        {(title || subtitle) && (
          <div className="px-6 pt-6 pb-4 border-b border-ink-200/70">
            {title && <h2 className="text-lg font-semibold text-ink-900 tracking-tight">{title}</h2>}
            {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
          </div>
        )}
        <div className="p-6">{children}</div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

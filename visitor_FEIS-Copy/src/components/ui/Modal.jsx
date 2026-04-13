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
      className="modal-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink-950/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      role="dialog"
      aria-modal="true"
    >
      <div className={cn(
        'modal-panel relative w-full bg-white shadow-modal border border-ink-200 overflow-hidden',
        // Mobile: full-width bottom sheet
        'rounded-t-[20px] sm:rounded-2xl',
        // Desktop: centered card with max-width
        'sm:animate-slide-up',
        sizes[size],
        className
      )}>
        {/* Header */}
        {(title || subtitle) && (
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-ink-200/70">
            {title && (
              <h2 className="text-base sm:text-lg font-semibold text-ink-900 tracking-tight pr-8">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-ink-500 mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto scroll-ios" style={{ maxHeight: 'calc(92dvh - 80px)' }}>
          {children}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-all duration-150 hover:scale-110 active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

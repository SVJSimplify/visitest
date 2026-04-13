import { cn } from '../../lib/utils'
import { STATUS } from '../../lib/constants'

export default function Badge({ children, tone = 'neutral', className }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700 border-ink-200',
    inside:  'bg-emerald-50 text-emerald-800 border-emerald-200',
    left:    'bg-ink-100 text-ink-600 border-ink-200',
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    expired: 'bg-amber-50 text-amber-800 border-amber-200',
    forced:  'bg-rose-50 text-rose-800 border-rose-200',
    brand:   'bg-brand-50 text-brand-800 border-brand-200',
    gold:    'bg-gold-100 text-brand-900 border-gold-400/40',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold tracking-wide',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    PENDING:    { tone: 'pending', label: 'Pending' },
    INSIDE:     { tone: 'inside',  label: 'Inside'  },
    LEFT:       { tone: 'left',    label: 'Checked Out' },
    EXPIRED:    { tone: 'expired', label: 'Expired' },
    FORCED_OUT: { tone: 'forced',  label: 'Forced Out' },
  }
  const m = map[status] || map.PENDING
  return (
    <Badge tone={m.tone}>
      <span className={cn('w-1.5 h-1.5 rounded-full', STATUS[status]?.dot || 'bg-ink-400')} />
      {m.label}
    </Badge>
  )
}

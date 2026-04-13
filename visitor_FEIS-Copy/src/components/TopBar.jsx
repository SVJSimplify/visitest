import { cn } from '../lib/utils'

export default function TopBar({ title, subtitle, children }) {
  return (
    <>
      <div className="h-0.5 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800 opacity-90" />
      <header className="h-14 bg-white border-b border-ink-200 px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-ink-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-ink-500 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </header>
    </>
  )
}

export function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
      </span>
      Live
    </span>
  )
}

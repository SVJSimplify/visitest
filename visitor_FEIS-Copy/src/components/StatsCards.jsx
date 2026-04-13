export default function StatsCards({ inside = 0, total = 0, left = 0, expired = 0 }) {
  const items = [
    { label: 'Inside Now',     value: inside,  hint: 'Currently on premises', accent: 'text-emerald-600' },
    { label: 'Total Today',    value: total,   hint: 'All check-ins',         accent: 'text-ink-900' },
    { label: 'Checked Out',    value: left,    hint: 'Completed visits',      accent: 'text-ink-900' },
    { label: 'Expired',        value: expired, hint: 'Unused passes',         accent: 'text-amber-600' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger">
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-white border border-ink-200 rounded-xl px-5 py-4 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{it.label}</div>
          <div className={`text-3xl font-bold tracking-tight mt-1.5 ${it.accent}`}>{it.value}</div>
          <div className="text-[11px] text-ink-400 mt-0.5">{it.hint}</div>
        </div>
      ))}
    </div>
  )
}

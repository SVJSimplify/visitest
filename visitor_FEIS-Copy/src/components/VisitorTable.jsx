import { useState } from 'react'
import { fmtTime, timeSince } from '../lib/utils'
import { StatusBadge } from './ui/Badge'
import { EmptyState } from './ui/Feedback'
import Button from './ui/Button'

/**
 * VisitorTable
 * ----------------------------------------------------------------------
 * Issue #2 fix: every cell uses {value} interpolation, which React
 * escapes automatically. Zero innerHTML usage anywhere. The original
 * loadVisitors() XSS surface is gone.
 */
export default function VisitorTable({ rows, onPhoto, onForceCheckout }) {
  const [openMenu, setOpenMenu] = useState(null)

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        title="No visitors yet"
        description="Visitors will appear here as they register and check in."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-200">
            {['', 'Visitor', 'Phone', 'Purpose', 'Meet', 'Gate', 'Check-in', 'Check-out', 'Status', ''].map((h) => (
              <th
                key={h}
                className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 px-3 py-3 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-b border-ink-100 hover:bg-ink-50/60 transition-colors">
              <td className="px-3 py-3">
                {v.photo_url ? (
                  <button
                    onClick={() => onPhoto?.(v.photo_url, v.name)}
                    className="block w-9 h-9 rounded-full overflow-hidden ring-1 ring-ink-200 hover:ring-brand-800 transition"
                    aria-label={`View photo of ${v.name}`}
                  >
                    <img src={v.photo_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center text-[11px] font-semibold text-ink-500">
                    {(v.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="font-semibold text-ink-900 flex items-center gap-2">
                  {v.name || '—'}
                  {v.watchlist_hit && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                      WATCHLIST
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5">{v.role}</div>
              </td>
              <td className="px-3 py-3 text-ink-700 font-mono text-[12px]">{v.phone || '—'}</td>
              <td className="px-3 py-3 text-ink-700 max-w-[200px] truncate" title={v.purpose}>
                {v.purpose || '—'}
              </td>
              <td className="px-3 py-3 text-ink-700">{v.meet || '—'}</td>
              <td className="px-3 py-3 text-ink-500 text-[12px] capitalize">{v.gate?.replace('gate-', '') || '—'}</td>
              <td className="px-3 py-3 text-ink-700 whitespace-nowrap">
                <div className="text-[12px]">{fmtTime(v.checked_in_at)}</div>
                {v.checked_in_at && <div className="text-[10px] text-ink-400">{timeSince(v.checked_in_at)}</div>}
              </td>
              <td className="px-3 py-3 text-ink-700 whitespace-nowrap text-[12px]">{fmtTime(v.checked_out_at)}</td>
              <td className="px-3 py-3"><StatusBadge status={v.status} /></td>
              <td className="px-3 py-3 relative">
                {v.status === 'INSIDE' && (
                  <Button size="sm" variant="ghost" onClick={() => onForceCheckout?.(v)}>
                    Force out
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

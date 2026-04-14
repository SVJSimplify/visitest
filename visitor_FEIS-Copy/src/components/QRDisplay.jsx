import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * QRDisplay
 * ─────────────────────────────────────────────────────────
 * Uses toDataURL → <img> instead of toCanvas → <canvas>.
 * Canvas rendering fails silently on many mobile browsers
 * (WebView, iOS Safari with strict privacy settings, etc.)
 * because the canvas dimensions are 0 at first paint.
 * An <img> with a base64 src works universally.
 */
export default function QRDisplay({ value, size = 220, className }) {
  const [src, setSrc]     = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!value) return
    setError(false)

    // devicePixelRatio scaling so QR looks crisp on Retina / high-DPI screens
    const dpr    = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
    const actual = Math.round(size * Math.min(dpr, 3)) // cap at 3× to avoid huge PNGs

    QRCode.toDataURL(value, {
      width:                actual,
      margin:               1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0a0a0a', light: '#ffffff' },
    })
      .then(setSrc)
      .catch(() => setError(true))
  }, [value, size])

  if (error) {
    return (
      <div className={className}>
        <div
          className="inline-flex flex-col items-center justify-center bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium gap-1"
          style={{ width: size, height: size }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          QR failed to load
        </div>
      </div>
    )
  }

  if (!src) {
    // Skeleton while generating
    return (
      <div className={className}>
        <div
          className="inline-block p-3 bg-white rounded-xl border border-ink-200 shadow-card"
        >
          <div
            className="skeleton rounded-md"
            style={{ width: size, height: size }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="inline-block p-3 bg-white rounded-xl border border-ink-200 shadow-card animate-pop">
        <img
          src={src}
          alt="Visitor QR pass"
          width={size}
          height={size}
          style={{
            display:       'block',
            imageRendering: 'pixelated', // crisp QR pixels, no blur
            width:          size,
            height:         size,
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}

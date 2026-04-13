import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function QRDisplay({ value, size = 220, className }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0a0a0a', light: '#ffffff' },
    })
  }, [value, size])

  return (
    <div className={className}>
      <div className="inline-block p-3 bg-white rounded-xl border border-ink-200 shadow-card">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

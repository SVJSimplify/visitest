import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

/**
 * BadgePrint
 * ----------------------------------------------------------------------
 * Renders a printable visitor badge in a hidden iframe and triggers
 * print(). Uses an iframe instead of window.open() because popup
 * blockers stop window.open() that runs after an async boundary.
 *
 * Feature #7: physical badge issued on check-in.
 */
export default function BadgePrint({ visitor, onDone }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    if (!visitor) return
    let cancelled = false

    QRCode.toDataURL(visitor.qr_token, {
      width: 160,
      margin: 0,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    }).then((qrData) => {
      if (cancelled || !iframeRef.current) return
      const iframe = iframeRef.current
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc) {
        onDone?.()
        return
      }

      doc.open()
      doc.write(buildHtml(visitor, qrData))
      doc.close()

      const printNow = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Print failed:', e)
        }
        setTimeout(() => onDone?.(), 800)
      }

      const photo = doc.querySelector('img.photo-img')
      if (photo && !photo.complete) {
        photo.addEventListener('load', printNow, { once: true })
        photo.addEventListener('error', printNow, { once: true })
        setTimeout(printNow, 2000)
      } else {
        setTimeout(printNow, 200)
      }
    }).catch(() => onDone?.())

    return () => { cancelled = true }
  }, [visitor, onDone])

  return (
    <iframe
      ref={iframeRef}
      title="Visitor badge"
      aria-hidden="true"
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        width: '1px',
        height: '1px',
        border: 0,
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

function escape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildHtml(v, qrData) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Visitor Badge</title>
<style>
  @page { size: 80mm 120mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Inter, -apple-system, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { padding: 8px; color: #0a0a0a; }
  .badge { width: 100%; border: 2px solid #0a0a0a; border-radius: 8px; overflow: hidden; }
  .head { background: #8e0e00; color: #fff; padding: 8px 12px; }
  .head .brand { font-size: 10px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.85; }
  .head .title { font-size: 14px; font-weight: 700; margin-top: 2px; }
  .gold { height: 3px; background: linear-gradient(90deg, #f9d423, #ffd700, #f9d423); }
  .body { padding: 12px; }
  .photo { width: 100%; aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #f5f5f5; margin-bottom: 10px; }
  .photo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo.empty { display: flex; align-items: center; justify-content: center; color: #a3a3a3; font-size: 11px; }
  .name { font-size: 16px; font-weight: 800; line-height: 1.1; }
  .meta { font-size: 10px; color: #525252; margin-top: 8px; line-height: 1.6; }
  .meta dt { font-weight: 600; color: #0a0a0a; display: inline; }
  .meta dd { display: inline; margin-left: 4px; }
  .meta .row { display: block; }
  .qr { display: flex; justify-content: center; padding: 10px 0 6px; }
  .qr img { width: 140px; height: 140px; }
  .footer { text-align: center; font-size: 8px; color: #737373; padding: 6px; border-top: 1px dashed #d4d4d4; }
  @media print { body { padding: 0; } .badge { border: none; border-radius: 0; } }
</style></head><body>
  <div class="badge">
    <div class="head">
      <div class="brand">Visitour</div>
      <div class="title">FEIS Visitor Pass</div>
    </div>
    <div class="gold"></div>
    <div class="body">
      <div class="photo ${v.photo_url ? '' : 'empty'}">
        ${v.photo_url ? `<img class="photo-img" src="${escape(v.photo_url)}" alt="">` : 'No photo'}
      </div>
      <div class="name">${escape(v.name)}</div>
      <dl class="meta">
        <div class="row"><dt>Role</dt><dd>${escape(v.role)}</dd></div>
        <div class="row"><dt>Purpose</dt><dd>${escape(v.purpose || '—')}</dd></div>
        ${v.meet ? `<div class="row"><dt>Meeting</dt><dd>${escape(v.meet)}</dd></div>` : ''}
        <div class="row"><dt>Phone</dt><dd>${escape(v.phone)}</dd></div>
      </dl>
      <div class="qr"><img src="${qrData}" alt="QR"></div>
    </div>
    <div class="footer">Show this pass at the gate on entry and exit</div>
  </div>
</body></html>`
}

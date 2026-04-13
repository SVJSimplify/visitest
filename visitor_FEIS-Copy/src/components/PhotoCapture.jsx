import { useEffect, useRef, useState } from 'react'
import Button from './ui/Button'
import { Spinner } from './ui/Feedback'
import { canvasToBlob, cn } from '../lib/utils'

/**
 * PhotoCapture
 * ----------------------------------------------------------------------
 * Reusable camera capture flow.
 *
 * Props:
 *  - facing:       'user' | 'environment'
 *  - onCapture:    (blob) => void               called when user confirms
 *  - onCancel:     ()     => void   (optional)  shown as "Cancel"
 *  - onSkip:       ()     => void   (optional)  shown as "Skip / Continue without photo"
 *  - confirmLabel: button label after capture
 *
 * The skip button is visible in EVERY state (ready, starting, error, preview)
 * so the user can always proceed without a photo if they don't want one or
 * the camera is unavailable.
 */
export default function PhotoCapture({
  facing = 'user',
  onCapture,
  onCancel,
  onSkip,
  confirmLabel = 'Confirm',
  className,
}) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [phase, setPhase] = useState('starting')
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [currentFacing, setCurrentFacing] = useState(facing)

  const start = async () => {
    setPhase('starting')
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported in this browser')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setPhase('ready')
    } catch (e) {
      setError(e.message || 'Camera unavailable')
      setPhase('error')
    }
  }

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => {
    start()
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const capture = async () => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c) return
    c.width  = v.videoWidth  || 640
    c.height = v.videoHeight || 480
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    const dataUrl = c.toDataURL('image/jpeg', 0.85)
    setPreviewUrl(dataUrl)
    const b = await canvasToBlob(c, 0.85)
    setBlob(b)
    setPhase('preview')
    stop()
  }

  const retake = () => {
    setPreviewUrl(null)
    setBlob(null)
    start()
  }

  const flipCamera = () => {
    stop()
    setCurrentFacing(f => f === 'environment' ? 'user' : 'environment')
  }

  useEffect(() => {
    if (phase !== 'preview') start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFacing])

  const confirm = () => {
    if (blob) onCapture?.(blob)
  }

  const handleSkip = () => {
    stop()
    onSkip?.()
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Camera viewport */}
      <div className="relative w-full aspect-[4/3] bg-ink-950 rounded-xl overflow-hidden ring-1 ring-ink-200">
        {phase === 'preview' ? (
          <img src={previewUrl} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {(phase === 'ready' || phase === 'starting') && (
          <button
            onClick={flipCamera}
            className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 z-10"
            title="Flip camera"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        )}

        {phase === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950 text-ink-300 gap-2">
            <Spinner className="text-white" />
            <span className="text-xs">Starting camera</span>
          </div>
        )}

        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950 text-ink-300 gap-2 px-6 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold-400 mb-1">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            <span className="text-sm font-semibold text-white">Camera unavailable</span>
            <span className="text-[11px] text-ink-400 max-w-[260px]">{error}</span>
          </div>
        )}
      </div>

      {/* Action buttons — vary by phase
       *
       * Photo policy: PHOTO IS REQUIRED.
       * The skip button only appears when phase === 'error', meaning the
       * camera genuinely failed to initialize (permission denied, no camera,
       * unsupported browser). Users with working cameras must capture.
       */}
      <div className="flex flex-col gap-2">
        {phase === 'preview' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={retake} className="flex-1">
              Retake
            </Button>
            <Button variant="primary" size="md" onClick={confirm} className="flex-1">
              {confirmLabel}
            </Button>
          </div>
        )}

        {(phase === 'starting' || phase === 'ready') && (
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="ghost" size="md" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={capture}
              disabled={phase !== 'ready'}
              className="flex-1"
            >
              {phase === 'starting' ? 'Starting…' : 'Capture Photo'}
            </Button>
          </div>
        )}

        {phase === 'error' && (
          <>
            <div className="flex gap-2">
              {onCancel && (
                <Button variant="ghost" size="md" onClick={onCancel} className="flex-1">
                  Cancel
                </Button>
              )}
              <Button variant="secondary" size="md" onClick={start} className="flex-1">
                Retry camera
              </Button>
            </div>
            {onSkip && (
              <Button variant="gold" size="md" onClick={handleSkip} className="w-full">
                Continue without photo
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
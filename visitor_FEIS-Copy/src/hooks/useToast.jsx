import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'pointer-events-auto px-4 py-2.5 rounded-lg shadow-elevated text-sm font-medium animate-slide-up min-w-[240px] max-w-[400px] ' +
              (t.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : t.type === 'error'
                ? 'bg-rose-50 text-rose-900 border border-rose-200'
                : t.type === 'warn'
                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                : 'bg-white text-ink-900 border border-ink-200')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast outside provider')
  return ctx
}

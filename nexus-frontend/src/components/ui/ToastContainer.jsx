import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'

let toastId = 0

const TOAST_META = {
  ok:   { bar: '#30d158', label: 'Done' },
  warn: { bar: '#ff9f0a', label: 'Heads up' },
  err:  { bar: '#ff453a', label: 'Error' },
}

export default function ToastContainer() {
  const { onToast } = useApp()
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return onToast((msg, type = 'ok') => {
      const id = ++toastId
      setToasts(prev => [...prev, { id, msg, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
    })
  }, [onToast])

  return (
    <div className="toasts">
      {toasts.map(t => {
        const meta = TOAST_META[t.type] || TOAST_META.ok
        return (
          <div
            key={t.id}
            className="toast-enter relative overflow-hidden flex flex-col pl-5 pr-5 py-3 rounded-2xl bg-white/85 backdrop-blur-xl ring-1 ring-black/[0.06] shadow-[0_12px_36px_rgba(0,0,0,0.18)] pointer-events-auto min-w-[220px] max-w-[340px]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, system-ui, sans-serif' }}
          >
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: meta.bar }} />
            <span className="text-[11px] font-semibold text-zinc-400">{meta.label}</span>
            <span className="text-[13px] font-medium text-zinc-900 leading-snug">{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}
import { useEffect } from 'react'
import { Check, X, AlertCircle, Info } from 'lucide-react'
import { useUIStore } from '../store'

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

interface ToastProps {
  toast: {
    id: string
    type: 'success' | 'error' | 'info'
    message: string
  }
  onClose: () => void
}

function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const icons = {
    success: <Check size={18} className="text-helm-success" />,
    error: <AlertCircle size={18} className="text-helm-error" />,
    info: <Info size={18} className="text-helm-primary" />
  }

  const bgColors = {
    success: 'bg-helm-success/10 border-helm-success/20',
    error: 'bg-helm-error/10 border-helm-error/20',
    info: 'bg-helm-primary/10 border-helm-primary/20'
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColors[toast.type]} animate-slide-up shadow-lg min-w-64 max-w-sm`}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm text-helm-text">{toast.message}</p>
      <button
        onClick={onClose}
        className="p-1 text-helm-text-muted hover:text-helm-text transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

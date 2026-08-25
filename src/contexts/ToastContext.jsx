import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md ${
                toast.type === 'error'
                  ? 'bg-dark-900/95 border-accent-red/40 text-accent-red'
                  : toast.type === 'success'
                  ? 'bg-dark-900/95 border-accent-green/40 text-accent-green'
                  : 'bg-dark-900/95 border-dark-600/50 text-dark-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {toast.type === 'error' && <AlertTriangle size={18} className="flex-shrink-0 text-accent-red" />}
                {toast.type === 'success' && <CheckCircle2 size={18} className="flex-shrink-0 text-accent-green" />}
                {toast.type === 'info' && <Info size={18} className="flex-shrink-0 text-accent-cyan" />}
                <span className="text-xs font-semibold text-dark-100 leading-snug">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 text-dark-400 hover:text-dark-200 transition-colors border-none bg-transparent cursor-pointer flex-shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: (msg) => console.log(msg) };
  }
  return context;
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:pl-64"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content */}
          <motion.div
            className={`relative w-full ${maxWidth} glass-strong rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between border-b border-dark-600/50 flex-shrink-0"
              style={{ padding: '14px 16px' }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-dark-100">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl text-dark-400 hover:text-dark-100 hover:bg-dark-600/50 transition-colors"
              >
                <X size={24} className="sm:w-7 sm:h-7" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto custom-scrollbar" style={{ padding: '14px 16px' }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}

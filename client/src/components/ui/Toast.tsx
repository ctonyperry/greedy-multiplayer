/**
 * Toast Component
 * Displays temporary notification messages
 */

import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastType, { bg: string; color: string; icon: string }> = {
  success: {
    bg: 'var(--color-success, #10b981)',
    color: 'white',
    icon: '✓',
  },
  info: {
    bg: 'var(--color-primary)',
    color: 'white',
    icon: 'ℹ',
  },
  warning: {
    bg: 'var(--color-warning)',
    color: 'var(--color-text)',
    icon: '⚠',
  },
  error: {
    bg: 'var(--color-danger)',
    color: 'white',
    icon: '✕',
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const style = typeStyles[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      onClick={() => onDismiss(toast.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: style.bg,
        color: style.color,
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        maxWidth: '90vw',
        minWidth: '200px',
      }}
    >
      <span style={{ fontSize: 'var(--font-size-lg)' }}>{style.icon}</span>
      <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
        {toast.message}
      </span>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--space-4)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <Toast toast={toast} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

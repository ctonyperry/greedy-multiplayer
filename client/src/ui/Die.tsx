import { motion } from 'framer-motion';
import type { DieValue } from '../types/index.js';

interface DieProps {
  value: DieValue;
  selected?: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  rolling?: boolean;
  scoringHint?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Die component with proper accessibility
 *
 * Features:
 * - WCAG 2.1 AA compliant touch targets (48px minimum)
 * - Screen reader announcements for die values
 * - Visual pip pattern for recognition
 * - Responsive sizing
 * - Animation states for rolling/selection
 */
export function Die({
  value,
  selected = false,
  disabled = false,
  dimmed = false,
  onClick,
  rolling = false,
  scoringHint = false,
  size = 'md',
}: DieProps) {
  const sizeClasses = {
    sm: 'die-sm',
    md: 'die-md',
    lg: 'die-lg',
  };

  const sizeStyles = {
    sm: { width: 48, height: 48 },
    md: { width: 'var(--die-size)', height: 'var(--die-size)' },
    lg: { width: 72, height: 72 },
  };

  const pipSize = {
    sm: 8,
    md: 10,
    lg: 14,
  };

  const faceSize = {
    sm: 38,
    md: 50,
    lg: 58,
  };

  // Pip positions for each die value
  const getPipPositions = (val: DieValue): string[] => {
    const positions: Record<DieValue, string[]> = {
      1: ['center'],
      2: ['top-right', 'bottom-left'],
      3: ['top-right', 'center', 'bottom-left'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
    };
    return positions[val];
  };

  const getAriaLabel = () => {
    const baseLabel = `Die showing ${value}`;
    if (selected) return `${baseLabel}, selected`;
    if (disabled) return `${baseLabel}, not selectable`;
    if (scoringHint) return `${baseLabel}, scores points - tap to select`;
    return `${baseLabel}, tap to select`;
  };

  return (
    <motion.button
      type="button"
      className={`die ${sizeClasses[size]} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${dimmed ? 'dimmed' : ''} ${scoringHint ? 'scoring-hint' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={getAriaLabel()}
      aria-pressed={selected}
      whileHover={disabled ? {} : { scale: 1.08 }}
      whileTap={disabled ? {} : { scale: 0.92 }}
      animate={
        rolling
          ? {
              rotateX: [0, 360, 720],
              rotateY: [0, 180, 360],
              scale: [1, 1.1, 1],
            }
          : selected
          ? { scale: 1.05 }
          : { scale: 1, rotateX: 0, rotateY: 0 }
      }
      transition={
        rolling
          ? { duration: 0.5, ease: 'easeOut' }
          : { type: 'spring', stiffness: 400, damping: 25 }
      }
      style={{
        width: sizeStyles[size].width,
        height: sizeStyles[size].height,
        background: dimmed
          ? 'rgba(255, 255, 255, 0.12)'
          : selected
          ? 'var(--color-primary)'
          : '#ffffff',
        border: dimmed ? '2px dashed rgba(255, 255, 255, 0.25)' : 'none',
        borderRadius: 'var(--radius-lg)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        boxShadow: dimmed
          ? 'none'
          : selected
          ? 'var(--shadow-glow-primary), var(--shadow-md)'
          : scoringHint
          ? '0 0 12px rgba(245, 158, 11, 0.5), var(--shadow-md)'
          : 'var(--shadow-md)',
        opacity: disabled && !dimmed ? 0.4 : 1,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <div
        className="die-face"
        style={{
          width: faceSize[size],
          height: faceSize[size],
          position: 'relative',
        }}
        aria-hidden="true"
      >
        {getPipPositions(value).map((position, index) => (
          <span
            key={`${position}-${index}`}
            className={`pip ${position}`}
            style={{
              position: 'absolute',
              width: pipSize[size],
              height: pipSize[size],
              background: dimmed
                ? 'rgba(255, 255, 255, 0.4)'
                : 'var(--color-background)',
              borderRadius: '50%',
              ...getPipStyle(position, size),
            }}
          />
        ))}
      </div>
    </motion.button>
  );
}

// Helper to get pip position styles
function getPipStyle(position: string, size: 'sm' | 'md' | 'lg'): React.CSSProperties {
  const offset = size === 'sm' ? '12%' : '10%';

  const styles: Record<string, React.CSSProperties> = {
    center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'top-left': { top: offset, left: offset },
    'top-right': { top: offset, right: offset },
    'middle-left': { top: '50%', left: offset, transform: 'translateY(-50%)' },
    'middle-right': { top: '50%', right: offset, transform: 'translateY(-50%)' },
    'bottom-left': { bottom: offset, left: offset },
    'bottom-right': { bottom: offset, right: offset },
  };

  return styles[position] || {};
}

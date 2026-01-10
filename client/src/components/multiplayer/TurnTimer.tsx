/**
 * TurnTimer Component
 * Displays countdown timer for idle timeout during a turn
 * Resets when user activity is detected
 */

import { useState, useEffect, useRef } from 'react';

interface TurnTimerProps {
  /** When the last user activity occurred (resets the timer) */
  lastActivityAt: string;
  /** Maximum idle time in seconds */
  idleTimeout: number;
  /** Whether it's the current user's turn */
  isMyTurn: boolean;
  /** Called when idle timeout expires */
  onExpired?: () => void;
}

export function TurnTimer({
  lastActivityAt,
  idleTimeout,
  isMyTurn,
  onExpired,
}: TurnTimerProps) {
  const [remaining, setRemaining] = useState(idleTimeout);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    // Reset expiry flag when activity happens
    hasExpiredRef.current = false;

    const activityTime = new Date(lastActivityAt).getTime();

    const updateTimer = () => {
      const idleTime = (Date.now() - activityTime) / 1000;
      const left = Math.max(0, idleTimeout - idleTime);
      setRemaining(Math.ceil(left));

      if (left <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpired?.();
      }
    };

    // Update immediately
    updateTimer();

    // Update every 100ms for smooth countdown
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [lastActivityAt, idleTimeout, onExpired]);

  // Calculate visual states
  const isLow = remaining <= 15;
  const isCritical = remaining <= 5;
  const percentage = (remaining / idleTimeout) * 100;

  // Format time display
  const formatTime = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${seconds}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: isCritical
          ? 'var(--color-danger-light)'
          : isLow
          ? 'var(--color-warning-light)'
          : 'var(--color-surface-elevated)',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Timer label */}
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {isMyTurn ? 'Idle Timer' : 'Idle Timer'}
      </span>

      {/* Time display */}
      <div
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          fontFamily: 'monospace',
          color: isCritical
            ? 'var(--color-danger)'
            : isLow
            ? 'var(--color-warning)'
            : 'var(--color-text)',
          animation: isCritical && isMyTurn ? 'pulse-danger 0.5s ease-in-out infinite' : undefined,
        }}
      >
        {formatTime(remaining)}
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: '4px',
          backgroundColor: 'var(--color-border)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: isCritical
              ? 'var(--color-danger)'
              : isLow
              ? 'var(--color-warning)'
              : 'var(--color-primary)',
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.1s linear, background-color 0.3s ease',
          }}
        />
      </div>

      {/* Warning message */}
      {isCritical && isMyTurn && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-danger)',
            fontWeight: 'var(--font-weight-medium)',
          }}
        >
          Make a move!
        </span>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes pulse-danger {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Compact idle timer for inline display
 */
export function TurnTimerCompact({
  lastActivityAt,
  idleTimeout,
  isMyTurn,
}: Omit<TurnTimerProps, 'onExpired'>) {
  const [remaining, setRemaining] = useState(idleTimeout);

  useEffect(() => {
    const activityTime = new Date(lastActivityAt).getTime();

    const updateTimer = () => {
      const idleTime = (Date.now() - activityTime) / 1000;
      const left = Math.max(0, idleTimeout - idleTime);
      setRemaining(Math.ceil(left));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [lastActivityAt, idleTimeout]);

  const isLow = remaining <= 15;
  const isCritical = remaining <= 5;

  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontWeight: 'var(--font-weight-medium)',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: isCritical
          ? 'var(--color-danger-light)'
          : isLow
          ? 'var(--color-warning-light)'
          : 'transparent',
        color: isCritical
          ? 'var(--color-danger)'
          : isLow
          ? 'var(--color-warning)'
          : 'var(--color-text-secondary)',
        animation: isCritical && isMyTurn ? 'blink 0.5s ease-in-out infinite' : undefined,
      }}
    >
      {remaining}s
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </span>
  );
}

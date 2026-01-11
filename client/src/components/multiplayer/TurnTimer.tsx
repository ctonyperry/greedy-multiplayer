/**
 * TurnTimer Component
 * Displays countdown timer synchronized with server time
 * Uses server-provided expiration time for accurate countdown across all clients
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocketEvent } from '../../contexts/SocketContext.js';
import type { TurnTimerState } from '../../types/index.js';

interface TurnTimerProps {
  /** Whether it's the current user's turn */
  isMyTurn: boolean;
  /** Called when timer expires (only fires for active player) */
  onExpired?: () => void;
  /** Called when 5-second warning should show */
  onWarning?: () => void;
}

/**
 * Server-synchronized turn timer
 */
export function TurnTimer({ isMyTurn, onExpired, onWarning }: TurnTimerProps) {
  const [timerState, setTimerState] = useState<TurnTimerState | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const hasExpiredRef = useRef(false);
  const hasWarnedRef = useRef(false);

  // Subscribe to timer sync events
  useSocketEvent('timerSync', useCallback((data: TurnTimerState & { serverTime: string }) => {
    // Calculate clock offset between client and server
    const serverTime = new Date(data.serverTime).getTime();
    const clientTime = Date.now();
    setServerTimeOffset(serverTime - clientTime);

    setTimerState(data);
    hasExpiredRef.current = false;
    hasWarnedRef.current = false;
  }, []));

  // Subscribe to timer reset (when player takes action)
  useSocketEvent('timerReset', useCallback((data: { playerId: string; lastActivityAt: string; expiresAt: string }) => {
    setTimerState(prev => prev ? {
      ...prev,
      lastActivityAt: data.lastActivityAt,
      expiresAt: data.expiresAt,
    } : null);
    hasExpiredRef.current = false;
    hasWarnedRef.current = false;
  }, []));

  // Subscribe to player timeout
  useSocketEvent('playerTimedOut', useCallback(() => {
    setTimerState(null);
    setRemaining(null);
  }, []));

  // Update countdown based on server-provided expiration
  useEffect(() => {
    if (!timerState) {
      setRemaining(null);
      return;
    }

    const updateTimer = () => {
      const expiresAt = new Date(timerState.expiresAt).getTime();
      // Adjust for server/client clock difference
      const adjustedNow = Date.now() + serverTimeOffset;
      const left = Math.max(0, (expiresAt - adjustedNow) / 1000);
      setRemaining(Math.ceil(left));

      // 5-second warning
      if (left <= 5 && left > 0 && !hasWarnedRef.current && isMyTurn) {
        hasWarnedRef.current = true;
        onWarning?.();
      }

      // Expiration (client-side notification only - server handles actual timeout)
      if (left <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        if (isMyTurn) {
          onExpired?.();
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [timerState, serverTimeOffset, isMyTurn, onExpired, onWarning]);

  // Don't render if no timer state
  if (!timerState || remaining === null) {
    return null;
  }

  // Calculate visual states
  const isLow = remaining <= 15;
  const isCritical = remaining <= 5;

  // Calculate percentage from expiration time
  const turnStartedAt = new Date(timerState.turnStartedAt).getTime();
  const expiresAt = new Date(timerState.expiresAt).getTime();
  const totalDuration = (expiresAt - turnStartedAt) / 1000;
  const percentage = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;

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
        backgroundColor: timerState.isInGracePeriod
          ? 'var(--color-warning-light)'
          : isCritical
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
        {timerState.isInGracePeriod ? 'Reconnecting...' : 'Time Remaining'}
      </span>

      {/* Time display */}
      <div
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          fontFamily: 'monospace',
          color: timerState.isInGracePeriod
            ? 'var(--color-warning)'
            : isCritical
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
            backgroundColor: timerState.isInGracePeriod
              ? 'var(--color-warning)'
              : isCritical
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
      {isCritical && isMyTurn && !timerState.isInGracePeriod && (
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

interface TurnTimerCompactProps {
  isMyTurn: boolean;
  onWarning?: () => void;
}

/**
 * Compact server-synchronized timer for inline display
 * WS8: Improved mobile readability with MM:SS format
 */
export function TurnTimerCompact({ isMyTurn, onWarning }: TurnTimerCompactProps) {
  const [timerState, setTimerState] = useState<TurnTimerState | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const hasWarnedRef = useRef(false);

  // Subscribe to timer sync events
  useSocketEvent('timerSync', useCallback((data: TurnTimerState & { serverTime: string }) => {
    const serverTime = new Date(data.serverTime).getTime();
    const clientTime = Date.now();
    setServerTimeOffset(serverTime - clientTime);
    setTimerState(data);
    hasWarnedRef.current = false;
  }, []));

  // Subscribe to timer reset
  useSocketEvent('timerReset', useCallback((data: { playerId: string; lastActivityAt: string; expiresAt: string }) => {
    setTimerState(prev => prev ? {
      ...prev,
      lastActivityAt: data.lastActivityAt,
      expiresAt: data.expiresAt,
    } : null);
    hasWarnedRef.current = false;
  }, []));

  // Subscribe to player timeout
  useSocketEvent('playerTimedOut', useCallback(() => {
    setTimerState(null);
    setRemaining(null);
  }, []));

  useEffect(() => {
    if (!timerState) {
      setRemaining(null);
      return;
    }

    const updateTimer = () => {
      const expiresAt = new Date(timerState.expiresAt).getTime();
      const adjustedNow = Date.now() + serverTimeOffset;
      const left = Math.max(0, (expiresAt - adjustedNow) / 1000);
      setRemaining(Math.ceil(left));

      // 5-second warning
      if (left <= 5 && left > 0 && !hasWarnedRef.current && isMyTurn) {
        hasWarnedRef.current = true;
        onWarning?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [timerState, serverTimeOffset, isMyTurn, onWarning]);

  if (!timerState || remaining === null) {
    return null;
  }

  const isLow = remaining <= 15;
  const isCritical = remaining <= 5;

  // Format time as MM:SS for clarity (WS8)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        fontFamily: 'monospace',
        fontWeight: 'var(--font-weight-bold)',
        fontSize: 'var(--font-size-sm)',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-md)',
        minWidth: '52px',
        justifyContent: 'center',
        backgroundColor: timerState.isInGracePeriod
          ? 'var(--color-warning-light)'
          : isCritical
          ? 'var(--color-danger-light)'
          : isLow
          ? 'var(--color-warning-light)'
          : 'var(--color-surface-elevated)',
        color: timerState.isInGracePeriod
          ? 'var(--color-warning)'
          : isCritical
          ? 'var(--color-danger)'
          : isLow
          ? 'var(--color-warning)'
          : 'var(--color-text)',
        animation: isCritical && isMyTurn ? 'blink 0.5s ease-in-out infinite' : undefined,
        border: isCritical ? '1px solid var(--color-danger)' : isLow ? '1px solid var(--color-warning)' : '1px solid var(--color-border)',
      }}
    >
      <span style={{ fontSize: '0.75em' }}>⏱️</span>
      {formatTime(remaining)}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </span>
  );
}

/**
 * Legacy turn timer props (for backward compatibility)
 */
interface LegacyTurnTimerProps {
  /** When the last user activity occurred (resets the timer) */
  lastActivityAt: string;
  /** Maximum idle time in seconds */
  idleTimeout: number;
  /** Whether it's the current user's turn */
  isMyTurn: boolean;
  /** Called when idle timeout expires */
  onExpired?: () => void;
}

/**
 * Legacy local-time-based timer (for fallback when server timer not available)
 */
export function TurnTimerLocal({
  lastActivityAt,
  idleTimeout,
  isMyTurn,
  onExpired,
}: LegacyTurnTimerProps) {
  const [remaining, setRemaining] = useState(idleTimeout);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
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

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [lastActivityAt, idleTimeout, onExpired]);

  const isLow = remaining <= 15;
  const isCritical = remaining <= 5;
  const percentage = (remaining / idleTimeout) * 100;

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
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Idle Timer
      </span>

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

      <style>{`
        @keyframes pulse-danger {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

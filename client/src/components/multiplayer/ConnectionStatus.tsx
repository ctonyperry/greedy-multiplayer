/**
 * ConnectionStatus Component
 * Displays real-time connection status to the server
 */

import { useSocket } from '../../contexts/SocketContext.js';

interface ConnectionStatusProps {
  compact?: boolean;
}

export function ConnectionStatus({ compact = false }: ConnectionStatusProps) {
  const { status, error } = useSocket();

  const statusConfig = {
    disconnected: {
      color: 'var(--color-text-secondary)',
      bgColor: 'var(--color-surface-elevated)',
      label: 'Offline',
      icon: (
        <circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.5" />
      ),
    },
    connecting: {
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-light)',
      label: 'Connecting...',
      icon: (
        <circle cx="6" cy="6" r="5" fill="currentColor">
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      ),
    },
    connected: {
      color: 'var(--color-primary)',
      bgColor: 'var(--color-primary-light)',
      label: 'Connected',
      icon: <circle cx="6" cy="6" r="5" fill="currentColor" />,
    },
    error: {
      color: 'var(--color-danger)',
      bgColor: 'var(--color-danger-light)',
      label: 'Error',
      icon: (
        <g>
          <circle cx="6" cy="6" r="5" fill="currentColor" />
          <text
            x="6"
            y="9"
            textAnchor="middle"
            fontSize="8"
            fill="white"
            fontWeight="bold"
          >
            !
          </text>
        </g>
      ),
    },
  };

  const config = statusConfig[status];

  if (compact) {
    return (
      <div
        title={error || config.label}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{ color: config.color }}
        >
          {config.icon}
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: config.bgColor,
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--font-size-sm)',
        color: config.color,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12">
        {config.icon}
      </svg>
      <span>{error || config.label}</span>
    </div>
  );
}

/**
 * Player connection indicator
 */
export function PlayerConnectionIndicator({
  isConnected,
  size = 8,
}: {
  isConnected: boolean;
  size?: number;
}) {
  return (
    <div
      title={isConnected ? 'Online' : 'Offline'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: isConnected
          ? 'var(--color-primary)'
          : 'var(--color-text-secondary)',
        opacity: isConnected ? 1 : 0.5,
      }}
    />
  );
}

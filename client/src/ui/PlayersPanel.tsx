/**
 * PlayersPanel Component
 * Displays player list with turn indicator, scores, and status
 * Optimized for narrow sidebar layout
 */

import { motion } from 'framer-motion';
import type { PlayerState } from '../types/index.js';

interface PlayerConnection {
  id: string;
  isConnected: boolean;
}

interface PlayersPanelProps {
  players: PlayerState[];
  currentPlayerIndex: number;
  isFinalRound: boolean;
  targetScore: number;
  playerConnections?: PlayerConnection[];
}

export function PlayersPanel({
  players,
  currentPlayerIndex,
  isFinalRound,
  targetScore,
  playerConnections,
}: PlayersPanelProps) {
  const getConnectionStatus = (playerId: string): boolean => {
    const connection = playerConnections?.find(p => p.id === playerId);
    return connection?.isConnected ?? true;
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-md)' }}>👑</span>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
          }}
        >
          Players
        </h3>
      </div>

      {/* Player List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {players.map((player, index) => {
          const isCurrentTurn = index === currentPlayerIndex;
          const isConnected = getConnectionStatus(player.id);
          const isLeading = player.score === Math.max(...players.map(p => p.score)) && player.score > 0;

          return (
            <motion.div
              key={player.id}
              initial={false}
              animate={{
                backgroundColor: isCurrentTurn
                  ? 'var(--color-surface-elevated)'
                  : 'transparent',
              }}
              style={{
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-md)',
                border: isCurrentTurn ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              }}
            >
              {/* Top row: Avatar, Name, Score */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: player.isAI ? 'var(--color-accent)' : 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    opacity: isConnected ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>
                    {player.isAI ? '🤖' : '👤'}
                  </span>
                  {!isConnected && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 10,
                        height: 10,
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--color-warning)',
                        border: '2px solid var(--color-surface)',
                      }}
                    />
                  )}
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: isConnected ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {player.name}
                  </div>
                </div>

                {/* Score */}
                <div
                  style={{
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-md)',
                      fontWeight: 'var(--font-weight-bold)',
                      color: isLeading ? 'var(--color-primary)' : 'var(--color-text)',
                    }}
                  >
                    {player.score.toLocaleString()}
                  </span>
                  {isLeading && <span style={{ marginLeft: 2 }}>👑</span>}
                </div>
              </div>

              {/* Bottom row: Status badges */}
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-1)',
                  marginTop: 'var(--space-1)',
                  marginLeft: 40, // Align with name (avatar width + gap)
                }}
              >
                {isCurrentTurn && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'white',
                      backgroundColor: 'var(--color-success)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    Turn
                  </span>
                )}
                {!player.isOnBoard && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'var(--color-surface-hover)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Not on board
                  </span>
                )}
                {isFinalRound && player.score >= targetScore && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-warning)',
                      backgroundColor: 'var(--color-warning-light)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Final round
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 'var(--space-3)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {players.length} player{players.length !== 1 ? 's' : ''} in game
        {isFinalRound && (
          <span style={{ color: 'var(--color-warning)', marginLeft: 'var(--space-2)' }}>
            • Final Round
          </span>
        )}
      </div>
    </div>
  );
}

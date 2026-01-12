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
        background: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 'var(--radius-2xl)',
        padding: 'var(--space-4)',
        border: '1px solid var(--color-border)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)' }}>👑</span>
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-base)',
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
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(30, 41, 59, 0.3)',
              }}
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-xl)',
                border: isCurrentTurn ? '2px solid #10b981' : '1px solid var(--color-border)',
                boxShadow: isCurrentTurn ? '0 0 15px rgba(16, 185, 129, 0.15)' : 'none',
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
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-full)',
                    background: player.isAI
                      ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                      : 'linear-gradient(135deg, #3b82f6, #2563eb)',
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
                        width: 12,
                        height: 12,
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: '#f59e0b',
                        border: '2px solid rgba(30, 41, 59, 0.9)',
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
                      color: isLeading ? '#10b981' : 'var(--color-text)',
                    }}
                  >
                    {player.score.toLocaleString()}
                  </span>
                  {isLeading && <span style={{ marginLeft: 4 }}>👑</span>}
                </div>
              </div>

              {/* Bottom row: Status badges */}
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-1)',
                  marginTop: 'var(--space-2)',
                  marginLeft: 44, // Align with name (avatar width + gap)
                }}
              >
                {isCurrentTurn && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'white',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
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
                      backgroundColor: 'rgba(30, 41, 59, 0.5)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      whiteSpace: 'nowrap',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    Not on board
                  </span>
                )}
                {isFinalRound && player.score >= targetScore && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#f59e0b',
                      background: 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      whiteSpace: 'nowrap',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
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
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {players.length} player{players.length !== 1 ? 's' : ''} in game
        {isFinalRound && (
          <span
            style={{
              color: '#f59e0b',
              marginLeft: 'var(--space-2)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            • Final Round
          </span>
        )}
      </div>
    </div>
  );
}

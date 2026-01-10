import { motion } from 'framer-motion';
import type { PlayerState } from '../types/index.js';
import { TARGET_SCORE } from '../engine/constants.js';
import { useI18n } from '../i18n/index.js';

interface PlayerBarProps {
  players: PlayerState[];
  currentPlayerIndex: number;
  isFinalRound: boolean;
}

/**
 * PlayerBar - Compact horizontal player standings
 *
 * Design Philosophy:
 * - Always visible without taking focus from game
 * - Current player highlighted
 * - Leader marked with crown
 * - Scrollable if many players
 */
export function PlayerBar({ players, currentPlayerIndex, isFinalRound }: PlayerBarProps) {
  const { t } = useI18n();

  // Find leader
  const leader = players.reduce((a, b) => a.score > b.score ? a : b);

  return (
    <section
      aria-label="Player standings"
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-3)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header with Final Round indicator */}
      {isFinalRound && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            textAlign: 'center',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-bold)',
              padding: 'var(--space-1) var(--space-3)',
              background: 'var(--color-danger)',
              color: 'white',
              borderRadius: 'var(--radius-full)',
              textTransform: 'uppercase',
            }}
          >
            {t('finalRound')}
          </span>
        </motion.div>
      )}

      {/* Player pills - horizontal scrollable */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: 'var(--space-1)',
          margin: 'calc(-1 * var(--space-1))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {players.map((player, index) => {
          const isCurrent = index === currentPlayerIndex;
          const isLeader = player.id === leader.id && player.score > 0;
          const progress = Math.min(100, (player.score / TARGET_SCORE) * 100);

          return (
            <motion.div
              key={player.id}
              animate={{
                scale: isCurrent ? 1.02 : 1,
              }}
              style={{
                flex: players.length <= 4 ? 1 : '0 0 auto',
                minWidth: players.length <= 4 ? 0 : 120,
                padding: 'var(--space-2) var(--space-3)',
                background: isCurrent
                  ? 'var(--color-primary-light)'
                  : 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-lg)',
                border: isCurrent
                  ? '2px solid var(--color-primary)'
                  : '2px solid transparent',
                scrollSnapAlign: 'start',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
            >
              {/* Name row with badges */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
                  {isLeader && <span title={t('leader')}>👑</span>}
                  {isCurrent && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: isCurrent ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {player.name}
                  </span>
                  {player.isAI && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        padding: '1px 4px',
                        background: 'var(--color-accent-light)',
                        color: 'var(--color-accent)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      AI
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-bold)',
                    flexShrink: 0,
                  }}
                >
                  {player.score >= 1000 ? `${(player.score / 1000).toFixed(1)}K` : player.score}
                </span>
              </div>

              {/* Mini progress bar */}
              {player.score > 0 && (
                <div
                  style={{
                    height: 3,
                    background: 'var(--color-surface-active)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    style={{
                      height: '100%',
                      background: isCurrent
                        ? 'var(--color-primary)'
                        : 'var(--color-secondary)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              )}

              {/* Not on board indicator */}
              {!player.isOnBoard && (
                <span
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--color-warning)',
                    textAlign: 'center',
                  }}
                >
                  {t('notOnBoard')}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

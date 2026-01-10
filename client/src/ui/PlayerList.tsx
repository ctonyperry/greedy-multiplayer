import { motion } from 'framer-motion';
import type { PlayerState } from '../types/index.js';
import { TARGET_SCORE } from '../engine/constants.js';
import { useI18n } from '../i18n/index.js';

interface PlayerListProps {
  players: PlayerState[];
  currentPlayerIndex: number;
  isFinalRound: boolean;
}

/**
 * PlayerList - Shows all players and their scores
 *
 * Features:
 * - Clear current player indicator
 * - Visual progress toward winning
 * - Final round warning
 * - Compact but readable on mobile
 */
export function PlayerList({ players, currentPlayerIndex, isFinalRound }: PlayerListProps) {
  const { t } = useI18n();

  // Sort players by score for ranking display
  const rankedPlayers = [...players]
    .map((player, index) => ({ ...player, originalIndex: index }))
    .sort((a, b) => b.score - a.score);

  const leader = rankedPlayers[0];

  return (
    <section
      aria-label="Player scores"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-4)',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-2)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          {t('players')}
        </h3>
        {isFinalRound && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-bold)',
              padding: 'var(--space-1) var(--space-2)',
              background: 'var(--color-danger)',
              color: 'white',
              borderRadius: 'var(--radius-sm)',
              textTransform: 'uppercase',
            }}
          >
            {t('finalRound')}
          </motion.span>
        )}
      </header>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {players.map((player, index) => {
          const isCurrent = index === currentPlayerIndex;
          const isLeader = player.id === leader.id && player.score > 0;
          const progress = Math.min(100, (player.score / TARGET_SCORE) * 100);

          return (
            <motion.li
              key={player.id}
              animate={{
                scale: isCurrent ? 1 : 0.98,
                opacity: isCurrent ? 1 : 0.8,
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                padding: 'var(--space-3)',
                background: isCurrent
                  ? 'var(--color-primary-light)'
                  : 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-lg)',
                border: isCurrent
                  ? '2px solid var(--color-primary)'
                  : '2px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {/* Current player indicator */}
                  {isCurrent && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: isCurrent ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {player.name}
                  </span>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                    {player.isAI && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 6px',
                          background: 'var(--color-accent-light)',
                          color: 'var(--color-accent)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        AI
                      </span>
                    )}
                    {!player.isOnBoard && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 6px',
                          background: 'var(--color-warning-light)',
                          color: 'var(--color-warning)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {t('notOnBoard')}
                      </span>
                    )}
                    {isLeader && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 6px',
                          background: 'var(--color-primary-light)',
                          color: 'var(--color-primary)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {t('leader')}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-bold)',
                    marginLeft: 'var(--space-2)',
                    flexShrink: 0,
                  }}
                >
                  {player.score.toLocaleString()}
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
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

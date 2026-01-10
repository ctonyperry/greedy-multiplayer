import { motion } from 'framer-motion';
import type { GameState } from '../types/index.js';
import { getWinner } from '../engine/game.js';
import { useI18n } from '../i18n/index.js';

interface GameOverProps {
  gameState: GameState;
  onNewGame: () => void;
}

/**
 * GameOver - Victory screen with final standings
 *
 * Features:
 * - Celebration animation for winner
 * - Clear final standings
 * - Accessible results table
 * - Large, easy-to-tap new game button
 */
export function GameOver({ gameState, onNewGame }: GameOverProps) {
  const { t } = useI18n();
  const winner = getWinner(gameState);
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-6)',
        padding: 'var(--space-5)',
        maxWidth: 500,
        margin: '0 auto',
      }}
    >
      {/* Title */}
      <motion.h1
        initial={{ y: -30 }}
        animate={{ y: 0 }}
        style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          margin: 0,
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center',
        }}
      >
        {t('gameOver')}
      </motion.h1>

      {/* Winner Card */}
      {winner && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2, stiffness: 200, damping: 15 }}
          className="animate-celebrate"
          style={{
            width: '100%',
            padding: 'var(--space-6)',
            background: 'var(--color-primary-light)',
            borderRadius: 'var(--radius-2xl)',
            border: '2px solid var(--color-primary)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {t('winner')}
          </span>
          <h2
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              margin: 'var(--space-2) 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            {winner.name}
            {winner.isAI && (
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  padding: 'var(--space-1) var(--space-2)',
                  background: 'var(--color-accent)',
                  color: 'white',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                AI
              </span>
            )}
          </h2>
          <span
            style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-primary)',
            }}
          >
            {winner.score.toLocaleString()} {t('points')}
          </span>
        </motion.div>
      )}

      {/* Final Standings */}
      <section
        style={{
          width: '100%',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-4)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h3
          style={{
            margin: '0 0 var(--space-4)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          {t('finalStandings')}
        </h3>

        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {sortedPlayers.map((player, index) => (
            <motion.li
              key={player.id}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: index === 0 ? 'var(--color-primary-light)' : 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              {/* Position badge */}
              <span
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    index === 0
                      ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      : index === 1
                      ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                      : index === 2
                      ? 'linear-gradient(135deg, #d97706, #b45309)'
                      : 'var(--color-surface-active)',
                  borderRadius: '50%',
                  fontWeight: 'var(--font-weight-bold)',
                  fontSize: 'var(--font-size-base)',
                  color: index < 3 ? 'var(--color-background)' : 'var(--color-text-secondary)',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>

              {/* Player info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: index === 0 ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  {player.name}
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
                </span>
              </div>

              {/* Score */}
              <span
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-bold)',
                  flexShrink: 0,
                }}
              >
                {player.score.toLocaleString()}
              </span>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* New Game Button */}
      <motion.button
        onClick={onNewGame}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="btn btn-secondary btn-xl"
        style={{ width: '100%', maxWidth: 300 }}
      >
        {t('playAgain')}
      </motion.button>
    </motion.div>
  );
}

import { motion, AnimatePresence } from 'framer-motion';
import type { TurnState } from '../types/index.js';
import { ENTRY_THRESHOLD, TARGET_SCORE } from '../engine/constants.js';
import { useI18n } from '../i18n/index.js';

interface ScoreDisplayProps {
  turnState: TurnState;
  isOnBoard: boolean;
  playerScore: number;
}

/**
 * ScoreDisplay - Current turn and total score visualization
 *
 * Features:
 * - Large, readable numbers
 * - Visual progress bars
 * - Clear entry threshold indicator
 * - Animated score updates
 */
export function ScoreDisplay({ turnState, isOnBoard, playerScore }: ScoreDisplayProps) {
  const { t } = useI18n();
  const ownScore = turnState.turnScore - turnState.carryoverPoints;
  const needsEntry = !isOnBoard;
  const entryProgress = needsEntry ? Math.min(100, (ownScore / ENTRY_THRESHOLD) * 100) : 100;
  const targetProgress = Math.min(100, (playerScore / TARGET_SCORE) * 100);

  return (
    <section
      aria-label="Score display"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Turn Score */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {t('turnScore')}
          </span>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={turnState.turnScore}
              initial={{ scale: 1.3, color: 'var(--color-primary)' }}
              animate={{ scale: 1, color: 'var(--color-text-primary)' }}
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
              }}
            >
              {turnState.turnScore.toLocaleString()}
            </motion.span>
          </AnimatePresence>
        </div>

        {turnState.carryoverPoints > 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {t('includesCarryover', { points: turnState.carryoverPoints.toLocaleString() })}
          </p>
        )}
      </div>

      {/* Entry Progress (only show if not on board) */}
      {needsEntry && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('entryProgress')}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: entryProgress >= 100 ? 'var(--color-primary)' : 'var(--color-text-primary)',
              }}
            >
              {ownScore} / {ENTRY_THRESHOLD}
            </span>
          </div>
          <div
            style={{
              height: 10,
              background: 'var(--color-surface-active)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${entryProgress}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              style={{
                height: '100%',
                background: entryProgress >= 100
                  ? 'var(--color-primary)'
                  : 'var(--color-warning)',
                borderRadius: 'var(--radius-full)',
              }}
            />
          </div>
          {entryProgress < 100 && (
            <p
              style={{
                margin: 'var(--space-2) 0 0',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-warning)',
              }}
            >
              {t('needMoreToBoard', { points: ENTRY_THRESHOLD - ownScore })}
            </p>
          )}
          {entryProgress >= 100 && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                margin: 'var(--space-2) 0 0',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {t('readyToBoard')}
            </motion.p>
          )}
        </div>
      )}

      {/* Total Score Progress */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: 'var(--space-3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {t('totalScore')}
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-bold)',
            }}
          >
            {playerScore.toLocaleString()} / {TARGET_SCORE.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: 'var(--color-surface-active)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${targetProgress}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-secondary), var(--color-accent))',
              borderRadius: 'var(--radius-full)',
            }}
          />
        </div>
      </div>

      {/* Dice Remaining */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: turnState.diceRemaining === 5 ? 'var(--color-primary)' : 'var(--color-text-primary)',
          }}
        >
          {turnState.diceRemaining}
        </span>
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {t('diceRemaining')}
        </span>
      </div>
    </section>
  );
}

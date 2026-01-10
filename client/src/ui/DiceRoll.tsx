import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Die } from './Die.js';
import type { Dice, DieValue } from '../types/index.js';
import { getSelectableIndices } from '../engine/validation.js';
import { scoreSelection } from '../engine/scoring.js';
import { useI18n } from '../i18n/index.js';

interface DiceRollProps {
  dice: Dice;
  diceRemaining: number;
  onSelectionChange: (selectedIndices: number[]) => void;
  onRoll?: () => void;
  canRoll?: boolean;
  disabled?: boolean;
  rolling?: boolean;
  aiKeptDice?: Dice;
  selectedCount?: number;
  showHints?: boolean;
}

/**
 * DiceRoll component - Main dice interaction area
 *
 * Features:
 * - Mobile-first responsive layout
 * - Clear visual separation between rollable and kept dice
 * - Scoring hints for new players
 * - Smooth animations between states
 * - Large touch targets for all dice
 */
export function DiceRoll({
  dice,
  diceRemaining,
  onSelectionChange,
  onRoll,
  canRoll = false,
  disabled,
  rolling,
  aiKeptDice,
  selectedCount = 0,
  showHints = false,
}: DiceRollProps) {
  const { t } = useI18n();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const prevDiceRef = useRef<string>('');
  const [lastRolledValues, setLastRolledValues] = useState<DieValue[]>([]);

  // Reset selection when dice actually change (new roll)
  useEffect(() => {
    const diceKey = JSON.stringify(dice);
    if (diceKey !== prevDiceRef.current) {
      prevDiceRef.current = diceKey;
      setSelectedIndices(new Set());
      onSelectionChange([]);
      if (dice.length > 0) {
        setLastRolledValues([...dice]);
      }
    }
  }, [dice, onSelectionChange]);

  // Calculate which dice are selectable based on current selection
  const selectableIndices = useMemo(() => {
    if (disabled || rolling || dice.length === 0) {
      return new Set<number>();
    }
    return getSelectableIndices(dice, Array.from(selectedIndices));
  }, [dice, selectedIndices, disabled, rolling]);

  // Calculate which dice would score if selected (for hints)
  const scoringIndices = useMemo(() => {
    if (!showHints || disabled || rolling || dice.length === 0) {
      return new Set<number>();
    }
    const scoring = new Set<number>();
    dice.forEach((value, index) => {
      if (value === 1 || value === 5) {
        scoring.add(index);
      }
    });
    // Check for triples
    const counts = new Map<DieValue, number[]>();
    dice.forEach((value, index) => {
      const indices = counts.get(value) || [];
      indices.push(index);
      counts.set(value, indices);
    });
    counts.forEach((indices) => {
      if (indices.length >= 3) {
        indices.forEach(i => scoring.add(i));
      }
    });
    return scoring;
  }, [dice, showHints, disabled, rolling]);

  const toggleDie = (index: number) => {
    if (disabled || rolling) return;
    if (!selectableIndices.has(index)) return;

    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const isAITurn = aiKeptDice !== undefined;

  // Split dice into roll section and keep section
  const rollDice = dice.map((value, index) => ({ value, index })).filter(d => !selectedIndices.has(d.index));
  const keepDice = isAITurn
    ? []
    : dice.map((value, index) => ({ value, index })).filter(d => selectedIndices.has(d.index));

  // Calculate placeholders
  const actualDiceInRoll = rollDice.length;
  const diceAfterKeeping = diceRemaining - selectedCount;
  const placeholderCount = dice.length === 0 ? diceRemaining : Math.max(0, diceAfterKeeping - actualDiceInRoll);

  // Get roll button text
  const getRollButtonText = () => {
    if (rolling) return t('rolling');
    if (selectedCount > 0) {
      if (diceAfterKeeping === 0) return t('hotDice');
      return t('keepAndRoll', { count: diceAfterKeeping });
    }
    if (dice.length === 0) return t('rollDice');
    return t('roll', { count: diceRemaining });
  };

  // Calculate selection score for feedback
  const selectionScore = useMemo(() => {
    if (selectedIndices.size === 0) return 0;
    const selectedDice = Array.from(selectedIndices).map(i => dice[i]);
    return scoreSelection(selectedDice).score;
  }, [selectedIndices, dice]);

  return (
    <LayoutGroup>
      <div
        className="dice-roll-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Roll Section */}
        <section
          aria-label="Dice to roll"
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-4)',
            minHeight: 120,
            position: 'relative',
          }}
        >
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {dice.length === 0 ? t('readyToRoll') : t('tapDiceToKeep')}
            </span>
            {dice.length > 0 && selectionScore === 0 && !isAITurn && (
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {t('selectScoringDice')}
              </span>
            )}
          </header>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
              flexWrap: 'wrap',
              minHeight: 'var(--die-size)',
              alignItems: 'center',
              padding: 'var(--space-2) 0',
            }}
          >
            <AnimatePresence mode="popLayout">
              {/* Rolled dice */}
              {rollDice.map(({ value, index }) => {
                const isSelectable = selectableIndices.has(index);
                const isScoring = scoringIndices.has(index);
                return (
                  <motion.div
                    key={`die-${index}`}
                    layoutId={`die-${index}`}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <Die
                      value={value}
                      selected={false}
                      disabled={disabled || !isSelectable}
                      onClick={() => toggleDie(index)}
                      rolling={rolling}
                      scoringHint={showHints && isScoring && !disabled}
                    />
                  </motion.div>
                );
              })}

              {/* Placeholder dice */}
              {Array.from({ length: placeholderCount }).map((_, i) => {
                const placeholderValue = (lastRolledValues[rollDice.length + i] ||
                  ((Math.floor(Math.random() * 6) + 1) as DieValue));
                return (
                  <motion.div
                    key={`placeholder-${i}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <Die
                      value={placeholderValue}
                      disabled={true}
                      dimmed={true}
                      rolling={rolling}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Empty state */}
            {dice.length === 0 && placeholderCount === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-base)',
                  textAlign: 'center',
                }}
              >
                {t('pressToRoll')}
              </motion.p>
            )}
          </div>

          {/* Roll Button - Part of the roll area for mobile UX */}
          {onRoll && canRoll && !isAITurn && (
            <motion.button
              onClick={onRoll}
              disabled={rolling}
              className="btn btn-primary btn-lg"
              whileHover={rolling ? {} : { scale: 1.02 }}
              whileTap={rolling ? {} : { scale: 0.98 }}
              style={{
                width: '100%',
                marginTop: 'var(--space-4)',
                background: selectedCount > 0
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))'
                  : 'linear-gradient(135deg, var(--color-secondary), var(--color-secondary-hover))',
                boxShadow: selectedCount > 0
                  ? 'var(--shadow-glow-primary), var(--shadow-md)'
                  : 'var(--shadow-glow-secondary), var(--shadow-md)',
              }}
              aria-label={getRollButtonText()}
            >
              {getRollButtonText()}
            </motion.button>
          )}

          {/* Waiting for AI */}
          {isAITurn && !rolling && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                textAlign: 'center',
                padding: 'var(--space-3)',
                color: 'var(--color-accent)',
                fontSize: 'var(--font-size-base)',
              }}
            >
              {t('aiThinking')}
            </motion.div>
          )}
        </section>

        {/* Keep Section - Shows selected dice */}
        <section
          aria-label="Dice being kept"
          style={{
            background: (keepDice.length > 0 || (aiKeptDice && aiKeptDice.length > 0))
              ? isAITurn ? 'var(--color-accent-light)' : 'var(--color-primary-light)'
              : 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-4)',
            border: (keepDice.length > 0 || (aiKeptDice && aiKeptDice.length > 0))
              ? isAITurn ? '2px solid var(--color-accent)' : '2px solid var(--color-primary)'
              : '2px dashed var(--color-border)',
            minHeight: 100,
            transition: 'all var(--transition-base)',
          }}
        >
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: (keepDice.length > 0 || (aiKeptDice && aiKeptDice.length > 0))
                  ? isAITurn ? 'var(--color-accent)' : 'var(--color-primary)'
                  : 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {isAITurn ? t('aiKeeping') : t('keeping')}
            </span>
            {selectionScore > 0 && !isAITurn && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-primary)',
                }}
              >
                +{selectionScore}
              </motion.span>
            )}
          </header>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
              flexWrap: 'wrap',
              minHeight: 'var(--die-size)',
              alignItems: 'center',
            }}
          >
            {/* Human turn: show selected dice */}
            {!isAITurn && (
              <AnimatePresence mode="popLayout">
                {keepDice.map(({ value, index }) => (
                  <motion.div
                    key={`die-${index}`}
                    layoutId={`die-${index}`}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <Die
                      value={value}
                      selected={true}
                      disabled={disabled}
                      onClick={() => toggleDie(index)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {/* AI turn: show kept dice */}
            {isAITurn && aiKeptDice && aiKeptDice.length > 0 && (
              <AnimatePresence mode="popLayout">
                {aiKeptDice.map((value, index) => (
                  <motion.div
                    key={`ai-kept-${index}`}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.1 }}
                  >
                    <Die
                      value={value}
                      selected={true}
                      disabled={true}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {/* Empty state messages */}
            {!isAITurn && keepDice.length === 0 && dice.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-base)',
                  textAlign: 'center',
                }}
              >
                {t('tapDiceAbove')}
              </motion.p>
            )}

            {!isAITurn && keepDice.length === 0 && dice.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--font-size-sm)',
                  textAlign: 'center',
                }}
              >
                {t('selectedDiceHere')}
              </motion.p>
            )}

            {isAITurn && (!aiKeptDice || aiKeptDice.length === 0) && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  color: 'var(--color-accent)',
                  fontSize: 'var(--font-size-base)',
                  textAlign: 'center',
                }}
              >
                {t('waitingForAI')}
              </motion.p>
            )}
          </div>
        </section>
      </div>
    </LayoutGroup>
  );
}

// Export supporting components
export interface TurnHistoryEntry {
  playerName: string;
  dice: Dice;
  score: number;
  busted: boolean;
  isAI: boolean;
}

interface TurnHistoryProps {
  history: TurnHistoryEntry[];
  currentTurnRolls: Dice[];
  currentTurnScore?: number;
  maxVisible?: number;
}

export function TurnHistory({
  history,
  currentTurnRolls,
  currentTurnScore = 0,
  maxVisible = 3,
}: TurnHistoryProps) {
  const { t } = useI18n();
  const hasCurrentTurn = currentTurnRolls.length > 0 || currentTurnScore > 0;
  const recentHistory = history.slice(-maxVisible);

  if (!hasCurrentTurn && recentHistory.length === 0) return null;

  return (
    <aside
      aria-label="Turn history"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
      }}
    >
      <h3
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          margin: 0,
        }}
      >
        {t('recentTurns')}
      </h3>

      {/* Current turn */}
      {hasCurrentTurn && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: 'var(--space-3)',
            background: 'var(--color-primary-light)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-primary)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: currentTurnRolls.length > 0 ? 'var(--space-2)' : 0,
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary)',
                fontWeight: 'var(--font-weight-bold)',
              }}
            >
              {t('currentTurn')}
            </span>
            {currentTurnScore > 0 && (
              <span
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-primary)',
                }}
              >
                +{currentTurnScore}
              </span>
            )}
          </div>
          {currentTurnRolls.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {currentTurnRolls.map((rollDice, rollIndex) => (
                <div
                  key={rollIndex}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      minWidth: 16,
                    }}
                  >
                    {rollIndex + 1}.
                  </span>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    {rollDice.map((value, dieIndex) => (
                      <motion.div
                        key={dieIndex}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: dieIndex * 0.05 }}
                      >
                        <Die value={value} disabled size="sm" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Previous turns */}
      {recentHistory.slice().reverse().map((entry, index) => (
        <motion.div
          key={`history-${history.length - index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 - index * 0.2 }}
          style={{
            padding: 'var(--space-3)',
            background: entry.busted ? 'var(--color-danger-light)' : 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-lg)',
            border: entry.busted
              ? '1px solid var(--color-danger)'
              : '1px solid var(--color-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: entry.dice.length > 0 ? 'var(--space-2)' : 0,
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
            >
              {entry.playerName}
              {entry.isAI && (
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    background: 'var(--color-accent-light)',
                    color: 'var(--color-accent)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  AI
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-bold)',
                color: entry.busted ? 'var(--color-danger)' : 'var(--color-primary)',
              }}
            >
              {entry.busted ? t('bust') : `+${entry.score}`}
            </span>
          </div>
          {entry.dice.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
              {entry.dice.map((value, dieIndex) => (
                <div
                  key={dieIndex}
                  style={{
                    width: 24,
                    height: 24,
                    background: 'var(--color-surface-active)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {value}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </aside>
  );
}

// KeptDice component for showing banked dice
interface KeptDiceProps {
  dice: Dice;
}

export function KeptDice({ dice }: KeptDiceProps) {
  if (dice.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        padding: 'var(--space-4)',
        background: 'var(--color-primary-light)',
        borderRadius: 'var(--radius-xl)',
        justifyContent: 'center',
        flexWrap: 'wrap',
        border: '2px solid var(--color-primary)',
      }}
    >
      <span
        style={{
          width: '100%',
          textAlign: 'center',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {/* Banked This Turn - not currently translated but could be */}
      </span>
      {dice.map((value, index) => (
        <motion.div
          key={index}
          initial={{ scale: 0 }}
          animate={{ scale: 0.8 }}
        >
          <Die value={value} disabled size="sm" />
        </motion.div>
      ))}
    </div>
  );
}

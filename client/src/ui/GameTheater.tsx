import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { Die } from './Die.js';
import type { Dice, DieValue } from '../types/index.js';
import { TurnPhase } from '../types/index.js';
import { useI18n } from '../i18n/index.js';

/**
 * Group dice into scoring combinations for visual display
 */
interface DiceGroup {
  dice: DieValue[];
  type: 'triple' | 'quad' | 'quint' | 'sext' | 'straight' | 'singles';
  label?: string;
}

function groupKeptDice(dice: Dice): DiceGroup[] {
  if (dice.length === 0) return [];

  const groups: DiceGroup[] = [];
  const remaining = [...dice];

  // Check for straights first (1-2-3-4-5 or 2-3-4-5-6)
  const sorted = [...dice].sort((a, b) => a - b);
  const smallStraight = [1, 2, 3, 4, 5];
  const largeStraight = [2, 3, 4, 5, 6];

  const hasSmallStraight = smallStraight.every(v => sorted.includes(v as DieValue));
  const hasLargeStraight = largeStraight.every(v => sorted.includes(v as DieValue));

  if (dice.length >= 5 && hasSmallStraight) {
    groups.push({ dice: [1, 2, 3, 4, 5] as DieValue[], type: 'straight', label: '1-5' });
    smallStraight.forEach(v => {
      const idx = remaining.indexOf(v as DieValue);
      if (idx !== -1) remaining.splice(idx, 1);
    });
  } else if (dice.length >= 5 && hasLargeStraight) {
    groups.push({ dice: [2, 3, 4, 5, 6] as DieValue[], type: 'straight', label: '2-6' });
    largeStraight.forEach(v => {
      const idx = remaining.indexOf(v as DieValue);
      if (idx !== -1) remaining.splice(idx, 1);
    });
  }

  // Count remaining dice by value
  const counts = new Map<DieValue, number>();
  remaining.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));

  // Extract groups of 3+ of a kind
  counts.forEach((count, value) => {
    if (count >= 6) {
      groups.push({ dice: Array(6).fill(value), type: 'sext', label: `6×${value}` });
      for (let i = 0; i < 6; i++) {
        const idx = remaining.indexOf(value);
        if (idx !== -1) remaining.splice(idx, 1);
      }
    } else if (count >= 5) {
      groups.push({ dice: Array(5).fill(value), type: 'quint', label: `5×${value}` });
      for (let i = 0; i < 5; i++) {
        const idx = remaining.indexOf(value);
        if (idx !== -1) remaining.splice(idx, 1);
      }
    } else if (count >= 4) {
      groups.push({ dice: Array(4).fill(value), type: 'quad', label: `4×${value}` });
      for (let i = 0; i < 4; i++) {
        const idx = remaining.indexOf(value);
        if (idx !== -1) remaining.splice(idx, 1);
      }
    } else if (count >= 3) {
      groups.push({ dice: Array(3).fill(value), type: 'triple', label: `3×${value}` });
      for (let i = 0; i < 3; i++) {
        const idx = remaining.indexOf(value);
        if (idx !== -1) remaining.splice(idx, 1);
      }
    }
  });

  // Remaining singles (1s and 5s)
  if (remaining.length > 0) {
    groups.push({ dice: remaining, type: 'singles' });
  }

  return groups;
}

interface GameTheaterProps {
  // Player info
  playerName: string;
  isOnBoard: boolean;
  isAI: boolean;

  // Turn state
  turnPhase: TurnPhase;
  turnScore: number;
  carryoverPoints: number;
  hasCarryover: boolean;
  carryoverClaimed: boolean;
  diceRemaining: number;
  entryThreshold: number;

  // Dice state
  currentRoll: Dice | null;
  keptDice: Dice;
  selectedIndices: number[];
  selectableIndices: Set<number>;
  scoringIndices: Set<number>;
  selectionScore: number;

  // Handlers
  onDieClick: (index: number) => void;
  onRoll: () => void;
  onBank: () => void;
  onKeepAndBank: () => void;
  onDeclineCarryover: () => void;

  // State
  canRoll: boolean;
  canBank: boolean;
  canKeepAndBank: boolean;
  canDeclineCarryover: boolean;
  isRolling: boolean;
  isAIActing: boolean;
  showHints: boolean;
}

/**
 * GameTheater - Unified game interaction area
 *
 * Design Philosophy:
 * - Single focus container for all game actions
 * - Phase-adaptive instruction at the top (hero element)
 * - Dice area is the visual center
 * - Actions at the bottom, context-aware
 * - Teaches rules through visual emphasis
 */
export function GameTheater({
  playerName,
  isOnBoard,
  isAI,
  turnPhase,
  turnScore,
  carryoverPoints,
  hasCarryover,
  carryoverClaimed,
  diceRemaining,
  entryThreshold,
  currentRoll,
  keptDice,
  selectedIndices,
  selectableIndices,
  scoringIndices,
  selectionScore,
  onDieClick,
  onRoll,
  onBank,
  onKeepAndBank,
  onDeclineCarryover,
  canRoll,
  canBank,
  canKeepAndBank,
  canDeclineCarryover,
  isRolling,
  isAIActing,
  showHints,
}: GameTheaterProps) {
  const { t } = useI18n();

  // Group kept dice for visual display
  const keptDiceGroups = useMemo(() => groupKeptDice(keptDice), [keptDice]);

  // Detect Hot Dice state (all 5 dice available after keeping, but haven't rolled yet)
  // Only true in DECIDING phase when you have 5 fresh dice to roll
  const isHotDice = diceRemaining === 5 && keptDice.length > 0 && turnPhase === TurnPhase.DECIDING;

  // Calculate entry progress for players not on board (needed for instruction)
  const ownScore = turnScore - carryoverPoints;
  const entryProgress = !isOnBoard ? Math.min(100, (ownScore / entryThreshold) * 100) : 100;
  const needsEntryPoints = !isOnBoard && ownScore < entryThreshold;

  // Get phase-specific instruction (HERO element)
  const getInstruction = (): { text: string; emphasis: 'normal' | 'action' | 'celebration' | 'warning' } => {
    if (isAI) {
      if (isRolling) return { text: t('rolling'), emphasis: 'normal' };
      if (isAIActing) return { text: t('thinking'), emphasis: 'normal' };
      return { text: '', emphasis: 'normal' };
    }

    // Only show "bust" if phase is ENDED and turnScore is 0 (lost all points)
    // If turnScore > 0, they banked successfully
    if (turnPhase === TurnPhase.ENDED && turnScore === 0) {
      return { text: `${playerName} busted`, emphasis: 'warning' };
    }

    if (isHotDice && turnPhase === TurnPhase.DECIDING) {
      return { text: t('hotDice'), emphasis: 'celebration' };
    }

    switch (turnPhase) {
      case TurnPhase.ROLLING:
        return { text: t('rollToStart'), emphasis: 'action' };
      case TurnPhase.STEAL_REQUIRED:
        // Dynamic risk messaging based on dice count, showing pot value
        if (diceRemaining === 1) {
          return { text: t('luckyBreakLow', { count: 1, points: carryoverPoints.toLocaleString() }), emphasis: 'warning' };
        } else if (diceRemaining === 2) {
          return { text: t('luckyBreakMed', { points: carryoverPoints.toLocaleString() }), emphasis: 'action' };
        }
        return { text: t('luckyBreakHigh', { points: carryoverPoints.toLocaleString() }), emphasis: 'celebration' };
      case TurnPhase.KEEPING:
        if (selectedIndices.length === 0) {
          return { text: t('tapToKeep'), emphasis: 'action' };
        }
        // Show different message if player can't bank due to entry threshold
        if (needsEntryPoints) {
          return { text: t('keepRollingForEntry'), emphasis: 'warning' };
        }
        return { text: t('rollOrBank'), emphasis: 'normal' };
      case TurnPhase.DECIDING:
        // Show different message if player can't bank due to entry threshold
        if (needsEntryPoints) {
          return { text: t('keepRollingForEntry'), emphasis: 'warning' };
        }
        return { text: t('riskOrBank'), emphasis: 'action' };
      default:
        return { text: '', emphasis: 'normal' };
    }
  };

  const instruction = getInstruction();

  // Get roll button text - compact version
  const getRollButtonContent = () => {
    if (isRolling) return t('rolling');

    // Bonus roll (STEAL_REQUIRED) - show risk-focused label
    if (turnPhase === TurnPhase.STEAL_REQUIRED) {
      return '🎲 Risk It';
    }

    // Hot dice - keeping all dice triggers fresh 5
    if (isHotDice || (selectedIndices.length > 0 && diceRemaining - selectedIndices.length === 0)) {
      return '🔥 Hot Dice';
    }

    // Show dice count for roll
    if (selectedIndices.length > 0) {
      const remaining = diceRemaining - selectedIndices.length;
      return `🎲 Roll ${remaining}`;
    }

    if (!currentRoll || currentRoll.length === 0) {
      return `🎲 Roll ${diceRemaining}`;
    }

    return `🎲 Roll ${diceRemaining}`;
  };

  // Determine if roll button should show fire styling
  const showFireButton = isHotDice || (selectedIndices.length > 0 && diceRemaining - selectedIndices.length === 0);

  return (
    <motion.section
      className="game-theater"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-2xl)',
        border: isAI ? '2px solid var(--color-accent)' : '2px solid var(--color-primary)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Hero Instruction */}
      <header
        style={{
          padding: 'var(--space-2) var(--space-3)',
          background: instruction.emphasis === 'celebration'
            ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
            : instruction.emphasis === 'warning'
            ? 'var(--color-danger)'
            : instruction.emphasis === 'action'
            ? isAI ? 'var(--color-accent)' : 'var(--color-primary)'
            : 'var(--color-surface-hover)',
          textAlign: 'center',
        }}
      >
        {/* Player name and turn score */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: instruction.text ? 'var(--space-2)' : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: instruction.emphasis !== 'normal' ? 'white' : 'var(--color-text-primary)',
            }}>
              {t('turnOf', { name: playerName })}
            </span>
            {isAI && (
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'white',
                }}
              >
                AI
              </span>
            )}
          </div>
          {turnScore > 0 && (
            <motion.span
              key={turnScore}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: instruction.emphasis !== 'normal' ? 'white' : 'var(--color-primary)',
              }}
            >
              +{turnScore.toLocaleString()}
            </motion.span>
          )}
        </div>

        {/* Phase instruction */}
        {instruction.text && (
          <motion.p
            key={instruction.text}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              margin: 0,
              fontSize: instruction.emphasis === 'celebration' ? 'var(--font-size-lg)' : 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-bold)',
              color: instruction.emphasis !== 'normal' ? 'white' : 'var(--color-text-secondary)',
              textTransform: instruction.emphasis === 'celebration' ? 'uppercase' : 'none',
            }}
          >
            {instruction.emphasis === 'celebration' && '🔥 '}
            {instruction.text}
            {instruction.emphasis === 'celebration' && ' 🔥'}
          </motion.p>
        )}
      </header>

      {/* Dice Area */}
      <div style={{ padding: 'var(--space-2) var(--space-3)', flex: 1 }}>
        {/* Available Dice */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            justifyContent: 'center',
            flexWrap: 'wrap',
            minHeight: 'calc(var(--die-size) + var(--space-2))',
            alignItems: 'center',
            marginBottom: 'var(--space-2)',
          }}
        >
          <AnimatePresence mode="popLayout">
            {currentRoll && currentRoll.length > 0 ? (
              // Show actual dice
              currentRoll.map((value, index) => {
                const isSelected = selectedIndices.includes(index);
                const isSelectable = selectableIndices.has(index);
                const isScoring = scoringIndices.has(index);

                if (isSelected) return null; // Selected dice shown in "keeping" section

                return (
                  <motion.div
                    key={`die-${index}`}
                    layout
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                  >
                    <Die
                      value={value}
                      selected={false}
                      disabled={!isSelectable || isAI}
                      onClick={() => onDieClick(index)}
                      rolling={isRolling}
                      scoringHint={showHints && isScoring && !isAI}
                    />
                  </motion.div>
                );
              })
            ) : (
              // Show placeholder dice when waiting to roll
              Array.from({ length: diceRemaining }).map((_, i) => (
                <motion.div
                  key={`placeholder-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, transition: { delay: i * 0.05 } }}
                >
                  <Die
                    value={1 as DieValue}
                    disabled
                    dimmed
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Selection/Keeping Display */}
        <AnimatePresence>
          {(selectedIndices.length > 0 || keptDice.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: 'var(--color-primary-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                border: '1px solid var(--color-primary)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                {/* Kept/Selected Dice */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-primary)',
                    fontWeight: 'var(--font-weight-semibold)',
                    flexShrink: 0,
                  }}>
                    {t('keeping')}:
                  </span>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    {/* Show currently selected dice */}
                    {currentRoll && selectedIndices.map((index) => (
                      <motion.div
                        key={`selected-${index}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onDieClick(index)}
                      >
                        <Die
                          value={currentRoll[index]}
                          selected
                          size="sm"
                        />
                      </motion.div>
                    ))}
                    {/* Show previously kept dice - grouped by combination */}
                    {keptDiceGroups.map((group, groupIndex) => (
                      <div
                        key={`group-${groupIndex}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-1)',
                          ...(group.type !== 'singles' && {
                            padding: '3px 5px',
                            background: 'rgba(59, 130, 246, 0.12)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px dashed rgba(59, 130, 246, 0.35)',
                          }),
                          ...(groupIndex < keptDiceGroups.length - 1 && {
                            marginRight: 'var(--space-2)',
                          }),
                        }}
                        title={group.label}
                      >
                        {group.dice.map((value, dieIndex) => (
                          <motion.div key={`kept-${groupIndex}-${dieIndex}`}>
                            <Die
                              value={value}
                              disabled
                              size="sm"
                            />
                          </motion.div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Preview */}
                {selectionScore > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}
                  >
                    {/* Show carryover bonus when applicable */}
                    {hasCarryover && !carryoverClaimed ? (
                      <>
                        <span style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: 'var(--font-weight-bold)',
                          color: 'var(--color-primary)',
                        }}>
                          +{selectionScore + carryoverPoints}
                        </span>
                        <span style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                        }}>
                          ({selectionScore} + {carryoverPoints} bonus)
                        </span>
                      </>
                    ) : (
                      <span style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-primary)',
                      }}>
                        +{selectionScore}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entry Progress (only for players not on board) */}
        {needsEntryPoints && !isAI && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginBottom: 'var(--space-2)',
              padding: 'var(--space-2)',
              background: entryProgress >= 100 ? 'var(--color-primary-light)' : 'var(--color-warning-light)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${entryProgress >= 100 ? 'var(--color-primary)' : 'var(--color-warning)'}`,
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-1)',
            }}>
              <span style={{
                fontSize: 'var(--font-size-xs)',
                color: entryProgress >= 100 ? 'var(--color-primary)' : 'var(--color-warning)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                {entryProgress >= 100 ? t('readyToBoard') : t('entryProgress')}
              </span>
              <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-bold)',
              }}>
                {ownScore} / {entryThreshold}
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: 'rgba(0,0,0,0.1)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${entryProgress}%` }}
                style={{
                  height: '100%',
                  background: entryProgress >= 100 ? 'var(--color-primary)' : 'var(--color-warning)',
                  borderRadius: 'var(--radius-full)',
                }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Action Buttons */}
      {!isAI && turnPhase !== TurnPhase.ENDED && (
        <footer
          style={{
            padding: 'var(--space-2) var(--space-3)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {/* Primary action row - compact single line */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {/* Bank button */}
            {(canBank || canKeepAndBank) && (
              <motion.button
                onClick={canKeepAndBank ? onKeepAndBank : onBank}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-warning"
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-base)',
                }}
              >
                💰 {(() => {
                  // Calculate total including unclaimed carryover bonus
                  const baseTotal = turnScore + selectionScore;
                  const unclaimedCarryover = hasCarryover && !carryoverClaimed ? carryoverPoints : 0;
                  const total = baseTotal + unclaimedCarryover;
                  return total > 0 ? total.toLocaleString() : t('bank');
                })()}
              </motion.button>
            )}

            {/* Roll button */}
            {canRoll && (
              <motion.button
                onClick={onRoll}
                disabled={isRolling}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`btn ${showFireButton ? 'btn-fire' : 'btn-primary'}`}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-base)',
                  background: showFireButton
                    ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                    : undefined,
                }}
              >
                {getRollButtonContent()}
              </motion.button>
            )}

            {/* Decline carryover - to the right of roll button */}
            {canDeclineCarryover && (
              <motion.button
                onClick={onDeclineCarryover}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-ghost"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-sm)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('declineStartFresh')}
              </motion.button>
            )}
          </div>
        </footer>
      )}

      {/* AI acting indicator */}
      {isAI && !isRolling && (
        <footer
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
          }}
        >
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-accent)',
            }}
          >
            {t('aiThinking')}
          </motion.div>
        </footer>
      )}
    </motion.section>
  );
}

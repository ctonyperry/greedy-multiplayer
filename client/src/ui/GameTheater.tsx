import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { Die } from './Die.js';
import type { Dice, DieValue } from '../types/index.js';
import { TurnPhase } from '../types/index.js';

/**
 * Calculate which dice indices are "dead" (can't contribute to any score)
 * Dead dice: not 1, not 5, and not part of a potential triple
 */
function getDeadDiceIndices(dice: Dice): Set<number> {
  const deadIndices = new Set<number>();
  const counts = new Map<DieValue, number>();
  dice.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));

  dice.forEach((value, index) => {
    if (value === 1 || value === 5) return;
    const count = counts.get(value) || 0;
    if (count >= 3) return;
    deadIndices.add(index);
  });

  return deadIndices;
}

interface GameTheaterProps {
  playerName: string;
  isOnBoard: boolean;
  isAI: boolean;
  isMyTurn: boolean;
  turnPhase: TurnPhase;
  turnScore: number;
  carryoverPoints: number;
  hasCarryover: boolean;
  carryoverClaimed: boolean;
  diceRemaining: number;
  entryThreshold: number;
  currentRoll: Dice | null;
  keptDice: Dice;
  selectedIndices: number[];
  selectableIndices: Set<number>;
  scoringIndices: Set<number>;
  selectionScore: number;
  onDieClick: (index: number) => void;
  onRoll: () => void;
  onBank: () => void;
  onKeepAndBank: () => void;
  onDeclineCarryover: () => void;
  canRoll: boolean;
  canBank: boolean;
  canKeepAndBank: boolean;
  canDeclineCarryover: boolean;
  isRolling: boolean;
  isAIActing: boolean;
  showHints: boolean;
}

/**
 * GameTheater - Simplified game interaction area
 * Based on Figma mockup design
 */
export function GameTheater({
  playerName,
  isOnBoard,
  isAI,
  isMyTurn,
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
  // Calculate dead dice for dimming
  const deadDiceIndices = useMemo(() => {
    if (!currentRoll || currentRoll.length === 0) return new Set<number>();
    return getDeadDiceIndices(currentRoll);
  }, [currentRoll]);

  // Detect Hot Dice state
  const isHotDice = diceRemaining === 5 && keptDice.length > 0 && turnPhase === TurnPhase.DECIDING;

  // Calculate entry progress
  const ownScore = turnScore - (hasCarryover && carryoverClaimed ? carryoverPoints : 0);
  const entryProgress = !isOnBoard ? Math.min(100, (ownScore / entryThreshold) * 100) : 100;
  const pointsNeeded = Math.max(0, entryThreshold - ownScore);

  // Calculate total that would be banked
  const totalToBank = turnScore + selectionScore;

  // Get instruction text
  const getInstruction = (): string => {
    if (isAI || isAIActing) {
      return isAIActing ? `${playerName} is thinking...` : '';
    }

    if (!isMyTurn) {
      if (turnPhase === TurnPhase.ENDED && turnScore > 0) {
        return `Banked ${turnScore.toLocaleString()} points!`;
      }
      if (turnPhase === TurnPhase.ENDED && turnScore === 0) {
        return 'Busted!';
      }
      return `Waiting for ${playerName}...`;
    }

    // Active player
    switch (turnPhase) {
      case TurnPhase.ROLLING:
        return 'Roll the dice to start your turn';
      case TurnPhase.STEAL_REQUIRED:
        return hasCarryover && !currentRoll
          ? `${carryoverPoints.toLocaleString()} points up for grabs!`
          : 'Select scoring dice to claim the pot';
      case TurnPhase.KEEPING:
        if (selectedIndices.length === 0) {
          return 'Tap dice to select them';
        }
        return !isOnBoard && pointsNeeded > 0
          ? `${pointsNeeded.toLocaleString()} more to get on board`
          : 'Roll again or bank your points';
      case TurnPhase.DECIDING:
        if (isHotDice) {
          return 'Hot Dice! Roll all 5 again!';
        }
        return !isOnBoard && pointsNeeded > 0
          ? `${pointsNeeded.toLocaleString()} more to get on board`
          : 'Roll again or bank your points';
      case TurnPhase.ENDED:
        return turnScore > 0 ? `Banked ${turnScore.toLocaleString()} points!` : 'Busted!';
      default:
        return '';
    }
  };

  // Get roll button text
  const getRollButtonText = (): string => {
    if (isRolling) return 'Rolling...';
    if (turnPhase === TurnPhase.STEAL_REQUIRED && !currentRoll) return 'Risk It!';
    if (isHotDice) return 'Hot Dice! Roll 5';

    const remaining = selectedIndices.length > 0
      ? diceRemaining - selectedIndices.length
      : diceRemaining;

    // If all dice selected, you get hot dice (roll all 5 again)
    if (remaining === 0 && selectedIndices.length > 0) {
      return 'Roll 5';
    }

    return `Roll ${remaining}`;
  };

  // Determine if we're in a "bust" state
  const isBust = turnPhase === TurnPhase.ENDED && turnScore === 0;
  const isSuccess = turnPhase === TurnPhase.ENDED && turnScore > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header - Player name and instruction */}
      <header
        style={{
          padding: 'var(--space-4)',
          textAlign: 'center',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: isBust ? 'var(--color-danger)' : isSuccess ? 'var(--color-success)' : 'var(--color-text)',
          }}
        >
          {playerName}'s Turn
          {isAI && (
            <span
              style={{
                marginLeft: 'var(--space-2)',
                fontSize: 'var(--font-size-sm)',
                background: 'var(--color-accent)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                verticalAlign: 'middle',
              }}
            >
              AI
            </span>
          )}
        </h2>
        <p
          style={{
            margin: 'var(--space-2) 0 0 0',
            fontSize: 'var(--font-size-sm)',
            color: isBust ? 'var(--color-danger)' : 'var(--color-text-secondary)',
          }}
        >
          {getInstruction()}
        </p>
      </header>

      {/* Dice Area */}
      <div style={{ padding: 'var(--space-4)', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            gap: 'clamp(4px, 1vw, var(--space-2))',
            justifyContent: 'center',
            flexWrap: 'nowrap',
            minHeight: 'calc(var(--die-size) + var(--space-2))',
            alignItems: 'center',
          }}
        >
          <AnimatePresence mode="popLayout">
            {currentRoll && currentRoll.length > 0 ? (
              currentRoll.map((value, index) => {
                const isSelected = selectedIndices.includes(index);
                const isSelectable = selectableIndices.has(index);
                const isScoring = scoringIndices.has(index);
                const isDead = deadDiceIndices.has(index);

                if (isSelected) return null;

                return (
                  <motion.div
                    key={`die-${index}`}
                    layout
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    style={{
                      opacity: isDead && !isAI ? 0.4 : 1,
                      filter: isDead && !isAI ? 'grayscale(50%)' : 'none',
                    }}
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
              // Placeholder dice when no roll yet
              Array.from({ length: diceRemaining }).map((_, i) => (
                <motion.div
                  key={`placeholder-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, transition: { delay: i * 0.05 } }}
                >
                  <Die value={1 as DieValue} disabled dimmed />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Selected dice display */}
        <AnimatePresence>
          {selectedIndices.length > 0 && currentRoll && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(4px, 1vw, var(--space-2))',
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2)',
                background: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                maxWidth: '100%',
                overflowX: 'auto',
                flexWrap: 'nowrap',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Selected:
              </span>
              {selectedIndices.map((index) => (
                <motion.div
                  key={`selected-${index}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{ transform: 'scale(0.7)', flexShrink: 0 }}
                >
                  <Die
                    value={currentRoll[index]}
                    selected
                    onClick={() => onDieClick(index)}
                  />
                </motion.div>
              ))}
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-success)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                +{selectionScore}
                {hasCarryover && !carryoverClaimed && carryoverPoints > 0 && (
                  <span style={{ color: 'var(--color-warning)' }}>
                    {' '}+{carryoverPoints.toLocaleString()} pot = {(selectionScore + carryoverPoints).toLocaleString()}
                  </span>
                )}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kept dice this turn */}
        <AnimatePresence>
          {keptDice.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 'clamp(2px, 0.5vw, var(--space-2))',
                marginTop: 'var(--space-2)',
                padding: 'var(--space-2)',
                background: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                maxWidth: '100%',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Kept:
              </span>
              {keptDice.map((value, i) => (
                <motion.div
                  key={`kept-${i}`}
                  style={{ transform: 'scale(0.55)', flexShrink: 0, margin: '-4px' }}
                >
                  <Die value={value} disabled />
                </motion.div>
              ))}
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-primary)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {turnScore.toLocaleString()} pts
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Entry Threshold Progress (when not on board) */}
      {!isOnBoard && isMyTurn && turnPhase !== TurnPhase.ENDED && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface-elevated)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--font-size-lg)',
              }}
            >
              🎯
            </div>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-warning)' }}>
                Getting on the Board
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Score {entryThreshold.toLocaleString()}+ in one turn to start
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 8,
              background: 'var(--color-border)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginBottom: 'var(--space-1)',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${entryProgress}%` }}
              style={{
                height: '100%',
                background: entryProgress >= 100
                  ? 'var(--color-success)'
                  : 'linear-gradient(90deg, var(--color-warning), var(--color-primary))',
                borderRadius: 'var(--radius-full)',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            <span>{ownScore.toLocaleString()} / {entryThreshold.toLocaleString()}</span>
            <span style={{ color: 'var(--color-warning)' }}>({pointsNeeded.toLocaleString()} more)</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isMyTurn && turnPhase !== TurnPhase.ENDED && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          {/* Carryover choice buttons */}
          {turnPhase === TurnPhase.STEAL_REQUIRED && !currentRoll && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <motion.button
                onClick={onRoll}
                disabled={!canRoll}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn"
                style={{
                  padding: 'var(--space-3)',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 'var(--font-weight-bold)',
                }}
              >
                🎲 Risk It!
              </motion.button>
              <motion.button
                onClick={onDeclineCarryover}
                disabled={!canDeclineCarryover}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn"
                style={{
                  padding: 'var(--space-3)',
                  background: 'var(--color-surface)',
                  border: '2px solid var(--color-border)',
                }}
              >
                🛡️ Play Safe
              </motion.button>
            </div>
          )}

          {/* Normal action buttons */}
          {(turnPhase !== TurnPhase.STEAL_REQUIRED || currentRoll) && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {/* Bank button */}
              {(canBank || canKeepAndBank) && (
                <motion.button
                  onClick={canKeepAndBank ? onKeepAndBank : onBank}
                  disabled={!canBank && !canKeepAndBank}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  style={{
                    flex: 1,
                    padding: 'var(--space-3)',
                    background: 'var(--color-success)',
                    color: 'white',
                    border: 'none',
                    fontWeight: 'var(--font-weight-bold)',
                  }}
                >
                  💰 Bank {totalToBank.toLocaleString()}
                </motion.button>
              )}

              {/* Roll button */}
              <motion.button
                onClick={onRoll}
                disabled={!canRoll}
                whileHover={canRoll ? { scale: 1.02 } : {}}
                whileTap={canRoll ? { scale: 0.98 } : {}}
                className="btn"
                style={{
                  flex: canBank || canKeepAndBank ? 1 : 'auto',
                  width: canBank || canKeepAndBank ? undefined : '100%',
                  padding: 'var(--space-3)',
                  background: isHotDice
                    ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                    : 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 'var(--font-weight-bold)',
                  opacity: canRoll ? 1 : 0.5,
                  cursor: canRoll ? 'pointer' : 'not-allowed',
                }}
              >
                🎲 {getRollButtonText()}
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Opponent's turn - just show waiting state */}
      {!isMyTurn && !isAI && turnPhase !== TurnPhase.ENDED && (
        <div
          style={{
            padding: 'var(--space-4)',
            textAlign: 'center',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-elevated)',
          }}
        >
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Watching {playerName}'s turn...
          </motion.div>
        </div>
      )}
    </motion.section>
  );
}

/**
 * MultiplayerGameBoard Component
 * Real-time multiplayer game board using Socket.IO
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../hooks/useGame.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { useSocket } from '../../contexts/SocketContext.js';
import { GameTheater } from '../../ui/GameTheater.js';
import { PlayersPanel } from '../../ui/PlayersPanel.js';
import { TurnTimer, TurnTimerCompact } from './TurnTimer.js';
import { TurnPhase } from '../../types/index.js';
import type { DieValue, GameState } from '../../types/index.js';
import { canBank as checkCanBank } from '../../engine/turn.js';
import { validateKeep, getSelectableIndices } from '../../engine/validation.js';
import { scoreSelection } from '../../engine/scoring.js';
import { useI18n } from '../../i18n/index.js';
import { useToast } from '../../contexts/ToastContext.js';
import { api } from '../../services/api.js';

interface MultiplayerGameBoardProps {
  gameCode: string;
  onGameEnd?: (finalState: GameState) => void;
  showHints?: boolean;
}

export function MultiplayerGameBoard({
  gameCode,
  onGameEnd,
  showHints = false,
}: MultiplayerGameBoardProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { status: socketStatus, connect: reconnect, notifyDiceSelected } = useSocket();
  const {
    game,
    gameState,
    isLoading,
    error,
    isMyTurn,
    currentPlayer,
    turnStartedAt,
    effectiveTimeout,
    isCurrentPlayerAIControlled,
    bustEvent,
    isPaused,
    roll,
    keep,
    bank,
    declineCarryover,
  } = useGame(gameCode);

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(5);
  const [showMenu, setShowMenu] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle timeout warning countdown
  useEffect(() => {
    if (!showTimeoutWarning) return;

    const interval = setInterval(() => {
      setWarningCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowTimeoutWarning(false);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showTimeoutWarning]);

  // Clear warning when it's not my turn anymore
  useEffect(() => {
    if (!isMyTurn) {
      setShowTimeoutWarning(false);
      setWarningCountdown(5);
    }
  }, [isMyTurn]);

  // Callback for when timer hits 5 seconds
  const handleTimerWarning = useCallback(() => {
    if (isMyTurn && !isCurrentPlayerAIControlled) {
      setShowTimeoutWarning(true);
      setWarningCountdown(5);
    }
  }, [isMyTurn, isCurrentPlayerAIControlled]);

  // Reset selection when turn changes or dice change
  const prevDiceRef = useRef<string>('');
  useEffect(() => {
    if (gameState?.turn.currentRoll) {
      const diceKey = JSON.stringify(gameState.turn.currentRoll);
      if (diceKey !== prevDiceRef.current) {
        prevDiceRef.current = diceKey;
        setSelectedIndices([]);
      }
    }
  }, [gameState?.turn.currentRoll]);

  // Reset selection when player changes
  const prevPlayerIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (gameState && prevPlayerIndexRef.current !== gameState.currentPlayerIndex) {
      setSelectedIndices([]);
      prevPlayerIndexRef.current = gameState.currentPlayerIndex;
    }
  }, [gameState?.currentPlayerIndex]);

  // Notify when game ends
  useEffect(() => {
    if (gameState?.isGameOver) {
      onGameEnd?.(gameState);
    }
  }, [gameState?.isGameOver, gameState, onGameEnd]);

  // Scroll to top on load
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Calculate selectable indices
  const turn = gameState?.turn;
  const selectableIndices = useMemo(() => {
    if (!isMyTurn || !turn?.currentRoll || turn.currentRoll.length === 0) {
      return new Set<number>();
    }
    return getSelectableIndices(turn.currentRoll, selectedIndices);
  }, [turn?.currentRoll, selectedIndices, isMyTurn]);

  // Calculate scoring indices for hints
  const scoringIndices = useMemo(() => {
    if (!showHints || !isMyTurn || !turn?.currentRoll || turn.currentRoll.length === 0) {
      return new Set<number>();
    }
    const scoring = new Set<number>();
    turn.currentRoll.forEach((value, index) => {
      if (value === 1 || value === 5) {
        scoring.add(index);
      }
    });
    // Check for triples
    const counts = new Map<DieValue, number[]>();
    turn.currentRoll.forEach((value, index) => {
      const indices = counts.get(value) || [];
      indices.push(index);
      counts.set(value, indices);
    });
    counts.forEach((indices) => {
      if (indices.length >= 3) {
        indices.forEach((i) => scoring.add(i));
      }
    });
    return scoring;
  }, [turn?.currentRoll, showHints, isMyTurn]);

  // Calculate action availability
  const hasValidSelection = selectedIndices.length > 0 && turn?.currentRoll !== null;
  const canRoll = !!(
    isMyTurn &&
    turn &&
    (turn.phase === TurnPhase.ROLLING ||
      turn.phase === TurnPhase.DECIDING ||
      turn.phase === TurnPhase.STEAL_REQUIRED ||
      (turn.phase === TurnPhase.KEEPING && hasValidSelection))
  );

  const canBankNow = !!(
    isMyTurn &&
    turn &&
    currentPlayer &&
    turn.phase === TurnPhase.DECIDING &&
    checkCanBank(turn, currentPlayer.isOnBoard)
  );

  // Handle die click
  const handleDieClick = useCallback(
    (index: number) => {
      if (!isMyTurn) return;
      if (!selectableIndices.has(index)) return;

      setSelectedIndices((prev) => {
        if (prev.includes(index)) {
          return prev.filter((i) => i !== index);
        } else {
          return [...prev, index];
        }
      });

      // Notify server of dice selection activity (debounced timer reset)
      notifyDiceSelected(gameCode);
    },
    [isMyTurn, selectableIndices, notifyDiceSelected, gameCode]
  );

  // Handle keep action (select dice to keep) - currently unused, kept for future use
  const _handleKeep = useCallback(() => {
    if (!isMyTurn || !turn || selectedIndices.length === 0 || !turn.currentRoll) return;

    const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
    const validation = validateKeep(turn.currentRoll, selectedDice);

    if (!validation.valid) {
      showToast(validation.error || 'Invalid selection', 'error');
      return;
    }

    keep(selectedDice);
    setSelectedIndices([]);
  }, [isMyTurn, turn, selectedIndices, keep, showToast]);

  // Handle roll action
  const handleRoll = useCallback(() => {
    if (!canRoll || !turn) return;

    // If in KEEPING phase with selection, keep first then roll
    if (
      (turn.phase === TurnPhase.KEEPING || turn.phase === TurnPhase.STEAL_REQUIRED) &&
      selectedIndices.length > 0 &&
      turn.currentRoll
    ) {
      const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
      const validation = validateKeep(turn.currentRoll, selectedDice);

      if (!validation.valid) {
        showToast(validation.error || 'Invalid selection', 'error');
        return;
      }

      // Keep dice, then automatically roll
      keep(selectedDice);
      setSelectedIndices([]);
      // Send roll after a short delay to let server process keep
      setTimeout(() => roll(), 150);
    } else {
      // No selection or in DECIDING/ROLLING phase - just roll
      roll();
      setSelectedIndices([]);
    }
  }, [canRoll, turn, selectedIndices, keep, roll]);

  // Handle bank action
  const handleBank = useCallback(() => {
    if (!canBankNow) return;
    bank();
    setSelectedIndices([]);
  }, [canBankNow, bank]);

  // Handle decline carryover
  const handleDeclineCarryover = useCallback(() => {
    if (turn?.phase !== TurnPhase.STEAL_REQUIRED || !isMyTurn) return;
    declineCarryover();
    setSelectedIndices([]);
  }, [turn?.phase, isMyTurn, declineCarryover]);

  // Handle keep and bank
  const handleKeepAndBank = useCallback(() => {
    if (selectedIndices.length === 0 || !turn?.currentRoll || !isMyTurn) return;

    const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
    keep(selectedDice);
    setSelectedIndices([]);

    // After keep is processed, bank
    setTimeout(() => bank(), 100);
  }, [selectedIndices, turn?.currentRoll, isMyTurn, keep, bank]);

  // Handle forfeit
  const handleForfeit = useCallback(async () => {
    if (isForfeiting) return;
    setIsForfeiting(true);
    try {
      await api.forfeitGame(gameCode);
      showToast('You have forfeited the game', 'info');
      setShowForfeitConfirm(false);
      setShowMenu(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to forfeit', 'error');
    } finally {
      setIsForfeiting(false);
    }
  }, [gameCode, showToast, isForfeiting]);

  // Handle leave game (go back to home)
  const handleLeaveGame = useCallback(() => {
    window.location.href = window.location.origin;
  }, []);

  // Calculate selection score
  const selectedDice = turn?.currentRoll
    ? selectedIndices.map((i) => turn.currentRoll![i])
    : [];
  const selectionScore =
    selectedDice.length > 0 ? scoreSelection(selectedDice).score : 0;

  // Calculate if bank would be valid with current selection
  const wouldBankBeValid = (() => {
    if (selectionScore === 0 || !currentPlayer || !turn || !gameState) return false;
    if (currentPlayer.isOnBoard) return true;

    let ownScore: number;
    if (turn.hasCarryover && !turn.carryoverClaimed) {
      ownScore = selectionScore;
    } else {
      ownScore = turn.turnScore + selectionScore - turn.carryoverPoints;
    }

    return ownScore >= gameState.entryThreshold;
  })();

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
        }}
      >
        <p>Loading game...</p>
      </div>
    );
  }

  // Error state
  if (error && !gameState) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: 'var(--space-4)',
        }}
      >
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  // No game state yet
  if (!gameState || !turn || !currentPlayer) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
        }}
      >
        <p>Waiting for game to start...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="game-board-container"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-2)',
        maxWidth: 'var(--max-content-width)',
        margin: '0 auto',
        width: '100%',
        minHeight: '100%',
      }}
    >
      {/* Timer bar - full width below header (like mockup) */}
      {effectiveTimeout && effectiveTimeout > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          {isMobile ? (
            <TurnTimerCompact isMyTurn={isMyTurn} onWarning={handleTimerWarning} />
          ) : (
            <TurnTimer isMyTurn={isMyTurn} onWarning={handleTimerWarning} />
          )}
        </div>
      )}

      {/* Floating menu button */}
      <div style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)', zIndex: 50 }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
          }}
          aria-label="Game menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {/* Menu dropdown */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 'var(--space-1)',
                  backgroundColor: '#2a2a4a',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  minWidth: 160,
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={handleLeaveGame}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Leave Game
                </button>
                {game?.status === 'playing' && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowForfeitConfirm(true);
                    }}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--color-danger)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Forfeit Game
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
      </div>

      {/* Forfeit confirmation dialog */}
      <AnimatePresence>
        {showForfeitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1100,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => !isForfeiting && setShowForfeitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                maxWidth: 320,
                textAlign: 'center',
              }}
            >
              <h3 style={{ marginBottom: 'var(--space-3)', color: 'var(--color-danger)' }}>
                Forfeit Game?
              </h3>
              <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                This will end the game and your opponent will win. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowForfeitConfirm(false)}
                  className="btn"
                  disabled={isForfeiting}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleForfeit}
                  className="btn"
                  disabled={isForfeiting}
                  style={{
                    backgroundColor: 'var(--color-danger)',
                    color: 'white',
                  }}
                >
                  {isForfeiting ? 'Forfeiting...' : 'Forfeit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* Bust message overlay - only shown to the player who busted */}
      <AnimatePresence>
        {bustEvent && bustEvent.playerId === user?.id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.5 } }}
              transition={{ duration: 0.2 }}
              style={{
                fontSize: 'var(--font-size-4xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-danger)',
                textShadow: '0 0 30px rgba(239, 68, 68, 0.8)',
              }}
            >
              BUST
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection lost overlay */}
      <AnimatePresence>
        {(socketStatus === 'disconnected' || socketStatus === 'error') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 900,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-warning)',
              }}
            >
              Connection Lost
            </motion.div>
            <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 300 }}>
              {socketStatus === 'error'
                ? 'Unable to connect to the game server.'
                : 'Trying to reconnect...'}
            </p>
            <button
              onClick={() => reconnect()}
              className="btn btn-primary"
              style={{ marginTop: 'var(--space-2)' }}
            >
              Reconnect Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Paused overlay - all players disconnected */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 850,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-warning)',
              }}
            >
              Game Paused
            </motion.div>
            <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 300 }}>
              All players disconnected. The game will resume when someone reconnects.
            </p>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--color-warning)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                marginTop: 'var(--space-2)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5-second timeout warning overlay */}
      <AnimatePresence>
        {showTimeoutWarning && isMyTurn && !isCurrentPlayerAIControlled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 700,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1],
              }}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-6)',
                backgroundColor: 'rgba(239, 68, 68, 0.95)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 0 40px rgba(239, 68, 68, 0.5)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-5xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'white',
                  fontFamily: 'monospace',
                }}
              >
                {warningCountdown}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Make a move!
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'rgba(255, 255, 255, 0.8)',
                }}
              >
                or AI takes over
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content - two column on desktop, stacked on mobile */}
      <div
        className="game-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '280px 1fr',
          gap: 'var(--space-4)',
          flex: 1,
          alignItems: 'start',
        }}
      >
        {/* Players Panel - left on desktop, bottom on mobile */}
        <div style={{ order: isMobile ? 2 : 1 }}>
          <PlayersPanel
            players={gameState.players}
            currentPlayerIndex={gameState.currentPlayerIndex}
            isFinalRound={gameState.isFinalRound}
            targetScore={gameState.targetScore}
            playerConnections={game?.players.map(p => ({ id: p.id, isConnected: p.isConnected ?? true }))}
          />
        </div>

        {/* Game Theater - right on desktop, top on mobile */}
        <div style={{ order: isMobile ? 1 : 2 }}>
          <GameTheater
            playerName={currentPlayer.name}
            isOnBoard={currentPlayer.isOnBoard}
            isAI={currentPlayer.isAI}
            isMyTurn={isMyTurn}
            turnPhase={turn.phase}
            turnScore={turn.turnScore}
            carryoverPoints={turn.carryoverPoints}
            hasCarryover={turn.hasCarryover}
            carryoverClaimed={turn.carryoverClaimed}
            diceRemaining={turn.diceRemaining}
            entryThreshold={gameState.entryThreshold}
            currentRoll={turn.currentRoll}
            keptDice={turn.keptDice}
            selectedIndices={selectedIndices}
            selectableIndices={selectableIndices}
            scoringIndices={scoringIndices}
            selectionScore={selectionScore}
            onDieClick={handleDieClick}
            onRoll={handleRoll}
            onBank={handleBank}
            onKeepAndBank={handleKeepAndBank}
            onDeclineCarryover={handleDeclineCarryover}
            canRoll={canRoll}
            canBank={canBankNow}
            canKeepAndBank={
              hasValidSelection &&
              isMyTurn &&
              wouldBankBeValid &&
              (turn.phase === TurnPhase.KEEPING || turn.phase === TurnPhase.STEAL_REQUIRED)
            }
            canDeclineCarryover={turn.phase === TurnPhase.STEAL_REQUIRED && isMyTurn}
            isRolling={false}
            isAIActing={(currentPlayer.isAI && isMyTurn) || isCurrentPlayerAIControlled}
            showHints={showHints && isMyTurn}
          />
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (min-width: 1024px) {
          .game-board-container {
            padding: var(--space-5) !important;
          }
        }
      `}</style>
    </div>
  );
}

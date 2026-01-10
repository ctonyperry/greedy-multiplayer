/**
 * MultiplayerGameBoard Component
 * Real-time multiplayer game board using Socket.IO
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../hooks/useGame.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { GameTheater } from '../../ui/GameTheater.js';
import { PlayerBar } from '../../ui/PlayerBar.js';
import { TurnTimer } from './TurnTimer.js';
import { GameChat } from './GameChat.js';
import { ConnectionStatus, PlayerConnectionIndicator } from './ConnectionStatus.js';
import { TurnPhase } from '../../types/index.js';
import type { DieValue, GameState } from '../../types/index.js';
import { canBank as checkCanBank } from '../../engine/turn.js';
import { validateKeep, getSelectableIndices } from '../../engine/validation.js';
import { scoreSelection } from '../../engine/scoring.js';
import { useI18n } from '../../i18n/index.js';

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
  const {
    game,
    gameState,
    isLoading,
    error,
    isMyTurn,
    currentPlayer,
    turnStartedAt,
    effectiveTimeout,
    chatMessages,
    bustEvent,
    roll,
    keep,
    bank,
    declineCarryover,
    sendChat,
  } = useGame(gameCode);

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [lastActivityAt, setLastActivityAt] = useState<string>(new Date().toISOString());
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset activity timer on any user interaction
  const recordActivity = useCallback(() => {
    setLastActivityAt(new Date().toISOString());
  }, []);

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

  // Reset selection and activity timer when player changes
  const prevPlayerIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (gameState && prevPlayerIndexRef.current !== gameState.currentPlayerIndex) {
      setSelectedIndices([]);
      setLastActivityAt(new Date().toISOString());
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

      recordActivity(); // Reset idle timer on interaction

      setSelectedIndices((prev) => {
        if (prev.includes(index)) {
          return prev.filter((i) => i !== index);
        } else {
          return [...prev, index];
        }
      });
    },
    [isMyTurn, selectableIndices, recordActivity]
  );

  // Handle keep action (select dice to keep) - currently unused, kept for future use
  const _handleKeep = useCallback(() => {
    if (!isMyTurn || !turn || selectedIndices.length === 0 || !turn.currentRoll) return;

    const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
    const validation = validateKeep(turn.currentRoll, selectedDice);

    if (!validation.valid) {
      alert(validation.error || 'Invalid selection');
      return;
    }

    keep(selectedDice);
    setSelectedIndices([]);
  }, [isMyTurn, turn, selectedIndices, keep]);

  // Handle roll action
  const handleRoll = useCallback(() => {
    if (!canRoll || !turn) return;

    recordActivity(); // Reset idle timer on interaction

    // If in KEEPING phase with selection, keep first then roll
    if (
      (turn.phase === TurnPhase.KEEPING || turn.phase === TurnPhase.STEAL_REQUIRED) &&
      selectedIndices.length > 0 &&
      turn.currentRoll
    ) {
      const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
      const validation = validateKeep(turn.currentRoll, selectedDice);

      if (!validation.valid) {
        alert(validation.error || 'Invalid selection');
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
  }, [canRoll, turn, selectedIndices, keep, roll, recordActivity]);

  // Handle bank action
  const handleBank = useCallback(() => {
    if (!canBankNow) return;
    recordActivity(); // Reset idle timer on interaction
    bank();
    setSelectedIndices([]);
  }, [canBankNow, bank, recordActivity]);

  // Handle decline carryover
  const handleDeclineCarryover = useCallback(() => {
    if (turn?.phase !== TurnPhase.STEAL_REQUIRED || !isMyTurn) return;
    recordActivity(); // Reset idle timer on interaction
    declineCarryover();
    setSelectedIndices([]);
  }, [turn?.phase, isMyTurn, declineCarryover, recordActivity]);

  // Handle keep and bank
  const handleKeepAndBank = useCallback(() => {
    if (selectedIndices.length === 0 || !turn?.currentRoll || !isMyTurn) return;

    recordActivity(); // Reset idle timer on interaction
    const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
    keep(selectedDice);
    setSelectedIndices([]);

    // After keep is processed, bank
    setTimeout(() => bank(), 100);
  }, [selectedIndices, turn?.currentRoll, isMyTurn, keep, bank, recordActivity]);

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
      {/* Connection status and game code */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <ConnectionStatus compact />
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'monospace',
            }}
          >
            {gameCode}
          </span>
        </div>

        {/* Idle timer - resets on user activity */}
        {effectiveTimeout && effectiveTimeout > 0 && (
          <TurnTimer
            lastActivityAt={lastActivityAt}
            idleTimeout={effectiveTimeout}
            isMyTurn={isMyTurn}
          />
        )}
      </div>

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

      {/* Main content grid */}
      <div
        className="game-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 'var(--space-4)',
          flex: 1,
        }}
      >
        {/* Game Theater */}
        <GameTheater
          playerName={currentPlayer.name}
          isOnBoard={currentPlayer.isOnBoard}
          isAI={currentPlayer.isAI}
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
          isAIActing={currentPlayer.isAI && isMyTurn}
          showHints={showHints && isMyTurn}
        />

        {/* Sidebar - chat and player info */}
        <aside
          className="game-sidebar"
          style={{
            display: 'none',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {/* Chat */}
          <GameChat
            messages={chatMessages}
            currentUserId={user?.id || ''}
            onSendMessage={sendChat}
            isCollapsed={isChatCollapsed}
            onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
          />

          {/* Player list with connection status */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-3)',
            }}
          >
            <h4 style={{ marginBottom: 'var(--space-3)' }}>Players</h4>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              {gameState?.players.map((player) => {
                // Find connection status from game.players
                const gamePlayer = game?.players.find(p => p.id === player.id);
                return (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2)',
                      backgroundColor:
                        player.id === currentPlayer.id
                          ? 'var(--color-primary-light)'
                          : 'transparent',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <PlayerConnectionIndicator isConnected={gamePlayer?.isConnected ?? true} />
                      <span
                        style={{
                          fontWeight:
                            player.id === currentPlayer.id
                              ? 'var(--font-weight-medium)'
                              : 'var(--font-weight-normal)',
                        }}
                      >
                        {player.name}
                        {player.id === user?.id && ' (You)'}
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {player.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile chat button */}
      <div
        className="mobile-chat"
        style={{
          position: 'fixed',
          bottom: 'var(--space-4)',
          right: 'var(--space-4)',
          zIndex: 100,
        }}
      >
        <GameChat
          messages={chatMessages}
          currentUserId={user?.id || ''}
          onSendMessage={sendChat}
          isCollapsed={isChatCollapsed}
          onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
        />
      </div>

      {/* Player standings bar */}
      <PlayerBar
        players={gameState.players}
        currentPlayerIndex={gameState.currentPlayerIndex}
        isFinalRound={gameState.isFinalRound}
      />

      {/* Turn indicator for non-active player */}
      {!isMyTurn && !currentPlayer.isAI && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 'var(--space-4) var(--space-6)',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {currentPlayer.name}'s Turn
          </p>
        </div>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (min-width: 768px) {
          .game-layout {
            grid-template-columns: 1fr 300px !important;
          }
          .game-sidebar {
            display: flex !important;
          }
          .mobile-chat {
            display: none !important;
          }
        }

        @media (min-width: 1024px) {
          .game-layout {
            grid-template-columns: 1fr 350px !important;
            gap: var(--space-5) !important;
          }
          .game-board-container {
            padding: var(--space-5) !important;
          }
        }
      `}</style>
    </div>
  );
}

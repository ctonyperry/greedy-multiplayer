import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameTheater } from './GameTheater.js';
import { PlayerBar } from './PlayerBar.js';
import { TurnHistory, TurnHistoryEntry } from './DiceRoll.js';
import { TurnPhase } from '../types/index.js';
import type { GameState, Dice, DieValue } from '../types/index.js';
import { gameReducer, getCurrentPlayer } from '../engine/game.js';
import { canBank as checkCanBank } from '../engine/turn.js';
import { validateKeep, getSelectableIndices } from '../engine/validation.js';
import { scoreSelection } from '../engine/scoring.js';
import { makeAIDecision, AI_STRATEGIES } from '../ai/strategies.js';
import { useI18n } from '../i18n/index.js';

interface GameBoardProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  showHints?: boolean;
}

function rollDice(count: number): Dice {
  return Array.from({ length: count }, () =>
    (Math.floor(Math.random() * 6) + 1) as DieValue
  );
}

/**
 * GameBoard - Main game interface with unified theater layout
 *
 * Design Philosophy:
 * - Single "Game Theater" for all turn interactions
 * - Phase-adaptive content guides the player
 * - Compact player bar at bottom maintains awareness
 * - Turn history optional, shown on larger screens
 */
export function GameBoard({ gameState, onGameStateChange, showHints = false }: GameBoardProps) {
  const { t } = useI18n();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [isAIActing, setIsAIActing] = useState(false);
  const [turnHistory, setTurnHistory] = useState<TurnHistoryEntry[]>([]);
  const [aiTrigger, setAiTrigger] = useState(0);
  const [currentTurnRolls, setCurrentTurnRolls] = useState<Dice[]>([]);
  const [bustEvent, setBustEvent] = useState<{ playerName: string; isAI: boolean } | null>(null);

  const prevTurnRef = useRef<{ playerIndex: number; keptDice: Dice; turnScore: number; playerScore: number } | null>(null);
  const prevPlayerIndexRef = useRef<number>(gameState.currentPlayerIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Helper to scroll theater to top of viewport
  const scrollToTheater = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Auto-scroll to theater when game starts
  useEffect(() => {
    if (!hasScrolledRef.current) {
      // Small delay to let the DOM render
      const timer = setTimeout(() => {
        scrollToTheater();
        hasScrolledRef.current = true;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [scrollToTheater]);

  const currentPlayer = getCurrentPlayer(gameState);
  const { turn } = gameState;
  const isAITurn = currentPlayer.isAI;

  const gameStateRef = useRef(gameState);
  const onGameStateChangeRef = useRef(onGameStateChange);
  useEffect(() => {
    gameStateRef.current = gameState;
    onGameStateChangeRef.current = onGameStateChange;
  }, [gameState, onGameStateChange]);

  // Track turn history
  useEffect(() => {
    const prev = prevTurnRef.current;
    if (prev !== null && prev.playerIndex !== gameState.currentPlayerIndex) {
      const prevPlayer = gameState.players[prev.playerIndex];
      const scoreGained = prevPlayer.score - prev.playerScore;
      const busted = scoreGained === 0 && prev.keptDice.length > 0;
      setTurnHistory(history => [
        ...history,
        {
          playerName: prevPlayer.name,
          dice: prev.keptDice,
          score: scoreGained > 0 ? scoreGained : 0,
          busted,
          isAI: prevPlayer.isAI,
        },
      ]);
    }
    const currentPlayerObj = gameState.players[gameState.currentPlayerIndex];
    prevTurnRef.current = {
      playerIndex: gameState.currentPlayerIndex,
      keptDice: [...turn.keptDice],
      turnScore: turn.turnScore,
      playerScore: currentPlayerObj?.score || 0,
    };
  }, [gameState.currentPlayerIndex, gameState.players, turn.keptDice, turn.turnScore]);

  // Reset selection when player changes
  useEffect(() => {
    if (prevPlayerIndexRef.current !== gameState.currentPlayerIndex) {
      setCurrentTurnRolls([]);
      setSelectedIndices([]);
      prevPlayerIndexRef.current = gameState.currentPlayerIndex;
    }
  }, [gameState.currentPlayerIndex]);

  // Track kept dice per roll
  const prevKeptDiceLengthRef = useRef(0);
  useEffect(() => {
    const currentLength = turn.keptDice.length;
    const prevLength = prevKeptDiceLengthRef.current;
    if (currentLength > prevLength) {
      const newlyKept = turn.keptDice.slice(prevLength);
      setCurrentTurnRolls(rolls => [...rolls, newlyKept]);
    } else if (currentLength === 0 && prevLength > 0) {
      setCurrentTurnRolls([]);
    }
    prevKeptDiceLengthRef.current = currentLength;
  }, [turn.keptDice]);

  // Reset selection when dice change (new roll)
  const prevDiceRef = useRef<string>('');
  useEffect(() => {
    const diceKey = JSON.stringify(turn.currentRoll);
    if (diceKey !== prevDiceRef.current) {
      prevDiceRef.current = diceKey;
      setSelectedIndices([]);
    }
  }, [turn.currentRoll]);

  // AI action timing
  const aiNextActionTimeRef = useRef(0);

  // AI turn handler
  useEffect(() => {
    if (!isAITurn || isRolling || gameState.isGameOver) return;

    const now = Date.now();
    const waitTime = aiNextActionTimeRef.current - now;
    if (waitTime > 0) {
      const waitTimeout = setTimeout(() => setAiTrigger(t => t + 1), waitTime + 50);
      return () => clearTimeout(waitTimeout);
    }

    const currentState = gameStateRef.current;
    const currentTurn = currentState.turn;
    const player = getCurrentPlayer(currentState);
    const strategyName = player.aiStrategy || 'balanced';
    const strategy = AI_STRATEGIES[strategyName];
    const decision = makeAIDecision(currentTurn, player.isOnBoard, strategy, strategyName, currentState.entryThreshold);

    const baseThinkDelay = currentTurn.phase === TurnPhase.ROLLING || currentTurn.phase === TurnPhase.STEAL_REQUIRED ? 1200 : 1000;
    const thinkDelay = baseThinkDelay + Math.floor(Math.random() * 600) - 300;
    aiNextActionTimeRef.current = now + thinkDelay + 800;
    setIsAIActing(true);

    const thinkTimeout = setTimeout(() => {
      if (decision.action === 'ROLL') {
        setIsRolling(true);
        setTimeout(() => {
          const state = gameStateRef.current;
          const aiPlayer = getCurrentPlayer(state);
          const turnScoreBefore = state.turn.turnScore;
          const dice = rollDice(state.turn.diceRemaining);
          const newState = gameReducer(state, { type: 'ROLL', dice });
          const isBust = newState.turn.phase === TurnPhase.ENDED;

          onGameStateChangeRef.current(newState);
          setIsRolling(false);
          setIsAIActing(false);

          if (isBust) {
            setBustEvent({ playerName: aiPlayer.name, isAI: true });
            setTimeout(() => setBustEvent(null), 1500);
            setTimeout(() => {
              onGameStateChangeRef.current(gameReducer(newState, { type: 'END_TURN' }));
            }, 2000);
          }
        }, 800);
      } else if (decision.action === 'KEEP' && decision.dice) {
        const state = gameStateRef.current;
        const aiPlayer = getCurrentPlayer(state);
        const keepScore = scoreSelection(decision.dice).score;
        const newState = gameReducer(state, { type: 'KEEP', dice: decision.dice });
        const isHotDice = newState.turn.diceRemaining === 5 && state.turn.diceRemaining !== 5;

        const keepDelay = isHotDice ? 2500 : 1800;
        aiNextActionTimeRef.current = Date.now() + keepDelay;
        onGameStateChangeRef.current(newState);
        setIsAIActing(false);
      } else if (decision.action === 'BANK') {
        const state = gameStateRef.current;
        const aiPlayer = getCurrentPlayer(state);
        const createdCarryover = state.turn.diceRemaining > 0;
        const newTotalScore = aiPlayer.score + state.turn.turnScore;
        const wasOnBoard = aiPlayer.isOnBoard;
        const isNowOnBoard = wasOnBoard || newTotalScore >= state.entryThreshold;


        setTimeout(() => {
          let newState = gameReducer(state, { type: 'BANK' });
          newState = gameReducer(newState, { type: 'END_TURN' });
          onGameStateChangeRef.current(newState);
          setIsAIActing(false);
        }, 1200);
      } else if (decision.action === 'DECLINE_CARRYOVER') {
        setTimeout(() => {
          const state = gameStateRef.current;
          const newState = gameReducer(state, { type: 'DECLINE_CARRYOVER' });
          onGameStateChangeRef.current(newState);
          setIsAIActing(false);
        }, 800);
      } else {
        setIsAIActing(false);
      }
    }, thinkDelay);

    return () => clearTimeout(thinkTimeout);
  }, [isAITurn, turn.phase, isRolling, isAIActing, aiTrigger, gameState.isGameOver, gameState.currentPlayerIndex]);

  // Calculate selectable indices
  const selectableIndices = useMemo(() => {
    if (isAITurn || isRolling || !turn.currentRoll || turn.currentRoll.length === 0) {
      return new Set<number>();
    }
    return getSelectableIndices(turn.currentRoll, selectedIndices);
  }, [turn.currentRoll, selectedIndices, isAITurn, isRolling]);

  // Calculate scoring indices for hints
  const scoringIndices = useMemo(() => {
    if (!showHints || isAITurn || isRolling || !turn.currentRoll || turn.currentRoll.length === 0) {
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
        indices.forEach(i => scoring.add(i));
      }
    });
    return scoring;
  }, [turn.currentRoll, showHints, isAITurn, isRolling]);

  const hasValidSelection = selectedIndices.length > 0 && turn.currentRoll !== null;
  const canRoll = !isRolling && (
    turn.phase === TurnPhase.ROLLING ||
    turn.phase === TurnPhase.DECIDING ||
    turn.phase === TurnPhase.STEAL_REQUIRED ||
    (turn.phase === TurnPhase.KEEPING && hasValidSelection)
  );

  const canBankNow = turn.phase === TurnPhase.DECIDING && checkCanBank(turn, currentPlayer.isOnBoard);

  const handleDieClick = useCallback((index: number) => {
    if (isAITurn || isRolling) return;
    if (!selectableIndices.has(index)) return;

    scrollToTheater();
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  }, [isAITurn, isRolling, selectableIndices, scrollToTheater]);

  const handleRoll = useCallback(() => {
    if (!canRoll) return;

    scrollToTheater();

    if (selectedIndices.length > 0 && turn.currentRoll) {
      const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
      const validation = validateKeep(turn.currentRoll, selectedDice);

      if (!validation.valid) {
        alert(validation.error || 'Invalid selection');
        return;
      }

      const keepScore = scoreSelection(selectedDice).score;
      let newState = gameReducer(gameState, { type: 'KEEP', dice: selectedDice });
      const isHotDice = newState.turn.diceRemaining === 5 && turn.diceRemaining !== 5;


      setIsRolling(true);
      setSelectedIndices([]);

      setTimeout(() => {
        const dice = rollDice(newState.turn.diceRemaining);
        const turnScoreBefore = newState.turn.turnScore;
        newState = gameReducer(newState, { type: 'ROLL', dice });
        const isBust = newState.turn.phase === TurnPhase.ENDED;

        onGameStateChange(newState);
        setIsRolling(false);

        if (isBust) {
          setBustEvent({ playerName: currentPlayer.name, isAI: false });
          setTimeout(() => setBustEvent(null), 1500);
          setTimeout(() => {
            onGameStateChange(gameReducer(newState, { type: 'END_TURN' }));
          }, 1500);
        }
      }, 500);
    } else {
      setIsRolling(true);
      setSelectedIndices([]);

      setTimeout(() => {
        const dice = rollDice(turn.diceRemaining);
        const turnScoreBefore = turn.turnScore;
        const newState = gameReducer(gameState, { type: 'ROLL', dice });
        const isBust = newState.turn.phase === TurnPhase.ENDED;

        onGameStateChange(newState);
        setIsRolling(false);

        if (isBust) {
          setBustEvent({ playerName: currentPlayer.name, isAI: false });
          setTimeout(() => setBustEvent(null), 1500);
          setTimeout(() => {
            onGameStateChange(gameReducer(newState, { type: 'END_TURN' }));
          }, 1500);
        }
      }, 500);
    }
  }, [canRoll, turn.currentRoll, turn.diceRemaining, selectedIndices, gameState, onGameStateChange, currentPlayer, turn.turnScore, scrollToTheater]);

  const handleBank = useCallback(() => {
    if (!canBankNow) return;

    scrollToTheater();

    const createdCarryover = turn.diceRemaining > 0;
    const newTotalScore = currentPlayer.score + turn.turnScore;
    const wasOnBoard = currentPlayer.isOnBoard;
    const isNowOnBoard = wasOnBoard || newTotalScore >= gameState.entryThreshold;


    let newState = gameReducer(gameState, { type: 'BANK' });
    newState = gameReducer(newState, { type: 'END_TURN' });
    onGameStateChange(newState);
    setSelectedIndices([]);
  }, [canBankNow, gameState, onGameStateChange, turn.turnScore, turn.diceRemaining, currentPlayer, scrollToTheater]);

  const handleDeclineCarryover = useCallback(() => {
    if (turn.phase !== TurnPhase.STEAL_REQUIRED) return;

    scrollToTheater();

    const newState = gameReducer(gameState, { type: 'DECLINE_CARRYOVER' });
    onGameStateChange(newState);
    setSelectedIndices([]);
  }, [turn.phase, gameState, onGameStateChange, scrollToTheater]);

  const handleKeepAndBank = useCallback(() => {
    if (selectedIndices.length === 0 || !turn.currentRoll) return;

    scrollToTheater();

    const selectedDice = selectedIndices.map((i) => turn.currentRoll![i]);
    const keepScore = scoreSelection(selectedDice).score;

    let newState = gameReducer(gameState, { type: 'KEEP', dice: selectedDice });
    const turnScoreAfterKeep = newState.turn.turnScore;
    const diceRemainingAfterKeep = newState.turn.diceRemaining;
    const isHotDice = diceRemainingAfterKeep === 5 && turn.diceRemaining !== 5;


    const createdCarryover = diceRemainingAfterKeep > 0;
    const newTotalScore = currentPlayer.score + turnScoreAfterKeep;
    const wasOnBoard = currentPlayer.isOnBoard;
    const isNowOnBoard = wasOnBoard || newTotalScore >= gameState.entryThreshold;


    newState = gameReducer(newState, { type: 'BANK' });
    newState = gameReducer(newState, { type: 'END_TURN' });
    onGameStateChange(newState);
    setSelectedIndices([]);
  }, [selectedIndices, turn.currentRoll, turn.diceRemaining, gameState, onGameStateChange, currentPlayer, scrollToTheater]);

  const selectedDice = turn.currentRoll
    ? selectedIndices.map((i) => turn.currentRoll![i])
    : [];
  const selectionScore = selectedDice.length > 0 ? scoreSelection(selectedDice).score : 0;

  const wouldBankBeValid = (() => {
    if (selectionScore === 0) return false;
    if (currentPlayer.isOnBoard) return true;

    // Calculate own score (excluding carryover points) for entry threshold check
    let ownScore: number;
    if (turn.hasCarryover && !turn.carryoverClaimed) {
      // Carryover hasn't been claimed yet, so it's not in turnScore
      // Own score is just what we'll score from the selected dice
      ownScore = selectionScore;
    } else {
      // Carryover already claimed and added to turnScore, or no carryover
      ownScore = turn.turnScore + selectionScore - turn.carryoverPoints;
    }

    return ownScore >= gameState.entryThreshold;
  })();

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
        {/* Game Theater - the unified interaction area */}
        <GameTheater
          playerName={currentPlayer.name}
          isOnBoard={currentPlayer.isOnBoard}
          isAI={isAITurn}
          isMyTurn={!isAITurn}
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
          canBank={canBankNow && !isAITurn}
          canKeepAndBank={hasValidSelection && !isAITurn && wouldBankBeValid && (turn.phase === TurnPhase.KEEPING || turn.phase === TurnPhase.STEAL_REQUIRED)}
          canDeclineCarryover={turn.phase === TurnPhase.STEAL_REQUIRED && !isAITurn}
          isRolling={isRolling}
          isAIActing={isAIActing}
          showHints={showHints}
        />

        {/* Sidebar content - shown on larger screens */}
        <aside
          className="game-sidebar"
          style={{
            display: 'none',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <TurnHistory
            history={turnHistory}
            currentTurnRolls={currentTurnRolls}
            currentTurnScore={turn.turnScore}
            maxVisible={5}
          />
        </aside>
      </div>

      {/* Player standings bar - always visible at bottom */}
      <PlayerBar
        players={gameState.players}
        currentPlayerIndex={gameState.currentPlayerIndex}
        isFinalRound={gameState.isFinalRound}
      />

      {/* Bust overlay */}
      <AnimatePresence>
        {bustEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(239, 68, 68, 0.2)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 'var(--z-overlay)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              style={{
                fontSize: 'var(--font-size-4xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-danger)',
                textShadow: '0 0 40px rgba(239, 68, 68, 0.5)',
              }}
            >
              {t('bust')}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Responsive styles */}
      <style>{`
        @media (min-width: 768px) {
          .game-layout {
            grid-template-columns: 1fr 280px !important;
          }
          .game-sidebar {
            display: flex !important;
          }
        }

        @media (min-width: 1024px) {
          .game-layout {
            grid-template-columns: 1fr 320px !important;
            gap: var(--space-5) !important;
          }
          .game-board-container {
            padding: var(--space-5) !important;
          }
        }

        /* Fire button animation */
        .btn-fire {
          animation: fire-pulse 1.5s ease-in-out infinite;
        }

        @keyframes fire-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(245, 158, 11, 0.4), 0 0 40px rgba(239, 68, 68, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(245, 158, 11, 0.6), 0 0 60px rgba(239, 68, 68, 0.4);
          }
        }
      `}</style>
    </div>
  );
}

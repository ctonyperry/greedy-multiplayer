/**
 * Game state management for Greedy dice game
 *
 * Orchestrates the full game flow including multiple players,
 * turn management, and endgame conditions.
 */

import type { Dice, GameState, PlayerState, GameSettings } from '../types/index.js';
import { TurnPhase } from '../types/index.js';
import { TARGET_SCORE, ENTRY_THRESHOLD } from './constants.js';
import { createTurnState, turnReducer, canBank, getCarryoverPot, TurnAction } from './turn.js';

/**
 * Actions that can be taken in the game
 */
export type GameAction =
  | { type: 'ROLL'; dice: Dice }
  | { type: 'KEEP'; dice: Dice }
  | { type: 'BANK' }
  | { type: 'END_TURN' }
  | { type: 'DECLINE_CARRYOVER' };

/**
 * Player configuration for game creation
 */
export interface PlayerConfig {
  name: string;
  isAI: boolean;
  aiStrategy?: string;
}

/**
 * Create a new player
 */
function createPlayer(config: PlayerConfig): PlayerState {
  return {
    id: crypto.randomUUID(),
    name: config.name,
    score: 0,
    isOnBoard: false,
    isAI: config.isAI,
    aiStrategy: config.aiStrategy,
  };
}

/**
 * Create initial game state from player configs
 */
export function createGameState(
  playerConfigs: PlayerConfig[],
  settings?: Partial<GameSettings>
): GameState {
  if (playerConfigs.length < 2) {
    throw new Error('Game requires at least 2 players');
  }

  const players = playerConfigs.map((config) => createPlayer(config));

  return {
    players,
    currentPlayerIndex: 0,
    turn: createTurnState(),
    carryoverPot: null,
    isFinalRound: false,
    finalRoundTriggerIndex: null,
    scoreToBeat: null,
    scoreToBeatPlayerIndex: null,
    highScoreBeatenThisRound: false,
    isGameOver: false,
    winnerIndex: null,
    entryThreshold: settings?.entryThreshold ?? ENTRY_THRESHOLD,
    targetScore: settings?.targetScore ?? TARGET_SCORE,
  };
}

/**
 * Get the current player
 */
export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

/**
 * Get the winner (player with highest score)
 */
export function getWinner(state: GameState): PlayerState | null {
  if (!state.isGameOver) return null;

  let winner = state.players[0];
  for (const player of state.players) {
    if (player.score > winner.score) {
      winner = player;
    }
  }

  return winner;
}

/**
 * Advance to the next player
 */
function advancePlayer(state: GameState): GameState {
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextIndex];

  // Players not on the board can't take Lucky Break - they must earn entry the regular way
  // Only give carryover to players who are already on the board
  const canTakeCarryover = nextPlayer.isOnBoard && state.carryoverPot !== null;

  // Check if game is over (completed a round in final phase)
  if (state.isFinalRound && nextIndex === state.scoreToBeatPlayerIndex) {
    // Check if anyone beat the high score this round
    if (!state.highScoreBeatenThisRound) {
      // No one beat it - game ends, score-to-beat holder wins
      return {
        ...state,
        isGameOver: true,
        winnerIndex: state.scoreToBeatPlayerIndex,
        currentPlayerIndex: nextIndex,
      };
    }

    // Someone beat the score - reset flag and continue
    const newTurn = canTakeCarryover
      ? createTurnState(state.carryoverPot!)
      : createTurnState();

    return {
      ...state,
      currentPlayerIndex: nextIndex,
      turn: newTurn,
      carryoverPot: canTakeCarryover ? state.carryoverPot : null,
      highScoreBeatenThisRound: false,
    };
  }

  // Create new turn for next player
  const newTurn = canTakeCarryover
    ? createTurnState(state.carryoverPot!)
    : createTurnState();

  return {
    ...state,
    currentPlayerIndex: nextIndex,
    turn: newTurn,
    carryoverPot: canTakeCarryover ? state.carryoverPot : null,
  };
}

/**
 * Game state reducer
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.isGameOver) {
    return state;
  }

  const currentPlayer = getCurrentPlayer(state);

  switch (action.type) {
    case 'ROLL':
    case 'KEEP': {
      // Delegate to turn reducer
      const turnAction: TurnAction = action;
      const newTurn = turnReducer(state.turn, turnAction);

      return {
        ...state,
        turn: newTurn,
      };
    }

    case 'BANK': {
      // Check if banking is allowed
      if (!canBank(state.turn, currentPlayer.isOnBoard, state.entryThreshold)) {
        throw new Error('Cannot bank: requirements not met');
      }

      // Calculate carryover before ending turn
      const carryover = getCarryoverPot(state.turn);

      // Apply bank action to turn
      const newTurn = turnReducer(state.turn, { type: 'BANK' });

      return {
        ...state,
        turn: newTurn,
        carryoverPot: carryover,
      };
    }

    case 'DECLINE_CARRYOVER': {
      // Can only decline when there's a carryover to decline
      if (state.turn.phase !== TurnPhase.STEAL_REQUIRED) {
        throw new Error('Cannot decline carryover: no carryover to decline');
      }

      // Clear carryover and start fresh turn
      return {
        ...state,
        turn: createTurnState(),
        carryoverPot: null,
      };
    }

    case 'END_TURN': {
      if (state.turn.phase !== TurnPhase.ENDED) {
        throw new Error('Cannot end turn: turn not finished');
      }

      // Update player score if they banked (not busted)
      const turnScore = state.turn.turnScore;
      let updatedPlayers = [...state.players];

      if (turnScore > 0) {
        const ownScore = turnScore - state.turn.carryoverPoints;
        const meetsEntryThreshold = ownScore >= state.entryThreshold;
        const isEntering = !currentPlayer.isOnBoard && meetsEntryThreshold;

        updatedPlayers[state.currentPlayerIndex] = {
          ...currentPlayer,
          score: currentPlayer.score + turnScore,
          isOnBoard: currentPlayer.isOnBoard || isEntering,
        };
      }

      // Check if target score reached (triggers final round)
      const newScore = updatedPlayers[state.currentPlayerIndex].score;
      const triggeredFinalRound = !state.isFinalRound && newScore >= state.targetScore;

      // Track score to beat system
      let scoreToBeat = state.scoreToBeat;
      let scoreToBeatPlayerIndex = state.scoreToBeatPlayerIndex;
      let highScoreBeatenThisRound = state.highScoreBeatenThisRound;

      if (triggeredFinalRound) {
        // First player to reach target sets the score to beat
        scoreToBeat = newScore;
        scoreToBeatPlayerIndex = state.currentPlayerIndex;
        highScoreBeatenThisRound = false; // Starting fresh
      } else if (state.isFinalRound && scoreToBeat !== null && newScore > scoreToBeat) {
        // Someone beat the current score to beat - they become the new holder
        scoreToBeat = newScore;
        scoreToBeatPlayerIndex = state.currentPlayerIndex;
        // Flag stays false because we're starting a new round with new score to beat
        // The next round will check if anyone beats THIS player's score
        highScoreBeatenThisRound = false;
      }

      // Clear carryover if steal was attempted (success or fail)
      // Carryover is already set if player banked with dice remaining
      let newCarryover = state.carryoverPot;
      if (state.turn.hasCarryover) {
        // Steal was attempted - clear the inherited carryover
        // New carryover may have been set by BANK action
        newCarryover = state.carryoverPot;
      }

      // If player busted or used all dice, no carryover
      if (turnScore === 0 || state.turn.diceRemaining === 0) {
        newCarryover = null;
      }

      const stateWithPlayers: GameState = {
        ...state,
        players: updatedPlayers,
        isFinalRound: state.isFinalRound || triggeredFinalRound,
        finalRoundTriggerIndex: triggeredFinalRound
          ? state.currentPlayerIndex
          : state.finalRoundTriggerIndex,
        scoreToBeat,
        scoreToBeatPlayerIndex,
        highScoreBeatenThisRound,
        carryoverPot: newCarryover,
      };

      return advancePlayer(stateWithPlayers);
    }

    default:
      return state;
  }
}

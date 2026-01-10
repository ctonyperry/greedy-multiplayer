/**
 * Turn state machine for Greedy dice game
 *
 * Manages the state transitions during a player's turn.
 */

import type { Dice, TurnState, CarryoverPot } from '../types/index.js';
import { TurnPhase } from '../types/index.js';
import { DICE_COUNT, ENTRY_THRESHOLD } from './constants.js';
import { scoreSelection } from './scoring.js';
import { isBust, validateKeep } from './validation.js';

/** Default entry threshold (used if not specified) */
const DEFAULT_ENTRY_THRESHOLD = ENTRY_THRESHOLD;

/**
 * Actions that can be taken during a turn
 */
export type TurnAction =
  | { type: 'ROLL'; dice: Dice }
  | { type: 'KEEP'; dice: Dice }
  | { type: 'BANK' };

/**
 * Create initial turn state
 */
export function createTurnState(carryover?: CarryoverPot): TurnState {
  if (carryover) {
    return {
      phase: TurnPhase.STEAL_REQUIRED,
      turnScore: 0,
      diceRemaining: carryover.diceCount,
      currentRoll: null,
      keptDice: [],
      hasCarryover: true,
      carryoverClaimed: false,
      carryoverPoints: carryover.points,
    };
  }

  return {
    phase: TurnPhase.ROLLING,
    turnScore: 0,
    diceRemaining: DICE_COUNT,
    currentRoll: null,
    keptDice: [],
    hasCarryover: false,
    carryoverClaimed: false,
    carryoverPoints: 0,
  };
}

/**
 * Check if the player can bank their current score
 *
 * Rules:
 * - Must be in DECIDING phase
 * - If not on the board, must have >= entryThreshold points from own rolls (not carryover)
 * - Cannot bank immediately after claiming a carryover (must roll at least once more)
 */
export function canBank(
  state: TurnState,
  isOnBoard: boolean,
  entryThreshold: number = DEFAULT_ENTRY_THRESHOLD
): boolean {
  // Must be in a phase where banking is possible
  if (state.phase !== TurnPhase.DECIDING) {
    return false;
  }

  // If player has carryover that was just claimed this turn,
  // and they haven't rolled their own dice yet, they cannot bank
  // The carryoverClaimed flag with hasCarryover checks this
  // Actually, we need a separate flag to track if they've rolled AFTER claiming

  // Calculate own score (excluding carryover)
  const ownScore = state.turnScore - state.carryoverPoints;

  // If not on board, need >= entryThreshold from own score
  if (!isOnBoard) {
    return ownScore >= entryThreshold;
  }

  return true;
}

/**
 * Calculate carryover pot if player banks with dice remaining
 */
export function getCarryoverPot(state: TurnState): CarryoverPot | null {
  if (state.phase !== TurnPhase.DECIDING) return null;
  if (state.diceRemaining === 0) return null;

  return {
    points: state.turnScore,
    diceCount: state.diceRemaining,
  };
}

/**
 * Turn state reducer
 */
export function turnReducer(state: TurnState, action: TurnAction): TurnState {
  switch (action.type) {
    case 'ROLL': {
      // Handle bust
      if (isBust(action.dice)) {
        return {
          ...state,
          phase: TurnPhase.ENDED,
          turnScore: 0,
          currentRoll: action.dice,
        };
      }

      return {
        ...state,
        phase: TurnPhase.KEEPING,
        currentRoll: action.dice,
      };
    }

    case 'KEEP': {
      // Validate the keep
      if (!state.currentRoll) {
        throw new Error('Cannot keep dice without a current roll');
      }

      const validation = validateKeep(state.currentRoll, action.dice);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid keep');
      }

      // Calculate score for kept dice
      const scoringResult = scoreSelection(action.dice);
      let newScore = state.turnScore + scoringResult.score;

      // If this is a carryover turn and first successful keep, add carryover points
      const claimingCarryover = state.hasCarryover && !state.carryoverClaimed;
      if (claimingCarryover) {
        newScore += state.carryoverPoints;
      }

      // Calculate remaining dice
      const newDiceRemaining = state.diceRemaining - action.dice.length;

      // Check for hot dice
      const isHotDice = newDiceRemaining === 0;
      const finalDiceRemaining = isHotDice ? DICE_COUNT : newDiceRemaining;

      return {
        ...state,
        phase: TurnPhase.DECIDING,
        turnScore: newScore,
        diceRemaining: finalDiceRemaining,
        keptDice: [...state.keptDice, ...action.dice],
        carryoverClaimed: state.hasCarryover ? true : state.carryoverClaimed,
        currentRoll: null,
      };
    }

    case 'BANK': {
      if (state.phase !== TurnPhase.DECIDING) {
        throw new Error('Cannot bank in current phase');
      }

      return {
        ...state,
        phase: TurnPhase.ENDED,
      };
    }

    default:
      return state;
  }
}

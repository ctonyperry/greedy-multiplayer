/**
 * Core types for the Greedy dice game engine
 * Shared between client and server
 */

/** Valid die face values (1-6) */
export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** A collection of dice showing their face values */
export type Dice = DieValue[];

/** Result of scoring a selection of dice */
export interface ScoringResult {
  /** Total points scored */
  score: number;
  /** Dice that contributed to the score */
  scoringDice: Dice;
  /** Dice that did not contribute to the score */
  remainingDice: Dice;
  /** Description of what scored (for UI display) */
  breakdown: ScoringBreakdownItem[];
}

/** Individual scoring component */
export interface ScoringBreakdownItem {
  /** Description of the scoring combination */
  description: string;
  /** Points for this component */
  points: number;
  /** Dice used for this component */
  dice: Dice;
}

/** Turn phases */
export enum TurnPhase {
  /** Normal turn - player can roll, keep, or bank */
  ROLLING = 'ROLLING',
  /** Player must decide what to keep after a roll */
  KEEPING = 'KEEPING',
  /** Player deciding whether to roll again or bank */
  DECIDING = 'DECIDING',
  /** Player must attempt to steal the carryover pot */
  STEAL_REQUIRED = 'STEAL_REQUIRED',
  /** Turn has ended (bust or banked) */
  ENDED = 'ENDED',
}

/** Carryover pot from previous player stopping with dice remaining */
export interface CarryoverPot {
  /** Points in the pot (previous player's banked score) */
  points: number;
  /** Number of dice remaining to roll */
  diceCount: number;
}

/** State of a player's current turn */
export interface TurnState {
  /** Current phase of the turn */
  phase: TurnPhase;
  /** Points accumulated this turn (not yet banked) */
  turnScore: number;
  /** Current dice available to roll */
  diceRemaining: number;
  /** Result of the most recent roll */
  currentRoll: Dice | null;
  /** Dice kept so far this roll */
  keptDice: Dice;
  /** Whether this turn started with a carryover pot */
  hasCarryover: boolean;
  /** Whether player has successfully claimed the carryover */
  carryoverClaimed: boolean;
  /** Points from carryover (tracked separately for entry threshold) */
  carryoverPoints: number;
}

/** State of a single player */
export interface PlayerState {
  /** Unique player identifier */
  id: string;
  /** Display name */
  name: string;
  /** Total banked score */
  score: number;
  /** Whether player has met the entry threshold */
  isOnBoard: boolean;
  /** Whether this player is controlled by AI */
  isAI: boolean;
  /** AI strategy name (if AI player) */
  aiStrategy?: string;
}

/** Overall game state */
export interface GameState {
  /** All players in the game */
  players: PlayerState[];
  /** Index of the current player in the players array */
  currentPlayerIndex: number;
  /** State of the current turn */
  turn: TurnState;
  /** Carryover pot available (if any) */
  carryoverPot: CarryoverPot | null;
  /** Whether target score has been reached, triggering final round */
  isFinalRound: boolean;
  /** Index of the player who triggered the final round (original trigger) */
  finalRoundTriggerIndex: number | null;
  /** Current score to beat (highest score once someone reaches target) */
  scoreToBeat: number | null;
  /** Index of player who holds the score to beat */
  scoreToBeatPlayerIndex: number | null;
  /** Whether someone beat the high score this round (resets each round) */
  highScoreBeatenThisRound: boolean;
  /** Whether the game has ended */
  isGameOver: boolean;
  /** Index of the winning player (when game is over) */
  winnerIndex: number | null;
}

/** Result of validating a keep action */
export interface ValidationResult {
  /** Whether the keep is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/** Game configuration constants */
export const GAME_CONSTANTS = {
  DICE_COUNT: 5,
  ENTRY_THRESHOLD: 650,
  TARGET_SCORE: 10000,

  // Scoring values
  SINGLE_1: 100,
  SINGLE_5: 50,
  TRIPLE_1: 1000,
  TRIPLE_2: 200,
  TRIPLE_3: 300,
  TRIPLE_4: 400,
  TRIPLE_5: 500,
  TRIPLE_6: 600,
  FOUR_OF_KIND: 1500,
  FIVE_OF_KIND: 2000,
  SMALL_STRAIGHT: 750,
  LARGE_STRAIGHT: 1500,
  FULL_HOUSE: 2500,
} as const;

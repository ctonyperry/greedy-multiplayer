/**
 * AI Strategy implementations for Greedy dice game
 *
 * Strategies are pure functions that consume the same engine APIs as human players.
 * Each strategy decides which dice to keep and whether to continue rolling.
 */

import type { TurnState, Dice } from '../types/index.js';
import { TurnPhase } from '../types/index.js';
import { scoreSelection } from '../engine/scoring.js';
import { ENTRY_THRESHOLD, DICE_COUNT } from '../engine/constants.js';

/** Default entry threshold for AI strategies when not provided */
const DEFAULT_ENTRY_THRESHOLD = ENTRY_THRESHOLD;

/**
 * AI decision result
 */
export interface AIDecision {
  action: 'KEEP' | 'ROLL' | 'BANK' | 'DECLINE_CARRYOVER';
  dice?: Dice;
}

/**
 * Strategy function type
 * Takes turn state and returns decision for roll/bank phase
 */
export type AIStrategy = (turnState: TurnState, isOnBoard: boolean, entryThreshold?: number) => AIDecision;

/**
 * Find the best dice to keep from a roll
 * Returns the dice that maximize score while leaving options
 */
function findBestKeep(roll: Dice): Dice {
  const result = scoreSelection(roll);
  return result.scoringDice;
}

/**
 * Calculate expected value of continuing to roll
 * Higher = more likely to score on next roll
 */
function calculateRollEV(diceCount: number): number {
  // Probability of NOT busting with n dice
  // P(at least one 1 or 5 in n dice) = 1 - (4/6)^n
  const bustProb = Math.pow(4 / 6, diceCount);
  const successProb = 1 - bustProb;

  // Expected points per successful roll (rough estimate)
  // Average scoring die gives about 75 points (weighted 1s and 5s)
  const avgPointsPerDie = 75;

  return successProb * avgPointsPerDie * diceCount;
}

/**
 * Check if we have hot dice (all 5 dice scored, get to roll fresh)
 * Hot dice = turnScore > 0 AND diceRemaining === 5 (refreshed)
 */
function hasHotDice(turnState: TurnState): boolean {
  return turnState.diceRemaining === DICE_COUNT && turnState.turnScore > 0;
}

/**
 * Conservative AI - plays it safe, banks early
 *
 * Strategy:
 * - Banks at 300+ points when on board
 * - Prioritizes not losing accumulated points
 * - Banks immediately upon reaching entry threshold when not on board
 * - ALWAYS continues on hot dice (free value)
 */
export const conservativeStrategy: AIStrategy = (turnState, isOnBoard, entryThreshold = DEFAULT_ENTRY_THRESHOLD) => {
  // ALWAYS roll on hot dice - it's free expected value with only ~13% bust chance
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  // If not on board, bank as soon as we hit entry threshold
  if (!isOnBoard && turnState.turnScore >= entryThreshold) {
    return { action: 'BANK' };
  }

  // If on board, bank at 300+
  if (isOnBoard && turnState.turnScore >= 300) {
    return { action: 'BANK' };
  }

  return { action: 'ROLL' };
};

/**
 * Aggressive AI - takes big risks for big rewards
 *
 * Strategy:
 * - Pushes for hot dice whenever possible
 * - Only banks at very high scores
 * - Accepts high bust risk for potential payoff
 * - ALWAYS continues on hot dice
 */
export const aggressiveStrategy: AIStrategy = (turnState, isOnBoard, entryThreshold = DEFAULT_ENTRY_THRESHOLD) => {
  // ALWAYS roll on hot dice
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  // When not on board, still need to eventually bank to get on
  // Aggressive will push harder but not infinitely
  if (!isOnBoard) {
    // Need at least entry threshold to bank
    if (turnState.turnScore < entryThreshold) {
      return { action: 'ROLL' };
    }

    // Aggressive pushes for more points but banks if:
    // - High bust risk (1-2 dice) and decent score
    // - Very high score accumulated
    const bustProb = Math.pow(4 / 6, turnState.diceRemaining);
    const highRisk = bustProb >= 0.4;
    const decentScore = turnState.turnScore >= entryThreshold + 300;
    const greatScore = turnState.turnScore >= 1500;

    if ((highRisk && decentScore) || greatScore) {
      return { action: 'BANK' };
    }

    return { action: 'ROLL' };
  }

  // On board - original aggressive behavior
  // Push for hot dice if we're close
  if (turnState.diceRemaining <= 2 && turnState.turnScore < 2500) {
    return { action: 'ROLL' };
  }

  if (turnState.turnScore >= 3500) {
    return { action: 'BANK' };
  }

  return { action: 'ROLL' };
};

/**
 * Balanced AI - weighs risk vs reward
 *
 * Strategy:
 * - Considers current score AND remaining dice
 * - Banks when risk/reward becomes unfavorable
 * - Adapts thresholds based on game state
 * - Prioritizes getting on the board when close to entry threshold
 * - ALWAYS continues on hot dice
 */
export const balancedStrategy: AIStrategy = (turnState, isOnBoard, entryThreshold = DEFAULT_ENTRY_THRESHOLD) => {
  // ALWAYS roll on hot dice - it's free expected value
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  const minBankThreshold = isOnBoard ? 0 : entryThreshold;

  // Cannot bank below entry threshold when not on board
  if (turnState.turnScore < minBankThreshold) {
    return { action: 'ROLL' };
  }

  // PRIORITY: If not on board and we can get on, be conservative!
  // Getting on the board is critical - don't risk it for marginal gains
  if (!isOnBoard && turnState.turnScore >= entryThreshold) {
    // Calculate bust probability
    const bustProb = Math.pow(4 / 6, turnState.diceRemaining);

    // Bank to secure entry unless we have very safe odds AND room to grow
    // With 1 die: 67% bust - definitely bank
    // With 2 dice: 44% bust - bank (too risky)
    // With 3 dice: 30% bust - bank unless we have a big cushion
    // With 4 dice: 20% bust - only continue if we want to build a bigger lead
    // With 5 dice: 13% bust - could push for more, but entry is valuable

    // Default: bank to secure entry
    // Only continue if we have 4+ dice AND are just barely over threshold
    const barelyOverThreshold = turnState.turnScore < entryThreshold + 150;
    const verySafeOdds = bustProb < 0.25; // 4+ dice

    if (!(barelyOverThreshold && verySafeOdds)) {
      return { action: 'BANK' };
    }
    // Otherwise, we have 4+ dice and are barely over - might as well push for a bit more
  }

  // Calculate risk/reward ratio
  const ev = calculateRollEV(turnState.diceRemaining);
  const riskValue = turnState.turnScore; // What we'd lose on bust

  // Dynamic threshold based on dice remaining
  // More dice = safer to roll
  const diceBonus = (turnState.diceRemaining / DICE_COUNT) * 500;
  const effectiveThreshold = 1000 - diceBonus;

  // Bank if we have a good score and risk outweighs reward
  if (turnState.turnScore >= effectiveThreshold && riskValue > ev * 3) {
    return { action: 'BANK' };
  }

  // Bank if score is high enough regardless
  if (turnState.turnScore >= 1500) {
    return { action: 'BANK' };
  }

  return { action: 'ROLL' };
};

/**
 * Chaos AI - unpredictable, random decisions
 *
 * Strategy:
 * - Makes semi-random decisions
 * - Still respects game rules (entry threshold)
 * - Adds unpredictability to the game
 */
export const chaosStrategy: AIStrategy = (turnState, isOnBoard, entryThreshold = DEFAULT_ENTRY_THRESHOLD) => {
  // Even chaos knows to roll on hot dice - it's too good to pass up!
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  const minBankThreshold = isOnBoard ? 0 : entryThreshold;

  // Cannot bank below entry threshold
  if (turnState.turnScore < minBankThreshold) {
    return { action: 'ROLL' };
  }

  // 50/50 chance to roll or bank (when allowed)
  if (Math.random() > 0.5) {
    return { action: 'BANK' };
  }

  return { action: 'ROLL' };
};

/**
 * Available AI strategies by name
 */
export const AI_STRATEGIES: Record<string, AIStrategy> = {
  conservative: conservativeStrategy,
  aggressive: aggressiveStrategy,
  balanced: balancedStrategy,
  chaos: chaosStrategy,
};

/**
 * Calculate success probability for a steal attempt
 * Returns probability of rolling at least one 1 or 5 with n dice
 */
function calculateStealSuccessProb(diceCount: number): number {
  // P(at least one 1 or 5) = 1 - P(no 1 or 5 in all dice)
  // P(no 1 or 5 on single die) = 4/6 = 2/3
  return 1 - Math.pow(4 / 6, diceCount);
}

/**
 * Calculate expected value of attempting a steal vs declining
 *
 * Attempting: successProb * (carryoverPoints + expected future gains) + (1-successProb) * 0
 * Declining: expected value of fresh turn with 5 dice
 *
 * Returns { attemptEV, declineEV, recommendation }
 */
function calculateStealEV(
  carryoverPoints: number,
  diceCount: number,
  isOnBoard: boolean
): { attemptEV: number; declineEV: number; shouldAttempt: boolean } {
  const successProb = calculateStealSuccessProb(diceCount);

  // If we succeed at steal, we get carryover + expected value of continuing
  // Rough estimate: average turn scores ~300-500 points when not busting
  const avgTurnContinuation = 300;
  const attemptEV = successProb * (carryoverPoints + avgTurnContinuation);

  // If we decline, we start fresh with 5 dice
  // Expected value of a fresh turn (rough estimate based on bust probability)
  const freshTurnSuccessProb = calculateStealSuccessProb(DICE_COUNT);
  const avgFreshTurnScore = isOnBoard ? 400 : 300; // Lower when need to meet entry threshold
  const declineEV = freshTurnSuccessProb * avgFreshTurnScore;

  return {
    attemptEV,
    declineEV,
    shouldAttempt: attemptEV > declineEV,
  };
}

/**
 * Decide whether AI should attempt or decline a carryover steal
 * Uses strategy-specific risk tolerance combined with EV calculations
 */
function shouldAttemptSteal(
  carryoverPoints: number,
  diceCount: number,
  strategyName: string,
  isOnBoard: boolean
): { shouldAttempt: boolean; reasoning: string } {
  const successProb = calculateStealSuccessProb(diceCount);
  const ev = calculateStealEV(carryoverPoints, diceCount, isOnBoard);

  // Log the analysis for debugging
  const analysis = {
    successProb: (successProb * 100).toFixed(1) + '%',
    carryoverPoints,
    diceCount,
    attemptEV: ev.attemptEV.toFixed(0),
    declineEV: ev.declineEV.toFixed(0),
    evRecommends: ev.shouldAttempt ? 'ATTEMPT' : 'DECLINE',
  };
  console.log('🎲 Steal Analysis:', analysis);

  // Strategy-specific decision making
  switch (strategyName) {
    case 'conservative': {
      // Conservative: Only attempt if EV strongly favors it AND high success probability
      // Requires 50%+ success AND EV advantage of 1.5x or more
      const strongEVAdvantage = ev.attemptEV > ev.declineEV * 1.5;
      const safeEnough = successProb >= 0.5;
      const shouldAttempt = safeEnough && strongEVAdvantage;
      return {
        shouldAttempt,
        reasoning: shouldAttempt
          ? `Safe enough (${(successProb * 100).toFixed(0)}%) with good EV (${ev.attemptEV.toFixed(0)} vs ${ev.declineEV.toFixed(0)})`
          : `Too risky (${(successProb * 100).toFixed(0)}% success) or poor EV`,
      };
    }

    case 'aggressive': {
      // Aggressive: Attempt unless EV is significantly worse
      // Will attempt even at low probability if carryover is high
      const worthTheRisk = carryoverPoints >= 800 || successProb >= 0.3;
      const notTerrible = ev.attemptEV >= ev.declineEV * 0.5;
      const shouldAttempt = worthTheRisk && notTerrible;
      return {
        shouldAttempt,
        reasoning: shouldAttempt
          ? `Going for it! ${carryoverPoints} points at ${(successProb * 100).toFixed(0)}% odds`
          : `Even I won't take those odds`,
      };
    }

    case 'chaos': {
      // Chaos: Random but weighted by EV
      // Higher EV = higher chance to attempt
      const evRatio = ev.attemptEV / (ev.attemptEV + ev.declineEV);
      const shouldAttempt = Math.random() < evRatio;
      return {
        shouldAttempt,
        reasoning: `Feeling ${shouldAttempt ? 'lucky' : 'cautious'} (rolled ${(evRatio * 100).toFixed(0)}% threshold)`,
      };
    }

    case 'balanced':
    default: {
      // Balanced: Follow EV recommendation with slight risk aversion
      // Require small EV advantage to attempt (accounts for variance aversion)
      const evAdvantage = ev.attemptEV > ev.declineEV * 1.1;
      const decentOdds = successProb >= 0.35;
      const shouldAttempt = evAdvantage && decentOdds;
      return {
        shouldAttempt,
        reasoning: shouldAttempt
          ? `EV favors attempt (${ev.attemptEV.toFixed(0)} vs ${ev.declineEV.toFixed(0)}) at ${(successProb * 100).toFixed(0)}% odds`
          : `Better to start fresh (EV: ${ev.declineEV.toFixed(0)} vs ${ev.attemptEV.toFixed(0)})`,
      };
    }
  }
}

/**
 * Make a complete AI decision for the current turn state
 *
 * Handles both the KEEPING phase (selecting dice) and DECIDING phase (roll/bank)
 */
export function makeAIDecision(
  turnState: TurnState,
  isOnBoard: boolean,
  strategy: AIStrategy,
  strategyName: string = 'balanced',
  entryThreshold: number = DEFAULT_ENTRY_THRESHOLD
): AIDecision {
  // Handle STEAL_REQUIRED phase - decide to attempt or decline
  if (turnState.phase === TurnPhase.STEAL_REQUIRED && !turnState.currentRoll) {
    const stealDecision = shouldAttemptSteal(
      turnState.carryoverPoints,
      turnState.diceRemaining,
      strategyName,
      isOnBoard
    );
    console.log(`🤖 Steal Decision (${strategyName}): ${stealDecision.shouldAttempt ? 'ATTEMPT' : 'DECLINE'} - ${stealDecision.reasoning}`);
    if (!stealDecision.shouldAttempt) {
      return { action: 'DECLINE_CARRYOVER' };
    }
    return { action: 'ROLL' };
  }

  // If we need to keep dice, find the best keep
  if (turnState.phase === TurnPhase.KEEPING || turnState.phase === TurnPhase.STEAL_REQUIRED) {
    if (turnState.currentRoll) {
      const bestKeep = findBestKeep(turnState.currentRoll);
      if (bestKeep.length > 0) {
        return { action: 'KEEP', dice: bestKeep };
      }
    }
  }

  // If we're deciding whether to roll or bank, use the strategy
  if (turnState.phase === TurnPhase.DECIDING) {
    return strategy(turnState, isOnBoard, entryThreshold);
  }

  // Default to rolling
  return { action: 'ROLL' };
}

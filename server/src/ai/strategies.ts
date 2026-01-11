/**
 * AI Strategy implementations for Greedy dice game
 *
 * Strategies are pure functions that consume the same engine APIs as human players.
 * Each strategy decides which dice to keep and whether to continue rolling.
 */

import type { TurnState, Dice, GameState } from '../types/index.js';
import { TurnPhase } from '../types/index.js';
import { scoreSelection } from '../engine/scoring.js';
import { ENTRY_THRESHOLD, DICE_COUNT } from '../engine/constants.js';

/**
 * Context about the game state for carryover-aware decisions
 */
export interface AIGameContext {
  /** Number of dice that would be passed to next player if banking now */
  diceRemainingAfterBank: number;
  /** Whether the next player is on the board (can claim carryover freely) */
  nextPlayerIsOnBoard: boolean;
  /** Current turn score that would become carryover */
  turnScoreForCarryover: number;
}

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
 * Optional gameContext provides info for carryover-aware decisions
 */
export type AIStrategy = (
  turnState: TurnState,
  isOnBoard: boolean,
  gameContext?: AIGameContext
) => AIDecision;

/**
 * Calculate success probability for stealing a carryover with n dice
 */
function calculateCarryoverSuccessProb(diceCount: number): number {
  // P(at least one 1 or 5) = 1 - P(no 1 or 5 in all dice)
  return 1 - Math.pow(4 / 6, diceCount);
}

/**
 * Evaluate the risk of creating a carryover for the opponent
 *
 * Returns a risk score from 0 (no risk) to 1 (maximum risk)
 * Risk is based on:
 * - How many dice opponent gets (more dice = higher steal success)
 * - Whether opponent is on board (can steal freely)
 * - Value of the carryover (more points = more damaging if stolen)
 */
function evaluateCarryoverRisk(context: AIGameContext): {
  riskScore: number;
  stealSuccessProb: number;
  reasoning: string;
} {
  const { diceRemainingAfterBank, nextPlayerIsOnBoard, turnScoreForCarryover } = context;

  // If no dice remaining or very low score, no carryover risk
  if (diceRemainingAfterBank === 0 || turnScoreForCarryover < 100) {
    return { riskScore: 0, stealSuccessProb: 0, reasoning: 'No carryover created' };
  }

  const stealSuccessProb = calculateCarryoverSuccessProb(diceRemainingAfterBank);

  // Risk factors:
  // 1. Steal success probability (4 dice = 94%, 3 dice = 70%, 2 dice = 56%, 1 die = 33%)
  // 2. Whether opponent can claim freely (on board)
  // 3. Value of carryover (logarithmic scale, diminishing returns)

  let riskScore = stealSuccessProb;

  // Increase risk if opponent is on board (they don't need to meet threshold)
  if (nextPlayerIsOnBoard) {
    riskScore *= 1.3; // 30% more risky
  } else {
    // If not on board, they need entry threshold to keep carryover points
    // This makes carryover less valuable to them
    riskScore *= 0.7; // 30% less risky
  }

  // Factor in value (higher value = slightly more risk, but capped)
  const valueFactor = Math.min(1.2, 0.8 + (turnScoreForCarryover / 2000) * 0.4);
  riskScore *= valueFactor;

  // Cap at 1.0
  riskScore = Math.min(1, riskScore);

  const reasoning =
    `${diceRemainingAfterBank} dice @ ${(stealSuccessProb * 100).toFixed(0)}% steal, ` +
    `opponent ${nextPlayerIsOnBoard ? 'on' : 'off'} board, ` +
    `${turnScoreForCarryover} points at risk`;

  return { riskScore, stealSuccessProb, reasoning };
}

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
 * - Avoids creating risky carryovers (3+ dice to opponent on board)
 */
export const conservativeStrategy: AIStrategy = (turnState, isOnBoard, gameContext) => {
  // ALWAYS roll on hot dice - it's free expected value with only ~13% bust chance
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  // If not on board, bank as soon as we hit entry threshold
  if (!isOnBoard && turnState.turnScore >= ENTRY_THRESHOLD) {
    return { action: 'BANK' };
  }

  // If on board, bank at 300+ BUT consider carryover risk
  if (isOnBoard && turnState.turnScore >= 300) {
    // Check carryover risk if context available
    if (gameContext) {
      const risk = evaluateCarryoverRisk(gameContext);
      // Conservative: if banking creates risky carryover (3+ dice, opponent on board),
      // consider rolling again to reduce dice count
      if (risk.riskScore > 0.6 && turnState.diceRemaining > 2) {
        console.log(`🛡️ Conservative avoiding carryover: ${risk.reasoning}`);
        // Only continue if bust risk is acceptable
        const bustProb = Math.pow(4 / 6, turnState.diceRemaining);
        if (bustProb < 0.35) {
          return { action: 'ROLL' };
        }
      }
    }
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
 * - May intentionally create large carryovers for psychological pressure
 */
export const aggressiveStrategy: AIStrategy = (turnState, isOnBoard, gameContext) => {
  // ALWAYS roll on hot dice
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  // When not on board, still need to eventually bank to get on
  // Aggressive will push harder but not infinitely
  if (!isOnBoard) {
    // Need at least entry threshold to bank
    if (turnState.turnScore < ENTRY_THRESHOLD) {
      return { action: 'ROLL' };
    }

    // Aggressive pushes for more points but banks if:
    // - High bust risk (1-2 dice) and decent score
    // - Very high score accumulated
    const bustProb = Math.pow(4 / 6, turnState.diceRemaining);
    const highRisk = bustProb >= 0.4;
    const decentScore = turnState.turnScore >= ENTRY_THRESHOLD + 300;
    const greatScore = turnState.turnScore >= 1500;

    if ((highRisk && decentScore) || greatScore) {
      return { action: 'BANK' };
    }

    return { action: 'ROLL' };
  }

  // On board - aggressive behavior with carryover awareness
  // Push for hot dice if we're close
  if (turnState.diceRemaining <= 2 && turnState.turnScore < 2500) {
    return { action: 'ROLL' };
  }

  if (turnState.turnScore >= 3500) {
    // Even aggressive banks at 3500, but might consider carryover for mind games
    if (gameContext && gameContext.diceRemainingAfterBank >= 3) {
      // Large carryover creates pressure - aggressive likes this!
      console.log(`🔥 Aggressive creating pressure carryover: ${gameContext.diceRemainingAfterBank} dice, ${gameContext.turnScoreForCarryover} points`);
    }
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
 * - Weighs carryover risk vs bust risk when deciding to bank
 */
export const balancedStrategy: AIStrategy = (turnState, isOnBoard, gameContext) => {
  // ALWAYS roll on hot dice - it's free expected value
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  const minBankThreshold = isOnBoard ? 0 : ENTRY_THRESHOLD;

  // Cannot bank below entry threshold when not on board
  if (turnState.turnScore < minBankThreshold) {
    return { action: 'ROLL' };
  }

  // PRIORITY: If not on board and we can get on, be conservative!
  // Getting on the board is critical - don't risk it for marginal gains
  if (!isOnBoard && turnState.turnScore >= ENTRY_THRESHOLD) {
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
    const barelyOverThreshold = turnState.turnScore < ENTRY_THRESHOLD + 150;
    const verySafeOdds = bustProb < 0.25; // 4+ dice

    if (!(barelyOverThreshold && verySafeOdds)) {
      return { action: 'BANK' };
    }
    // Otherwise, we have 4+ dice and are barely over - might as well push for a bit more
  }

  // Calculate risk/reward ratio
  const ev = calculateRollEV(turnState.diceRemaining);
  const riskValue = turnState.turnScore; // What we'd lose on bust
  const bustProb = Math.pow(4 / 6, turnState.diceRemaining);

  // Dynamic threshold based on dice remaining
  // More dice = safer to roll
  const diceBonus = (turnState.diceRemaining / DICE_COUNT) * 500;
  const effectiveThreshold = 1000 - diceBonus;

  // Check carryover risk if context available
  let carryoverRiskAdjustment = 0;
  if (gameContext && turnState.turnScore >= effectiveThreshold) {
    const risk = evaluateCarryoverRisk(gameContext);
    // If carryover is risky and bust risk is acceptable, consider rolling
    if (risk.riskScore > 0.5 && bustProb < 0.4) {
      // Carryover is risky - maybe roll to reduce dice
      carryoverRiskAdjustment = risk.riskScore * 300; // Add to threshold
      console.log(`⚖️ Balanced weighing carryover: ${risk.reasoning}, adjustment: +${carryoverRiskAdjustment.toFixed(0)}`);
    }
  }

  // Bank if we have a good score and risk outweighs reward
  // Carryover adjustment raises the bank threshold (making us more likely to roll)
  if (
    turnState.turnScore >= effectiveThreshold + carryoverRiskAdjustment &&
    riskValue > ev * 3
  ) {
    return { action: 'BANK' };
  }

  // Bank if score is high enough regardless (but still consider carryover)
  if (turnState.turnScore >= 1500 + carryoverRiskAdjustment / 2) {
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
 * - Ignores carryover considerations (true chaos!)
 */
export const chaosStrategy: AIStrategy = (turnState, isOnBoard, _gameContext) => {
  // Even chaos knows to roll on hot dice - it's too good to pass up!
  if (hasHotDice(turnState)) {
    return { action: 'ROLL' };
  }

  const minBankThreshold = isOnBoard ? 0 : ENTRY_THRESHOLD;

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
 * Build game context for carryover-aware decisions
 */
function buildGameContext(gameState: GameState): AIGameContext {
  const { turn, players, currentPlayerIndex } = gameState;
  const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
  const nextPlayer = players[nextPlayerIndex];

  return {
    diceRemainingAfterBank: turn.diceRemaining,
    nextPlayerIsOnBoard: nextPlayer.isOnBoard,
    turnScoreForCarryover: turn.turnScore,
  };
}

/**
 * Make a complete AI decision for the current turn state
 *
 * Handles both the KEEPING phase (selecting dice) and DECIDING phase (roll/bank)
 * Optionally accepts full game state for carryover-aware decisions
 */
export function makeAIDecision(
  turnState: TurnState,
  isOnBoard: boolean,
  strategy: AIStrategy,
  strategyName: string = 'balanced',
  gameState?: GameState
): AIDecision {
  // Build game context if we have the full game state
  const gameContext = gameState ? buildGameContext(gameState) : undefined;

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

  // If we're deciding whether to roll or bank, use the strategy with context
  if (turnState.phase === TurnPhase.DECIDING) {
    return strategy(turnState, isOnBoard, gameContext);
  }

  // Default to rolling
  return { action: 'ROLL' };
}

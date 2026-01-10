/**
 * Scoring functions for Greedy dice game
 *
 * All scoring logic is pure functions with no side effects.
 */

import type { Dice, DieValue, ScoringResult, ScoringBreakdownItem } from '../types/index.js';
import {
  SINGLE_1,
  SINGLE_5,
  TRIPLE_VALUES,
  SMALL_STRAIGHT,
  LARGE_STRAIGHT,
  getFourOfKindScore,
  getFiveOfKindScore,
} from './constants.js';

/**
 * Count occurrences of each die value
 */
export function countDice(dice: Dice): Map<DieValue, number> {
  const counts = new Map<DieValue, number>();
  for (const die of dice) {
    counts.set(die, (counts.get(die) || 0) + 1);
  }
  return counts;
}

/**
 * Score only the single 1s and 5s in a dice selection
 * Does NOT check for combinations - use for residual singles only
 */
export function scoreSingles(dice: Dice): number {
  let score = 0;
  for (const die of dice) {
    if (die === 1) score += SINGLE_1;
    else if (die === 5) score += SINGLE_5;
  }
  return score;
}

/**
 * Check if dice form a large straight (1-2-3-4-5 or 2-3-4-5-6)
 * Returns the type of straight or null
 */
function getLargeStraight(counts: Map<DieValue, number>): '12345' | '23456' | null {
  if (counts.size !== 5) return null;

  // Check for 1-2-3-4-5
  if (
    counts.get(1) === 1 &&
    counts.get(2) === 1 &&
    counts.get(3) === 1 &&
    counts.get(4) === 1 &&
    counts.get(5) === 1
  ) {
    return '12345';
  }

  // Check for 2-3-4-5-6
  if (
    counts.get(2) === 1 &&
    counts.get(3) === 1 &&
    counts.get(4) === 1 &&
    counts.get(5) === 1 &&
    counts.get(6) === 1
  ) {
    return '23456';
  }

  return null;
}

/**
 * Check if dice form a small straight (any 4 sequential: 1-2-3-4, 2-3-4-5, or 3-4-5-6)
 * Returns the type of small straight or null
 */
function getSmallStraight(counts: Map<DieValue, number>, diceCount: number): '1234' | '2345' | '3456' | null {
  if (diceCount < 4) return null;

  // Check for 1-2-3-4
  if (
    counts.get(1) &&
    counts.get(1)! >= 1 &&
    counts.get(2) === 1 &&
    counts.get(3) === 1 &&
    counts.get(4) === 1
  ) {
    // Make sure it's not a large straight being misidentified
    if (counts.get(5) === 1 && diceCount === 5 && counts.size === 5) {
      return null; // This is a large straight
    }
    // Check if it's exactly 1-2-3-4 (with possible extras)
    const has1234 = counts.get(2) === 1 && counts.get(3) === 1 && counts.get(4) === 1 && (counts.get(1) || 0) >= 1;
    if (has1234 && !counts.get(5)) {
      return '1234';
    }
    // If we have 5 but not as part of large straight
    if (has1234 && counts.get(5) && (counts.get(5)! > 1 || counts.get(1)! > 1 || diceCount > 5)) {
      return '1234';
    }
  }

  // Check for 2-3-4-5
  if (
    counts.get(2) === 1 &&
    counts.get(3) === 1 &&
    counts.get(4) === 1 &&
    counts.get(5) &&
    counts.get(5)! >= 1
  ) {
    // Make sure it's not a large straight
    if (counts.get(1) === 1 && diceCount === 5 && counts.size === 5) {
      return null; // This is a large straight 1-2-3-4-5
    }
    if (counts.get(6) === 1 && diceCount === 5 && counts.size === 5) {
      return null; // This is a large straight 2-3-4-5-6
    }
    // Check if it's exactly 2-3-4-5 (with possible extras)
    const has2345 = counts.get(2) === 1 && counts.get(3) === 1 && counts.get(4) === 1 && (counts.get(5) || 0) >= 1;
    if (has2345 && !counts.get(1) && !counts.get(6)) {
      return '2345';
    }
    if (has2345 && counts.get(1) && (counts.get(1)! > 1 || counts.get(5)! > 1)) {
      return '2345';
    }
    if (has2345 && counts.get(6) && (counts.get(6)! > 1 || counts.get(5)! > 1)) {
      return '2345';
    }
  }

  // Check for 3-4-5-6
  if (
    counts.get(3) === 1 &&
    counts.get(4) === 1 &&
    counts.get(5) &&
    counts.get(5)! >= 1 &&
    counts.get(6) === 1
  ) {
    // Make sure it's not a large straight
    if (counts.get(2) === 1 && diceCount === 5 && counts.size === 5) {
      return null; // This is a large straight 2-3-4-5-6
    }
    return '3456';
  }

  return null;
}

/**
 * Find the highest multiple (3, 4, or 5 of a kind) in the dice
 */
function findHighestMultiple(counts: Map<DieValue, number>): { face: DieValue; count: number } | null {
  let best: { face: DieValue; count: number } | null = null;

  for (const [face, count] of counts) {
    if (count >= 3) {
      if (!best || count > best.count) {
        best = { face, count };
      }
    }
  }

  return best;
}

/**
 * Create an array with n copies of a value
 */
function repeat(value: DieValue, count: number): Dice {
  return Array(count).fill(value) as Dice;
}

/**
 * Calculate the complete score for a dice selection
 * Finds the optimal scoring combination
 */
export function scoreSelection(dice: Dice): ScoringResult {
  if (dice.length === 0) {
    return {
      score: 0,
      scoringDice: [],
      remainingDice: [],
      breakdown: [],
    };
  }

  const counts = countDice(dice);
  const breakdown: ScoringBreakdownItem[] = [];
  let totalScore = 0;
  const scoringDice: Dice = [];
  let remainingCounts = new Map(counts);

  // Check for five of a kind first (double four-of-a-kind value)
  const multiple = findHighestMultiple(counts);
  if (multiple && multiple.count === 5) {
    const fiveOfKindScore = getFiveOfKindScore(multiple.face);
    totalScore = fiveOfKindScore;
    scoringDice.push(...repeat(multiple.face, 5));
    breakdown.push({
      description: `Five ${multiple.face}s`,
      points: fiveOfKindScore,
      dice: repeat(multiple.face, 5),
    });
    remainingCounts.delete(multiple.face);

    return {
      score: totalScore,
      scoringDice,
      remainingDice: [],
      breakdown,
    };
  }

  // Check for large straight (1500 points) - must use all 5 dice (1-2-3-4-5 or 2-3-4-5-6)
  const largeStraight = getLargeStraight(counts);
  if (largeStraight) {
    totalScore = LARGE_STRAIGHT;
    scoringDice.push(...dice);
    breakdown.push({
      description: `Large Straight (${largeStraight === '12345' ? '1-2-3-4-5' : '2-3-4-5-6'})`,
      points: LARGE_STRAIGHT,
      dice: [...dice],
    });

    return {
      score: totalScore,
      scoringDice,
      remainingDice: [],
      breakdown,
    };
  }

  // Check for four of a kind (double triple value)
  if (multiple && multiple.count === 4) {
    const fourOfKindScore = getFourOfKindScore(multiple.face);
    totalScore += fourOfKindScore;
    scoringDice.push(...repeat(multiple.face, 4));
    breakdown.push({
      description: `Four ${multiple.face}s`,
      points: fourOfKindScore,
      dice: repeat(multiple.face, 4),
    });
    remainingCounts.set(multiple.face, 0);
    remainingCounts.delete(multiple.face);

    // Check for remaining singles
    for (const [face, count] of remainingCounts) {
      if (face === 1) {
        totalScore += count * SINGLE_1;
        scoringDice.push(...repeat(1, count));
        if (count > 0) {
          breakdown.push({
            description: count === 1 ? 'Single 1' : `${count} Single 1s`,
            points: count * SINGLE_1,
            dice: repeat(1, count),
          });
        }
        remainingCounts.delete(face);
      } else if (face === 5) {
        totalScore += count * SINGLE_5;
        scoringDice.push(...repeat(5, count));
        if (count > 0) {
          breakdown.push({
            description: count === 1 ? 'Single 5' : `${count} Single 5s`,
            points: count * SINGLE_5,
            dice: repeat(5, count),
          });
        }
        remainingCounts.delete(face);
      }
    }

    const remaining: Dice = [];
    for (const [face, count] of remainingCounts) {
      remaining.push(...repeat(face, count));
    }

    return {
      score: totalScore,
      scoringDice,
      remainingDice: remaining,
      breakdown,
    };
  }

  // Check for small straight (750 points)
  const smallStraight = getSmallStraight(counts, dice.length);
  if (smallStraight) {
    totalScore += SMALL_STRAIGHT;
    const straightDice: Dice = smallStraight === '1234' ? [1, 2, 3, 4] : smallStraight === '2345' ? [2, 3, 4, 5] : [3, 4, 5, 6];
    const straightLabel = smallStraight === '1234' ? '1-2-3-4' : smallStraight === '2345' ? '2-3-4-5' : '3-4-5-6';
    scoringDice.push(...straightDice);
    breakdown.push({
      description: `Small Straight (${straightLabel})`,
      points: SMALL_STRAIGHT,
      dice: straightDice,
    });

    // Remove straight dice from remaining
    for (const die of straightDice) {
      const current = remainingCounts.get(die as DieValue) || 0;
      if (current <= 1) {
        remainingCounts.delete(die as DieValue);
      } else {
        remainingCounts.set(die as DieValue, current - 1);
      }
    }

    // Check for remaining singles
    for (const [face, count] of remainingCounts) {
      if (face === 1 && count > 0) {
        totalScore += count * SINGLE_1;
        scoringDice.push(...repeat(1, count));
        breakdown.push({
          description: count === 1 ? 'Single 1' : `${count} Single 1s`,
          points: count * SINGLE_1,
          dice: repeat(1, count),
        });
        remainingCounts.delete(face);
      } else if (face === 5 && count > 0) {
        totalScore += count * SINGLE_5;
        scoringDice.push(...repeat(5, count));
        breakdown.push({
          description: count === 1 ? 'Single 5' : `${count} Single 5s`,
          points: count * SINGLE_5,
          dice: repeat(5, count),
        });
        remainingCounts.delete(face);
      }
    }

    const remaining: Dice = [];
    for (const [face, count] of remainingCounts) {
      remaining.push(...repeat(face, count));
    }

    return {
      score: totalScore,
      scoringDice,
      remainingDice: remaining,
      breakdown,
    };
  }

  // Check for three of a kind
  if (multiple && multiple.count === 3) {
    const tripleScore = TRIPLE_VALUES[multiple.face];
    totalScore += tripleScore;
    scoringDice.push(...repeat(multiple.face, 3));
    breakdown.push({
      description: `Three ${multiple.face}s`,
      points: tripleScore,
      dice: repeat(multiple.face, 3),
    });
    remainingCounts.delete(multiple.face);

    // Check for remaining singles
    for (const [face, count] of remainingCounts) {
      if (face === 1) {
        totalScore += count * SINGLE_1;
        scoringDice.push(...repeat(1, count));
        if (count > 0) {
          breakdown.push({
            description: count === 1 ? 'Single 1' : `${count} Single 1s`,
            points: count * SINGLE_1,
            dice: repeat(1, count),
          });
        }
        remainingCounts.delete(face);
      } else if (face === 5) {
        totalScore += count * SINGLE_5;
        scoringDice.push(...repeat(5, count));
        if (count > 0) {
          breakdown.push({
            description: count === 1 ? 'Single 5' : `${count} Single 5s`,
            points: count * SINGLE_5,
            dice: repeat(5, count),
          });
        }
        remainingCounts.delete(face);
      }
    }

    const remaining: Dice = [];
    for (const [face, count] of remainingCounts) {
      remaining.push(...repeat(face, count));
    }

    return {
      score: totalScore,
      scoringDice,
      remainingDice: remaining,
      breakdown,
    };
  }

  // No combinations found, just score singles
  for (const [face, count] of counts) {
    if (face === 1) {
      totalScore += count * SINGLE_1;
      scoringDice.push(...repeat(1, count));
      if (count > 0) {
        breakdown.push({
          description: count === 1 ? 'Single 1' : `${count} Single 1s`,
          points: count * SINGLE_1,
          dice: repeat(1, count),
        });
      }
      remainingCounts.delete(face);
    } else if (face === 5) {
      totalScore += count * SINGLE_5;
      scoringDice.push(...repeat(5, count));
      if (count > 0) {
        breakdown.push({
          description: count === 1 ? 'Single 5' : `${count} Single 5s`,
          points: count * SINGLE_5,
          dice: repeat(5, count),
        });
      }
      remainingCounts.delete(face);
    }
  }

  const remaining: Dice = [];
  for (const [face, count] of remainingCounts) {
    remaining.push(...repeat(face, count));
  }

  return {
    score: totalScore,
    scoringDice,
    remainingDice: remaining,
    breakdown,
  };
}

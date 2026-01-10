/**
 * Validation functions for Greedy dice game
 *
 * Validates player actions like keeping dice.
 */

import type { Dice, DieValue, ValidationResult } from '../types/index.js';
import { scoreSelection, countDice } from './scoring.js';

/**
 * Check if a roll contains any scoring dice
 */
export function hasScoring(dice: Dice): boolean {
  if (dice.length === 0) return false;
  const result = scoreSelection(dice);
  return result.score > 0;
}

/**
 * Check if a roll is a bust (no scoring dice)
 */
export function isBust(dice: Dice): boolean {
  return !hasScoring(dice);
}

/**
 * Check if the kept dice can be formed from the rolled dice
 */
function canFormKeep(roll: Dice, keep: Dice): boolean {
  const rollCounts = countDice(roll);
  const keepCounts = countDice(keep);

  for (const [face, count] of keepCounts) {
    const available = rollCounts.get(face) || 0;
    if (count > available) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a selection of dice scores on its own
 * This validates that keeping these specific dice is legal
 */
function isValidScoringSelection(keep: Dice): boolean {
  if (keep.length === 0) return false;

  const result = scoreSelection(keep);

  // The kept dice must score AND all kept dice must contribute to the score
  // (no non-scoring dice can be kept)
  if (result.score === 0) return false;

  // All kept dice must be scoring dice
  return result.remainingDice.length === 0;
}

/**
 * Validate that a player's keep action is legal
 *
 * Rules:
 * - Must keep at least one die
 * - Can only keep dice that were rolled
 * - Kept dice must form a valid scoring combination
 * - Partial combos are only valid for 1s and 5s (which score individually)
 */
export function validateKeep(roll: Dice, keep: Dice): ValidationResult {
  // Must keep at least one die
  if (keep.length === 0) {
    return {
      valid: false,
      error: 'Must keep at least one die',
    };
  }

  // Check if all kept dice are available in the roll
  if (!canFormKeep(roll, keep)) {
    return {
      valid: false,
      error: 'Cannot keep dice that were not rolled',
    };
  }

  // Check if the kept dice form a valid scoring selection
  if (!isValidScoringSelection(keep)) {
    return {
      valid: false,
      error: 'Kept dice do not form a valid scoring combination',
    };
  }

  return { valid: true };
}

/**
 * Check if a die at given index is part of any scoring combination in the roll
 */
function isDiePartOfScoringCombo(roll: Dice, index: number): boolean {
  const dieValue = roll[index];

  // 1s and 5s always score
  if (dieValue === 1 || dieValue === 5) return true;

  // Count occurrences of this value
  let count = 0;
  for (const v of roll) {
    if (v === dieValue) count++;
  }

  // Part of a triple or better
  if (count >= 3) return true;

  // Check if part of a straight (1-2-3-4, 2-3-4-5, 3-4-5-6, 1-2-3-4-5, or 2-3-4-5-6)
  const values = new Set(roll);
  const hasSmallStraight14 = values.has(1) && values.has(2) && values.has(3) && values.has(4);
  const hasSmallStraight25 = values.has(2) && values.has(3) && values.has(4) && values.has(5);
  const hasSmallStraight36 = values.has(3) && values.has(4) && values.has(5) && values.has(6);
  const hasLargeStraight12345 = hasSmallStraight14 && values.has(5);
  const hasLargeStraight23456 = hasSmallStraight25 && values.has(6);

  if (hasLargeStraight12345 && dieValue >= 1 && dieValue <= 5) return true;
  if (hasLargeStraight23456 && dieValue >= 2 && dieValue <= 6) return true;
  if (hasSmallStraight14 && dieValue >= 1 && dieValue <= 4) return true;
  if (hasSmallStraight25 && dieValue >= 2 && dieValue <= 5) return true;
  if (hasSmallStraight36 && dieValue >= 3 && dieValue <= 6) return true;

  return false;
}

/**
 * Get which dice indices can be selected given current selection
 *
 * A die is selectable if:
 * - It's already selected (can always deselect by clicking again)
 * - No selection yet: the die is part of any scoring combination in the roll
 * - Has selection: adding it could lead to a valid scoring combination
 *
 * This prevents players from selecting non-scoring dice while allowing
 * them to build up combos like straights.
 */
export function getSelectableIndices(roll: Dice, selectedIndices: number[]): Set<number> {
  const selectable = new Set<number>();

  // Already selected dice can always be toggled off
  for (const idx of selectedIndices) {
    selectable.add(idx);
  }

  // If nothing selected yet, allow selecting any die that's part of a scoring combo
  if (selectedIndices.length === 0) {
    for (let i = 0; i < roll.length; i++) {
      if (isDiePartOfScoringCombo(roll, i)) {
        selectable.add(i);
      }
    }
    return selectable;
  }

  // Get current selection's dice and score
  const currentSelection = selectedIndices.map(i => roll[i]);
  const currentResult = scoreSelection(currentSelection);
  const currentScore = currentResult.score;

  // Check each unselected die
  for (let i = 0; i < roll.length; i++) {
    if (selectedIndices.includes(i)) continue;

    // Try adding this die to the selection
    const newSelection = [...currentSelection, roll[i]];
    const newResult = scoreSelection(newSelection);

    // Selectable if:
    // 1. It increases score AND all dice contribute, OR
    // 2. Both the current selection AND this die are part of the same scoring combo in the roll
    //    (allows building up straights/triples even when partial selection doesn't score)
    if (newResult.score > currentScore && newResult.remainingDice.length === 0) {
      selectable.add(i);
    } else if (isDiePartOfScoringCombo(roll, i) && allSelectedArePartOfCombo(roll, selectedIndices)) {
      // Check if the combined selection could eventually score
      // by checking if all dice (current + new) are part of combos in the roll
      const allIndices = [...selectedIndices, i];
      if (couldFormValidCombo(roll, allIndices)) {
        selectable.add(i);
      }
    }
  }

  return selectable;
}

/**
 * Check if all selected dice are part of scoring combos in the roll
 */
function allSelectedArePartOfCombo(roll: Dice, selectedIndices: number[]): boolean {
  for (const idx of selectedIndices) {
    if (!isDiePartOfScoringCombo(roll, idx)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a set of dice indices could form a valid scoring combination
 * This checks if the selection is working toward a valid combo in the roll
 * AND that the combo isn't already complete (would need more dice to help)
 */
function couldFormValidCombo(roll: Dice, indices: number[]): boolean {
  const selectedDice = indices.map(i => roll[i]);
  const selectedCounts = countDice(selectedDice);
  const rollValues = new Set(roll);

  // Check if selection is building toward a large straight in the roll
  const hasLargeStraight12345 = rollValues.has(1) && rollValues.has(2) && rollValues.has(3) && rollValues.has(4) && rollValues.has(5);
  const hasLargeStraight23456 = rollValues.has(2) && rollValues.has(3) && rollValues.has(4) && rollValues.has(5) && rollValues.has(6);

  if (hasLargeStraight12345) {
    // For a straight, each value can only be used once
    // Check if selection uses at most one of each value in the straight
    const straightValues = [1, 2, 3, 4, 5];
    const validForStraight = straightValues.every(v => (selectedCounts.get(v as DieValue) || 0) <= 1);
    const allInStraight = [...selectedCounts.keys()].every(v => straightValues.includes(v));
    if (validForStraight && allInStraight && selectedDice.length <= 5) {
      return true;
    }
  }

  if (hasLargeStraight23456) {
    const straightValues = [2, 3, 4, 5, 6];
    const validForStraight = straightValues.every(v => (selectedCounts.get(v as DieValue) || 0) <= 1);
    const allInStraight = [...selectedCounts.keys()].every(v => straightValues.includes(v));
    if (validForStraight && allInStraight && selectedDice.length <= 5) {
      return true;
    }
  }

  // Check if selection is building toward a small straight in the roll
  const hasSmallStraight14 = rollValues.has(1) && rollValues.has(2) && rollValues.has(3) && rollValues.has(4);
  const hasSmallStraight25 = rollValues.has(2) && rollValues.has(3) && rollValues.has(4) && rollValues.has(5);
  const hasSmallStraight36 = rollValues.has(3) && rollValues.has(4) && rollValues.has(5) && rollValues.has(6);

  if (hasSmallStraight14) {
    const straightValues = [1, 2, 3, 4];
    const validForStraight = straightValues.every(v => (selectedCounts.get(v as DieValue) || 0) <= 1);
    const allInStraight = [...selectedCounts.keys()].every(v => straightValues.includes(v));
    if (validForStraight && allInStraight && selectedDice.length <= 4) {
      return true;
    }
  }

  if (hasSmallStraight25) {
    const straightValues = [2, 3, 4, 5];
    const validForStraight = straightValues.every(v => (selectedCounts.get(v as DieValue) || 0) <= 1);
    const allInStraight = [...selectedCounts.keys()].every(v => straightValues.includes(v));
    if (validForStraight && allInStraight && selectedDice.length <= 4) {
      return true;
    }
  }

  if (hasSmallStraight36) {
    const straightValues = [3, 4, 5, 6];
    const validForStraight = straightValues.every(v => (selectedCounts.get(v as DieValue) || 0) <= 1);
    const allInStraight = [...selectedCounts.keys()].every(v => straightValues.includes(v));
    if (validForStraight && allInStraight && selectedDice.length <= 4) {
      return true;
    }
  }

  // Check if selection is part of a triple/quad/quint in the roll
  const rollCounts = countDice(roll);
  for (const [face, count] of rollCounts) {
    if (count >= 3) {
      // There's a triple+ of this face in the roll
      // Check if all selected dice of this face could be part of it
      const selectedOfFace = selectedCounts.get(face) || 0;
      if (selectedOfFace > 0 && selectedOfFace <= count) {
        // All selected dice could be part of a combo
        const otherSelected = selectedDice.filter(d => d !== face);
        // Check if other selected dice are 1s or 5s (which always score)
        if (otherSelected.every(d => d === 1 || d === 5)) {
          return true;
        }
        // Or if we're only selecting dice of this face
        if (otherSelected.length === 0) {
          return true;
        }
      }
    }
  }

  // Check if selection is only 1s and 5s (always valid)
  if ([...selectedCounts.keys()].every(v => v === 1 || v === 5)) {
    return true;
  }

  return false;
}

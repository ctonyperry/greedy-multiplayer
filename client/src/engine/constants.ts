/**
 * Game constants for Greedy dice game
 */

export const DICE_COUNT = 5;
export const ENTRY_THRESHOLD = 650;
export const TARGET_SCORE = 10000;

// Single dice scoring
export const SINGLE_1 = 100;
export const SINGLE_5 = 50;

// Triple scoring
export const TRIPLE_1 = 1000;
export const TRIPLE_2 = 200;
export const TRIPLE_3 = 300;
export const TRIPLE_4 = 400;
export const TRIPLE_5 = 500;
export const TRIPLE_6 = 600;

// Straights
export const SMALL_STRAIGHT = 750;
export const LARGE_STRAIGHT = 1500;

// Triple values by die face
export const TRIPLE_VALUES: Record<number, number> = {
  1: TRIPLE_1,
  2: TRIPLE_2,
  3: TRIPLE_3,
  4: TRIPLE_4,
  5: TRIPLE_5,
  6: TRIPLE_6,
};

/**
 * Get four-of-a-kind score (double the triple value)
 */
export function getFourOfKindScore(face: number): number {
  return TRIPLE_VALUES[face] * 2;
}

/**
 * Get five-of-a-kind score (double the four-of-a-kind value)
 */
export function getFiveOfKindScore(face: number): number {
  return getFourOfKindScore(face) * 2;
}

/**
 * Automatic short human name generator
 * Uses Adjective + Noun pattern for memorable, fun names
 * Optimized for dice game context
 */

// Fun, positive adjectives (2-8 chars)
const ADJECTIVES = [
  // Luck/fortune themed
  'Lucky', 'Golden', 'Bold', 'Clever', 'Quick',
  // Personality
  'Happy', 'Jolly', 'Eager', 'Brave', 'Swift',
  // Colors (short, vivid)
  'Red', 'Blue', 'Jade', 'Amber', 'Coral',
  // Dice/game themed
  'Hot', 'Wild', 'Ace', 'Slick', 'Sharp',
  // Nature descriptors
  'Misty', 'Sunny', 'Frost', 'Storm', 'Flash',
  // Fun vibes
  'Funky', 'Zesty', 'Sassy', 'Spicy', 'Cool',
];

// Nouns - mix of animals, objects, and concepts (2-8 chars)
const NOUNS = [
  // Classic animals (short)
  'Fox', 'Bear', 'Wolf', 'Owl', 'Hawk',
  'Panda', 'Tiger', 'Otter', 'Raven', 'Lynx',
  // Dice/game themed
  'Dice', 'Ace', 'Roller', 'Player', 'Shark',
  // Fun objects
  'Star', 'Moon', 'Bolt', 'Spark', 'Blaze',
  // Mythical (short)
  'Dragon', 'Phoenix', 'Rogue', 'Knight', 'Wizard',
  // Miscellaneous fun
  'Ninja', 'Pirate', 'Ghost', 'Rebel', 'Scout',
];

/**
 * Generate a random short human-readable name
 * Format: AdjectiveNoun (e.g., "LuckyFox", "BoldAce")
 * Max ~16 characters, typically 8-14
 */
export function generateName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective}${noun}`;
}

/**
 * Generate a unique name with optional suffix for conflicts
 * Returns names like "LuckyFox" or "LuckyFox7" if suffix needed
 */
export function generateUniqueName(existingNames: Set<string>, maxAttempts = 10): string {
  // Try without suffix first
  for (let i = 0; i < maxAttempts; i++) {
    const name = generateName();
    if (!existingNames.has(name)) {
      return name;
    }
  }

  // If all attempts collide, add a random 2-digit suffix
  const baseName = generateName();
  const suffix = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${baseName}${suffix}`;
}

/**
 * Generate multiple unique names at once
 */
export function generateUniqueNames(count: number, existingNames: Set<string> = new Set()): string[] {
  const names: string[] = [];
  const usedNames = new Set(existingNames);

  for (let i = 0; i < count; i++) {
    const name = generateUniqueName(usedNames);
    names.push(name);
    usedNames.add(name);
  }

  return names;
}

/**
 * Validate if a name looks like it was auto-generated
 * Useful for distinguishing custom names from generated ones
 */
export function isGeneratedName(name: string): boolean {
  // Check if it matches the Adjective+Noun pattern (with optional number suffix)
  const pattern = new RegExp(
    `^(${ADJECTIVES.join('|')})(${NOUNS.join('|')})(\\d{1,2})?$`
  );
  return pattern.test(name);
}

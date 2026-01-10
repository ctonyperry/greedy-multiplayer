/**
 * User and authentication types
 * Shared between client and server
 */

/** User preferences for gameplay */
export interface UserPreferences {
  /** Default AI strategy for AI takeover */
  defaultAiStrategy: string;
  /** Personal turn timer preference in seconds (0 = no timer) */
  turnTimerPreference: number;
  /** AI strategy to use when timer expires (null = skip turn) */
  aiTakeoverStrategy: string | null;
}

/** User profile from Azure AD B2C */
export interface User {
  /** User ID (from Azure AD B2C / Google) */
  id: string;
  /** Display name */
  displayName: string;
  /** Email address */
  email: string;
  /** Profile photo URL */
  photoUrl: string | null;
  /** Total games played */
  gamesPlayed: number;
  /** Total games won */
  gamesWon: number;
  /** Highest score achieved */
  highScore: number;
  /** User preferences */
  preferences: UserPreferences;
  /** Account creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastSeen: string;
}

/** Leaderboard ranking entry */
export interface LeaderboardEntry {
  /** Rank position */
  rank: number;
  /** User ID */
  userId: string;
  /** Display name */
  displayName: string;
  /** Total wins */
  wins: number;
  /** Total games played */
  gamesPlayed: number;
  /** Win rate (0-1) */
  winRate: number;
  /** Highest score */
  highScore: number;
}

/** Leaderboard document */
export interface Leaderboard {
  /** Leaderboard ID (e.g., "alltime", "weekly-2024-01") */
  id: string;
  /** Period identifier */
  period: string;
  /** Ranked entries */
  rankings: LeaderboardEntry[];
  /** Last update timestamp */
  updatedAt: string;
}

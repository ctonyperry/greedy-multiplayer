/**
 * REST API Service
 * Handles HTTP requests to the multiplayer server
 */

import type {
  Game,
  GameSettings,
  UserProfile,
  UserPreferences,
  UserStats,
  LeaderboardEntry,
} from '../types/index.js';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token getter (set by AuthContext)
let getAccessToken: (() => Promise<string | null>) | null = null;

/**
 * Set the token getter function (called by AuthContext)
 */
export function setTokenGetter(getter: () => Promise<string | null>) {
  getAccessToken = getter;
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth token if available
  if (getAccessToken) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// Auth API
// ============================================

/**
 * Get current user profile
 */
export async function getMe(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/me');
}

/**
 * Update user preferences
 */
export async function updatePreferences(
  preferences: Partial<UserPreferences>
): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/profile', {
    method: 'POST',
    body: JSON.stringify({ preferences }),
  });
}

/**
 * Get user stats
 */
export async function getUserStats(): Promise<UserStats> {
  return apiRequest<UserStats>('/auth/stats');
}

/**
 * Get user's active games
 */
export async function getMyGames(): Promise<Game[]> {
  const response = await apiRequest<{ games: Game[] }>('/auth/games');
  return response.games;
}

// ============================================
// Games API
// ============================================

/**
 * Create a new game
 */
export async function createGame(settings?: Partial<GameSettings>): Promise<{
  code: string;
  game: Game;
}> {
  return apiRequest('/games', {
    method: 'POST',
    body: JSON.stringify({ settings }),
  });
}

/**
 * Get game by code
 */
export async function getGame(code: string): Promise<Game> {
  const response = await apiRequest<{ game: Game }>(`/games/${code}`);
  return response.game;
}

/**
 * Join an existing game
 */
export async function joinGame(code: string, aiTakeoverStrategy?: string): Promise<Game> {
  const response = await apiRequest<{ game: Game }>(`/games/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ aiTakeoverStrategy }),
  });
  return response.game;
}

/**
 * Add AI player to game (host only)
 */
export async function addAIPlayer(
  code: string,
  name: string,
  strategy: string = 'balanced'
): Promise<Game> {
  const response = await apiRequest<{ game: Game }>(`/games/${code}/ai`, {
    method: 'POST',
    body: JSON.stringify({ name, strategy }),
  });
  return response.game;
}

/**
 * Remove player from game
 */
export async function removePlayer(
  code: string,
  playerId: string
): Promise<Game> {
  const response = await apiRequest<{ game: Game }>(
    `/games/${code}/players/${playerId}`,
    {
      method: 'DELETE',
    }
  );
  return response.game;
}

/**
 * Start the game (host only)
 */
export async function startGame(code: string): Promise<Game> {
  const response = await apiRequest<{ game: Game }>(`/games/${code}/start`, {
    method: 'POST',
  });
  return response.game;
}

/**
 * Leave a game
 */
export async function leaveGame(code: string): Promise<void> {
  await apiRequest(`/games/${code}/leave`, {
    method: 'POST',
  });
}

/**
 * Update player's AI takeover strategy
 */
export async function updatePlayerStrategy(
  code: string,
  strategy: string
): Promise<Game> {
  const response = await apiRequest<{ game: Game }>(`/games/${code}/strategy`, {
    method: 'POST',
    body: JSON.stringify({ strategy }),
  });
  return response.game;
}

/**
 * Forfeit the game (concede defeat)
 */
export async function forfeitGame(code: string): Promise<{ success: boolean; winnerId: string }> {
  return apiRequest(`/games/${code}/forfeit`, {
    method: 'POST',
  });
}

// ============================================
// Leaderboard API
// ============================================

/**
 * Get leaderboard rankings
 */
export async function getLeaderboard(
  period: string = 'alltime'
): Promise<LeaderboardEntry[]> {
  const response = await apiRequest<{ rankings: LeaderboardEntry[] }>(
    `/leaderboard/${period}`
  );
  return response.rankings;
}

// ============================================
// API Object Export
// ============================================

export const api = {
  // Auth
  getMe,
  updatePreferences,
  getUserStats,
  getMyGames,

  // Games
  createGame,
  getGame,
  joinGame,
  addAIPlayer,
  removePlayer,
  startGame,
  leaveGame,
  updatePlayerStrategy,
  forfeitGame,

  // Leaderboard
  getLeaderboard,
};

export default api;

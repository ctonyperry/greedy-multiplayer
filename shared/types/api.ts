/**
 * API request/response types and multiplayer game types
 * Shared between client and server
 */

import type { GameState, Dice } from './game.js';
import type { User, UserPreferences } from './user.js';

// ============================================
// Multiplayer Game Types
// ============================================

/** Game status */
export type GameStatus = 'waiting' | 'playing' | 'finished';

/** Player in a multiplayer game session */
export interface MultiplayerPlayer {
  /** User ID (or generated ID for AI) */
  id: string;
  /** Display name */
  name: string;
  /** Whether this is an AI player */
  isAI: boolean;
  /** AI strategy (if AI player) */
  aiStrategy?: string;
  /** Whether player is currently connected */
  isConnected: boolean;
  /** Personal turn timer preference */
  turnTimerPreference: number;
  /** AI strategy to use on timeout (null = skip) */
  aiTakeoverStrategy: string | null;
}

/** Game settings (set by host when creating game) */
export interface GameSettings {
  /** Target score to win */
  targetScore: number;
  /** Entry threshold to get on board */
  entryThreshold: number;
  /** Maximum turn timer in seconds (0 = no timer) */
  maxTurnTimer: number;
}

/** Chat message */
export interface ChatMessage {
  /** Message ID */
  id: string;
  /** Sender's player ID */
  playerId: string;
  /** Sender's display name */
  playerName: string;
  /** Message content */
  message: string;
  /** Timestamp */
  timestamp: string;
  /** Message type */
  type: 'chat' | 'system';
}

/** Multiplayer game session */
export interface MultiplayerGame {
  /** Document ID */
  id: string;
  /** 6-character game code */
  code: string;
  /** Host's user ID */
  hostId: string;
  /** Current game status */
  status: GameStatus;
  /** Players in the game */
  players: MultiplayerPlayer[];
  /** Game engine state (null until game starts) */
  gameState: GameState | null;
  /** Game settings */
  settings: GameSettings;
  /** When the current turn started (for timer) */
  currentTurnStartedAt: string | null;
  /** Chat messages (last 100) */
  chat: ChatMessage[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** When game finished (if finished) */
  finishedAt: string | null;
  /** Winner's user ID (if finished) */
  winnerId: string | null;
}

// ============================================
// Game Actions
// ============================================

/** Actions that can be taken in a game */
export type GameAction =
  | { type: 'ROLL'; dice?: Dice }
  | { type: 'KEEP'; dice: Dice }
  | { type: 'BANK' }
  | { type: 'DECLINE_CARRYOVER' }
  | { type: 'END_TURN' };

// ============================================
// Socket.IO Events
// ============================================

/** Client to server events */
export interface ClientToServerEvents {
  authenticate: (data: { token: string }) => void;
  joinGame: (data: { gameCode: string }) => void;
  leaveGame: (data: { gameCode: string }) => void;
  gameAction: (data: { gameCode: string; action: GameAction }) => void;
  chatMessage: (data: { gameCode: string; message: string }) => void;
}

/** Server to client events */
export interface ServerToClientEvents {
  authenticated: (data: { success: boolean; user?: User }) => void;
  authError: (data: { message: string }) => void;
  playerJoined: (data: { player: MultiplayerPlayer }) => void;
  playerLeft: (data: { playerId: string }) => void;
  playerReconnected: (data: { playerId: string }) => void;
  playerDisconnected: (data: { playerId: string }) => void;
  gameStateUpdate: (data: {
    gameState: GameState;
    lastAction?: { playerId: string; action: GameAction };
  }) => void;
  gameStarted: (data: { gameState: GameState }) => void;
  gameEnded: (data: { winner: MultiplayerPlayer; finalState: GameState }) => void;
  turnChanged: (data: {
    currentPlayerId: string;
    isYourTurn: boolean;
    turnStartedAt: string;
    turnExpiresAt?: string;
  }) => void;
  turnTimerUpdate: (data: { remainingSeconds: number }) => void;
  turnTimerExpired: (data: { playerId: string; aiTakeover: boolean }) => void;
  chatMessage: (data: ChatMessage) => void;
  actionError: (data: { message: string }) => void;
}

// ============================================
// REST API Types
// ============================================

/** Create game request */
export interface CreateGameRequest {
  settings?: Partial<GameSettings>;
}

/** Create game response */
export interface CreateGameResponse {
  code: string;
  game: MultiplayerGame;
}

/** Join game request */
export interface JoinGameRequest {
  // User info comes from auth token
}

/** Join game response */
export interface JoinGameResponse {
  game: MultiplayerGame;
}

/** Add AI player request */
export interface AddAIRequest {
  name: string;
  strategy: string;
}

/** Start game response */
export interface StartGameResponse {
  game: MultiplayerGame;
}

/** Update profile request */
export interface UpdateProfileRequest {
  preferences: Partial<UserPreferences>;
}

/** Update profile response */
export interface UpdateProfileResponse {
  user: User;
}

/**
 * Game Manager Service
 * Handles game session management, code generation, and game lifecycle
 */

import { cosmosService } from './cosmos.js';
import { createGameState } from '../engine/game.js';
import type { GameState, GameSettings, MultiplayerGame } from '../types/index.js';

// Alphabet for game codes (no confusing chars: 0/O, 1/I/L)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generate a random game code
 */
function generateGameCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Generate a unique game code (checks for collisions)
 */
async function generateUniqueGameCode(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const code = generateGameCode();
    const existing = await cosmosService.getGame(code);
    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique game code');
}

class GameManager {
  /**
   * Create a new game
   */
  async createGame(
    hostId: string,
    hostName: string,
    settings?: Partial<GameSettings>
  ): Promise<MultiplayerGame> {
    const code = await generateUniqueGameCode();
    const now = new Date().toISOString();

    const game: MultiplayerGame = {
      id: crypto.randomUUID(),
      code,
      hostId,
      status: 'waiting',
      players: [
        {
          id: hostId,
          name: hostName,
          isAI: false,
          isConnected: true,
          turnTimerPreference: 60,
          aiTakeoverStrategy: 'balanced',
        },
      ],
      gameState: null,
      settings: {
        targetScore: settings?.targetScore || 10000,
        entryThreshold: settings?.entryThreshold || 650,
        maxTurnTimer: settings?.maxTurnTimer || 0, // 0 = no timer
      },
      currentTurnStartedAt: null,
      chat: [],
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
      winnerId: null,
    };

    return cosmosService.createGame(game);
  }

  /**
   * Join an existing game
   */
  async joinGame(
    code: string,
    playerId: string,
    playerName: string
  ): Promise<MultiplayerGame> {
    const game = await cosmosService.getGame(code);

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'waiting') {
      throw new Error('Game already started');
    }

    // Check if player is already in game
    const existingPlayer = game.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      // Update connection status
      existingPlayer.isConnected = true;
      game.updatedAt = new Date().toISOString();
      return cosmosService.updateGame(game);
    }

    // Check max players (e.g., 6)
    if (game.players.length >= 6) {
      throw new Error('Game is full');
    }

    // Add player
    game.players.push({
      id: playerId,
      name: playerName,
      isAI: false,
      isConnected: true,
      turnTimerPreference: 60,
      aiTakeoverStrategy: 'balanced',
    });

    game.updatedAt = new Date().toISOString();

    // Add system message
    game.chat.push({
      id: crypto.randomUUID(),
      playerId: 'system',
      playerName: 'System',
      message: `${playerName} joined the game`,
      timestamp: game.updatedAt,
      type: 'system',
    });

    return cosmosService.updateGame(game);
  }

  /**
   * Add an AI player to the game (host only)
   */
  async addAIPlayer(
    code: string,
    hostId: string,
    aiName: string,
    aiStrategy: string
  ): Promise<MultiplayerGame> {
    const game = await cosmosService.getGame(code);

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.hostId !== hostId) {
      throw new Error('Only the host can add AI players');
    }

    if (game.status !== 'waiting') {
      throw new Error('Game already started');
    }

    if (game.players.length >= 6) {
      throw new Error('Game is full');
    }

    // Add AI player
    game.players.push({
      id: `ai-${crypto.randomUUID()}`,
      name: aiName,
      isAI: true,
      aiStrategy,
      isConnected: true,
      turnTimerPreference: 0,
      aiTakeoverStrategy: null,
    });

    game.updatedAt = new Date().toISOString();

    // Add system message
    game.chat.push({
      id: crypto.randomUUID(),
      playerId: 'system',
      playerName: 'System',
      message: `${aiName} (AI - ${aiStrategy}) joined the game`,
      timestamp: game.updatedAt,
      type: 'system',
    });

    return cosmosService.updateGame(game);
  }

  /**
   * Remove a player from the game
   */
  async removePlayer(
    code: string,
    requesterId: string,
    playerIdToRemove: string
  ): Promise<MultiplayerGame> {
    const game = await cosmosService.getGame(code);

    if (!game) {
      throw new Error('Game not found');
    }

    // Can remove self, or host can remove anyone
    const isHost = game.hostId === requesterId;
    const isSelf = requesterId === playerIdToRemove;

    if (!isHost && !isSelf) {
      throw new Error('Not authorized to remove this player');
    }

    if (game.status !== 'waiting') {
      throw new Error('Cannot remove players after game starts');
    }

    const playerIndex = game.players.findIndex((p) => p.id === playerIdToRemove);
    if (playerIndex === -1) {
      throw new Error('Player not found in game');
    }

    const removedPlayer = game.players[playerIndex];
    game.players.splice(playerIndex, 1);
    game.updatedAt = new Date().toISOString();

    // Add system message
    game.chat.push({
      id: crypto.randomUUID(),
      playerId: 'system',
      playerName: 'System',
      message: `${removedPlayer.name} left the game`,
      timestamp: game.updatedAt,
      type: 'system',
    });

    // If host left, assign new host or delete game
    if (playerIdToRemove === game.hostId) {
      const remainingHumans = game.players.filter((p) => !p.isAI);
      if (remainingHumans.length > 0) {
        game.hostId = remainingHumans[0].id;
        game.chat.push({
          id: crypto.randomUUID(),
          playerId: 'system',
          playerName: 'System',
          message: `${remainingHumans[0].name} is now the host`,
          timestamp: game.updatedAt,
          type: 'system',
        });
      }
    }

    return cosmosService.updateGame(game);
  }

  /**
   * Start the game (host only)
   */
  async startGame(code: string, hostId: string): Promise<MultiplayerGame> {
    const game = await cosmosService.getGame(code);

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.hostId !== hostId) {
      throw new Error('Only the host can start the game');
    }

    if (game.status !== 'waiting') {
      throw new Error('Game already started');
    }

    if (game.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Create game state from players
    const playerConfigs = game.players.map((p) => ({
      name: p.name,
      isAI: p.isAI,
      aiStrategy: p.aiStrategy,
    }));

    const gameState = createGameState(playerConfigs, game.settings);

    // Map generated player IDs to our multiplayer player IDs
    gameState.players.forEach((player, index) => {
      player.id = game.players[index].id;
    });

    game.gameState = gameState;
    game.status = 'playing';
    game.currentTurnStartedAt = new Date().toISOString();
    game.updatedAt = game.currentTurnStartedAt;

    // Add system message
    game.chat.push({
      id: crypto.randomUUID(),
      playerId: 'system',
      playerName: 'System',
      message: 'Game started!',
      timestamp: game.updatedAt,
      type: 'system',
    });

    return cosmosService.updateGame(game);
  }

  /**
   * Get game by code
   */
  async getGame(code: string): Promise<MultiplayerGame | null> {
    return cosmosService.getGame(code);
  }

  /**
   * Update game state (after a move)
   */
  async updateGameState(
    code: string,
    gameState: GameState
  ): Promise<MultiplayerGame> {
    const game = await cosmosService.getGame(code);

    if (!game) {
      throw new Error('Game not found');
    }

    game.gameState = gameState;
    game.currentTurnStartedAt = new Date().toISOString();
    game.updatedAt = game.currentTurnStartedAt;

    // Check for game over
    if (gameState.isGameOver && gameState.winnerIndex !== null) {
      game.status = 'finished';
      game.finishedAt = game.updatedAt;
      game.winnerId = game.players[gameState.winnerIndex].id;
    }

    return cosmosService.updateGame(game);
  }
}

export const gameManager = new GameManager();

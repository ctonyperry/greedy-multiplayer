/**
 * Cosmos DB Service
 * Handles all database operations for users, games, and leaderboards
 * Falls back to in-memory storage for local development
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import type { User, MultiplayerGame, Leaderboard } from '../types/index.js';

class CosmosService {
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private usersContainer: Container | null = null;
  private gamesContainer: Container | null = null;
  private leaderboardContainer: Container | null = null;

  // In-memory storage for local development
  private useInMemory = false;
  private memoryUsers = new Map<string, User>();
  private memoryGames = new Map<string, MultiplayerGame>();
  private memoryLeaderboards = new Map<string, Leaderboard>();

  /**
   * Initialize the Cosmos DB client or in-memory storage
   */
  async initialize(): Promise<void> {
    const connectionString = process.env.COSMOS_CONNECTION;

    if (!connectionString) {
      console.log('📦 COSMOS_CONNECTION not set - using in-memory storage');
      console.log('   Data will be lost on server restart');
      this.useInMemory = true;
      return;
    }

    try {
      this.client = new CosmosClient(connectionString);
      this.database = this.client.database('greedy-multiplayer');
      this.usersContainer = this.database.container('users');
      this.gamesContainer = this.database.container('games');
      this.leaderboardContainer = this.database.container('leaderboard');
      console.log('✅ Cosmos DB initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Cosmos DB:', error);
      console.log('📦 Falling back to in-memory storage');
      this.useInMemory = true;
    }
  }

  // ============================================
  // User Operations
  // ============================================

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    if (this.useInMemory) {
      return this.memoryUsers.get(userId) || null;
    }

    if (!this.usersContainer) return null;

    try {
      const { resource } = await this.usersContainer.item(userId, userId).read<User>();
      return resource || null;
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 404) return null;
      throw error;
    }
  }

  /**
   * Create or update user
   */
  async upsertUser(user: User): Promise<User> {
    if (this.useInMemory) {
      this.memoryUsers.set(user.id, user);
      return user;
    }

    if (!this.usersContainer) {
      return user;
    }

    const { resource } = await this.usersContainer.items.upsert<User>(user);
    return resource!;
  }

  /**
   * Update user stats after a game
   */
  async updateUserStats(
    userId: string,
    updates: Partial<Pick<User, 'gamesPlayed' | 'gamesWon' | 'highScore' | 'lastSeen'>>
  ): Promise<User | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const updatedUser: User = {
      ...user,
      ...updates,
    };

    return this.upsertUser(updatedUser);
  }

  /**
   * Get all users (for leaderboard calculation)
   */
  async getAllUsers(): Promise<User[]> {
    if (this.useInMemory) {
      return Array.from(this.memoryUsers.values());
    }

    if (!this.usersContainer) return [];

    const { resources } = await this.usersContainer.items
      .query<User>('SELECT * FROM c')
      .fetchAll();

    return resources;
  }

  // ============================================
  // Game Operations
  // ============================================

  /**
   * Get game by code
   */
  async getGame(code: string): Promise<MultiplayerGame | null> {
    if (this.useInMemory) {
      return this.memoryGames.get(code.toUpperCase()) || null;
    }

    if (!this.gamesContainer) return null;

    try {
      const { resources } = await this.gamesContainer.items
        .query<MultiplayerGame>({
          query: 'SELECT * FROM c WHERE c.code = @code',
          parameters: [{ name: '@code', value: code }],
        })
        .fetchAll();

      return resources[0] || null;
    } catch (error) {
      console.error('Error getting game:', error);
      return null;
    }
  }

  /**
   * Create a new game
   */
  async createGame(game: MultiplayerGame): Promise<MultiplayerGame> {
    if (this.useInMemory) {
      this.memoryGames.set(game.code, game);
      console.log(`📝 Game created: ${game.code} (${this.memoryGames.size} active games)`);
      return game;
    }

    if (!this.gamesContainer) {
      return game;
    }

    const { resource } = await this.gamesContainer.items.create<MultiplayerGame>(game);
    return resource!;
  }

  /**
   * Update a game
   */
  async updateGame(game: MultiplayerGame): Promise<MultiplayerGame> {
    if (this.useInMemory) {
      this.memoryGames.set(game.code, game);
      return game;
    }

    if (!this.gamesContainer) {
      return game;
    }

    const { resource } = await this.gamesContainer
      .item(game.id, game.code)
      .replace<MultiplayerGame>(game);
    return resource!;
  }

  /**
   * Get user's active games
   */
  async getUserActiveGames(userId: string): Promise<MultiplayerGame[]> {
    if (this.useInMemory) {
      return Array.from(this.memoryGames.values()).filter(
        (game) =>
          game.status !== 'finished' &&
          game.players.some((p) => p.id === userId)
      );
    }

    if (!this.gamesContainer) return [];

    const { resources } = await this.gamesContainer.items
      .query<MultiplayerGame>({
        query: `
          SELECT * FROM c
          WHERE c.status != 'finished'
          AND ARRAY_CONTAINS(c.players, { id: @userId }, true)
        `,
        parameters: [{ name: '@userId', value: userId }],
      })
      .fetchAll();

    return resources;
  }

  /**
   * Update player connection status
   */
  async updatePlayerConnection(
    code: string,
    playerId: string,
    isConnected: boolean
  ): Promise<void> {
    const game = await this.getGame(code);
    if (!game) return;

    const playerIndex = game.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;

    game.players[playerIndex].isConnected = isConnected;
    game.updatedAt = new Date().toISOString();

    await this.updateGame(game);
  }

  /**
   * Append a chat message to a game
   */
  async appendChatMessage(
    code: string,
    message: MultiplayerGame['chat'][0]
  ): Promise<void> {
    const game = await this.getGame(code);
    if (!game) return;

    // Keep only last 100 messages
    game.chat = [...game.chat.slice(-99), message];
    game.updatedAt = new Date().toISOString();

    await this.updateGame(game);
  }

  // ============================================
  // Leaderboard Operations
  // ============================================

  /**
   * Get leaderboard by period
   */
  async getLeaderboard(period: string): Promise<Leaderboard | null> {
    if (this.useInMemory) {
      return this.memoryLeaderboards.get(period) || null;
    }

    if (!this.leaderboardContainer) return null;

    try {
      const { resource } = await this.leaderboardContainer
        .item(period, period)
        .read<Leaderboard>();
      return resource || null;
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 404) return null;
      throw error;
    }
  }

  /**
   * Update leaderboard
   */
  async upsertLeaderboard(leaderboard: Leaderboard): Promise<Leaderboard> {
    if (this.useInMemory) {
      this.memoryLeaderboards.set(leaderboard.period, leaderboard);
      return leaderboard;
    }

    if (!this.leaderboardContainer) {
      return leaderboard;
    }

    const { resource } = await this.leaderboardContainer.items.upsert<Leaderboard>(
      leaderboard
    );
    return resource!;
  }

  // ============================================
  // Debug/Admin Operations (local dev only)
  // ============================================

  /**
   * Get stats about in-memory storage (for debugging)
   */
  getMemoryStats(): { users: number; games: number; leaderboards: number } | null {
    if (!this.useInMemory) return null;
    return {
      users: this.memoryUsers.size,
      games: this.memoryGames.size,
      leaderboards: this.memoryLeaderboards.size,
    };
  }

  /**
   * List all active games (for debugging)
   */
  listGames(): MultiplayerGame[] {
    if (!this.useInMemory) return [];
    return Array.from(this.memoryGames.values());
  }
}

// Export singleton instance
export const cosmosService = new CosmosService();

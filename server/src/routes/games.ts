/**
 * Games routes
 * Handles game creation, joining, and management via REST API
 */

import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { gameManager } from '../services/gameManager.js';
import { turnTimerManager } from '../services/TurnTimerManager.js';
import { getCurrentPlayer } from '../engine/game.js';
import type { Server } from 'socket.io';

const router = Router();

// Socket.IO instance (set by setupRoutes)
let io: Server | null = null;

/**
 * Set the Socket.IO instance for broadcasting events
 */
export function setSocketIO(socketIO: Server) {
  io = socketIO;
}

/**
 * POST /api/games
 * Create a new game
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body as {
      settings?: {
        targetScore?: number;
        entryThreshold?: number;
        maxTurnTimer?: number;
      };
    };

    const game = await gameManager.createGame(
      req.user!.id,
      req.user!.name,
      settings
    );

    res.status(201).json({
      code: game.code,
      game,
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create game',
    });
  }
});

/**
 * GET /api/games/:code
 * Get game info (for join screen)
 */
router.get('/:code', optionalAuthMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const game = await gameManager.getGame(code.toUpperCase());

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Return limited info if not in game
    const isInGame = req.user && game.players.some((p) => p.id === req.user!.id);

    if (!isInGame) {
      res.json({
        game: {
          code: game.code,
          status: game.status,
          playerCount: game.players.length,
          players: game.players.map((p) => ({
            name: p.name,
            isAI: p.isAI,
          })),
          settings: game.settings,
          createdAt: game.createdAt,
        },
      });
      return;
    }

    // Return full game info if in game
    res.json({ game });
  } catch (error) {
    console.error('Error getting game:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
});

/**
 * POST /api/games/:code/join
 * Join an existing game
 */
router.post('/:code/join', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();
    const { aiTakeoverStrategy } = req.body as { aiTakeoverStrategy?: string };

    const game = await gameManager.joinGame(
      upperCode,
      req.user!.id,
      req.user!.name,
      aiTakeoverStrategy
    );

    // Broadcast player joined event to everyone in the game room
    if (io) {
      const newPlayer = game.players.find(p => p.id === req.user!.id);
      if (newPlayer) {
        io.to(upperCode).emit('playerJoined', {
          id: newPlayer.id,
          name: newPlayer.name,
          isAI: newPlayer.isAI,
          isConnected: true,
        });
      }
    }

    res.json({ game });
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to join game',
    });
  }
});

/**
 * POST /api/games/:code/ai
 * Add AI player (host only)
 */
router.post('/:code/ai', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();
    const { name, strategy } = req.body as {
      name: string;
      strategy: string;
    };

    if (!name || !strategy) {
      res.status(400).json({ error: 'Name and strategy are required' });
      return;
    }

    const game = await gameManager.addAIPlayer(
      upperCode,
      req.user!.id,
      name,
      strategy
    );

    // Broadcast player joined event for the AI
    if (io) {
      const aiPlayer = game.players.find(p => p.name === name && p.isAI);
      if (aiPlayer) {
        io.to(upperCode).emit('playerJoined', {
          id: aiPlayer.id,
          name: aiPlayer.name,
          isAI: true,
          aiStrategy: aiPlayer.aiStrategy,
          isConnected: true,
        });
      }
    }

    res.json({ game });
  } catch (error) {
    console.error('Error adding AI:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to add AI player',
    });
  }
});

/**
 * POST /api/games/:code/start
 * Start the game (host only)
 */
router.post('/:code/start', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();

    const game = await gameManager.startGame(upperCode, req.user!.id);

    // Broadcast game started event to everyone in the game room
    if (io && game.gameState) {
      io.to(upperCode).emit('gameStarted', game.gameState);

      // Start turn timer for the first player (if not AI and timer enabled)
      const firstPlayer = getCurrentPlayer(game.gameState);
      if (!firstPlayer.isAI && game.settings.maxTurnTimer > 0) {
        turnTimerManager.startTurn(upperCode, firstPlayer.id, game.settings.maxTurnTimer * 1000);
      }
    }

    res.json({ game });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to start game',
    });
  }
});

/**
 * DELETE /api/games/:code/players/:playerId
 * Remove player or leave game
 */
router.delete('/:code/players/:playerId', authMiddleware, async (req, res) => {
  try {
    const { code, playerId } = req.params;

    const game = await gameManager.removePlayer(
      code.toUpperCase(),
      req.user!.id,
      playerId
    );

    res.json({ game });
  } catch (error) {
    console.error('Error removing player:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to remove player',
    });
  }
});

/**
 * POST /api/games/:code/leave
 * Leave the game (current user)
 */
router.post('/:code/leave', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;

    await gameManager.removePlayer(
      code.toUpperCase(),
      req.user!.id,
      req.user!.id
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving game:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to leave game',
    });
  }
});

/**
 * POST /api/games/:code/forfeit
 * Forfeit the game (concede defeat)
 */
router.post('/:code/forfeit', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();

    const game = await gameManager.getGame(upperCode);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    if (game.status !== 'playing') {
      res.status(400).json({ error: 'Game is not in progress' });
      return;
    }

    const player = game.players.find(p => p.id === req.user!.id);
    if (!player) {
      res.status(403).json({ error: 'You are not in this game' });
      return;
    }

    // Find remaining players to determine winner
    const remainingPlayers = game.players.filter(p => p.id !== req.user!.id);
    if (remainingPlayers.length === 0) {
      res.status(400).json({ error: 'Cannot forfeit - you are the only player' });
      return;
    }

    // In a 2-player game, the other player wins
    // In multiplayer, we just end the game with the highest scorer as winner
    let winnerId: string;
    if (remainingPlayers.length === 1) {
      winnerId = remainingPlayers[0].id;
    } else {
      // Find highest scorer among remaining players
      const gameState = game.gameState!;
      let maxScore = -1;
      let maxScorePlayerId = remainingPlayers[0].id;
      for (const rp of remainingPlayers) {
        const playerState = gameState.players.find(ps => ps.id === rp.id);
        if (playerState && playerState.score > maxScore) {
          maxScore = playerState.score;
          maxScorePlayerId = rp.id;
        }
      }
      winnerId = maxScorePlayerId;
    }

    // Update game state
    game.status = 'finished';
    game.finishedAt = new Date().toISOString();
    game.winnerId = winnerId;

    if (game.gameState) {
      game.gameState.isGameOver = true;
      const winnerIndex = game.players.findIndex(p => p.id === winnerId);
      game.gameState.winnerIndex = winnerIndex >= 0 ? winnerIndex : null;
    }

    // Add system message
    game.chat.push({
      id: crypto.randomUUID(),
      playerId: 'system',
      playerName: 'System',
      message: `${player.name} has forfeited the game`,
      timestamp: new Date().toISOString(),
      type: 'system',
    });

    await gameManager.updateGame(game);

    // Stop any turn timers
    turnTimerManager.clearTimer(upperCode);

    // Broadcast game ended
    if (io && game.gameState) {
      const winner = game.players.find(p => p.id === winnerId);
      io.to(upperCode).emit('gameEnded', {
        winner: winner || remainingPlayers[0],
        finalState: game.gameState,
      });
    }

    res.json({ success: true, winnerId });
  } catch (error) {
    console.error('Error forfeiting game:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to forfeit game',
    });
  }
});

/**
 * POST /api/games/:code/strategy
 * Update player's AI takeover strategy
 */
router.post('/:code/strategy', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();
    const { strategy } = req.body as { strategy: string };

    if (!strategy) {
      res.status(400).json({ error: 'Strategy is required' });
      return;
    }

    const validStrategies = ['conservative', 'balanced', 'aggressive', 'chaos'];
    if (!validStrategies.includes(strategy)) {
      res.status(400).json({ error: 'Invalid strategy' });
      return;
    }

    const game = await gameManager.getGame(upperCode);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Find and update the player's strategy
    const player = game.players.find(p => p.id === req.user!.id);
    if (!player) {
      res.status(403).json({ error: 'You are not in this game' });
      return;
    }

    player.aiTakeoverStrategy = strategy;
    await gameManager.updateGame(game);

    // Broadcast strategy update to all players
    if (io) {
      io.to(upperCode).emit('playerStrategyUpdated', {
        playerId: req.user!.id,
        strategy,
      });
    }

    res.json({ game });
  } catch (error) {
    console.error('Error updating strategy:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update strategy',
    });
  }
});

export default router;

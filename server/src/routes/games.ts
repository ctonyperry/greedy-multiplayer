/**
 * Games routes
 * Handles game creation, joining, and management via REST API
 */

import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { gameManager } from '../services/gameManager.js';
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

    const game = await gameManager.joinGame(
      upperCode,
      req.user!.id,
      req.user!.name
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

export default router;

/**
 * Authentication routes
 * Handles user profile and preferences
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { cosmosService } from '../services/cosmos.js';

const router = Router();

// Type for user data (will import from shared once set up)
interface User {
  id: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  highScore: number;
  preferences: {
    defaultAiStrategy: string;
    turnTimerPreference: number;
    aiTakeoverStrategy: string | null;
  };
  createdAt: string;
  lastSeen: string;
}

/**
 * GET /api/auth/me
 * Get current user profile (creates if doesn't exist)
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    let user = await cosmosService.getUser(userId);

    if (!user) {
      // Create new user
      user = {
        id: userId,
        displayName: req.user!.name,
        email: req.user!.email,
        photoUrl: null,
        gamesPlayed: 0,
        gamesWon: 0,
        highScore: 0,
        preferences: {
          defaultAiStrategy: 'balanced',
          turnTimerPreference: 0, // Default no timer
          aiTakeoverStrategy: 'balanced',
        },
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };

      user = await cosmosService.upsertUser(user);
    } else {
      // Update last seen
      user.lastSeen = new Date().toISOString();
      user = await cosmosService.upsertUser(user);
    }

    res.json({ user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

/**
 * POST /api/auth/profile
 * Update user preferences
 */
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { preferences, displayName } = req.body as {
      preferences?: Partial<User['preferences']>;
      displayName?: string;
    };

    let user = await cosmosService.getUser(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update preferences
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences,
      };

      // Validate turn timer preference
      if (user.preferences.turnTimerPreference < 0) {
        user.preferences.turnTimerPreference = 0;
      }
      if (user.preferences.turnTimerPreference > 300) {
        user.preferences.turnTimerPreference = 300;
      }
    }

    // Update display name
    if (displayName && displayName.trim()) {
      user.displayName = displayName.trim().slice(0, 50);
    }

    user.lastSeen = new Date().toISOString();
    user = await cosmosService.upsertUser(user);

    res.json({ user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * GET /api/auth/stats
 * Get user's game statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await cosmosService.getUser(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const winRate = user.gamesPlayed > 0
      ? (user.gamesWon / user.gamesPlayed * 100).toFixed(1)
      : '0.0';

    res.json({
      stats: {
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        winRate: parseFloat(winRate),
        highScore: user.highScore,
      },
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/auth/games
 * Get user's active games
 */
router.get('/games', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const games = await cosmosService.getUserActiveGames(userId);

    res.json({
      games: games.map((game) => ({
        code: game.code,
        status: game.status,
        playerCount: game.players.length,
        isHost: game.hostId === userId,
        createdAt: game.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error getting user games:', error);
    res.status(500).json({ error: 'Failed to get games' });
  }
});

export default router;

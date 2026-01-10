/**
 * Leaderboard routes
 * Handles player rankings and statistics
 */

import { Router } from 'express';
import { cosmosService } from '../services/cosmos.js';

const router = Router();

/**
 * GET /api/leaderboard/:period
 * Get leaderboard rankings
 */
router.get('/:period?', async (req, res) => {
  try {
    const period = req.params.period || 'alltime';

    // Get leaderboard from database
    const leaderboard = await cosmosService.getLeaderboard(period);

    if (!leaderboard) {
      // Return empty rankings if no leaderboard exists yet
      res.json({ rankings: [], period, updatedAt: null });
      return;
    }

    res.json({
      rankings: leaderboard.rankings,
      period: leaderboard.period,
      updatedAt: leaderboard.updatedAt,
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export default router;

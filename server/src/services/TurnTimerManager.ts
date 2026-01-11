/**
 * Turn Timer Manager
 * Server-authoritative timer management for turn synchronization
 *
 * Responsibilities:
 * - Track turn start times and last activity
 * - Broadcast timer state to all players
 * - Handle timeouts and trigger AI takeover
 * - Manage disconnection grace periods
 */

import type { Server } from 'socket.io';
import type { TurnTimerState, MultiplayerGame } from '../types/index.js';
import { gameManager } from './gameManager.js';

interface TimerEntry {
  gameCode: string;
  playerId: string;
  turnStartedAt: Date;
  lastActivityAt: Date;
  timeoutMs: number;
  timeoutHandle: NodeJS.Timeout | null;
  gracePeriodHandle: NodeJS.Timeout | null;
  isInGracePeriod: boolean;
  gracePeriodStartedAt: Date | null;
  debouncePendingActivity: boolean;
  debounceHandle: NodeJS.Timeout | null;
}

const GRACE_PERIOD_MS = 30000; // 30 seconds for disconnected players
const ACTIVITY_DEBOUNCE_MS = 2000; // 2 seconds debounce for dice selection activity

class TurnTimerManager {
  private timers: Map<string, TimerEntry> = new Map();
  private io: Server | null = null;
  private onTimeoutCallback: ((gameCode: string, playerId: string) => Promise<void>) | null = null;

  /**
   * Initialize the timer manager with Socket.IO server
   */
  initialize(io: Server) {
    this.io = io;
  }

  /**
   * Set callback for when a player times out
   */
  setTimeoutCallback(callback: (gameCode: string, playerId: string) => Promise<void>) {
    this.onTimeoutCallback = callback;
  }

  /**
   * Start tracking a new turn
   */
  startTurn(gameCode: string, playerId: string, timeoutMs: number): void {
    // Clear any existing timer for this game
    this.clearTimer(gameCode);

    if (timeoutMs <= 0) {
      // No timeout configured - don't track
      return;
    }

    const now = new Date();
    const entry: TimerEntry = {
      gameCode,
      playerId,
      turnStartedAt: now,
      lastActivityAt: now,
      timeoutMs,
      timeoutHandle: null,
      gracePeriodHandle: null,
      isInGracePeriod: false,
      gracePeriodStartedAt: null,
      debouncePendingActivity: false,
      debounceHandle: null,
    };

    // Schedule timeout
    entry.timeoutHandle = setTimeout(() => {
      this.handleTimeout(gameCode);
    }, timeoutMs);

    this.timers.set(gameCode, entry);

    // Broadcast initial timer state
    this.broadcastTimerState(gameCode);
  }

  /**
   * Record player activity (resets idle timer)
   */
  recordActivity(gameCode: string, playerId: string): void {
    const entry = this.timers.get(gameCode);
    if (!entry || entry.playerId !== playerId) {
      return;
    }

    // If in grace period, exit it
    if (entry.isInGracePeriod) {
      this.exitGracePeriod(gameCode);
    }

    const now = new Date();
    entry.lastActivityAt = now;

    // Reschedule timeout
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle);
    }
    entry.timeoutHandle = setTimeout(() => {
      this.handleTimeout(gameCode);
    }, entry.timeoutMs);

    // Broadcast updated timer state
    this.broadcastTimerState(gameCode);
  }

  /**
   * Record debounced activity (for dice selection)
   * Only triggers timer reset after a quiet period to avoid spam
   */
  recordDebouncedActivity(gameCode: string, playerId: string): void {
    const entry = this.timers.get(gameCode);
    if (!entry || entry.playerId !== playerId) {
      return;
    }

    // Mark that we have pending activity
    entry.debouncePendingActivity = true;

    // Clear any existing debounce timer
    if (entry.debounceHandle) {
      clearTimeout(entry.debounceHandle);
    }

    // Set up debounce timer - only record activity after quiet period
    entry.debounceHandle = setTimeout(() => {
      if (entry.debouncePendingActivity) {
        entry.debouncePendingActivity = false;
        entry.debounceHandle = null;
        // Actually record the activity now
        this.recordActivity(gameCode, playerId);
      }
    }, ACTIVITY_DEBOUNCE_MS);
  }

  /**
   * Handle player disconnect - start grace period
   */
  handleDisconnect(gameCode: string, playerId: string): void {
    const entry = this.timers.get(gameCode);
    if (!entry || entry.playerId !== playerId) {
      return;
    }

    // Already in grace period
    if (entry.isInGracePeriod) {
      return;
    }

    // Pause the idle timer
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle);
      entry.timeoutHandle = null;
    }

    // Start grace period
    entry.isInGracePeriod = true;
    entry.gracePeriodStartedAt = new Date();

    entry.gracePeriodHandle = setTimeout(() => {
      this.handleGracePeriodExpired(gameCode);
    }, GRACE_PERIOD_MS);

    // Broadcast grace period state
    this.broadcastGracePeriodStarted(gameCode, playerId);
  }

  /**
   * Handle player reconnect - resume from grace period
   */
  handleReconnect(gameCode: string, playerId: string): void {
    const entry = this.timers.get(gameCode);
    if (!entry || entry.playerId !== playerId) {
      return;
    }

    if (entry.isInGracePeriod) {
      this.exitGracePeriod(gameCode);

      // Resume idle timer from where it was
      entry.timeoutHandle = setTimeout(() => {
        this.handleTimeout(gameCode);
      }, entry.timeoutMs);

      // Broadcast reconnection
      this.broadcastGracePeriodEnded(gameCode, playerId, 'reconnected');
    }
  }

  /**
   * Get current timer state for a game
   */
  getTimerState(gameCode: string): TurnTimerState | null {
    const entry = this.timers.get(gameCode);
    if (!entry) {
      return null;
    }

    const expiresAt = new Date(entry.lastActivityAt.getTime() + entry.timeoutMs);
    const gracePeriodExpiresAt = entry.gracePeriodStartedAt
      ? new Date(entry.gracePeriodStartedAt.getTime() + GRACE_PERIOD_MS)
      : null;

    return {
      turnStartedAt: entry.turnStartedAt.toISOString(),
      lastActivityAt: entry.lastActivityAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isInGracePeriod: entry.isInGracePeriod,
      gracePeriodStartedAt: entry.gracePeriodStartedAt?.toISOString() || null,
      gracePeriodExpiresAt: gracePeriodExpiresAt?.toISOString() || null,
    };
  }

  /**
   * Clear timer for a game (game ended, turn changed, etc.)
   */
  clearTimer(gameCode: string): void {
    const entry = this.timers.get(gameCode);
    if (entry) {
      if (entry.timeoutHandle) {
        clearTimeout(entry.timeoutHandle);
      }
      if (entry.gracePeriodHandle) {
        clearTimeout(entry.gracePeriodHandle);
      }
      if (entry.debounceHandle) {
        clearTimeout(entry.debounceHandle);
      }
      this.timers.delete(gameCode);
    }
  }

  /**
   * Pause timer for a game (all players disconnected)
   * Unlike clearTimer, this preserves the timer state for later resumption
   */
  pauseTimer(gameCode: string): void {
    const entry = this.timers.get(gameCode);
    if (!entry) return;

    console.log(`⏸️ Pausing timer for game ${gameCode}`);

    // Clear all active timeouts without deleting the entry
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle);
      entry.timeoutHandle = null;
    }
    if (entry.gracePeriodHandle) {
      clearTimeout(entry.gracePeriodHandle);
      entry.gracePeriodHandle = null;
    }
    if (entry.debounceHandle) {
      clearTimeout(entry.debounceHandle);
      entry.debounceHandle = null;
    }
  }

  /**
   * Check if a player is currently being timed
   */
  isPlayerBeingTimed(gameCode: string, playerId: string): boolean {
    const entry = this.timers.get(gameCode);
    return entry !== null && entry !== undefined && entry.playerId === playerId;
  }

  // Private methods

  private exitGracePeriod(gameCode: string): void {
    const entry = this.timers.get(gameCode);
    if (!entry) return;

    if (entry.gracePeriodHandle) {
      clearTimeout(entry.gracePeriodHandle);
      entry.gracePeriodHandle = null;
    }
    entry.isInGracePeriod = false;
    entry.gracePeriodStartedAt = null;
  }

  private async handleTimeout(gameCode: string): Promise<void> {
    const entry = this.timers.get(gameCode);
    if (!entry) return;

    console.log(`⏱️ Turn timeout for player ${entry.playerId} in game ${gameCode}`);

    // Broadcast timeout event
    if (this.io) {
      this.io.to(gameCode).emit('playerTimedOut', {
        playerId: entry.playerId,
        aiTakeover: true,
      });
    }

    // Trigger AI takeover callback
    if (this.onTimeoutCallback) {
      await this.onTimeoutCallback(gameCode, entry.playerId);
    }
  }

  private handleGracePeriodExpired(gameCode: string): void {
    const entry = this.timers.get(gameCode);
    if (!entry) return;

    console.log(`⏱️ Grace period expired for player ${entry.playerId} in game ${gameCode}`);

    // Exit grace period
    this.exitGracePeriod(gameCode);

    // Broadcast grace period expiry
    this.broadcastGracePeriodEnded(gameCode, entry.playerId, 'expired');

    // Trigger timeout (AI takeover)
    this.handleTimeout(gameCode);
  }

  private broadcastTimerState(gameCode: string): void {
    if (!this.io) return;

    const timerState = this.getTimerState(gameCode);
    if (!timerState) return;

    this.io.to(gameCode).emit('timerSync', {
      ...timerState,
      serverTime: new Date().toISOString(),
    });
  }

  private broadcastGracePeriodStarted(gameCode: string, playerId: string): void {
    if (!this.io) return;

    const entry = this.timers.get(gameCode);
    if (!entry || !entry.gracePeriodStartedAt) return;

    const expiresAt = new Date(entry.gracePeriodStartedAt.getTime() + GRACE_PERIOD_MS);

    this.io.to(gameCode).emit('gracePeriodStarted', {
      playerId,
      expiresAt: expiresAt.toISOString(),
    });
  }

  private broadcastGracePeriodEnded(
    gameCode: string,
    playerId: string,
    reason: 'reconnected' | 'expired'
  ): void {
    if (!this.io) return;

    this.io.to(gameCode).emit('gracePeriodEnded', {
      playerId,
      reason,
    });
  }
}

export const turnTimerManager = new TurnTimerManager();

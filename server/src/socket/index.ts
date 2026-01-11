/**
 * Socket.IO setup and event handlers
 */

import type { Server, Socket } from 'socket.io';
import { setupGameHandlers, initializeGameHandlers } from './gameHandlers.js';
import { setupChatHandlers } from './chatHandlers.js';
import { gameManager } from '../services/gameManager.js';
import { turnTimerManager } from '../services/TurnTimerManager.js';

// Track which games each socket is in
const socketGames = new Map<string, Set<string>>();

// Track connected players per game (for pause detection)
const gameConnections = new Map<string, Set<string>>();

function getGameConnectionCount(gameCode: string): number {
  return gameConnections.get(gameCode)?.size || 0;
}

function addGameConnection(gameCode: string, userId: string): void {
  if (!gameConnections.has(gameCode)) {
    gameConnections.set(gameCode, new Set());
  }
  gameConnections.get(gameCode)!.add(userId);
}

function removeGameConnection(gameCode: string, userId: string): number {
  const connections = gameConnections.get(gameCode);
  if (connections) {
    connections.delete(userId);
    if (connections.size === 0) {
      gameConnections.delete(gameCode);
    }
    return connections.size;
  }
  return 0;
}

/**
 * Set up all Socket.IO event handlers
 */
export function setupSocketHandlers(io: Server) {
  // Initialize turn timer manager with Socket.IO server
  turnTimerManager.initialize(io);

  // Initialize game handlers (sets up AI timeout callback)
  initializeGameHandlers(io);

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Initialize socket's game set
    socketGames.set(socket.id, new Set());

    // Handle authentication data from connection
    if (socket.handshake.auth?.userId) {
      // Extract user info from handshake auth
      socket.data.authenticated = true;
      socket.data.userId = socket.handshake.auth.userId;
      socket.data.userName = socket.handshake.auth.userName;
      console.log(`Socket ${socket.id} authenticated as user: ${socket.data.userId}`);
    } else {
      console.log(`Socket ${socket.id} connected without auth - using socket.id as userId`);
      socket.data.userId = socket.id;
    }

    // Authentication
    socket.on('authenticate', async (data: { token: string; userId?: string; userName?: string }) => {
      try {
        // TODO: Validate token with Azure AD B2C
        // For now, store user info from client
        socket.data.authenticated = true;
        socket.data.userId = data.userId;
        socket.data.userName = data.userName;
        socket.emit('authenticated', { success: true });
      } catch (error) {
        socket.emit('authError', { message: 'Authentication failed' });
      }
    });

    // Join game room
    socket.on('joinGame', async (data: { gameCode: string }) => {
      const { gameCode } = data;
      await socket.join(gameCode);

      // Track this game for the socket
      socketGames.get(socket.id)?.add(gameCode);

      console.log(`Socket ${socket.id} joined game ${gameCode}`);

      // Get player info
      const userId = socket.data.userId || socket.id;

      // Track connection for pause detection
      const wasEmpty = getGameConnectionCount(gameCode) === 0;
      addGameConnection(gameCode, userId);

      // Notify others in the room
      socket.to(gameCode).emit('playerReconnected', userId);

      // Notify timer manager of reconnect (may end grace period)
      turnTimerManager.handleReconnect(gameCode, userId);

      // If game was paused (all disconnected), resume it
      if (wasEmpty) {
        const game = await gameManager.getGame(gameCode);
        if (game && game.isPaused) {
          console.log(`🎮 Resuming game ${gameCode} - player reconnected`);
          game.isPaused = false;
          await gameManager.updateGame(game);
          io.to(gameCode).emit('gameResumed', { resumedBy: userId });
        }
      }

      // Send current timer state to reconnected player
      const timerState = turnTimerManager.getTimerState(gameCode);
      if (timerState) {
        socket.emit('timerSync', {
          ...timerState,
          serverTime: new Date().toISOString(),
        });
      }

      // Store game code on socket for disconnect handling
      socket.data.currentGame = gameCode;
    });

    // Leave game room
    socket.on('leaveGame', async (data: { gameCode: string }) => {
      const { gameCode } = data;
      await socket.leave(gameCode);

      // Remove from tracking
      socketGames.get(socket.id)?.delete(gameCode);

      console.log(`Socket ${socket.id} left game ${gameCode}`);

      const userId = socket.data.userId || socket.id;

      // Notify others in the room
      socket.to(gameCode).emit('playerDisconnected', userId);
    });

    // Set up game-specific handlers
    setupGameHandlers(io, socket);

    // Set up chat handlers
    setupChatHandlers(io, socket);

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);

      const userId = socket.data.userId || socket.id;
      const games = socketGames.get(socket.id);

      // Notify all games this player was in
      if (games) {
        for (const gameCode of games) {
          io.to(gameCode).emit('playerDisconnected', userId);

          // Remove from connection tracking
          const remainingConnections = removeGameConnection(gameCode, userId);

          // If all players disconnected, pause the game
          if (remainingConnections === 0) {
            const game = await gameManager.getGame(gameCode);
            if (game && game.status === 'playing' && !game.isPaused) {
              console.log(`⏸️ Pausing game ${gameCode} - all players disconnected`);
              game.isPaused = true;
              await gameManager.updateGame(game);

              // Pause the turn timer (don't trigger AI takeover)
              turnTimerManager.pauseTimer(gameCode);

              io.to(gameCode).emit('gamePaused', {
                reason: 'all_disconnected',
              });
            }
          } else {
            // Notify timer manager of disconnect (may start grace period)
            turnTimerManager.handleDisconnect(gameCode, userId);
          }
        }
      }

      // Clean up tracking
      socketGames.delete(socket.id);
    });
  });
}

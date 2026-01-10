/**
 * Socket.IO setup and event handlers
 */

import type { Server, Socket } from 'socket.io';
import { setupGameHandlers } from './gameHandlers.js';
import { setupChatHandlers } from './chatHandlers.js';
import { gameManager } from '../services/gameManager.js';

// Track which games each socket is in
const socketGames = new Map<string, Set<string>>();

/**
 * Set up all Socket.IO event handlers
 */
export function setupSocketHandlers(io: Server) {
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
      const userName = socket.data.userName || 'Anonymous';

      // Notify others in the room
      socket.to(gameCode).emit('playerReconnected', userId);

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
        }
      }

      // Clean up tracking
      socketGames.delete(socket.id);
    });
  });
}

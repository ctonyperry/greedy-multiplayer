/**
 * Socket.IO chat handlers
 * Handles real-time chat messages in games
 */

import type { Server, Socket } from 'socket.io';

interface ChatPayload {
  gameCode: string;
  message: string;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
  type: 'chat' | 'system';
}

/**
 * Sanitize chat message (strip HTML, limit length)
 */
function sanitizeMessage(message: string): string {
  return message
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim()
    .slice(0, 200); // Max 200 characters
}

/**
 * Handle incoming chat message
 */
async function handleChatMessage(io: Server, socket: Socket, payload: ChatPayload) {
  const { gameCode, message } = payload;

  try {
    // Sanitize the message
    const sanitized = sanitizeMessage(message);
    if (!sanitized) return;

    // Create chat message object
    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: socket.data.userId || socket.id,
      playerName: socket.data.userName || 'Anonymous',
      message: sanitized,
      timestamp: new Date().toISOString(),
      type: 'chat',
    };

    // TODO: Store in database

    // Broadcast to all players in the game
    io.to(gameCode).emit('chatMessage', chatMessage);
  } catch (error) {
    console.error('Chat error:', error);
  }
}

/**
 * Set up chat-related socket handlers
 */
export function setupChatHandlers(io: Server, socket: Socket) {
  // Listen for both event names for compatibility
  socket.on('sendChat', async (payload: ChatPayload) => {
    handleChatMessage(io, socket, payload);
  });

  socket.on('chatMessage', async (payload: ChatPayload) => {
    handleChatMessage(io, socket, payload);
  });
}

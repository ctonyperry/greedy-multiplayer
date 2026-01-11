/**
 * Socket.IO Context
 * Provides real-time connection for multiplayer gameplay
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import type { GameState, Player, ChatMessage, TurnTimerState } from '../types/index.js';

// Connection status
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Socket events from server
interface ServerToClientEvents {
  // Game state updates
  gameStateUpdate: (data: {
    gameState: GameState;
    lastAction?: { playerId: string; action: unknown; isAIControlled?: boolean };
  }) => void;

  // Player events
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  playerReconnected: (playerId: string) => void;
  playerDisconnected: (playerId: string) => void;

  // Game lifecycle
  gameStarted: (gameState: GameState) => void;
  gameEnded: (data: { winner: Player; finalState: GameState }) => void;

  // Turn events
  turnChanged: (data: {
    currentPlayerId: string;
    isYourTurn: boolean;
    turnStartedAt: string;
    turnExpiresAt?: string;
  }) => void;

  // Timer synchronization events
  timerSync: (data: TurnTimerState & { serverTime: string }) => void;
  timerReset: (data: { playerId: string; lastActivityAt: string; expiresAt: string }) => void;
  playerTimedOut: (data: { playerId: string; aiTakeover: boolean }) => void;
  gracePeriodStarted: (data: { playerId: string; expiresAt: string }) => void;
  gracePeriodEnded: (data: { playerId: string; reason: 'reconnected' | 'expired' }) => void;

  // AI takeover events
  aiTakeover: (data: { playerId: string; aiStrategy: string }) => void;
  playerResumedControl: (data: { playerId: string }) => void;

  // Strategy updates
  playerStrategyUpdated: (data: { playerId: string; strategy: string }) => void;

  // Game pause/resume (all players disconnected)
  gamePaused: (data: { reason: string }) => void;
  gameResumed: (data: { resumedBy: string }) => void;

  // Legacy timer events (for backward compatibility)
  turnTimerUpdate: (data: { remainingSeconds: number }) => void;
  turnTimerExpired: (data: { playerId: string; aiTakeover: boolean }) => void;

  // Chat
  chatMessage: (message: ChatMessage) => void;
  chatHistory: (data: { messages: ChatMessage[] }) => void;

  // Errors
  actionError: (data: { message: string }) => void;
}

// Socket events to server
interface ClientToServerEvents {
  // Join/leave game rooms
  joinGame: (data: { gameCode: string }) => void;
  leaveGame: (data: { gameCode: string }) => void;

  // Game actions
  gameAction: (data: {
    gameCode: string;
    action: { type: string; dice?: number[] };
  }) => void;

  // Request state (for reconnection)
  requestGameState: (data: { gameCode: string }) => void;

  // Activity events (for timer reset)
  diceSelected: (data: { gameCode: string }) => void;

  // AI control
  resumeControl: (data: { gameCode: string }) => void;

  // Chat
  sendChat: (data: { gameCode: string; message: string }) => void;
}

// Context type
interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  status: ConnectionStatus;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  joinGame: (gameCode: string) => void;
  leaveGame: (gameCode: string) => void;
  sendAction: (
    gameCode: string,
    action: { type: string; dice?: number[] }
  ) => void;
  sendChat: (gameCode: string, message: string) => void;
  requestGameState: (gameCode: string) => void;
  notifyDiceSelected: (gameCode: string) => void;
  resumeControl: (gameCode: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

// Server URL from environment
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

/**
 * Socket Provider Component
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  /**
   * Connect to Socket.IO server
   */
  const connect = useCallback(async () => {
    // Don't connect if already connected or connecting
    if (socketRef.current?.connected || status === 'connecting') {
      return;
    }

    // Don't connect without user info
    if (!user) {
      console.log('Socket: Waiting for user info before connecting');
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      // Get access token for authenticated connections
      const token = await getAccessToken();

      // Always include user info in auth data
      const authData = {
        token: token || `guest:${user.id}:${user.name}`,
        userId: user.id,
        userName: user.name,
      };

      console.log('Socket: Connecting with userId:', authData.userId);

      const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
        SOCKET_URL,
        {
          auth: authData,
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        }
      );

      // Connection events
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setStatus('connected');
        setError(null);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setStatus('disconnected');
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        setStatus('error');
        setError(err.message);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    } catch (err) {
      console.error('Failed to create socket:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [getAccessToken, status, user]);

  /**
   * Disconnect from server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus('disconnected');
    }
  }, []);

  /**
   * Join a game room
   */
  const joinGame = useCallback((gameCode: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('joinGame', { gameCode });
    }
  }, []);

  /**
   * Leave a game room
   */
  const leaveGame = useCallback((gameCode: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leaveGame', { gameCode });
    }
  }, []);

  /**
   * Send a game action
   */
  const sendAction = useCallback(
    (gameCode: string, action: { type: string; dice?: number[] }) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('gameAction', { gameCode, action });
      }
    },
    []
  );

  /**
   * Send a chat message
   */
  const sendChat = useCallback((gameCode: string, message: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sendChat', { gameCode, message });
    }
  }, []);

  /**
   * Request current game state (for reconnection)
   */
  const requestGameState = useCallback((gameCode: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('requestGameState', { gameCode });
    }
  }, []);

  /**
   * Notify server of dice selection (for debounced timer reset)
   */
  const notifyDiceSelected = useCallback((gameCode: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('diceSelected', { gameCode });
    }
  }, []);

  /**
   * Resume control from AI
   */
  const resumeControl = useCallback((gameCode: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('resumeControl', { gameCode });
    }
  }, []);

  // Track previous user ID to detect changes
  const prevUserIdRef = useRef<string | null>(null);

  // Auto-connect when user is available, reconnect when user changes
  useEffect(() => {
    if (user) {
      // If user changed and we have an existing socket, disconnect first
      if (prevUserIdRef.current && prevUserIdRef.current !== user.id && socketRef.current) {
        console.log('Socket: User changed, reconnecting with new credentials');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setStatus('disconnected');
      }
      prevUserIdRef.current = user.id;

      // Connect if no socket exists
      if (!socketRef.current) {
        connect();
      }
    }
  }, [user, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Reconnect when user changes
  useEffect(() => {
    if (user && socketRef.current && !socketRef.current.connected) {
      connect();
    }
  }, [user, connect]);

  const value: SocketContextType = {
    socket,
    status,
    error,
    connect,
    disconnect,
    joinGame,
    leaveGame,
    sendAction,
    sendChat,
    requestGameState,
    notifyDiceSelected,
    resumeControl,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

/**
 * Hook to use socket context
 */
export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

/**
 * Hook to subscribe to socket events
 */
export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K]
) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, handler as never);

    return () => {
      socket.off(event, handler as never);
    };
  }, [socket, event, handler]);
}

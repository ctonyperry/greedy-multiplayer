/**
 * useGame Hook
 * Manages multiplayer game state via Socket.IO
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket, useSocketEvent } from '../contexts/SocketContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { api } from '../services/api.js';
import { TurnPhase } from '../types/index.js';
import type { GameState, PlayerState, Player, ChatMessage, Game } from '../types/index.js';

interface LastAction {
  playerId: string;
  action: {
    type: string;
    dice?: number[];
  };
}

interface BustEvent {
  playerName: string;
  playerId: string;
}

interface AITakeoverInfo {
  playerId: string;
  aiStrategy: string;
}

interface UseGameReturn {
  // Game state
  game: Game | null;
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;

  // Turn info
  isMyTurn: boolean;
  currentPlayer: PlayerState | null;
  turnStartedAt: string | null;
  effectiveTimeout: number | null;

  // AI control info
  aiControlledPlayerId: string | null;
  isCurrentPlayerAIControlled: boolean;

  // Chat
  chatMessages: ChatMessage[];

  // Last action (for animations)
  lastAction: LastAction | null;

  // Bust event (detected atomically in socket handler)
  bustEvent: BustEvent | null;

  // Pause state (all players disconnected)
  isPaused: boolean;

  // Actions
  roll: () => void;
  keep: (dice: number[]) => void;
  bank: () => void;
  keepAndBank: (dice: number[]) => void;
  declineCarryover: () => void;
  sendChat: (message: string) => void;

  // Lifecycle
  refreshState: () => Promise<void>;
}

export function useGame(gameCode: string): UseGameReturn {
  const { user } = useAuth();
  const { status, joinGame, leaveGame, sendAction, sendChat: socketSendChat, requestGameState } = useSocket();

  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [bustEvent, setBustEvent] = useState<BustEvent | null>(null);
  const [aiControlledPlayerId, setAiControlledPlayerId] = useState<string | null>(null);

  const gameCodeRef = useRef(gameCode);
  gameCodeRef.current = gameCode;

  // Calculate if it's my turn
  const currentPlayer = gameState
    ? gameState.players[gameState.currentPlayerIndex]
    : null;
  const isMyTurn = currentPlayer?.id === user?.id;

  // Check if current player is AI controlled
  const isCurrentPlayerAIControlled = currentPlayer?.id === aiControlledPlayerId;

  // Calculate effective timeout
  const effectiveTimeout = game?.settings.maxTurnTimer || null;

  // Fetch initial game state
  const fetchGameState = useCallback(async () => {
    try {
      setIsLoading(true);
      const gameData = await api.getGame(gameCode);
      setGame(gameData);
      setGameState(gameData.gameState);
      setChatMessages(gameData.chat || []);
      setTurnStartedAt(gameData.currentTurnStartedAt || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [gameCode]);

  // Initial load and socket setup
  useEffect(() => {
    fetchGameState();
    joinGame(gameCode);

    // Request state on reconnection
    if (status === 'connected') {
      requestGameState(gameCode);
    }

    return () => {
      leaveGame(gameCode);
    };
  }, [gameCode, fetchGameState, joinGame, leaveGame, status, requestGameState]);

  // Handle game state updates
  const handleGameStateUpdate = useCallback(
    (data: { gameState: GameState; lastAction?: { playerId: string; action: unknown } }) => {
      // Detect bust ATOMICALLY before state updates
      // A bust occurs when: phase is ENDED, and the last action was a ROLL (not BANK)
      if (data.lastAction) {
        const action = data.lastAction.action as { type: string; dice?: number[] };

        // Check for bust: ENDED phase + ROLL action means they busted
        if (data.gameState.turn.phase === TurnPhase.ENDED && action.type === 'ROLL') {
          // Find the player who busted
          const bustingPlayer = data.gameState.players.find(p => p.id === data.lastAction!.playerId);
          if (bustingPlayer) {
            setBustEvent({
              playerId: data.lastAction.playerId,
              playerName: bustingPlayer.name,
            });
            // Clear bust event after display time
            setTimeout(() => setBustEvent(null), 1500);
          }
        }
      }

      setGameState(data.gameState);
      if (data.lastAction) {
        // Cast the action to our expected type
        const action = data.lastAction.action as { type: string; dice?: number[] };
        setLastAction({
          playerId: data.lastAction.playerId,
          action,
        });
        // Clear last action after animation time
        setTimeout(() => setLastAction(null), 2000);
      }
    },
    []
  );

  // Handle turn changes
  const handleTurnChanged = useCallback(
    (data: {
      currentPlayerId: string;
      isYourTurn: boolean;
      turnStartedAt: string;
      turnExpiresAt?: string;
    }) => {
      setTurnStartedAt(data.turnStartedAt);
      // Clear AI control when turn changes (server clears it on turn end)
      setAiControlledPlayerId(null);
    },
    []
  );

  // Handle player events
  const handlePlayerJoined = useCallback((player: Player) => {
    setGame((prev) =>
      prev ? { ...prev, players: [...prev.players, player] } : prev
    );
  }, []);

  const handlePlayerLeft = useCallback((playerId: string) => {
    setGame((prev) =>
      prev
        ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) }
        : prev
    );
  }, []);

  const handlePlayerReconnected = useCallback((playerId: string) => {
    setGame((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, isConnected: true } : p
        ),
      };
    });
  }, []);

  const handlePlayerDisconnected = useCallback((playerId: string) => {
    setGame((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, isConnected: false } : p
        ),
      };
    });
  }, []);

  // Handle chat messages
  const handleChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  }, []);

  const handleChatHistory = useCallback(
    (data: { messages: ChatMessage[] }) => {
      setChatMessages(data.messages);
    },
    []
  );

  // Handle game started
  const handleGameStarted = useCallback((state: GameState) => {
    setGameState(state);
    setTurnStartedAt(new Date().toISOString());
    setGame((prev) => (prev ? { ...prev, status: 'playing' } : prev));
  }, []);

  // Handle game ended
  const handleGameEnded = useCallback(
    (data: { winner: Player; finalState: GameState }) => {
      setGameState(data.finalState);
      setGame((prev) =>
        prev ? { ...prev, status: 'finished', winnerId: data.winner.id } : prev
      );
    },
    []
  );

  // Handle errors
  const handleActionError = useCallback((data: { message: string }) => {
    setError(data.message);
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  // Handle AI takeover
  const handleAiTakeover = useCallback((data: { playerId: string; aiStrategy: string }) => {
    setAiControlledPlayerId(data.playerId);
  }, []);

  // Handle player resumed control
  const handlePlayerResumedControl = useCallback((data: { playerId: string }) => {
    if (aiControlledPlayerId === data.playerId) {
      setAiControlledPlayerId(null);
    }
  }, [aiControlledPlayerId]);

  // Handle game paused (all players disconnected)
  const handleGamePaused = useCallback(() => {
    setGame((prev) => prev ? { ...prev, isPaused: true } : prev);
  }, []);

  // Handle game resumed (player reconnected)
  const handleGameResumed = useCallback(() => {
    setGame((prev) => prev ? { ...prev, isPaused: false } : prev);
  }, []);

  // Subscribe to socket events
  useSocketEvent('gameStateUpdate', handleGameStateUpdate);
  useSocketEvent('turnChanged', handleTurnChanged);
  useSocketEvent('playerJoined', handlePlayerJoined);
  useSocketEvent('playerLeft', handlePlayerLeft);
  useSocketEvent('playerReconnected', handlePlayerReconnected);
  useSocketEvent('playerDisconnected', handlePlayerDisconnected);
  useSocketEvent('chatMessage', handleChatMessage);
  useSocketEvent('chatHistory', handleChatHistory);
  useSocketEvent('gameStarted', handleGameStarted);
  useSocketEvent('gameEnded', handleGameEnded);
  useSocketEvent('actionError', handleActionError);
  useSocketEvent('aiTakeover', handleAiTakeover);
  useSocketEvent('playerResumedControl', handlePlayerResumedControl);
  useSocketEvent('gamePaused', handleGamePaused);
  useSocketEvent('gameResumed', handleGameResumed);

  // Game actions
  const roll = useCallback(() => {
    if (!isMyTurn) return;
    sendAction(gameCodeRef.current, { type: 'ROLL' });
  }, [isMyTurn, sendAction]);

  const keep = useCallback(
    (dice: number[]) => {
      if (!isMyTurn) return;
      sendAction(gameCodeRef.current, { type: 'KEEP', dice });
    },
    [isMyTurn, sendAction]
  );

  const bank = useCallback(() => {
    if (!isMyTurn) return;
    sendAction(gameCodeRef.current, { type: 'BANK' });
  }, [isMyTurn, sendAction]);

  const keepAndBank = useCallback(
    (dice: number[]) => {
      if (!isMyTurn) return;
      sendAction(gameCodeRef.current, { type: 'KEEP_AND_BANK', dice });
    },
    [isMyTurn, sendAction]
  );

  const declineCarryover = useCallback(() => {
    if (!isMyTurn) return;
    sendAction(gameCodeRef.current, { type: 'DECLINE_CARRYOVER' });
  }, [isMyTurn, sendAction]);

  const handleSendChat = useCallback(
    (message: string) => {
      socketSendChat(gameCodeRef.current, message);
    },
    [socketSendChat]
  );

  return {
    game,
    gameState,
    isLoading,
    error,
    isMyTurn,
    currentPlayer,
    turnStartedAt,
    effectiveTimeout,
    aiControlledPlayerId,
    isCurrentPlayerAIControlled,
    chatMessages,
    lastAction,
    bustEvent,
    isPaused: game?.isPaused || false,
    roll,
    keep,
    bank,
    keepAndBank,
    declineCarryover,
    sendChat: handleSendChat,
    refreshState: fetchGameState,
  };
}

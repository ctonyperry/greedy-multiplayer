/**
 * Socket.IO game action handlers
 * Handles real-time game actions (roll, keep, bank, etc.)
 */

import type { Server, Socket } from 'socket.io';
import { gameManager } from '../services/gameManager.js';
import { turnTimerManager } from '../services/TurnTimerManager.js';
import { gameReducer, getCurrentPlayer, type GameAction } from '../engine/game.js';
import { TurnPhase } from '../types/index.js';
import type { Dice, DieValue, GameState, MultiplayerGame } from '../types/index.js';

// Store reference to io for AI timeout handling
let ioInstance: Server | null = null;

interface GameActionPayload {
  gameCode: string;
  action: GameAction;
}

/**
 * Initialize game handlers with Socket.IO server
 * Sets up the AI timeout callback
 */
export function initializeGameHandlers(io: Server) {
  ioInstance = io;

  // Set up timeout callback for AI takeover
  turnTimerManager.setTimeoutCallback(async (gameCode: string, playerId: string) => {
    await handleAITakeover(io, gameCode, playerId);
  });
}

/**
 * Handle AI takeover when a player times out
 */
async function handleAITakeover(io: Server, gameCode: string, playerId: string): Promise<void> {
  const game = await gameManager.getGame(gameCode);
  if (!game || !game.gameState) {
    return;
  }

  const currentPlayer = getCurrentPlayer(game.gameState);
  if (currentPlayer.id !== playerId) {
    return; // Not their turn anymore
  }

  // Find player in multiplayer game to get their AI strategy preference
  const multiplayerPlayer = game.players.find(p => p.id === playerId);
  const aiStrategy = multiplayerPlayer?.aiTakeoverStrategy || 'balanced';

  console.log(`🤖 AI takeover for ${playerId} using strategy: ${aiStrategy}`);

  // Update game to mark AI control
  game.aiControlledPlayerId = playerId;
  await gameManager.updateGame(game);

  // Broadcast that AI is taking over
  io.to(gameCode).emit('aiTakeover', {
    playerId,
    aiStrategy,
  });

  // Execute AI turn
  await executeAITakeoverTurn(io, gameCode, game.gameState, playerId, aiStrategy);
}

/**
 * Execute AI turn during takeover
 */
async function executeAITakeoverTurn(
  io: Server,
  gameCode: string,
  gameState: GameState,
  playerId: string,
  strategyName: string
): Promise<void> {
  const currentPlayer = getCurrentPlayer(gameState);

  if (currentPlayer.id !== playerId || gameState.isGameOver) {
    return;
  }

  // Import AI decision maker
  const { makeAIDecision, AI_STRATEGIES } = await import('../ai/strategies.js');

  // Add delay for natural feel
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 500));

  // Get AI strategy
  const strategy = AI_STRATEGIES[strategyName] || AI_STRATEGIES['balanced'];

  // Get AI decision (pass full game state for carryover-aware decisions)
  const decision = makeAIDecision(
    gameState.turn,
    currentPlayer.isOnBoard,
    strategy,
    strategyName,
    gameState
  );

  // Execute AI action
  let action: GameAction;
  switch (decision.action) {
    case 'ROLL':
      action = {
        type: 'ROLL',
        dice: generateDice(gameState.turn.diceRemaining),
      };
      break;
    case 'KEEP':
      action = { type: 'KEEP', dice: decision.dice! };
      break;
    case 'BANK':
      action = { type: 'BANK' };
      break;
    case 'DECLINE_CARRYOVER':
      action = { type: 'DECLINE_CARRYOVER' };
      break;
    default:
      return;
  }

  // Apply action
  let newState = gameReducer(gameState, action);

  // Auto-roll after DECLINE_CARRYOVER for smoother UX
  if (decision.action === 'DECLINE_CARRYOVER') {
    const rollAction = {
      type: 'ROLL' as const,
      dice: generateDice(newState.turn.diceRemaining),
    };
    newState = gameReducer(newState, rollAction);

    io.to(gameCode).emit('gameStateUpdate', {
      gameState: newState,
      lastAction: {
        playerId: currentPlayer.id,
        action: rollAction,
        isAIControlled: true,
        autoRollAfterDecline: true,
      },
    });
  } else {
    // Broadcast with AI indicator
    io.to(gameCode).emit('gameStateUpdate', {
      gameState: newState,
      lastAction: {
        playerId: currentPlayer.id,
        action,
        isAIControlled: true,
      },
    });
  }

  // Handle END_TURN if needed
  if (newState.turn.phase === TurnPhase.ENDED) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    newState = gameReducer(newState, { type: 'END_TURN' });

    // Clear AI control when turn ends
    const game = await gameManager.getGame(gameCode);
    if (game) {
      game.aiControlledPlayerId = null;
      game.gameState = newState;
      await gameManager.updateGame(game);
    } else {
      await gameManager.updateGameState(gameCode, newState);
    }

    io.to(gameCode).emit('gameStateUpdate', {
      gameState: newState,
      lastAction: {
        playerId: currentPlayer.id,
        action: { type: 'END_TURN' },
        isAIControlled: true,
      },
    });

    // Check for game over
    if (newState.isGameOver) {
      io.to(gameCode).emit('gameEnded', {
        winner: newState.players[newState.winnerIndex!],
        finalState: newState,
      });
      turnTimerManager.clearTimer(gameCode);
      return;
    }

    // Start new turn timer for next player
    const nextPlayer = getCurrentPlayer(newState);
    io.to(gameCode).emit('turnChanged', {
      currentPlayerId: nextPlayer.id,
      isYourTurn: false,
      turnStartedAt: new Date().toISOString(),
    });

    // Start timer for next player (if not AI)
    const updatedGame = await gameManager.getGame(gameCode);
    if (updatedGame && !nextPlayer.isAI && updatedGame.settings.maxTurnTimer > 0) {
      turnTimerManager.startTurn(gameCode, nextPlayer.id, updatedGame.settings.maxTurnTimer * 1000);
    }

    // Continue with AI turns if next player is AI
    if (nextPlayer.isAI) {
      await checkAndExecuteAITurn(io, gameCode, newState);
    }
  } else {
    // Continue AI's current turn
    await executeAITakeoverTurn(io, gameCode, newState, playerId, strategyName);
  }
}

/**
 * Generate random dice
 */
function generateDice(count: number): Dice {
  const dice: Dice = [];
  for (let i = 0; i < count; i++) {
    dice.push((Math.floor(Math.random() * 6) + 1) as DieValue);
  }
  return dice;
}

/**
 * Check if it's an AI's turn and execute if so
 */
async function checkAndExecuteAITurn(
  io: Server,
  gameCode: string,
  gameState: GameState
): Promise<void> {
  const currentPlayer = getCurrentPlayer(gameState);

  if (!currentPlayer.isAI || gameState.isGameOver) {
    return;
  }

  // Import AI decision maker
  const { makeAIDecision, AI_STRATEGIES } = await import('../ai/strategies.js');

  // Add delay for natural feel
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 500));

  // Get AI strategy
  const strategyName = currentPlayer.aiStrategy || 'balanced';
  const strategy = AI_STRATEGIES[strategyName] || AI_STRATEGIES['balanced'];

  // Get AI decision (pass full game state for carryover-aware decisions)
  const decision = makeAIDecision(
    gameState.turn,
    currentPlayer.isOnBoard,
    strategy,
    strategyName,
    gameState
  );

  // Execute AI action
  let action: GameAction;
  switch (decision.action) {
    case 'ROLL':
      action = {
        type: 'ROLL',
        dice: generateDice(gameState.turn.diceRemaining),
      };
      break;
    case 'KEEP':
      action = { type: 'KEEP', dice: decision.dice! };
      break;
    case 'BANK':
      action = { type: 'BANK' };
      break;
    case 'DECLINE_CARRYOVER':
      action = { type: 'DECLINE_CARRYOVER' };
      break;
    default:
      return;
  }

  // Apply action
  let newState = gameReducer(gameState, action);

  // Auto-roll after DECLINE_CARRYOVER for smoother UX
  if (decision.action === 'DECLINE_CARRYOVER') {
    const rollAction = {
      type: 'ROLL' as const,
      dice: generateDice(newState.turn.diceRemaining),
    };
    newState = gameReducer(newState, rollAction);

    io.to(gameCode).emit('gameStateUpdate', {
      gameState: newState,
      lastAction: {
        playerId: currentPlayer.id,
        action: rollAction,
        autoRollAfterDecline: true,
      },
    });
  } else {
    // Broadcast
    io.to(gameCode).emit('gameStateUpdate', {
      gameState: newState,
      lastAction: {
        playerId: currentPlayer.id,
        action,
      },
    });
  }

  // Handle END_TURN if needed
  if (newState.turn.phase === TurnPhase.ENDED) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    newState = gameReducer(newState, { type: 'END_TURN' });

    // Save to DB
    await gameManager.updateGameState(gameCode, newState);

    io.to(gameCode).emit('gameStateUpdate', {
      gameState: newState,
      lastAction: {
        playerId: currentPlayer.id,
        action: { type: 'END_TURN' },
      },
    });

    // Check for game over
    if (newState.isGameOver) {
      io.to(gameCode).emit('gameEnded', {
        winner: newState.players[newState.winnerIndex!],
        finalState: newState,
      });
      turnTimerManager.clearTimer(gameCode);
      return;
    }

    // Notify turn change
    const nextPlayer = getCurrentPlayer(newState);
    io.to(gameCode).emit('turnChanged', {
      currentPlayerId: nextPlayer.id,
      isYourTurn: false, // Will be personalized by client
      turnStartedAt: new Date().toISOString(),
    });

    // Start timer for next human player
    if (!nextPlayer.isAI) {
      const game = await gameManager.getGame(gameCode);
      if (game && game.settings.maxTurnTimer > 0) {
        turnTimerManager.startTurn(gameCode, nextPlayer.id, game.settings.maxTurnTimer * 1000);
      }
    }

    // Continue AI turns
    await checkAndExecuteAITurn(io, gameCode, newState);
  } else {
    // Continue AI's current turn
    await checkAndExecuteAITurn(io, gameCode, newState);
  }
}

/**
 * Set up game-related socket handlers
 */
export function setupGameHandlers(io: Server, socket: Socket) {
  // Handle game actions (roll, keep, bank, etc.)
  socket.on('gameAction', async (payload: GameActionPayload) => {
    const { gameCode, action } = payload;
    const userId = socket.data.userId || socket.id;

    try {
      // Get current game state
      const game = await gameManager.getGame(gameCode);
      if (!game || !game.gameState) {
        socket.emit('actionError', { message: 'Game not found or not started' });
        return;
      }

      // Validate it's this player's turn
      const currentPlayer = getCurrentPlayer(game.gameState);
      console.log(`Game action: userId=${userId}, currentPlayer=${currentPlayer.id}, action=${action.type}`);
      if (currentPlayer.id !== userId) {
        console.log(`Turn mismatch - socket userId: ${userId}, expected: ${currentPlayer.id}`);
        console.log(`All players: ${game.gameState.players.map(p => p.id).join(', ')}`);
        socket.emit('actionError', { message: 'Not your turn' });
        return;
      }

      // Record player activity (resets idle timer, broadcasts to all)
      turnTimerManager.recordActivity(gameCode, userId);

      // Clear AI control if player was being controlled by AI
      if (game.aiControlledPlayerId === userId) {
        game.aiControlledPlayerId = null;
        await gameManager.updateGame(game);
        io.to(gameCode).emit('playerResumedControl', { playerId: userId });
      }

      // For ROLL actions, generate dice server-side
      let finalAction = action;
      if (action.type === 'ROLL') {
        finalAction = {
          type: 'ROLL',
          dice: generateDice(game.gameState.turn.diceRemaining),
        };
      }

      // Apply action through game reducer
      let newState = gameReducer(game.gameState, finalAction);

      // Auto-roll after DECLINE_CARRYOVER for smoother UX
      // Player has already declined the carryover, so they want to roll fresh dice
      if (action.type === 'DECLINE_CARRYOVER') {
        // Generate dice for a fresh roll (5 dice after declining carryover)
        const rollAction = {
          type: 'ROLL' as const,
          dice: generateDice(newState.turn.diceRemaining),
        };
        newState = gameReducer(newState, rollAction);

        // Broadcast combined decline + roll update
        io.to(gameCode).emit('gameStateUpdate', {
          gameState: newState,
          lastAction: {
            playerId: userId,
            action: rollAction,
            autoRollAfterDecline: true,
          },
        });
      } else {
        // Broadcast state update
        io.to(gameCode).emit('gameStateUpdate', {
          gameState: newState,
          lastAction: {
            playerId: userId,
            action: finalAction,
          },
        });
      }

      // Handle END_TURN if needed
      if (newState.turn.phase === TurnPhase.ENDED) {
        // Wait for clients to display bust message before advancing turn
        await new Promise((resolve) => setTimeout(resolve, 2000));

        newState = gameReducer(newState, { type: 'END_TURN' });

        // Save to DB
        await gameManager.updateGameState(gameCode, newState);

        io.to(gameCode).emit('gameStateUpdate', {
          gameState: newState,
          lastAction: {
            playerId: userId,
            action: { type: 'END_TURN' },
          },
        });

        // Check for game over
        if (newState.isGameOver) {
          io.to(gameCode).emit('gameEnded', {
            winner: newState.players[newState.winnerIndex!],
            finalState: newState,
          });
          turnTimerManager.clearTimer(gameCode);
          return;
        }

        // Notify turn change
        const nextPlayer = getCurrentPlayer(newState);
        io.to(gameCode).emit('turnChanged', {
          currentPlayerId: nextPlayer.id,
          isYourTurn: false,
          turnStartedAt: new Date().toISOString(),
        });

        // Start timer for next player (if not AI and timer is enabled)
        if (!nextPlayer.isAI && game.settings.maxTurnTimer > 0) {
          turnTimerManager.startTurn(gameCode, nextPlayer.id, game.settings.maxTurnTimer * 1000);
        }

        // Check for AI turn
        if (nextPlayer.isAI) {
          await checkAndExecuteAITurn(io, gameCode, newState);
        }
      } else {
        // Save intermediate state
        await gameManager.updateGameState(gameCode, newState);
      }
    } catch (error) {
      console.error('Game action error:', error);
      socket.emit('actionError', {
        message: error instanceof Error ? error.message : 'Action failed',
      });
    }
  });

  // Handle request for current game state (for reconnection)
  socket.on('requestGameState', async (data: { gameCode: string }) => {
    const { gameCode } = data;

    try {
      const game = await gameManager.getGame(gameCode);
      if (!game) {
        socket.emit('actionError', { message: 'Game not found' });
        return;
      }

      socket.emit('gameStateUpdate', {
        gameState: game.gameState,
      });

      // Also send recent chat
      socket.emit('chatHistory', {
        messages: game.chat.slice(-50),
      });
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  });

  // Handle dice selection activity (for debounced timer reset)
  socket.on('diceSelected', async (data: { gameCode: string }) => {
    const { gameCode } = data;
    const userId = socket.data.userId || socket.id;

    // Record debounced activity - only resets timer after 2s of no selection changes
    turnTimerManager.recordDebouncedActivity(gameCode, userId);
  });

  // Handle player resuming control from AI
  socket.on('resumeControl', async (data: { gameCode: string }) => {
    const { gameCode } = data;
    const userId = socket.data.userId || socket.id;

    try {
      const game = await gameManager.getGame(gameCode);
      if (!game || !game.gameState) {
        return;
      }

      // Only allow the player being AI-controlled to resume
      if (game.aiControlledPlayerId !== userId) {
        return;
      }

      // Verify it's still their turn
      const currentPlayer = getCurrentPlayer(game.gameState);
      if (currentPlayer.id !== userId) {
        return;
      }

      console.log(`🎮 Player ${userId} resuming control from AI in game ${gameCode}`);

      // Clear AI control
      game.aiControlledPlayerId = null;
      await gameManager.updateGame(game);

      // Broadcast that player resumed control
      io.to(gameCode).emit('playerResumedControl', { playerId: userId });

      // Reset timer for resumed player
      if (game.settings.maxTurnTimer > 0) {
        turnTimerManager.recordActivity(gameCode, userId);
      }
    } catch (error) {
      console.error('Error resuming control:', error);
    }
  });
}

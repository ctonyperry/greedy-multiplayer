/**
 * Socket.IO game action handlers
 * Handles real-time game actions (roll, keep, bank, etc.)
 */

import type { Server, Socket } from 'socket.io';
import { gameManager } from '../services/gameManager.js';
import { gameReducer, getCurrentPlayer, type GameAction } from '../engine/game.js';
import { TurnPhase } from '../types/index.js';
import type { Dice, DieValue, GameState } from '../types/index.js';

interface GameActionPayload {
  gameCode: string;
  action: GameAction;
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

  // Get AI decision
  const decision = makeAIDecision(
    gameState.turn,
    currentPlayer.isOnBoard,
    strategy,
    strategyName
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

  // Broadcast
  io.to(gameCode).emit('gameStateUpdate', {
    gameState: newState,
    lastAction: {
      playerId: currentPlayer.id,
      action,
    },
  });

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
      return;
    }

    // Notify turn change
    const nextPlayer = getCurrentPlayer(newState);
    io.to(gameCode).emit('turnChanged', {
      currentPlayerId: nextPlayer.id,
      isYourTurn: false, // Will be personalized by client
      turnStartedAt: new Date().toISOString(),
    });

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

      // Broadcast state update
      io.to(gameCode).emit('gameStateUpdate', {
        gameState: newState,
        lastAction: {
          playerId: userId,
          action: finalAction,
        },
      });

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
          return;
        }

        // Notify turn change
        const nextPlayer = getCurrentPlayer(newState);
        io.to(gameCode).emit('turnChanged', {
          currentPlayerId: nextPlayer.id,
          isYourTurn: false,
          turnStartedAt: new Date().toISOString(),
        });

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
}

/**
 * Game Lobby Component
 * Waiting room before game starts - shows players, allows host to add AI and start
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import { useSocket, useSocketEvent } from '../../contexts/SocketContext.js';
import { useAuth } from '../../contexts/AuthContext.js';
import type { Game, Player } from '../../types/index.js';

interface GameLobbyProps {
  gameCode: string;
  onGameStart: () => void;
  onLeave: () => void;
}

const AI_STRATEGIES = [
  { value: 'conservative', label: 'Conservative', description: 'Plays it safe, banks early' },
  { value: 'balanced', label: 'Balanced', description: 'Moderate risk/reward' },
  { value: 'aggressive', label: 'Aggressive', description: 'Pushes for big scores' },
];

export function GameLobby({ gameCode, onGameStart, onLeave }: GameLobbyProps) {
  const { user } = useAuth();
  const { joinGame, leaveGame } = useSocket();
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [aiName, setAiName] = useState('');
  const [aiStrategy, setAiStrategy] = useState('balanced');
  const [isAddingAI, setIsAddingAI] = useState(false);

  const isHost = game?.hostId === user?.id;
  const canStart = game && game.players.length >= 2;

  // Fetch game data
  const fetchGame = useCallback(async () => {
    try {
      const gameData = await api.getGame(gameCode);
      setGame(gameData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [gameCode]);

  // Initial load and socket join
  useEffect(() => {
    fetchGame();
    joinGame(gameCode);

    return () => {
      leaveGame(gameCode);
    };
  }, [gameCode, fetchGame, joinGame, leaveGame]);

  // Listen for player updates
  const handlePlayerJoined = useCallback(
    (player: Player) => {
      setGame((prev) =>
        prev ? { ...prev, players: [...prev.players, player] } : prev
      );
    },
    []
  );

  const handlePlayerLeft = useCallback((playerId: string) => {
    setGame((prev) =>
      prev
        ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) }
        : prev
    );
  }, []);

  const handleGameStarted = useCallback(() => {
    onGameStart();
  }, [onGameStart]);

  useSocketEvent('playerJoined', handlePlayerJoined);
  useSocketEvent('playerLeft', handlePlayerLeft);
  useSocketEvent('gameStarted', handleGameStarted);

  // Add AI player
  const handleAddAI = async () => {
    if (!aiName.trim()) return;

    setIsAddingAI(true);
    try {
      const updatedGame = await api.addAIPlayer(gameCode, aiName, aiStrategy);
      setGame(updatedGame);
      setAiName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add AI');
    } finally {
      setIsAddingAI(false);
    }
  };

  // Remove player
  const handleRemovePlayer = async (playerId: string) => {
    try {
      const updatedGame = await api.removePlayer(gameCode, playerId);
      setGame(updatedGame);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove player');
    }
  };

  // Start game
  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      await api.startGame(gameCode);
      // Game started event will trigger onGameStart
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
      setIsStarting(false);
    }
  };

  // Leave game
  const handleLeave = async () => {
    try {
      await api.leaveGame(gameCode);
      onLeave();
    } catch (err) {
      // Still leave even if API fails
      onLeave();
    }
  };

  // Copy code to clipboard
  const copyCode = () => {
    navigator.clipboard.writeText(gameCode);
  };

  // Copy invite link to clipboard
  const [linkCopied, setLinkCopied] = useState(false);
  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${gameCode}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <p>Loading game...</p>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {error}
        </div>
        <button className="btn btn-ghost" onClick={onLeave}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
      {/* Game Code Display */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Game Code
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-3xl)',
              fontFamily: 'monospace',
              fontWeight: 'var(--font-weight-bold)',
              letterSpacing: '0.1em',
              color: 'var(--color-primary)',
            }}
          >
            {gameCode}
          </span>
          <button
            className="btn btn-ghost"
            onClick={copyCode}
            title="Copy to clipboard"
            style={{ padding: 'var(--space-2)' }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
        <button
          className="btn btn-secondary"
          onClick={copyInviteLink}
          style={{
            marginTop: 'var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            width: '100%',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {linkCopied ? 'Link Copied!' : 'Copy Invite Link'}
        </button>
      </div>

      {/* Players List */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>
          Players ({game?.players.length || 0}/6)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {game?.players.map((player) => (
            <div
              key={player.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {/* Player indicator */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: player.isAI
                      ? 'var(--color-accent-light)'
                      : 'var(--color-secondary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-bold)',
                  }}
                >
                  {player.isAI ? 'AI' : player.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-medium)' }}>
                    {player.name}
                    {player.id === game.hostId && (
                      <span
                        style={{
                          marginLeft: 'var(--space-2)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        HOST
                      </span>
                    )}
                    {player.id === user?.id && (
                      <span
                        style={{
                          marginLeft: 'var(--space-2)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        (You)
                      </span>
                    )}
                  </div>
                  {player.isAI && (
                    <div
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {player.aiStrategy} strategy
                    </div>
                  )}
                </div>
              </div>
              {/* Remove button (host only, can't remove self) */}
              {isHost && player.id !== user?.id && (
                <button
                  className="btn btn-ghost"
                  onClick={() => handleRemovePlayer(player.id)}
                  style={{
                    padding: 'var(--space-2)',
                    color: 'var(--color-danger)',
                  }}
                  title="Remove player"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add AI (host only) */}
      {isHost && game && game.players.length < 6 && (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <h4 style={{ marginBottom: 'var(--space-3)' }}>Add AI Player</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="AI Name"
              maxLength={20}
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            />
            <select
              value={aiStrategy}
              onChange={(e) => setAiStrategy(e.target.value)}
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              {AI_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} - {s.description}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              onClick={handleAddAI}
              disabled={isAddingAI || !aiName.trim()}
            >
              {isAddingAI ? 'Adding...' : 'Add AI'}
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {error}
        </div>
      )}

      {/* Game Settings */}
      {game && (
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span>Target Score:</span>
            <span>{game.settings.targetScore.toLocaleString()}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span>Entry Threshold:</span>
            <span>{game.settings.entryThreshold}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Turn Timer:</span>
            <span>
              {game.settings.maxTurnTimer === 0
                ? 'No limit'
                : `${game.settings.maxTurnTimer}s max`}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-ghost" onClick={handleLeave} style={{ flex: 1 }}>
          Leave Game
        </button>
        {isHost && (
          <button
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={isStarting || !canStart}
            style={{ flex: 1 }}
          >
            {isStarting ? 'Starting...' : 'Start Game'}
          </button>
        )}
      </div>
      {isHost && !canStart && (
        <p
          style={{
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--space-3)',
          }}
        >
          Need at least 2 players to start
        </p>
      )}
      {!isHost && (
        <p
          style={{
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--space-3)',
          }}
        >
          Waiting for host to start the game...
        </p>
      )}
    </div>
  );
}

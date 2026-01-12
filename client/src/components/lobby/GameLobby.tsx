/**
 * Game Lobby Component
 * Waiting room before game starts with clear progression flow:
 * Invite players -> Configure game -> Review lobby -> Start game
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  { value: 'balanced', label: 'Balanced', description: 'Smart risk/reward balance', recommended: true },
  { value: 'conservative', label: 'Conservative', description: 'Plays it safe, banks early' },
  { value: 'aggressive', label: 'Aggressive', description: 'Pushes for big scores' },
  { value: 'chaos', label: 'Chaos', description: 'Unpredictable and wild' },
];

// Lobby phases for visual guidance
type LobbyPhase = 'inviting' | 'configuring' | 'ready';

export function GameLobby({ gameCode, onGameStart, onLeave }: GameLobbyProps) {
  const { user } = useAuth();
  const { joinGame, leaveGame } = useSocket();
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // AI controls - hidden by default
  const [showAddAI, setShowAddAI] = useState(false);
  const [aiName, setAiName] = useState('');
  const [aiStrategy, setAiStrategy] = useState('balanced');
  const [isAddingAI, setIsAddingAI] = useState(false);

  // Copy feedback states
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Settings visibility
  const [showSettings, setShowSettings] = useState(false);

  // Backup AI explanation shown once
  const [showBackupAIHelp, setShowBackupAIHelp] = useState(true);

  const isHost = game?.hostId === user?.id;
  const playerCount = game?.players.length || 0;
  const canStart = playerCount >= 2;
  const isFull = playerCount >= 6;

  // Determine current phase
  const phase: LobbyPhase = useMemo(() => {
    if (!game) return 'inviting';
    if (playerCount < 2) return 'inviting';
    if (playerCount >= 2) return 'ready';
    return 'configuring';
  }, [game, playerCount]);

  // Human vs AI player counts
  const humanCount = game?.players.filter(p => !p.isAI).length || 0;
  const aiCount = game?.players.filter(p => p.isAI).length || 0;

  // Fetch game data
  const fetchGame = useCallback(async () => {
    try {
      const gameData = await api.getGame(gameCode);
      setGame(gameData);
      setStatusMessage(null);
    } catch (err) {
      setStatusMessage('Unable to load game. Please try again.');
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

  // Socket event handlers
  const handlePlayerJoined = useCallback((player: Player) => {
    setGame((prev) =>
      prev ? { ...prev, players: [...prev.players, player] } : prev
    );
  }, []);

  const handlePlayerLeft = useCallback((playerId: string) => {
    setGame((prev) =>
      prev ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) } : prev
    );
  }, []);

  const handleGameStarted = useCallback(() => {
    onGameStart();
  }, [onGameStart]);

  const handleStrategyUpdated = useCallback(
    (data: { playerId: string; strategy: string }) => {
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === data.playerId ? { ...p, aiTakeoverStrategy: data.strategy } : p
          ),
        };
      });
    },
    []
  );

  useSocketEvent('playerJoined', handlePlayerJoined);
  useSocketEvent('playerLeft', handlePlayerLeft);
  useSocketEvent('gameStarted', handleGameStarted);
  useSocketEvent('playerStrategyUpdated', handleStrategyUpdated);

  // Actions
  const handleAddAI = async () => {
    if (!aiName.trim()) return;
    setIsAddingAI(true);
    try {
      const updatedGame = await api.addAIPlayer(gameCode, aiName, aiStrategy);
      setGame(updatedGame);
      setAiName('');
      setShowAddAI(false);
    } catch {
      setStatusMessage('Could not add AI player. Please try again.');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsAddingAI(false);
    }
  };

  const handleUpdateStrategy = async (strategy: string) => {
    try {
      const updatedGame = await api.updatePlayerStrategy(gameCode, strategy);
      setGame(updatedGame);
    } catch {
      // Silently fail - non-critical action
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    try {
      const updatedGame = await api.removePlayer(gameCode, playerId);
      setGame(updatedGame);
    } catch {
      setStatusMessage('Could not remove player.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      await api.startGame(gameCode);
    } catch {
      setStatusMessage('Could not start game. Please try again.');
      setIsStarting(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleLeave = async () => {
    try {
      await api.leaveGame(gameCode);
    } catch {
      // Still leave even if API fails
    }
    onLeave();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(gameCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${gameCode}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        gap: 'var(--space-4)',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 40,
            height: 40,
            border: '3px solid var(--color-surface-elevated)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
          }}
        />
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading lobby...</p>
      </div>
    );
  }

  // Fatal error state
  if (!game) {
    return (
      <div style={{
        maxWidth: '400px',
        margin: '0 auto',
        padding: 'var(--space-6)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          margin: '0 auto var(--space-4)',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-danger-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Game Not Found</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
          This game may have ended or the code is incorrect.
        </p>
        <button className="btn btn-primary" onClick={onLeave}>
          Back to Home
        </button>
      </div>
    );
  }

  // Current player for settings
  const currentPlayer = game.players.find(p => p.id === user?.id);

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
    }}>

      {/* ============================================ */}
      {/* SECTION 1: INVITE / GAME CODE */}
      {/* ============================================ */}
      <section style={{
        background: phase === 'inviting'
          ? 'linear-gradient(135deg, var(--color-primary-light), var(--color-surface-elevated))'
          : 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        textAlign: 'center',
        transition: 'background 0.3s ease',
      }}>
        {/* Phase indicator for inviting */}
        {phase === 'inviting' && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-3)',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-4)',
          }}>
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'currentColor',
              }}
            />
            Waiting for players
          </div>
        )}

        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-2)',
        }}>
          Share this code to invite players
        </p>

        {/* Large game code */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
          maxWidth: '100%',
          overflow: 'hidden',
        }}>
          <motion.span
            style={{
              fontSize: 'clamp(1.5rem, 10vw, 3rem)',
              fontFamily: 'monospace',
              fontWeight: 'var(--font-weight-bold)',
              letterSpacing: '0.1em',
              color: 'var(--color-primary)',
            }}
          >
            {gameCode}
          </motion.span>
          <button
            onClick={copyCode}
            style={{
              background: codeCopied ? 'var(--color-success)' : 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: codeCopied ? 'white' : 'var(--color-text)',
            }}
            title="Copy code"
          >
            {codeCopied ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>

        {/* Invite link button */}
        <button
          onClick={copyInviteLink}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-5)',
            backgroundColor: linkCopied ? 'var(--color-success)' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            width: '100%',
            maxWidth: '280px',
          }}
        >
          {linkCopied ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Link Copied!
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Copy Invite Link
            </>
          )}
        </button>
      </section>

      {/* ============================================ */}
      {/* SECTION 2: PLAYERS */}
      {/* ============================================ */}
      <section>
        {/* Section header with progress */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
        }}>
          <h3 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            Players
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            {/* Progress indicator */}
            <span style={{
              fontSize: 'var(--font-size-sm)',
              color: playerCount >= 2 ? 'var(--color-success)' : 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-medium)',
            }}>
              {playerCount} of 6
            </span>
            {/* Visual progress bar */}
            <div style={{
              width: 60,
              height: 6,
              backgroundColor: 'var(--color-surface-elevated)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(playerCount / 6) * 100}%` }}
                style={{
                  height: '100%',
                  backgroundColor: playerCount >= 2 ? 'var(--color-success)' : 'var(--color-primary)',
                  borderRadius: 'var(--radius-full)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Player cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {game.players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: player.id === game.hostId
                  ? '2px solid var(--color-primary-light)'
                  : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {/* Avatar */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: player.isAI ? 'var(--color-accent-light)' : 'var(--color-secondary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: player.isAI ? 'var(--color-accent)' : 'var(--color-secondary)',
                }}>
                  {player.isAI ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="3" />
                      <path d="M12 8v3" />
                      <circle cx="8" cy="16" r="1" fill="currentColor" />
                      <circle cx="16" cy="16" r="1" fill="currentColor" />
                    </svg>
                  ) : (
                    player.name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Name and badges */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                      {player.name}
                    </span>

                    {/* Host badge */}
                    {player.id === game.hostId && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'var(--color-primary)',
                        backgroundColor: 'var(--color-primary-light)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}>
                        HOST
                      </span>
                    )}

                    {/* You badge */}
                    {player.id === user?.id && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                      }}>
                        (you)
                      </span>
                    )}

                    {/* AI badge */}
                    {player.isAI && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-accent)',
                        backgroundColor: 'var(--color-accent-light)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}>
                        AI
                      </span>
                    )}
                  </div>

                  {/* AI strategy display */}
                  {player.isAI && (
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                    }}>
                      {AI_STRATEGIES.find(s => s.value === player.aiStrategy)?.label || player.aiStrategy} strategy
                    </span>
                  )}
                </div>
              </div>

              {/* Remove button (host only, can't remove self) */}
              {isHost && player.id !== user?.id && (
                <button
                  onClick={() => handleRemovePlayer(player.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 'var(--space-2)',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-danger)';
                    e.currentTarget.style.backgroundColor = 'var(--color-danger-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Remove player"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Add AI Player button (host only, not full) */}
        {isHost && !isFull && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <AnimatePresence mode="wait">
              {!showAddAI ? (
                <motion.button
                  key="add-button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAddAI(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                    width: '100%',
                    padding: 'var(--space-3)',
                    backgroundColor: 'transparent',
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  Add AI Player
                </motion.button>
              ) : (
                <motion.div
                  key="add-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-4)',
                  }}>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
                      Add AI Player
                    </h4>
                    <button
                      onClick={() => setShowAddAI(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-secondary)',
                        padding: 'var(--space-1)',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Name input */}
                  <input
                    type="text"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    placeholder="Give your AI a name"
                    maxLength={20}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      fontSize: 'var(--font-size-sm)',
                      marginBottom: 'var(--space-3)',
                    }}
                  />

                  {/* Strategy selection */}
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <p style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      Personality
                    </p>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-2)',
                    }}>
                      {AI_STRATEGIES.map((strategy) => (
                        <button
                          key={strategy.value}
                          onClick={() => setAiStrategy(strategy.value)}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            border: aiStrategy === strategy.value
                              ? '2px solid var(--color-primary)'
                              : '2px solid var(--color-border)',
                            backgroundColor: aiStrategy === strategy.value
                              ? 'var(--color-primary-light)'
                              : 'var(--color-surface)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)',
                          }}>
                            {strategy.label}
                            {strategy.recommended && (
                              <span style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-success)',
                              }}>
                                *
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                          }}>
                            {strategy.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAddAI}
                    disabled={isAddingAI || !aiName.trim()}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor: aiName.trim() ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: aiName.trim() ? 'white' : 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      cursor: aiName.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isAddingAI ? 'Adding...' : 'Add to Game'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* SECTION 3: YOUR SETTINGS (Collapsible) */}
      {/* ============================================ */}
      {currentPlayer && !currentPlayer.isAI && (
        <section>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface-elevated)',
              border: 'none',
              borderRadius: showSettings ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
              cursor: 'pointer',
              color: 'var(--color-text)',
            }}
          >
            <span style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
            }}>
              Your Settings
            </span>
            <motion.svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              animate={{ rotate: showSettings ? 180 : 0 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </motion.svg>
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  padding: 'var(--space-4)',
                  borderTop: '1px solid var(--color-border)',
                }}>
                  {/* Backup AI explanation */}
                  {showBackupAIHelp && (
                    <div style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-primary-light)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--space-4)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-2)',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <div>
                        <p style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text)',
                          margin: 0,
                        }}>
                          If you disconnect or time out, an AI will temporarily play for you using this strategy.
                        </p>
                        <button
                          onClick={() => setShowBackupAIHelp(false)}
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-primary)',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            marginTop: 'var(--space-1)',
                          }}
                        >
                          Got it
                        </button>
                      </div>
                    </div>
                  )}

                  <label style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    display: 'block',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Backup AI Strategy
                  </label>
                  <select
                    value={currentPlayer.aiTakeoverStrategy || 'balanced'}
                    onChange={(e) => handleUpdateStrategy(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {AI_STRATEGIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label} - {s.description}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* ============================================ */}
      {/* SECTION 4: GAME SETTINGS (Read-only) */}
      {/* ============================================ */}
      <section style={{
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <h4 style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-3)',
        }}>
          Game Rules
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-3)',
          fontSize: 'var(--font-size-sm)',
        }}>
          <div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Target</p>
            <p style={{ fontWeight: 'var(--font-weight-medium)' }}>{game.settings.targetScore.toLocaleString()}</p>
          </div>
          <div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Entry</p>
            <p style={{ fontWeight: 'var(--font-weight-medium)' }}>{game.settings.entryThreshold}</p>
          </div>
          <div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Timer</p>
            <p style={{ fontWeight: 'var(--font-weight-medium)' }}>
              {game.settings.maxTurnTimer === 0 ? 'None' : `${game.settings.maxTurnTimer}s`}
            </p>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 5: START GAME */}
      {/* ============================================ */}
      <section>
        {/* Status message (non-blocking) */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-warning-light)',
                color: 'var(--color-warning)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-3)',
                fontSize: 'var(--font-size-sm)',
                textAlign: 'center',
              }}
            >
              {statusMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main action area */}
        {isHost ? (
          <div>
            {/* Start Game button - visually prominent when ready */}
            <motion.button
              onClick={handleStartGame}
              disabled={isStarting || !canStart}
              animate={canStart && !isStarting ? {
                boxShadow: [
                  '0 0 0 0 rgba(var(--color-primary-rgb), 0)',
                  '0 0 0 8px rgba(var(--color-primary-rgb), 0.1)',
                  '0 0 0 0 rgba(var(--color-primary-rgb), 0)',
                ],
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: '100%',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor: canStart ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                color: canStart ? 'white' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: canStart ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                marginBottom: 'var(--space-3)',
              }}
            >
              {isStarting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                    }}
                  />
                  Starting...
                </span>
              ) : canStart ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Game
                </span>
              ) : (
                `Waiting for ${2 - playerCount} more player${2 - playerCount !== 1 ? 's' : ''}`
              )}
            </motion.button>

            {/* Progress encouragement when not ready */}
            {!canStart && (
              <p style={{
                textAlign: 'center',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
              }}>
                Invite a friend or add an AI player to continue
              </p>
            )}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface-elevated)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </motion.span>
              Waiting for the host to start the game...
            </motion.div>
          </div>
        )}

        {/* Leave button - de-emphasized */}
        <button
          onClick={handleLeave}
          style={{
            width: '100%',
            marginTop: 'var(--space-3)',
            padding: 'var(--space-2)',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        >
          Leave Game
        </button>
      </section>
    </div>
  );
}

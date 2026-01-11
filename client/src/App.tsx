import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { SocketProvider } from './contexts/SocketContext.js';
import { ToastProvider } from './contexts/ToastContext.js';
import { setTokenGetter, api } from './services/api.js';
import { GameOver } from './ui/GameOver.js';
import { HelpPanel } from './ui/HelpPanel.js';
import { AuthModal } from './components/auth/index.js';
import { CreateGame, JoinGame, GameLobby } from './components/lobby/index.js';
import { MultiplayerGameBoard, ConnectionStatus } from './components/multiplayer/index.js';
import { useI18n } from './i18n/index.js';
import { useActiveGames } from './hooks/useActiveGames.js';
import type { GameState } from './types/index.js';
import './styles/design-system.css';

type Screen =
  | 'start'       // Sign in screen
  | 'home'        // Signed in, choose create/join
  | 'create'      // Creating new game (timer settings)
  | 'join'        // Entering game code
  | 'lobby'       // Waiting for players/start
  | 'game'        // Playing online
  | 'gameover';   // Game finished

/**
 * AppContent - Main app with screen management
 * Wrapped by AuthProvider and SocketProvider
 */
function AppContent() {
  const { t } = useI18n();
  const { user, isAuthenticated, isLoading, isGuest, logout, getAccessToken } = useAuth();
  const { activeGames, addGame, removeGame, refreshGames } = useActiveGames();
  const [screen, setScreen] = useState<Screen>('start');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  // Set up token getter for API service
  useEffect(() => {
    setTokenGetter(getAccessToken);
  }, [getAccessToken]);

  // Parse join code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && /^[A-Z0-9]{6}$/i.test(joinCode)) {
      setPendingJoinCode(joinCode.toUpperCase());
      // Clean up URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Handle screen transitions based on auth state
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && screen === 'start') {
        // Authenticated, go to home (or join if pending code)
        if (pendingJoinCode) {
          setScreen('join');
        } else {
          setScreen('home');
        }
      }
    }
  }, [isAuthenticated, isLoading, screen, pendingJoinCode]);

  // Refresh active games when navigating to home screen
  useEffect(() => {
    if (screen === 'home' && isAuthenticated) {
      refreshGames();
    }
  }, [screen, isAuthenticated, refreshGames]);

  // ============================================
  // Game Handlers
  // ============================================

  const handleGoHome = useCallback(() => {
    setGameCode(null);
    setGameState(null);
    setScreen('home');
  }, []);

  const handleCreateGame = useCallback(() => {
    setScreen('create');
  }, []);

  const handleJoinGame = useCallback(() => {
    setScreen('join');
  }, []);

  const handleResumeGame = useCallback((code: string, status: 'waiting' | 'playing') => {
    setGameCode(code);
    addGame(code);
    if (status === 'waiting') {
      setScreen('lobby');
    } else {
      setScreen('game');
    }
  }, [addGame]);

  const handleGameCreated = useCallback((code: string) => {
    setGameCode(code);
    addGame(code);
    setScreen('lobby');
  }, [addGame]);

  const handleGameJoined = useCallback((code: string) => {
    setGameCode(code);
    addGame(code);
    setScreen('lobby');
  }, [addGame]);

  const handleOnlineGameStart = useCallback(() => {
    setScreen('game');
  }, []);

  const handleLeaveLobby = useCallback(() => {
    if (gameCode) {
      removeGame(gameCode);
    }
    setGameCode(null);
    setScreen('home');
  }, [gameCode, removeGame]);

  const handleLeaveGame = useCallback(async (code: string) => {
    try {
      await api.leaveGame(code);
    } catch (err) {
      // Game may already be gone, that's fine
      console.log('Leave game error (may be expected):', err);
    }
    removeGame(code);
  }, [removeGame]);

  // ============================================
  // Common Handlers
  // ============================================

  const handleNewGame = useCallback(() => {
    setGameState(null);
    setGameCode(null);
    if (isAuthenticated) {
      setScreen('home');
    } else {
      setScreen('start');
    }
  }, [isAuthenticated]);

  const handleSignOut = useCallback(async () => {
    await logout();
    setScreen('start');
  }, [logout]);

  // ============================================
  // Render
  // ============================================

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.2)',
          minHeight: 'var(--header-height)',
        }}
      >
        <h1
          onClick={() => isAuthenticated ? setScreen('home') : setScreen('start')}
          style={{
            margin: 0,
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-bold)',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            cursor: 'pointer',
          }}
        >
          {t('appTitle')}
        </h1>

        {/* Header actions */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {/* Connection status - show when in game or lobby */}
          {(screen === 'game' || screen === 'lobby') && (
            <ConnectionStatus compact showReconnect />
          )}

          {/* User info */}
          {isAuthenticated && user && (
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {user.name}{isGuest && ' (Guest)'}
            </span>
          )}

          <button
            onClick={() => setShowHelp(true)}
            className="btn btn-ghost btn-sm"
            style={{ minHeight: 44, fontSize: 'var(--font-size-lg)' }}
            aria-label={t('howToPlay')}
          >
            ?
          </button>

          {screen !== 'start' && screen !== 'home' && (
            <button
              onClick={handleNewGame}
              className="btn btn-ghost btn-sm"
              style={{ minHeight: 44 }}
              aria-label="Home"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
          )}

          {isAuthenticated && (
            <button
              onClick={handleSignOut}
              className="btn btn-ghost btn-sm"
              style={{ minHeight: 44 }}
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <AnimatePresence mode="wait">
          {/* Start Screen - Authentication options */}
          {screen === 'start' && (
            <motion.div
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ minHeight: '100%' }}
            >
              <div
                style={{
                  maxWidth: '400px',
                  margin: '0 auto',
                  padding: 'var(--space-6) var(--space-4)',
                }}
              >
                {!isLoading && <AuthModal />}
              </div>
            </motion.div>
          )}

          {/* Home - Signed in menu */}
          {screen === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ minHeight: '100%' }}
            >
              <div
                style={{
                  maxWidth: '400px',
                  margin: '0 auto',
                  padding: 'var(--space-6) var(--space-4)',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                  <h2 style={{ marginBottom: 'var(--space-2)' }}>
                    Welcome, {user?.name || 'Player'}!
                  </h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    What would you like to do?
                  </p>
                </div>

                {/* Active Games - Resume Game */}
                {activeGames.length > 0 && (
                  <div
                    style={{
                      marginBottom: 'var(--space-4)',
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-surface-elevated)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-primary)',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-primary)',
                        marginBottom: 'var(--space-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Resume Game
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {activeGames.map((activeGame) => (
                        <div
                          key={activeGame.code}
                          style={{
                            display: 'flex',
                            gap: 'var(--space-2)',
                            alignItems: 'stretch',
                          }}
                        >
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              const status = activeGame.game?.status || 'waiting';
                              handleResumeGame(activeGame.code, status as 'waiting' | 'playing');
                            }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: 'var(--space-3)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 'var(--font-weight-bold)',
                                }}
                              >
                                {activeGame.code}
                              </span>
                              {activeGame.game && (
                                <span
                                  style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: activeGame.game.status === 'playing'
                                      ? 'var(--color-primary)'
                                      : 'var(--color-text-secondary)',
                                    padding: '2px 6px',
                                    backgroundColor: activeGame.game.status === 'playing'
                                      ? 'var(--color-primary-light)'
                                      : 'var(--color-surface-hover)',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  {activeGame.game.status === 'playing' ? 'In Progress' : 'Waiting'}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 'var(--font-size-sm)' }}>
                              {activeGame.game
                                ? `${activeGame.game.players.length} player${activeGame.game.players.length !== 1 ? 's' : ''}`
                                : 'Resume'
                              }
                            </span>
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleLeaveGame(activeGame.code)}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              color: 'var(--color-text-secondary)',
                              minWidth: 44,
                            }}
                            title="Leave game"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={handleCreateGame}
                    style={{
                      padding: 'var(--space-4)',
                      fontSize: 'var(--font-size-lg)',
                    }}
                  >
                    Create Game
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleJoinGame}
                    style={{
                      padding: 'var(--space-4)',
                      fontSize: 'var(--font-size-lg)',
                    }}
                  >
                    Join Game
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Create Game */}
          {screen === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: 'var(--space-6) var(--space-4)' }}
            >
              <CreateGame
                onGameCreated={handleGameCreated}
                onCancel={handleGoHome}
              />
            </motion.div>
          )}

          {/* Join Game */}
          {screen === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: 'var(--space-6) var(--space-4)' }}
            >
              <JoinGame
                onGameJoined={(code) => {
                  setPendingJoinCode(null);
                  handleGameJoined(code);
                }}
                onCancel={handleGoHome}
                initialCode={pendingJoinCode || undefined}
              />
            </motion.div>
          )}

          {/* Game Lobby */}
          {screen === 'lobby' && gameCode && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: 'var(--space-6) var(--space-4)' }}
            >
              <GameLobby
                gameCode={gameCode}
                onGameStart={handleOnlineGameStart}
                onLeave={handleLeaveLobby}
              />
            </motion.div>
          )}

          {/* Game Board */}
          {screen === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {gameCode ? (
                <MultiplayerGameBoard
                  gameCode={gameCode}
                  onGameEnd={(finalState) => {
                    setGameState(finalState);
                    setScreen('gameover');
                  }}
                  showHints
                />
              ) : (
                // No game code, go back to home
                <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                  <p>No game selected</p>
                  <button className="btn btn-primary" onClick={handleGoHome}>
                    Go Home
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Game Over */}
          {screen === 'gameover' && gameState && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GameOver gameState={gameState} onNewGame={handleNewGame} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Help panel */}
      <AnimatePresence>
        {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      </AnimatePresence>
    </div>
  );
}

/**
 * App - Root component wrapped with providers
 */
export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

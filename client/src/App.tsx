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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background blobs */}
      <div className="bg-blobs-container">
        <div
          className="bg-blob bg-blob-primary"
          style={{
            width: 'clamp(256px, 40vw, 400px)',
            height: 'clamp(256px, 40vw, 400px)',
            top: '15%',
            left: '10%',
          }}
        />
        <div
          className="bg-blob bg-blob-secondary"
          style={{
            width: 'clamp(256px, 40vw, 400px)',
            height: 'clamp(256px, 40vw, 400px)',
            bottom: '15%',
            right: '10%',
          }}
        />
      </div>
      {/* Header */}
      <header
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.8)', /* slate-900/80 */
          backdropFilter: 'blur(8px)',
          minHeight: 'var(--header-height)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <h1
          onClick={() => isAuthenticated ? setScreen('home') : setScreen('start')}
          style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            background: 'linear-gradient(to right, #34d399, #10b981)', /* emerald-400 to emerald-500 */
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            cursor: 'pointer',
          }}
        >
          {t('appTitle')}
        </h1>

        {/* Header actions */}
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          {/* Connection status - show when in game or lobby */}
          {(screen === 'game' || screen === 'lobby') && (
            <ConnectionStatus compact showReconnect />
          )}

          {/* User info - hidden on small screens */}
          {isAuthenticated && user && (
            <span
              className="hide-mobile"
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                marginRight: 'var(--space-1)',
              }}
            >
              {user.name}{isGuest && ' (Guest)'}
            </span>
          )}

          <button
            onClick={() => setShowHelp(true)}
            className="btn btn-ghost btn-sm"
            style={{ minHeight: 40, minWidth: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label={t('howToPlay')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M6 9a6 6 0 0 1 12 0c0 4-6 5-6 9" />
              <circle cx="12" cy="21" r="1" fill="currentColor" />
            </svg>
          </button>

          {screen !== 'start' && screen !== 'home' && (
            <button
              onClick={handleNewGame}
              className="btn btn-ghost btn-sm"
              style={{ minHeight: 40, minWidth: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                style={{ flexShrink: 0 }}
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
              style={{ minHeight: 40, minWidth: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Sign Out"
              title="Sign Out"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 1 }}>
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
                {/* Welcome header - Figma style */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                  <h2 style={{
                    fontSize: 'var(--font-size-2xl)',
                    fontWeight: 'var(--font-weight-bold)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Welcome, {user?.name || 'Player'}!
                  </h2>
                  <p style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-lg)',
                  }}>
                    What would you like to do?
                  </p>
                </div>

                {/* Active Games - Resume Game */}
                {activeGames.length > 0 && (
                  <div
                    style={{
                      marginBottom: 'var(--space-5)',
                      padding: 'var(--space-4)',
                      backgroundColor: 'rgba(30, 41, 59, 0.5)',
                      borderRadius: 'var(--radius-2xl)',
                      border: '2px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-primary)',
                        marginBottom: 'var(--space-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 'var(--font-weight-semibold)',
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
                            className="btn"
                            onClick={() => {
                              const status = activeGame.game?.status || 'waiting';
                              handleResumeGame(activeGame.code, status as 'waiting' | 'playing');
                            }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: 'var(--space-3) var(--space-4)',
                              background: 'rgba(30, 41, 59, 0.7)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-xl)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 'var(--font-weight-bold)',
                                  color: 'var(--color-primary)',
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
                                    padding: '2px 8px',
                                    backgroundColor: activeGame.game.status === 'playing'
                                      ? 'var(--color-primary-light)'
                                      : 'rgba(30, 41, 59, 0.5)',
                                    borderRadius: 'var(--radius-full)',
                                    fontWeight: 'var(--font-weight-medium)',
                                  }}
                                >
                                  {activeGame.game.status === 'playing' ? 'In Progress' : 'Waiting'}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main action buttons - Figma style with icons */}
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
                      padding: 'var(--space-5) var(--space-4)',
                      fontSize: 'var(--font-size-xl)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-3)',
                      borderRadius: 'var(--radius-2xl)',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create Game
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleJoinGame}
                    style={{
                      padding: 'var(--space-5) var(--space-4)',
                      fontSize: 'var(--font-size-xl)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-3)',
                      borderRadius: 'var(--radius-2xl)',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
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

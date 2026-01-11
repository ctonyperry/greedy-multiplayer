import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { SocketProvider } from './contexts/SocketContext.js';
import { setTokenGetter } from './services/api.js';
import { StartScreen } from './ui/StartScreen.js';
import type { PlayerConfig } from './ui/StartScreen.js';
import { GameBoard } from './ui/GameBoard.js';
import { GameOver } from './ui/GameOver.js';
import { DebugFooter } from './ui/DebugFooter.js';
import { HelpPanel } from './ui/HelpPanel.js';
import { SignInButton } from './components/auth/index.js';
import { CreateGame, JoinGame, GameLobby } from './components/lobby/index.js';
import { MultiplayerGameBoard } from './components/multiplayer/index.js';
import { createGameState } from './engine/game.js';
import { gameLogger } from './debug/GameLogger.js';
import { useI18n } from './i18n/index.js';
import type { GameState } from './types/index.js';
import './styles/design-system.css';

type Screen =
  | 'start'       // Choose: sign in OR play offline
  | 'home'        // Signed in, choose create/join
  | 'create'      // Creating new game (timer settings)
  | 'join'        // Entering game code
  | 'lobby'       // Waiting for players/start
  | 'game'        // Playing (online or offline)
  | 'gameover';   // Game finished

type GameMode = 'offline' | 'online';

/**
 * AppContent - Main app with screen management
 * Wrapped by AuthProvider and SocketProvider
 */
function AppContent() {
  const { t } = useI18n();
  const { user, isAuthenticated, isLoading, isGuest, logout, loginAsGuest, getAccessToken } = useAuth();
  const [screen, setScreen] = useState<Screen>('start');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('offline');
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

  // Handle pending join code - auto-login as guest if needed
  useEffect(() => {
    if (pendingJoinCode && !isLoading) {
      if (isAuthenticated) {
        // Already authenticated, go to join screen
        setScreen('join');
      } else {
        // Not authenticated, auto-login as guest and proceed
        loginAsGuest();
      }
    } else if (isAuthenticated && screen === 'start' && !pendingJoinCode) {
      setScreen('home');
    }
  }, [isAuthenticated, isLoading, screen, pendingJoinCode, loginAsGuest]);

  // ============================================
  // Offline Game Handlers
  // ============================================

  const handleOfflineStart = useCallback((players: PlayerConfig[]) => {
    gameLogger.reset();
    gameLogger.gameStart(players.map(p => ({
      name: p.name,
      isAI: p.isAI,
      aiStrategy: p.aiStrategy,
    })));
    const newGame = createGameState(players);
    setGameState(newGame);
    setGameMode('offline');
    setScreen('game');
  }, []);

  const handleGameStateChange = useCallback((newState: GameState) => {
    setGameState(newState);
    if (newState.isGameOver) {
      const winner = newState.players.reduce((a, b) => a.score > b.score ? a : b);
      gameLogger.gameEnd(
        winner.name,
        newState.players.map(p => ({ name: p.name, score: p.score }))
      );
      setTimeout(() => setScreen('gameover'), 500);
    }
  }, []);

  // ============================================
  // Online Game Handlers
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

  const handleGameCreated = useCallback((code: string) => {
    setGameCode(code);
    setGameMode('online');
    setScreen('lobby');
  }, []);

  const handleGameJoined = useCallback((code: string) => {
    setGameCode(code);
    setGameMode('online');
    setScreen('lobby');
  }, []);

  const handleOnlineGameStart = useCallback(() => {
    setScreen('game');
  }, []);

  const handleLeaveLobby = useCallback(() => {
    setGameCode(null);
    setScreen('home');
  }, []);

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

  const _handlePlayOffline = useCallback(() => {
    setGameMode('offline');
    setScreen('game');
  }, []);

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
            >
              {t('newGame')}
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
          {/* Start Screen - Choose sign in or play offline */}
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
                  maxWidth: '500px',
                  margin: '0 auto',
                  padding: 'var(--space-6) var(--space-4)',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                  <h2
                    style={{
                      fontSize: 'var(--font-size-2xl)',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    Welcome to Greedy
                  </h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    A classic dice game of risk and reward
                  </p>
                </div>

                {/* Sign in for multiplayer */}
                {!isLoading && (
                  <div
                    className="card"
                    style={{
                      marginBottom: 'var(--space-4)',
                      textAlign: 'center',
                    }}
                  >
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>Play Online</h3>
                    <p
                      style={{
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-4)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      Play with friends online
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          loginAsGuest();
                          setScreen('home');
                        }}
                        style={{ width: '100%' }}
                      >
                        Play as Guest
                      </button>
                      <SignInButton />
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    margin: 'var(--space-5) 0',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: '1px',
                      backgroundColor: 'var(--color-border)',
                    }}
                  />
                  <span style={{ color: 'var(--color-text-secondary)' }}>or</span>
                  <div
                    style={{
                      flex: 1,
                      height: '1px',
                      backgroundColor: 'var(--color-border)',
                    }}
                  />
                </div>

                {/* Offline play */}
                <div className="card">
                  <h3 style={{ marginBottom: 'var(--space-3)', textAlign: 'center' }}>
                    Play Offline
                  </h3>
                  <StartScreen onStart={handleOfflineStart} />
                </div>
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
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setGameMode('offline');
                      setScreen('start');
                    }}
                    style={{
                      padding: 'var(--space-4)',
                    }}
                  >
                    Play Offline vs AI
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
              {gameMode === 'offline' && gameState ? (
                <GameBoard
                  gameState={gameState}
                  onGameStateChange={handleGameStateChange}
                  showHints
                />
              ) : gameMode === 'offline' ? (
                // Show start screen for offline mode if no game state
                <StartScreen onStart={handleOfflineStart} />
              ) : gameCode ? (
                // Online multiplayer game board
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

      <DebugFooter />

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
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

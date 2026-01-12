/**
 * HomeScreen Component
 * Engaging landing page with dice animations and game mechanics preview
 * Based on Figma AI design
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { DieValue } from '../../types/index.js';

// Simple Die face component for display
function DieFace({ value, size = 48, glow = false }: { value: DieValue; size?: number; glow?: boolean }) {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        filter: glow ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' : 'none',
      }}
    >
      <rect
        x="5" y="5" width="90" height="90" rx="14"
        fill="white"
        stroke={glow ? '#10b981' : 'rgba(255,255,255,0.2)'}
        strokeWidth={glow ? 3 : 2}
      />
      {dotPositions[value]?.map((pos, i) => (
        <circle key={i} cx={pos[0]} cy={pos[1]} r="10" fill="#0f172a" />
      ))}
    </svg>
  );
}

// Floating background die
function FloatingDie({ value, style }: { value: DieValue; style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        opacity: 0.08,
        pointerEvents: 'none',
        animation: 'float 6s ease-in-out infinite',
        ...style,
      }}
    >
      <DieFace value={value} size={60} />
    </div>
  );
}

// Hero dice that periodically "roll"
function HeroDice() {
  const goodRolls: DieValue[][] = [
    [1, 1, 1, 5, 5], // Triple 1s + pair of 5s
    [5, 5, 5, 1, 1], // Triple 5s + pair of 1s
    [1, 1, 1, 1, 5], // Four 1s + 5
    [1, 5, 1, 5, 1], // Alternating scoring dice
    [1, 1, 5, 5, 5], // Pair of 1s + triple 5s
  ];

  const [values, setValues] = useState<DieValue[]>(goodRolls[0]);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    const rollInterval = setInterval(() => {
      setIsRolling(true);

      let rollCount = 0;
      const rollAnimation = setInterval(() => {
        setValues(Array.from({ length: 5 }, () => (Math.floor(Math.random() * 6) + 1) as DieValue));
        rollCount++;
        if (rollCount > 12) {
          clearInterval(rollAnimation);
          setValues(goodRolls[Math.floor(Math.random() * goodRolls.length)]);
          setIsRolling(false);
        }
      }, 60);
    }, 5000);

    return () => clearInterval(rollInterval);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {values.map((val, i) => (
        <motion.div
          key={i}
          animate={isRolling ? {
            y: [0, -10, 0],
            rotate: [0, 10, -10, 0],
          } : {}}
          transition={{
            duration: 0.15,
            repeat: isRolling ? Infinity : 0,
            delay: i * 0.05,
          }}
        >
          <DieFace
            value={val}
            size={52}
            glow={val === 1 || val === 5}
          />
        </motion.div>
      ))}
    </div>
  );
}

// Live indicator with pulse
function LiveIndicator({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
      <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
        <span style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          opacity: 0.75,
          animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        }} />
        <span style={{
          position: 'relative',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#10b981',
        }} />
      </span>
      <span><span style={{ color: '#10b981', fontWeight: 'var(--font-weight-medium)' }}>{count}</span> players online</span>
    </div>
  );
}

interface HomeScreenProps {
  userName?: string;
  onCreateGame: () => void;
  onJoinGame: () => void;
  activeGames?: Array<{
    code: string;
    game?: { status: string; players: Array<{ id: string }> };
  }>;
  onResumeGame?: (code: string, status: 'waiting' | 'playing') => void;
  onLeaveGame?: (code: string) => void;
}

export function HomeScreen({
  userName: _userName,
  onCreateGame,
  onJoinGame,
  activeGames = [],
  onResumeGame,
  onLeaveGame,
}: HomeScreenProps) {
  // Simulated live stats (could be real from an API later)
  const playersOnline = useMemo(() => Math.floor(Math.random() * 80) + 120, []);
  const activeGameCount = useMemo(() => Math.floor(Math.random() * 25) + 30, []);

  const [hoveredButton, setHoveredButton] = useState<'create' | 'join' | null>(null);

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Floating background dice */}
      <FloatingDie value={1} style={{ left: '5%', top: '15%', animationDelay: '0s' }} />
      <FloatingDie value={5} style={{ right: '8%', top: '10%', animationDelay: '1s' }} />
      <FloatingDie value={3} style={{ left: '8%', bottom: '25%', animationDelay: '2s' }} />
      <FloatingDie value={6} style={{ right: '5%', bottom: '20%', animationDelay: '0.5s' }} />
      <FloatingDie value={2} style={{ left: '15%', top: '45%', animationDelay: '1.5s' }} />
      <FloatingDie value={4} style={{ right: '12%', top: '40%', animationDelay: '2.5s' }} />

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>

          {/* Hero dice */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <HeroDice />
          </div>

          {/* Main headline */}
          <h2 style={{
            fontSize: 'clamp(2rem, 8vw, 3.5rem)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
            marginBottom: 'var(--space-3)',
            lineHeight: 1.1,
          }}>
            How <span style={{ color: '#10b981' }}>Greedy</span> Are You?
          </h2>

          {/* Subheadline */}
          <p style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-2)',
          }}>
            Push your luck. Risk it all. Hit <span style={{ color: '#10b981', fontWeight: 'var(--font-weight-semibold)' }}>10,000</span> first.
          </p>

          {/* Flavor text */}
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'rgba(148, 163, 184, 0.7)',
            fontStyle: 'italic',
            marginBottom: 'var(--space-6)',
          }}>
            "Just one more roll..." — Everyone who ever busted
          </p>

          {/* Active Games - Resume */}
          {activeGames.length > 0 && onResumeGame && (
            <div style={{
              marginBottom: 'var(--space-5)',
              padding: 'var(--space-4)',
              background: 'rgba(30, 41, 59, 0.5)',
              borderRadius: 'var(--radius-2xl)',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              textAlign: 'left',
            }}>
              <h3 style={{
                fontSize: 'var(--font-size-xs)',
                color: '#10b981',
                marginBottom: 'var(--space-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                Resume Game
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {activeGames.map((activeGame) => (
                  <div key={activeGame.code} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
                    <button
                      onClick={() => {
                        const status = activeGame.game?.status || 'waiting';
                        onResumeGame(activeGame.code, status as 'waiting' | 'playing');
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
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'var(--font-weight-bold)', color: '#10b981' }}>
                          {activeGame.code}
                        </span>
                        {activeGame.game && (
                          <span style={{
                            fontSize: 'var(--font-size-xs)',
                            color: activeGame.game.status === 'playing' ? '#10b981' : 'var(--color-text-secondary)',
                            padding: '2px 8px',
                            backgroundColor: activeGame.game.status === 'playing' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                            borderRadius: 'var(--radius-full)',
                          }}>
                            {activeGame.game.status === 'playing' ? 'In Progress' : 'Waiting'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {activeGame.game ? `${activeGame.game.players.length} player${activeGame.game.players.length !== 1 ? 's' : ''}` : 'Resume'}
                      </span>
                    </button>
                    {onLeaveGame && (
                      <button
                        onClick={() => onLeaveGame(activeGame.code)}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          background: 'transparent',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-xl)',
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          minWidth: 44,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Leave game"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <motion.button
              onClick={onCreateGame}
              onMouseEnter={() => setHoveredButton('create')}
              onMouseLeave={() => setHoveredButton(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: 'var(--space-4) var(--space-6)',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#0f172a',
                border: 'none',
                borderRadius: 'var(--radius-xl)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-bold)',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Start a Game
              </span>
              <span style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-normal)',
                color: 'rgba(15, 23, 42, 0.7)',
                marginTop: 4,
              }}>
                {hoveredButton === 'create' ? "Let's get greedy" : "Invite friends or play solo"}
              </span>
            </motion.button>

            <motion.button
              onClick={onJoinGame}
              onMouseEnter={() => setHoveredButton('join')}
              onMouseLeave={() => setHoveredButton(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: 'var(--space-4) var(--space-6)',
                background: 'rgba(30, 41, 59, 0.8)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-bold)',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Join Game
              </span>
              <span style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-normal)',
                color: 'var(--color-text-secondary)',
                marginTop: 4,
              }}>
                {hoveredButton === 'join' ? "Show them no mercy" : `${activeGameCount} games in progress`}
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Keyframes for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(8deg); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

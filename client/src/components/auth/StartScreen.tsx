/**
 * StartScreen Component
 * Engaging landing page for unauthenticated users
 * Same visual style as HomeScreen with auth options
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { DieValue } from '../../types/index.js';
import { AuthModal } from './AuthModal.js';

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

export function StartScreen() {
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
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>

          {/* Hero dice */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <HeroDice />
          </div>

          {/* Auth Modal */}
          <AuthModal />
        </div>
      </div>

      {/* Keyframes for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(8deg); }
        }
      `}</style>
    </div>
  );
}

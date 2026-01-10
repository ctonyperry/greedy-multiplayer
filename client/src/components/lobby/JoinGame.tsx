/**
 * Join Game Component
 * Enter a game code to join an existing game
 */

import { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api.js';

interface JoinGameProps {
  onGameJoined: (code: string) => void;
  onCancel: () => void;
  initialCode?: string;
}

export function JoinGame({ onGameJoined, onCancel, initialCode = '' }: JoinGameProps) {
  const [code, setCode] = useState(initialCode);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCodeChange = (value: string) => {
    // Only allow alphanumeric, uppercase, max 6 chars
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError(null);
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError('Game code must be 6 characters');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      await api.joinGame(code);
      onGameJoined(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleJoin();
    }
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--space-5)' }}>Join Game</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Game Code Input */}
        <div>
          <label
            htmlFor="gameCode"
            style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            Game Code
          </label>
          <input
            ref={inputRef}
            id="gameCode"
            type="text"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            style={{
              width: '100%',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: error
                ? '2px solid var(--color-danger)'
                : '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-xl)',
              fontFamily: 'monospace',
              textAlign: 'center',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          />
          <p
            style={{
              marginTop: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            Ask the host for the 6-character code
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isJoining}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={isJoining || code.length !== 6}
            style={{ flex: 1 }}
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </button>
        </div>
      </div>
    </div>
  );
}

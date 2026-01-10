/**
 * Create Game Component
 * Form to create a new multiplayer game with settings
 */

import { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import type { GameSettings } from '../../types/index.js';

interface CreateGameProps {
  onGameCreated: (code: string) => void;
  onCancel: () => void;
}

const TIMER_OPTIONS = [
  { value: 0, label: 'No Timer' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 90, label: '90 seconds' },
  { value: 120, label: '2 minutes' },
  { value: 180, label: '3 minutes' },
];

const STORAGE_KEY = 'greedy-game-settings';

const DEFAULT_SETTINGS: Partial<GameSettings> = {
  targetScore: 10000,
  entryThreshold: 650,
  maxTurnTimer: 60,
};

function loadSavedSettings(): Partial<GameSettings> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Partial<GameSettings>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage errors
  }
}

export function CreateGame({ onGameCreated, onCancel }: CreateGameProps) {
  const [settings, setSettings] = useState<Partial<GameSettings>>(loadSavedSettings);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const result = await api.createGame(settings);
      onGameCreated(result.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--space-5)' }}>Create Game</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Target Score */}
        <div>
          <label
            htmlFor="targetScore"
            style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            Target Score
          </label>
          <select
            id="targetScore"
            value={settings.targetScore}
            onChange={(e) =>
              setSettings({ ...settings, targetScore: Number(e.target.value) })
            }
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            <option value={5000}>5,000 (Quick)</option>
            <option value={10000}>10,000 (Standard)</option>
            <option value={15000}>15,000 (Long)</option>
            <option value={20000}>20,000 (Marathon)</option>
          </select>
        </div>

        {/* Entry Threshold */}
        <div>
          <label
            htmlFor="entryThreshold"
            style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            Entry Threshold
          </label>
          <select
            id="entryThreshold"
            value={settings.entryThreshold}
            onChange={(e) =>
              setSettings({ ...settings, entryThreshold: Number(e.target.value) })
            }
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            <option value={500}>500 (Easy)</option>
            <option value={650}>650 (Standard)</option>
            <option value={800}>800 (Hard)</option>
            <option value={1000}>1,000 (Expert)</option>
          </select>
        </div>

        {/* Turn Timer */}
        <div>
          <label
            htmlFor="turnTimer"
            style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            Turn Timer (Maximum)
          </label>
          <select
            id="turnTimer"
            value={settings.maxTurnTimer}
            onChange={(e) =>
              setSettings({ ...settings, maxTurnTimer: Number(e.target.value) })
            }
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            {TIMER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p
            style={{
              marginTop: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Players can set shorter personal timers
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
            disabled={isCreating}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={isCreating}
            style={{ flex: 1 }}
          >
            {isCreating ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
}

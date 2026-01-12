/**
 * Create Game Component
 * Form to create a new multiplayer game with settings
 * Visual design based on Figma mockups with option grids
 */

import { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import type { GameSettings } from '../../types/index.js';

interface CreateGameProps {
  onGameCreated: (code: string) => void;
  onCancel: () => void;
}

const TARGET_SCORES = [
  { value: 5000, label: '5,000', tag: 'Quick' },
  { value: 10000, label: '10,000', tag: 'Standard' },
  { value: 15000, label: '15,000', tag: 'Long' },
  { value: 20000, label: '20,000', tag: 'Marathon' },
];

const ENTRY_THRESHOLDS = [
  { value: 0, label: 'None', tag: 'Beginner' },
  { value: 500, label: '500', tag: 'Easy' },
  { value: 650, label: '650', tag: 'Standard' },
  { value: 1000, label: '1,000', tag: 'Challenge' },
];

const TURN_TIMERS = [
  { value: 0, label: 'No Timer', tag: 'Relaxed' },
  { value: 30, label: '30 sec', tag: 'Fast' },
  { value: 60, label: '1 min', tag: 'Standard' },
  { value: 120, label: '2 min', tag: 'Thoughtful' },
];

const STORAGE_KEY = 'greedy-game-settings';

const DEFAULT_SETTINGS: Partial<GameSettings> = {
  targetScore: 10000,
  entryThreshold: 650,
  maxTurnTimer: 0,
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

  // Option button component for grid selection
  const OptionButton = ({
    selected,
    onClick,
    label,
    tag,
    color,
  }: {
    selected: boolean;
    onClick: () => void;
    label: string;
    tag: string;
    color: 'emerald' | 'blue' | 'purple';
  }) => {
    const colors = {
      emerald: {
        border: selected ? '#10b981' : 'var(--color-border)',
        bg: selected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.5)',
        shadow: selected ? '0 0 0 4px rgba(16, 185, 129, 0.1)' : 'none',
      },
      blue: {
        border: selected ? '#3b82f6' : 'var(--color-border)',
        bg: selected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 41, 59, 0.5)',
        shadow: selected ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
      },
      purple: {
        border: selected ? '#8b5cf6' : 'var(--color-border)',
        bg: selected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(30, 41, 59, 0.5)',
        shadow: selected ? '0 0 0 4px rgba(139, 92, 246, 0.1)' : 'none',
      },
    };

    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-xl)',
          border: `2px solid ${colors[color].border}`,
          backgroundColor: colors[color].bg,
          boxShadow: colors[color].shadow,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text)',
          marginBottom: 'var(--space-1)',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}>
          {tag}
        </div>
      </button>
    );
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={onCancel}
        disabled={isCreating}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--font-size-sm)',
          padding: 0,
          marginBottom: 'var(--space-4)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-2)',
        }}>
          Create Game
        </h2>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-base)',
        }}>
          Set up your game preferences
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Target Score */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
              Target Score
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--space-3)',
          }}>
            {TARGET_SCORES.map((option) => (
              <OptionButton
                key={option.value}
                selected={settings.targetScore === option.value}
                onClick={() => setSettings({ ...settings, targetScore: option.value })}
                label={option.label}
                tag={option.tag}
                color="emerald"
              />
            ))}
          </div>
        </div>

        {/* Entry Threshold */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
              Entry Threshold
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--space-3)',
          }}>
            {ENTRY_THRESHOLDS.map((option) => (
              <OptionButton
                key={option.value}
                selected={settings.entryThreshold === option.value}
                onClick={() => setSettings({ ...settings, entryThreshold: option.value })}
                label={option.label}
                tag={option.tag}
                color="blue"
              />
            ))}
          </div>
        </div>

        {/* Turn Timer */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
              Turn Timer (Maximum)
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--space-3)',
          }}>
            {TURN_TIMERS.map((option) => (
              <OptionButton
                key={option.value}
                selected={settings.maxTurnTimer === option.value}
                onClick={() => setSettings({ ...settings, maxTurnTimer: option.value })}
                label={option.label}
                tag={option.tag}
                color="purple"
              />
            ))}
          </div>
          {/* Info box */}
          <div style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}>
              Players can set shorter personal timers during the game
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: 'var(--space-3)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: '#ef4444',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-2)',
        }}>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isCreating}
            style={{
              flex: 1,
              padding: 'var(--space-4)',
            }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={isCreating}
            style={{
              flex: 1,
              padding: 'var(--space-4)',
            }}
          >
            {isCreating ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
}

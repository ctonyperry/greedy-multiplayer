/**
 * useActiveGames Hook
 * Persists active game codes in localStorage for session recovery
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import type { Game } from '../types/index.js';

const STORAGE_KEY = 'greedy_active_games';

interface ActiveGame {
  code: string;
  lastAccessedAt: string;
}

interface ActiveGameWithDetails extends ActiveGame {
  game?: Game;
  isValid: boolean;
}

interface UseActiveGamesReturn {
  activeGames: ActiveGameWithDetails[];
  isLoading: boolean;
  addGame: (code: string) => void;
  removeGame: (code: string) => void;
  refreshGames: () => Promise<void>;
}

export function useActiveGames(): UseActiveGamesReturn {
  const [activeGames, setActiveGames] = useState<ActiveGameWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: ActiveGame[] = JSON.parse(stored);
        // Convert to ActiveGameWithDetails with isValid = true initially
        setActiveGames(parsed.map(g => ({ ...g, isValid: true })));
      } catch (e) {
        console.error('Failed to parse active games from storage:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage when games change
  const saveToStorage = useCallback((games: ActiveGameWithDetails[]) => {
    const toStore: ActiveGame[] = games
      .filter(g => g.isValid)
      .map(({ code, lastAccessedAt }) => ({ code, lastAccessedAt }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }, []);

  // Add a game to the list
  const addGame = useCallback((code: string) => {
    setActiveGames(prev => {
      // Check if already exists
      const existing = prev.find(g => g.code === code);
      if (existing) {
        // Update lastAccessedAt
        const updated = prev.map(g =>
          g.code === code
            ? { ...g, lastAccessedAt: new Date().toISOString() }
            : g
        );
        saveToStorage(updated);
        return updated;
      }

      // Add new game
      const newGame: ActiveGameWithDetails = {
        code,
        lastAccessedAt: new Date().toISOString(),
        isValid: true,
      };
      const updated = [...prev, newGame];
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Remove a game from the list
  const removeGame = useCallback((code: string) => {
    setActiveGames(prev => {
      const updated = prev.filter(g => g.code !== code);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Refresh games from server to validate they still exist
  const refreshGames = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentGames = activeGames.filter(g => g.isValid);
      const validatedGames: ActiveGameWithDetails[] = [];

      for (const game of currentGames) {
        try {
          const gameDetails = await api.getGame(game.code);
          // Only keep games that are still in 'waiting' or 'playing' status
          if (gameDetails.status === 'waiting' || gameDetails.status === 'playing') {
            validatedGames.push({
              ...game,
              game: gameDetails,
              isValid: true,
            });
          }
        } catch (e) {
          // Game doesn't exist or error fetching - mark as invalid
          console.log(`Game ${game.code} no longer valid`);
        }
      }

      setActiveGames(validatedGames);
      saveToStorage(validatedGames);
    } catch (e) {
      console.error('Failed to refresh active games:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeGames, saveToStorage]);

  return {
    activeGames,
    isLoading,
    addGame,
    removeGame,
    refreshGames,
  };
}

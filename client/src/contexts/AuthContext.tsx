/**
 * Authentication Context
 * Provides auth state and methods throughout the app
 * Supports Firebase Google Sign-In and guest login
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  initializeFirebase,
  signInWithGoogle,
  signOutFirebase,
  onAuthChange,
  getIdToken,
  type FirebaseUser,
} from '../services/firebase.js';
import { generateName } from '../utils/nameGenerator.js';

// User type
interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  isGuest?: boolean;
}

// Guest session storage key
const GUEST_SESSION_KEY = 'greedy_guest_session';

// Auth context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
  login: () => Promise<void>;
  loginAsGuest: (name?: string) => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  updateDisplayName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Convert Firebase user to our User type
 */
function firebaseUserToUser(fbUser: FirebaseUser): User {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || 'Player',
    email: fbUser.email || '',
    photoUrl: fbUser.photoURL,
  };
}

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Initialize Firebase and listen for auth changes
  useEffect(() => {
    initializeFirebase();

    // Check for existing guest session first
    try {
      const guestSession = localStorage.getItem(GUEST_SESSION_KEY);
      if (guestSession) {
        const guestUser = JSON.parse(guestSession) as User;
        setUser(guestUser);
        setIsGuest(true);
        setIsLoading(false);
        return;
      }
    } catch {
      localStorage.removeItem(GUEST_SESSION_KEY);
    }

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthChange((fbUser) => {
      if (fbUser) {
        setUser(firebaseUserToUser(fbUser));
        setIsGuest(false);
        // Clear any guest session when logging in with Google
        localStorage.removeItem(GUEST_SESSION_KEY);
      } else {
        // Only clear user if not a guest
        if (!isGuest) {
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Login with Google
   */
  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      const fbUser = await signInWithGoogle();
      setUser(firebaseUserToUser(fbUser));
      setIsGuest(false);
      localStorage.removeItem(GUEST_SESSION_KEY);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login as guest
   */
  const loginAsGuest = useCallback((name?: string) => {
    const guestUser: User = {
      id: `guest-${crypto.randomUUID()}`,
      name: name || generateName(),
      email: '',
      isGuest: true,
    };

    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
    setIsGuest(true);

    console.log(`Logged in as guest: ${guestUser.name}`);
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    if (isGuest) {
      localStorage.removeItem(GUEST_SESSION_KEY);
      setUser(null);
      setIsGuest(false);
      return;
    }

    try {
      await signOutFirebase();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [isGuest]);

  /**
   * Get access token for API calls
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (isGuest && user) {
      return `guest:${user.id}:${user.name}`;
    }
    return getIdToken();
  }, [user, isGuest]);

  /**
   * Update display name (for guests)
   */
  const updateDisplayName = useCallback((name: string) => {
    if (!user) return;

    const updatedUser = { ...user, name };
    setUser(updatedUser);

    if (isGuest) {
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(updatedUser));
    }
  }, [user, isGuest]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isGuest,
    login,
    loginAsGuest,
    logout,
    getAccessToken,
    updateDisplayName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

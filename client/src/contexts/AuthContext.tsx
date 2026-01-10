/**
 * Authentication Context
 * Provides auth state and methods throughout the app
 * Supports both Azure AD B2C and guest login for local development
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
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { msalConfig, loginRequest, isAuthConfigured } from '../services/authConfig.js';
import { generateName } from '../utils/nameGenerator.js';

// User type
interface User {
  id: string;
  name: string;
  email: string;
  isGuest?: boolean;
}

// Guest session storage key
const GUEST_SESSION_KEY = 'greedy_guest_session';

// Auth context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  isGuest: boolean;
  login: () => Promise<void>;
  loginAsGuest: (name?: string) => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// MSAL instance (singleton)
let msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication | null {
  if (!isAuthConfigured()) {
    return null;
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }

  return msalInstance;
}

/**
 * Convert MSAL account to User
 */
function accountToUser(account: AccountInfo): User {
  return {
    id: account.localAccountId || account.homeAccountId,
    name: account.name || 'User',
    email: account.username || '',
  };
}

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured] = useState(isAuthConfigured());
  const [isGuest, setIsGuest] = useState(false);

  // Initialize - check for guest session first, then MSAL
  useEffect(() => {
    async function initialize() {
      // Check for existing guest session
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

      // Initialize MSAL if configured
      const msal = getMsalInstance();

      if (!msal) {
        setIsLoading(false);
        return;
      }

      try {
        // Handle redirect response (if returning from login)
        await msal.initialize();
        const response = await msal.handleRedirectPromise();

        if (response) {
          setUser(accountToUser(response.account!));
        } else {
          // Check for existing session
          const accounts = msal.getAllAccounts();
          if (accounts.length > 0) {
            setUser(accountToUser(accounts[0]));
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, []);

  /**
   * Login with redirect (Azure AD B2C)
   */
  const login = useCallback(async () => {
    const msal = getMsalInstance();
    if (!msal) {
      console.warn('Auth not configured');
      return;
    }

    try {
      await msal.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  /**
   * Login as guest (for local development/testing)
   */
  const loginAsGuest = useCallback((name?: string) => {
    const guestUser: User = {
      id: `guest-${crypto.randomUUID()}`,
      name: name || generateName(),
      email: '',
      isGuest: true,
    };

    // Store in localStorage for persistence
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
    setIsGuest(true);

    console.log(`🎮 Logged in as guest: ${guestUser.name}`);
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    // Clear guest session if exists
    if (isGuest) {
      localStorage.removeItem(GUEST_SESSION_KEY);
      setUser(null);
      setIsGuest(false);
      return;
    }

    // MSAL logout
    const msal = getMsalInstance();
    if (!msal) return;

    try {
      await msal.logoutRedirect();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [isGuest]);

  /**
   * Get access token for API calls
   * For guests, returns a pseudo-token with user info
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // For guests, return a pseudo-token (the server will use socket auth instead)
    if (isGuest && user) {
      return `guest:${user.id}:${user.name}`;
    }

    const msal = getMsalInstance();
    if (!msal || !user) return null;

    try {
      const accounts = msal.getAllAccounts();
      if (accounts.length === 0) return null;

      const response: AuthenticationResult = await msal.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      return response.accessToken;
    } catch (error) {
      console.error('Token acquisition error:', error);

      // Try interactive login if silent fails
      try {
        await msal.loginRedirect(loginRequest);
        return null;
      } catch {
        return null;
      }
    }
  }, [user, isGuest]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isConfigured,
    isGuest,
    login,
    loginAsGuest,
    logout,
    getAccessToken,
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

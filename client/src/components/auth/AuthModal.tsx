/**
 * Authentication Modal
 * Provides Google Sign-In, Email/Password, and Guest options
 * Visual design based on Figma mockups
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { generateName } from '../../utils/nameGenerator.js';

type AuthMode = 'options' | 'email-signin' | 'email-signup' | 'guest';

interface AuthModalProps {
  onClose?: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { loginWithGoogle, loginWithEmail, signUpWithEmail, loginAsGuest, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('options');
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [guestName, setGuestName] = useState('');

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setError('Sign-in cancelled');
      } else if (msg.includes('popup-blocked')) {
        setError('Popup blocked - please allow popups');
      } else {
        setError(`Sign-in failed: ${msg}`);
      }
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await loginWithEmail(email, password);
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setError('Invalid email or password');
      } else if (msg.includes('invalid-email')) {
        setError('Invalid email address');
      } else {
        setError(`Sign-in failed: ${msg}`);
      }
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    try {
      await signUpWithEmail(email, password, displayName.trim());
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        setError('Email already in use');
      } else if (msg.includes('invalid-email')) {
        setError('Invalid email address');
      } else if (msg.includes('weak-password')) {
        setError('Password is too weak');
      } else {
        setError(`Sign-up failed: ${msg}`);
      }
    }
  };

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError('Please enter a name');
      return;
    }
    loginAsGuest(guestName.trim());
    onClose?.();
  };

  const handleGenerateRandomName = () => {
    setGuestName(generateName());
  };

  // Figma-inspired styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    maxWidth: '400px',
    margin: '0 auto',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-xl)',
    border: '2px solid var(--color-border)',
    background: 'rgba(30, 41, 59, 0.5)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-base)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  };

  const inputFocusStyle = {
    borderColor: '#10b981',
  };

  // Main options view
  if (mode === 'options') {
    return (
      <div style={containerStyle}>
        {/* Header */}
        <p style={{
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-lg)',
          margin: '0 0 var(--space-4) 0',
        }}>
          Sign in to compete with friends
        </p>

        {error && (
          <div style={{
            padding: 'var(--space-3)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: '#ef4444',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
          }}>
            {error}
          </div>
        )}

        {/* Auth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Google Sign-In - White button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="btn"
            style={{
              width: '100%',
              padding: 'var(--space-4)',
              background: 'white',
              color: '#111827',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              fontWeight: 'var(--font-weight-semibold)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Email Sign-In - Blue gradient */}
          <button
            onClick={() => setMode('email-signin')}
            disabled={isLoading}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
            Continue with Email
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: 'var(--space-2) 0',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          </div>

          {/* Guest - Slate with border */}
          <button
            onClick={() => setMode('guest')}
            disabled={isLoading}
            className="btn btn-ghost"
            style={{
              width: '100%',
              padding: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Play as Guest
          </button>
        </div>

        {/* Footer text */}
        <p style={{
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-xs)',
          marginTop: 'var(--space-2)',
        }}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    );
  }

  // Email Sign-In view
  if (mode === 'email-signin') {
    return (
      <div style={containerStyle}>
        {/* Back button */}
        <button
          onClick={() => { setMode('options'); setError(null); }}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-sm)',
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
          <h2 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            margin: 0,
          }}>
            Sign In
          </h2>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-3)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: '#ef4444',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', padding: 'var(--space-4)' }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', margin: 0 }}>
          Don't have an account?{' '}
          <button
            onClick={() => { setMode('email-signup'); setError(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontSize: 'inherit',
            }}
          >
            Sign up
          </button>
        </p>
      </div>
    );
  }

  // Email Sign-Up view
  if (mode === 'email-signup') {
    return (
      <div style={containerStyle}>
        {/* Back button */}
        <button
          onClick={() => { setMode('options'); setError(null); }}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-sm)',
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
          <h2 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            margin: 0,
          }}>
            Create Account
          </h2>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-3)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: '#ef4444',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
            onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', padding: 'var(--space-4)' }}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', margin: 0 }}>
          Already have an account?{' '}
          <button
            onClick={() => { setMode('email-signin'); setError(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontSize: 'inherit',
            }}
          >
            Sign in
          </button>
        </p>
      </div>
    );
  }

  // Guest view
  if (mode === 'guest') {
    return (
      <div style={containerStyle}>
        {/* Back button */}
        <button
          onClick={() => { setMode('options'); setError(null); }}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-sm)',
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
          <h2 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            margin: '0 0 var(--space-2) 0',
          }}>
            Play as Guest
          </h2>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
            margin: 0,
          }}>
            Choose a name to get started
          </p>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-3)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: '#ef4444',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleGuestLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{
              display: 'block',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--space-2)',
              marginLeft: 'var(--space-1)',
            }}>
              Your name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              maxLength={20}
              autoFocus
              style={inputStyle}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          {/* Random name generator */}
          <button
            type="button"
            onClick={handleGenerateRandomName}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              padding: 'var(--space-2)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
              <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1z" />
              <path d="M18 14l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
            </svg>
            Generate random name
          </button>

          <button
            type="submit"
            disabled={isLoading || !guestName.trim()}
            className="btn btn-primary"
            style={{ width: '100%', padding: 'var(--space-4)' }}
          >
            Start Playing
          </button>
        </form>

        {/* Info box */}
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            margin: 0,
            textAlign: 'center',
          }}>
            As a guest, your progress won't be saved. Sign in to keep your achievements!
          </p>
        </div>
      </div>
    );
  }

  return null;
}

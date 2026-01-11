/**
 * Authentication Modal
 * Provides Google Sign-In, Email/Password, and Guest options
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';

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

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    maxWidth: '320px',
    margin: '0 auto',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    width: '100%',
    padding: 'var(--space-3)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-base)',
  };

  const dividerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    color: 'var(--color-text-muted)',
    fontSize: 'var(--font-size-sm)',
  };

  const lineStyle: React.CSSProperties = {
    flex: 1,
    height: '1px',
    background: 'var(--color-border)',
  };

  // Main options view
  if (mode === 'options') {
    return (
      <div style={containerStyle}>
        <h2 style={{ textAlign: 'center', margin: 0 }}>Welcome to Greedy</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', margin: 0 }}>
          Sign in to save your progress
        </p>

        {error && (
          <p style={{ color: 'var(--color-error, #ef4444)', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="btn btn-secondary"
          style={buttonStyle}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {isLoading ? 'Signing in...' : 'Continue with Google'}
        </button>

        {/* Email Sign-In */}
        <button
          onClick={() => setMode('email-signin')}
          disabled={isLoading}
          className="btn btn-secondary"
          style={buttonStyle}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 6l-10 7L2 6" />
          </svg>
          Continue with Email
        </button>

        <div style={dividerStyle}>
          <div style={lineStyle} />
          <span>or</span>
          <div style={lineStyle} />
        </div>

        {/* Guest */}
        <button
          onClick={() => setMode('guest')}
          disabled={isLoading}
          className="btn btn-ghost"
          style={buttonStyle}
        >
          Play as Guest
        </button>
      </div>
    );
  }

  // Email Sign-In view
  if (mode === 'email-signin') {
    return (
      <div style={containerStyle}>
        <button
          onClick={() => { setMode('options'); setError(null); }}
          className="btn btn-ghost"
          style={{ alignSelf: 'flex-start', padding: 'var(--space-1)' }}
        >
          ← Back
        </button>

        <h2 style={{ textAlign: 'center', margin: 0 }}>Sign In</h2>

        {error && (
          <p style={{ color: 'var(--color-error, #ef4444)', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <form onSubmit={handleEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={buttonStyle}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', margin: 0 }}>
          Don't have an account?{' '}
          <button
            onClick={() => { setMode('email-signup'); setError(null); }}
            className="btn btn-ghost"
            style={{ padding: 0, textDecoration: 'underline' }}
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
        <button
          onClick={() => { setMode('options'); setError(null); }}
          className="btn btn-ghost"
          style={{ alignSelf: 'flex-start', padding: 'var(--space-1)' }}
        >
          ← Back
        </button>

        <h2 style={{ textAlign: 'center', margin: 0 }}>Create Account</h2>

        {error && (
          <p style={{ color: 'var(--color-error, #ef4444)', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <form onSubmit={handleEmailSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={buttonStyle}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', margin: 0 }}>
          Already have an account?{' '}
          <button
            onClick={() => { setMode('email-signin'); setError(null); }}
            className="btn btn-ghost"
            style={{ padding: 0, textDecoration: 'underline' }}
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
        <button
          onClick={() => { setMode('options'); setError(null); }}
          className="btn btn-ghost"
          style={{ alignSelf: 'flex-start', padding: 'var(--space-1)' }}
        >
          ← Back
        </button>

        <h2 style={{ textAlign: 'center', margin: 0 }}>Play as Guest</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', margin: 0 }}>
          Enter a name to get started
        </p>

        {error && (
          <p style={{ color: 'var(--color-error, #ef4444)', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <form onSubmit={handleGuestLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input
            type="text"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
            maxLength={20}
            autoFocus
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={buttonStyle}
          >
            Start Playing
          </button>
        </form>
      </div>
    );
  }

  return null;
}

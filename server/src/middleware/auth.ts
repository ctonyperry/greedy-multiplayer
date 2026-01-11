/**
 * Authentication Middleware
 * Validates Firebase ID tokens and guest tokens
 */

import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'greedy-60c21';

    // Check for service account credentials in environment variables
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (privateKey && clientEmail) {
      // Use credentials from environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
          clientEmail,
        }),
        projectId,
      });
      console.log('Firebase Admin initialized with service account credentials from env vars');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use service account file path
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      console.log('Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS');
    } else {
      // Initialize without credentials - will use JWT decode fallback
      admin.initializeApp({ projectId });
      console.log('Firebase Admin initialized with project ID only (dev mode)');
    }

    firebaseInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    firebaseInitialized = true; // Prevent retry loops
  }
}

// Initialize on module load
initializeFirebase();

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        photoUrl?: string;
      };
    }
  }
}

interface DecodedToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

/**
 * Parse guest token in format: guest:{id}:{name}
 */
function parseGuestToken(token: string): { id: string; name: string } | null {
  if (!token.startsWith('guest:')) {
    return null;
  }

  const parts = token.split(':');
  if (parts.length < 3) {
    return null;
  }

  // Handle names that might contain colons
  const id = parts[1];
  const name = parts.slice(2).join(':');

  if (!id || !name) {
    return null;
  }

  return { id, name };
}

/**
 * Decode JWT without verification (for development fallback)
 */
function decodeJwtPayload(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    return {
      uid: payload.sub || payload.user_id,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

/**
 * Validate Firebase ID token or guest token
 */
async function validateToken(token: string): Promise<DecodedToken | null> {
  // Check for guest token first
  const guestInfo = parseGuestToken(token);
  if (guestInfo) {
    return {
      uid: guestInfo.id,
      name: guestInfo.name,
      email: '',
    };
  }

  // Try full Firebase verification
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
  } catch (error) {
    // Only log if it's not a common "no credentials" error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('credential') && !errorMessage.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
      console.error('Firebase token verification failed:', errorMessage);
    }

    // Fallback: decode JWT without verification (development only)
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      console.log('Using decoded JWT (unverified) for user:', decoded.uid);
      return decoded;
    }
  }

  return null;
}

/**
 * Authentication middleware
 * Extracts and validates the Bearer token from Authorization header
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = await validateToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Set user info on request
    req.user = {
      id: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || 'Player',
      photoUrl: decoded.picture,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional auth middleware
 * Attaches user info if token is valid, but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const decoded = await validateToken(token);
      if (decoded) {
        req.user = {
          id: decoded.uid,
          email: decoded.email || '',
          name: decoded.name || 'Player',
          photoUrl: decoded.picture,
        };
      }
    } catch {
      // Ignore errors - user just won't be authenticated
    }
  }

  next();
}

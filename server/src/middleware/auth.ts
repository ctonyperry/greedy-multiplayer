/**
 * Authentication Middleware
 * Validates Azure AD B2C JWT tokens
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

interface AzureADB2CToken {
  sub: string; // User ID
  emails?: string[];
  name?: string;
  given_name?: string;
  family_name?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Get Azure AD B2C configuration from environment
 */
function getB2CConfig() {
  return {
    tenantName: process.env.AZURE_AD_B2C_TENANT_NAME || '',
    clientId: process.env.AZURE_AD_B2C_CLIENT_ID || '',
    policyName: process.env.AZURE_AD_B2C_POLICY_NAME || 'B2C_1_signupsignin',
  };
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
 * Validate JWT token from Azure AD B2C
 * In production, this should verify the token signature against Azure AD B2C JWKS
 */
async function validateToken(token: string): Promise<AzureADB2CToken | null> {
  const config = getB2CConfig();

  // Check for guest token first
  const guestInfo = parseGuestToken(token);
  if (guestInfo) {
    // Return a synthetic token payload for guests
    return {
      sub: guestInfo.id,
      name: guestInfo.name,
      emails: [],
      iss: 'guest',
      aud: 'guest',
      exp: Date.now() / 1000 + 86400, // 24 hours from now
      iat: Date.now() / 1000,
    };
  }

  // For development, if no B2C config, just decode without verification
  if (!config.tenantName || !config.clientId) {
    console.warn('Azure AD B2C not configured - skipping token verification');
    try {
      const decoded = jwt.decode(token) as AzureADB2CToken;
      return decoded;
    } catch {
      return null;
    }
  }

  // In production, verify against Azure AD B2C JWKS
  // This is a simplified version - full implementation would fetch JWKS and verify
  try {
    // Expected issuer format for Azure AD B2C
    const expectedIssuer = `https://${config.tenantName}.b2clogin.com/${config.tenantName}.onmicrosoft.com/${config.policyName}/v2.0/`;

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      return null;
    }

    const payload = decoded.payload as AzureADB2CToken;

    // Basic validation
    if (payload.aud !== config.clientId) {
      console.warn('Token audience mismatch');
      return null;
    }

    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.warn('Token expired');
      return null;
    }

    // Note: Full implementation would verify signature against JWKS
    // For now, we trust the token if it passes basic checks
    return payload;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
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
      id: decoded.sub,
      email: decoded.emails?.[0] || '',
      name: decoded.name || decoded.given_name || 'User',
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
          id: decoded.sub,
          email: decoded.emails?.[0] || '',
          name: decoded.name || decoded.given_name || 'User',
        };
      }
    } catch {
      // Ignore errors - user just won't be authenticated
    }
  }

  next();
}

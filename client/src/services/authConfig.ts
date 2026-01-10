/**
 * MSAL Configuration for Azure AD B2C
 */

import type { Configuration, RedirectRequest } from '@azure/msal-browser';

// Azure AD B2C configuration from environment variables
const B2C_TENANT_NAME = import.meta.env.VITE_B2C_TENANT_NAME || 'greedyb2c';
const B2C_CLIENT_ID = import.meta.env.VITE_B2C_CLIENT_ID || '';
const B2C_POLICY_NAME = import.meta.env.VITE_B2C_POLICY_NAME || 'B2C_1_signupsignin';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || window.location.origin;

/**
 * MSAL configuration object
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: B2C_CLIENT_ID,
    authority: `https://${B2C_TENANT_NAME}.b2clogin.com/${B2C_TENANT_NAME}.onmicrosoft.com/${B2C_POLICY_NAME}`,
    knownAuthorities: [`${B2C_TENANT_NAME}.b2clogin.com`],
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

/**
 * Scopes for login request
 */
export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
};

/**
 * Check if auth is configured
 */
export function isAuthConfigured(): boolean {
  return !!B2C_CLIENT_ID;
}

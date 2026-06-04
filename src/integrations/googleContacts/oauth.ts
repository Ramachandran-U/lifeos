import { createGoogleOAuthClient } from '@/integrations/google/oauth';

/**
 * Read-only Google Contacts (People API) — used to import contacts + birthdays
 * into the Social engine. Reuses the shared Google PKCE driver (same recipe as
 * Calendar/Fit/Gmail/YouTube); token exchange runs server-side on the Worker.
 * Web-only.
 */
export const CONTACTS_SCOPES = 'https://www.googleapis.com/auth/contacts.readonly';

const client = createGoogleOAuthClient({
  scopes: CONTACTS_SCOPES,
  tokenKey: 'lifeos_gcontacts_tokens',
  verifierKey: 'lifeos_gcontacts_pkce_verifier',
  redirectPath: '/google-contacts-callback',
});

export const startContactsOAuth = client.start;
export const handleContactsCallback = client.complete;
export const clearContactsTokens = client.clear;
export const isContactsConnected = client.isConnected;
export const getContactsAccessToken = client.getAccessToken;
export const consumeContactsReturnPath = client.consumeReturnPath;

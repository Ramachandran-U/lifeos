jest.mock('@/integrations/google/oauth', () => ({
  createGoogleOAuthClient: jest.fn(() => ({
    start: jest.fn(),
    complete: jest.fn(),
    clear: jest.fn(),
    isConnected: jest.fn(),
    getAccessToken: jest.fn(),
    consumeReturnPath: jest.fn(),
  })),
}));

import { createGoogleOAuthClient } from '@/integrations/google/oauth';
import * as oauth from '../oauth';

const createMock = createGoogleOAuthClient as jest.MockedFunction<typeof createGoogleOAuthClient>;

describe('googleContacts/oauth binding', () => {
  it('requests only the read-only Contacts (People API) scope', () => {
    expect(oauth.CONTACTS_SCOPES).toBe('https://www.googleapis.com/auth/contacts.readonly');
  });

  it('binds the shared PKCE driver with its own token bucket + callback path', () => {
    expect(createMock).toHaveBeenCalledWith({
      scopes: oauth.CONTACTS_SCOPES,
      tokenKey: 'lifeos_gcontacts_tokens',
      verifierKey: 'lifeos_gcontacts_pkce_verifier',
      redirectPath: '/google-contacts-callback',
    });
  });

  it('re-exports the bound OAuth surface as functions', () => {
    expect(typeof oauth.startContactsOAuth).toBe('function');
    expect(typeof oauth.handleContactsCallback).toBe('function');
    expect(typeof oauth.clearContactsTokens).toBe('function');
    expect(typeof oauth.isContactsConnected).toBe('function');
    expect(typeof oauth.getContactsAccessToken).toBe('function');
    expect(typeof oauth.consumeContactsReturnPath).toBe('function');
  });
});

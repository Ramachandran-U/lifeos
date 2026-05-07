import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase, isSupabaseConfigured } from './client';

export interface AuthResult {
  userId: string;
  email: string;
  name: string;
}

function assertConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  assertConfigured();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-up did not return a user.');
  return {
    userId: data.user.id,
    email: data.user.email ?? email,
    name: (data.user.user_metadata?.name as string | undefined) ?? name,
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  assertConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-in did not return a user.');
  return {
    userId: data.user.id,
    email: data.user.email ?? email,
    name: (data.user.user_metadata?.name as string | undefined) ?? email.split('@')[0],
  };
}

export async function signInWithApple(): Promise<AuthResult> {
  assertConfigured();
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS.');
  }
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Apple sign-in did not return a user.');

  // Apple only sends fullName on first sign-up. Persist it if provided.
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const name =
    (data.user.user_metadata?.name as string | undefined) ||
    fullName ||
    (data.user.email ?? 'friend').split('@')[0];
  if (fullName && !data.user.user_metadata?.name) {
    await supabase.auth.updateUser({ data: { name } });
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    name,
  };
}

/**
 * Web-only. Kicks off Supabase's hosted Google OAuth flow. Supabase handles the
 * redirect to Google, the callback, and code exchange — then redirects back to
 * `redirectTo` with the session in the URL hash (auto-consumed by supabase-js
 * because `detectSessionInUrl: true`).
 *
 * Google Cloud Console only needs Supabase's callback URL registered — the
 * app's own domain does not, so changing the deploy URL doesn't break sign-in.
 */
export async function startGoogleSupabaseOAuth(): Promise<void> {
  assertConfigured();
  if (typeof window === 'undefined') {
    throw new Error('Google sign-in is only available on web right now.');
  }
  const redirectTo = `${window.location.origin}/google-auth-callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, scopes: 'openid email profile' },
  });
  if (error) throw error;
}

export async function signInWithGoogleIdToken(idToken: string): Promise<AuthResult> {
  assertConfigured();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Google sign-in did not return a user.');
  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    name:
      (data.user.user_metadata?.name as string | undefined) ||
      (data.user.email ?? 'friend').split('@')[0],
  };
}

export async function signOut(): Promise<void> {
  assertConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

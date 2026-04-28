import { useRouter } from 'expo-router';
import { OAuthCallbackView } from '@/components/shared/OAuthCallbackView';
import { handleGoogleAuthCallback } from '@/integrations/googleAuth/oauth';
import { fetchGoogleProfile } from '@/integrations/googleAuth/client';
import { upsertGoogleUser, getUserByEmail, setWebSession } from '@/db/queries/users';
import { useUserStore } from '@/store/useUserStore';

export default function GoogleAuthCallbackScreen() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);

  let resolvedDest = '/(tabs)';

  return (
    <OAuthCallbackView
      router={router}
      exchange={handleGoogleAuthCallback}
      onSuccess={async (clientId) => {
        const profile = await fetchGoogleProfile(clientId);
        const userId = await upsertGoogleUser({ email: profile.email, name: profile.name });
        setWebSession(userId);
        const user = getUserByEmail(profile.email);
        if (user) {
          setUser(user.id, user.name, user.email, user.onboardingStage);
          resolvedDest = user.onboardingStage === 0 ? '/welcome-intent' : '/(tabs)';
        }
      }}
      redirectTo={() => resolvedDest}
      redirectDelayMs={400}
      workingTitle="Signing you in with Google..."
      okTitle="Signed in"
      okSubtitle="Redirecting…"
      errorTitle="Sign-in failed"
      nativeUnsupportedMsg="Google sign-in is only supported on web right now."
    />
  );
}

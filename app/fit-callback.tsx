import { useRouter } from 'expo-router';
import { OAuthCallbackView } from '@/components/shared/OAuthCallbackView';
import { handleFitCallback } from '@/integrations/googleFit/oauth';

export default function FitCallbackScreen() {
  const router = useRouter();
  return (
    <OAuthCallbackView
      router={router}
      exchange={handleFitCallback}
      redirectTo={() => '/(tabs)/health'}
      workingTitle="Connecting Google Fit..."
      okTitle="Connected"
      okSubtitle="Redirecting to Health..."
      errorTitle="Connection failed"
      nativeUnsupportedMsg="Google Fit sign-in is only supported on web right now."
    />
  );
}

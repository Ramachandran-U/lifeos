import { useRouter } from 'expo-router';
import { OAuthCallbackView } from '@/components/shared/OAuthCallbackView';
import { handleOAuthCallback } from '@/finance/gmail/oauth';
import { takeOAuthReturnPath } from '@/integrations/google/oauthReturnPath';

export default function GmailCallbackScreen() {
  const router = useRouter();
  return (
    <OAuthCallbackView
      router={router}
      workingTitle="Connecting Gmail..."
      okTitle="Connected"
      okSubtitle="Taking you back…"
      errorTitle="Connection failed"
      nativeUnsupportedMsg="Gmail sign-in is only supported on web right now."
      exchange={handleOAuthCallback}
      redirectTo={() => takeOAuthReturnPath('/(tabs)/finance')}
    />
  );
}

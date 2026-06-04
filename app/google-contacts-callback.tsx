import { useRouter } from 'expo-router';
import { OAuthCallbackView } from '@/components/shared/OAuthCallbackView';
import { handleContactsCallback, consumeContactsReturnPath } from '@/integrations/googleContacts/oauth';

export default function GoogleContactsCallbackScreen() {
  const router = useRouter();
  return (
    <OAuthCallbackView
      router={router}
      exchange={handleContactsCallback}
      redirectTo={() => consumeContactsReturnPath() ?? '/(tabs)/social'}
      workingTitle="Connecting Google Contacts..."
      okTitle="Connected"
      okSubtitle="Redirecting to Social..."
      errorTitle="Connection failed"
      nativeUnsupportedMsg="Google Contacts sign-in is only supported on web right now."
    />
  );
}

import { useRouter } from 'expo-router';
import { OAuthCallbackView } from '@/components/shared/OAuthCallbackView';
import { handleYouTubeCallback, consumeYouTubeReturnPath } from '@/integrations/youtube/oauth';

export default function YouTubeCallbackScreen() {
  const router = useRouter();
  return (
    <OAuthCallbackView
      router={router}
      exchange={handleYouTubeCallback}
      redirectTo={() => consumeYouTubeReturnPath() ?? '/(tabs)/explore'}
      workingTitle="Connecting YouTube..."
      okTitle="Connected"
      okSubtitle="Redirecting to Explore..."
      errorTitle="Connection failed"
      nativeUnsupportedMsg="YouTube sign-in is only supported on web right now."
    />
  );
}

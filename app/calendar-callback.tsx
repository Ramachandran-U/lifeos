import { useRouter } from 'expo-router';
import { OAuthCallbackView } from '@/components/shared/OAuthCallbackView';
import { handleCalendarCallback } from '@/integrations/googleCalendar/oauth';
import { takeOAuthReturnPath } from '@/integrations/google/oauthReturnPath';

export default function CalendarCallbackScreen() {
  const router = useRouter();
  return (
    <OAuthCallbackView
      router={router}
      exchange={handleCalendarCallback}
      redirectTo={() => takeOAuthReturnPath('/(tabs)')}
      workingTitle="Connecting Google Calendar..."
      okTitle="Connected"
      okSubtitle="Redirecting to Today..."
      errorTitle="Connection failed"
      nativeUnsupportedMsg="Google Calendar sign-in is only supported on web right now."
    />
  );
}

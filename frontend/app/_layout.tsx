import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { registerForPushNotifications } from "../utils/registerForPushNotifications";
import { getToken } from '../utils/token'
import { FETCH_USER_INFO_URL, SEND_EXPO_TOKEN_URL } from '../constants/api';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Register for push notifications on mount
  useEffect(() => {
    const registerAndSendToken = async () => {
      try {
        // 1. Register for push notifications
        const token = await registerForPushNotifications();
        console.log('Expo Push Token:', token);

        // 2. Send token to backend
        const authToken = await getToken();
        await fetch(SEND_EXPO_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ expoToken: token }),
        });
        console.log('Push token sent to backend');
      } catch (err) {
        console.warn('Push notification setup failed:', err);
      }
    };

    registerAndSendToken();

    // Listen for foreground notifications
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground notification received:', notification);
      alert(`Notification: ${notification.request.content.title}\n${notification.request.content.body}`);
    });

    // Listen for notification responses (when user taps)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

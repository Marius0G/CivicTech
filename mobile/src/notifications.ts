// Notifications service for handling push notifications and user preferences.
// Manages both iOS and Android permissions and notification handling.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Check if notifications are enabled in user preferences
 */
export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (stored === null) return true; // Default to enabled for new users
    return stored === 'true';
  } catch (err) {
    console.warn('Failed to get notifications preference:', err);
    return true;
  }
}

/**
 * Set the user's notification preference and request/revoke permissions accordingly
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');

    if (enabled) {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } else {
      // No need to explicitly revoke on most platforms; the preference being false is sufficient
      return true;
    }
  } catch (err) {
    console.warn('Failed to set notifications preference:', err);
    return false;
  }
}

/**
 * Get the current notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<string> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (err) {
    console.warn('Failed to get notification permission status:', err);
    return 'undetermined';
  }
}

/**
 * Register a listener for incoming notifications when the app is in foreground
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (notification: Notifications.Notification) => void
) {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    onNotificationReceived?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification tapped:', response.notification);
    onNotificationTapped?.(response.notification);
  });

  // Return cleanup function
  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * Send a local test notification (for demo/testing purposes)
 */
export async function sendTestNotification(title: string, body: string) {
  try {
    const enabled = await getNotificationsEnabled();
    if (!enabled) {
      console.log('Notifications are disabled in settings');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        badge: 1,
      },
      trigger: { seconds: 1 }, // Send after 1 second
    });
  } catch (err) {
    console.warn('Failed to send test notification:', err);
  }
}

/**
 * Get the push notification token (for sending push notifications from server)
 */
export async function getPushToken(): Promise<string | null> {
  try {
    const enabled = await getNotificationsEnabled();
    if (!enabled) {
      console.log('Notifications are disabled; not requesting token');
      return null;
    }

    // Get the Expo push token
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch (err) {
    console.warn('Failed to get push token:', err);
    return null;
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (err) {
    console.warn('Failed to clear notifications:', err);
  }
}

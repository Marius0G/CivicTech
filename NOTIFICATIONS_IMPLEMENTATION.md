# Notifications Implementation Guide

This document describes the push notification system implemented in the EU Youth Buddy mobile application.

## Overview

The notifications system allows users to:
- **Enable/disable** push notifications via the Profile settings screen
- **Receive** local and remote push notifications when notifications are enabled
- **Manage** notification preferences with persistent storage

## Architecture

### Components

1. **`src/notifications.ts`** - Core notification service
   - Handles permission requests (iOS/Android)
   - Manages notification preferences in AsyncStorage
   - Provides utilities for sending and receiving notifications
   - Exposes push token retrieval for server-side notifications

2. **`src/screens/ProfileScreen.tsx`** - Settings UI
   - Toggle for enabling/disabling notifications
   - Loads user preference on mount
   - Handles permission requests when toggling

3. **`App.tsx`** - Notification setup
   - Sets up notification listeners on app startup
   - Retrieves push token for server-side notifications
   - Handles foreground and background notification events

## Features

### User-Facing Features

- **Settings Toggle**: Users can enable/disable notifications in Profile > Push notifications
- **Permission Request**: First-time toggle automatically requests system permission (iOS/Android)
- **Persistent Preference**: User's choice is saved and restored on app restart

### Developer Features

- **Test Notifications**: `sendTestNotification()` for testing in development
- **Push Token Retrieval**: `getPushToken()` returns Expo token for server integration
- **Notification Listeners**: Custom handlers for foreground/background notifications
- **Permission Status**: Check current permission state with `getNotificationPermissionStatus()`

## Usage

### In Components

Toggle notifications in the Profile screen:

```tsx
const handleNotificationToggle = async () => {
  const newValue = !push;
  setPush(newValue);
  await setNotificationsEnabled(newValue);
};
```

### In Services

Send a test notification:

```tsx
import { sendTestNotification } from './src/notifications';

await sendTestNotification('Welcome!', 'Notifications are working');
```

Get the push token for server integration:

```tsx
import { getPushToken } from './src/notifications';

const token = await getPushToken();
console.log('Send this to your backend:', token);
```

## Storage

User notification preferences are stored in AsyncStorage:
- **Key**: `notifications_enabled`
- **Values**: `'true'` or `'false'`
- **Default**: `'true'` for new users

## API Reference

### `getNotificationsEnabled(): Promise<boolean>`
Retrieves the user's notification preference.

**Returns**: `true` if notifications are enabled, `false` otherwise

### `setNotificationsEnabled(enabled: boolean): Promise<boolean>`
Updates the user's notification preference and requests/revokes permissions.

**Parameters**:
- `enabled`: Whether to enable notifications

**Returns**: `true` if successful, `false` otherwise

### `getNotificationPermissionStatus(): Promise<string>`
Gets the current OS-level notification permission status.

**Returns**: Permission status ('granted', 'denied', 'undetermined', etc.)

### `setupNotificationListeners(onNotificationReceived?, onNotificationTapped?): () => void`
Registers listeners for notification events.

**Parameters**:
- `onNotificationReceived` (optional): Called when a notification arrives while app is in foreground
- `onNotificationTapped` (optional): Called when user taps a notification

**Returns**: Cleanup function to unsubscribe

### `sendTestNotification(title: string, body: string): Promise<void>`
Sends a local test notification (respects notification preferences).

**Parameters**:
- `title`: Notification title
- `body`: Notification body text

### `getPushToken(): Promise<string | null>`
Retrieves the Expo push token for server-side notifications.

**Returns**: Push token string or `null` if unavailable

### `clearAllNotifications(): Promise<void>`
Dismisses all active notifications.

## Dependencies

Added to `package.json`:
- `expo-notifications`: ~56.0.8
- `@react-native-async-storage/async-storage`: ^1.24.1

## Platform Support

- ✅ **iOS**: Full support with native notifications
- ✅ **Android**: Full support with FCM (Firebase Cloud Messaging) backend
- ✅ **Web**: Not supported (mobile only)

## Integration with Backend

To enable push notifications from your backend:

1. Retrieve the push token from `getPushToken()`
2. Store the token on your backend associated with the user
3. Use Expo's push notification API to send notifications:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "ExponentPushToken[...]",
    "sound": "default",
    "title": "Hello!",
    "body": "Your notification text"
  }'
```

For more details, see [Expo Notifications Documentation](https://docs.expo.dev/guides/using-notifications/)

## Testing

### Test Locally

```tsx
import { sendTestNotification } from './src/notifications';

// In any handler:
await sendTestNotification('Test Title', 'This is a test notification');
```

### Verify Permissions

```tsx
import { getNotificationPermissionStatus } from './src/notifications';

const status = await getNotificationPermissionStatus();
console.log('Permission status:', status);
```

## Troubleshooting

### Notifications not appearing

1. **Check user preference**: Verify `getNotificationsEnabled()` returns `true`
2. **Check OS permissions**: Call `getNotificationPermissionStatus()`
3. **Check logs**: Look for console.warn messages in `src/notifications.ts`
4. **Android**: Ensure app is not in battery saver mode

### Can't toggle notifications

1. Verify AsyncStorage is properly initialized
2. Check device storage isn't full
3. Look for permission errors in the console

## Future Enhancements

- [ ] Different notification categories (messages, alerts, reminders)
- [ ] Per-category notification preferences
- [ ] Notification sound/vibration options
- [ ] Notification schedule/quiet hours
- [ ] In-app notification center
- [ ] Analytics for notification interactions

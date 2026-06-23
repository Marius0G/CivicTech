// Notification preference + Android runtime permission.
//
// Pure React Native (no expo-notifications): the Android 13+ POST_NOTIFICATIONS runtime permission
// is requested via PermissionsAndroid (the permission is declared in AndroidManifest.xml). The
// on/off choice is persisted to a tiny file so it survives restarts — same pattern as the language
// preference in src/i18n.

import { Platform, PermissionsAndroid, Permission } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const PREF_FILE = `${FileSystem.documentDirectory ?? ''}notifications.txt`;

// The POST_NOTIFICATIONS constant only exists on RN builds that target Android 13+. Read it
// defensively so older runtimes (where notifications are on by default) don't crash.
const POST_NOTIFICATIONS = (PermissionsAndroid.PERMISSIONS as { POST_NOTIFICATIONS?: Permission })
  .POST_NOTIFICATIONS;

let enabled = false;

export function notificationsEnabled(): boolean {
  return enabled;
}

/** Restore the saved preference on boot. Returns the restored value. */
export async function loadNotificationPref(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(PREF_FILE);
    if (info.exists) {
      const v = (await FileSystem.readAsStringAsync(PREF_FILE)).trim();
      enabled = v === '1';
    }
  } catch {
    /* no saved preference — keep default (off) */
  }
  return enabled;
}

async function persist(on: boolean): Promise<void> {
  enabled = on;
  try {
    await FileSystem.writeAsStringAsync(PREF_FILE, on ? '1' : '0');
  } catch {
    /* persistence is best-effort; the in-memory state still took effect */
  }
}

/** True if the OS has already granted notification permission (always true pre-Android-13). */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !POST_NOTIFICATIONS) return true;
  try {
    return await PermissionsAndroid.check(POST_NOTIFICATIONS);
  } catch {
    return false;
  }
}

/**
 * Turn notifications ON: request the OS permission (Android 13+) if it isn't granted yet, then
 * persist the choice. Returns the final enabled state — false if the user denied the OS prompt.
 */
export async function enableNotifications(): Promise<boolean> {
  if (Platform.OS === 'android' && POST_NOTIFICATIONS) {
    try {
      const res = await PermissionsAndroid.request(POST_NOTIFICATIONS, {
        title: 'Notifications',
        message: 'Allow Pip to send you reminders about deadlines, grants and replies.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      if (res !== PermissionsAndroid.RESULTS.GRANTED) {
        await persist(false);
        return false;
      }
    } catch {
      await persist(false);
      return false;
    }
  }
  await persist(true);
  return true;
}

/** Turn notifications OFF (clears the in-app preference; the OS grant itself is left untouched). */
export async function disableNotifications(): Promise<void> {
  await persist(false);
}

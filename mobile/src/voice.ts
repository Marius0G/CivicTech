// Hop's voice — which OpenAI Realtime voice the mascot speaks with.
//
// The voice menu (ProfileScreen → VoiceSheet) calls setVoice(id); the choice is persisted to a
// tiny file so it survives restarts. App.tsx reads getVoice() when it opens a Realtime session and
// passes it to connectRealtime, which forwards it to the backend token endpoint. The backend
// validates the id (see realtime.py VALID_VOICES) so a stale value can never break a session.

import * as FileSystem from 'expo-file-system/legacy';

export interface RealtimeVoice {
  /** OpenAI Realtime voice id sent to the backend. */
  id: string;
  /** Display name for the menu. */
  label: string;
  /** One-line character note shown under the name. */
  description: string;
}

// The voices OpenAI Realtime offers. `marin` and `cedar` are the newest, most natural voices
// (recommended for gpt-realtime); the rest are the classic set. Keep ids in sync with the
// backend's VALID_VOICES allowlist.
export const VOICES: RealtimeVoice[] = [
  { id: 'marin', label: 'Marin', description: 'Warm and natural (default)' },
  { id: 'cedar', label: 'Cedar', description: 'Calm and grounded' },
  { id: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { id: 'ash', label: 'Ash', description: 'Soft and expressive' },
  { id: 'ballad', label: 'Ballad', description: 'Gentle and melodic' },
  { id: 'coral', label: 'Coral', description: 'Bright and friendly' },
  { id: 'echo', label: 'Echo', description: 'Clear and steady' },
  { id: 'sage', label: 'Sage', description: 'Measured and thoughtful' },
  { id: 'shimmer', label: 'Shimmer', description: 'Light and upbeat' },
  { id: 'verse', label: 'Verse', description: 'Lively and engaging' },
];

const DEFAULT_VOICE = 'marin';
const VALID = new Set(VOICES.map((v) => v.id));
const PREF_FILE = `${FileSystem.documentDirectory ?? ''}voice.txt`;

// In-memory current choice (seeded by loadSavedVoice() on boot). Read synchronously at connect time.
let currentVoice = DEFAULT_VOICE;

/** The voice id Hop currently uses. */
export function getVoice(): string {
  return currentVoice;
}

/** Restore a previously saved voice (overrides the default). Call once on boot. */
export async function loadSavedVoice(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(PREF_FILE);
    if (!info.exists) return;
    const id = (await FileSystem.readAsStringAsync(PREF_FILE)).trim();
    if (VALID.has(id)) currentVoice = id;
  } catch {
    /* no saved preference — keep the default voice */
  }
}

/** Switch voice now and persist the choice for next launch. Takes effect on the next connection. */
export async function setVoice(id: string): Promise<void> {
  if (!VALID.has(id)) return;
  currentVoice = id;
  try {
    await FileSystem.writeAsStringAsync(PREF_FILE, id);
  } catch {
    /* persistence is best-effort; the in-memory switch still took effect */
  }
}

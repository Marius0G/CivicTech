// Pick a photo of an ID and upload it to the backend for vision extraction (Phase 3).
//
// POST {BACKEND_URL}/docs/upload (multipart "file") -> { ok, extracted, profile }.
// The returned profile becomes the active one server-side, so get_profile / fill_form use it.

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { BACKEND_URL } from './config';

export interface ExtractedProfile {
  name: string;
  country: string; // normalised Drupal option code, e.g. "RO"
  birthdate: string; // yyyy-mm-dd
  nationality: string;
}

export interface UploadResult {
  ok: boolean;
  extracted: ExtractedProfile; // raw vision output (country as a name)
  profile: ExtractedProfile; // normalised + stored
}

/** Minimal shape of an image to upload — satisfied by both a camera capture and a gallery pick. */
export interface PickedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/** Open the library, let the user pick an ID photo. Returns the asset or null if cancelled. */
export async function pickIdImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo permission denied');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0];
}

/**
 * Upload an already-picked image asset to /docs/upload and return the extracted profile.
 *
 * We use expo-file-system's `uploadAsync` rather than `fetch` + FormData on purpose:
 * Expo's global `fetch` is the "winter" implementation, whose FormData encoder does NOT
 * understand React Native's `{ uri, name, type }` file part and throws
 * "Unsupported FormDataPart implementation". `uploadAsync` streams the file natively as a
 * proper multipart request, so the backend's `file` field is populated correctly.
 */
export async function uploadIdImage(
  asset: PickedImage
): Promise<UploadResult> {
  const mimeType = asset.mimeType || 'image/jpeg';
  const res = await FileSystem.uploadAsync(`${BACKEND_URL}/docs/upload`, asset.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`upload ${res.status}: ${res.body}`);
  }
  return JSON.parse(res.body) as UploadResult;
}

/**
 * Commit the user-reviewed (possibly edited) profile. This is the ONLY step that stores the
 * profile server-side, so the autopilot fills the form with what the user confirmed — not the
 * raw scan. `country` may be an English name or a code; the backend normalises it.
 * Returns the stored (normalised) profile.
 */
export async function saveProfile(fields: ExtractedProfile): Promise<ExtractedProfile> {
  const res = await fetch(`${BACKEND_URL}/docs/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`save ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.profile as ExtractedProfile;
}

/** Pick + upload in one step. Returns null if the user cancels the picker. */
export async function scanId(): Promise<UploadResult | null> {
  const asset = await pickIdImage();
  if (!asset) return null;
  return uploadIdImage(asset);
}

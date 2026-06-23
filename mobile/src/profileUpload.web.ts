// WEB twin of profileUpload.ts. expo-image-picker / expo-file-system don't exist in a browser, so:
//   • pickIdImage   → a hidden <input type="file"> (on mobile web this opens the camera/gallery).
//   • uploadIdImage → standard browser FormData + fetch (the browser sets the multipart boundary
//                      correctly, so unlike RN's "winter" fetch we don't need uploadAsync).
// saveProfile is identical to native (plain JSON fetch). PickedImage.uri is an object URL we can
// re-read into a Blob at upload time, so the public shape matches the native module exactly.

import { BACKEND_URL } from './config';
import { authHeaders } from './supabase';

export interface ExtractedProfile {
  name: string;
  country: string; // normalised Drupal option code, e.g. "RO"
  birthdate: string; // yyyy-mm-dd
  nationality: string;
}

export interface UploadResult {
  ok: boolean;
  extracted: ExtractedProfile;
  profile: ExtractedProfile;
}

export interface PickedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/** Open the OS file picker (camera/gallery on mobile web). Returns the asset or null if cancelled. */
export function pickIdImage(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    // If the user cancels, no 'change' fires on most browsers; we resolve null on focus-back as a
    // best-effort cleanup so callers don't hang forever.
    let settled = false;
    const finish = (v: PickedImage | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      finish({
        uri: URL.createObjectURL(file),
        mimeType: file.type || 'image/jpeg',
        fileName: file.name || 'id.jpg',
      });
    });
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish(null), 500),
      { once: true }
    );
    document.body.appendChild(input);
    input.click();
  });
}

/** Upload an already-picked image to /docs/upload and return the extracted profile. */
export async function uploadIdImage(asset: PickedImage): Promise<UploadResult> {
  const blob = await (await fetch(asset.uri)).blob();
  const form = new FormData();
  form.append('file', blob, asset.fileName || 'id.jpg');
  const res = await fetch(`${BACKEND_URL}/docs/upload`, {
    method: 'POST',
    body: form,
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text()}`);
  return (await res.json()) as UploadResult;
}

/** Commit the user-reviewed profile server-side. Identical to the native path. */
export async function saveProfile(fields: ExtractedProfile): Promise<ExtractedProfile> {
  const res = await fetch(`${BACKEND_URL}/docs/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
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

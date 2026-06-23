// Reliable GLB loading for Expo. THREE's GLTFLoader fetch path is flaky over file:// in RN, so we
// read the bundled asset to base64 (expo-file-system), decode to an ArrayBuffer ourselves, and hand
// it to GLTFLoader.parse — no network/XHR involved. Returns the scene + animation clips.

import { Asset } from 'expo-asset';
// SDK 56 made the classic readAsStringAsync throw; it lives under /legacy now.
import * as FileSystem from 'expo-file-system/legacy';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Group, AnimationClip } from 'three';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Hermes has no atob; decode base64 → bytes manually.
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytesLen = (len * 3) / 4 - pad;
  const bytes = new Uint8Array(bytesLen > 0 ? bytesLen : 0);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = B64.indexOf(clean[i]);
    const e2 = B64.indexOf(clean[i + 1]);
    const e3 = B64.indexOf(clean[i + 2]);
    const e4 = B64.indexOf(clean[i + 3]);
    const c1 = (e1 << 2) | (e2 >> 4);
    const c2 = ((e2 & 15) << 4) | (e3 >> 2);
    const c3 = ((e3 & 3) << 6) | e4;
    if (p < bytesLen) bytes[p++] = c1;
    if (e3 !== -1 && p < bytesLen) bytes[p++] = c2;
    if (e4 !== -1 && p < bytesLen) bytes[p++] = c3;
  }
  return bytes.buffer;
}

export interface LoadedGlb {
  scene: Group;
  animations: AnimationClip[];
}

export async function loadGlb(source: number): Promise<LoadedGlb> {
  const asset = Asset.fromModule(source);
  if (!asset.downloaded) await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const buf = base64ToArrayBuffer(b64);
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  return { scene: gltf.scene as unknown as Group, animations: gltf.animations };
}

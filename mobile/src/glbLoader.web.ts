// WEB twin of glbLoader.ts. In a browser THREE's GLTFLoader can fetch the bundled asset URL over
// HTTP directly (no file:// flakiness, no expo-file-system base64 dance), so we just resolve the
// asset to its served URL and loadAsync it. Returns the same { scene, animations } shape.

import { Asset } from 'expo-asset';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Group, AnimationClip } from 'three';

export interface LoadedGlb {
  scene: Group;
  animations: AnimationClip[];
}

export async function loadGlb(source: number): Promise<LoadedGlb> {
  const asset = Asset.fromModule(source);
  if (!asset.downloaded) await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  const gltf = await new GLTFLoader().loadAsync(uri);
  return { scene: gltf.scene as unknown as Group, animations: gltf.animations };
}

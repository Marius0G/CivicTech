// Mascot3D — Hop rendered from pip.glb with react-three-fiber + expo-gl. Plays the baked clips
// (Idle/Talk/Listen/Doze + one-shot gestures), drives the `mouthOpen` morph from live voice loudness
// (lip-sync), and runs its OWN idle scheduler so Hop waves / looks around / fidgets / dozes wherever
// it's shown (incl. the login screen) without the app micromanaging it.
//
// Loaded LAZILY by Mascot.tsx only when glbConfig.HOP_GLB_SOURCE is set, so the native 3D stack is
// never evaluated until an asset is configured + the app rebuilt (expo-gl is a native module).
//
// Single-action model: exactly one AnimationAction plays at a time. Base loops crossfade; one-shots
// crossfade in and, on 'finished', crossfade back to the current base. The morph is set every frame
// independently of which clip plays, so lip-sync works over any animation.

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, useFrame } from './r3f';
import * as THREE from 'three';
import { MascotProps } from './mascotProps';
import { loadGlb, LoadedGlb } from './glbLoader';
import {
  HOP_BASE_BY_ACTIVITY, HOP_IDLE_GESTURES, HOP_DOZE_AFTER_MS, HOP_MOUTH_MORPH,
} from './glbConfig';

type Props = MascotProps & { source: number };

// The GL canvas renders LARGER than its layout slot (overflows it) so the frog stays at full size
// while the camera keeps enough margin that crown/hands/feet are never clipped at the frustum edges.
// Bigger OVERSCAN = bigger canvas (more room for limbs); smaller CAM_Z = bigger Hop.
const OVERSCAN = 1.6;
const CAM_Z = 3.8; // frames the ~2-unit model with ~13% margin at fov 32 (uncut, still big)

export default function Mascot3D({ source, size = 128, speaking, celebrate, levelValue, activity, gesture }: Props) {
  const [data, setData] = useState<LoadedGlb | null>(null);

  useEffect(() => {
    let ok = true;
    loadGlb(source).then((d) => { if (ok) setData(d); }).catch((e) => console.warn('[Mascot3D] load failed', e));
    return () => { ok = false; };
  }, [source]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <Canvas
        gl={{ alpha: true }}
        camera={{ position: [0, 0, CAM_Z], fov: 32 }}
        style={{ width: size * OVERSCAN, height: size * OVERSCAN }}
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[2.5, 4, 5]} intensity={1.7} />
        {data && (
          <Hop data={data} speaking={!!speaking} celebrate={!!celebrate} levelValue={levelValue} activity={activity} gesture={gesture} />
        )}
      </Canvas>
    </View>
  );
}

function Hop({ data, speaking, celebrate, levelValue, activity, gesture }: {
  data: LoadedGlb; speaking: boolean; celebrate: boolean;
  levelValue?: MascotProps['levelValue']; activity?: MascotProps['activity']; gesture?: MascotProps['gesture'];
}) {
  const scene = data.scene;
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<Record<string, THREE.AnimationAction>>({});
  const current = useRef<THREE.AnimationAction | null>(null);
  const inOneShot = useRef(false);
  const baseClip = useRef('Idle');
  const morph = useRef<{ mesh: THREE.Mesh; idx: number } | null>(null);
  const level = useRef(0);
  const lastActive = useRef(0); // ms timestamp of last meaningful activity

  function crossfade(name: string, loop: boolean) {
    const next = actions.current[name];
    if (!next) return;
    const cur = current.current;
    if (cur && cur !== next) cur.fadeOut(0.25);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.fadeIn(0.25).play();
    current.current = next;
    inOneShot.current = !loop;
  }
  const playBase = (name: string) => crossfade(name, true);
  const playOnce = (name: string) => { if (actions.current[name]) crossfade(name, false); };

  // one-time setup: center/scale, find morph mesh, build mixer + actions
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const maxd = Math.max(s.x, s.y, s.z) || 1;
    const k = 2.0 / maxd;
    scene.position.set(-c.x * k, -c.y * k, -c.z * k);
    scene.scale.setScalar(k);

    scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary && HOP_MOUTH_MORPH in m.morphTargetDictionary) {
        morph.current = { mesh: m, idx: m.morphTargetDictionary[HOP_MOUTH_MORPH] };
      }
    });

    const mx = new THREE.AnimationMixer(scene);
    mixer.current = mx;
    for (const clip of data.animations) actions.current[clip.name] = mx.clipAction(clip);
    const onFinished = () => { inOneShot.current = false; playBase(baseClip.current); };
    mx.addEventListener('finished', onFinished);
    playBase('Idle');
    return () => { mx.removeEventListener('finished', onFinished); mx.stopAllAction(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // activity (or speaking) → base loop
  useEffect(() => {
    const act = activity ?? (speaking ? 'talking' : 'idle');
    baseClip.current = HOP_BASE_BY_ACTIVITY[act] || 'Idle';
    lastActive.current = Date.now();
    if (!inOneShot.current) playBase(baseClip.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, speaking]);

  // one-shot triggers
  useEffect(() => { if (celebrate) { lastActive.current = Date.now(); playOnce('Celebrate'); } }, [celebrate]);
  useEffect(() => {
    if (gesture && gesture.name) { lastActive.current = Date.now(); playOnce(gesture.name); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture?.nonce]);

  // live loudness → ref (no re-renders)
  useEffect(() => {
    if (!levelValue) return;
    const id = levelValue.addListener(({ value }: { value: number }) => { level.current = value; });
    return () => levelValue.removeListener(id);
  }, [levelValue]);

  // idle scheduler: random gestures, then doze after inactivity
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!alive) return;
      timer = setTimeout(() => {
        if (!alive) return;
        const idle = baseClip.current === 'Idle';
        if (idle && !inOneShot.current) {
          if (Date.now() - lastActive.current > HOP_DOZE_AFTER_MS) {
            baseClip.current = 'Doze';
            playBase('Doze');
          } else {
            const g = HOP_IDLE_GESTURES[Math.floor(Math.random() * HOP_IDLE_GESTURES.length)];
            playOnce(g);
          }
        }
        tick();
      }, 3500 + Math.random() * 5000);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_state, dt) => {
    mixer.current?.update(dt);
    const m = morph.current;
    if (m && m.mesh.morphTargetInfluences) {
      const target = (activity === 'talking' || speaking) ? Math.min(1, level.current) : 0;
      const cur = m.mesh.morphTargetInfluences[m.idx] || 0;
      m.mesh.morphTargetInfluences[m.idx] = cur + (target - cur) * Math.min(1, dt * 18);
    }
  });

  return <primitive object={scene} />;
}

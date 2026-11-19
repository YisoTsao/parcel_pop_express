import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { QualityProfile } from './quality';

/** Warm key light from upper-left-front + soft hemisphere fill (ART_DIRECTION §4). */
export function LightingRig({ profile }: { profile: QualityProfile }) {
  const dir = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = dir.current;
    if (!l) return;
    l.castShadow = profile.shadowMap > 0;
    if (profile.shadowMap > 0) {
      l.shadow.mapSize.set(profile.shadowMap, profile.shadowMap);
      l.shadow.map?.dispose();
      l.shadow.map = null;
      const cam = l.shadow.camera;
      cam.left = -5;
      cam.right = 5;
      cam.top = 5;
      cam.bottom = -5;
      cam.near = 1;
      cam.far = 30;
      cam.updateProjectionMatrix();
      l.shadow.bias = -0.0008;
      l.shadow.normalBias = 0.02;
      l.shadow.radius = 4;
    }
  }, [profile.shadowMap]);
  return (
    <>
      <hemisphereLight args={['#FFF8EC', '#E8C9A0', 1.55]} />
      <directionalLight ref={dir} position={[-4.5, 10, 5.5]} intensity={1.9} color="#FFF1DC" />
    </>
  );
}

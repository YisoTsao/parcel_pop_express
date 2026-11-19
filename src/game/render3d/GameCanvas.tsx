import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { PARCEL_H } from './coords';
import * as THREE from 'three';
import { useGame } from '../state/gameStore';
import { BoardScene } from './BoardScene';
import { CameraRig } from './CameraRig';
import { LightingRig } from './LightingRig';
import { QUALITY } from './quality';

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** The only WebGL surface: board, parcels, particles. All text/HUD lives in the DOM. */
export function GameCanvas() {
  const quality = useGame((s) => s.save.graphicsQuality);
  const reducedMotion = useGame((s) => s.save.reducedMotion);
  const profile = QUALITY[quality];
  const [lost, setLost] = useState(false);
  const [key, setKey] = useState(0);
  const supported = useMemo(() => hasWebGL(), []);

  const canvasKey = `${key}-${quality}`;
  const liveKey = useRef(canvasKey);
  liveKey.current = canvasKey;
  useEffect(() => setLost(false), [canvasKey]);

  if (!supported) {
    return (
      <div className="gl-fallback" role="alert">
        <p>這個瀏覽器或裝置無法啟用 WebGL，3D 棋盤無法顯示。</p>
        <p>請改用新版 Chrome / Safari / Edge，或開啟硬體加速後重新整理。</p>
      </div>
    );
  }

  return (
    <div className="canvas-wrap" data-testid="board-canvas">
      <Canvas
        key={canvasKey}
        orthographic
        shadows={profile.shadowMap > 0 ? { type: THREE.PCFSoftShadowMap } : false}
        dpr={profile.dpr}
        gl={{ antialias: profile.antialias, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
        camera={{ position: [0, 9.5, 8.6], zoom: 40, near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          const mine = canvasKey;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            // R3F force-loses the old context when a Canvas is replaced (quality change); ignore that.
            if (liveKey.current === mine) setLost(true);
          });
        }}
      >
        <CameraRig />
        <LightingRig profile={profile} />
        <BoardScene profile={profile} reducedMotion={reducedMotion} />
        {profile.contactShadows && (
          <ContactShadows position={[0, 0.006, 0]} scale={6.4} resolution={512} far={PARCEL_H * 1.6} blur={1.6} opacity={0.5} color="#6b4a2b" />
        )}
      </Canvas>
      {lost && (
        <div className="gl-fallback overlay" role="alert">
          <p>顯示卡繪圖中斷（WebGL context lost）。</p>
          <button className="btn primary" onClick={() => setKey((k) => k + 1)}>
            重新載入棋盤
          </button>
        </div>
      )}
    </div>
  );
}

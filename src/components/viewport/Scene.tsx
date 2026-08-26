'use client';

import { Grid, OrbitControls, Stats } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { TerrainMesh } from '@/components/viewport/TerrainMesh';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[64, 64]} />
      <meshStandardMaterial color="#16181d" roughness={0.95} metalness={0} />
    </mesh>
  );
}

/** Samples the render loop and pushes FPS / frame-time into the UI store. */
function TelemetryLoop() {
  const setTelemetry = useUiStore((s) => s.setTelemetry);
  const frames = useRef(0);
  const last = useRef(performance.now());

  useFrame(() => {
    frames.current += 1;
    const now = performance.now();
    const elapsed = now - last.current;
    if (elapsed >= 500) {
      const fps = Math.round((frames.current * 1000) / elapsed);
      const frameTimeMs = elapsed / frames.current;
      setTelemetry(fps, frameTimeMs);
      frames.current = 0;
      last.current = now;
    }
  });

  return null;
}

export function Scene() {
  const hasTerrain = useSceneStore((s) => s.terrainHeightmap !== null);

  return (
    <>
      <color attach="background" args={['#08090a']} />
      <hemisphereLight args={['#5e6ad2', '#08090a', 0.55]} />
      <directionalLight position={[10, 15, 8]} intensity={1.2} />
      {hasTerrain ? <TerrainMesh /> : <Ground />}
      <Grid
        position={[0, 0.01, 0]}
        args={[64, 64]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#16181d"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#10b981"
        fadeDistance={45}
        fadeStrength={1}
        infiniteGrid={false}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      <Stats className="stats-overlay" />
      <TelemetryLoop />
    </>
  );
}

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Grid } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import {
  abs,
  fract,
  length,
  max,
  min,
  mix,
  oneMinus,
  positionWorld,
  smoothstep,
  vec3,
} from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

/**
 * Grid floor (replaces drei's <Grid>).
 *
 * drei's Grid builds a classic THREE.ShaderMaterial, which three r185's
 * WebGPURenderer cannot compile through its NodeBuilder — it logs
 * `NodeBuilder: Material "ShaderMaterial" is not compatible.` and swaps in an
 * empty NodeMaterial, so the grid silently disappears on the WebGPU path
 * (verified live on the RTX 2070). This TSL version draws the same design
 * (cell lines + rust section lines every 4 units + radial fade) with node
 * materials, so it renders identically on WebGL and WebGPU.
 */
const GRID_SIZE = 64;
const CELL_W = 0.08; // world-unit half-width of cell lines
const SECTION_EVERY = 4;
const SECTION_W = 0.2; // world-unit half-width of section lines
const FADE_DISTANCE = 45;

export function GridFloor() {
  const gl = useThree((state) => state.gl);

  // drei's ShaderMaterial is the stable WebGL path. WebGPU needs the TSL
  // implementation below because ShaderMaterial is not NodeBuilder-safe.
  if (!('isWebGPURenderer' in gl)) {
    return (
      <Grid
        args={[GRID_SIZE, GRID_SIZE]}
        cellSize={1}
        cellThickness={0.7}
        cellColor="#b7b5ac"
        sectionSize={SECTION_EVERY}
        sectionThickness={1.2}
        sectionColor="#c8643f"
        fadeDistance={FADE_DISTANCE}
        fadeStrength={1}
        infiniteGrid={false}
      />
    );
  }

  return <TslGrid />;
}

function TslGrid() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const material = useMemo(() => {
    const px = positionWorld.x;
    const pz = positionWorld.z;
    // Distance to the nearest grid line (min across the x and z patterns),
    // 0 exactly on a line, 1 mid-cell.
    const dCell = min(
      abs(fract(px).sub(0.5)).mul(2),
      abs(fract(pz).sub(0.5)).mul(2),
    );
    const dSection = min(
      abs(fract(px.div(SECTION_EVERY)).sub(0.5)).mul(2),
      abs(fract(pz.div(SECTION_EVERY)).sub(0.5)).mul(2),
    );
    const cellMask = oneMinus(smoothstep(0.0, CELL_W, dCell));
    const sectionMask = oneMinus(smoothstep(0.0, SECTION_W, dSection));
    const mask = max(cellMask, sectionMask);
    const fade = oneMinus(
      smoothstep(FADE_DISTANCE * 0.55, FADE_DISTANCE, length(positionWorld.xz)),
    );
    const lineColor = mix(
      vec3(0xb7 / 255, 0xb5 / 255, 0xac / 255),
      vec3(0xc8 / 255, 0x64 / 255, 0x3f / 255),
      sectionMask,
    );

    return new MeshBasicNodeMaterial({
      colorNode: lineColor,
      opacityNode: mask.mul(fade),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  return <mesh geometry={geometry} material={material} position={[0, 0.01, 0]} />;
}

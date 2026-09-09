import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/**
 * Post-processing (Task 3.5) — dual path:
 *
 *  * WebGL (default, what CI exercises): three/addons EffectComposer with
 *    RenderPass + OutputPass. Bloom and FXAA stay enabled for classic-material
 *    scenes and are bypassed automatically when TSL materials are present.
 *  * WebGPU (opt-in via NEXT_PUBLIC_ENABLE_WEBGPU): three/webgpu PostProcessing
 *    with a TSL `pass(scene, camera)` chain. NOTE: three r185's TSL build has
 *    no chainable bloom/fxaa nodes yet — the runtime feature-detects
 *    `passNode.bloom()` so a future three upgrade unlocks them with zero code
 *    changes; until then the WebGPU path renders the plain scene through the
 *    post pipeline.
 */
export interface PostFxHandle {
  render(): void;
  setEnabled(enabled: boolean): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

// --- WebGL path -----------------------------------------------------------------

export function createWebGlPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  initialEnabled = true,
): PostFxHandle {
  let enabled = initialEnabled;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(renderer.domElement.width, renderer.domElement.height),
    0.55, // strength
    0.45, // radius
    0.85, // threshold
  );
  composer.addPass(bloomPass);

  const fxaaPass = new ShaderPass(FXAAShader);
  composer.addPass(fxaaPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const updatePasses = () => {
    let hasNodeMaterial = false;
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some((material) => Boolean((material as THREE.Material & { isNodeMaterial?: boolean }).isNodeMaterial))) {
        hasNodeMaterial = true;
      }
    });
    const safeForScene = !hasNodeMaterial;
    bloomPass.enabled = enabled && safeForScene;
    fxaaPass.enabled = enabled && safeForScene;
  };

  const apply = (nextEnabled: boolean) => {
    enabled = nextEnabled;
    updatePasses();
  };
  apply(enabled);

  return {
    render: () => {
      updatePasses();
      composer.render();
    },
    setEnabled: apply,
    setSize: (width, height) => {
      composer.setSize(width, height);
      composer.setPixelRatio(renderer.getPixelRatio());
      const resolution = fxaaPass.uniforms.resolution.value as THREE.Vector2;
      resolution.set(width, height);
    },
    dispose: () => {
      composer.dispose();
      bloomPass.dispose();
      fxaaPass.dispose();
      outputPass.dispose();
    },
  };
}

// --- WebGPU path -----------------------------------------------------------------

type TslPass = ReturnType<typeof import('three/tsl')['pass']> & {
  /** Added in later three releases — feature-detect so upgrades unlock it. */
  bloom?: () => unknown;
  fxaa?: () => unknown;
};

export async function createWebGpuPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  enabled = true,
): Promise<PostFxHandle> {
  const [{ PostProcessing }, { pass }] = await Promise.all([
    import('three/webgpu'),
    import('three/tsl'),
  ]);

  const post = new PostProcessing(renderer as never);
  const scenePass = pass(scene, camera) as TslPass;

  let enhanced: unknown | null = null;
  if (typeof scenePass.bloom === 'function') {
    enhanced = scenePass.bloom();
  } else {
    // three r185 TSL build — no chainable post nodes yet; log once so a
    // future three upgrade is obvious to spot.
    console.info(
      '[postfx] three/tsl bloom not available in this three version — ' +
        'WebGPU path renders the plain pass (upgrade three to unlock bloom).',
    );
  }

  const apply = (on: boolean) => {
    // `enhanced` is an opaque TSL node from a future three version — typed
    // structurally by the runtime's PostProcessing.outputNode assignment.
    post.outputNode = on && enhanced ? (enhanced as never) : scenePass;
  };
  apply(enabled);

  return {
    render: () => void post.render(),
    setEnabled: apply,
    setSize: () => {
      // PostProcessing follows the renderer's size automatically.
    },
    dispose: () => {
      post.dispose();
    },
  };
}

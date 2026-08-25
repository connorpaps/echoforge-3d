# 06. Testing, Quality Assurance & Playwright Verification Plan

**Product:** EchoForge 3D  
**Specification Version:** 1.2.0 (Audited & Production-Hardened)  
**Testing Frameworks:** Playwright (E2E & WebGL Canvas Snapshotting), Vitest / React Testing Library (Frontend Unit), Pytest (Backend AI Microservice)

---

## 1. The 4 Critical User Journeys (CUJs)

Every build and pull request must verify these four primary journeys end-to-end:

### CUJ-01: 2D Elevation Sketching to 3D Terrain Displacement
- **Step 1:** User opens the 2D Topographic Canvas (`data-testid="topo-canvas"`).
- **Step 2:** User simulates a mouse drag stroke with the brush.
- **Step 3:** The client-side `depth.worker.ts` receives the `ImageBitmap` and dispatches depth data.
- **Verification Gate:** The Three.js `PlaneGeometry` vertex height values reflect non-zero elevation within 150ms.

### CUJ-02: Voice Command to 3D Asset Spawn & Audio Binding
- **Step 1:** User holds key `<M>` (`data-testid="voice-pill"`).
- **Step 2:** Mock audio stream dispatches *"Place a bonfire on the hill"*.
- **Step 3:** Distil-Whisper transcribes, Qwen2.5-Coder formats JSON, and backend returns mock `.glb` + `.wav`.
- **Verification Gate:** Scene graph adds new `SceneEntity` with valid Rapier collision bounds and an attached `SpatialAudioEmitter`.

### CUJ-03: First-Person Mode Transition & Physics Locomotion
- **Step 1:** User presses `<Tab>`.
- **Step 2:** Editor UI fades, pointer lock engages, and first-person controller activates.
- **Step 3:** User presses `<W>` to walk forward.
- **Verification Gate:** Kinematic character controller coordinates move along the terrain heightfield surface without falling through the floor.

### CUJ-04: Standalone Scene Export
- **Step 1:** User clicks *"Export Standalone HTML"* (`data-testid="export-btn"`).
- **Step 2:** Browser packages Three.js bundle and embedded GLTF base64 blobs into a `.html` file.
- **Verification Gate:** Downloaded HTML file executes in an isolated browser context and renders the 3D scene at 60 FPS.

---

## 2. Playwright E2E Configuration Matrix

Because standard headless Chromium does not have hardware GPU acceleration, Playwright tests must launch with specific software rendering and WebGPU flags:

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist',
        '--enable-features=Vulkan,DefaultANGLEVulkan'
      ]
    }
  },
  projects: [
    {
      name: 'chromium-webgpu',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
```

---

## 3. Sample Playwright E2E Test Suite

```typescript
// e2e/first-person-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('EchoForge 3D Core Viewport & First-Person Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="viewport-3d"]', { state: 'visible' });
  });

  test('should render 3D canvas and toggle first-person mode on Tab', async ({ page }) => {
    const canvas = page.locator('[data-testid="viewport-3d"]');
    await expect(canvas).toBeVisible();

    // Verify initial editor UI elements
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-pill"]')).toContainText('Hold M to Speak');

    // Press Tab to transition to First-Person Mode
    await page.keyboard.press('Tab');

    // Verify editor drawer fades out and crosshair HUD appears
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeHidden();
    await expect(page.locator('[data-testid="crosshair-hud"]')).toBeVisible();

    // Press Tab again to return to Editor Mode
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();
  });
});
```

---

## 4. Pytest Backend CUDA & VRAM Verification Suite

```python
# backend/tests/test_vram_manager.py
import pytest
import torch
from backend.services.vram_manager import SequentialVRAMManager

def test_sequential_vram_swapping_limits():
    """Guarantees that PyTorch memory is freed between successive model acquisitions."""
    if not torch.cuda.is_available():
        pytest.skip("CUDA GPU required for memory threshold testing")

    manager = SequentialVRAMManager()
    
    # 1. Acquire SDXL-Turbo
    pipe = manager.acquire_sdxl_turbo()
    assert pipe is not None
    assert manager.active_model_name == "sdxl_turbo"
    mem_sdxl = torch.cuda.memory_allocated() / (1024 ** 3)
    assert mem_sdxl < 5.0 # Max 5GB VRAM

    # 2. Acquire AudioGen (must release SDXL-Turbo first)
    audio_model = manager.acquire_audiogen()
    assert audio_model is not None
    assert manager.active_model_name == "audiogen"
    mem_audio = torch.cuda.memory_allocated() / (1024 ** 3)
    assert mem_audio < 3.0 # Max 3GB VRAM

    # 3. Explicit release
    manager.release_gpu()
    assert manager.active_model_name is None
    mem_released = torch.cuda.memory_allocated() / (1024 ** 3)
    assert mem_released < 0.2 # Below 200MB baseline
```

---

## 5. Visual Regression & Headless Canvas Snapshot Verification

To catch subtle visual regressions, shader compile errors, or styling shifts against `./DESIGN.md`, Playwright compares WebGL framebuffer snapshots:

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual & Shader Regression Audit', () => {
  test('should match baseline 3D studio viewport rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="viewport-3d"]', { state: 'visible' });
    
    // Wait for initial WebGPU shaders to compile and render first frame
    await page.waitForTimeout(1000);

    // Capture screenshot of the 3D viewport canvas
    const canvasScreenshot = await page.locator('[data-testid="viewport-3d"]').screenshot();

    // Verify pixel delta is below 2% threshold
    expect(canvasScreenshot).toMatchSnapshot('baseline-viewport.png', {
      maxDiffPixelRatio: 0.02
    });
  });
});
```

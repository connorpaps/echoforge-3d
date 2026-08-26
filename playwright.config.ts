import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  // CPU-safety: SwiftShader renders WebGL on the CPU, so parallel workers
  // saturate the machine and can freeze the host. Always run serially.
  fullyParallel: false,
  workers: 1,
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
        '--enable-features=Vulkan,DefaultANGLEVulkan',
      ],
    },
  },
  projects: [
    {
      name: 'chromium-webgpu',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Pin the port explicitly: the environment sets PORT=0 (random port),
    // which Next.js would otherwise honor and break the URL probe.
    command: 'pnpm dev -p 3000',
    url: 'http://localhost:3000',
    // Always start our own server: reusing an unrelated dev server would run
    // tests against non-hermetic (real-worker) builds. Fails loudly if 3000
    // is occupied.
    reuseExistingServer: false,
    timeout: 120000,
    // Hermetic E2E mode: workers are replaced with deterministic fixtures
    // so CI never downloads models or touches the network.
    env: { ...process.env, NEXT_PUBLIC_E2E: 'true' },
  },
});

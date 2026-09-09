import { expect, test } from '@playwright/test';

test.describe('EchoForge 3D generation journey (E2E mock seam)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="generate-mesh"]', {
      state: 'visible',
    });
  });

  test('upload image → Generate Mesh → shimmer ticks → success toast', async ({
    page,
  }) => {
    await page.setInputFiles(
      '[data-testid="image-upload"]',
      'e2e/fixtures/concept.png',
    );
    await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();

    await page.click('[data-testid="generate-mesh"]');

    const pill = page.locator('[data-testid="generating-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('Generating mesh via TripoSR');

    // The pill vanishes when the mock timeline finishes; the success toast
    // proves completion (the pill's 100% tick is too fast to catch).
    const toast = page.locator('[data-testid="success-toast"]');
    await expect(toast).toContainText('Mesh ready', { timeout: 10000 });
    await expect(toast).toContainText('18,763 faces');

    // The generated result must cross the state bridge into the editor, not
    // stop at a success toast.
    await page.click('[data-testid="rail-scene"]');
    await expect(page.locator('[data-testid="scene-tree"]')).toContainText(
      'Generated Mesh',
    );
    await expect(
      page
        .getByTestId('scene-tree')
        .getByRole('button', { name: 'Select Generated Mesh' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="scene-inspector"]')).toContainText(
      'Transform',
    );
    await expect(page.getByText('Unable to load Generated Mesh')).toHaveCount(0);
    await expect(page.getByTestId('loaded-mesh-mesh-e2e-mesh-000001')).toHaveText(
      'Generated Mesh · GLB loaded',
    );
    await page.screenshot({
      path: 'docs/assets/echoforge-populated-demo.png',
      fullPage: true,
    });
  });

  test('texture generation shows the DIFFUSION shimmer and a preview', async ({
    page,
  }) => {
    await page.fill('[data-testid="prompt-input"]', 'ancient stone castle');
    await page.click('[data-testid="generate-texture"]');

    await expect(page.locator('[data-testid="generating-pill"]')).toContainText(
      'SDXL-Turbo',
    );
    await expect(
      page.locator('[data-testid="success-toast"]'),
    ).toContainText('Texture ready', { timeout: 10000 });
    await expect(page.locator('[data-testid="texture-thumb"]')).toBeVisible();
  });

  test('error path shows the glass toast and retry stays available', async ({
    page,
  }) => {
    await page.setInputFiles(
      '[data-testid="image-upload"]',
      'e2e/fixtures/concept.png',
    );
    await page.fill('[data-testid="prompt-input"]', 'make this fail');
    await page.click('[data-testid="generate-mesh"]');

    const toast = page.locator('[data-testid="error-toast"]');
    await expect(toast).toContainText('Generation failed', { timeout: 10000 });
    await expect(toast).toContainText('GPU queue saturated');
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Retry re-runs the same failing request → error toast returns.
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="error-toast"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test('VRAM meter reads the mock backend telemetry', async ({ page }) => {
    await expect(page.locator('[data-testid="vram-meter"]')).toContainText(
      'VRAM: 4.2GB/8GB',
      { timeout: 10000 },
    );
  });
});

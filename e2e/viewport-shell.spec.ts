import { expect, test } from '@playwright/test';

test.describe('EchoForge 3D viewport shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="viewport-3d"]', {
      state: 'visible',
    });
    await page.locator('[data-testid="rail-tools"]').click();
  });

  test('renders the 3D canvas and workstation chrome', async ({ page }) => {
    const viewport = page.locator('[data-testid="viewport-3d"]');
    await expect(viewport).toBeVisible();
    await expect(viewport.locator('canvas').first()).toBeVisible();
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor-rail"]')).toBeVisible();
    const emptyState = page.locator('[data-testid="empty-scene-state"]');
    await expect(emptyState).toBeVisible();
    const emptyBox = await emptyState.boundingBox();
    expect(emptyBox?.x ?? 0).toBeGreaterThan(300);
    await expect(page.locator('header')).toContainText('EchoForge 3D');
    await expect(page.locator('footer')).toContainText('FPS');
  });

  test('FX toggle switches post-processing on and off', async ({ page }) => {
    const toggle = page.locator('[data-testid="fx-toggle"]');
    await expect(toggle).toContainText('On');
    await toggle.click();
    await expect(toggle).toContainText('Off');
    await toggle.click();
    await expect(toggle).toContainText('On');
  });

  test('keeps empty-state guidance visible beside the compact source sheet', async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 900 });
    await page.reload();
    await page.waitForSelector('[data-testid="viewport-3d"] canvas', { state: 'visible' });
    const viewportBox = await page.locator('[data-testid="viewport-3d"]').boundingBox();
    expect(viewportBox?.height ?? 0).toBeGreaterThan(700);
    const emptyState = page.locator('[data-testid="empty-scene-state"]');
    await expect(emptyState).toBeVisible();
    const emptyBox = await emptyState.boundingBox();
    expect(emptyBox?.width ?? 0).toBeGreaterThan(100);
    expect(emptyBox?.x ?? 0).toBeGreaterThan(300);
    expect((emptyBox?.x ?? Infinity) + (emptyBox?.width ?? Infinity)).toBeLessThanOrEqual(760);

  });

  test('render loop advances at the software-render floor (>= 30 FPS)', async ({
    page,
  }) => {
    // UnrealBloomPass is too heavy for SwiftShader — disable FX first so this
    // measures the base render loop, not the post pipeline.
    await page.click('[data-testid="fx-toggle"]');

    const frames = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let count = 0;
          const start = performance.now();
          const tick = () => {
            count += 1;
            if (performance.now() - start >= 2000) resolve(count);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    // >= ~30 FPS sustained over a 2s sample in headless SwiftShader
    expect(frames).toBeGreaterThan(30 * 2);
  });

  test('Tab toggles the left drawer (mode switch)', async ({ page }) => {
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeHidden();

    await page.keyboard.press('Tab');
    await page.locator('[data-testid="rail-tools"]').click();
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();
  });
});

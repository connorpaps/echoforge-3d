import { expect, test } from '@playwright/test';

test.describe('EchoForge 3D viewport shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="viewport-3d"]', {
      state: 'visible',
    });
  });

  test('renders the 3D canvas and workstation chrome', async ({ page }) => {
    const viewport = page.locator('[data-testid="viewport-3d"]');
    await expect(viewport).toBeVisible();
    await expect(viewport.locator('canvas').first()).toBeVisible();
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-pill"]')).toContainText(
      'Hold',
    );
    await expect(page.locator('header')).toContainText('EchoForge 3D');
    await expect(page.locator('footer')).toContainText('FPS');
  });

  test('render loop advances at the software-render floor (>= 30 FPS)', async ({
    page,
  }) => {
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
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

test.describe('CUJ-01: 2D elevation sketch to 3D terrain displacement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="topo-canvas"]', {
      state: 'visible',
    });
  });

  test('a brush stroke produces a displaced terrain mesh', async ({ page }) => {
    // Initially no terrain telemetry.
    await expect(page.locator('footer')).not.toContainText('Verts:');

    // Simulate a mouse drag stroke across the topo canvas.
    const canvas = page.locator('[data-testid="topo-canvas"]');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(
      box.x + box.width * 0.45,
      box.y + box.height * 0.5,
    );
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.6,
      box.y + box.height * 0.55,
      { steps: 4 },
    );
    await page.mouse.up();

    // The depth worker (fixture in E2E mode) returns a heightmap; the terrain
    // mesh mounts and reports its vertex count to the telemetry bar.
    await expect(page.locator('footer')).toContainText('Verts: 16384', {
      timeout: 5000,
    });
  });

  test('Clear resets the terrain', async ({ page }) => {
    const canvas = page.locator('[data-testid="topo-canvas"]');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.up();

    await expect(page.locator('footer')).toContainText('Verts: 16384', {
      timeout: 5000,
    });

    await page.locator('[data-testid="clear-elevation"]').click();
    await expect(page.locator('footer')).not.toContainText('Verts:', {
      timeout: 5000,
    });
  });
});

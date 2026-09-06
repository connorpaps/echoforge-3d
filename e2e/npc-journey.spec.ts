import { expect, test } from '@playwright/test';

test.describe('EchoForge 3D vision-NPC journey (E2E mock seam)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="rail-scene"]');
    await page.waitForSelector('[data-testid="spawn-npc"]', {
      state: 'visible',
    });
  });

  test('spawn NPC → press E → dialogue bubble with the fixture reply', async ({
    page,
  }) => {
    await page.click('[data-testid="spawn-npc"]');
    await expect(page.locator('[data-testid="scene-inspector"]')).toContainText(
      'Guide',
    );

    // The NPC spawns at the camera position, so the interact hint appears.
    await expect(page.locator('[data-testid="interact-hint"]')).toBeVisible({
      timeout: 10000,
    });

    await page.keyboard.press('e');

    const bubble = page.locator('[data-testid="dialogue-bubble"]');
    await expect(bubble).toContainText('campfire', { timeout: 10000 });
  });

  test('E does nothing when no NPC is nearby', async ({ page }) => {
    await page.keyboard.press('e');
    await expect(
      page.locator('[data-testid="dialogue-bubble"]'),
    ).toHaveCount(0);
  });
});

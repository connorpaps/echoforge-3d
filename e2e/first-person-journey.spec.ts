import { expect, test } from '@playwright/test';

test.describe('CUJ-03: first-person mode transition & physics locomotion', () => {
  test('Tab engages play mode and W walks the player over the heightfield', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="topo-canvas"]', {
      state: 'visible',
    });

    // Raise terrain so the walk happens on a displaced heightfield.
    const canvas = page.locator('[data-testid="topo-canvas"]');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.6,
      box.y + box.height * 0.55,
      { steps: 3 },
    );
    await page.mouse.up();
    await expect(page.locator('footer')).toContainText('Verts: 16384', {
      timeout: 5000,
    });

    // Enter play mode: drawer fades, crosshair HUD appears, POS readout shows.
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="crosshair-hud"]')).toBeVisible();
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeHidden();
    const pos = page.locator('[data-testid="player-pos"]');
    await expect(pos).toBeVisible();

    // Let the capsule settle onto the terrain, then read the start position.
    await page.waitForTimeout(700);
    const readPos = async (): Promise<[number, number, number]> => {
      const text = (await pos.textContent()) ?? '';
      const match = text.match(/POS:\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)/);
      expect(match).not.toBeNull();
      return [Number(match![1]), Number(match![2]), Number(match![3])];
    };
    const start = await readPos();

    // Hold W: camera yaw is 0 in play mode, so forward is -Z.
    await page.keyboard.down('w');
    await page.waitForTimeout(1200);
    await page.keyboard.up('w');
    const end = await readPos();

    expect(end[2]).toBeLessThan(start[2] - 0.5); // moved forward (-Z)
    expect(end[1]).toBeGreaterThan(0.5); // never fell through the heightfield
  });

  test('Tab returns to editor mode and restores the drawer', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="viewport-3d"]', {
      state: 'visible',
    });

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="crosshair-hud"]')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="crosshair-hud"]')).toBeHidden();
    await expect(page.locator('[data-testid="topo-canvas"]')).toBeVisible();
  });
});

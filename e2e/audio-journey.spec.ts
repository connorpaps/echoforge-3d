import { expect, test } from '@playwright/test';

test.describe('EchoForge 3D ambient audio journey (E2E mock seam)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="generate-audio"]', {
      state: 'visible',
    });
  });

  test('Generate Ambient → AUDIO shimmer → toast → audio emitter entity in the scene', async ({
    page,
  }) => {
    await page.fill('[data-testid="prompt-input"]', 'night forest ambience');
    await page.click('[data-testid="generate-audio"]');

    const pill = page.locator('[data-testid="generating-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('Synthesizing ambient audio');

    const toast = page.locator('[data-testid="success-toast"]');
    await expect(toast).toContainText('Ambient ready', { timeout: 10000 });
    await expect(toast).toContainText('loopable WAV');

    // The generated WAV lands in the scene graph as an audio_emitter entity.
    await expect(page.locator('[data-testid="scene-inspector"]')).toContainText(
      'Ambient Loop',
      { timeout: 10000 },
    );

    // The HRTF spatial bus reports the live emitter count (BottomBar).
    await expect(page.locator('[data-testid="ambient-bus"]')).toContainText(
      '1 emitter',
      { timeout: 10000 },
    );
  });

  test('audio emitter volume + falloff controls patch the entity live', async ({
    page,
  }) => {
    await page.fill('[data-testid="prompt-input"]', 'cave drips');
    await page.click('[data-testid="generate-audio"]');
    await expect(page.locator('[data-testid="success-toast"]')).toContainText(
      'Ambient ready',
      { timeout: 10000 },
    );

    const falloff = page
      .locator('[data-testid="scene-inspector"]')
      .locator('input[type="range"]')
      .last();
    await expect(falloff).toBeVisible();
    // End jumps the range slider to its max (50m) — the readout should update.
    await falloff.focus();
    await page.keyboard.press('End');
    await expect(
      page.locator('[data-testid="scene-inspector"]').locator('text=50m'),
    ).toBeVisible();
  });

  test('error path shows the glass toast with retry', async ({ page }) => {
    await page.fill('[data-testid="prompt-input"]', 'make this fail');
    await page.click('[data-testid="generate-audio"]');

    const toast = page.locator('[data-testid="error-toast"]');
    await expect(toast).toContainText('Generation failed', { timeout: 10000 });
    await expect(toast).toContainText('GPU queue saturated');
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});

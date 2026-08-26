import { expect, test } from '@playwright/test';

test.describe('EchoForge 3D voice dictation (E2E mock seam)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="voice-pill"]', {
      state: 'visible',
    });
  });

  test('hold M records, release transcribes via the fixture worker', async ({
    page,
  }) => {
    const pill = page.locator('[data-testid="voice-pill"]');
    await expect(pill).toContainText('Hold');

    // Hold push-to-talk: fake mic session starts, pill enters Recording.
    await page.keyboard.down('m');
    await expect(pill).toContainText('Recording…');

    // Release: mock speech worker returns the fixture transcript, which the
    // executed flash shows briefly before reverting to idle.
    await page.keyboard.up('m');
    await expect(pill).toContainText('place a bonfire on the hill', {
      timeout: 5000,
    });

    await expect(pill).toContainText('Hold', { timeout: 5000 });
  });

  test('M does not hijack typing in the prompt input', async ({ page }) => {
    const input = page.locator('[data-testid="prompt-input"]');
    await input.click();
    await page.keyboard.type('monolith');
    await expect(input).toHaveValue('monolith');

    // Pill stays idle — the recording hotkey is suppressed while typing.
    const pill = page.locator('[data-testid="voice-pill"]');
    await expect(pill).toContainText('Hold');
  });
});

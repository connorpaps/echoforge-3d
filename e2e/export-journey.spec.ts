import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.describe('EchoForge 3D export journey (CUJ-04)', () => {
  test('export standalone HTML → download → re-opens offline and renders', async ({
    page,
    browser,
  }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="export-btn"]', {
      state: 'visible',
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await page.click('[data-testid="export-btn"]');
        await page.click('[data-testid="export-html"]');
      })(),
    ]);

    const path = await download.path();
    expect(path).toBeTruthy();
    const html = readFileSync(path as string, 'utf8');
    expect(html).toContain('EchoForge 3D — Exported Scene');
    // Fully self-contained: three.core is embedded as base64 (blob import),
    // the runtime is inlined, and nothing is referenced from the network.
    expect(html).not.toContain('src="http');
    expect(html).toContain('URL.createObjectURL');
    expect(html).toContain('EchoForge 3D · exported scene');

    // The exported file must open offline in an isolated page and render.
    const offline = await browser.newPage();
    const errors: string[] = [];
    offline.on('pageerror', (err) => errors.push(String(err)));
    await offline.setContent(html);
    await offline.waitForSelector('canvas', { timeout: 15000 });
    await expect(offline.locator('canvas')).toBeVisible();
    expect(errors).toEqual([]);
    await offline.close();
  });

  test('export menu offers the glTF option and closes on outside click', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="export-btn"]');

    await page.click('[data-testid="export-btn"]');
    await expect(page.locator('[data-testid="export-gltf"]')).toBeVisible();

    // Clicking the viewport closes the dropdown.
    await page.mouse.click(400, 400);
    await expect(page.locator('[data-testid="export-gltf"]')).toHaveCount(0);
  });
});

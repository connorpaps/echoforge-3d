import { chromium } from '@playwright/test';

const pauseRender = process.argv.includes('--pause-render');
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
if (pauseRender) {
  // Halt the viewport render loop entirely: R3F drives via requestAnimationFrame,
  // so stalling rAF stops GPU work from the browser without touching the backend.
  await page.addInitScript(() => {
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1000);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
}
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(4000);

const t0 = Date.now();
await page.getByTestId('prompt-input').fill('a crackling campfire at dusk');
const btn = page.getByTestId('generate-audio');
const count = await btn.count();
const disabled = await btn.isDisabled().catch(() => true);
console.log('render paused:', pauseRender, '| audio button count:', count, '| disabled after prompt:', disabled);
if (count > 0 && !disabled) {
  await btn.click({ timeout: 10000 }).catch((e) => console.log('click error:', String(e).slice(0, 120)));
}
const respPromise = page.waitForResponse(
  (r) => r.url().includes('/generate-audio') && r.status() === 200,
  { timeout: 480000 }
).then((r) => ({ elapsed: (Date.now() - t0) / 1000, synth: r.headers()['x-echoforge-synthetic'] ?? null }))
  .catch(() => null);
const resp = await respPromise;
if (resp) {
  console.log(`RESPONSE: ${resp.elapsed.toFixed(1)}s after click | synthetic=${resp.synth}`);
} else {
  console.log(`RESPONSE: none within 480s`);
}
console.log('page errors:', pageErrors.length ? pageErrors.slice(0, 3) : 'none');
const ok = resp && resp.synth === 'false' && pageErrors.length === 0;
console.log(ok ? 'UI-TIMING-OK' : 'UI-TIMING-FAIL');
await browser.close();
process.exit(ok ? 0 : 1);

#!/usr/bin/env node
/**
 * WebGPU verification (Task 3 / Next-steps #5) — runs the app with
 * NEXT_PUBLIC_ENABLE_WEBGPU=true on a REAL GPU (no SwiftShader), then checks:
 *
 *   1. navigator.gpu + a hardware (non-software) adapter
 *   2. the app boots through R3F's async WebGPURenderer factory without page errors
 *   3. the canvas actually renders (non-blank, non-uniform pixels)
 *   4. the WebGPU post path engaged (three/tsl bloom feature-detect log)
 *   5. the FX toggle flips without errors
 *
 * Usage: node scripts/gpu/webgpu-check.mjs [url]   (default http://localhost:3100)
 * Needs the WebGPU dev server: NEXT_PUBLIC_ENABLE_WEBGPU=true pnpm dev -p 3100
 */
import { chromium } from '@playwright/test';

const URL = process.argv[2] || 'http://localhost:3100';
const results = [];
const check = (name, cond, detail = '') => {
  results.push([name, cond, detail]);
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
};

// Launch requirements (verified empirically on this box):
//   * MUST use the user's real Chrome (`channel: 'chrome'`) — Playwright's
//     bundled Chromium exposes no WebGPU adapter at all (Dawn build gap).
//   * MUST be headed — headless Chromium exposes no WebGPU adapter, and
//     three's r185 WebGPURenderer then silently falls back to WebGL2 (which
//     would make this check pass for the wrong reason).
//   * MUST NOT pass `--enable-features=Vulkan,DefaultANGLEVulkan` — it forces
//     Dawn to try the Vulkan backend first, which fails, and requestAdapter()
//     then returns null even though D3D12 works. No flags needed: Chrome
//     enables WebGPU by default on secure contexts (localhost).
const HEADED = (process.env.WEBGPU_HEADED ?? '1') !== '0';
console.log(`WebGPU check → ${URL} (${HEADED ? 'headed' : 'headless'}, real Chrome, no SwiftShader)`);
const browser = await chromium.launch({
  channel: process.env.WEBGPU_CHANNEL || 'chrome',
  headless: !HEADED,
});

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
const infoMessages = [];
const pageErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
  if (msg.text().includes('[postfx]')) {
    infoMessages.push(msg.text());
    console.log(`      console.info: ${msg.text()}`);
  }
});
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Wait for the R3F canvas to mount and render a few frames. The viewport
// canvas is the LARGEST canvas on the page (the topo canvas is 256x256).
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(5000);

// 1. GPU / adapter — retry; the GPU process may still be starting when the
//    page loads, and the renderer itself holds one adapter.
let gpu = { ok: false, why: 'never resolved' };
for (let attempt = 1; attempt <= 6; attempt++) {
  gpu = await page.evaluate(async () => {
    if (!navigator.gpu) return { ok: false, why: 'navigator.gpu missing' };
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { ok: false, why: 'requestAdapter returned null' };
    const info = adapter.info || {};
    const isFallback = info.adapterType === 'cpu' || info.adapterType === 'swiftshader';
    return {
      ok: true,
      info: `${info.vendor || '?'} / ${info.architecture || '?'} / ${info.device || '?'}`, // eslint-disable-line prettier/prettier
      isFallback,
    };
  });
  if (gpu.ok) break;
  await page.waitForTimeout(1000);
}
check('navigator.gpu + adapter', gpu.ok, gpu.why || gpu.info);
check('adapter is hardware (not software)', gpu.ok && !gpu.isFallback, gpu.isFallback ? 'SOFTWARE ADAPTER' : gpu.info);

// 2. The viewport canvas must be a WebGPU presentation context (proves the
//    WebGPURenderer is on the WebGPU backend, not the silent WebGL2 fallback).
const wgpuCtx = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  const viewport = canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!viewport) return { ok: false, why: 'no canvas' };
  const ctx = viewport.getContext('webgpu');
  const gl2 = !!viewport.getContext('webgl2');
  return {
    ok: !!ctx,
    why: ctx
      ? 'webgpu context present'
      : gl2
        ? 'canvas is WebGL2 (three fell back — no WebGPU adapter)'
        : 'canvas has neither webgpu nor webgl2 context',
  };
});
check('viewport canvas is a WebGPU presentation context', wgpuCtx.ok, wgpuCtx.why);

// 3. Page errors
check('no page errors (WebGPURenderer boot)', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

// 4. Pixels — a WebGPU canvas can't be read back via 2d, so screenshot the
//    page and analyze the PNG in-page (draw to an offscreen 2d canvas).
const shot = await page.screenshot();
const pixel = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let nonBlack = 0;
  let sum = 0;
  const seen = new Set();
  for (let i = 0; i < data.length; i += 400) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sum += r + g + b;
    if (r + g + b > 30) nonBlack++;
    seen.add(`${r >> 4},${g >> 4},${b >> 4}`);
  }
  const samples = Math.ceil(data.length / 400);
  return {
    ok: nonBlack / samples > 0.2 && seen.size > 3,
    nonBlackPct: Math.round((100 * nonBlack) / samples),
    distinctColors: seen.size,
    meanBrightness: Math.round(sum / samples / 3),
  };
}, shot.toString('base64'));
check(
  'canvas renders non-blank, non-uniform pixels',
  pixel.ok,
  pixel.ok ? `${pixel.nonBlackPct}% lit · ${pixel.distinctColors} colors · μ=${pixel.meanBrightness}` : pixel.why,
);

// 5. FX toggle — find and click the FX button in the TopBar
let fxClicked = false;
try {
  await page.click('[aria-label*="post" i], [aria-label*="FX" i], text=FX', { timeout: 8000 });
  fxClicked = true;
} catch {
  // fall back to locating by role/title in the top bar
  const labels = await page.locator('button[title], button[aria-label]').allTextContents();
  const fxBtn = await page
    .locator('button')
    .filter({ hasText: /fx|post/i })
    .first();
  if ((await fxBtn.count()) > 0) {
    await fxBtn.click();
    fxClicked = true;
  }
}
await page.waitForTimeout(1500);
check('FX toggle clickable + no crash', fxClicked && pageErrors.length === 0, fxClicked ? '' : 'button not found');

// 6. WebGPU post path engaged — the feature-detect log is an info message
//    (captured on the console listener below, not in consoleErrors).
const postLogSeen = [...consoleErrors, ...infoMessages].some((t) => t.includes('[postfx]'));
check(
  'WebGPU post path engaged (three/tsl bloom feature-detect)',
  postLogSeen,
  postLogSeen ? 'bloom feature-detect logged' : 'post path never constructed (check server env)',
);

await browser.close();

const passed = results.filter(([, ok]) => ok).length;
console.log(`\n=== ${passed}/${results.length} WebGPU checks passed ===`);
if (passed !== results.length) process.exit(1);

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
    writable: true,
  });

  if (!('ImageData' in globalThis)) {
    class TestImageData {
      readonly data: Uint8ClampedArray;
      readonly width: number;
      readonly height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    Object.defineProperty(globalThis, 'ImageData', {
      configurable: true,
      value: TestImageData,
    });
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({ putImageData: vi.fn() })),
  });
});

afterEach(() => {
  cleanup();
});

import { describe, expect, it } from 'vitest';
import { resolveE2EPort } from '../../playwright.config';

describe('Playwright port configuration', () => {
  it('accepts valid TCP port values', () => {
    expect(resolveE2EPort(undefined)).toBe('3000');
    expect(resolveE2EPort('3302')).toBe('3302');
  });

  it('rejects values that could escape the port argument', () => {
    expect(() => resolveE2EPort('3302 && whoami')).toThrow(/PLAYWRIGHT_PORT/);
    expect(() => resolveE2EPort('0')).toThrow(/PLAYWRIGHT_PORT/);
    expect(() => resolveE2EPort('65536')).toThrow(/PLAYWRIGHT_PORT/);
  });
});

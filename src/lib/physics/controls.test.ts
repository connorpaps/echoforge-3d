import { describe, expect, it } from 'vitest';
import {
  createInputState,
  handleInputKeyDown,
  handleInputKeyUp,
  inputDirection,
} from '@/lib/physics/controls';

function key(key: string): KeyboardEvent {
  return { key } as KeyboardEvent;
}

describe('player input state', () => {
  it('starts idle', () => {
    const state = createInputState();
    expect(inputDirection(state)).toEqual([0, 0]);
    expect(state.jump).toBe(false);
  });

  it('tracks WASD down/up', () => {
    const state = createInputState();
    handleInputKeyDown(key('w'), state);
    handleInputKeyDown(key('d'), state);
    expect(inputDirection(state)).toEqual([1, 1]);

    handleInputKeyUp(key('w'), state);
    expect(inputDirection(state)).toEqual([0, 1]);

    handleInputKeyUp(key('d'), state);
    expect(inputDirection(state)).toEqual([0, 0]);
  });

  it('composes opposing keys to zero', () => {
    const state = createInputState();
    handleInputKeyDown(key('w'), state);
    handleInputKeyDown(key('s'), state);
    expect(inputDirection(state)).toEqual([0, 0]);
  });

  it('sets the jump flag and prevents page scroll on space', () => {
    const state = createInputState();
    const space = {
      key: ' ',
      preventDefault: () => {
        /* spy */
      },
    } as unknown as KeyboardEvent;
    const preventDefaultSpy = {
      called: false,
      fn: () => {
        preventDefaultSpy.called = true;
      },
    };
    space.preventDefault = preventDefaultSpy.fn;

    handleInputKeyDown(space, state);
    expect(state.jump).toBe(true);
    expect(preventDefaultSpy.called).toBe(true);

    handleInputKeyUp(space, state);
    expect(state.jump).toBe(false);
  });

  it('ignores unrelated keys', () => {
    const state = createInputState();
    handleInputKeyDown(key('q'), state);
    handleInputKeyUp(key('z'), state);
    expect(inputDirection(state)).toEqual([0, 0]);
  });
});

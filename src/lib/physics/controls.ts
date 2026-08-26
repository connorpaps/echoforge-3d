'use client';

import { useEffect, useRef } from 'react';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

export function createInputState(): InputState {
  return { forward: false, back: false, left: false, right: false, jump: false };
}

/** Track WASD + Space key state (docs/02_DESIGN_BRIEF.md §5). */
export function handleInputKeyDown(e: KeyboardEvent, state: InputState): void {
  switch (e.key.toLowerCase()) {
    case 'w':
      state.forward = true;
      break;
    case 'a':
      state.left = true;
      break;
    case 's':
      state.back = true;
      break;
    case 'd':
      state.right = true;
      break;
    case ' ':
      state.jump = true;
      e.preventDefault(); // stop page scroll
      break;
  }
}

export function handleInputKeyUp(e: KeyboardEvent, state: InputState): void {
  switch (e.key.toLowerCase()) {
    case 'w':
      state.forward = false;
      break;
    case 'a':
      state.left = false;
      break;
    case 's':
      state.back = false;
      break;
    case 'd':
      state.right = false;
      break;
    case ' ':
      state.jump = false;
      break;
  }
}

/** Returns [forward (+1..-1), strafe (+1..-1)] from the current input state. */
export function inputDirection(state: InputState): [number, number] {
  const forward = (state.forward ? 1 : 0) - (state.back ? 1 : 0);
  const strafe = (state.right ? 1 : 0) - (state.left ? 1 : 0);
  return [forward, strafe];
}

/** Subscribe WASD/Space keys into a stable ref the controller reads each frame. */
export function usePlayerInput(): { current: InputState } {
  const state = useRef(createInputState());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleInputKeyDown(e, state.current);
    const onKeyUp = (e: KeyboardEvent) => handleInputKeyUp(e, state.current);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return state;
}

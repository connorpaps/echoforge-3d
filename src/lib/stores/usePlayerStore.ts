import { create } from 'zustand';

export const PLAYER_SPAWN: [number, number, number] = [0, 5, 0];

/** Camera height above the capsule origin (eye level). */
export const EYE_HEIGHT = 1.6;

interface PlayerState {
  position: [number, number, number];
  grounded: boolean;
  setPosition: (position: [number, number, number]) => void;
  setGrounded: (grounded: boolean) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  position: [...PLAYER_SPAWN] as [number, number, number],
  grounded: false,

  setPosition: (position) => set({ position }),
  setGrounded: (grounded) => set({ grounded }),
  reset: () =>
    set({
      position: [...PLAYER_SPAWN] as [number, number, number],
      grounded: false,
    }),
}));

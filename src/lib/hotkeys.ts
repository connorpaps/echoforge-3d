import { useEffect } from 'react';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

/**
 * Global application hotkeys (docs/02_DESIGN_BRIEF.md §5).
 * - <Tab>         toggle editor ↔ play mode
 * - <Cmd/Ctrl+B>  collapse/expand the left creation drawer
 *
 * Extended with <M> push-to-talk and <Cmd/Ctrl+Z> undo in later tasks.
 */
export function handleGlobalKeyDown(e: KeyboardEvent): void {
  // Cmd/Ctrl+B — toggle left drawer
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    useUiStore.getState().toggleDrawer();
    return;
  }

  // Tab — toggle editor/play mode
  if (e.key === 'Tab') {
    e.preventDefault();
    const mode = useSceneStore.getState().activeMode;
    useSceneStore
      .getState()
      .setMode(mode === 'editor' ? 'play' : 'editor');
  }
}

/** Register the global keydown listener once; returns a cleanup function. */
export function useGlobalHotkeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
}

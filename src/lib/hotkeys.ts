import { useEffect } from 'react';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

export interface PushToTalkHandlers {
  begin: () => void;
  finish: () => void;
}

let pushToTalk: PushToTalkHandlers | null = null;

/** Register the active push-to-talk handlers (PromptBar owns these). */
export function registerPushToTalk(handlers: PushToTalkHandlers): () => void {
  pushToTalk = handlers;
  return () => {
    if (pushToTalk === handlers) pushToTalk = null;
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

/**
 * Global application hotkeys (docs/02_DESIGN_BRIEF.md §5).
 * - <Tab>          toggle editor ↔ play mode
 * - <Cmd/Ctrl+B>   collapse/expand the left creation drawer
 * - <M> (hold)     push-to-talk voice dictation (editor mode, not typing)
 */
export function handleGlobalKeyDown(e: KeyboardEvent): void {
  const { activeMode } = useSceneStore.getState();

  // Cmd/Ctrl+B — toggle left drawer
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    useUiStore.getState().toggleDrawer();
    return;
  }

  // Tab — toggle editor/play mode
  if (e.key === 'Tab') {
    e.preventDefault();
    useSceneStore
      .getState()
      .setMode(activeMode === 'editor' ? 'play' : 'editor');
    return;
  }

  // M (hold) — push-to-talk, editor mode only, never while typing
  if (
    activeMode === 'editor' &&
    !isTypingTarget(e.target) &&
    e.key.toLowerCase() === 'm'
  ) {
    if (!e.repeat && pushToTalk) {
      e.preventDefault();
      pushToTalk.begin();
    }
  }
}

export function handleGlobalKeyUp(e: KeyboardEvent): void {
  if (e.key.toLowerCase() === 'm' && pushToTalk) {
    pushToTalk.finish();
  }
}

/** Register the global key listeners once; returns a cleanup function. */
export function useGlobalHotkeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, []);
}

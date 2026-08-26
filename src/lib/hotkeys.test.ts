import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleGlobalKeyDown,
  handleGlobalKeyUp,
  registerPushToTalk,
} from '@/lib/hotkeys';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

function eventWith(key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
    metaKey: false,
    ctrlKey: false,
    repeat: false,
    target: document.body,
    ...extra,
  } as unknown as KeyboardEvent;
}

describe('global hotkeys', () => {
  beforeEach(() => {
    useSceneStore.setState({
      activeMode: 'editor',
      isRecordingVoice: false,
    });
    useUiStore.setState({ drawerCollapsed: false });
  });

  afterEach(() => {
    registerPushToTalk({ begin: () => {}, finish: () => {} });
  });

  it('Tab toggles editor <-> play mode', () => {
    const event = eventWith('Tab');
    handleGlobalKeyDown(event);
    expect(useSceneStore.getState().activeMode).toBe('play');
    expect(event.preventDefault).toHaveBeenCalled();

    handleGlobalKeyDown(eventWith('Tab'));
    expect(useSceneStore.getState().activeMode).toBe('editor');
  });

  it('Cmd/Ctrl+B toggles the left drawer', () => {
    handleGlobalKeyDown(eventWith('b', { metaKey: true }));
    expect(useUiStore.getState().drawerCollapsed).toBe(true);

    handleGlobalKeyDown(eventWith('b', { ctrlKey: true }));
    expect(useUiStore.getState().drawerCollapsed).toBe(false);
  });

  it('hold-M push-to-talk: keydown begins, keyup finishes', () => {
    const handlers = { begin: vi.fn(), finish: vi.fn() };
    registerPushToTalk(handlers);

    handleGlobalKeyDown(eventWith('m'));
    expect(handlers.begin).toHaveBeenCalledTimes(1);
    expect(handlers.begin.mock.calls[0][0]).toBeUndefined();

    handleGlobalKeyUp(eventWith('m'));
    expect(handlers.finish).toHaveBeenCalledTimes(1);
  });

  it('ignores auto-repeat keydowns for M', () => {
    const handlers = { begin: vi.fn(), finish: vi.fn() };
    registerPushToTalk(handlers);

    handleGlobalKeyDown(eventWith('m'));
    handleGlobalKeyDown(eventWith('m', { repeat: true }));
    expect(handlers.begin).toHaveBeenCalledTimes(1);
  });

  it('does not trigger push-to-talk while typing in an input', () => {
    const input = document.createElement('input');
    const handlers = { begin: vi.fn(), finish: vi.fn() };
    registerPushToTalk(handlers);

    handleGlobalKeyDown(eventWith('m', { target: input }));
    expect(handlers.begin).not.toHaveBeenCalled();
  });

  it('does not trigger push-to-talk in play mode', () => {
    useSceneStore.setState({ activeMode: 'play' });
    const handlers = { begin: vi.fn(), finish: vi.fn() };
    registerPushToTalk(handlers);

    handleGlobalKeyDown(eventWith('m'));
    expect(handlers.begin).not.toHaveBeenCalled();
  });

  it('M with no registered handlers is a no-op', () => {
    const unregister = registerPushToTalk({ begin: () => {}, finish: () => {} });
    unregister();
    expect(() => handleGlobalKeyDown(eventWith('m'))).not.toThrow();
  });
});

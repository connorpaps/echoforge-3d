import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/npc', () => ({
  requestNpcDialogue: vi.fn(),
}));

vi.mock('@/lib/audio/speechPlayback', () => ({
  speakDialogue: vi.fn().mockResolvedValue(undefined),
}));

import { requestNpcDialogue } from '@/lib/api/npc';
import { speakDialogue } from '@/lib/audio/speechPlayback';
import { useDialogueStore } from '@/lib/stores/useDialogueStore';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

const mockRequest = vi.mocked(requestNpcDialogue);
const mockSpeak = vi.mocked(speakDialogue);

function addNpc(id = 'npc-1') {
  useSceneStore.getState().addEntity({
    id,
    name: 'Guide',
    type: 'npc',
    position: [1, 0, 1],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    npcPersona: 'persona',
    npcVoice: 'af_heart',
    physics: { colliderType: 'cuboid', mass: 0 },
  } as SceneEntity);
}

describe('useDialogueStore', () => {
  beforeEach(() => {
    useDialogueStore.getState().clear();
    useSceneStore.setState({ entities: {} });
    mockRequest.mockReset();
    mockSpeak.mockReset();
  });

  it('speak fetches dialogue, stores it, and triggers spatial TTS', async () => {
    addNpc();
    mockRequest.mockResolvedValue({
      jobId: 'n1',
      dialogueText: 'I see your campfire.',
      synthetic: false,
      elapsedMs: 300,
    });

    await useDialogueStore.getState().speak('npc-1', 'data:image/png;base64,x');

    const state = useDialogueStore.getState();
    expect(state.thinking).toBe(false);
    expect(state.dialogue).toMatchObject({
      entityId: 'npc-1',
      text: 'I see your campfire.',
    });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ frameBase64: expect.stringContaining('base64') }),
    );
    expect(mockSpeak).toHaveBeenCalledWith('I see your campfire.', {
      voice: 'af_heart',
      position: [1, 0, 1],
    });
  });

  it('marks replies as thinking and swallows failures into error', async () => {
    addNpc();
    mockRequest.mockRejectedValue(new Error('backend offline'));

    const promise = useDialogueStore.getState().speak('npc-1', 'frame');
    expect(useDialogueStore.getState().thinking).toBe(true);

    await promise;
    const state = useDialogueStore.getState();
    expect(state.thinking).toBe(false);
    expect(state.dialogue).toBeNull();
    expect(state.error).toContain('backend offline');
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('clear resets dialogue and error', () => {
    useDialogueStore.setState({
      dialogue: { entityId: 'npc-1', text: 'hi', synthetic: false, ts: 1 },
      error: 'x',
      thinking: true,
    });
    useDialogueStore.getState().clear();
    expect(useDialogueStore.getState().dialogue).toBeNull();
    expect(useDialogueStore.getState().error).toBeNull();
    expect(useDialogueStore.getState().thinking).toBe(false);
  });
});

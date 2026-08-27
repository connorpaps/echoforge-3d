import { create } from 'zustand';
import { requestNpcDialogue } from '@/lib/api/npc';
import { speakDialogue } from '@/lib/audio/speechPlayback';
import { useSceneStore } from '@/lib/stores/useSceneStore';

export interface DialogueLine {
  entityId: string;
  text: string;
  /** True when the backend served the canned fallback, not SmolVLM. */
  synthetic: boolean;
  ts: number;
}

interface DialogueState {
  /** The latest NPC line (or null once dismissed). */
  dialogue: DialogueLine | null;
  thinking: boolean;
  error: string | null;
  /** Ask the nearest NPC about the current viewport frame. */
  speak: (
    entityId: string,
    frameBase64: string,
    persona?: string,
  ) => Promise<void>;
  clear: () => void;
}

/**
 * Vision-NPC dialogue state (Task 3.3): capture a viewport frame, ask the
 * backend SmolVLM service, surface the line in the DialogueBubble, and
 * synthesize it with the Kokoro TTS worker (Task 3.4).
 */
export const useDialogueStore = create<DialogueState>()((set, get) => ({
  dialogue: null,
  thinking: false,
  error: null,

  speak: async (entityId, frameBase64, persona) => {
    if (get().thinking) return;
    set({ thinking: true, error: null });
    try {
      const result = await requestNpcDialogue({ frameBase64, persona });
      set({
        thinking: false,
        dialogue: {
          entityId,
          text: result.dialogueText,
          synthetic: result.synthetic,
          ts: Date.now(),
        },
      });
      // Fire-and-forget TTS — spatial audio at the NPC's position.
      const entity = useSceneStore.getState().entities[entityId];
      if (entity) {
        void speakDialogue(result.dialogueText, {
          voice: entity.npcVoice ?? 'af_heart',
          position: entity.position,
        }).catch((err: unknown) => {
          console.error('[dialogue] TTS playback failed', err);
        });
      }
    } catch (error) {
      set({
        thinking: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  clear: () => set({ dialogue: null, error: null, thinking: false }),
}));

import { isE2EMode } from '@/workers/workerRegistry';

/**
 * Vision-aware NPC dialogue client (docs/04_API_CONTRACTS.md, Task 3.3).
 * Sends the viewport frame + persona to the backend SmolVLM service and
 * returns the NPC's reply. In E2E hermetic mode a deterministic fixture
 * transcript is returned so the interaction is testable with no GPU.
 */

export const NPC_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export interface NpcDialogueResult {
  jobId: string;
  dialogueText: string;
  /** True when the backend served the canned fallback (SmolVLM offline). */
  synthetic: boolean;
  elapsedMs: number;
}

export const DEFAULT_PERSONA =
  'You are a wise forest guide inside a 3D world. React to what you see in ' +
  'the frame and keep your reply to 1-2 short sentences.';

export async function requestNpcDialogue(request: {
  frameBase64: string;
  persona?: string;
}): Promise<NpcDialogueResult> {
  if (isE2EMode()) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      jobId: 'e2e-npc-000004',
      dialogueText: 'I can see your campfire glowing — perfect for storytelling.',
      synthetic: true,
      elapsedMs: 150,
    };
  }

  const response = await fetch(`${NPC_API_BASE}/api/v1/npc-dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new Error(detail);
  }
  return (await response.json()) as NpcDialogueResult;
}

/**
 * Web Audio HRTF 3D spatial bus (Task 3.2 — docs/03_TECH_SPEC.md §5).
 *
 * A lazy, shared AudioContext plus a `SpatialAudioEmitter` that renders an
 * AudioBufferSourceNode through an HRTF PannerNode (inverse distance model),
 * so emitters pan and attenuate correctly as the listener (camera) moves.
 *
 * The AudioContext is created lazily — browsers require a user gesture before
 * audio runs, so `resumeAudioContext()` should be called from click/hotkey
 * handlers. Environments without AudioContext (headless jsdom) degrade to
 * safe no-ops.
 */

let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedContext) return sharedContext;
  const Ctor =
    window.AudioContext ??
    (
      window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!Ctor) return null;
  sharedContext = new Ctor();
  return sharedContext;
}

/** Unlock/resume the shared context; safe to call from any user gesture. */
export function resumeAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Decode a base64 WAV into an AudioBuffer (WAV is natively supported). */
export async function decodeWavBase64(
  ctx: AudioContext,
  wavBase64: string,
): Promise<AudioBuffer> {
  return ctx.decodeAudioData(base64ToArrayBuffer(wavBase64));
}

export interface SpatialEmitterOptions {
  volume?: number;
  falloffDistance?: number;
  loop?: boolean;
}

const REF_DISTANCE = 2;
const ROLLOFF_FACTOR = 1.2;

/**
 * A positional, looping audio emitter rendered through an HRTF panner
 * (docs/03_TECH_SPEC.md §5). The panner feeds a GainNode so volume can be
 * changed live without clicks (setTargetAtTime).
 */
export class SpatialAudioEmitter {
  readonly panner: PannerNode;
  private readonly ctx: AudioContext;
  private readonly gain: GainNode;
  private readonly loop: boolean;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;

  constructor(
    ctx: AudioContext,
    position: [number, number, number],
    options: SpatialEmitterOptions = {},
  ) {
    this.ctx = ctx;
    this.loop = options.loop ?? true;

    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = REF_DISTANCE;
    this.panner.rolloffFactor = ROLLOFF_FACTOR;
    this.panner.coneInnerAngle = 360;
    this.panner.coneOuterAngle = 360;
    this.panner.maxDistance = Math.max(
      options.falloffDistance ?? 15,
      REF_DISTANCE,
    );

    this.gain = ctx.createGain();
    this.gain.gain.value = options.volume ?? 0.8;

    this.panner.connect(this.gain);
    this.gain.connect(ctx.destination);

    this.setPosition(position);
  }

  get hasBuffer(): boolean {
    return this.buffer !== null;
  }

  setPosition(position: [number, number, number]): void {
    const t = this.ctx.currentTime;
    this.panner.positionX.setValueAtTime(position[0], t);
    this.panner.positionY.setValueAtTime(position[1], t);
    this.panner.positionZ.setValueAtTime(position[2], t);
  }

  setVolume(volume: number): void {
    this.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  setBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  play(): void {
    if (!this.buffer) return;
    this.stop();
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loop;
    source.connect(this.panner);
    source.start();
    this.source = source;
  }

  /**
   * Play the buffer once (NPC speech), then dispose this emitter — the
   * panner/gain graph is owned by the utterance, not cached by an entity.
   */
  playOneShot(onEnded?: () => void): void {
    if (!this.buffer) return;
    this.stop();
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.loop = false;
    source.connect(this.panner);
    source.onended = () => {
      this.dispose();
      onEnded?.();
    };
    source.start();
    this.source = source;
  }

  stop(): void {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      // already stopped — ignore
    }
    this.source.disconnect();
    this.source = null;
  }

  dispose(): void {
    this.stop();
    this.panner.disconnect();
    this.gain.disconnect();
  }
}

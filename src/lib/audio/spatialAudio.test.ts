import { describe, expect, it, vi } from 'vitest';
import {
  base64ToArrayBuffer,
  SpatialAudioEmitter,
} from '@/lib/audio/spatialAudio';

// --- minimal AudioContext fakes (jsdom has no Web Audio) -----------------------

class FakeParam {
  value = 0;
  setValueAtTime(value: number): this {
    this.value = value;
    return this;
  }
  setTargetAtTime(value: number): this {
    this.value = value;
    return this;
  }
}

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakePanner extends FakeNode {
  panningModel = '';
  distanceModel = '';
  refDistance = 0;
  rolloffFactor = 0;
  coneInnerAngle = 0;
  coneOuterAngle = 0;
  maxDistance = 0;
  positionX = new FakeParam();
  positionY = new FakeParam();
  positionZ = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

function makeCtx() {
  return {
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    createPanner: () => new FakePanner(),
    createGain: () => new FakeGain(),
    createBufferSource: () => new FakeSource(),
    decodeAudioData: vi.fn().mockResolvedValue({ length: 1 }),
  } as unknown as AudioContext;
}

// --- helpers -------------------------------------------------------------------

describe('base64ToArrayBuffer', () => {
  it('decodes base64 back to the original bytes', () => {
    const original = new TextEncoder().encode('RIFF\x01\x02\x03');
    const decoded = new Uint8Array(
      base64ToArrayBuffer(btoa(String.fromCharCode(...original))),
    );
    expect([...decoded]).toEqual([...original]);
  });
});

// --- SpatialAudioEmitter ---------------------------------------------------------

describe('SpatialAudioEmitter', () => {
  it('configures HRTF inverse-distance panning with sane defaults', () => {
    const ctx = makeCtx();
    const emitter = new SpatialAudioEmitter(ctx, [1, 2, 3]);

    expect(emitter.panner.panningModel).toBe('HRTF');
    expect(emitter.panner.distanceModel).toBe('inverse');
    expect(emitter.panner.refDistance).toBe(2);
    expect(emitter.panner.rolloffFactor).toBe(1.2);
    expect(emitter.panner.coneInnerAngle).toBe(360);
    expect(emitter.panner.maxDistance).toBe(15);
  });

  it('honors per-emitter falloff and clamps to the ref distance', () => {
    const ctx = makeCtx();
    const near = new SpatialAudioEmitter(ctx, [0, 0, 0], { falloffDistance: 1 });
    expect(near.panner.maxDistance).toBe(2); // clamped

    const far = new SpatialAudioEmitter(ctx, [0, 0, 0], { falloffDistance: 40 });
    expect(far.panner.maxDistance).toBe(40);
  });

  it('writes position and volume into the audio params', () => {
    const ctx = makeCtx();
    const panner = new FakePanner();
    const gain = new FakeGain();
    ctx.createPanner = () => panner as unknown as PannerNode;
    ctx.createGain = () => gain as unknown as GainNode;
    const emitter = new SpatialAudioEmitter(ctx, [0, 0, 0], { volume: 0.5 });

    expect(panner.positionX.value).toBe(0);
    emitter.setPosition([10, 20, 30]);
    expect(panner.positionX.value).toBe(10);
    expect(panner.positionY.value).toBe(20);
    expect(panner.positionZ.value).toBe(30);

    emitter.setVolume(0.25);
    expect(gain.gain.value).toBe(0.25);
  });

  it('plays the buffer through a looping source and stops cleanly', () => {
    const ctx = makeCtx();
    const panner = new FakePanner();
    const source = new FakeSource();
    ctx.createPanner = () => panner as unknown as PannerNode;
    ctx.createBufferSource = () => source as unknown as AudioBufferSourceNode;
    const emitter = new SpatialAudioEmitter(ctx, [0, 0, 0]);

    // no buffer → no-op
    emitter.play();
    expect(source.start).not.toHaveBeenCalled();

    emitter.setBuffer({ length: 2 } as AudioBuffer);
    emitter.play();
    expect(source.loop).toBe(true);
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(source.connect).toHaveBeenCalled();

    emitter.stop();
    expect(source.stop).toHaveBeenCalled();
    emitter.dispose();
    expect(panner.disconnect).toHaveBeenCalled();
  });

  it('tracks buffer presence', () => {
    const ctx = makeCtx();
    const emitter = new SpatialAudioEmitter(ctx, [0, 0, 0]);
    expect(emitter.hasBuffer).toBe(false);
    emitter.setBuffer({ length: 1 } as AudioBuffer);
    expect(emitter.hasBuffer).toBe(true);
  });
});

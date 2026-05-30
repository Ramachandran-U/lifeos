/**
 * Unit tests for the WEB PcmPlayer scheduling + autoplay-unlock path — the code
 * that was silent before (suspended context never resumed, no webkit fallback).
 * We force Platform.OS='web' and inject a fake AudioContext so the real
 * scheduling logic runs under Node.
 */

class FakeBufferSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect() {}
  disconnect() {}
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeAudioContext {
  state: 'running' | 'suspended' | 'closed';
  currentTime = 0;
  destination = {};
  resumeCalls = 0;
  sources: FakeBufferSource[] = [];
  constructor(_opts?: unknown) {
    // Browsers start suspended until a gesture — model that here.
    this.state = 'suspended';
  }
  resume() {
    this.resumeCalls++;
    this.state = 'running';
    return Promise.resolve();
  }
  createBuffer(channels: number, length: number, _rate: number) {
    return {
      duration: length / 24000,
      getChannelData: () => new Float32Array(length),
    };
  }
  createBufferSource() {
    const s = new FakeBufferSource();
    this.sources.push(s);
    return s;
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

describe('web PcmPlayer (autoplay unlock + scheduling)', () => {
  let lastCtx: FakeAudioContext | null = null;

  beforeEach(() => {
    jest.resetModules();
    lastCtx = null;
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = function (
      this: unknown,
      opts?: unknown,
    ) {
      const c = new FakeAudioContext(opts);
      lastCtx = c;
      return c;
    } as unknown as typeof AudioContext;
  });

  afterEach(() => {
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
  });

  function loadPlayer() {
    let createPcmPlayer!: typeof import('@/ai/pcmPlayer').createPcmPlayer;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const rn = require('react-native');
      rn.Platform.OS = 'web';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      createPcmPlayer = require('@/ai/pcmPlayer').createPcmPlayer;
    });
    return createPcmPlayer;
  }

  function pcm(samples: number[]): string {
    const buf = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => buf.writeInt16LE(s, i * 2));
    return buf.toString('base64');
  }

  it('resume() lifts the suspended (autoplay-blocked) context', () => {
    const createPcmPlayer = loadPlayer();
    const player = createPcmPlayer();
    player.resume();
    expect(lastCtx).not.toBeNull();
    expect(lastCtx!.state).toBe('running');
    expect(lastCtx!.resumeCalls).toBeGreaterThanOrEqual(1);
  });

  it('enqueue schedules a source, fires onStart, and resumes if suspended', () => {
    const createPcmPlayer = loadPlayer();
    const onStart = jest.fn();
    const player = createPcmPlayer({ onStart });
    player.enqueue(pcm([100, -100, 200, -200]));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(player.isPlaying()).toBe(true);
    expect(lastCtx!.sources.length).toBe(1);
    expect(lastCtx!.sources[0].started).toBe(true);
    expect(lastCtx!.state).toBe('running'); // was resumed on enqueue
  });

  it('endTurn is a no-op on web (streams live)', () => {
    const createPcmPlayer = loadPlayer();
    const player = createPcmPlayer();
    expect(() => player.endTurn()).not.toThrow();
  });

  it('stop() halts scheduled sources and clears playing state', () => {
    const createPcmPlayer = loadPlayer();
    const player = createPcmPlayer();
    player.enqueue(pcm([1, 2, 3, 4]));
    player.stop();
    expect(lastCtx!.sources[0].stopped).toBe(true);
    expect(player.isPlaying()).toBe(false);
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { PcmStreamPlayer } from "./player";

class MockSource {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  readonly start = vi.fn();
  readonly stop = vi.fn(() => this.onended?.());
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

class MockAudioContext {
  currentTime = 1;
  state = "running";
  destination = {};
  readonly sources: MockSource[] = [];

  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      duration: length / sampleRate,
      copyToChannel: vi.fn(),
    };
  }

  createBufferSource() {
    const source = new MockSource();
    this.sources.push(source);
    return source;
  }

  close = vi.fn(async () => undefined);
  resume = vi.fn(async () => undefined);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PcmStreamPlayer", () => {
  it("stops and disconnects queued sources", () => {
    const context = new MockAudioContext();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return context;
        }
      },
    );
    const player = new PcmStreamPlayer(16000);
    const onIdle = vi.fn();
    player.onIdle(onIdle);

    player.feed(new ArrayBuffer(4));
    expect(player.isPlaying()).toBe(true);

    player.stop();

    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce();
    expect(player.isPlaying()).toBe(false);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("notifies idle after the last source ends", () => {
    const context = new MockAudioContext();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return context;
        }
      },
    );
    const player = new PcmStreamPlayer(16000);
    const onIdle = vi.fn();
    player.onIdle(onIdle);

    player.feed(new ArrayBuffer(4));
    context.sources[0].onended?.();

    expect(player.isPlaying()).toBe(false);
    expect(onIdle).toHaveBeenCalledOnce();
  });
});

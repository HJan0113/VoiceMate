import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerEvent } from "./domain/types";
import App from "./App";

const audio = vi.hoisted(() => ({
  event: null as ((event: ServerEvent) => void) | null,
  downlink: null as ((chunk: ArrayBuffer) => void) | null,
  capture: null as ((chunk: ArrayBuffer) => void) | null,
  sendAudio: vi.fn(),
  feed: vi.fn(),
  setMuted: vi.fn(),
}));

vi.mock("./services/api", () => ({
  createSession: async () => ({
    sessionId: "session",
    wsUrl: "/ws",
    ephemeralToken: "token",
  }),
}));
vi.mock("./services/realtime", () => ({
  RealtimeClient: class {
    connect = async () => {
      audio.event?.({ type: "session.ready" });
    };
    on = (listener: (event: ServerEvent) => void) => {
      audio.event = listener;
      return () => {
        audio.event = null;
      };
    };
    onAudio = (listener: (chunk: ArrayBuffer) => void) => {
      audio.downlink = listener;
      return () => {
        audio.downlink = null;
      };
    };
    sendAudio = audio.sendAudio;
    startTurn = vi.fn();
    stopTurn = vi.fn();
    interrupt = vi.fn();
    close = vi.fn();
  },
}));
vi.mock("./features/voice/capture", () => ({
  MicrophoneCapture: class {
    start = async (listener: (chunk: ArrayBuffer) => void) => {
      audio.capture = listener;
    };
    stop = vi.fn();
  },
}));
vi.mock("./features/voice/player", () => ({
  PcmStreamPlayer: class {
    feed = audio.feed;
    setMuted = audio.setMuted;
    ensureContext = vi.fn();
    stop = vi.fn();
    close = vi.fn();
    isPlaying = () => false;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  audio.capture = null;
});

async function startRecording() {
  render(<App />);
  await screen.findByRole("button", { name: "开始输入" });
  fireEvent.mouseDown(screen.getByRole("button", { name: "开始输入" }));
  await waitFor(() => expect(audio.capture).not.toBeNull());
}

describe("independent audio controls", () => {
  it("mutes microphone upload without silencing the reply and resumes upload when unmuted", async () => {
    await startRecording();
    const chunk = new ArrayBuffer(4);
    fireEvent.click(screen.getByRole("button", { name: "静音麦克风" }));
    act(() => {
      audio.capture?.(chunk);
      audio.downlink?.(chunk);
    });
    expect(audio.sendAudio).not.toHaveBeenCalled();
    expect(audio.feed).toHaveBeenCalledWith(chunk);
    expect(audio.setMuted).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: "静音扬声器" })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "取消麦克风静音" }));
    act(() => {
      audio.capture?.(chunk);
    });
    expect(audio.sendAudio).toHaveBeenCalledWith(chunk);
  });

  it("mutes speaker playback without blocking microphone upload", async () => {
    await startRecording();
    const chunk = new ArrayBuffer(4);
    fireEvent.click(screen.getByRole("button", { name: "静音扬声器" }));
    act(() => {
      audio.capture?.(chunk);
    });
    expect(audio.sendAudio).toHaveBeenCalledWith(chunk);
    expect(audio.setMuted).toHaveBeenLastCalledWith(true);
    expect(
      screen
        .getByRole("button", { name: "静音麦克风" })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "取消扬声器静音" }));
    expect(audio.setMuted).toHaveBeenLastCalledWith(false);
  });

  it("resets both controls and the player when a session ends", async () => {
    await startRecording();
    fireEvent.click(screen.getByRole("button", { name: "静音麦克风" }));
    fireEvent.click(screen.getByRole("button", { name: "静音扬声器" }));
    fireEvent.mouseUp(screen.getByRole("button", { name: "松开发送" }));
    fireEvent.click(screen.getByRole("button", { name: "结束会话" }));
    expect(audio.setMuted).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "开始会话" }));
    await screen.findByRole("button", { name: "静音麦克风" });
    expect(
      screen
        .getByRole("button", { name: "静音扬声器" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.mouseDown(screen.getByRole("button", { name: "开始输入" }));
    const chunk = new ArrayBuffer(4);
    act(() => {
      audio.capture?.(chunk);
    });
    expect(audio.sendAudio).toHaveBeenCalledWith(chunk);
  });
});

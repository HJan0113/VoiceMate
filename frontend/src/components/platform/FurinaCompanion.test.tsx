// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FurinaCompanion } from "./FurinaCompanion";

describe("FurinaCompanion", () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders idle video by default when emotion is neutral", () => {
    render(<FurinaCompanion state="ready" emotion="neutral" />);

    const idleVideo = screen.getByTestId("furina-video-idle");
    const happyVideo = screen.getByTestId("furina-video-happy");

    expect(idleVideo.className).toContain("furina-video-active");
    expect(happyVideo.className).toContain("furina-video-hidden");
    expect(screen.queryByTestId("furina-happy-badge")).toBeNull();
  });

  it("switches to happy video and displays badge when emotion is happy", () => {
    render(<FurinaCompanion state="speaking" emotion="happy" />);

    const idleVideo = screen.getByTestId("furina-video-idle");
    const happyVideo = screen.getByTestId("furina-video-happy");

    expect(happyVideo.className).toContain("furina-video-active");
    expect(idleVideo.className).toContain("furina-video-hidden");
    expect(screen.getByTestId("furina-happy-badge")).not.toBeNull();
    expect(screen.getByTestId("furina-happy-badge").textContent).toContain(
      "开心",
    );
  });

  it("switches to happy video when emotion is '开心'", () => {
    render(<FurinaCompanion state="ready" emotion="开心" />);

    const idleVideo = screen.getByTestId("furina-video-idle");
    const happyVideo = screen.getByTestId("furina-video-happy");

    expect(happyVideo.className).toContain("furina-video-active");
    expect(idleVideo.className).toContain("furina-video-hidden");
  });

  it.each([
    "loving",
    "laughing",
    "funny",
    "winking",
    "relaxed",
    "delicious",
    "kissy",
    "confident",
    "silly",
    "cool",
  ])("switches to happy video when emotion is '%s'", (simulatedEmotion) => {
    render(<FurinaCompanion state="ready" emotion={simulatedEmotion} />);

    const idleVideo = screen.getByTestId("furina-video-idle");
    const happyVideo = screen.getByTestId("furina-video-happy");

    expect(happyVideo.className).toContain("furina-video-active");
    expect(idleVideo.className).toContain("furina-video-hidden");
    expect(screen.getByTestId("furina-happy-badge")).not.toBeNull();
  });
});

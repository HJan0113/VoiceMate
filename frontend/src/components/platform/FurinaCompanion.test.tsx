// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("switches to sad video and displays badge when emotion is sad", () => {
    render(<FurinaCompanion state="speaking" emotion="sad" />);

    const idleVideo = screen.getByTestId("furina-video-idle");
    const happyVideo = screen.getByTestId("furina-video-happy");
    const sadVideo = screen.getByTestId("furina-video-sad");

    expect(sadVideo.className).toContain("furina-video-active");
    expect(idleVideo.className).toContain("furina-video-hidden");
    expect(happyVideo.className).toContain("furina-video-hidden");
    expect(screen.getByTestId("furina-sad-badge")).not.toBeNull();
    expect(screen.getByTestId("furina-sad-badge").textContent).toContain(
      "伤心",
    );
  });

  it.each(["crying", "伤心", "难过", "weeping", "tears", "哭泣", "委屈"])(
    "switches to sad video when emotion is '%s'",
    (simulatedEmotion) => {
      render(<FurinaCompanion state="ready" emotion={simulatedEmotion} />);

      const idleVideo = screen.getByTestId("furina-video-idle");
      const happyVideo = screen.getByTestId("furina-video-happy");
      const sadVideo = screen.getByTestId("furina-video-sad");

      expect(sadVideo.className).toContain("furina-video-active");
      expect(idleVideo.className).toContain("furina-video-hidden");
      expect(happyVideo.className).toContain("furina-video-hidden");
      expect(screen.getByTestId("furina-sad-badge")).not.toBeNull();
    },
  );

  it("switches to angry video and displays badge when emotion is angry", () => {
    render(<FurinaCompanion state="speaking" emotion="angry" />);

    const idleVideo = screen.getByTestId("furina-video-idle");
    const happyVideo = screen.getByTestId("furina-video-happy");
    const sadVideo = screen.getByTestId("furina-video-sad");
    const angryVideo = screen.getByTestId("furina-video-angry");

    expect(angryVideo.className).toContain("furina-video-active");
    expect(idleVideo.className).toContain("furina-video-hidden");
    expect(happyVideo.className).toContain("furina-video-hidden");
    expect(sadVideo.className).toContain("furina-video-hidden");
    expect(screen.getByTestId("furina-angry-badge")).not.toBeNull();
    expect(screen.getByTestId("furina-angry-badge").textContent).toContain(
      "愤怒",
    );
  });

  it.each([
    "pout",
    "annoyed",
    "furious",
    "rage",
    "mad",
    "displeased",
    "愤怒",
    "生气",
    "发怒",
    "气恼",
  ])("switches to angry video when emotion is '%s'", (simulatedEmotion) => {
    render(<FurinaCompanion state="ready" emotion={simulatedEmotion} />);

    const idleVideo = screen.getByTestId("furina-video-idle");
    const happyVideo = screen.getByTestId("furina-video-happy");
    const sadVideo = screen.getByTestId("furina-video-sad");
    const angryVideo = screen.getByTestId("furina-video-angry");

    expect(angryVideo.className).toContain("furina-video-active");
    expect(idleVideo.className).toContain("furina-video-hidden");
    expect(happyVideo.className).toContain("furina-video-hidden");
    expect(sadVideo.className).toContain("furina-video-hidden");
    expect(screen.getByTestId("furina-angry-badge")).not.toBeNull();
  });

  it("triggers head-pat feedback only when the hitbox is enabled", () => {
    const onHeadPat = vi.fn().mockReturnValue(true);
    render(
      <FurinaCompanion
        state="ready"
        emotion="neutral"
        canHeadPat
        onHeadPat={onHeadPat}
      />,
    );

    const hitbox = screen.getByTestId("furina-head-hitbox");
    expect((hitbox as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(hitbox);

    expect(onHeadPat).toHaveBeenCalledOnce();
    expect(screen.getByTestId("furina-character-frame").className).toContain(
      "head-pat-active",
    );
  });
});

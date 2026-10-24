// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionState } from "../../domain/types";
import { ControlPanel } from "./ControlPanel";

function renderPanel(state: ConnectionState = "ready") {
  const onSessionAction = vi.fn();
  const onEndSession = vi.fn();
  const onInputAction = vi.fn();
  const onToggleMute = vi.fn();
  render(
    <ControlPanel
      state={state}
      notice="状态提示"
      muted={false}
      onSessionAction={onSessionAction}
      onEndSession={onEndSession}
      onInputAction={onInputAction}
      onToggleMute={onToggleMute}
    />,
  );
  return { onSessionAction, onEndSession, onInputAction, onToggleMute };
}

describe("ControlPanel", () => {
  it("exposes input, mute, and end actions for a ready session", () => {
    const actions = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "开始输入" }));
    fireEvent.click(screen.getByRole("button", { name: "静音" }));
    fireEvent.click(screen.getByRole("button", { name: "结束会话" }));

    expect(actions.onInputAction).toHaveBeenCalledOnce();
    expect(actions.onToggleMute).toHaveBeenCalledOnce();
    expect(actions.onEndSession).toHaveBeenCalledOnce();
  });

  it("offers retry while the session is in error", () => {
    const { onSessionAction } = renderPanel("error");

    fireEvent.click(screen.getByRole("button", { name: "重试连接" }));

    expect(onSessionAction).toHaveBeenCalledOnce();
  });
});

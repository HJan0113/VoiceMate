// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionState } from "../../domain/types";
import { ControlPanel } from "./ControlPanel";
import { PlatformLayout } from "./PlatformLayout";
import { TranscriptPanel } from "./TranscriptPanel";

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

describe("PlatformLayout", () => {
  it("opens the dashboard dialog when clicking the trigger button", () => {
    render(
      <PlatformLayout
        state="ready"
        notice="服务已就绪"
        error={null}
        sessionId="sess_123"
        lines={[{ id: "1", role: "assistant", text: "你好呀" }]}
        disabled={false}
        muted={false}
        emotion="happy"
        assistantText="你好呀"
        onSessionAction={vi.fn()}
        onEndSession={vi.fn()}
        onToggleMute={vi.fn()}
        onStartVoice={vi.fn()}
        onStopVoice={vi.fn()}
        onSendText={vi.fn()}
      />,
    );

    const dashboardTrigger = screen.getByRole("button", {
      name: "打开会话仪表盘",
    });
    fireEvent.click(dashboardTrigger);

    expect(screen.getByText("实时会话仪表盘")).toBeTruthy();
    expect(screen.getByText("sess_123")).toBeTruthy();
  });

  it("keeps latest transcript messages in view unless user scrolls up", () => {
    const initialLines = [
      { id: "1", role: "user" as const, text: "第一条" },
      { id: "2", role: "assistant" as const, text: "第二条" },
    ];
    const { container, rerender } = render(
      <TranscriptPanel lines={initialLines} emptyMessage="空" />,
    );

    const listEl = container.querySelector(
      ".transcript-list",
    ) as HTMLDivElement;
    Object.defineProperty(listEl, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(listEl, "clientHeight", {
      configurable: true,
      value: 200,
    });

    // 追加新消息时若处于底部，应自动滚动到最新底部
    rerender(
      <TranscriptPanel
        lines={[
          ...initialLines,
          { id: "3", role: "user" as const, text: "第三条" },
        ]}
        emptyMessage="空"
      />,
    );
    expect(listEl.scrollTop).toBe(500);

    // 用户手动上滑浏览历史记录后，新消息不再强行拉回底部
    listEl.scrollTop = 100;
    fireEvent.scroll(listEl);

    Object.defineProperty(listEl, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    rerender(
      <TranscriptPanel
        lines={[
          ...initialLines,
          { id: "3", role: "user" as const, text: "第三条" },
          { id: "4", role: "assistant" as const, text: "第四条" },
        ]}
        emptyMessage="空"
      />,
    );
    expect(listEl.scrollTop).toBe(100);
  });
});

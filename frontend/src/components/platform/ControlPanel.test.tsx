// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectionState } from "../../domain/types";
import { ControlPanel } from "./ControlPanel";
import { DashboardDialog } from "./DashboardDialog";
import { PlatformLayout } from "./PlatformLayout";
import { TranscriptPanel } from "./TranscriptPanel";

afterEach(() => {
  cleanup();
});

function renderPanel(state: ConnectionState = "ready") {
  const onSessionAction = vi.fn();
  const onEndSession = vi.fn();
  const onInputAction = vi.fn();
  const onToggleMicrophoneMute = vi.fn();
  const onToggleSpeakerMute = vi.fn();
  render(
    <ControlPanel
      state={state}
      notice="状态提示"
      microphoneMuted={false}
      speakerMuted={false}
      onSessionAction={onSessionAction}
      onEndSession={onEndSession}
      onInputAction={onInputAction}
      onToggleMicrophoneMute={onToggleMicrophoneMute}
      onToggleSpeakerMute={onToggleSpeakerMute}
    />,
  );
  return {
    onSessionAction,
    onEndSession,
    onInputAction,
    onToggleMicrophoneMute,
    onToggleSpeakerMute,
  };
}

describe("ControlPanel", () => {
  it("exposes input, mute, and end actions for a ready session", () => {
    const actions = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "开始输入" }));
    fireEvent.click(screen.getByRole("button", { name: "静音麦克风" }));
    fireEvent.click(screen.getByRole("button", { name: "结束会话" }));

    expect(actions.onInputAction).toHaveBeenCalledOnce();
    expect(actions.onToggleMicrophoneMute).toHaveBeenCalledOnce();
    expect(actions.onToggleSpeakerMute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "静音扬声器" }));
    expect(actions.onToggleSpeakerMute).toHaveBeenCalledOnce();
    expect(actions.onToggleMicrophoneMute).toHaveBeenCalledOnce();
    expect(actions.onEndSession).toHaveBeenCalledOnce();
  });

  it("offers retry while the session is in error", () => {
    const { onSessionAction } = renderPanel("error");

    fireEvent.click(screen.getByRole("button", { name: "重试连接" }));

    expect(onSessionAction).toHaveBeenCalledOnce();
  });
});

describe("PlatformLayout", () => {
  it("submits dashboard text only when the session is ready", () => {
    const onSendText = vi.fn().mockReturnValue(true);
    const { rerender } = render(
      <DashboardDialog
        state="ready"
        error={null}
        microphoneMuted={false}
        speakerMuted={false}
        lines={[]}
        onSendText={onSendText}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开会话仪表盘" }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSendText).toHaveBeenCalledWith("你好");
    expect((input as HTMLInputElement).value).toBe("");

    rerender(
      <DashboardDialog
        state="processing"
        error={null}
        microphoneMuted={false}
        speakerMuted={false}
        lines={[]}
        onSendText={onSendText}
      />,
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it("opens the dashboard dialog when clicking the trigger button", () => {
    render(
      <PlatformLayout
        state="ready"
        notice="服务已就绪"
        error={null}
        sessionId="sess_123"
        lines={[{ id: "1", role: "assistant", text: "你好呀" }]}
        disabled={false}
        microphoneMuted={false}
        speakerMuted={false}
        emotion="happy"
        assistantText="你好呀"
        onSessionAction={vi.fn()}
        onEndSession={vi.fn()}
        onToggleMicrophoneMute={vi.fn()}
        onToggleSpeakerMute={vi.fn()}
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

import { useState } from "react";
import { LayoutDashboard, MessageSquareText, Send } from "lucide-react";
import type { ChatLine, ConnectionState } from "../../domain/types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { ErrorNotice } from "./ErrorNotice";
import { SessionInfo } from "./SessionInfo";
import { TranscriptPanel } from "./TranscriptPanel";

type DashboardDialogProps = {
  state: ConnectionState;
  error: string | null;
  sessionId?: string;
  emotion?: string;
  microphoneMuted: boolean;
  speakerMuted: boolean;
  lines: ChatLine[];
  onSendText?: (text: string) => boolean;
};

export function DashboardDialog({
  state,
  error,
  sessionId,
  emotion,
  microphoneMuted,
  speakerMuted,
  lines,
  onSendText,
}: DashboardDialogProps) {
  const [chatText, setChatText] = useState("");

  const canSendText = state === "ready";

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || !onSendText) return;
    if (onSendText(text)) setChatText("");
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="hud-btn"
            aria-label="打开会话仪表盘"
            title="会话仪表盘与对话记录"
          />
        }
      >
        <LayoutDashboard className="hud-icon" />
        <span className="hud-btn-label">仪表盘</span>
        {lines.length > 0 && (
          <span className="hud-badge" aria-label={`共 ${lines.length} 条记录`}>
            {lines.length}
          </span>
        )}
        {error && <span className="hud-error-dot" aria-hidden="true" />}
      </DialogTrigger>

      <DialogContent className="dashboard-dialog-content sm:max-w-xl">
        <DialogHeader className="dashboard-dialog-header">
          <div className="dashboard-header-top">
            <span className="section-kicker">SESSION CONSOLE</span>
            <span className="console-version">灵矽AI 伴侣</span>
          </div>
          <DialogTitle className="dashboard-title">实时会话仪表盘</DialogTitle>
          <DialogDescription>
            查看实时连接状态、会话参数、历史对话记录，或通过文字与芙宁娜交流。
          </DialogDescription>
        </DialogHeader>

        <div className="dashboard-body">
          <SessionInfo
            state={state}
            sessionId={sessionId}
            emotion={emotion}
            microphoneMuted={microphoneMuted}
            speakerMuted={speakerMuted}
          />

          <ErrorNotice message={error} />

          <TranscriptPanel
            lines={lines}
            emptyMessage="按住主界面底部按钮说话或在此发送文字，对话记录将实时呈现在这里。"
          />

          {onSendText && (
            <form className="dashboard-chat-bar" onSubmit={handleSend}>
              <div className="dashboard-input-wrap">
                <MessageSquareText className="dashboard-input-icon" />
                <input
                  type="text"
                  className="dashboard-chat-input"
                  placeholder={
                    canSendText
                      ? "输入文字对芙宁娜说点什么... (Enter 发送)"
                      : "连接就绪后可发送文字消息..."
                  }
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  disabled={!canSendText}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="dashboard-chat-send"
                disabled={!canSendText || !chatText.trim()}
              >
                <Send className="size-3.5" />
                <span>发送</span>
              </Button>
            </form>
          )}
        </div>

        <div className="dashboard-footer-meta">
          <span>VoiceMate 灵矽AI 伴侣系统</span>
          <span>HTTP / WebSocket · Qiniu Linx AI</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

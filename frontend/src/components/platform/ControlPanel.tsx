import { useState } from "react";
import type { ConnectionState } from "../../domain/types";

type ControlPanelProps = {
  state: ConnectionState;
  notice: string;
  disabled?: boolean;
  muted: boolean;
  onSessionAction: () => void;
  onEndSession: () => void;
  onToggleMute: () => void;
  onInputAction?: () => void;
  onSendText?: (text: string) => void;
};

export function ControlPanel({
  state,
  notice,
  disabled = false,
  muted,
  onSessionAction,
  onEndSession,
  onToggleMute,
  onSendText,
}: ControlPanelProps) {
  const [chatText, setChatText] = useState("");
  const isCalling =
    state === "calling" || state === "speaking" || state === "listening";
  const isConnecting = state === "connecting";

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || !onSendText) return;
    onSendText(text);
    setChatText("");
  };

  function renderCallActions() {
    if (isConnecting) {
      return (
        <button
          type="button"
          className="call-action-btn call-connecting"
          disabled
        >
          <span className="call-icon call-pulse">📞</span>
          <span>正在接通灵矽AI...</span>
        </button>
      );
    }
    if (isCalling) {
      return (
        <div className="in-call-controls">
          <button
            type="button"
            className={`call-sub-btn ${muted ? "muted" : ""}`}
            onClick={onToggleMute}
            title={muted ? "解除麦克风静音" : "静音麦克风"}
          >
            <span>{muted ? "🔇" : "🎙️"}</span>
            <span>{muted ? "已静音" : "麦克风开启"}</span>
          </button>
          <button
            type="button"
            className="call-action-btn call-hangup"
            onClick={onEndSession}
          >
            <span>🔴</span>
            <span>挂断电话</span>
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="call-action-btn call-start"
        onClick={onSessionAction}
        disabled={disabled}
      >
        <span className="call-icon">📞</span>
        <span>{state === "error" ? "重新呼叫" : "接通实时电话"}</span>
      </button>
    );
  }

  return (
    <section className="control-panel" aria-label="操作区">
      <div className="call-status-header">
        <p className="panel-label">REALTIME CALL CONTROL</p>
        <h2>{notice}</h2>
      </div>

      <div className="control-actions">{renderCallActions()}</div>

      {/* 实时通话文本发送辅助框 */}
      {isCalling && (
        <form className="call-chat-bar" onSubmit={handleSend}>
          <input
            type="text"
            className="call-chat-input"
            placeholder="也可打字对芙宁娜说点什么... (Enter 发送)"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
          />
          <button
            type="submit"
            className="call-chat-send"
            disabled={!chatText.trim()}
          >
            发送
          </button>
        </form>
      )}
    </section>
  );
}

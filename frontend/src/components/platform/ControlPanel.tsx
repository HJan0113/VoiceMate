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
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  onSendText?: (text: string) => void;
};

function getPttButtonText(
  state: ConnectionState,
  isRecording: boolean,
): string {
  if (isRecording) {
    return "松开发送";
  }
  if (state === "speaking") {
    return "芙宁娜说话中...";
  }
  if (state === "processing") {
    return "正在思考... (按住可打断)";
  }
  return "按住说话";
}

export function ControlPanel({
  state,
  notice,
  disabled = false,
  muted,
  onSessionAction,
  onEndSession,
  onToggleMute,
  onInputAction,
  onStartVoice,
  onStopVoice,
  onSendText,
}: ControlPanelProps) {
  const [chatText, setChatText] = useState("");
  const [isPressing, setIsPressing] = useState(false);

  const isConnected =
    state === "ready" ||
    state === "listening" ||
    state === "speaking" ||
    state === "processing";
  const isRecording = state === "listening" || isPressing;
  const sessionLabel = state === "error" ? "重试连接" : "开始会话";

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || !isConnected) return;
    setIsPressing(true);
    if (onStartVoice) {
      onStartVoice();
    } else if (onInputAction) {
      onInputAction();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPressing) {
      setIsPressing(false);
      if (onStopVoice) {
        onStopVoice();
      } else if (onInputAction) {
        onInputAction();
      }
    }
  };

  const handleMouseLeave = () => {
    if (isPressing) {
      setIsPressing(false);
      if (onStopVoice) {
        onStopVoice();
      } else if (onInputAction) {
        onInputAction();
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (disabled || !isConnected) return;
    setIsPressing(true);
    if (onStartVoice) {
      onStartVoice();
    } else if (onInputAction) {
      onInputAction();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isPressing) {
      setIsPressing(false);
      if (onStopVoice) {
        onStopVoice();
      } else if (onInputAction) {
        onInputAction();
      }
    }
  };

  const handleClick = () => {
    if (onInputAction) {
      onInputAction();
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || !onSendText) return;
    onSendText(text);
    setChatText("");
  };

  return (
    <section className="control-panel" aria-label="操作区">
      <div className="call-status-header">
        <p className="panel-label">VOICE CONTROL</p>
        <h2>{notice}</h2>
      </div>

      <div className="control-actions">
        {!isConnected ? (
          <button
            type="button"
            className="call-action-btn call-start"
            onClick={onSessionAction}
            disabled={disabled}
            aria-label={sessionLabel}
          >
            <span className="call-icon" aria-hidden="true">
              ⚡
            </span>
            <span>{sessionLabel}</span>
          </button>
        ) : (
          <div className="push-to-talk-wrapper">
            <button
              type="button"
              className={`ptt-button ${isRecording ? "recording" : ""}`}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={handleClick}
              disabled={disabled || state === "speaking"}
              aria-label={isRecording ? "松开发送" : "开始输入"}
            >
              <span className="ptt-icon">{isRecording ? "🔴" : "🎙️"}</span>
              <span className="ptt-text">
                {getPttButtonText(state, isRecording)}
              </span>
            </button>

            <div className="ptt-sub-bar">
              <button
                type="button"
                className={`ptt-sub-btn ${muted ? "muted" : ""}`}
                onClick={onToggleMute}
                aria-pressed={muted}
              >
                <span>{muted ? "取消静音" : "静音"}</span>
              </button>
              <button
                type="button"
                className="ptt-sub-btn hangup"
                onClick={onEndSession}
              >
                <span>结束会话</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 文本发送栏 */}
      {isConnected && (
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

import { useState } from "react";
import { Mic, PhoneOff, Power, Volume2, VolumeX } from "lucide-react";
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
}: ControlPanelProps) {
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

  return (
    <section className="control-panel" aria-label="操作区" title={notice}>
      <div className="control-dock">
        {!isConnected ? (
          <button
            type="button"
            className="call-action-btn call-start"
            onClick={onSessionAction}
            disabled={disabled}
            aria-label={sessionLabel}
          >
            <Power className="dock-icon" aria-hidden="true" />
            <span>{sessionLabel}</span>
          </button>
        ) : (
          <div className="dock-connected-row">
            <button
              type="button"
              className={`dock-side-btn ${muted ? "muted" : ""}`}
              onClick={onToggleMute}
              aria-pressed={muted}
              aria-label={muted ? "取消静音" : "静音"}
              title={muted ? "取消静音" : "静音"}
            >
              {muted ? (
                <VolumeX className="dock-icon" aria-hidden="true" />
              ) : (
                <Volume2 className="dock-icon" aria-hidden="true" />
              )}
              <span className="dock-side-label">
                {muted ? "取消静音" : "静音"}
              </span>
            </button>

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
              <Mic className="ptt-icon" aria-hidden="true" />
              <span className="ptt-text">
                {getPttButtonText(state, isRecording)}
              </span>
            </button>

            <button
              type="button"
              className="dock-side-btn hangup"
              onClick={onEndSession}
              aria-label="结束会话"
              title="结束会话"
            >
              <PhoneOff className="dock-icon" aria-hidden="true" />
              <span className="dock-side-label">结束会话</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

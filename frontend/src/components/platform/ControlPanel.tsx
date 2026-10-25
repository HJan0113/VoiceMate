import { useState } from "react";
import { Mic, MicOff, PhoneOff, Power, Volume2, VolumeX } from "lucide-react";
import type { ConnectionState } from "../../domain/types";

type ControlPanelProps = {
  state: ConnectionState;
  notice: string;
  disabled?: boolean;
  microphoneMuted: boolean;
  speakerMuted: boolean;
  onSessionAction: () => void;
  onEndSession: () => void;
  onToggleMicrophoneMute: () => void;
  onToggleSpeakerMute: () => void;
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
    return "按住打断并说话";
  }
  if (state === "processing") {
    return "正在思考... (按住可打断)";
  }
  return "按住说话";
}

function getPttButtonLabel(
  state: ConnectionState,
  isRecording: boolean,
): string {
  if (isRecording) return "松开发送";
  if (state === "speaking" || state === "processing") {
    return "打断并开始输入";
  }
  return "开始输入";
}

export function ControlPanel({
  state,
  notice,
  disabled = false,
  microphoneMuted,
  speakerMuted,
  onSessionAction,
  onEndSession,
  onToggleMicrophoneMute,
  onToggleSpeakerMute,
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
              className={`dock-side-btn ${microphoneMuted ? "muted" : ""}`}
              onClick={onToggleMicrophoneMute}
              aria-pressed={microphoneMuted}
              aria-label={microphoneMuted ? "取消麦克风静音" : "静音麦克风"}
              title={microphoneMuted ? "取消麦克风静音" : "静音麦克风"}
            >
              {microphoneMuted ? (
                <MicOff className="dock-icon" aria-hidden="true" />
              ) : (
                <Mic className="dock-icon" aria-hidden="true" />
              )}
              <span className="dock-side-label">
                {microphoneMuted ? "麦克风已静音" : "麦克风"}
              </span>
            </button>

            <button
              type="button"
              className={`dock-side-btn ${speakerMuted ? "muted" : ""}`}
              onClick={onToggleSpeakerMute}
              aria-pressed={speakerMuted}
              aria-label={speakerMuted ? "取消扬声器静音" : "静音扬声器"}
              title={speakerMuted ? "取消扬声器静音" : "静音扬声器"}
            >
              {speakerMuted ? (
                <VolumeX className="dock-icon" aria-hidden="true" />
              ) : (
                <Volume2 className="dock-icon" aria-hidden="true" />
              )}
              <span className="dock-side-label">
                {speakerMuted ? "扬声器已静音" : "扬声器"}
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
              disabled={disabled}
              aria-label={getPttButtonLabel(state, isRecording)}
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

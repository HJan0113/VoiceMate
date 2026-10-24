import type { ConnectionState } from "../../domain/types";

type ControlPanelProps = {
  state: ConnectionState;
  notice: string;
  disabled?: boolean;
  muted: boolean;
  onSessionAction: () => void;
  onEndSession: () => void;
  onInputAction: () => void;
  onToggleMute: () => void;
};

export function ControlPanel({
  state,
  notice,
  disabled = false,
  muted,
  onSessionAction,
  onEndSession,
  onInputAction,
  onToggleMute,
}: ControlPanelProps) {
  const activeSession = state !== "idle";
  const listening = state === "listening";
  const sessionLabel = state === "error" ? "重试连接" : "开始会话";
  const inputLabel = listening ? "停止输入" : "开始输入";

  return (
    <section className="control-panel" aria-label="操作区">
      <div>
        <p className="panel-label">SESSION CONTROL</p>
        <h2>{notice}</h2>
      </div>
      <div className="control-actions">
        {!activeSession || state === "error" ? (
          <button
            type="button"
            className="talk-button"
            onClick={onSessionAction}
            disabled={disabled}
          >
            <span className="mic-ring" aria-hidden="true">
              ◉
            </span>
            <span>{sessionLabel}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`talk-button ${listening ? "active" : ""}`}
              onClick={onInputAction}
              disabled={
                disabled || state === "speaking" || state === "processing"
              }
            >
              <span className="mic-ring" aria-hidden="true">
                {listening ? "■" : "◉"}
              </span>
              <span>{inputLabel}</span>
            </button>
            <button
              type="button"
              className={`secondary-button ${muted ? "active" : ""}`}
              onClick={onToggleMute}
              disabled={
                disabled || state === "speaking" || state === "processing"
              }
              aria-pressed={muted}
            >
              {muted ? "取消静音" : "静音"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onEndSession}
              disabled={disabled || listening}
            >
              结束会话
            </button>
          </>
        )}
      </div>
    </section>
  );
}

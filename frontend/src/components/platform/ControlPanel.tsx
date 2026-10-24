import type { ConnectionState } from "../../domain/types";

type ControlPanelProps = {
  state: ConnectionState;
  notice: string;
  disabled?: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
};

export function ControlPanel({
  state,
  notice,
  disabled = false,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
}: ControlPanelProps) {
  const listening = state === "listening";
  let label = "开始会话";
  if (listening) label = "松开结束";
  else if (state === "ready") label = "按住输入";

  return (
    <section className="control-panel" aria-label="操作区">
      <div>
        <p className="panel-label">SESSION CONTROL</p>
        <h2>{notice}</h2>
      </div>
      <button
        type="button"
        className={`talk-button ${listening ? "active" : ""}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        disabled={disabled}
        aria-label={label}
      >
        <span className="mic-ring" aria-hidden="true">
          {listening ? "■" : "◉"}
        </span>
        <span>{label}</span>
      </button>
    </section>
  );
}

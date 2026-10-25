import type { ConnectionState } from "../../domain/types";
import { getStatusLabel } from "./StatusBadge";

type SessionInfoProps = {
  state: ConnectionState;
  sessionId?: string;
  emotion?: string;
  microphoneMuted?: boolean;
  speakerMuted?: boolean;
};

export function SessionInfo({
  state,
  sessionId,
  emotion = "neutral",
  microphoneMuted = false,
  speakerMuted = false,
}: SessionInfoProps) {
  return (
    <section className="session-info" aria-label="会话信息">
      <div className="session-info-primary">
        <p className="panel-label">SESSION STATUS</p>
        <h2>{getStatusLabel(state)}</h2>
      </div>
      <dl className="session-meta">
        <div>
          <dt>状态</dt>
          <dd>{getStatusLabel(state)}</dd>
        </div>
        <div>
          <dt>情绪</dt>
          <dd>{emotion}</dd>
        </div>
        <div>
          <dt>麦克风</dt>
          <dd>{microphoneMuted ? "已静音" : "正常"}</dd>
        </div>
        <div>
          <dt>扬声器</dt>
          <dd>{speakerMuted ? "已静音" : "正常"}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd title={sessionId}>{sessionId ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

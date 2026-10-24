import type { ConnectionState } from "../../domain/types";
import { getStatusLabel } from "./StatusBadge";

type SessionInfoProps = {
  state: ConnectionState;
  sessionId?: string;
};

export function SessionInfo({ state, sessionId }: SessionInfoProps) {
  return (
    <section className="session-info" aria-label="会话信息">
      <div>
        <p className="panel-label">SESSION</p>
        <h2>{getStatusLabel(state)}</h2>
      </div>
      <dl className="session-meta">
        <div>
          <dt>状态</dt>
          <dd>{getStatusLabel(state)}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>{sessionId ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
